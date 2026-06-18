<template>
  <div class="model-panel">
    <div class="model-panel-header">
      <span class="title">模型列表</span>
      <el-dropdown trigger="click" @command="handleAddModel">
        <el-button type="primary" size="small">
          <el-icon><Plus /></el-icon>
          添加模型
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="cube">立方体</el-dropdown-item>
            <el-dropdown-item command="sphere">球体</el-dropdown-item>
            <el-dropdown-item command="cylinder">圆柱</el-dropdown-item>
            <el-dropdown-item command="torus">圆环</el-dropdown-item>
            <el-dropdown-item command="cone">圆锥</el-dropdown-item>
            <el-dropdown-item command="dodecahedron">多面体</el-dropdown-item>
            <el-dropdown-item divided command="custom">
              <el-upload :show-file-list="false" accept=".glb,.gltf" :before-upload="handleUploadGLB">
                <span>导入 GLB/GLTF</span>
              </el-upload>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <div class="model-list">
      <div v-if="models.length === 0" class="empty-tip">暂无模型</div>
      <div
        v-for="model in models"
        :key="model.id"
        class="model-card"
        :class="{ selected: selectedModelId === model.id }"
        @click="handleSelectModel(model)"
      >
        <div class="model-icon" :style="{ backgroundColor: model.color }">
          <span v-if="model.type === 'custom'">GLB</span>
          <span v-else>{{ getModelTypeName(model.type) }}</span>
        </div>
        <div class="model-info">
          <span class="model-name">{{ model.name }}</span>
          <span class="model-type">{{ model.type === "custom" ? "自定义" : "Primitive" }}</span>
        </div>
        <el-button type="danger" size="small" text @click.stop="handleDeleteModel(model)">
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 模型配置抽屉 -->
    <el-drawer v-model="drawerVisible" title="模型配置" direction="rtl" size="300px" :before-close="handleDrawerClose">
      <el-form v-if="selectedModel" label-position="top">
        <el-form-item label="模型名称">
          <el-input v-model="selectedModel.name" @change="handleUpdateModel" />
        </el-form-item>

        <el-form-item label="颜色">
          <el-color-picker v-model="selectedModel.color" @change="handleUpdateModel" />
        </el-form-item>

        <el-form-item label="位置偏移 X">
          <el-slider v-model="configForm.posOffsetX" :min="-5" :max="5" :step="0.1" show-input />
        </el-form-item>

        <el-form-item label="位置偏移 Y">
          <el-slider v-model="configForm.posOffsetY" :min="-5" :max="5" :step="0.1" show-input />
        </el-form-item>

        <el-form-item label="位置偏移 Z">
          <el-slider v-model="configForm.posOffsetZ" :min="-5" :max="5" :step="0.1" show-input />
        </el-form-item>

        <el-form-item label="缩放">
          <el-slider v-model="configForm.scale" :min="0.2" :max="3" :step="0.1" show-input />
        </el-form-item>

        <el-form-item label="显示">
          <el-switch v-model="configForm.visible" />
        </el-form-item>

        <el-form-item label="高亮">
          <el-switch v-model="configForm.highlight" />
        </el-form-item>

        <el-form-item v-if="selectedModel.type === 'custom'" label="动画">
          <el-switch v-model="configForm.animation" />
        </el-form-item>
      </el-form>
    </el-drawer>
  </div>
</template>

<script setup lang="ts" name="ModelPanel">
import { Delete, Plus } from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";
import { computed, reactive, ref, watch } from "vue";

import type { Model, ModelConfig, ModelType } from "@/interface/project";
import { useModelStore } from "@/stores/modules/model";
import { PRIMITIVE_TYPES } from "@/utils/three/constants";

// Props
const props = defineProps<{
  models: Model[];
  selectedModelId?: string;
  modelConfig?: ModelConfig;
}>();

// Emits
const emit = defineEmits<{
  (e: "select", modelId: string): void;
  (e: "add", model: Model): void;
  (e: "delete", modelId: string): void;
  (e: "updateConfig", modelId: string, config: ModelConfig): void;
  (e: "update", model: Model): void;
}>();

const modelStore = useModelStore();

// State
const drawerVisible = ref(false);
const selectedModel = ref<Model | null>(null);
const configForm = reactive({
  posOffsetX: 0,
  posOffsetY: 0,
  posOffsetZ: 0,
  scale: 1,
  visible: true,
  highlight: false,
  animation: true
});

// Methods
const getModelTypeName = (type: ModelType): string => {
  const config = PRIMITIVE_TYPES.find(p => p.type === type);
  return config?.name || type;
};

const handleAddModel = (type: ModelType) => {
  if (type === "custom") return; // 由 upload 处理
  const model = modelStore.createPrimitiveModel("", type);
  emit("add", model);
};

const handleUploadGLB = async (file: File) => {
  // 创建 Blob URL
  const url = URL.createObjectURL(file);
  const glbData = await file.arrayBuffer();
  const model = modelStore.createCustomModel("", file.name.replace(/\.(glb|gltf)$/i, ""), url, file, glbData);
  emit("add", model);
  return false; // 阻止默认上传行为
};

const handleSelectModel = (model: Model) => {
  selectedModel.value = model;
  emit("select", model.id);

  // 加载配置
  if (props.modelConfig) {
    configForm.posOffsetX = props.modelConfig.posOffset[0];
    configForm.posOffsetY = props.modelConfig.posOffset[1];
    configForm.posOffsetZ = props.modelConfig.posOffset[2];
    configForm.scale = props.modelConfig.scale;
    configForm.visible = props.modelConfig.visible;
    configForm.highlight = props.modelConfig.highlight;
    configForm.animation = props.modelConfig.animation;
  }

  drawerVisible.value = true;
};

const handleDeleteModel = async (model: Model) => {
  try {
    await ElMessageBox.confirm(`确认删除模型 "${model.name}"？`, "删除确认", {
      type: "warning"
    });
    emit("delete", model.id);
    if (selectedModel.value?.id === model.id) {
      selectedModel.value = null;
      drawerVisible.value = false;
    }
  } catch {
    // 取消删除
  }
};

const handleUpdateModel = () => {
  if (selectedModel.value) {
    emit("update", selectedModel.value);
  }
};

const handleDrawerClose = () => {
  if (selectedModel.value) {
    const config: ModelConfig = {
      visible: configForm.visible,
      posOffset: [configForm.posOffsetX, configForm.posOffsetY, configForm.posOffsetZ],
      scale: configForm.scale,
      highlight: configForm.highlight,
      highlightColor: "#00ff00",
      outline: false,
      animation: configForm.animation
    };
    emit("updateConfig", selectedModel.value.id, config);
  }
  drawerVisible.value = false;
};

// Watch selected model config
watch(
  () => props.modelConfig,
  newConfig => {
    if (newConfig) {
      configForm.posOffsetX = newConfig.posOffset[0];
      configForm.posOffsetY = newConfig.posOffset[1];
      configForm.posOffsetZ = newConfig.posOffset[2];
      configForm.scale = newConfig.scale;
      configForm.visible = newConfig.visible;
      configForm.highlight = newConfig.highlight;
      configForm.animation = newConfig.animation;
    }
  },
  { immediate: true }
);
</script>

<style lang="scss" scoped>
.model-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  border-radius: var(--corner-radius-8);
  overflow: hidden;
}

.model-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);

  .title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color-1);
  }
}

.model-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;

  .empty-tip {
    text-align: center;
    color: var(--text-color-3);
    padding: 20px;
  }
}

.model-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-primary);
  border-radius: var(--corner-radius-4);
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-tertiary);
  }

  &.selected {
    border: 1px solid var(--accent);
  }
}

.model-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 10px;
  color: #fff;
  font-weight: 600;
}

.model-info {
  flex: 1;

  .model-name {
    font-size: 13px;
    color: var(--text-color-1);
    display: block;
  }

  .model-type {
    font-size: 11px;
    color: var(--text-color-3);
  }
}
</style>
