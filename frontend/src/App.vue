<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import CookieConsentBanner from './components/CookieConsentBanner.vue'
import Sidebar from './components/Sidebar.vue'
import { useAuth } from './composables/useAuth'
import { useOrgBranding } from './composables/useOrgBranding'

const route = useRoute()
const { isAuthenticated } = useAuth()
useOrgBranding()

const sidebarRef = ref<InstanceType<typeof Sidebar> | null>(null)

const showSidebar = computed(() => {
  return isAuthenticated.value && route.meta.appLayout === 'app'
})

const mainMargin = computed(() => {
  if (!showSidebar.value) return {}
  const width = sidebarRef.value?.isPinned ? 220 : 48
  return { marginLeft: width + 'px' }
})
</script>

<template>
  <div class="relative flex min-h-screen w-full" :class="{ 'block': !showSidebar }">
    <Sidebar v-if="showSidebar" ref="sidebarRef" />
    <main
      class="min-h-screen flex-1 bg-surface-base transition-[margin-left] duration-200"
      :style="mainMargin"
    >
      <RouterView />
    </main>
    <CookieConsentBanner />
  </div>
</template>
