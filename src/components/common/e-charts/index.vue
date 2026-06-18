<template>
  <div id="echarts" ref="chartRef" :style="echartsStyle" />
</template>

<script setup lang="ts" name="ECharts">
import { useDebounceFn } from "@vueuse/core";
import { ECElementEvent, EChartsType } from "echarts/core";
import { storeToRefs } from "pinia";
import { computed, markRaw, nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { useGlobalStore } from "@/stores/modules/global";

import echarts, { ECOption } from "./config";

interface Props {
  option: ECOption;
  renderer?: "canvas" | "svg";
  resize?: boolean;
  theme?: Object | string;
  width?: number | string;
  height?: number | string;
  onClick?: (event: ECElementEvent) => any;
  notMerge?: boolean; // 是否不合并配置，默认 false（增量更新）
}

const props = withDefaults(defineProps<Props>(), {
  renderer: "canvas",
  resize: true
});

const echartsStyle = computed(() => {
  return props.width || props.height
    ? { height: props.height + "px", width: props.width + "px" }
    : { height: "100%", width: "100%" };
});

const chartRef = ref<HTMLDivElement | HTMLCanvasElement>();
const chartInstance = ref<EChartsType>();

const draw = () => {
  if (chartInstance.value) {
    chartInstance.value.setOption(props.option, { notMerge: props.notMerge ?? false });
  }
};

watch(props, () => {
  draw();
});

const handleClick = (event: ECElementEvent) => props.onClick && props.onClick(event);

const init = () => {
  if (!chartRef.value) return;
  chartInstance.value = echarts.getInstanceByDom(chartRef.value);

  if (!chartInstance.value) {
    chartInstance.value = markRaw(
      echarts.init(chartRef.value, props.theme, {
        renderer: props.renderer
      })
    );
    chartInstance.value.on("click", handleClick);
    draw();
  }
};

const resize = () => {
  if (chartInstance.value && props.resize) {
    chartInstance.value.resize({ animation: { duration: 300 } });
  }
};

const debouncedResize = useDebounceFn(resize, 300, { maxWait: 800 });

const globalStore = useGlobalStore();
const { maximize, isCollapse, tabs, footer } = storeToRefs(globalStore);

watch(
  () => [maximize, isCollapse, tabs, footer],
  () => {
    debouncedResize();
  },
  { deep: true }
);

onMounted(() => {
  nextTick(() => init());
  window.addEventListener("resize", debouncedResize);
});

onActivated(() => {
  if (chartInstance.value) {
    chartInstance.value.resize();
  }
});

onBeforeUnmount(() => {
  chartInstance.value?.dispose();
  window.removeEventListener("resize", debouncedResize);
});

// 增量更新系列数据
const updateSeriesData = (seriesIndex: number, data: any[]) => {
  if (chartInstance.value) {
    chartInstance.value.setOption({
      series: [
        {
          seriesIndex,
          data
        }
      ]
    });
  }
};

// 批量更新多个系列数据
const updateMultipleSeriesData = (updates: { seriesIndex: number; data: any[] }[]) => {
  if (chartInstance.value) {
    chartInstance.value.setOption({
      series: updates.map(update => ({
        seriesIndex: update.seriesIndex,
        data: update.data
      }))
    });
  }
};

defineExpose({
  getInstance: () => chartInstance.value,
  resize,
  draw,
  updateSeriesData,
  updateMultipleSeriesData
});
</script>
