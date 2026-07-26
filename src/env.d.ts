/// <reference types="vite/client" />

declare module '*.qml?raw' {
  const content: string
  export default content
}
