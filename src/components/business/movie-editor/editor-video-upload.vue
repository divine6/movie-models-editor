<template>
  <div class="video-upload-card">
    <div class="card-header">
      <span class="card-title">{{ $t("OpWeb.Editor.VideoUpload", "视频上传") }}</span>
    </div>
    <div class="card-body">
      <div class="video-source-tabs">
        <button
          class="video-source-tab"
          :class="{ active: editor.videoSourceTab === 'local' }"
          type="button"
          @click="editor.videoSourceTab = 'local'"
        >
          <span class="tab-icon">📁</span> {{ $t("OpWeb.Editor.LocalUpload", "本地上传") }}
        </button>
        <button
          class="video-source-tab"
          :class="{ active: editor.videoSourceTab === 'url' }"
          type="button"
          @click="editor.videoSourceTab = 'url'"
        >
          <span class="tab-icon">🔗</span> {{ $t("OpWeb.Editor.VideoUrl", "视频链接") }}
        </button>
      </div>

      <div
        v-if="editor.videoSourceTab === 'local'"
        class="video-drop-zone"
        :class="{ 'drag-over': editor.isDragOver }"
        @dragover.prevent="editor.onDragOver"
        @dragleave="editor.onDragLeave"
        @drop.prevent="editor.onVideoDrop"
        @click="editor.triggerVideoUpload"
      >
        <input
          :ref="editor.bindRef('fileInputEl')"
          type="file"
          accept="video/*"
          style="display: none"
          @change="editor.onVideoFileChange"
        />
        <div class="drop-icon">🎬</div>
        <div class="drop-text">{{ $t("OpWeb.Editor.DropVideo", "拖拽视频到此处或点击上传") }}</div>
        <div class="drop-hint">{{ $t("OpWeb.Editor.VideoFormats", "支持 MP4 / WebM / OGV") }}</div>
      </div>

      <div v-else class="video-url-box">
        <label class="url-label">{{ $t("OpWeb.Editor.VideoUrlHint", "请输入视频文件的直链地址：") }}</label>
        <el-input v-model="editor.remoteUrl" placeholder="https://example.com/video.mp4" size="small" />
        <div class="url-hint">{{ $t("OpWeb.Editor.CorsHint", "在线视频需要服务器支持 CORS") }}</div>
        <el-button type="primary" size="small" style="width: 100%; margin-top: 10px" @click="editor.loadRemoteVideo">
          {{ $t("OpWeb.Editor.LoadVideo", "确认加载") }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-video-upload">
import { useMovieEditorContext } from "@/composables/useMovieEditorContext";

const editor = useMovieEditorContext();
</script>
