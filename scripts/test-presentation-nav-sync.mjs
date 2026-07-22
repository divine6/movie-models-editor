/**
 * Pure regression for the presentation PlaybackSession contract.
 */

const session = {
  phase: "paused",
  intent: "pause",
  committedTime: 0,
  targetTime: 0,
  navChapterId: "a",
  playableChapterId: "a",
  requestId: 0,
  autoAdvance: false
};

function command(targetTime, intent, navChapterId) {
  Object.assign(session, {
    phase: "seeking",
    intent,
    targetTime,
    navChapterId,
    playableChapterId: navChapterId,
    requestId: session.requestId + 1,
    autoAdvance: intent === "play"
  });
  return session.requestId;
}

function settle(requestId, mediaTime, paused) {
  if (requestId !== session.requestId) return false;
  const rollback =
    session.targetTime > 0.45 &&
    mediaTime < 0.4 &&
    Math.abs(mediaTime - session.targetTime) > 0.5;
  session.committedTime = rollback ? session.targetTime : mediaTime;
  session.phase = session.intent === "play" && !paused ? "playing" : "paused";
  return true;
}

function displayTime() {
  return session.phase === "seeking" ? session.targetTime : session.committedTime;
}

let passed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
    return;
  }
  passed++;
  console.log("OK:", message);
}

const pausedNav = command(4, "pause", "b");
assert(displayTime() === 4, "paused navigation immediately displays its target");
settle(pausedNav, 4.01, true);
assert(session.phase === "paused", "paused navigation remains paused after seek");
assert(session.committedTime === 4.01, "successful seek commits media time");

const playFromLatest = command(displayTime(), "play", "b");
assert(session.targetTime === 4.01, "play starts from the latest committed position");
settle(playFromLatest, 4.15, false);
assert(session.phase === "playing", "play effect enters playing after media starts");
assert(session.committedTime === 4.15, "playing media advances committed time");

const stale = command(8, "play", "c");
const latest = command(4, "play", "b");
assert(settle(stale, 8.1, false) === false, "stale async completion is ignored");
assert(session.navChapterId === "b", "stale completion cannot change latest chapter");
assert(settle(latest, 4.1, false) === true, "latest async completion is accepted");

const rollbackRequest = command(8, "play", "c");
settle(rollbackRequest, 0, false);
assert(session.committedTime === 8, "failed seek rollback zero cannot replace a nonzero target");
assert(displayTime() === 8, "UI remains at target after rollback zero");

const pauseRequest = command(8, "pause", "c");
settle(pauseRequest, 8, true);
const unexpectedPlayEventRequest = session.requestId - 1;
assert(
  settle(unexpectedPlayEventRequest, 8.2, false) === false && session.intent === "pause",
  "old play event cannot override latest pause intent"
);

console.log(`\n${passed} assertions passed`);
