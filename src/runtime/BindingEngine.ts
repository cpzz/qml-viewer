import { collectQmlPropertyReads, QmlObject } from './QmlObject'

export type QmlBindingExpression = () => unknown

interface ActiveBinding {
  evaluate: QmlBindingExpression
  evaluating: boolean
  subscriptions: Array<() => void>
}

export class BindingEngine {
  private readonly bindings = new Map<QmlObject, Map<string, ActiveBinding>>()

  bind(target: QmlObject, propertyName: string, evaluate: QmlBindingExpression): () => void {
    this.unbind(target, propertyName)

    const binding: ActiveBinding = {
      evaluate,
      evaluating: false,
      subscriptions: [],
    }
    const objectBindings = this.bindings.get(target) ?? new Map<string, ActiveBinding>()
    objectBindings.set(propertyName, binding)
    this.bindings.set(target, objectBindings)
    this.refresh(target, propertyName, binding)

    return () => this.unbind(target, propertyName, binding)
  }

  unbind(target: QmlObject, propertyName: string, expectedBinding?: ActiveBinding): void {
    const objectBindings = this.bindings.get(target)
    const binding = objectBindings?.get(propertyName)
    if (!binding || (expectedBinding && binding !== expectedBinding)) return

    binding.subscriptions.forEach(unsubscribe => unsubscribe())
    binding.subscriptions = []
    objectBindings?.delete(propertyName)
    if (objectBindings?.size === 0) this.bindings.delete(target)
  }

  dispose(): void {
    for (const [target, objectBindings] of this.bindings) {
      for (const propertyName of objectBindings.keys()) this.unbind(target, propertyName)
    }
  }

  private refresh(target: QmlObject, propertyName: string, binding: ActiveBinding): void {
    if (binding.evaluating) return
    binding.evaluating = true

    try {
      const result = collectQmlPropertyReads(binding.evaluate)
      binding.subscriptions.forEach(unsubscribe => unsubscribe())
      binding.subscriptions = result.dependencies.map(dependency => (
        dependency.object.onPropertyChanged(dependency.name, () => {
          this.refresh(target, propertyName, binding)
        })
      ))
      target.setProperty(propertyName, result.value)
    } finally {
      binding.evaluating = false
    }
  }
}
