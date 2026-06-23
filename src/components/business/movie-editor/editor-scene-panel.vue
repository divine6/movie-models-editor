<template>
  <div class="scene-tab">
    <input ref="envFileInput" type="file" accept=".hdr,.HDR,image/*" class="sp-hidden-input" @change="onEnvFileChange" />

    <div class="scene-settings-panel">
      <div class="sp-body base-form">
        <!-- 灯光 -->
        <div class="base-form-group">
          <div class="base-form-title">{{ $t("OpWeb.Editor.SettingsLighting", "灯光") }}</div>
          <div class="base-form-row">
            <div class="sp-module">
              <div class="sp-module-title">环境光 Ambient</div>
              <div class="sp-field">
                <label>强度</label>
                <div class="sp-slider-row">
                  <el-slider
                    v-model="editor.ambIntensity"
                    :min="0"
                    :max="LIGHT_MAX"
                    :step="0.1"
                    size="small"
                    @input="editor.applySettings"
                  /><el-input-number
                    v-model="editor.ambIntensity"
                    :min="0"
                    :max="LIGHT_MAX"
                    :step="0.1"
                    :controls="false"
                    size="small"
                    @input="editor.applySettings"
                  />
                </div>
              </div>
            </div>
            <div class="sp-module">
              <div class="sp-module-title">方向光 Directional</div>
              <div class="sp-field">
                <label>强度</label>
                <div class="sp-slider-row">
                  <el-slider
                    v-model="editor.dirIntensity"
                    :min="0"
                    :max="LIGHT_MAX"
                    :step="0.1"
                    size="small"
                    @input="editor.applySettings"
                  /><el-input-number
                    v-model="editor.dirIntensity"
                    :min="0"
                    :max="LIGHT_MAX"
                    :step="0.1"
                    :controls="false"
                    size="small"
                    @input="editor.applySettings"
                  />
                </div>
              </div>
              <div class="sp-field-group">
                <div class="sp-field-group-label">位置</div>
                <div class="sp-axis-sliders">
                  <div v-for="axis in axes" :key="'dir-' + axis.key" class="sp-field">
                    <label>{{ axis.key }}</label>
                    <div class="sp-slider-row">
                      <el-slider
                        v-model="editor.dirPos[axis.idx]"
                        :min="POS_MIN"
                        :max="POS_MAX"
                        :step="0.5"
                        size="small"
                        @input="editor.applySettings"
                      /><el-input-number
                        v-model="editor.dirPos[axis.idx]"
                        :min="POS_MIN"
                        :max="POS_MAX"
                        :step="0.5"
                        :controls="false"
                        size="small"
                        @input="editor.applySettings"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="sp-module">
              <div class="sp-module-title">辅助补光 Fill Light</div>
              <div class="sp-field">
                <label>强度</label>
                <div class="sp-slider-row">
                  <el-slider
                    v-model="editor.fillIntensity"
                    :min="0"
                    :max="LIGHT_MAX"
                    :step="0.1"
                    size="small"
                    @input="editor.applySettings"
                  /><el-input-number
                    v-model="editor.fillIntensity"
                    :min="0"
                    :max="LIGHT_MAX"
                    :step="0.1"
                    :controls="false"
                    size="small"
                    @input="editor.applySettings"
                  />
                </div>
              </div>
              <div class="sp-field-group">
                <div class="sp-field-group-label">位置</div>
                <div class="sp-axis-sliders">
                  <div v-for="axis in axes" :key="'fill-' + axis.key" class="sp-field">
                    <label>{{ axis.key }}</label>
                    <div class="sp-slider-row">
                      <el-slider
                        v-model="editor.fillPos[axis.idx]"
                        :min="POS_MIN"
                        :max="POS_MAX"
                        :step="0.5"
                        size="small"
                        @input="editor.applySettings"
                      /><el-input-number
                        v-model="editor.fillPos[axis.idx]"
                        :min="POS_MIN"
                        :max="POS_MAX"
                        :step="0.5"
                        :controls="false"
                        size="small"
                        @input="editor.applySettings"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 材质 -->
        <div class="base-form-group">
          <div class="base-form-title">{{ $t("OpWeb.Editor.SettingsMaterial", "材质") }}</div>
          <div class="base-form-row">
            <div class="sp-module">
              <div class="sp-module-title">材质设置（当前模型）</div>
              <p v-if="!editor.selModel" class="sp-hint">请先在模型列表中选择一个模型</p>
              <template v-else>
                <div class="sp-field">
                  <label>粗糙度</label>
                  <div class="sp-slider-row">
                    <el-slider
                      v-model="editor.matRoughness"
                      :min="0"
                      :max="1"
                      :step="0.01"
                      size="small"
                      @input="editor.applyMatToCurModel"
                    /><el-input-number
                      v-model="editor.matRoughness"
                      :min="0"
                      :max="1"
                      :step="0.01"
                      :controls="false"
                      size="small"
                      @input="editor.applyMatToCurModel"
                    />
                  </div>
                </div>
                <div class="sp-field">
                  <label>金属度</label>
                  <div class="sp-slider-row">
                    <el-slider
                      v-model="editor.matMetalness"
                      :min="0"
                      :max="1"
                      :step="0.01"
                      size="small"
                      @input="editor.applyMatToCurModel"
                    /><el-input-number
                      v-model="editor.matMetalness"
                      :min="0"
                      :max="1"
                      :step="0.01"
                      :controls="false"
                      size="small"
                      @input="editor.applyMatToCurModel"
                    />
                  </div>
                </div>
                <div class="sp-field">
                  <label>法线强度</label>
                  <div class="sp-slider-row">
                    <el-slider
                      v-model="editor.matNormalStr"
                      :min="0"
                      :max="5"
                      :step="0.05"
                      size="small"
                      @input="editor.applyMatToCurModel"
                    /><el-input-number
                      v-model="editor.matNormalStr"
                      :min="0"
                      :max="5"
                      :step="0.05"
                      :controls="false"
                      size="small"
                      @input="editor.applyMatToCurModel"
                    />
                  </div>
                </div>
                <div class="sp-field">
                  <label>自发光</label>
                  <div class="sp-slider-row">
                    <el-slider
                      v-model="editor.matEmissiveInt"
                      :min="0"
                      :max="5"
                      :step="0.05"
                      size="small"
                      @input="editor.applyMatToCurModel"
                    /><el-input-number
                      v-model="editor.matEmissiveInt"
                      :min="0"
                      :max="5"
                      :step="0.05"
                      :controls="false"
                      size="small"
                      @input="editor.applyMatToCurModel"
                    />
                  </div>
                </div>
                <div class="sp-field">
                  <label>AO 强度</label>
                  <div class="sp-slider-row">
                    <el-slider
                      v-model="editor.matAoInt"
                      :min="0"
                      :max="2"
                      :step="0.05"
                      size="small"
                      @input="editor.applyMatToCurModel"
                    /><el-input-number
                      v-model="editor.matAoInt"
                      :min="0"
                      :max="2"
                      :step="0.05"
                      :controls="false"
                      size="small"
                      @input="editor.applyMatToCurModel"
                    />
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- 后处理 -->
        <div class="base-form-group">
          <div class="base-form-title">{{ $t("OpWeb.Editor.SettingsPostproc", "后处理") }}</div>
          <div class="base-form-row">
            <div class="sp-module">
              <div class="sp-module-title">辉光 Bloom</div>
              <div class="sp-field">
                <label>强度</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.bloomIntensity" :min="0" :max="3" :step="0.01" size="small" @input="editor.toggleBloom" />
                  <el-input-number
                    v-model="editor.bloomIntensity"
                    :min="0"
                    :max="3"
                    :step="0.01"
                    :controls="false"
                    size="small"
                    @input="editor.toggleBloom"
                  />
                </div>
              </div>
              <div class="sp-field">
                <label>阈值</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.bloomThreshold" :min="0" :max="1" :step="0.01" size="small" @input="editor.toggleBloom" />
                  <el-input-number
                    v-model="editor.bloomThreshold"
                    :min="0"
                    :max="1"
                    :step="0.01"
                    :controls="false"
                    size="small"
                    @input="editor.toggleBloom"
                  />
                </div>
              </div>
              <div class="sp-field">
                <label>半径</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.bloomRadius" :min="0" :max="1" :step="0.01" size="small" @input="editor.toggleBloom" />
                  <el-input-number
                    v-model="editor.bloomRadius"
                    :min="0"
                    :max="1"
                    :step="0.01"
                    :controls="false"
                    size="small"
                    @input="editor.toggleBloom"
                  />
                </div>
              </div>
            </div>
            <div class="sp-module">
              <div class="sp-module-title">色彩矫正</div>
              <div class="sp-field">
                <label>色调映射</label>
                <el-select v-model="editor.toneMapping" size="small" @change="editor.applyToneMapping">
                  <el-option
                    v-for="opt in editor.TONE_MAPPING_OPTIONS"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
              </div>
              <div class="sp-field">
                <label>曝光度</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.ppExposure" :min="0" :max="5" :step="0.05" size="small" @input="editor.applyToneMapping" />
                  <el-input-number
                    v-model="editor.ppExposure"
                    :min="0"
                    :max="5"
                    :step="0.05"
                    :controls="false"
                    size="small"
                    @input="editor.applyToneMapping"
                  />
                </div>
              </div>
              <div class="sp-field">
                <label>对比度</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.ppContrast" :min="-1" :max="1" :step="0.01" size="small" @input="editor.toggleColor" />
                  <el-input-number
                    v-model="editor.ppContrast"
                    :min="-1"
                    :max="1"
                    :step="0.01"
                    :controls="false"
                    size="small"
                    @input="editor.toggleColor"
                  />
                </div>
              </div>
              <div class="sp-field">
                <label>饱和度</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.ppSaturation" :min="-1" :max="1" :step="0.01" size="small" @input="editor.toggleColor" />
                  <el-input-number
                    v-model="editor.ppSaturation"
                    :min="-1"
                    :max="1"
                    :step="0.01"
                    :controls="false"
                    size="small"
                    @input="editor.toggleColor"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 环境 -->
        <div class="base-form-group">
          <div class="base-form-title">{{ $t("OpWeb.Editor.SettingsEnv", "环境") }}</div>
          <div class="base-form-row">
            <div class="sp-module">
              <div class="sp-module-title">雾效 Fog</div>
              <div class="sp-field sp-field--inline">
                <label>启用雾效</label>
                <el-switch v-model="editor.fogEnabled" size="small" @change="editor.applyFog" />
              </div>
              <div class="sp-field">
                <label>近距</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.fogNear" :min="0" :max="80" :step="0.5" size="small" @input="editor.applyFog" />
                  <el-input-number
                    v-model="editor.fogNear"
                    :min="0"
                    :max="80"
                    :step="0.5"
                    :controls="false"
                    size="small"
                    @input="editor.applyFog"
                  />
                </div>
              </div>
              <div class="sp-field">
                <label>远距</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.fogFar" :min="1" :max="120" :step="0.5" size="small" @input="editor.applyFog" />
                  <el-input-number
                    v-model="editor.fogFar"
                    :min="1"
                    :max="120"
                    :step="0.5"
                    :controls="false"
                    size="small"
                    @input="editor.applyFog"
                  />
                </div>
              </div>
            </div>
            <div class="sp-module">
              <div class="sp-module-title">阴影 Shadow</div>
              <div class="sp-field sp-field--inline">
                <label>启用阴影</label>
                <el-switch v-model="editor.shadowEnabled" size="small" @change="editor.applyShadow" />
              </div>
              <div class="sp-field">
                <label>强度</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.shadowIntensity" :min="0" :max="3" :step="0.1" size="small" @input="editor.applyShadow" />
                  <el-input-number
                    v-model="editor.shadowIntensity"
                    :min="0"
                    :max="3"
                    :step="0.1"
                    :controls="false"
                    size="small"
                    @input="editor.applyShadow"
                  />
                </div>
              </div>
              <div class="sp-field">
                <label>贴图大小</label>
                <el-select v-model="editor.shadowMapSize" size="small" @change="editor.applyShadow">
                  <el-option label="512" :value="512" />
                  <el-option label="1024" :value="1024" />
                  <el-option label="2048" :value="2048" />
                </el-select>
              </div>
              <div class="sp-field">
                <label>偏移</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.shadowBias" :min="-0.01" :max="0.01" :step="0.0001" size="small" @input="editor.applyShadow" />
                  <el-input-number
                    v-model="editor.shadowBias"
                    :min="-0.01"
                    :max="0.01"
                    :step="0.0001"
                    :controls="false"
                    size="small"
                    class="sp-input-number--wide"
                    @input="editor.applyShadow"
                  />
                </div>
              </div>
              <div class="sp-field">
                <label>法线偏移</label>
                <div class="sp-slider-row">
                  <el-slider
                    v-model="editor.shadowNormalBias"
                    :min="0"
                    :max="0.1"
                    :step="0.001"
                    size="small"
                    @input="editor.applyShadow"
                  />
                  <el-input-number
                    v-model="editor.shadowNormalBias"
                    :min="0"
                    :max="0.1"
                    :step="0.001"
                    :controls="false"
                    size="small"
                    @input="editor.applyShadow"
                  />
                </div>
              </div>
              <div class="sp-field">
                <label>阴影类型</label>
                <el-select v-model="editor.shadowType" size="small" @change="editor.applyShadow">
                  <el-option label="PCF Soft" value="pcfsoft" />
                  <el-option label="PCF" value="pcf" />
                  <el-option label="VSM" value="vsm" />
                  <el-option label="Basic" value="basic" />
                </el-select>
              </div>
            </div>
            <div class="sp-module">
              <div class="sp-module-title">网格 Grid</div>
              <div class="sp-field sp-field--inline">
                <label>显示</label>
                <el-switch v-model="editor.gridVisible" size="small" @change="editor.applyGrid" />
              </div>
              <div class="sp-form-row sp-form-row--2">
                <div class="sp-field">
                  <label>大小</label>
                  <el-input-number v-model="editor.gridSize" :min="10" :max="200" :step="5" size="small" @input="editor.applyGrid" />
                </div>
                <div class="sp-field">
                  <label>细分</label>
                  <el-input-number v-model="editor.gridDivisions" :min="4" :max="100" :step="2" size="small" @input="editor.applyGrid" />
                </div>
              </div>
              <div class="sp-field">
                <label>高度</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.gridHeight" :min="-5" :max="5" :step="0.1" size="small" @input="editor.applyGrid" />
                  <el-input-number
                    v-model="editor.gridHeight"
                    :min="-5"
                    :max="5"
                    :step="0.1"
                    :controls="false"
                    size="small"
                    @input="editor.applyGrid"
                  />
                </div>
              </div>
            </div>
            <div class="sp-module">
              <div class="sp-module-title">环境 Environment</div>
              <div class="sp-field">
                <label>环境贴图</label>
                <div class="sp-map-actions">
                  <div v-if="editor.envMapPreview" class="sp-map-thumb sp-map-thumb--env">
                    <img :src="editor.envMapPreview" alt="" />
                  </div>
                  <el-button size="small" @click="pickEnvMap">换图</el-button>
                  <el-button v-if="editor.envMapPreview" size="small" text type="danger" @click="editor.clearEnvironmentMap()">
                    恢复默认
                  </el-button>
                </div>
              </div>
              <div class="sp-field">
                <label>环境贴图强度</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.envIntensityVal" :min="0" :max="5" :step="0.1" size="small" @input="editor.applyEnv" />
                  <el-input-number
                    v-model="editor.envIntensityVal"
                    :min="0"
                    :max="5"
                    :step="0.1"
                    :controls="false"
                    size="small"
                    @input="editor.applyEnv"
                  />
                </div>
              </div>
              <div class="sp-field sp-field--inline">
                <label>背景色</label>
                <el-color-picker v-model="editor.bgColorVal" size="small" @active-change="editor.applySettings" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="scene-tab-footer">
      <el-button class="sp-reset-btn" size="default" @click="editor.resetSceneSettings">
        {{ $t("OpWeb.Common.Reset", "重置") }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-scene-panel">
import { ref } from "vue";

import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { useTranslate } from "@/hooks/useTranslate";

const editor = useMovieEditorContext();
const $t = useTranslate();

const LIGHT_MAX = 50;
const POS_MIN = -30;
const POS_MAX = 30;
const axes = [
  { key: "X", idx: 0 },
  { key: "Y", idx: 1 },
  { key: "Z", idx: 2 }
] as const;

const envFileInput = ref<HTMLInputElement | null>(null);

function pickEnvMap() {
  envFileInput.value?.click();
}

async function onEnvFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = "";
  if (!file) return;
  try {
    await editor.applyEnvironmentMapFile(file);
  } catch {
    /* handled in editor */
  }
}
</script>

<style lang="scss">
.scene-tab {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.sp-hidden-input {
  display: none;
}

.sp-hint {
  margin: 0 0 8px;
  font-size: 11px;
  color: var(--text-color-3);
}

.sp-map-section {
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-color-1);
}

.sp-map-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;

  > label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-color-2);
  }
}

.sp-map-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.sp-map-thumb {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--border-color-2);
  background: var(--fill-color-2);
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &--env {
    width: 56px;
    height: 28px;
  }
}

.sp-axis-sliders {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scene-settings-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;

  .sp-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: #fff;
  }

  .base-form-group {
    margin-bottom: 0;
    background: #fff;
    border: 1px solid var(--border-color-2);
    border-radius: var(--corner-radius-4);
    overflow: hidden;

    .base-form-title {
      padding: 10px 12px 8px;
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      line-height: 18px;
      color: var(--text-color-1);
      background: var(--fill-color-1);
      border-bottom: 1px solid var(--border-color-1);
    }

    .base-form-row {
      padding: 10px 12px 12px;
      display: flex;
      flex-direction: column;
      gap: 0;
    }
  }

  .sp-module {
    padding: 0;

    & + .sp-module {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px dashed var(--border-color-1);
    }
  }

  .sp-module-title {
    margin-bottom: 8px;
    font-size: 11px;
    font-weight: 600;
    line-height: 18px;
    color: var(--text-color-2);
  }

  .sp-form-row {
    display: grid;
    gap: 10px;

    &--2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .sp-field-group {
    margin-bottom: 10px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .sp-field-group-label {
    margin-bottom: 6px;
    font-size: 11px;
    font-weight: 500;
    line-height: 18px;
    color: var(--text-color-2);
  }

  .sp-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 10px;
    min-width: 0;

    &:last-child {
      margin-bottom: 0;
    }

    > label {
      display: block;
      margin-bottom: 0;
      font-size: 11px;
      font-weight: 500;
      line-height: 18px;
      color: var(--text-color-2);
    }

    &--inline {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 8px;

      > label {
        flex-shrink: 0;
        color: var(--text-color-1);
      }
    }
  }

  .sp-slider-row {
    display: flex;
    align-items: center;
    gap: 8px;

    .el-slider {
      flex: 1;
      min-width: 0;
    }

    .el-input-number {
      flex-shrink: 0;
      width: 52px;

      &.sp-input-number--wide {
        width: 68px;
      }
    }
  }

  .el-select,
  .sp-field > .el-input-number {
    width: 100%;
  }
}

.scene-tab-footer {
  flex-shrink: 0;
  height: 65px;
  padding: 12px 20px 14px;
  border-top: 1px solid var(--border-color-1);
  background: #fff;
  box-sizing: border-box;
  display: flex;
  align-items: center;

  .sp-reset-btn {
    width: 100%;
    height: 24px;
    padding: 0 10px;
  }
}
</style>
