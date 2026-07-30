import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import { registerQMLCompletionProvider } from './qmlCompletion'
import { registerQMLSemanticTokensProvider } from './qmlSemantic'

let registered = false

const darkRules: monaco.editor.ITokenThemeRule[] = [
  { token: 'type', foreground: '4EC9B0', fontStyle: 'bold' },
  { token: 'type.builtin', foreground: '4EC9B0', fontStyle: 'bold' },
  { token: 'keyword', foreground: 'C586C0' },
  { token: 'keyword.id', foreground: 'C586C0' },
  { token: 'property', foreground: '9CDCFE' },
  { token: 'signal', foreground: 'DCDCAA' },
  { token: 'handler', foreground: 'D7BA7D' },
  { token: 'method', foreground: 'DCDCAA' },
  { token: 'variable', foreground: '4FC1FF' },
  { token: 'parameter', foreground: '4FC1FF' },
  { token: 'enumMember', foreground: 'B8D7A3' },
  { token: 'string', foreground: 'CE9178' },
  { token: 'number', foreground: 'B5CEA8' },
  { token: 'constant.boolean', foreground: '569CD6', fontStyle: 'bold' },
  { token: 'comment', foreground: '8B949E', fontStyle: 'italic' },
]

const lightRules: monaco.editor.ITokenThemeRule[] = [
  { token: 'type', foreground: '267F99', fontStyle: 'bold' },
  { token: 'type.builtin', foreground: '267F99', fontStyle: 'bold' },
  { token: 'keyword', foreground: 'AF00DB' },
  { token: 'keyword.id', foreground: 'AF00DB' },
  { token: 'property', foreground: '001080' },
  { token: 'signal', foreground: '795E26' },
  { token: 'handler', foreground: 'B05A00' },
  { token: 'method', foreground: '795E26' },
  { token: 'variable', foreground: '0070C1' },
  { token: 'parameter', foreground: '0070C1' },
  { token: 'enumMember', foreground: '397300' },
  { token: 'string', foreground: 'A31515' },
  { token: 'number', foreground: '098658' },
  { token: 'constant.boolean', foreground: '0000FF', fontStyle: 'bold' },
  { token: 'comment', foreground: '6A737D', fontStyle: 'italic' },
]

function defineQMLThemes() {
  monaco.editor.defineTheme('qml-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: darkRules,
    colors: {},
  })
  monaco.editor.defineTheme('qml-light', {
    base: 'vs',
    inherit: true,
    rules: lightRules,
    colors: {},
  })
}

export function registerQMLLanguage() {
  if (registered) return
  registered = true
  // Register QML language
  monaco.languages.register({ id: 'qml' })
  defineQMLThemes()

  // Define QML syntax highlighting
  monaco.languages.setMonarchTokensProvider('qml', {
    keywords: [
      'import', 'as', 'property', 'alias', 'signal', 'method', 'function',
      'readonly', 'default', 'required', 'component', 'pragma',
      'enum',
      // JS control flow
      'if', 'else', 'for', 'while', 'do', 'break', 'continue', 'return',
      'switch', 'case', 'let', 'const',
      'new', 'typeof', 'instanceof', 'void', 'throw', 'try', 'catch', 'finally',
    ],
    typeKeywords: [
      'int', 'real', 'double', 'string', 'bool', 'var', 'color', 'date', 'time',
      'datetime', 'url', 'list', 'vector2d', 'vector3d', 'vector4d', 'quaternion',
      'matrix4x4', 'font', 'size', 'point', 'rect',
    ],
    builtins: [
      'Item', 'Rectangle', 'Text', 'Image', 'MouseArea', 'Column', 'Row',
      'Grid', 'Flow', 'Repeater', 'ListView', 'GridView', 'PathView',
      'Flickable', 'ScrollView', 'TextInput', 'TextEdit', 'Timer',
      'Connections', 'Component', 'QtObject', 'Qt', 'State', 'PropertyAnimation',
      'NumberAnimation', 'ColorAnimation', 'SequentialAnimation', 'ParallelAnimation',
      'Transition', 'Behavior', 'PropertyChanges', 'AnchorChanges',
      'Window', 'ApplicationWindow', 'Dialog', 'Popup',
    ],
    literals: ['true', 'false', 'null', 'undefined'],
    operators: [
      '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
      '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
      '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
      '%=', '<<=', '>>=', '>>>=',
    ],
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    tokenizer: {
      root: [
        // Comments
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],

        // Strings
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],

        // Numbers
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/\d+/, 'number'],

        // Properties and signal handlers
        [/id(?=\s*:)/, 'keyword.id'],
        [/on[A-Z][\w]*(?=\s*:)/, 'handler'],
        [/[A-Za-z_]\w*(?=\s*:)/, 'property'],

        // Keywords
        [/[a-z_][\w]*/, {
          cases: {
            '@keywords': 'keyword',
            '@typeKeywords': 'type',
            '@builtins': 'type.builtin',
            '@literals': 'constant.boolean',
            '@default': 'identifier',
          },
        }],

        // Identifiers starting with uppercase (QML types)
        [/[A-Z][\w]*/, 'type'],

        // Operators
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default': '',
          },
        }],

        // Delimiters
        [/[{}()\[\]]/, '@brackets'],
        [/[;,]/, 'delimiter'],

      ],

      comment: [
        [/[^\/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment'],
      ],

      string: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, 'string', '@pop'],
      ],
    },
  })

  // Define language configuration
  monaco.languages.setLanguageConfiguration('qml', {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  })

  registerQMLCompletionProvider()
  registerQMLSemanticTokensProvider()
}
