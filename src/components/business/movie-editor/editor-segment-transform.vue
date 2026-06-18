<template>
  <div class="seg-transform-block">
    <div class="seg-transform-field">
      <label class="seg-transform-label">{{ $t("OpWeb.Editor.PosOffsetX", "位置 X") }}</label>
      <div class="seg-slider-row">
        <el-slider v-model="seg[posKey][0]" :min="-5" :max="5" :step="0.05" size="small" @input="onLive" />
        <el-input-number
          v-model="seg[posKey][0]"
          :step="0.05"
          :controls="false"
          size="small"
          class="seg-input-num"
          @input="onLive"
        />
      </div>
      <label class="seg-transform-label">{{ $t("OpWeb.Editor.PosOffsetY", "位置 Y") }}</label>
      <div class="seg-slider-row">
        <el-slider v-model="seg[posKey][1]" :min="-5" :max="5" :step="0.05" size="small" @input="onLive" />
        <el-input-number
          v-model="seg[posKey][1]"
          :step="0.05"
          :controls="false"
          size="small"
          class="seg-input-num"
          @input="onLive"
        />
      </div>
      <label class="seg-transform-label">{{ $t("OpWeb.Editor.PosOffsetZ", "位置 Z") }}</label>
      <div class="seg-slider-row">
        <el-slider v-model="seg[posKey][2]" :min="-5" :max="5" :step="0.05" size="small" @input="onLive" />
        <el-input-number
          v-model="seg[posKey][2]"
          :step="0.05"
          :controls="false"
          size="small"
          class="seg-input-num"
          @input="onLive"
        />
      </div>
    </div>

    <div class="seg-transform-field">
      <label class="seg-transform-label">{{ $t("OpWeb.Editor.ModelScale", "缩放") }}</label>
      <div class="seg-slider-row">
        <el-slider v-model="seg[scaleKey]" :min="0.1" :max="5" :step="0.05" size="small" @input="onLive" />
        <el-input-number
          v-model="seg[scaleKey]"
          :min="0.1"
          :max="5"
          :step="0.05"
          :controls="false"
          size="small"
          class="seg-input-num"
          @input="onLive"
        />
      </div>
    </div>

    <div class="seg-transform-field">
      <label class="seg-transform-label">{{ $t("OpWeb.Editor.RotX", "旋转 X") }}</label>
      <div class="seg-slider-row">
        <el-slider v-model="seg[rotKey][0]" :min="-180" :max="180" :step="1" size="small" @input="onRot" />
        <el-input-number
          v-model="seg[rotKey][0]"
          :min="-180"
          :max="180"
          :step="1"
          :controls="false"
          size="small"
          class="seg-input-num"
          @input="onRot"
        />
      </div>
      <label class="seg-transform-label">{{ $t("OpWeb.Editor.RotY", "旋转 Y") }}</label>
      <div class="seg-slider-row">
        <el-slider v-model="seg[rotKey][1]" :min="-180" :max="180" :step="1" size="small" @input="onRot" />
        <el-input-number
          v-model="seg[rotKey][1]"
          :min="-180"
          :max="180"
          :step="1"
          :controls="false"
          size="small"
          class="seg-input-num"
          @input="onRot"
        />
      </div>
      <label class="seg-transform-label">{{ $t("OpWeb.Editor.RotZ", "旋转 Z") }}</label>
      <div class="seg-slider-row">
        <el-slider v-model="seg[rotKey][2]" :min="-180" :max="180" :step="1" size="small" @input="onRot" />
        <el-input-number
          v-model="seg[rotKey][2]"
          :min="-180"
          :max="180"
          :step="1"
          :controls="false"
          size="small"
          class="seg-input-num"
          @input="onRot"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-segment-transform">
import { computed } from "vue";

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

const onLive = () => {
  editor.focusSegTransform(props.seg, props.mode);
  editor.liveSeg(props.seg, props.mode);
};

const onRot = () => {
  editor.focusSegTransform(props.seg, props.mode);
  editor.onRotChange(props.seg, props.mode);
};
</script>
