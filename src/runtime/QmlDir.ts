export interface QmlDirTypeEntry {
  name: string
  version?: string
  file: string
  singleton: boolean
  internal: boolean
}

export interface QmlDirDocument {
  module?: string
  types: QmlDirTypeEntry[]
  plugins: string[]
  diagnostics: string[]
}

export function parseQmlDir(source: string): QmlDirDocument {
  const document: QmlDirDocument = { types: [], plugins: [], diagnostics: [] }
  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.replace(/#.*/, '').trim()
    if (!line) continue
    const parts = line.split(/\s+/)
    if (parts[0] === 'module' && parts.length === 2) {
      document.module = parts[1]
      continue
    }
    if (parts[0] === 'plugin' && parts.length >= 2) {
      document.plugins.push(parts[1])
      continue
    }
    if (['classname', 'typeinfo', 'depends', 'import', 'optional', 'prefer', 'designersupported'].includes(parts[0])) {
      continue
    }

    const singleton = parts[0] === 'singleton'
    const internal = parts[0] === 'internal'
    const entry = singleton || internal ? parts.slice(1) : parts
    const hasVersion = /^\d+(?:\.\d+)?$/.test(entry[1] ?? '')
    if (entry.length < (hasVersion ? 3 : 2) || !/^[A-Z]\w*$/.test(entry[0])) {
      document.diagnostics.push(`Invalid qmldir entry at line ${index + 1}: ${rawLine.trim()}`)
      continue
    }
    document.types.push({
      name: entry[0],
      version: hasVersion ? entry[1] : undefined,
      file: entry[hasVersion ? 2 : 1],
      singleton,
      internal,
    })
  }
  return document
}