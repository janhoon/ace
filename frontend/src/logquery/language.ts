import type * as Monaco from 'monaco-editor'

export const LOGQL_LANGUAGE_ID = 'logql'
export const LOGSQL_LANGUAGE_ID = 'logsql'

const LOGQL_FUNCTIONS: Record<string, { signature: string; description: string }> = {
  rate: {
    signature: 'rate(log-range) vector',
    description: 'Calculates per-second rate from log lines over a range.',
  },
  count_over_time: {
    signature: 'count_over_time(log-range) vector',
    description: 'Counts log lines for each stream in the selected range.',
  },
  bytes_over_time: {
    signature: 'bytes_over_time(log-range) vector',
    description: 'Returns total bytes processed in the selected range.',
  },
  bytes_rate: {
    signature: 'bytes_rate(log-range) vector',
    description: 'Returns per-second byte rate in the selected range.',
  },
  sum: {
    signature: 'sum(vector) vector',
    description: 'Aggregates values by summing samples.',
  },
  avg: {
    signature: 'avg(vector) vector',
    description: 'Aggregates values by calculating the average.',
  },
  min: {
    signature: 'min(vector) vector',
    description: 'Aggregates values by selecting the minimum sample.',
  },
  max: {
    signature: 'max(vector) vector',
    description: 'Aggregates values by selecting the maximum sample.',
  },
}

const LOGQL_KEYWORDS = [
  'by',
  'without',
  'json',
  'logfmt',
  'regexp',
  'pattern',
  'line_format',
  'label_format',
  'unwrap',
]

const LOGQL_OPERATORS = ['|=', '!=', '|~', '!~', '|']

let logQLIndexedLabels: string[] = []

export function setLogQLIndexedLabels(labels: string[]) {
  logQLIndexedLabels = [...new Set(labels.map(label => label.trim()).filter(Boolean))]
}

const LOGSQL_KEYWORDS = [
  'select',
  'from',
  'where',
  'group',
  'by',
  'order',
  'limit',
  'offset',
  'having',
  'and',
  'or',
  'not',
  'in',
  'like',
  'between',
  'is',
  'null',
  'as',
  'asc',
  'desc',
]

const LOGSQL_FUNCTIONS: Record<string, { signature: string; description: string }> = {
  count: {
    signature: 'COUNT(*)',
    description: 'Returns the number of matching log rows.',
  },
  sum: {
    signature: 'SUM(field)',
    description: 'Returns the total of numeric field values.',
  },
  avg: {
    signature: 'AVG(field)',
    description: 'Returns the average value for a numeric field.',
  },
  min: {
    signature: 'MIN(field)',
    description: 'Returns the minimum value for a field.',
  },
  max: {
    signature: 'MAX(field)',
    description: 'Returns the maximum value for a field.',
  },
}

function createRange(model: Monaco.editor.ITextModel, position: Monaco.Position): Monaco.IRange {
  const word = model.getWordUntilPosition(position)
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  }
}

function registerLogQLLanguage(monaco: typeof Monaco) {
  monaco.languages.register({ id: LOGQL_LANGUAGE_ID })

  monaco.languages.setLanguageConfiguration(LOGQL_LANGUAGE_ID, {
    comments: {
      lineComment: '#',
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

  monaco.languages.setMonarchTokensProvider(LOGQL_LANGUAGE_ID, {
    keywords: LOGQL_KEYWORDS,
    functions: Object.keys(LOGQL_FUNCTIONS),
    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string_double'],
        [/'/, 'string', '@string_single'],
        [/\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],
        [/\d+[smhdwy]/, 'number.duration'],
        [/\|=|\|~|!=|!~|=~|[=><!]=?|[|+\-*/%^]/, 'operator'],
        [/[{}()[\]]/, '@brackets'],
        [/[a-zA-Z_][a-zA-Z0-9_]*(?=\s*(=|!=|=~|!~))/, 'label'],
        [/[a-zA-Z_][a-zA-Z0-9_]*/, {
          cases: {
            '@keywords': 'keyword',
            '@functions': 'function',
            '@default': 'identifier',
          },
        }],
      ],
      string_double: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
      string_single: [
        [/[^\\']+/, 'string'],
        [/\\./, 'string.escape'],
        [/'/, 'string', '@pop'],
      ],
    },
  })
}

function registerLogSQLLanguage(monaco: typeof Monaco) {
  const sqlKeywords = [...LOGSQL_KEYWORDS, ...LOGSQL_KEYWORDS.map(keyword => keyword.toUpperCase())]
  const sqlFunctions = [
    ...Object.keys(LOGSQL_FUNCTIONS),
    ...Object.keys(LOGSQL_FUNCTIONS).map(fn => fn.toUpperCase()),
  ]

  monaco.languages.register({ id: LOGSQL_LANGUAGE_ID })

  monaco.languages.setLanguageConfiguration(LOGSQL_LANGUAGE_ID, {
    comments: {
      lineComment: '--',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  })

  monaco.languages.setMonarchTokensProvider(LOGSQL_LANGUAGE_ID, {
    keywords: sqlKeywords,
    functions: sqlFunctions,
    tokenizer: {
      root: [
        [/--.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string_double'],
        [/'/, 'string', '@string_single'],
        [/\d+(\.\d+)?/, 'number'],
        [/[(),.*]/, 'operator'],
        [/[=><!]+/, 'operator'],
        [/[a-zA-Z_][a-zA-Z0-9_]*/, {
          cases: {
            '@keywords': 'keyword',
            '@functions': 'function',
            '@default': 'identifier',
          },
        }],
      ],
      string_double: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
      string_single: [
        [/[^\\']+/, 'string'],
        [/\\./, 'string.escape'],
        [/'/, 'string', '@pop'],
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment'],
      ],
    },
  })
}

function registerLogQLCompletionProvider(monaco: typeof Monaco) {
  monaco.languages.registerCompletionItemProvider(LOGQL_LANGUAGE_ID, {
    triggerCharacters: ['{', ',', '|', ' ', '('],
    provideCompletionItems(model, position) {
      const range = createRange(model, position)
      const textUntilPosition = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      })
      const lastOpenBrace = textUntilPosition.lastIndexOf('{')
      const lastCloseBrace = textUntilPosition.lastIndexOf('}')
      const insideSelector = lastOpenBrace > lastCloseBrace

      const functionSuggestions = Object.entries(LOGQL_FUNCTIONS).map(([name, info]) => ({
        label: name,
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: `${name}($0)`,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: info.signature,
        documentation: info.description,
        range,
      }))

      const keywordSuggestions = LOGQL_KEYWORDS.map(keyword => ({
        label: keyword,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: keyword,
        detail: 'Keyword',
        range,
      }))

      const labelSuggestions = logQLIndexedLabels.map(label => ({
        label,
        kind: monaco.languages.CompletionItemKind.Property,
        insertText: label,
        detail: 'Indexed label',
        sortText: insideSelector ? `0_${label}` : `3_${label}`,
        range,
      }))

      const operatorSuggestions = LOGQL_OPERATORS.map(operator => ({
        label: operator,
        kind: monaco.languages.CompletionItemKind.Operator,
        insertText: ` ${operator} `,
        detail: 'Filter operator',
        range,
      }))

      const snippetSuggestions: Monaco.languages.CompletionItem[] = [
        {
          label: 'stream selector',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `{\${1:label}="\${2:value}"}`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Selector snippet',
          range,
        },
      ]

      return {
        suggestions: [
          ...snippetSuggestions,
          ...labelSuggestions,
          ...functionSuggestions,
          ...keywordSuggestions,
          ...operatorSuggestions,
        ],
      }
    },
  })
}

function registerLogSQLCompletionProvider(monaco: typeof Monaco) {
  monaco.languages.registerCompletionItemProvider(LOGSQL_LANGUAGE_ID, {
    triggerCharacters: [' ', ',', '('],
    provideCompletionItems(model, position) {
      const range = createRange(model, position)

      const keywordSuggestions = LOGSQL_KEYWORDS.map(keyword => ({
        label: keyword.toUpperCase(),
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: keyword.toUpperCase(),
        detail: 'Keyword',
        range,
      }))

      const functionSuggestions = Object.entries(LOGSQL_FUNCTIONS).map(([name, info]) => ({
        label: name.toUpperCase(),
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: `${name.toUpperCase()}($0)`,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: info.signature,
        documentation: info.description,
        range,
      }))

      return {
        suggestions: [...keywordSuggestions, ...functionSuggestions],
      }
    },
  })
}

function registerLogQLHoverProvider(monaco: typeof Monaco) {
  const keywordDescriptions: Record<string, string> = {
    json: 'Parses JSON payload fields for later filtering and formatting.',
    logfmt: 'Parses logfmt-formatted key/value fields.',
    regexp: 'Extracts values from logs using a regular expression.',
    pattern: 'Extracts values from logs using pattern syntax.',
    unwrap: 'Converts an extracted label or field into a numeric sample.',
    line_format: 'Formats the output log line with a template.',
    label_format: 'Creates or rewrites labels with a template.',
    by: 'Keeps listed labels in aggregation output.',
    without: 'Drops listed labels in aggregation output.',
  }

  monaco.languages.registerHoverProvider(LOGQL_LANGUAGE_ID, {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position)
      if (!word) return null

      const text = word.word.toLowerCase()
      const functionInfo = LOGQL_FUNCTIONS[text]
      if (functionInfo) {
        return {
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          },
          contents: [
            { value: `**${text}**` },
            { value: `\`\`\`\n${functionInfo.signature}\n\`\`\`` },
            { value: functionInfo.description },
          ],
        }
      }

      const keywordDescription = keywordDescriptions[text]
      if (!keywordDescription) {
        return null
      }

      return {
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        },
        contents: [
          { value: `**${text}** (keyword)` },
          { value: keywordDescription },
        ],
      }
    },
  })
}

export function registerLogQueryLanguages(monaco: typeof Monaco) {
  registerLogQLLanguage(monaco)
  registerLogSQLLanguage(monaco)
  registerLogQLCompletionProvider(monaco)
  registerLogSQLCompletionProvider(monaco)
  registerLogQLHoverProvider(monaco)
}
