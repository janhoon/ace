<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart as EChartsLineChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components'
import type { EChartsOption } from 'echarts'

// Register ECharts components
use([
  CanvasRenderer,
  EChartsLineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
])

export interface DataPoint {
  timestamp: number // Unix timestamp in seconds
  value: number
}

export interface ChartSeries {
  name: string
  data: DataPoint[]
}

const props = withDefaults(
  defineProps<{
    series: ChartSeries[]
    title?: string
    height?: string | number
  }>(),
  {
    title: '',
    height: '100%',
  }
)

const chartRef = ref<typeof VChart | null>(null)

// Format timestamp for display
function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

function formatFullDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

const chartOption = computed<EChartsOption>(() => {
  const seriesData = props.series.map((s) => ({
    name: s.name,
    type: 'line' as const,
    smooth: true,
    showSymbol: false,
    lineStyle: {
      width: 2,
    },
    data: s.data.map((d) => [d.timestamp * 1000, d.value]),
  }))

  return {
    backgroundColor: 'transparent',
    title: props.title
      ? {
          text: props.title,
          left: 'center',
          textStyle: {
            color: '#ccc',
            fontSize: 14,
          },
        }
      : undefined,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(50, 50, 50, 0.9)',
      borderColor: '#555',
      textStyle: {
        color: '#ccc',
      },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return ''
        const timestamp = params[0].data[0]
        const timeStr = formatFullDateTime(timestamp / 1000)
        let result = `<div style="font-weight: bold; margin-bottom: 4px;">${timeStr}</div>`
        for (const param of params) {
          const value = typeof param.data[1] === 'number'
            ? param.data[1].toFixed(4)
            : param.data[1]
          result += `<div style="display: flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 10px; height: 10px; background: ${param.color}; border-radius: 50%;"></span>
            <span>${param.seriesName}:</span>
            <span style="font-weight: bold;">${value}</span>
          </div>`
        }
        return result
      },
    },
    legend: {
      show: props.series.length > 1,
      bottom: 0,
      textStyle: {
        color: '#ccc',
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      top: props.title ? '15%' : '10%',
      bottom: props.series.length > 1 ? '15%' : '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      axisLine: {
        lineStyle: {
          color: '#555',
        },
      },
      axisLabel: {
        color: '#999',
        formatter: (value: number) => formatTime(value / 1000),
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: '#333',
          type: 'dashed',
        },
      },
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: {
          color: '#555',
        },
      },
      axisLabel: {
        color: '#999',
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: '#333',
          type: 'dashed',
        },
      },
    },
    series: seriesData,
  }
})

// Handle resize
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const container = chartRef.value?.$el?.parentElement
  if (container) {
    resizeObserver = new ResizeObserver(() => {
      chartRef.value?.resize()
    })
    resizeObserver.observe(container)
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<template>
  <div class="line-chart" :style="{ height: typeof height === 'number' ? `${height}px` : height }">
    <VChart
      ref="chartRef"
      :option="chartOption"
      :autoresize="true"
      class="chart"
    />
  </div>
</template>

<style scoped>
.line-chart {
  width: 100%;
  min-height: 200px;
}

.chart {
  width: 100%;
  height: 100%;
}
</style>
