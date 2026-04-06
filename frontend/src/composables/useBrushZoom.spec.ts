import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { useBrushZoom } from './useBrushZoom'

function createMockChart(options?: { containPixelResult?: boolean }) {
  const containPixelResult = options?.containPixelResult ?? true

  return {
    $el: {
      clientHeight: 400,
      getBoundingClientRect: () => ({
        left: 100,
        top: 50,
        width: 800,
        height: 400,
        right: 900,
        bottom: 450,
      }),
    },
    containPixel: vi.fn(() => containPixelResult),
    convertFromPixel: vi.fn((_coordSys: string, point: [number, number]) => {
      // Simulate: pixel X maps linearly to timestamp
      // 0px -> 1700000000000ms, 800px -> 1700003600000ms (1 hour range)
      const msPerPx = 3600000 / 800
      return [1700000000000 + point[0] * msPerPx, 0]
    }),
    getModel: vi.fn(),
  }
}

// Helper to create a test component that uses the composable
function createTestComponent(mockChart: ReturnType<typeof createMockChart>) {
  return defineComponent({
    setup() {
      const chartRef = ref(mockChart) as ReturnType<typeof ref>
      const zoomCallback = vi.fn()
      const resetCallback = vi.fn()

      const { isDragging, brushRect, handleMouseDown, handleDblClick } = useBrushZoom(
        chartRef,
        zoomCallback,
        resetCallback,
      )

      return { isDragging, brushRect, handleMouseDown, handleDblClick, zoomCallback, resetCallback, chartRef }
    },
    template: '<div></div>',
  })
}

describe('useBrushZoom', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('handleMouseDown within grid area sets isDragging to true', () => {
    const mockChart = createMockChart({ containPixelResult: true })
    const wrapper = mount(createTestComponent(mockChart))
    const vm = wrapper.vm as unknown as ReturnType<typeof createTestComponent extends { setup(): infer R } ? () => R : never> & {
      isDragging: boolean
      handleMouseDown: (event: { zrX: number; zrY: number }) => void
    }

    vm.handleMouseDown({ zrX: 200, zrY: 150 })

    expect(vm.isDragging).toBe(true)
    expect(mockChart.containPixel).toHaveBeenCalledWith('grid', [200, 150])
  })

  it('handleMouseDown outside grid area does not start drag', () => {
    const mockChart = createMockChart({ containPixelResult: false })
    const wrapper = mount(createTestComponent(mockChart))
    const vm = wrapper.vm as unknown as {
      isDragging: boolean
      handleMouseDown: (event: { zrX: number; zrY: number }) => void
    }

    vm.handleMouseDown({ zrX: 10, zrY: 10 })

    expect(vm.isDragging).toBe(false)
  })

  it('window mousemove during drag updates brushRect correctly', () => {
    const mockChart = createMockChart({ containPixelResult: true })
    const wrapper = mount(createTestComponent(mockChart))
    const vm = wrapper.vm as unknown as {
      isDragging: boolean
      brushRect: { left: number; top: number; width: number; height: number }
      handleMouseDown: (event: { zrX: number; zrY: number }) => void
    }

    vm.handleMouseDown({ zrX: 200, zrY: 150 })

    // Get the mousemove handler that was registered
    const mousemoveCall = addEventListenerSpy.mock.calls.find((c) => c[0] === 'mousemove')
    expect(mousemoveCall).toBeDefined()

    const mousemoveHandler = mousemoveCall![1] as EventListener

    // Simulate mouse moving to the right (clientX = chart left + desired X)
    mousemoveHandler(new MouseEvent('mousemove', { clientX: 450 }))

    // currentX = 450 - 100 (chart left) = 350
    // left = min(200, 350) = 200, width = |350 - 200| = 150
    expect(vm.brushRect.left).toBe(200)
    expect(vm.brushRect.width).toBe(150)
  })

  it('handleMouseUp with valid drag calls callback with min/max ordered timestamps', () => {
    const mockChart = createMockChart({ containPixelResult: true })
    const wrapper = mount(createTestComponent(mockChart))
    const vm = wrapper.vm as unknown as {
      isDragging: boolean
      handleMouseDown: (event: { zrX: number; zrY: number }) => void
      zoomCallback: ReturnType<typeof vi.fn>
    }

    vm.handleMouseDown({ zrX: 200, zrY: 150 })

    const mouseupCall = addEventListenerSpy.mock.calls.find((c) => c[0] === 'mouseup')
    const mouseupHandler = mouseupCall![1] as EventListener

    // End at clientX 450 -> chart-relative X = 350
    mouseupHandler(new MouseEvent('mouseup', { clientX: 450 }))

    expect(vm.zoomCallback).toHaveBeenCalledTimes(1)
    const [startMs, endMs] = vm.zoomCallback.mock.calls[0]
    expect(startMs).toBeLessThan(endMs)
    expect(vm.isDragging).toBe(false)
  })

  it('handleMouseUp with less than 5px drag does not call callback', () => {
    const mockChart = createMockChart({ containPixelResult: true })
    const wrapper = mount(createTestComponent(mockChart))
    const vm = wrapper.vm as unknown as {
      handleMouseDown: (event: { zrX: number; zrY: number }) => void
      zoomCallback: ReturnType<typeof vi.fn>
    }

    vm.handleMouseDown({ zrX: 200, zrY: 150 })

    const mouseupCall = addEventListenerSpy.mock.calls.find((c) => c[0] === 'mouseup')
    const mouseupHandler = mouseupCall![1] as EventListener

    // End at clientX = 100 + 202 = 302 -> chart-relative X = 202, diff = 2px
    mouseupHandler(new MouseEvent('mouseup', { clientX: 302 }))

    expect(vm.zoomCallback).not.toHaveBeenCalled()
  })

  it('handleMouseUp with right-to-left drag still orders timestamps min/max', () => {
    const mockChart = createMockChart({ containPixelResult: true })
    const wrapper = mount(createTestComponent(mockChart))
    const vm = wrapper.vm as unknown as {
      handleMouseDown: (event: { zrX: number; zrY: number }) => void
      zoomCallback: ReturnType<typeof vi.fn>
    }

    // Start at X=400, end at X=200 (right-to-left)
    vm.handleMouseDown({ zrX: 400, zrY: 150 })

    const mouseupCall = addEventListenerSpy.mock.calls.find((c) => c[0] === 'mouseup')
    const mouseupHandler = mouseupCall![1] as EventListener

    // End at clientX = 100 + 200 = 300 -> chart-relative X = 200
    mouseupHandler(new MouseEvent('mouseup', { clientX: 300 }))

    expect(vm.zoomCallback).toHaveBeenCalledTimes(1)
    const [startMs, endMs] = vm.zoomCallback.mock.calls[0]
    expect(startMs).toBeLessThan(endMs)
  })

  it('handleDblClick calls reset callback', () => {
    const mockChart = createMockChart({ containPixelResult: true })
    const wrapper = mount(createTestComponent(mockChart))
    const vm = wrapper.vm as unknown as {
      handleDblClick: () => void
      resetCallback: ReturnType<typeof vi.fn>
    }

    vm.handleDblClick()

    expect(vm.resetCallback).toHaveBeenCalledTimes(1)
  })

  it('window listeners are removed after mouseup', () => {
    const mockChart = createMockChart({ containPixelResult: true })
    const wrapper = mount(createTestComponent(mockChart))
    const vm = wrapper.vm as unknown as {
      handleMouseDown: (event: { zrX: number; zrY: number }) => void
    }

    vm.handleMouseDown({ zrX: 200, zrY: 150 })

    const mouseupCall = addEventListenerSpy.mock.calls.find((c) => c[0] === 'mouseup')
    const mouseupHandler = mouseupCall![1] as EventListener

    mouseupHandler(new MouseEvent('mouseup', { clientX: 450 }))

    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
  })

  it('window listeners are removed on unmount', () => {
    const mockChart = createMockChart({ containPixelResult: true })
    const wrapper = mount(createTestComponent(mockChart))
    const vm = wrapper.vm as unknown as {
      handleMouseDown: (event: { zrX: number; zrY: number }) => void
    }

    // Start a drag but don't finish it
    vm.handleMouseDown({ zrX: 200, zrY: 150 })

    // Unmount the component
    wrapper.unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
  })
})
