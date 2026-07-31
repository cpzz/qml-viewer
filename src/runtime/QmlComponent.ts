import { parseQMLDocument, type QMLDocumentAst } from '../renderer/parser'
import { instantiateQmlDocument, type QmlDocumentInstance } from './QmlDocument'
import type { QmlObject } from './QmlObject'
import type { QmlTypeRegistry } from './QmlTypeRegistry'

export type QmlComponentStatus = 'Ready' | 'Error'

export class QmlComponent {
  readonly ast: QMLDocumentAst
  readonly status: QmlComponentStatus
  readonly errors: Error[]

  constructor(
    readonly source: string,
    private readonly registry: QmlTypeRegistry,
    readonly url = '',
  ) {
    this.ast = parseQMLDocument(source)
    if (this.ast.nodes.length === 0) {
      this.status = 'Error'
      this.errors = [new Error(`QML component ${url || '<inline>'} has no root object`)]
    } else if (this.ast.nodes.length > 1) {
      this.status = 'Error'
      this.errors = [new Error(`QML component ${url || '<inline>'} must have exactly one root object`)]
    } else {
      this.status = 'Ready'
      this.errors = []
    }
  }

  create(parent: QmlObject | null = null): QmlDocumentInstance {
    if (this.status !== 'Ready') throw this.errors[0]
    return instantiateQmlDocument(this.ast.nodes, this.registry, parent)
  }

  createUncompleted(parent: QmlObject | null = null): QmlDocumentInstance {
    if (this.status !== 'Ready') throw this.errors[0]
    return instantiateQmlDocument(this.ast.nodes, this.registry, parent, false)
  }
}
