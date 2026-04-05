import { type Ref, nextTick, onUnmounted, watch } from 'vue'

export function useClickOutside(
  elementRef: Ref<HTMLElement | null>,
  callback: () => void,
) {
  function handler(event: PointerEvent) {
    if (elementRef.value && !elementRef.value.contains(event.target as Node)) {
      callback()
    }
  }

  let listening = false

  watch(elementRef, (el) => {
    if (el && !listening) {
      nextTick(() => {
        document.addEventListener('pointerdown', handler)
        listening = true
      })
    } else if (!el && listening) {
      document.removeEventListener('pointerdown', handler)
      listening = false
    }
  }, { immediate: true })

  onUnmounted(() => {
    if (listening) {
      document.removeEventListener('pointerdown', handler)
      listening = false
    }
  })
}
