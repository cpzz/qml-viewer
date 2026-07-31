import { QmlObject } from './QmlObject'

const properties = [
  'fillStyle', 'strokeStyle', 'lineWidth', 'font', 'globalAlpha',
  'textAlign', 'textBaseline', 'globalCompositeOperation',
]

const methods = [
  'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo',
  'arc', 'rect', 'fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect', 'fillText',
  'strokeText', 'save', 'restore', 'translate', 'rotate', 'scale', 'setTransform',
  'drawImage', 'createLinearGradient', 'createRadialGradient', 'getImageData', 'putImageData',
  'createShader', 'shaderSource', 'compileShader', 'createProgram', 'attachShader',
  'linkProgram', 'useProgram', 'getAttribLocation', 'getUniformLocation', 'enableVertexAttribArray',
  'vertexAttribPointer', 'uniform1f', 'uniform2f', 'uniform3f', 'uniform4f', 'drawArrays',
  'clearColor', 'clear', 'viewport', 'createBuffer', 'bindBuffer', 'bufferData',
]

export class QmlCanvasContext extends QmlObject {
  constructor(readonly nativeContext: object, readonly contextType: string) {
    super('CanvasContext')
    for (const name of properties) {
      this.defineProperty({
        name,
        type: 'var',
        initialValue: Reflect.get(nativeContext, name),
        onWrite: value => Reflect.set(nativeContext, name, value),
      })
    }
    for (const name of methods) {
      const method = Reflect.get(nativeContext, name)
      if (typeof method === 'function') {
        this.defineMethod(name, (...args) => Reflect.apply(method, nativeContext, args))
      }
    }
  }
}