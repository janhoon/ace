<script setup lang="ts">
import { ref, computed } from 'vue'
import Sidebar from './components/Sidebar.vue'

const sidebarRef = ref<InstanceType<typeof Sidebar> | null>(null)

const sidebarWidth = computed(() => {
  return sidebarRef.value?.isExpanded ? '200px' : '56px'
})
</script>

<template>
  <div class="app-layout">
    <Sidebar ref="sidebarRef" />
    <main class="main-content" :style="{ marginLeft: sidebarWidth }">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  width: 100%;
}

.main-content {
  flex: 1;
  margin-left: 200px;
  min-height: 100vh;
  background: var(--bg-primary);
  transition: margin-left 0.2s ease;
}
</style>
