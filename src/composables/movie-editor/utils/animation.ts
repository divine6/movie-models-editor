export function roundAnimNum(n: number, decimals = 3) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

let animSegIdCounter = 0;

export function nextAnimSegmentId() {
  return `seg_${++animSegIdCounter}`;
}

export function mapStoredAnimSegment(s: {
  id?: string;
  pauseTime?: number;
  animTime?: number;
  easing?: string;
  pivot?: string;
  startPos: number[];
  endPos: number[];
  startScale: number;
  endScale: number;
  startRot: number[];
  endRot: number[];
  _expandedPanels?: string[];
}) {
  return {
    id: s.id || nextAnimSegmentId(),
    pauseTime: s.pauseTime || 0,
    animTime: s.animTime || 3,
    easing: s.easing || "easeInOut",
    pivot: s.pivot || "center",
    startPos: [...s.startPos],
    endPos: [...s.endPos],
    startScale: s.startScale,
    endScale: s.endScale,
    startRot: [...s.startRot],
    endRot: [...s.endRot],
    _expandedPanels: s._expandedPanels || ["start", "end"]
  };
}
