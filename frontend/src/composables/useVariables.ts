import { computed, ref } from 'vue'
import { listVariables, type Variable } from '../api/variables'

export interface DashboardVariable extends Variable {
  /** Runtime state: available option values (not persisted) */
  options: string[]
  /** Runtime state: currently selected value(s) (not persisted) */
  current: string | string[]
}

export function useVariables(dashboardId: () => string | undefined) {
  const variables = ref<DashboardVariable[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchVariables() {
    const id = dashboardId()
    if (!id) return
    loading.value = true
    error.value = null
    try {
      const data = await listVariables(id)
      variables.value = data.map((v) => ({
        ...v,
        options: [],
        current: v.multi ? [] : '',
      }))
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load variables'
    } finally {
      loading.value = false
    }
  }

  function setVariableValue(name: string, value: string | string[]) {
    const v = variables.value.find((v) => v.name === name)
    if (v) v.current = value
  }

  /**
   * Interpolate variables into a PromQL query string.
   * Replaces $var and ${var} patterns with current values.
   * For multi-value variables, joins with |.
   */
  function interpolate(query: string): string {
    if (!query) return query
    let result = query
    for (const v of variables.value) {
      const value = Array.isArray(v.current) ? v.current.join('|') : (v.current ?? '')
      // Replace ${var} and $var patterns
      result = result.replace(new RegExp(`\\$\\{${v.name}\\}`, 'g'), value)
      result = result.replace(new RegExp(`\\$${v.name}(?![\\w])`, 'g'), value)
    }
    return result
  }

  /**
   * Check for circular dependencies in variable queries.
   * Returns array of cycle descriptions, empty if no cycles.
   */
  function detectCycles(): string[] {
    const cycles: string[] = []
    const varNames = new Set(variables.value.map((v) => v.name))

    // Build adjacency: variable A depends on B if A's query contains $B or ${B}
    const deps = new Map<string, string[]>()
    for (const v of variables.value) {
      const varDeps: string[] = []
      if (v.query) {
        for (const name of varNames) {
          if (
            v.name !== name &&
            (v.query.includes(`$${name}`) || v.query.includes(`\${${name}}`))
          ) {
            varDeps.push(name)
          }
        }
      }
      deps.set(v.name, varDeps)
    }

    // Topological sort with cycle detection (Kahn's algorithm)
    const inDegree = new Map<string, number>()
    for (const name of varNames) inDegree.set(name, 0)
    for (const [, d] of deps) {
      for (const dep of d) {
        inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1)
      }
    }

    const queue = Array.from(varNames).filter((n) => inDegree.get(n) === 0)
    const sorted: string[] = []
    while (queue.length > 0) {
      const node = queue.shift()!
      sorted.push(node)
      for (const dep of deps.get(node) ?? []) {
        const newDegree = (inDegree.get(dep) ?? 1) - 1
        inDegree.set(dep, newDegree)
        if (newDegree === 0) queue.push(dep)
      }
    }

    if (sorted.length !== varNames.size) {
      const unsorted = Array.from(varNames).filter((n) => !sorted.includes(n))
      cycles.push(`Circular dependency detected among variables: ${unsorted.join(', ')}`)
    }

    return cycles
  }

  const hasVariables = computed(() => variables.value.length > 0)

  return {
    variables,
    loading,
    error,
    hasVariables,
    fetchVariables,
    setVariableValue,
    interpolate,
    detectCycles,
  }
}
