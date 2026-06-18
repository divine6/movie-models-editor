<template>
  <div class="playback-bar">
    <!-- 进度条 -->
    <div class="progress-container">
      <div class="progress-track" ref="trackRef" @click="handleProgressClick">
        <!-- 节点区间可视化 -->
        <div
          v-for="chapter in chapters"
          :key="chapter.id"
          class="chapter-range"
          :style="{
            left: `${(chapter.startTime / duration) * 100}%`,
            width: `${((chapter.endTime - chapter.startTime) / duration) * 100}%`,
            backgroundColor: CHAPTER_TAG_COLOR
          }"
        ></div>

        <!-- 当前进度 -->
        <div class="progress-bar" :style="{ width: `${(currentTime / duration) * 100}%` }"></div>

        <!-- 拖动指示器 -->
        <div
          class="progress-indicator"
          :style="{ left: `${(currentTime / duration) * 100}%` }"
          @mousedown="handleSeekStart"
        ></div>
      </div>
    </div>

    <!-- 控制按钮 -->
    <div class="controls">
      <el-button-group>
        <el-button size="small" @click="handlePrevChapter">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <el-button size="small" type="primary" @click="handlePlayPause">
          <el-icon v-if="isPlaying"><VideoPause /></el-icon>
          <el-icon v-else><VideoPlay /></el-icon>
        </el-button>
        <el-button size="small" @click="handleNextChapter">
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </el-button-group>

      <span class="time-display"> {{ formatTime(currentTime) }} / {{ formatTime(duration) }} </span>

      <el-button size="small" :type="isLooping ? 'primary' : 'default'" @click="handleToggleLoop">
        <el-icon><RefreshRight /></el-icon>
      </el-button>

      <el-button size="small" @click="handleTogglePreview">
        <el-icon><FullScreen /></el-icon>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts" name="PlaybackBar">
import { ArrowLeft, ArrowRight, FullScreen, RefreshRight, VideoPause, VideoPlay } from "@element-plus/icons-vue";
import { ref } from "vue";

import type { Chapter } from "@/interface/project";
import { CHAPTER_TAG_COLOR } from "@/utils/three/constants";

// Props
const props = defineProps<{
  currentTime: number;
  duration: number;
  chapters: Chapter[];
  isPlaying: boolean;
  isLooping: boolean;
}>();

// Emits
const emit = defineEmits<{
  (e: "play"): void;
  (e: "pause"): void;
  (e: "seek", time: number): void;
  (e: "prevChapter"): void;
  (e: "nextChapter"): void;
  (e: "toggleLoop"): void;
  (e: "togglePreview"): void;
}>();

const trackRef = ref<HTMLDivElement>();
const isSeeking = ref(false);

// Methods
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const handlePlayPause = () => {
  if (props.isPlaying) {
    emit("pause");
  } else {
    emit("play");
  }
};

const handlePrevChapter = () => {
  emit("prevChapter");
};

const handleNextChapter = () => {
  emit("nextChapter");
};

const handleToggleLoop = () => {
  emit("toggleLoop");
};

const handleTogglePreview = () => {
  emit("togglePreview");
};

const handleProgressClick = (event: MouseEvent) => {
  if (!trackRef.value || props.duration === 0) return;
  const rect = trackRef.value.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;
  const time = percent * props.duration;
  emit("seek", time);
};

const handleSeekStart = (event: MouseEvent) => {
  isSeeking.value = true;
  document.addEventListener("mousemove", handleSeekMove);
  document.addEventListener("mouseup", handleSeekEnd);
};

const handleSeekMove = (event: MouseEvent) => {
  if (!isSeeking.value || !trackRef.value || props.duration === 0) return;
  const rect = trackRef.value.getBoundingClientRect();
  let percent = (event.clientX - rect.left) / rect.width;
  percent = Math.max(0, Math.min(1, percent));
  const time = percent * props.duration;
  emit("seek", time);
};

const handleSeekEnd = () => {
  isSeeking.value = false;
  document.removeEventListener("mousemove", handleSeekMove);
  document.removeEventListener("mouseup", handleSeekEnd);
};
</script>

<style lang="scss" scoped>
.playback-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: var(--corner-radius-8);
}

.progress-container {
  .progress-track {
    height: 24px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    position: relative;
    cursor: pointer;

    .chapter-range {
      position: absolute;
      top: 4px;
      bottom: 4px;
      border-radius: 2px;
      opacity: 0.6;
    }

    .progress-bar {
      position: absolute;
      top: 4px;
      bottom: 4px;
      left: 0;
      background: var(--accent);
      border-radius: 2px;
      width: 0;
    }

    .progress-indicator {
      position: absolute;
      top: 50%;
      width: 12px;
      height: 12px;
      background: #fff;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      cursor: grab;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);

      &:active {
        cursor: grabbing;
      }
    }
  }
}

.controls {
  display: flex;
  align-items: center;
  gap: 16px;

  .time-display {
    font-size: 12px;
    color: var(--text-color-2);
    font-family: monospace;
  }
}
</style>
