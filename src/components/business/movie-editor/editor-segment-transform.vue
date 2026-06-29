<template>
  <div class="seg-transform-block">
    <div class="seg-transform-field">
      <label class="seg-transform-label">{{ $t("OpWeb.Editor.PosOffsetX", "位置 X") }}</label>
      <div class="seg-slider-row">
        <el-slider v-model="posX" :min="-5" :max="5" :step="0.05" size="small" />
        <el-input-number
          v-model="posX"
          :step="0.001"
          :precision="3"
          :controls="false"
          size="small"
          class="seg-input-num"
        />
      </div>
      <label class="seg-transform-label">{{ $t("OpWeb.Editor.PosOffsetY", "位置 Y") }}</label>
      <div class="seg-slider-row">
        <el-slider v-model="posY" :min="-5" :max="5" :step="0.05" size="small" />
        <el-input-number
          v-model="posY"
          :step="0.001"
          :precision="3"
          :controls="false"
          size="small"
          class="seg-input-num"
        />
      </div>
      <label class="seg-transform-label">{{ $t("OpWeb.Editor.PosOffsetZ", "位置 Z") }}</label>
      <div class="seg-slider-row">
        <el-slider v-model="posZ" :min="-5" :max="5" :step="0.05" size="small" />
        <el-input-number
          v-model="posZ"
          :step="0.001"
          :precision="3"
          :controls="false"
          size="small"
          class="seg-input-num"
        />
      </div>
    </div>

    <div class="seg-transform-field">
      <label class="seg-transform-label">{{ $t("OpWeb.Editor.ModelScale", "缩放") }}</label>
      <div class="seg-slider-row">
        <el-slider v-model="scaleVal" :min="0.1" :max="5" :step="0.05" size="small" />
        <el-input-number
          v-model="scaleVal"
          :min="0.1"
          :max="5"
          :step="0.05"
          :controls="false"
          size="small"
          class="seg-input-num"
        />
      </div>
    </div>

    <div class="seg-transform-field">
      <label class="seg-transform-label">{{ $t("OpWeb.Editor.RotX", "旋转 X") }}</label>
      <div class="seg-slider-row">
        <el-slider v-model="rotX" :min="-180" :max="180" :step="1" size="small" />
        <el-input-number
          v-model="rotX"
          :min="-180"
          :max="180"
          :step="0.001"
          :precision="3"
          :controls="false"
          size="small"
          class="seg-input-num"
        />
      </div>
      <label class="seg-transform-label">{{ $t("OpWeb.Editor.RotY", "旋转 Y") }}</label>
      <div class="seg-slider-row">
        <el-slider v-model="rotY" :min="-180" :max="180" :step="1" size="small" />
        <el-input-number
          v-model="rotY"
          :min="-180"
          :max="180"
          :step="0.001"
          :precision="3"
          :controls="false"
          size="small"
          class="seg-input-num"
        />
      </div>
      <label class="seg-transform-label">{{ $t("OpWeb.Editor.RotZ", "旋转 Z") }}</label>
      <div class="seg-slider-row">
        <el-slider v-model="rotZ" :min="-180" :max="180" :step="1" size="small" />
        <el-input-number
          v-model="rotZ"
          :min="-180"
          :max="180"
          :step="0.001"
          :precision="3"
          :controls="false"
          size="small"
          class="seg-input-num"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-segment-transform">
import { computed, watch } from "vue";

import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { useTranslate } from "@/hooks/useTranslate";

const props = defineProps<{
  seg: Record<string, any>;
  mode: "start" | "end";
}>();

const editor = useMovieEditorContext();
const $t = useTranslate();

const posKey = computed(() => (props.mode === "start" ? "startPos" : "endPos"));
const scaleKey = computed(() => (props.mode === "start" ? "startScale" : "endScale"));
const rotKey = computed(() => (props.mode === "start" ? "startRot" : "endRot"));

function readVec3(key: string): [number, number, number] {
  const src = props.seg[key];
  return [Number(src?.[0] ?? 0), Number(src?.[1] ?? 0), Number(src?.[2] ?? 0)];
}

function writeVec3(key: string, axis: 0 | 1 | 2, value: number) {
  const next = readVec3(key);
  next[axis] = value;
  props.seg[key] = next;
}

function makeAxisComputed(keyRef: typeof posKey, axis: 0 | 1 | 2, onChange: () => void) {
  return computed({
    get: () => readVec3(keyRef.value)[axis],
    set: (value: number) => {
      writeVec3(keyRef.value, axis, value);
      onChange();
    }
  });
}

const applyPosOrScale = () => {
  editor.liveSeg(props.seg, props.mode);
};

const applyRot = () => {
  editor.onRotChange(props.seg, props.mode);
};

const posX = makeAxisComputed(posKey, 0, applyPosOrScale);
const posY = makeAxisComputed(posKey, 1, applyPosOrScale);
const posZ = makeAxisComputed(posKey, 2, applyPosOrScale);
const rotX = makeAxisComputed(rotKey, 0, applyRot);
const rotY = makeAxisComputed(rotKey, 1, applyRot);
const rotZ = makeAxisComputed(rotKey, 2, applyRot);

const scaleVal = computed({
  get: () => Number(props.seg[scaleKey.value] ?? 1),
  set: (value: number) => {
    props.seg[scaleKey.value] = value;
    applyPosOrScale();
  }
});

watch(
  () => props.mode,
  mode => {
    editor.focusSegTransform(props.seg, mode);
  }
);
</script>
