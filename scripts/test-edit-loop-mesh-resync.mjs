/**
 * 回归：编辑态视频循环 / 切章时 mesh 必须走「整树重置」而非仅 anim-only。
 * 这些纯函数规则与 useMovieEditor.ts 中的判定保持一致。
 */

function detectVideoLoopRewind(lastVideoPlaybackSyncTime, t) {
  return lastVideoPlaybackSyncTime > 0.2 && t + 0.25 < lastVideoPlaybackSyncTime;
}

function needsFullResync({ loopRewind, chapterChanged, elapsedRegressed }) {
  return loopRewind || chapterChanged || elapsedRegressed;
}

function elapsedRegressedFn({ chapterChanged, loopRewind, editPlaybackSyncElapsed, elapsed, eps = 1e-3 }) {
  return (
    !chapterChanged &&
    !loopRewind &&
    editPlaybackSyncElapsed > eps &&
    elapsed + eps < editPlaybackSyncElapsed
  );
}

function shouldSkipEditorVisualStateOnChapterWatch({ viewOnly, isPreview, videoPaused }) {
  if (viewOnly || isPreview) return true; // preview never applies this block
  // 仅以视频是否在播为准；停播后残留 chapterPlayTarget 不得挡住起始帧恢复
  return !videoPaused;
}

let passed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
    return;
  }
  passed++;
  console.log("OK:", msg);
}

// 1) 片尾→0 必须识别为 loop rewind
assert(detectVideoLoopRewind(4.9, 0) === true, "t=0 after 4.9 is loop rewind");
assert(detectVideoLoopRewind(4.9, 4.8) === false, "small backward jitter is not loop rewind");
assert(detectVideoLoopRewind(-1, 0) === false, "unset last time is not rewind");
assert(detectVideoLoopRewind(Number.POSITIVE_INFINITY, 0) === true, "forced Infinity last marks rewind");

// 2) 同章时间回退也要整树重置（seek / 循环漏检兜底）
{
  const chapterChanged = false;
  const loopRewind = false;
  const elapsedRegressed = elapsedRegressedFn({
    chapterChanged,
    loopRewind,
    editPlaybackSyncElapsed: 2.8,
    elapsed: 0
  });
  assert(elapsedRegressed === true, "elapsed 2.8→0 requires full resync");
  assert(
    needsFullResync({ loopRewind, chapterChanged, elapsedRegressed }) === true,
    "needsFullResync true on elapsed regress"
  );
}

// 3) 切章必须整树重置（否则上一章未在本章配置的子部件残留）
assert(
  needsFullResync({ loopRewind: false, chapterChanged: true, elapsedRegressed: false }) === true,
  "chapter change requires full resync"
);

// 4) 正常前进只做 anim-only
{
  const loopRewind = false;
  const chapterChanged = false;
  const elapsedRegressed = elapsedRegressedFn({
    chapterChanged,
    loopRewind,
    editPlaybackSyncElapsed: 1.0,
    elapsed: 1.05
  });
  assert(elapsedRegressed === false, "forward playback is not regress");
  assert(
    needsFullResync({ loopRewind, chapterChanged, elapsedRegressed }) === false,
    "forward playback does not full resync"
  );
}

// 5) 编辑态播放中切 selectedChapterId 禁止套编辑起始帧（预览无此路径故正常）
assert(
  shouldSkipEditorVisualStateOnChapterWatch({
    viewOnly: false,
    isPreview: false,
    videoPaused: false
  }) === true,
  "edit playback must skip applyChapterEditorVisualState"
);
assert(
  shouldSkipEditorVisualStateOnChapterWatch({
    viewOnly: false,
    isPreview: false,
    videoPaused: true
  }) === false,
  "paused edit may apply editor visual state"
);
assert(
  shouldSkipEditorVisualStateOnChapterWatch({
    viewOnly: false,
    isPreview: true,
    videoPaused: false
  }) === true,
  "preview never uses edit watch mesh path"
);

console.log(`\n${passed} assertions passed`);
