import {
  getQuickJS,
  shouldInterruptAfterDeadline,
  type QuickJSWASMModule,
} from 'quickjs-emscripten'
import { parseQmlColor, qmlHslToRgb, qmlHsvToRgb, toQmlColorString, type QmlColorTuple } from './QmlColor'

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
  getObjectMemberKind(id: string, name: string): 'property' | 'group' | 'method' | 'signal' | undefined
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

  dispose(): void {
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

      // Register Qt namespace constants
      const qtHandle = context.newObject()
      // setProp 的 value 参数必须是 QuickJSHandle（Lifetime），
      // 传裸数字会让 value.value 为 undefined，WASM 层将其当作 0。
      const setNumber = (name: string, value: number) => {
        context.newNumber(value).consume(handle => context.setProp(qtHandle, name, handle))
      }
      // CheckState
      setNumber('Unchecked', 0)
      setNumber('PartiallyChecked', 1)
      setNumber('Checked', 2)
      // Alignment
      setNumber('AlignLeft', 1)
      setNumber('AlignRight', 2)
      setNumber('AlignHCenter', 4)
      setNumber('AlignTop', 32)
      setNumber('AlignBottom', 128)
      setNumber('AlignVCenter', 64)
      setNumber('AlignCenter', 68) // AlignHCenter | AlignVCenter
      // Orientation
      setNumber('Horizontal', 1)
      setNumber('Vertical', 2)
      // LayoutDirection
      setNumber('LeftToRight', 0)
      setNumber('RightToLeft', 1)
      setNumber('LayoutDirectionAuto', 2)
      // FocusPolicy
      setNumber('NoFocus', 0)
      setNumber('TabFocus', 1)
      setNumber('ClickFocus', 2)
      setNumber('StrongFocus', 11) // TabFocus | ClickFocus
      setNumber('WheelFocus', 4)
      // MouseButton
      setNumber('LeftButton', 1)
      setNumber('RightButton', 2)
      setNumber('MiddleButton', 4)
      // Edge
      setNumber('LeftEdge', 1)
      setNumber('RightEdge', 2)
      setNumber('TopEdge', 4)
      setNumber('BottomEdge', 8)
      // DropAction
      setNumber('IgnoreAction', 0)
      setNumber('CopyAction', 1)
      setNumber('MoveAction', 2)
      setNumber('LinkAction', 4)

      // Register Qt color helper functions (QML color value type)
      const installQtFunction = (name: string, fn: (values: unknown[]) => unknown) => {
        const handle = context.newFunction(name, (...args) => {
          const values = args.map(arg => {
            const type = context.typeof(arg)
            if (type === 'number') return context.getNumber(arg)
            if (type === 'string') return context.getString(arg)
            if (type === 'boolean') return context.getBoolean(arg)
            return context.dump(arg)
          })
          const result = fn(values)
          // Qt 颜色函数以值语义直接参与表达式求值（不经 __value/JSON.parse 解包），
          // 必须返回原始类型句柄。stringify 会多包一层引号（"#aarrggbb"），
          // 导致绑定求值结果是带引号字符串，parseQmlColor 解析失败 → 颜色失效。
          if (typeof result === 'string') return context.newString(result)
          if (typeof result === 'boolean') return result ? context.true : context.false
          if (typeof result === 'number') return context.newNumber(result)
          return context.newString(stringify(result))
        })
        context.setProp(qtHandle, name, handle)
        handle.dispose()
      }
      const requireColor = (value: unknown): QmlColorTuple => {
        const color = parseQmlColor(value)
        if (!color) throw new Error(`Invalid QML color value: ${String(value)}`)
        return color
      }
      // Qt.rgba(r, g, b, a) — 各分量 0-1 浮点
      installQtFunction('rgba', values => {
        const [r = 0, g = 0, b = 0, a = 1] = values.map(Number)
        return toQmlColorString([r * 255, g * 255, b * 255, a * 255])
      })
      // Qt.rgb(r, g, b) — 各分量 0-1 浮点，alpha 为 1
      installQtFunction('rgb', values => {
        const [r = 0, g = 0, b = 0] = values.map(Number)
        return toQmlColorString([r * 255, g * 255, b * 255, 255])
      })
      // Qt.hsva(h, s, v, a) — HSV 模型，各分量 0-1
      installQtFunction('hsva', values => {
        const [h = 0, s = 0, v = 0, a = 1] = values.map(Number)
        const [r, g, b] = qmlHsvToRgb(h, s, v)
        return toQmlColorString([r * 255, g * 255, b * 255, a * 255])
      })
      // Qt.hsla(h, s, l, a) — HSL 模型，各分量 0-1
      installQtFunction('hsla', values => {
        const [h = 0, s = 0, l = 0, a = 1] = values.map(Number)
        const [r, g, b] = qmlHslToRgb(h, s, l)
        return toQmlColorString([r * 255, g * 255, b * 255, a * 255])
      })
      // Qt.darker(color, factor) — 默认 factor 2.0，按 1/factor 变暗
      installQtFunction('darker', values => {
        const [r, g, b, a] = requireColor(values[0])
        const scale = 1 / Math.max(0, Number(values[1] ?? 2))
        return toQmlColorString([r * scale, g * scale, b * scale, a])
      })
      // Qt.lighter(color, factor) — 默认 factor 1.5，按 factor 变亮
      installQtFunction('lighter', values => {
        const [r, g, b, a] = requireColor(values[0])
        const scale = Math.max(0, Number(values[1] ?? 1.5))
        return toQmlColorString([
          Math.min(255, r * scale), Math.min(255, g * scale), Math.min(255, b * scale), a,
        ])
      })
      // Qt.tint(color, tintColor) — 用 tintColor 的 alpha 混合
      installQtFunction('tint', values => {
        const [r1, g1, b1, a1] = requireColor(values[0])
        const [r2, g2, b2, a2] = requireColor(values[1])
        const mix = a2 / 255
        return toQmlColorString([
          r1 * (1 - mix) + r2 * mix,
          g1 * (1 - mix) + g2 * mix,
          b1 * (1 - mix) + b2 * mix,
          a1 * (1 - mix) + a2,
        ])
      })
      // Qt.colorEqual(color1, color2) — 解析后比较颜色是否相等
      installQtFunction('colorEqual', values => {
        const first = requireColor(values[0])
        const second = requireColor(values[1])
        return first.every((component, index) => Math.abs(component - second[index]) < 0.5)
      })

      context.setProp(context.global, 'Qt', qtHandle)
      qtHandle.dispose()

      const installNumberNamespace = (namespace: string, values: Record<string, number>) => {
        const namespaceHandle = context.newObject()
        for (const [name, value] of Object.entries(values)) {
          context.newNumber(value).consume(handle => context.setProp(namespaceHandle, name, handle))
        }
        context.setProp(context.global, namespace, namespaceHandle)
        namespaceHandle.dispose()
      }
      installNumberNamespace('Item', {
        TopLeft: 0, Top: 1, TopRight: 2, Left: 3, Center: 4,
        Right: 5, BottomLeft: 6, Bottom: 7, BottomRight: 8,
      })
      installNumberNamespace('Text', {
        NoWrap: 0, WordWrap: 1, WrapAnywhere: 2, Wrap: 3,
        ElideLeft: 0, ElideRight: 1, ElideMiddle: 2, ElideNone: 3,
        AlignLeft: 1, AlignRight: 2, AlignHCenter: 4,
        AlignTop: 32, AlignVCenter: 64, AlignBottom: 128,
        ProportionalHeight: 0, FixedHeight: 1,
      })
      installNumberNamespace('Keys', { BeforeItem: 0, AfterItem: 1 })
      installNumberNamespace('KeyNavigation', { BeforeItem: 0, AfterItem: 1 })
      installNumberNamespace('Drag', { Internal: 0, Automatic: 1, None: 2 })
      installNumberNamespace('ShaderEffectSource', {
        Alpha: 0, RGB: 1, RGBA: 2, RGBA8: 3, RGBA16F: 4, RGBA32F: 5,
        MirrorVertically: 1, MirrorHorizontally: 2,
        ClampToEdge: 0, RepeatHorizontally: 1, RepeatVertically: 2, Repeat: 3,
      })

      // Register qsTr() global function (returns input string as-is, no actual translation)
      const qsTrHandle = context.newFunction('qsTr', (...args) => {
        if (args.length === 0) return context.newString('')
        return context.newString(context.getString(args[0]))
      })
      context.setProp(context.global, 'qsTr', qsTrHandle)
      qsTrHandle.dispose()

      // Register Easing namespace constants (QEasingCurve::Type values)
      const easingHandle = context.newObject()
      const easingTypes: Record<string, number> = {
        Linear: 0,
        InQuad: 1, OutQuad: 2, InOutQuad: 3, OutInQuad: 4,
        InCubic: 5, OutCubic: 6, InOutCubic: 7, OutInCubic: 8,
        InQuart: 9, OutQuart: 10, InOutQuart: 11, OutInQuart: 12,
        InQuint: 13, OutQuint: 14, InOutQuint: 15, OutInQuint: 16,
        InSine: 17, OutSine: 18, InOutSine: 19, OutInSine: 20,
        InExpo: 21, OutExpo: 22, InOutExpo: 23, OutInExpo: 24,
        InCirc: 25, OutCirc: 26, InOutCirc: 27, OutInCirc: 28,
        InElastic: 29, OutElastic: 30, InOutElastic: 31, OutInElastic: 32,
        InBack: 33, OutBack: 34, InOutBack: 35, OutInBack: 36,
        InBounce: 37, OutBounce: 38, InOutBounce: 39, OutInBounce: 40,
      }
      for (const [name, value] of Object.entries(easingTypes)) {
        context.newNumber(value).consume(handle => context.setProp(easingHandle, name, handle))
      }
      context.setProp(context.global, 'Easing', easingHandle)
      easingHandle.dispose()

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
            return parsed && parsed.__qmlObjectId
              ? __makeProxy(parsed.__qmlObjectId, parsed.__qmlPropertyPrefix || '')
              : parsed;
          };
          const __makeProxy = (id, prefix = '') => {
            const key = id + ':' + prefix;
            if (__objects[key]) return __objects[key];
            const proxy = new Proxy({}, {
            get(_target, name) {
              const member = String(name);
              if (member === 'toJSON') return () => ({ __qmlObjectId: id, __qmlPropertyPrefix: prefix });
              const qualifiedMember = prefix + member;
              const kind = __parse(__qmlMemberKind(id, qualifiedMember));
              if (kind === 'property') return __value(__qmlGet(id, qualifiedMember));
              if (kind === 'group') return __makeProxy(id, qualifiedMember + '.');
              if (kind === 'method') return (...args) => __value(__qmlCall(id, qualifiedMember, JSON.stringify(args)));
              if (kind === 'signal') return (...args) => { __qmlEmit(id, qualifiedMember, JSON.stringify(args)); };
            },
            set(_target, name, value) {
              __qmlSet(id, prefix + String(name), JSON.stringify(value));
              return true;
            }
            });
            __objects[key] = proxy;
            if (!prefix) __objects[id] = proxy;
            return proxy;
          };
          ${JSON.stringify(bridge.objectIds)}.forEach(id => __makeProxy(id));
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
