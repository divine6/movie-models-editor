<template>
  <div class="camera-panel">
    <div class="camera-panel-header">
      <span class="title">相机设置</span>
    </div>

    <el-form label-position="top" size="small">
      <el-form-item label="相机位置 X">
        <el-input-number v-model="cameraForm.positionX" :min="-50" :max="50" :step="0.5" controls-position="right" />
      </el-form-item>

      <el-form-item label="相机位置 Y">
        <el-input-number v-model="cameraForm.positionY" :min="-50" :max="50" :step="0.5" controls-position="right" />
      </el-form-item>

      <el-form-item label="相机位置 Z">
        <el-input-number v-model="cameraForm.positionZ" :min="-50" :max="50" :step="0.5" controls-position="right" />
      </el-form-item>

      <el-form-item label="目标点 X">
        <el-input-number v-model="cameraForm.targetX" :min="-50" :max="50" :step="0.5" controls-position="right" />
      </el-form-item>

      <el-form-item label="目标点 Y">
        <el-input-number v-model="cameraForm.targetY" :min="-50" :max="50" :step="0.5" controls-position="right" />
      </el-form-item>

      <el-form-item label="目标点 Z">
        <el-input-number v-model="cameraForm.targetZ" :min="-50" :max="50" :step="0.5" controls-position="right" />
      </el-form-item>

      <el-form-item label="视野 (FOV)">
        <el-slider v-model="cameraForm.fov" :min="20" :max="120" :step="1" show-input />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="handleCaptureCamera">
          <el-icon><Camera /></el-icon>
          捕获当前视角
        </el-button>
      </el-form-item>

      <el-form-item>
        <el-button @click="handlePreviewShot">
          <el-icon><View /></el-icon>
          预览此镜头
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts" name="CameraPanel">
import { Camera, View } from "@element-plus/icons-vue";
import { reactive, watch } from "vue";

import type { CameraConfig } from "@/interface/project";
import { DEFAULT_CAMERA } from "@/utils/three/constants";

// Props
const props = defineProps<{
  cameraConfig?: CameraConfig;
}>();

// Emits
const emit = defineEmits<{
  (e: "update", config: CameraConfig): void;
  (e: "capture"): void;
  (e: "preview", config: CameraConfig): void;
}>();

// State
const cameraForm = reactive({
  positionX: DEFAULT_CAMERA.position[0],
  positionY: DEFAULT_CAMERA.position[1],
  positionZ: DEFAULT_CAMERA.position[2],
  targetX: DEFAULT_CAMERA.target[0],
  targetY: DEFAULT_CAMERA.target[1],
  targetZ: DEFAULT_CAMERA.target[2],
  fov: DEFAULT_CAMERA.fov
});

// Methods
const getCameraConfig = (): CameraConfig => ({
  position: [cameraForm.positionX, cameraForm.positionY, cameraForm.positionZ],
  target: [cameraForm.targetX, cameraForm.targetY, cameraForm.targetZ],
  fov: cameraForm.fov
});

const handleCaptureCamera = () => {
  emit("capture");
};

const handlePreviewShot = () => {
  emit("preview", getCameraConfig());
};

const handleUpdateCamera = () => {
  emit("update", getCameraConfig());
};

// Watch
watch(
  () => props.cameraConfig,
  newConfig => {
    if (newConfig) {
      cameraForm.positionX = newConfig.position[0];
      cameraForm.positionY = newConfig.position[1];
      cameraForm.positionZ = newConfig.position[2];
      cameraForm.targetX = newConfig.target[0];
      cameraForm.targetY = newConfig.target[1];
      cameraForm.targetZ = newConfig.target[2];
      cameraForm.fov = newConfig.fov;
    }
  },
  { immediate: true, deep: true }
);

// Watch form changes
watch(
  [
    () => cameraForm.positionX,
    () => cameraForm.positionY,
    () => cameraForm.positionZ,
    () => cameraForm.targetX,
    () => cameraForm.targetY,
    () => cameraForm.targetZ,
    () => cameraForm.fov
  ],
  () => {
    handleUpdateCamera();
  }
);
</script>

<style lang="scss" scoped>
.camera-panel {
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: var(--corner-radius-8);
}

.camera-panel-header {
  margin-bottom: 16px;

  .title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color-1);
  }
}

:deep(.el-input-number) {
  width: 100%;
}

:deep(.el-slider) {
  .el-slider__runway {
    margin-right: 60px;
  }
}
</style>
