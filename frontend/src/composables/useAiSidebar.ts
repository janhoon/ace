import { ref } from 'vue'

const OPEN_KEY = 'ace-ai-sidebar-open'

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === 'true'
  } catch {
    return false
  }
}

const isOpen = ref(readOpen())
const highlightedPanelId = ref<string | null>(null)

/** Pre-loaded context when opening sidebar from an inline insight */
const pendingContext = ref<{ message: string; panelTitle?: string } | null>(null)

function open(context?: { message: string; panelTitle?: string }) {
  if (context) {
    pendingContext.value = context
  }
  isOpen.value = true
  localStorage.setItem(OPEN_KEY, 'true')
}

function close() {
  isOpen.value = false
  highlightedPanelId.value = null
  localStorage.setItem(OPEN_KEY, 'false')
}

function toggle() {
  if (isOpen.value) {
    close()
  } else {
    open()
  }
}

function highlightPanel(panelId: string | null) {
  highlightedPanelId.value = panelId
}

function consumePendingContext() {
  const ctx = pendingContext.value
  pendingContext.value = null
  return ctx
}

export function useAiSidebar() {
  return {
    isOpen,
    highlightedPanelId,
    pendingContext,
    open,
    close,
    toggle,
    highlightPanel,
    consumePendingContext,
  }
}
