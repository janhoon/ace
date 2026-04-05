<script setup lang="ts">
import { Keyboard, LogOut } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useClickOutside } from '../composables/useClickOutside'
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { user, logout } = useAuth()
const { showHelp } = useKeyboardShortcuts()

const menuRef = computed(() => props.isOpen ? menuElement.value : null)
const menuElement = ref<HTMLDivElement | null>(null)

useClickOutside(menuRef, () => emit('close'))

function handleLogout() {
  logout()
  emit('close')
}

function handleShowShortcuts() {
  showHelp.value = true
  emit('close')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    ref="menuElement"
    data-testid="user-menu"
    class="fixed z-[60] overflow-hidden animate-fade-in"
    :style="{
      left: '8px',
      bottom: '52px',
      width: '240px',
      backgroundColor: 'var(--color-surface-bright)',
      borderRadius: '8px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      border: '1px solid var(--color-stroke-subtle)',
    }"
    @keydown="handleKeydown"
  >
    <!-- User info header -->
    <div
      class="px-4 py-3"
      :style="{ borderBottom: '1px solid var(--color-stroke-subtle)' }"
    >
      <div
        class="text-sm font-medium"
        :style="{ color: 'var(--color-on-surface)' }"
      >{{ user?.name || user?.email }}</div>
      <div
        v-if="user?.name"
        class="text-xs mt-0.5"
        :style="{ color: 'var(--color-outline)', fontFamily: 'var(--font-mono)' }"
      >{{ user.email }}</div>
    </div>

    <!-- Actions -->
    <div class="py-1">
      <button
        data-testid="user-menu-shortcuts"
        class="flex w-full items-center gap-2 px-4 py-2 text-sm cursor-pointer border-none bg-transparent"
        :style="{ color: 'var(--color-on-surface-variant)' }"
        @click="handleShowShortcuts"
      >
        <Keyboard :size="14" />
        <span>Keyboard shortcuts</span>
      </button>
      <button
        data-testid="user-menu-logout"
        class="flex w-full items-center gap-2 px-4 py-2 text-sm cursor-pointer border-none bg-transparent"
        :style="{ color: 'var(--color-error)' }"
        @click="handleLogout"
      >
        <LogOut :size="14" />
        <span>Log out</span>
      </button>
    </div>
  </div>
</template>
