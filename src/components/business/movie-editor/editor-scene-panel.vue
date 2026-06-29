<template>
  <div class="scene-tab">
    <input ref="envFileInput" type="file" accept=".hdr,.HDR" class="sp-hidden-input" @change="onEnvFileChange" />

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
                    :step="0.05"
                    size="small"
                    @input="editor.applySettings"
                  /><el-input-number
                    v-model="editor.ambIntensity"
                    :min="0"
                    :max="LIGHT_MAX"
                    :step="0.05"
                    :controls="false"
                    size="small"
                    @input="editor.applySettings"
                  />
                </div>
              </div>
            </div>

            <div class="sp-module">
              <div class="sp-module-title sp-module-title--row">
                <span>场景光源</span>
                <el-dropdown trigger="click" @command="onAddLight">
                  <el-button size="small" type="primary">+ 添加灯光</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="directional">平行光 Directional</el-dropdown-item>
                      <el-dropdown-item command="spot">聚光灯 Spot</el-dropdown-item>
                      <el-dropdown-item command="point">点光源 Point</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>

              <div v-if="editor.sceneLights.length === 0" class="sp-hint">点击「添加灯光」在场景中添加光源</div>

              <div class="sp-light-list">
                <button
                  v-for="light in editor.sceneLights"
                  :key="light.id"
                  type="button"
                  class="sp-light-item"
                  :class="{ active: editor.selectedSceneLightId === light.id }"
                  @click="editor.selectSceneLight(light.id)"
                >
                  <span class="sp-light-item__name">{{ light.name }}</span>
                  <span class="sp-light-item__type">{{ lightTypeLabel(light.type) }}</span>
                  <el-button
                    class="sp-light-item__del"
                    size="small"
                    text
                    type="danger"
                    @click.stop="editor.removeSceneLight(light.id)"
                  >
                    删除
                  </el-button>
                </button>
              </div>

              <template v-if="selectedLight">
                <div class="sp-field">
                  <label>名称</label>
                  <el-input v-model="selectedLight.name" size="small" @input="editor.applySceneLights" />
                </div>
                <div class="sp-field sp-field--inline">
                  <label>颜色</label>
                  <el-color-picker v-model="selectedLight.color" size="small" @change="editor.applySceneLights" />
                </div>
                <div class="sp-field">
                  <label>强度</label>
                  <div class="sp-slider-row">
                    <el-slider
                      v-model="selectedLight.intensity"
                      :min="0"
                      :max="LIGHT_MAX"
                      :step="0.05"
                      size="small"
                      @input="editor.applySceneLights"
                    /><el-input-number
                      v-model="selectedLight.intensity"
                      :min="0"
                      :max="LIGHT_MAX"
                      :step="0.05"
                      :controls="false"
                      size="small"
                      @input="editor.applySceneLights"
                    />
                  </div>
                </div>
                <div class="sp-field-group">
                  <div class="sp-field-group-label">位置</div>
                  <div class="sp-axis-sliders">
                    <div v-for="axis in axes" :key="'light-pos-' + selectedLight.id + axis.key" class="sp-field">
                      <label>{{ axis.key }}</label>
                      <div class="sp-slider-row">
                        <el-slider
                          v-model="selectedLight.position[axis.idx]"
                          :min="POS_MIN"
                          :max="POS_MAX"
                          :step="0.05"
                          size="small"
                          @input="editor.applySceneLights"
                        /><el-input-number
                          v-model="selectedLight.position[axis.idx]"
                          :min="POS_MIN"
                          :max="POS_MAX"
                          :step="0.05"
                          :controls="false"
                          size="small"
                          @input="editor.applySceneLights"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="selectedLight.type !== 'point'" class="sp-field-group">
                  <div class="sp-field-group-label">照射方向（旋转 °）</div>
                  <div class="sp-axis-sliders">
                    <div v-for="axis in axes" :key="'light-rot-' + selectedLight.id + axis.key" class="sp-field">
                      <label>{{ axis.key }}</label>
                      <div class="sp-slider-row">
                        <el-slider
                          v-model="selectedLight.rotation[axis.idx]"
                          :min="-180"
                          :max="180"
                          :step="0.05"
                          size="small"
                          @input="editor.applySceneLights"
                        /><el-input-number
                          v-model="selectedLight.rotation[axis.idx]"
                          :min="-180"
                          :max="180"
                          :step="0.05"
                          :controls="false"
                          size="small"
                          @input="editor.applySceneLights"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="selectedLight.type === 'directional'" class="sp-field sp-field--inline">
                  <label>投射阴影</label>
                  <el-switch v-model="selectedLight.castShadow" size="small" @change="editor.applySceneLights" />
                </div>
                <template v-if="selectedLight.type === 'point' || selectedLight.type === 'spot'">
                  <div class="sp-field">
                    <label>距离 distance</label>
                    <div class="sp-slider-row">
                      <el-slider
                        v-model="selectedLight.distance"
                        :min="0"
                        :max="100"
                        :step="0.05"
                        size="small"
                        @input="editor.applySceneLights"
                      /><el-input-number
                        v-model="selectedLight.distance"
                        :min="0"
                        :max="100"
                        :step="0.05"
                        :controls="false"
                        size="small"
                        @input="editor.applySceneLights"
                      />
                    </div>
                  </div>
                  <div class="sp-field">
                    <label>衰减 decay</label>
                    <div class="sp-slider-row">
                      <el-slider
                        v-model="selectedLight.decay"
                        :min="0"
                        :max="5"
                        :step="0.05"
                        size="small"
                        @input="editor.applySceneLights"
                      /><el-input-number
                        v-model="selectedLight.decay"
                        :min="0"
                        :max="5"
                        :step="0.05"
                        :controls="false"
                        size="small"
                        @input="editor.applySceneLights"
                      />
                    </div>
                  </div>
                </template>
                <template v-if="selectedLight.type === 'spot'">
                  <div class="sp-field">
                    <label>锥角 angle（°）</label>
                    <div class="sp-slider-row">
                      <el-slider
                        v-model="selectedLight.angle"
                        :min="1"
                        :max="90"
                        :step="0.05"
                        size="small"
                        @input="editor.applySceneLights"
                      /><el-input-number
                        v-model="selectedLight.angle"
                        :min="1"
                        :max="90"
                        :step="0.05"
                        :controls="false"
                        size="small"
                        @input="editor.applySceneLights"
                      />
                    </div>
                  </div>
                  <div class="sp-field">
                    <label>半影 penumbra</label>
                    <div class="sp-slider-row">
                      <el-slider
                        v-model="selectedLight.penumbra"
                        :min="0"
                        :max="1"
                        :step="0.05"
                        size="small"
                        @input="editor.applySceneLights"
                      /><el-input-number
                        v-model="selectedLight.penumbra"
                        :min="0"
                        :max="1"
                        :step="0.05"
                        :controls="false"
                        size="small"
                        @input="editor.applySceneLights"
                      />
                    </div>
                  </div>
                </template>
              </template>
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
                      :step="0.05"
                      size="small"
                      @input="editor.applyMatToCurModel"
                    /><el-input-number
                      v-model="editor.matRoughness"
                      :min="0"
                      :max="1"
                      :step="0.05"
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
                      :step="0.05"
                      size="small"
                      @input="editor.applyMatToCurModel"
                    /><el-input-number
                      v-model="editor.matMetalness"
                      :min="0"
                      :max="1"
                      :step="0.05"
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
                  <el-slider v-model="editor.bloomIntensity" :min="0" :max="3" :step="0.05" size="small" @input="editor.toggleBloom" />
                  <el-input-number
                    v-model="editor.bloomIntensity"
                    :min="0"
                    :max="3"
                    :step="0.05"
                    :controls="false"
                    size="small"
                    @input="editor.toggleBloom"
                  />
                </div>
              </div>
              <div class="sp-field">
                <label>阈值</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.bloomThreshold" :min="0" :max="1" :step="0.05" size="small" @input="editor.toggleBloom" />
                  <el-input-number
                    v-model="editor.bloomThreshold"
                    :min="0"
                    :max="1"
                    :step="0.05"
                    :controls="false"
                    size="small"
                    @input="editor.toggleBloom"
                  />
                </div>
              </div>
              <div class="sp-field">
                <label>半径</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.bloomRadius" :min="0" :max="1" :step="0.05" size="small" @input="editor.toggleBloom" />
                  <el-input-number
                    v-model="editor.bloomRadius"
                    :min="0"
                    :max="1"
                    :step="0.05"
                    :controls="false"
                    size="small"
                    @input="editor.toggleBloom"
                  />
                </div>
              </div>
            </div>
            <div class="sp-module">
              <div class="sp-module-title">抗锯齿 Anti-aliasing</div>
              <div class="sp-field">
                <label>抗锯齿模式</label>
                <el-select
                  v-model="editor.antialiasingMode"
                  size="small"
                  @change="editor.applyAntialiasing"
                >
                  <el-option
                    v-for="opt in editor.ANTIALIASING_MODE_OPTIONS"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
                <div class="sp-hint sp-hint--inline">{{ antialiasingModeHint }}</div>
              </div>
              <div class="sp-field sp-field--inline">
                <label>MSAA（硬件，需刷新页面）</label>
                <el-switch v-model="editor.msaaEnabled" size="small" @change="editor.applyAntialiasing" />
              </div>
              <div class="sp-field">
                <label>渲染采样倍数</label>
                <div class="sp-aa-presets">
                  <button
                    v-for="opt in antialiasRatioPresets"
                    :key="opt.value"
                    type="button"
                    class="sp-aa-preset"
                    :class="{ 'is-active': Math.abs(editor.maxPixelRatio - opt.value) < 0.01 }"
                    @click="setAntialiasRatio(opt.value)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
                <div class="sp-hint sp-hint--inline">
                  展示链接自动 SMAA+MSAA（参考 Oxide），当前实际 {{ editor.effectiveRenderPixelRatio.toFixed(1) }}x
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
                  <el-slider v-model="editor.ppContrast" :min="-1" :max="1" :step="0.05" size="small" @input="editor.toggleColor" />
                  <el-input-number
                    v-model="editor.ppContrast"
                    :min="-1"
                    :max="1"
                    :step="0.05"
                    :controls="false"
                    size="small"
                    @input="editor.toggleColor"
                  />
                </div>
              </div>
              <div class="sp-field">
                <label>饱和度</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.ppSaturation" :min="-1" :max="1" :step="0.05" size="small" @input="editor.toggleColor" />
                  <el-input-number
                    v-model="editor.ppSaturation"
                    :min="-1"
                    :max="1"
                    :step="0.05"
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
              <div class="sp-module-title">环境贴图 Environment (HDR)</div>
              <div class="sp-field">
                <label>HDR 环境贴图</label>
                <div class="sp-map-actions">
                  <div v-if="editor.envMapPreview" class="sp-map-thumb sp-map-thumb--env">
                    <img :src="editor.envMapPreview" alt="" />
                  </div>
                  <span v-else-if="editor.envMapIsHdr" class="sp-hdr-badge">HDR 已加载</span>
                  <el-button size="small" @click="pickEnvMap">更换 HDR</el-button>
                  <el-button size="small" text type="danger" @click="editor.clearEnvironmentMap()">恢复默认</el-button>
                </div>
              </div>
              <div class="sp-field">
                <label>环境旋转（°）</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.envRotation" :min="0" :max="360" :step="0.05" size="small" @input="editor.applyEnv" />
                  <el-input-number
                    v-model="editor.envRotation"
                    :min="0"
                    :max="360"
                    :step="0.05"
                    :controls="false"
                    size="small"
                    @input="editor.applyEnv"
                  />
                </div>
              </div>
              <div class="sp-field">
                <label>环境贴图强度</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.envIntensityVal" :min="0" :max="5" :step="0.05" size="small" @input="editor.applyEnv" />
                  <el-input-number
                    v-model="editor.envIntensityVal"
                    :min="0"
                    :max="5"
                    :step="0.05"
                    :controls="false"
                    size="small"
                    @input="editor.applyEnv"
                  />
                </div>
              </div>
              <div class="sp-field">
                <label>模型反射强度</label>
                <div class="sp-slider-row">
                  <el-slider
                    v-model="editor.envReflectionIntensity"
                    :min="0"
                    :max="5"
                    :step="0.05"
                    size="small"
                    @input="editor.applyEnv"
                  />
                  <el-input-number
                    v-model="editor.envReflectionIntensity"
                    :min="0"
                    :max="5"
                    :step="0.05"
                    :controls="false"
                    size="small"
                    @input="editor.applyEnv"
                  />
                </div>
              </div>
              <div class="sp-field sp-field--inline">
                <label>环境反射预览球</label>
                <el-switch v-model="editor.envReflectionSphereVisible" size="small" @change="editor.applyEnv" />
              </div>
            </div>
            <div class="sp-module">
              <div class="sp-module-title">雾效 Fog</div>
              <div class="sp-field sp-field--inline">
                <label>启用雾效</label>
                <el-switch v-model="editor.fogEnabled" size="small" @change="editor.applyFog" />
              </div>
              <div class="sp-field">
                <label>近距</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.fogNear" :min="0" :max="80" :step="0.05" size="small" @input="editor.applyFog" />
                  <el-input-number
                    v-model="editor.fogNear"
                    :min="0"
                    :max="80"
                    :step="0.05"
                    :controls="false"
                    size="small"
                    @input="editor.applyFog"
                  />
                </div>
              </div>
              <div class="sp-field">
                <label>远距</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.fogFar" :min="1" :max="120" :step="0.05" size="small" @input="editor.applyFog" />
                  <el-input-number
                    v-model="editor.fogFar"
                    :min="1"
                    :max="120"
                    :step="0.05"
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
                  <el-slider v-model="editor.shadowIntensity" :min="0" :max="3" :step="0.05" size="small" @input="editor.applyShadow" />
                  <el-input-number
                    v-model="editor.shadowIntensity"
                    :min="0"
                    :max="3"
                    :step="0.05"
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
                  <el-input-number
                    v-model="editor.gridSize"
                    :min="10"
                    :max="200"
                    :step="0.05"
                    size="small"
                    @input="editor.applyGrid"
                  />
                </div>
                <div class="sp-field">
                  <label>细分</label>
                  <el-input-number
                    v-model="editor.gridDivisions"
                    :min="4"
                    :max="100"
                    :step="0.05"
                    size="small"
                    @input="editor.applyGrid"
                  />
                </div>
              </div>
              <div class="sp-field">
                <label>高度</label>
                <div class="sp-slider-row">
                  <el-slider v-model="editor.gridHeight" :min="-5" :max="5" :step="0.05" size="small" @input="editor.applyGrid" />
                  <el-input-number
                    v-model="editor.gridHeight"
                    :min="-5"
                    :max="5"
                    :step="0.05"
                    :controls="false"
                    size="small"
                    @input="editor.applyGrid"
                    @change="onGridHeightChange"
                    @blur="onGridHeightBlur"
                  />
                </div>
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
import { computed, ref } from "vue";

import { ANTIALIAS_RATIO_PRESETS } from "@/composables/movie-editor/constants";
import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { useTranslate } from "@/hooks/useTranslate";
import type { SceneLightType } from "@/interface/sceneLight";

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

const selectedLight = computed(() =>
  editor.sceneLights.find(l => l.id === editor.selectedSceneLightId) ?? null
);

const antialiasRatioPresets = ANTIALIAS_RATIO_PRESETS;

const antialiasingModeHint = computed(
  () => editor.ANTIALIASING_MODE_OPTIONS.find(o => o.value === editor.antialiasingMode)?.hint ?? ""
);

function setAntialiasRatio(value: number) {
  editor.maxPixelRatio = value;
  editor.applyAntialiasing();
}

function onGridHeightChange(value: number | string | undefined) {
  const num = Number(value);
  if (Number.isFinite(num)) {
    editor.gridHeight = num;
  }
  editor.applyGrid();
}

function onGridHeightBlur() {
  onGridHeightChange(editor.gridHeight as number);
}

function lightTypeLabel(type: SceneLightType) {
  if (type === "directional") return "平行光";
  if (type === "spot") return "聚光灯";
  return "点光源";
}

function onAddLight(type: SceneLightType) {
  editor.addSceneLight(type);
}

function onBgColorChange() {
  editor.applyFog();
}

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

  &--inline {
    margin: -4px 0 8px;
    line-height: 1.45;
  }
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

.sp-aa-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sp-aa-preset {
  min-width: 44px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border-color-2);
  border-radius: var(--corner-radius-2);
  background: var(--fill-color-2);
  color: var(--text-color-2);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--primary-color-5);
    color: var(--primary-color-6);
    background: var(--primary-color-1);
  }

  &.is-active {
    border-color: var(--primary-color-5);
    color: var(--primary-color-6);
    background: var(--primary-color-1);
    font-weight: 600;
  }
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
    background: transparent;
  }

  .base-form-group {
    margin-bottom: 0;
    background: #0d0f12;
    border: 1px solid rgb(255 255 255 / 8%);
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

    &--row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
  }

  .sp-light-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 10px;
  }

  .sp-light-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--border-color-2);
    border-radius: var(--corner-radius-2);
    background: rgb(255 255 255 / 3%);
    color: var(--text-color-2);
    cursor: pointer;
    text-align: left;

    &.active {
      border-color: rgb(74 222 128 / 40%);
      background: rgb(20 48 36 / 50%);
    }

    &__name {
      flex: 1;
      font-size: 12px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__type {
      font-size: 10px;
      color: var(--text-color-3);
    }

    &__del {
      flex-shrink: 0;
    }
  }

  .sp-hdr-badge {
    font-size: 11px;
    color: var(--text-color-3);
    padding: 4px 8px;
    border: 1px dashed var(--border-color-2);
    border-radius: 4px;
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
  background: #0d0f12;
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
