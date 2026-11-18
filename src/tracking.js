import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// Body points: 0 nose, 11/12 shoulders, 13/14 elbows, 15/16 wrists,
// 23/24 hips, 25/26 knees, 27/28 ankles
export const UPPER_BODY = [0, 11, 12, 13, 14, 15, 16];
export const FULL_BODY = [0, 11, 12, 23, 24, 25, 26, 27, 28];

export async function createTracker({ useGpu = false } = {}) {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  );
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      delegate: useGpu ? 'GPU' : 'CPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
}

export async function startCamera(video) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, frameRate: { ideal: 30 }, facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  await new Promise((resolve) => video.addEventListener('loadeddata', resolve, { once: true }));
}

// Calms small shakes but keeps fast movements responsive.
export function makeSmoother() {
  let prev = null;
  return {
    apply(landmarks) {
      if (!prev) {
        prev = landmarks.map((p) => ({ ...p }));
        return prev;
      }
      prev = landmarks.map((p, i) => {
        const q = prev[i];
        const dist = Math.hypot(p.x - q.x, p.y - q.y);
        const alpha = Math.min(0.15 + dist * 10, 0.8);
        return { ...p, x: q.x + alpha * (p.x - q.x), y: q.y + alpha * (p.y - q.y) };
      });
      return prev;
    },
    reset() {
      prev = null;
    },
  };
}

export function isVisible(lm, indices) {
  return indices.every((i) => {
    const p = lm[i];
    return (p.visibility ?? 1) > 0.5 && p.x > 0.02 && p.x < 0.98 && p.y > 0.02 && p.y < 0.98;
  });
}