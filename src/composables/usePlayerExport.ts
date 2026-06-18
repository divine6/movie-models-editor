/**
 * 播放器导出
 * 从原始 MovieModelEditor 的 playerGenerator.js 迁移
 */

import {
  SUBTITLE_DEFAULT_BACKGROUND,
  type Chapter,
  type Model,
  type ModelConfig,
  type ProjectDetail,
  type Subtitle
} from "@/interface/project";
import { ElMessage } from "element-plus";
import { ANIMATION } from "@/utils/three/constants";

async function getModelGlbData(model: Model): Promise<ArrayBuffer | null> {
  if (model.glbData) return model.glbData;
  if (model.file) return model.file.arrayBuffer();
  if (model.url) {
    const response = await fetch(model.url);
    if (!response.ok) return null;
    return response.arrayBuffer();
  }
  return null;
}

async function buildModelsExportPayload(project: ProjectDetail, inlineAssets: boolean) {
  return Promise.all(
    project.models.map(async m => {
      let url = m.url;
      if (inlineAssets && m.type === "custom") {
        const glbData = await getModelGlbData(m);
        if (glbData) url = arrayBufferToDataURL(glbData);
      }
      return {
        id: m.id,
        name: m.name,
        type: m.type,
        color: m.color,
        url,
        basePosition: m.basePosition
      };
    })
  );
}

/**
 * 导出独立播放器
 */
export async function exportPlayer(project: ProjectDetail, videoFile?: File): Promise<void> {
  // 检查 File System Access API 支持
  if ("showDirectoryPicker" in window) {
    await exportToDirectory(project, videoFile);
  } else {
    await exportAsSingleHtml(project, videoFile);
  }
}

/**
 * 导出到目录（File System Access API）
 */
async function exportToDirectory(project: ProjectDetail, videoFile?: File): Promise<void> {
  try {
    const dirHandle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
    const projectDir = await dirHandle.getDirectoryHandle(project.title, { create: true });

    // 生成 index.html
    const modelsPayload = await buildModelsExportPayload(project, false);
    const htmlContent = generatePlayerHtml(project, modelsPayload);
    const htmlFile = await projectDir.getFileHandle("index.html", { create: true });
    const htmlWritable = await htmlFile.createWritable();
    await htmlWritable.write(htmlContent);
    await htmlWritable.close();

    // 复制视频文件
    if (videoFile) {
      const videoFileHandle = await projectDir.getFileHandle("video.mp4", { create: true });
      const videoWritable = await videoFileHandle.createWritable();
      await videoWritable.write(videoFile);
      await videoWritable.close();
    }

    // 导出 GLB 文件
    for (const model of project.models) {
      if (model.type !== "custom") continue;
      const glbData = await getModelGlbData(model);
      if (!glbData) continue;
      const glbFileHandle = await projectDir.getFileHandle(`${model.id}.glb`, { create: true });
      const glbWritable = await glbFileHandle.createWritable();
      await glbWritable.write(glbData);
      await glbWritable.close();
    }

    ElMessage.success(`播放器已导出到目录: ${project.title}`);
  } catch (error: any) {
    if (error?.name === "AbortError") return;
    console.error("导出失败:", error);
    await exportAsSingleHtml(project, videoFile);
  }
}

/**
 * 导出为单个 HTML 文件
 */
async function exportAsSingleHtml(project: ProjectDetail, videoFile?: File): Promise<void> {
  // 将视频转为 Base64
  let videoDataUrl = "";
  if (videoFile) {
    videoDataUrl = await fileToDataURL(videoFile);
    if (videoFile.size > 200 * 1024 * 1024) {
      console.warn("视频文件较大，可能导致导出文件过大");
    }
  } else if (project.videoSrc?.startsWith("blob:")) {
    // 尝试从 Blob URL 获取数据
    try {
      const response = await fetch(project.videoSrc);
      const blob = await response.blob();
      videoDataUrl = await blobToDataURL(blob);
    } catch {
      console.warn("无法从 Blob URL 获取视频数据");
    }
  } else if (project.videoSrc?.startsWith("http")) {
    // 远程视频保持 URL
    videoDataUrl = project.videoSrc;
  }

  // 生成 HTML
  const modelsPayload = await buildModelsExportPayload(project, true);
  const htmlContent = generatePlayerHtml(project, modelsPayload, videoDataUrl);

  // 下载文件
  const blob = new Blob([htmlContent], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.title}.html`;
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success(`播放器已导出: ${project.title}.html`);
}

/**
 * 生成播放器 HTML 内容
 */
function generatePlayerHtml(
  project: ProjectDetail,
  modelsPayload: Awaited<ReturnType<typeof buildModelsExportPayload>>,
  videoDataUrl?: string
): string {
  const chaptersJson = JSON.stringify(project.chapters);
  const modelsJson = JSON.stringify(modelsPayload);
  const subtitlesJson = JSON.stringify(project.subtitles);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f0f14; color: #e0e0e0; font-family: sans-serif; overflow: hidden; }
    #container { width: 100vw; height: 100vh; position: relative; }
    #video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0.3; }
    #canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
    #subtitle { position: absolute; bottom: 98px; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: 4px; font-size: 18px; display: none; text-align: center; max-width: min(80%, calc(100% - 40px)); box-sizing: border-box; word-break: break-word; overflow-wrap: break-word; white-space: pre-wrap; line-height: 1.5; }
    #controls { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 12px; }
    #progress { position: absolute; bottom: 60px; left: 20px; right: 20px; height: 8px; background: #eceef2; border-radius: 4px; }
    #progress-bar { height: 100%; background: #1dbf73; border-radius: 4px; width: 0; }
    button { padding: 12px 24px; background: #5b8def; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background: #7aa8ff; }
    .chapter-btn { background: transparent; border: 1px solid #5b8def; }
  </style>
</head>
<body>
  <div id="container">
    <video id="video" src="${videoDataUrl || "video.mp4"}"></video>
    <canvas id="canvas"></canvas>
    <div id="subtitle"></div>
    <div id="progress"><div id="progress-bar"></div></div>
    <div id="controls">
      <button id="play-btn">播放</button>
      <div id="chapter-btns"></div>
    </div>
  </div>
  <script type="importmap">
    { "imports": { "three": "https://unpkg.com/three@0.160.0/build/three.module.js", "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/" } }
  </script>
  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

    const CHAPTERS = ${chaptersJson};
    const MODELS = ${modelsJson};
    const SUBTITLES = ${subtitlesJson};
    const ANIMATION_SPEED = ${ANIMATION.SUBTITLE_TYPewriter_SPEED};

    // Initialize scene
    const canvas = document.getElementById('canvas');
    const video = document.getElementById('video');
    const subtitleEl = document.getElementById('subtitle');
    const progressBar = document.getElementById('progress-bar');
    const playBtn = document.getElementById('play-btn');
    const chapterBtns = document.getElementById('chapter-btns');

    let scene, camera, renderer, controls, gltfLoader;
    let meshes = new Map();
    let currentChapterIndex = 0;
    let animationMixers = [];

    function init() {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0f0f14);

      camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(6, 4, 8);

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 0.5, 0);
      controls.enableDamping = true;

      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.position.set(5, 10, 7.5);
      scene.add(light);

      gltfLoader = new GLTFLoader();
      // Draco support for compressed models in exported player (uses CDN decoders)
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
      gltfLoader.setDRACOLoader(dracoLoader);
      gltfLoader.setMeshoptDecoder(MeshoptDecoder);

      // Load models
      MODELS.forEach(m => loadModel(m));

      // Create chapter buttons
      CHAPTERS.forEach((ch, i) => {
        const btn = document.createElement('button');
        btn.className = 'chapter-btn';
        btn.textContent = ch.name;
        btn.onclick = () => jumpToChapter(i);
        chapterBtns.appendChild(btn);
      });

      animate();
    }

    async function loadModel(model) {
      let mesh;
      if (model.type === 'custom' && model.url) {
        const gltf = await gltfLoader.loadAsync(model.url);
        mesh = gltf.scene;
        mesh.userData.animations = gltf.animations;
      } else {
        mesh = createPrimitive(model);
      }
      scene.add(mesh);
      meshes.set(model.id, mesh);
    }

    function createPrimitive(model) {
      const geometries = {
        cube: new THREE.BoxGeometry(1,1,1),
        sphere: new THREE.SphereGeometry(0.5,32,32),
        cylinder: new THREE.CylinderGeometry(0.5,0.5,1,32),
        torus: new THREE.TorusGeometry(0.4,0.15,16,48),
        cone: new THREE.ConeGeometry(0.5,1,32),
        dodecahedron: new THREE.DodecahedronGeometry(0.5)
      };
      const geometry = geometries[model.type] || geometries.cube;
      const material = new THREE.MeshStandardMaterial({ color: model.color, metalness: 0.3, roughness: 0.7 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...model.basePosition);
      return mesh;
    }

    function animate() {
      requestAnimationFrame(animate);
      controls.update();

      // Update progress
      progressBar.style.width = (video.currentTime / video.duration * 100) + '%';

      // Check chapters
      const ch = CHAPTERS[currentChapterIndex];
      if (ch && video.currentTime >= ch.startTime && video.currentTime < ch.endTime) {
        applyChapterConfig(ch);
      }

      // Check subtitles
      const sub = SUBTITLES.find(s => video.currentTime >= s.startTime && video.currentTime < s.endTime);
      if (sub) {
        showSubtitle(sub);
      } else {
        subtitleEl.style.display = 'none';
      }

      // Animate mixers
      animationMixers.forEach(m => m.update(0.016));

      renderer.render(scene, camera);
    }

    function applyChapterConfig(chapter) {
      // Camera
      const [px, py, pz] = chapter.camera.position;
      const [tx, ty, tz] = chapter.camera.target;
      camera.position.set(px, py, pz);
      controls.target.set(tx, ty, tz);
      camera.fov = chapter.camera.fov;
      camera.updateProjectionMatrix();

      // Models
      Object.entries(chapter.modelConfigs).forEach(([id, config]) => {
        const mesh = meshes.get(id);
        if (mesh) {
          mesh.visible = config.visible;
          mesh.scale.setScalar(config.scale);
          mesh.position.set(
            mesh.userData.basePos[0] + config.posOffset[0],
            mesh.userData.basePos[1] + config.posOffset[1],
            mesh.userData.basePos[2] + config.posOffset[2]
          );
        }
      });
    }

    function showSubtitle(sub) {
      subtitleEl.style.display = 'block';
      subtitleEl.style.color = sub.color;
      subtitleEl.style.backgroundColor = sub.backgroundColor ?? '${SUBTITLE_DEFAULT_BACKGROUND}';
      if (sub.displayMode === 'typewriter') {
        typewriterEffect(sub.text);
      } else {
        subtitleEl.textContent = sub.text;
      }
    }

    function typewriterEffect(text) {
      subtitleEl.textContent = '';
      let i = 0;
      const timer = setInterval(() => {
        if (i < text.length) {
          subtitleEl.textContent += text[i];
          i++;
        } else {
          clearInterval(timer);
        }
      }, ANIMATION_SPEED);
    }

    function jumpToChapter(index) {
      currentChapterIndex = index;
      video.currentTime = CHAPTERS[index].startTime;
    }

    playBtn.onclick = () => {
      if (video.paused) {
        video.play();
        playBtn.textContent = '暂停';
      } else {
        video.pause();
        playBtn.textContent = '播放';
      }
    };

    window.onresize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    init();
  </script>
</body>
</html>`;
}

// Utility functions
async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function arrayBufferToDataURL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:application/octet-stream;base64,${btoa(binary)}`;
}
