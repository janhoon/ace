import { Grid3x3 } from 'lucide-vue-next'
import type { RawQueryResult } from '../../types/panel'
import { registerPanel } from '../../utils/panelRegistry'

// Register Heatmap
registerPanel({
  type: 'heatmap',
  component: () => import('./HeatmapPanel.vue'),
  dataAdapter: (raw: RawQueryResult) => {
    // Transform time-series data into heatmap format
    // Each series becomes a row (y-axis), each data point is a column (x-axis)
    const data: Array<{ x: number | string; y: number | string; value: number }> = []
    const yLabels: string[] = []

    for (const series of raw.series) {
      yLabels.push(series.name)
      const yIndex = yLabels.length - 1
      for (
        let xIndex = 0;
        xIndex < (series.data as Array<{ timestamp: number; value: number }>).length;
        xIndex++
      ) {
        const point = (series.data as Array<{ timestamp: number; value: number }>)[xIndex]
        data.push({ x: point.timestamp, y: yIndex, value: point.value })
      }
    }

    return { data, yLabels }
  },
  defaultQuery: {},
  category: 'charts',
  label: 'Heatmap',
  icon: Grid3x3,
})
