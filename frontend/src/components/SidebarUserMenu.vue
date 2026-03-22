<script setup lang="ts">
import { Check, Keyboard, LogOut } from 'lucide-vue-next'
import { onMounted, onUnmounted } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useOrganization } from '../composables/useOrganization'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { user, logout } = useAuth()
const { organizations, currentOrg, selectOrganization } = useOrganization()

function handleSelectOrg(orgId: string) {
  selectOrganization(orgId)
  emit('close')
}

function handleLogout() {
  logout()
  emit('close')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div
    v-if="isOpen"
    data-testid="user-menu"
    class="fixed z-[60] overflow-hidden animate-fade-in"
    :style="{
      left: '8px',
      bottom: '52px',
      width: '240px',
      backgroundColor: 'var(--color-surface-bright)',
      borderRadius: '8px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      border: '1px solid var(--color-outline-variant)',
    }"
  >
    <!-- User info header -->
    <div
      class="px-4 py-3"
      :style="{ borderBottom: '1px solid var(--color-outline-variant)' }"
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

    <!-- Org switcher -->
    <div
      class="py-1"
      :style="{ borderBottom: '1px solid var(--color-outline-variant)' }"
    >
      <div
        class="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide"
        :style="{ color: 'var(--color-outline)', fontSize: '10px' }"
      >Organizations</div>
      <button
        v-for="org in organizations"
        :key="org.id"
        :data-testid="`user-menu-org-${org.id}`"
        class="flex w-full items-center gap-2 px-4 py-2 text-sm cursor-pointer border-none bg-transparent transition-colors"
        :style="{
          color: currentOrg?.id === org.id ? 'var(--color-primary)' : 'var(--color-on-surface)',
        }"
        @click="handleSelectOrg(org.id)"
      >
        <span class="flex-1 truncate text-left">{{ org.name }}</span>
        <Check v-if="currentOrg?.id === org.id" :size="14" />
      </button>
    </div>

    <!-- Actions -->
    <div class="py-1">
      <button
        data-testid="user-menu-shortcuts"
        class="flex w-full items-center gap-2 px-4 py-2 text-sm cursor-pointer border-none bg-transparent"
        :style="{ color: 'var(--color-on-surface-variant)' }"
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
