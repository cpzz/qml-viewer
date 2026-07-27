import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'

export function registerQMLLanguage() {
  // Register QML language
  monaco.languages.register({ id: 'qml' })

  // Define QML syntax highlighting
  monaco.languages.setMonarchTokensProvider('qml', {
    keywords: [
      'import', 'as', 'property', 'alias', 'signal', 'method', 'function',
      'readonly', 'default', 'required', 'component', 'pragma',
    ],
    typeKeywords: [
      'int', 'real', 'string', 'bool', 'var', 'color', 'date', 'time',
      'datetime', 'url', 'vector2d', 'vector3d', 'vector4d', 'quaternion',
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

        // Keywords
        [/[a-z_][\w]*/, {
          cases: {
            '@keywords': 'keyword',
            '@typeKeywords': 'type',
            '@builtins': 'type.builtin',
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

        // Properties (id: xxx)
        [/id\s*:/, 'keyword.id'],
        [/[\w]+\s*:/, 'property'],
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
}
