<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'
import { useAiSidebar } from '../composables/useAiSidebar'

const { isOpen, open } = useAiSidebar()
</script>

<template>
  <button
    v-if="!isOpen"
    data-testid="ai-fab"
    class="fixed z-40 flex items-center justify-center cursor-pointer border-none transition-transform duration-150 hover:scale-105"
    :style="{
      bottom: '20px',
      right: '20px',
      width: '44px',
      height: '44px',
      borderRadius: '12px',
      backgroundColor: 'var(--color-primary)',
      color: '#0B0D0F',
      boxShadow: '0 4px 20px rgba(201, 150, 15, 0.3)',
    }"
    title="AI Copilot"
    @click="open()"
  >
    <Sparkles :size="18" />
  </button>
</template>
