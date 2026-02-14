import { onMounted, onUnmounted, ref } from 'vue'
import { isFeatureFlagEnabled, onFeatureFlagsChanged } from '../analytics'

export function useFeatureFlag(flagKey: string) {
  const enabled = ref(false)
  let unsubscribe: (() => void) | null = null

  onMounted(() => {
    enabled.value = isFeatureFlagEnabled(flagKey)
    unsubscribe = onFeatureFlagsChanged(() => {
      enabled.value = isFeatureFlagEnabled(flagKey)
    })
  })

  onUnmounted(() => {
    unsubscribe?.()
    unsubscribe = null
  })

  return {
    enabled,
  }
}
