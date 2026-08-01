import {
  getQuickJS,
  shouldInterruptAfterDeadline,
  type QuickJSWASMModule,
} from 'quickjs-emscripten'

export interface QmlJsEngineOptions {
  memoryLimitBytes?: number
  maxStackSizeBytes?: number
  timeoutMs?: number
}

export type QmlJsScope = Record<string, unknown>

export interface QmlJsCallResult {
  value: unknown
  scope: QmlJsScope
}

export interface QmlJsLiveBridge {
  scope: QmlJsScope
  objectIds: string[]
  hostFunctions: string[]
  contextProperties: string[]
  getContextProperty(name: string): unknown
  setContextProperty(name: string, value: unknown): void
  getObjectMemberKind(id: string, name: string): 'property' | 'method' | 'signal' | undefined
  getObjectProperty(id: string, name: string): unknown
  setObjectProperty(id: string, name: string, value: unknown): void
  callObjectMethod(id: string, name: string, args: unknown[]): unknown
  emitObjectSignal(id: string, name: string, args: unknown[]): void
  callHostFunction(name: string, args: unknown[]): unknown
}

const DEFAULT_MEMORY_LIMIT = 8 * 1024 * 1024
const DEFAULT_STACK_LIMIT = 512 * 1024
const DEFAULT_TIMEOUT = 250

function serializeScope(scope: QmlJsScope): string {
  try {
    return JSON.stringify(scope)
  } catch (error) {
    throw new Error(`QML JavaScript scope is not serializable: ${String(error)}`)
  }
}

export class QmlJsEngine {
  private constructor(
    private readonly quickJs: QuickJSWASMModule,
    private readonly options: Required<QmlJsEngineOptions>,
  ) {}

  static async create(options: QmlJsEngineOptions = {}): Promise<QmlJsEngine> {
    return new QmlJsEngine(await getQuickJS(), {
      memoryLimitBytes: options.memoryLimitBytes ?? DEFAULT_MEMORY_LIMIT,
      maxStackSizeBytes: options.maxStackSizeBytes ?? DEFAULT_STACK_LIMIT,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT,
    })
  }

  evaluate(expression: string, scope: QmlJsScope = {}): unknown {
    const source = `
      (function (__scope) {
        with (__scope) {
          return (${expression});
        }
      })(${serializeScope(scope)})
    `
    return this.run(source)
  }

  execute(body: string, scope: QmlJsScope = {}): QmlJsScope {
    const source = `
      (function (__scope) {
        with (__scope) {
          ${body}
        }
        return __scope;
      })(${serializeScope(scope)})
    `
    return this.run(source) as QmlJsScope
  }

  private run(source: string): unknown {
    return this.quickJs.evalCode(source, {
      memoryLimitBytes: this.options.memoryLimitBytes,
      maxStackSizeBytes: this.options.maxStackSizeBytes,
      shouldInterrupt: shouldInterruptAfterDeadline(Date.now() + this.options.timeoutMs),
    })
  }

  call(functionSource: string, args: unknown[] = [], scope: QmlJsScope = {}): QmlJsCallResult {
    const source = `
      (function (__scope, __args) {
        with (__scope) {
          const __value = (${functionSource})(...__args);
          return [__value, __scope];
        }
      })(${serializeScope(scope)}, ${JSON.stringify(args)})
    `
    const [value, changedScope] = this.run(source) as [unknown, QmlJsScope]
    return { value, scope: changedScope }
  }

  evaluateLive(expression: string, bridge: QmlJsLiveBridge): unknown {
    return this.runLive(`return (${expression});`, bridge)
  }

  async evaluateLiveAsync(expression: string, bridge: QmlJsLiveBridge): Promise<unknown> {
    return this.runLiveAsync(`return (${expression});`, bridge)
  }

  executeLive(body: string, bridge: QmlJsLiveBridge): void {
    this.runLive(body, bridge)
  }

  async executeLiveAsync(body: string, bridge: QmlJsLiveBridge): Promise<void> {
    await this.runLiveAsync(body, bridge)
  }

  callLive(functionSource: string, args: unknown[], bridge: QmlJsLiveBridge): unknown {
    return this.runLive(`return (${functionSource})(...${JSON.stringify(args)});`, bridge)
  }

  async callLiveAsync(functionSource: string, args: unknown[], bridge: QmlJsLiveBridge): Promise<unknown> {
    return this.runLiveAsync(`return (${functionSource})(...${JSON.stringify(args)});`, bridge)
  }

  private runLive(body: string, bridge: QmlJsLiveBridge): unknown {
    return this.runLiveInternal(body, bridge, false)
  }

  private async runLiveAsync(body: string, bridge: QmlJsLiveBridge): Promise<unknown> {
    return this.runLiveInternal(body, bridge, true)
  }

  private runLiveInternal(body: string, bridge: QmlJsLiveBridge, asynchronous: false): unknown
  private runLiveInternal(body: string, bridge: QmlJsLiveBridge, asynchronous: true): Promise<unknown>
  private runLiveInternal(body: string, bridge: QmlJsLiveBridge, asynchronous: boolean): unknown | Promise<unknown> {
    const runtime = this.quickJs.newRuntime()
    runtime.setMemoryLimit(this.options.memoryLimitBytes)
    runtime.setMaxStackSize(this.options.maxStackSizeBytes)
    runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + this.options.timeoutMs))
    const context = runtime.newContext()
    const deferredPromises = new Set<ReturnType<typeof context.newPromise>>()
    const stringify = (value: unknown) => JSON.stringify(value) ?? 'null'
    const install = (name: string, callback: (...args: string[]) => unknown) => {
      const handle = context.newFunction(name, (...args) => {
        const result = callback(...args.map(arg => context.getString(arg)))
        return context.newString(stringify(result))
      })
      context.setProp(context.global, name, handle)
      handle.dispose()
    }

    let cleanedUp = false
    const cleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      deferredPromises.forEach(promise => promise.dispose())
      context.dispose()
      runtime.dispose()
    }

    try {
      const consoleHandle = context.newObject()
      for (const method of ['log', 'warn', 'error', 'info', 'debug'] as const) {
        const fn = context.newFunction(`console_${method}`, (...args) => {
          const values = args.map(arg => {
            try { return context.dump(arg) } catch { return context.getString(arg) }
          })
          bridge.callHostFunction('__qmlConsole', [method, values])
          return null
        })
        context.setProp(consoleHandle, method, fn)
        fn.dispose()
      }
      context.setProp(context.global, 'console', consoleHandle)
      consoleHandle.dispose()

      install('__qmlGetContext', name => bridge.getContextProperty(name))
      install('__qmlSetContext', (name, value) => bridge.setContextProperty(name, JSON.parse(value)))
      install('__qmlMemberKind', (id, name) => bridge.getObjectMemberKind(id, name))
      install('__qmlGet', (id, name) => bridge.getObjectProperty(id, name))
      install('__qmlSet', (id, name, value) => bridge.setObjectProperty(id, name, JSON.parse(value)))
      install('__qmlCall', (id, name, args) => bridge.callObjectMethod(id, name, JSON.parse(args)))
      install('__qmlEmit', (id, name, args) => bridge.emitObjectSignal(id, name, JSON.parse(args)))
      const hostHandle = context.newFunction('__qmlHost', (nameHandle, argsHandle) => {
        const name = context.getString(nameHandle)
        const args = JSON.parse(context.getString(argsHandle))
        const result = bridge.callHostFunction(name, args)
        if (!(result instanceof Promise)) return context.newString(stringify(result))
        const deferred = context.newPromise()
        deferredPromises.add(deferred)
        void result.then(
          value => {
            const valueHandle = context.newString(stringify(value))
            deferred.resolve(valueHandle)
            valueHandle.dispose()
          },
          error => {
            const errorHandle = context.newError(String(error))
            deferred.reject(errorHandle)
            errorHandle.dispose()
          },
        )
        void deferred.settled.then(() => {
          const pending = runtime.executePendingJobs()
          pending.dispose()
        })
        return deferred.handle
      })
      context.setProp(context.global, '__qmlHost', hostHandle)
      hostHandle.dispose()

      const source = `
        (() => {
          const __objects = {};
          const __parse = value => JSON.parse(value);
          const __value = value => {
            const parsed = __parse(value);
            return parsed && parsed.__qmlObjectId ? __makeProxy(parsed.__qmlObjectId) : parsed;
          };
          const __makeProxy = id => __objects[id] ?? (__objects[id] = new Proxy({}, {
            get(_target, name) {
              const member = String(name);
              const kind = __parse(__qmlMemberKind(id, member));
              if (kind === 'property') return __value(__qmlGet(id, member));
              if (kind === 'method') return (...args) => __value(__qmlCall(id, member, JSON.stringify(args)));
              if (kind === 'signal') return (...args) => { __qmlEmit(id, member, JSON.stringify(args)); };
            },
            set(_target, name, value) {
              __qmlSet(id, String(name), JSON.stringify(value));
              return true;
            }
          }));
          ${JSON.stringify(bridge.objectIds)}.forEach(__makeProxy);
          const __hosts = Object.fromEntries(${JSON.stringify(bridge.hostFunctions)}.map(name => [
            name,
            (...args) => {
              const result = __qmlHost(name, JSON.stringify(args));
              return result && typeof result.then === 'function' ? result.then(__value) : __value(result);
            }
          ]));
          const __contextNames = new Set(${JSON.stringify(bridge.contextProperties)});
          const __scope = new Proxy(Object.assign(${serializeScope(bridge.scope)}, __objects, __hosts), {
            has(target, name) { return Reflect.has(target, name) || __contextNames.has(String(name)); },
            get(target, name) {
              if (Reflect.has(target, name)) return Reflect.get(target, name);
              return __value(__qmlGetContext(String(name)));
            },
            set(target, name, value) {
              if (Reflect.has(target, name)) Reflect.set(target, name, value);
              else if (__contextNames.has(String(name))) __qmlSetContext(String(name), JSON.stringify(value));
              else Reflect.set(target, name, value);
              return true;
            }
          });
          return (function () { with (__scope) { ${body} } })();
        })()
      `
      const result = context.unwrapResult(context.evalCode(source))
      if (asynchronous) {
        return context.resolvePromise(result).then(resolved => {
          result.dispose()
          const resolvedHandle = context.unwrapResult(resolved)
          try {
            return context.dump(resolvedHandle)
          } finally {
            resolvedHandle.dispose()
          }
        }).finally(cleanup)
      }
      try {
        return context.dump(result)
      } finally {
        result.dispose()
      }
    } catch (error) {
      cleanup()
      throw error
    } finally {
      if (!asynchronous) cleanup()
    }
  }
}
