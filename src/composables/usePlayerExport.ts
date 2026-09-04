/**
 * 播放器导出
 * 从原始 MovieModelEditor 的 playerGenerator.js 迁移
 */

import { ElMessage } from "element-plus";

import { type Model, type ProjectDetail, type SceneVideoNode, SUBTITLE_DEFAULT_BACKGROUND } from "@/interface/project";
import { ensureProjectNodes } from "@/utils/sceneMigration";
import { getVideoAnimations, getVideoNodes } from "@/utils/sceneNodeTree";
import { ANIMATION } from "@/utils/three/constants";

type ModelsPayload = Awaited<ReturnType<typeof buildModelsExportPayload>>;
type VideosPayload = Awaited<ReturnType<typeof buildVideosExportPayload>>;

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

async function buildModelsExportPayload(project: ProjectDetail, mode: "source" | "inline" | "directory") {
  return Promise.all(
    project.models.map(async m => {
      let url = m.url;
      if (m.type === "custom" && mode !== "source") {
        const glbData = await getModelGlbData(m);
        if (glbData) {
          url = mode === "inline" ? arrayBufferToDataURL(glbData) : `models/${safeFilePart(m.id)}.glb`;
        }
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

function safeFilePart(value: string): string {
  return (value || "asset").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 120);
}

function extensionForVideo(node: SceneVideoNode, blob?: Blob): string {
  const mime = blob?.type || "";
  const mimeExt: Record<string, string> = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/ogg": "ogv",
    "video/quicktime": "mov"
  };
  if (mimeExt[mime]) return mimeExt[mime];
  const path = (node.videoPath || node.videoSrc || "").split(/[?#]/)[0];
  const match = path.match(/\.([a-z0-9]{2,5})$/i);
  return match?.[1]?.toLowerCase() || "mp4";
}

async function sourceToBlob(source?: string | null): Promise<Blob | null> {
  if (!source) return null;
  try {
    const response = await fetch(source);
    if (!response.ok) return null;
    return response.blob();
  } catch {
    return null;
  }
}

async function resolveVideoBlob(node: SceneVideoNode, fallbackFile?: File): Promise<Blob | null> {
  if (fallbackFile) return fallbackFile;
  return sourceToBlob(node.videoSrc);
}

async function buildVideosExportPayload(
  project: ProjectDetail,
  mode: "source" | "inline" | "directory",
  legacyVideoFile?: File,
  onDirectoryAsset?: (filename: string, blob: Blob) => Promise<void>
) {
  const videos = getVideoNodes(project.nodes);
  return Promise.all(
    videos.map(async (video, index) => {
      const fallbackFile = index === 0 ? legacyVideoFile : undefined;
      let src = video.videoSrc || "";
      if (mode !== "source") {
        const blob = await resolveVideoBlob(video, fallbackFile);
        if (blob) {
          if (mode === "inline") {
            src = await blobToDataURL(blob);
          } else {
            const filename = `${safeFilePart(video.id)}.${extensionForVideo(video, blob)}`;
            await onDirectoryAsset?.(filename, blob);
            src = `videos/${filename}`;
          }
        } else if (fallbackFile && mode === "inline") {
          src = await fileToDataURL(fallbackFile);
        }
      }
      const animations = getVideoAnimations(project.nodes, video.id);
      const animationIds = new Set(animations.map(animation => animation.id));
      return {
        id: video.id,
        name: video.name,
        src,
        duration: video.videoDuration,
        animations,
        subtitles: project.subtitles.filter(
          subtitle => subtitle.parentNodeId === video.id || animationIds.has(subtitle.parentNodeId)
        )
      };
    })
  );
}

/**
 * 导出独立播放器
 */
export async function exportPlayer(project: ProjectDetail, videoFile?: File): Promise<void> {
  const normalizedProject = ensureProjectNodes(project) ?? project;
  // 检查 File System Access API 支持
  if ("showDirectoryPicker" in window) {
    await exportToDirectory(normalizedProject, videoFile);
  } else {
    await exportAsSingleHtml(normalizedProject, videoFile);
  }
}

/**
 * 导出到目录（File System Access API）
 */
async function exportToDirectory(project: ProjectDetail, videoFile?: File): Promise<void> {
  try {
    ensureProjectNodes(project);
    const dirHandle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
    const projectDir = await dirHandle.getDirectoryHandle(project.title, { create: true });

    const videoDir = await projectDir.getDirectoryHandle("videos", { create: true });
    const videosPayload = await buildVideosExportPayload(project, "directory", videoFile, async (filename, blob) => {
      const handle = await videoDir.getFileHandle(filename, { create: true });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    });

    const modelDir = await projectDir.getDirectoryHandle("models", { create: true });
    const modelsPayload = await buildModelsExportPayload(project, "directory");
    for (const model of project.models) {
      if (model.type !== "custom") continue;
      const glbData = await getModelGlbData(model);
      if (!glbData) continue;
      const handle = await modelDir.getFileHandle(`${safeFilePart(model.id)}.glb`, { create: true });
      const writable = await handle.createWritable();
      await writable.write(glbData);
      await writable.close();
    }

    const htmlContent = generatePlayerHtml(project, modelsPayload, videosPayload);
    const htmlFile = await projectDir.getFileHandle("index.html", { create: true });
    const htmlWritable = await htmlFile.createWritable();
    await htmlWritable.write(htmlContent);
    await htmlWritable.close();

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
  ensureProjectNodes(project);
  if (videoFile && videoFile.size > 200 * 1024 * 1024) {
    console.warn("视频文件较大，可能导致导出文件过大");
  }
  const [modelsPayload, videosPayload] = await Promise.all([
    buildModelsExportPayload(project, "inline"),
    buildVideosExportPayload(project, "inline", videoFile)
  ]);
  const htmlContent = generatePlayerHtml(project, modelsPayload, videosPayload);

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
export function generatePlayerHtml(project: ProjectDetail, modelsPayload: ModelsPayload, videosPayload: VideosPayload): string {
  const modelsJson = safeJson(modelsPayload);
  const videosJson = safeJson(videosPayload);
  const title = escapeHtml(project.title);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f0f14; color: #e0e0e0; font-family: sans-serif; overflow: hidden; }
    #container { width: 100vw; height: 100vh; position: relative; }
    #video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0.3; }
    #canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
    #subtitle { position: absolute; bottom: 98px; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: 4px; font-size: 18px; display: none; text-align: center; max-width: min(80%, calc(100% - 40px)); box-sizing: border-box; word-break: break-word; overflow-wrap: break-word; white-space: pre-wrap; line-height: 1.5; }
    #intro { position: absolute; top: 24px; right: 24px; max-width: 340px; padding: 10px 14px; border-radius: 6px; background: rgba(15,15,20,.78); display: none; white-space: pre-wrap; }
    #controls { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; max-width: calc(100% - 40px); flex-wrap: wrap; justify-content: center; }
    #progress { position: absolute; bottom: 60px; left: 20px; right: 20px; height: 8px; background: #eceef2; border-radius: 4px; }
    #progress-bar { height: 100%; background: #1dbf73; border-radius: 4px; width: 0; }
    button { padding: 9px 14px; background: #5b8def; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background: #7aa8ff; }
    .animation-btn, .video-btn { background: rgba(15,15,20,.65); border: 1px solid #5b8def; }
    .active { background: #1dbf73; border-color: #1dbf73; }
  </style>
</head>
<body>
  <div id="container">
    <video id="video" playsinline></video>
    <canvas id="canvas"></canvas>
    <div id="subtitle"></div>
    <div id="intro"></div>
    <div id="progress"><div id="progress-bar"></div></div>
    <div id="controls">
      <button id="play-btn">播放</button>
      <div id="video-btns"></div>
      <div id="animation-btns"></div>
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

    const MODELS = ${modelsJson};
    const VIDEOS = ${videosJson};
    const ANIMATION_SPEED = ${ANIMATION.SUBTITLE_TYPewriter_SPEED};

    const canvas = document.getElementById('canvas');
    const video = document.getElementById('video');
    const subtitleEl = document.getElementById('subtitle');
    const introEl = document.getElementById('intro');
    const progressBar = document.getElementById('progress-bar');
    const playBtn = document.getElementById('play-btn');
    const videoBtns = document.getElementById('video-btns');
    const animationBtns = document.getElementById('animation-btns');

    let scene, camera, renderer, controls, gltfLoader;
    const meshes = new Map();
    const pivotCaches = new WeakMap();
    const animationMixers = [];
    const clock = new THREE.Clock();
    let currentVideoIndex = 0;
    let playbackCameraOrigin = null;
    let lastSampleScope = '';
    let lastSampleTime = -1;
    let activeSubtitleId = null;
    let typewriterTimer = null;

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
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
      gltfLoader.setDRACOLoader(dracoLoader);
      gltfLoader.setMeshoptDecoder(MeshoptDecoder);

      MODELS.forEach(m => loadModel(m));
      VIDEOS.forEach((item, index) => {
        const btn = document.createElement('button');
        btn.className = 'video-btn';
        btn.textContent = item.name || ('视频 ' + (index + 1));
        btn.onclick = () => switchVideo(index);
        videoBtns.appendChild(btn);
      });
      if (VIDEOS.length) switchVideo(0);
      animate();
    }

    async function loadModel(model) {
      let mesh;
      if (model.type === 'custom' && model.url) {
        try {
          const gltf = await gltfLoader.loadAsync(model.url);
          mesh = gltf.scene;
          mesh.userData.animations = gltf.animations;
        } catch (error) {
          console.error('模型加载失败:', model.name || model.id, error);
          return;
        }
      } else {
        mesh = createPrimitive(model);
      }
      const base = model.basePosition || [0, 0, 0];
      mesh.position.set(base[0], base[1], base[2]);
      mesh.userData.basePos = base.slice();
      mesh.userData.modelId = model.id;
      registerHierarchy(mesh, model.id);
      scene.add(mesh);
      meshes.set(model.id, mesh);
      const animations = mesh.userData.animations || [];
      if (animations.length) {
        const mixer = new THREE.AnimationMixer(mesh);
        animations.forEach(clip => mixer.clipAction(clip).play());
        animationMixers.push(mixer);
      }
    }

    function registerHierarchy(root, modelId) {
      function walk(obj, parentPath, childIndex) {
        const rawName = (obj.name || '').trim() || (obj.isMesh ? 'Mesh' : obj.type === 'Bone' ? 'Bone' : obj.type === 'Group' ? 'Group' : obj.type || 'Object');
        const segment = (obj.name || '').trim() ? rawName : childIndex > 0 ? rawName + '_' + childIndex : rawName;
        const path = parentPath ? parentPath + '/' + segment + '#' + childIndex : segment;
        obj.userData.nodeId = modelId + '::' + path;
        obj.userData.baseLocalPos = [obj.position.x, obj.position.y, obj.position.z];
        obj.userData.baseLocalRot = [obj.rotation.x, obj.rotation.y, obj.rotation.z];
        obj.userData.baseLocalScale = obj.scale.x;
        obj.children.forEach((child, index) => walk(child, path, index));
      }
      walk(root, '', 0);
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
      return new THREE.Mesh(geometry, material);
    }

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : (currentVideo()?.duration || 0);
      progressBar.style.width = duration > 0 ? Math.min(100, video.currentTime / duration * 100) + '%' : '0%';
      sampleCurrentFrame();
      const delta = clock.getDelta();
      animationMixers.forEach(m => m.update(delta));
      renderer.render(scene, camera);
    }

    function currentVideo() {
      return VIDEOS[currentVideoIndex] || null;
    }

    function currentAnimation() {
      const item = currentVideo();
      if (!item) return null;
      return item.animations.find(ch => video.currentTime >= ch.startTime - 0.0001 && video.currentTime < ch.endTime) || null;
    }

    function switchVideo(index) {
      const item = VIDEOS[index];
      if (!item) return;
      playbackCameraOrigin = camera && controls ? {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [controls.target.x, controls.target.y, controls.target.z],
        fov: camera.fov
      } : null;
      currentVideoIndex = index;
      lastSampleScope = '';
      lastSampleTime = -1;
      video.pause();
      video.src = item.src || '';
      video.currentTime = 0;
      video.load();
      playBtn.textContent = '播放';
      [...videoBtns.children].forEach((btn, i) => btn.classList.toggle('active', i === index));
      animationBtns.innerHTML = '';
      item.animations.forEach(ch => {
        const btn = document.createElement('button');
        btn.className = 'animation-btn';
        btn.textContent = ch.name;
        btn.onclick = () => { video.currentTime = Math.max(0, ch.startTime || 0); sampleCurrentFrame(); };
        animationBtns.appendChild(btn);
      });
      clearSubtitle();
      sampleCurrentFrame();
    }

    function sampleCurrentFrame() {
      introEl.style.display = 'none';
      introEl.textContent = '';
      const item = currentVideo();
      const chapter = currentAnimation();
      const scope = (item ? item.id : '') + '|' + (chapter ? chapter.id : '');
      if (scope !== lastSampleScope || video.currentTime + 0.0001 < lastSampleTime) {
        resetModels();
      }
      lastSampleScope = scope;
      lastSampleTime = video.currentTime;
      [...animationBtns.children].forEach((btn, i) => btn.classList.toggle('active', !!chapter && item.animations[i].id === chapter.id));
      if (chapter) applyAnimation(chapter, Math.max(0, video.currentTime - chapter.startTime));
      sampleSubtitle(item, chapter);
    }

    function resetModels() {
      MODELS.forEach(model => {
        const root = meshes.get(model.id);
        if (!root) return;
        resetObject(root, true);
        root.traverse(obj => {
          if (obj !== root) resetObject(obj, false);
          resetMaterials(obj);
        });
      });
    }

    function resetObject(obj, root) {
      const pos = root ? (obj.userData.basePos || [0,0,0]) : (obj.userData.baseLocalPos || [obj.position.x,obj.position.y,obj.position.z]);
      const rot = root ? [0,0,0] : (obj.userData.baseLocalRot || [0,0,0]);
      const scale = root ? 1 : (obj.userData.baseLocalScale == null ? 1 : obj.userData.baseLocalScale);
      obj.position.set(pos[0], pos[1], pos[2]);
      obj.rotation.set(rot[0], rot[1], rot[2], 'XYZ');
      obj.scale.setScalar(scale);
      obj.visible = true;
    }

    function resetMaterials(obj) {
      if (!obj.isMesh) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach(mat => {
        if (!mat) return;
        if (!mat.userData.exportBase) {
          mat.userData.exportBase = {
            wireframe: !!mat.wireframe,
            color: mat.color ? mat.color.getHex() : null,
            emissive: mat.emissive ? mat.emissive.getHex() : null,
            emissiveIntensity: mat.emissiveIntensity
          };
        }
        const base = mat.userData.exportBase;
        mat.wireframe = base.wireframe;
        if (mat.color && base.color != null) mat.color.setHex(base.color);
        if (mat.emissive && base.emissive != null) mat.emissive.setHex(base.emissive);
        if (base.emissiveIntensity != null) mat.emissiveIntensity = base.emissiveIntensity;
      });
    }

    function applyAnimation(chapter, elapsed) {
      applyCamera(chapter, elapsed);
      // clips 为真相源：有 clips 时只采样 clips，禁止再走 modelConfigs.animConfig（避免双应用导致与编辑不一致）
      const hasClips = !!(chapter.clips && chapter.clips.length);
      Object.entries(chapter.modelConfigs || {}).forEach(([modelId, config]) => {
        const root = meshes.get(modelId);
        if (!root) return;
        applyConfig(root, config, true, elapsed, { skipAnim: hasClips });
        Object.entries(config.nodeConfigs || {}).forEach(([nodeId, nodeConfig]) => {
          const target = findTarget(root, nodeId);
          if (target) applyConfig(target, nodeConfig, false, elapsed, { skipAnim: hasClips });
        });
      });
      if (hasClips) {
        chapter.clips.forEach(clip => {
          (clip.targets || []).forEach(target => {
            const root = meshes.get(target.modelId);
            if (!root) return;
            const obj = target.nodeId ? findTarget(root, target.nodeId) : root;
            if (obj) sampleTarget(obj, clip, target, elapsed);
          });
        });
      }
    }

    function findTarget(root, nodeId) {
      let found = null;
      root.traverse(obj => {
        if (!found && (obj.userData.nodeId === nodeId || obj.userData.mergedNodeId === nodeId)) found = obj;
      });
      return found;
    }

    function applyConfig(obj, config, isRoot, elapsed, opts) {
      obj.visible = config.visible !== false;
      const skipAnim = !!(opts && opts.skipAnim);
      if (
        !skipAnim &&
        config.animation &&
        config.animConfig &&
        config.animConfig.segments &&
        config.animConfig.segments.length
      ) {
        sampleSegments(obj, config.animConfig.segments, elapsed);
      } else {
        const base = isRoot ? (obj.userData.basePos || [0,0,0]) : (obj.userData.baseLocalPos || [0,0,0]);
        const offset = config.posOffset || [0,0,0];
        obj.position.set(base[0] + offset[0], base[1] + offset[1], base[2] + offset[2]);
        obj.scale.setScalar(config.scale == null ? 1 : config.scale);
      }
      applyVisual(obj, config);
    }

    function sampleSegments(obj, segments, elapsed) {
      let cursor = 0;
      let previous = null;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const pause = finiteNonNegative(seg.pauseTime, 0);
        // legacy animConfig 缺省 3；与编辑器 mapStoredAnimSegment 对齐
        const anim = finiteNonNegative(seg.animTime, 3);
        const start = Number.isFinite(seg.start) ? Math.max(0, seg.start) : cursor + pause;
        const end = Number.isFinite(seg.end) ? Math.max(start, seg.end) : start + anim;
        if (elapsed < start) {
          if (previous) {
            applyPose(obj, previous, 1);
            applyVisual(obj, previous.clipVisual || {});
          }
          return;
        }
        if (anim === 0 && elapsed >= start) {
          applyPose(obj, seg, 1);
          applyVisual(obj, seg.clipVisual || {});
          previous = seg;
          cursor = Math.max(cursor, end);
          continue;
        }
        if (elapsed < end || (i === segments.length - 1 && elapsed <= end)) {
          const p = ease(clamp01((elapsed - start) / Math.max(end - start, anim, 0.000001)), seg.easing);
          applyPose(obj, seg, p);
          applyVisual(obj, seg.clipVisual || {});
          return;
        }
        previous = seg;
        cursor = Math.max(cursor, end);
      }
      if (previous) {
        applyPose(obj, previous, 1);
        applyVisual(obj, previous.clipVisual || {});
      }
    }

    function sampleTarget(obj, clip, target, elapsed) {
      const clipStart = Number.isFinite(clip.start) ? clip.start : 0;
      const clipEnd = Number.isFinite(clip.end) ? Math.max(clipStart, clip.end) : clipStart + finiteNonNegative(clip.animTime, 0.5);
      const start = Math.min(clipEnd, clipStart + finiteNonNegative(target.pauseTime, 0));
      const duration = Math.min(finiteNonNegative(target.animTime, 0.5), Math.max(0, clipEnd - start));
      if (elapsed < start) return;
      const p = duration === 0 ? 1 : ease(clamp01((elapsed - start) / duration), target.easing);
      applyPose(obj, target, p);
      applyVisual(obj, target.clipVisual || {});
    }

    function applyPose(obj, segment, p) {
      const startPos = segment.startPos || [0,0,0];
      const endPos = segment.endPos || startPos;
      const startRot = segment.startRot || [0,0,0];
      const endRot = segment.endRot || startRot;
      const startScale = segment.startScale == null ? 1 : segment.startScale;
      const endScale = segment.endScale == null ? startScale : segment.endScale;
      const pos = [lerp(startPos[0], endPos[0], p), lerp(startPos[1], endPos[1], p), lerp(startPos[2], endPos[2], p)];
      const rot = [lerp(startRot[0], endRot[0], p), lerp(startRot[1], endRot[1], p), lerp(startRot[2], endRot[2], p)];
      const scale = lerp(startScale, endScale, p);
      if (segment.pivot && segment.pivot !== 'center') {
        const cache = getPivotCache(obj, segment, startRot, endRot, startScale, endScale);
        const quaternion = quaternionFromDegrees(rot);
        const currentOffset = cache.local.clone().multiplyScalar(scale).applyQuaternion(quaternion);
        const interpolatedOffset = cache.startOffset.clone().lerp(cache.endOffset, p);
        obj.position.set(
          pos[0] + interpolatedOffset.x - currentOffset.x,
          pos[1] + interpolatedOffset.y - currentOffset.y,
          pos[2] + interpolatedOffset.z - currentOffset.z
        );
        obj.quaternion.copy(quaternion);
        obj.scale.setScalar(scale);
        return;
      }
      obj.position.set(pos[0], pos[1], pos[2]);
      obj.rotation.set(
        THREE.MathUtils.degToRad(rot[0]),
        THREE.MathUtils.degToRad(rot[1]),
        THREE.MathUtils.degToRad(rot[2]),
        'XYZ'
      );
      obj.scale.setScalar(scale);
    }

    function quaternionFromDegrees(rot) {
      return new THREE.Quaternion().setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(rot[0] || 0),
        THREE.MathUtils.degToRad(rot[1] || 0),
        THREE.MathUtils.degToRad(rot[2] || 0),
        'XYZ'
      ));
    }

    function getPivotCache(obj, segment, startRot, endRot, startScale, endScale) {
      let objectCache = pivotCaches.get(obj);
      if (!objectCache) {
        objectCache = new Map();
        pivotCaches.set(obj, objectCache);
      }
      const key = [segment.pivot, startRot, endRot, startScale, endScale].join('|');
      if (objectCache.has(key)) return objectCache.get(key);
      obj.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(obj);
      const world = box.getCenter(new THREE.Vector3());
      if (segment.pivot === 'top') world.y = box.max.y;
      else if (segment.pivot === 'bottom') world.y = box.min.y;
      else if (segment.pivot === 'left') world.x = box.min.x;
      else if (segment.pivot === 'right') world.x = box.max.x;
      else if (segment.pivot === 'front') world.z = box.max.z;
      else if (segment.pivot === 'back') world.z = box.min.z;
      const local = obj.worldToLocal(world.clone());
      const startOffset = local.clone().multiplyScalar(startScale).applyQuaternion(quaternionFromDegrees(startRot));
      const endOffset = local.clone().multiplyScalar(endScale).applyQuaternion(quaternionFromDegrees(endRot));
      const cache = { local, startOffset, endOffset };
      objectCache.set(key, cache);
      return cache;
    }

    function applyVisual(obj, visual) {
      if (visual.visible === false) obj.visible = false;
      else if (visual.visible === true) obj.visible = true;
      let intro = typeof visual.intro === 'string' ? visual.intro : '';
      if (intro) {
        introEl.textContent = intro;
        introEl.style.display = 'block';
      }
      obj.traverse(child => {
        resetMaterials(child);
        if (!child.isMesh) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(mat => {
          if (!mat) return;
          if (visual.wireframe != null) mat.wireframe = !!visual.wireframe;
          const color = visual.highlight
            ? (visual.modelHighlightColor || visual.highlightColor)
            : visual.outline
              ? visual.outlineColor
              : visual.wireframe
                ? visual.wireframeColor
                : null;
          if (color && mat.emissive) {
            mat.emissive.set(color);
            mat.emissiveIntensity = visual.highlight ? 0.75 : 0.35;
          } else if (color && mat.color && visual.wireframe) {
            mat.color.set(color);
          }
        });
      });
    }

    function applyCamera(chapter, elapsed) {
      const clips = chapter.clips || [];
      if (!clips.length) {
        setCamera(chapter.camera);
        return;
      }
      let active = clips[0];
      for (const clip of clips) {
        const start = Number.isFinite(clip.start) ? clip.start : 0;
        if (elapsed >= start) active = clip;
      }
      if (!active.camera) return;
      const index = clips.indexOf(active);
      let from = playbackCameraOrigin || chapter.camera || active.camera;
      for (let i = index - 1; i >= 0; i--) {
        if (clips[i].camera) { from = clips[i].camera; break; }
      }
      const start = Number.isFinite(active.start) ? active.start : 0;
      const end = Number.isFinite(active.end) ? Math.max(start, active.end) : start + finiteNonNegative(active.animTime, 0.5);
      const hasAuthoredTransition = typeof active.camera.transitionSec === 'number' && Number.isFinite(active.camera.transitionSec);
      const authored = hasAuthoredTransition ? Math.max(0, active.camera.transitionSec) : 0;
      const duration = hasAuthoredTransition
        ? Math.min(authored, Math.max(0, end - start))
        : Math.max(0, end - start);
      const p = duration === 0 ? 1 : easeInOutCubic(clamp01((elapsed - start) / duration));
      setCamera({
        position: from.position.map((value, i) => lerp(value, active.camera.position[i], p)),
        target: from.target.map((value, i) => lerp(value, active.camera.target[i], p)),
        fov: lerp(from.fov, active.camera.fov, p)
      });
    }

    function setCamera(config) {
      if (!config) return;
      camera.position.set(config.position[0], config.position[1], config.position[2]);
      controls.target.set(config.target[0], config.target[1], config.target[2]);
      camera.fov = config.fov;
      camera.updateProjectionMatrix();
      camera.lookAt(controls.target);
    }

    function sampleSubtitle(item, chapter) {
      if (!item) return clearSubtitle();
      const subtitle = item.subtitles.find(sub =>
        video.currentTime >= sub.startTime &&
        video.currentTime < sub.endTime &&
        (sub.parentNodeId === item.id || (!!chapter && sub.parentNodeId === chapter.id))
      );
      if (subtitle) showSubtitle(subtitle);
      else clearSubtitle();
    }

    function showSubtitle(sub) {
      subtitleEl.style.display = 'block';
      subtitleEl.style.color = sub.color;
      subtitleEl.style.backgroundColor = sub.backgroundColor ?? '${SUBTITLE_DEFAULT_BACKGROUND}';
      if (activeSubtitleId === sub.id) return;
      activeSubtitleId = sub.id;
      if (typewriterTimer) clearInterval(typewriterTimer);
      if (sub.displayMode === 'typewriter') {
        typewriterEffect(sub.text);
      } else {
        subtitleEl.textContent = sub.text;
      }
    }

    function typewriterEffect(text) {
      subtitleEl.textContent = '';
      let i = 0;
      typewriterTimer = setInterval(() => {
        if (i < text.length) {
          subtitleEl.textContent += text[i];
          i++;
        } else {
          clearInterval(typewriterTimer);
          typewriterTimer = null;
        }
      }, ANIMATION_SPEED);
    }

    function clearSubtitle() {
      subtitleEl.style.display = 'none';
      activeSubtitleId = null;
      if (typewriterTimer) {
        clearInterval(typewriterTimer);
        typewriterTimer = null;
      }
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

    video.onended = () => { playBtn.textContent = '播放'; };
    video.onseeked = sampleCurrentFrame;

    function finiteNonNegative(value, fallback) {
      return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
    }
    function clamp01(value) { return Math.max(0, Math.min(1, value)); }
    function lerp(a, b, p) { return a + (b - a) * p; }
    function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }
    function ease(t, type) {
      if (type === 'linear') return t;
      if (type === 'easeIn') return t * t;
      if (type === 'easeOut') return t * (2 - t);
      if (type === 'easeInOut') return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
      if (type === 'bounce') {
        if (t < 1/2.75) return 7.5625*t*t;
        if (t < 2/2.75) { t -= 1.5/2.75; return 7.5625*t*t + .75; }
        if (t < 2.5/2.75) { t -= 2.25/2.75; return 7.5625*t*t + .9375; }
        t -= 2.625/2.75; return 7.5625*t*t + .984375;
      }
      if (type === 'elastic') return t === 0 || t >= 1 ? t : Math.pow(2,-10*t)*Math.sin((t-.075)*(2*Math.PI)/.3)+1;
      return t;
    }

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

function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
