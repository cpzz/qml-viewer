import type { QMLImport } from '../renderer/parser'
import { QmlComponent } from './QmlComponent'
import type { QmlTypeRegistry } from './QmlTypeRegistry'
import { parseQmlDir, type QmlDirDocument } from './QmlDir'

export interface QmlModuleDefinition {
  version?: string
  types: Record<string, string>
}

interface RegisteredModule {
  version?: string
  types: Map<string, RegisteredModuleType>
}

interface RegisteredModuleType {
  source: string
  url: string
  singleton?: boolean
  internal?: boolean
}

export interface QmlModuleSourceProvider {
  readText(url: string): string | undefined | Promise<string | undefined>
}

function versionParts(version: string): [number, number] {
  const [major, minor = '0'] = version.split('.')
  return [Number(major), Number(minor)]
}

function supportsVersion(moduleVersion: string | undefined, requested: string | undefined): boolean {
  if (!requested || !moduleVersion) return true
  const [moduleMajor, moduleMinor] = versionParts(moduleVersion)
  const [requestedMajor, requestedMinor] = versionParts(requested)
  return moduleMajor === requestedMajor && moduleMinor <= requestedMinor
}

export class QmlModuleResolver {
  private readonly modules = new Map<string, RegisteredModule[]>()
  private readonly singletons = new Map<string, ReturnType<QmlComponent['create']>>()

  registerModule(uri: string, definition: QmlModuleDefinition): void {
    const versions = this.modules.get(uri) ?? []
    if (versions.some(module => module.version === definition.version)) {
      throw new Error(`QML module ${uri} ${definition.version ?? '<unversioned>'} is already registered`)
    }
    versions.push({
      version: definition.version,
      types: new Map(Object.entries(definition.types).map(([name, source]) => [
        name,
        { source, url: `${uri}/${name}.qml`, singleton: false, internal: false },
      ])),
    })
    versions.sort((left, right) => {
      if (!left.version) return -1
      if (!right.version) return 1
      const [leftMajor, leftMinor] = versionParts(left.version)
      const [rightMajor, rightMinor] = versionParts(right.version)
      return leftMajor - rightMajor || leftMinor - rightMinor
    })
    this.modules.set(uri, versions)
  }

  registerQmlDir(baseUrl: string, source: string, provider: QmlModuleSourceProvider): QmlDirDocument {
    return this.registerQmlDirWithReader(baseUrl, source, url => {
      const value = provider.readText(url)
      if (value instanceof Promise) throw new Error('Async QML provider requires registerQmlDirAsync()')
      return value
    })
  }

  async registerQmlDirAsync(
    baseUrl: string,
    source: string,
    provider: QmlModuleSourceProvider,
  ): Promise<QmlDirDocument> {
    const document = parseQmlDir(source)
    if (!document.module) throw new Error('qmldir is missing a module declaration')
    if (document.diagnostics.length) throw new Error(document.diagnostics.join('\n'))

    const sources = new Map<string, string>()
    await Promise.all(document.types.map(async entry => {
      const url = `${baseUrl.replace(/\/$/, '')}/${entry.file}`
      const componentSource = await provider.readText(url)
      if (componentSource === undefined) throw new Error(`Unable to read QML component ${url}`)
      sources.set(url, componentSource)
    }))
    return this.registerQmlDirWithReader(baseUrl, source, url => sources.get(url))
  }

  private registerQmlDirWithReader(
    baseUrl: string,
    source: string,
    readText: (url: string) => string | undefined,
  ): QmlDirDocument {
    const document = parseQmlDir(source)
    if (!document.module) throw new Error('qmldir is missing a module declaration')
    if (document.diagnostics.length) throw new Error(document.diagnostics.join('\n'))

    const groups = new Map<string | undefined, Array<{ name: string } & RegisteredModuleType>>()
    for (const entry of document.types) {
      const url = `${baseUrl.replace(/\/$/, '')}/${entry.file}`
      const componentSource = readText(url)
      if (componentSource === undefined) throw new Error(`Unable to read QML component ${url}`)
      const group = groups.get(entry.version) ?? []
      group.push({
        name: entry.name,
        source: componentSource,
        url,
        singleton: entry.singleton,
        internal: entry.internal,
      })
      groups.set(entry.version, group)
    }

    for (const [version, entries] of groups) {
      const versions = this.modules.get(document.module) ?? []
      if (versions.some(module => module.version === version)) {
        throw new Error(`QML module ${document.module} ${version ?? '<unversioned>'} is already registered`)
      }
      versions.push({
        version,
        types: new Map(entries.map(entry => [entry.name, entry])),
      })
      versions.sort((left, right) => {
        if (!left.version) return -1
        if (!right.version) return 1
        const [leftMajor, leftMinor] = versionParts(left.version)
        const [rightMajor, rightMinor] = versionParts(right.version)
        return leftMajor - rightMajor || leftMinor - rightMinor
      })
      this.modules.set(document.module, versions)
    }
    return document
  }

  resolveComponent(
    imports: QMLImport[],
    typeName: string,
    registry: QmlTypeRegistry,
  ): QmlComponent {
    const separator = typeName.indexOf('.')
    const qualifier = separator >= 0 ? typeName.slice(0, separator) : undefined
    const localName = separator >= 0 ? typeName.slice(separator + 1) : typeName
    const matchingImports = imports.filter(item => (
      qualifier ? item.alias === qualifier : !item.alias
    ))

    for (const item of matchingImports) {
      const versions = this.modules.get(item.uri) ?? []
      const module = [...versions].reverse().find(candidate => (
        supportsVersion(candidate.version, item.version) && candidate.types.has(localName)
      ))
      const component = module?.types.get(localName)
      if (component !== undefined && !component.internal && !component.singleton) {
        return new QmlComponent(component.source, registry, component.url)
      }
    }
    throw new Error(`Unable to resolve QML type ${typeName}`)
  }

  resolveSingleton(
    imports: QMLImport[],
    typeName: string,
    registry: QmlTypeRegistry,
  ): ReturnType<QmlComponent['create']> {
    for (const item of imports) {
      const localName = item.alias && typeName.startsWith(`${item.alias}.`)
        ? typeName.slice(item.alias.length + 1)
        : !item.alias ? typeName : ''
      if (!localName) continue
      const versions = this.modules.get(item.uri) ?? []
      const module = [...versions].reverse().find(candidate => supportsVersion(candidate.version, item.version))
      const singleton = module?.types.get(localName)
      if (!singleton?.singleton || singleton.internal) continue
      const key = `${item.uri}@${module?.version ?? ''}:${localName}`
      let instance = this.singletons.get(key)
      if (!instance) {
        instance = new QmlComponent(singleton.source, registry, singleton.url).create()
        this.singletons.set(key, instance)
      }
      return instance
    }
    throw new Error(`Unable to resolve QML singleton ${typeName}`)
  }

  installImportedTypes(imports: QMLImport[], registry: QmlTypeRegistry): void {
    for (const item of imports.filter(entry => !entry.alias)) {
      const versions = this.modules.get(item.uri) ?? []
      const module = [...versions].reverse().find(candidate => supportsVersion(candidate.version, item.version))
      if (!module) continue
      for (const [name, source] of module.types) {
        if (source.internal || source.singleton) continue
        if (registry.has(name)) continue
        const component = new QmlComponent(source.source, registry, source.url)
        registry.registerFactory(name, parent => component.createUncompleted(parent))
      }
    }
  }
}
