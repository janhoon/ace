<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import CookieConsentBanner from './components/CookieConsentBanner.vue'
import Sidebar from './components/Sidebar.vue'
import { useAuth } from './composables/useAuth'
import { useOrgBranding } from './composables/useOrgBranding'

const route = useRoute()
const { isAuthenticated } = useAuth()
useOrgBranding()

const showSidebar = computed(() => {
  return isAuthenticated.value && route.meta.appLayout === 'app'
})
</script>

<template>
  <div class="relative flex min-h-screen w-full" :class="{ 'block': !showSidebar }">
    <Sidebar v-if="showSidebar" />
    <main
      class="min-h-screen flex-1 bg-surface-base"
      :style="showSidebar ? { marginLeft: '48px' } : {}"
    >
      <RouterView />
    </main>
    <CookieConsentBanner />
  </div>
</template>
