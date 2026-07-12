// Web Worker: chạy toàn bộ việc tải mô hình AI + nhận diện giọng nói ở một luồng
// riêng biệt, tách khỏi luồng chính của trang. Nếu không làm vậy, việc AI tính
// toán sẽ làm "đơ" toàn bộ giao diện vì JavaScript trên luồng chính không thể
// vừa tính toán nặng vừa vẽ lại màn hình cùng lúc.
//
// Dùng whisper-tiny (nhẹ, xử lý nhanh hơn nhiều so với whisper-base) và tự chia
// audio thành từng đoạn 30 giây, xử lý và báo tiến trình theo từng đoạn — để
// người dùng luôn biết chắc app đang chạy, không phải bị treo.

const MODEL_ID = "Xenova/whisper-tiny";
const SAMPLE_RATE = 16000;
const CHUNK_SECONDS = 30;

let transcriberPromise = null;
let deviceUsed = "wasm";

async function importTransformersWithRetry(maxAttempts = 3) {
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await import("@xenova/transformers");
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

async function getTranscriber(onProgress) {
  if (transcriberPromise) return transcriberPromise;
  transcriberPromise = (async () => {
    const { pipeline } = await importTransformersWithRetry();
    // Thử WebGPU trước (nhanh hơn nhiều lần nhờ card đồ họa), nếu trình duyệt/máy
    // không hỗ trợ thì tự động lùi về chạy bằng CPU (wasm) — không báo lỗi cho
    // người dùng, chỉ âm thầm chuyển phương án.
    try {
      const p = await pipeline("automatic-speech-recognition", MODEL_ID, {
        device: "webgpu",
        progress_callback: onProgress,
      });
      deviceUsed = "webgpu";
      return p;
    } catch (e) {
      const p = await pipeline("automatic-speech-recognition", MODEL_ID, {
        progress_callback: onProgress,
      });
      deviceUsed = "wasm";
      return p;
    }
  })().catch((e) => {
    transcriberPromise = null; // cho phép thử lại lần sau thay vì kẹt lỗi mãi mãi
    throw e;
  });
  return transcriberPromise;
}

function splitAudio(float32Array) {
  const chunkSize = CHUNK_SECONDS * SAMPLE_RATE;
  const chunks = [];
  for (let i = 0; i < float32Array.length; i += chunkSize) {
    chunks.push({
      data: float32Array.slice(i, i + chunkSize),
      offsetSec: i / SAMPLE_RATE,
    });
  }
  return chunks.length ? chunks : [{ data: float32Array, offsetSec: 0 }];
}

self.onmessage = async (e) => {
  const { type, audioData } = e.data || {};
  if (type !== "transcribe") return;

  try {
    const transcriber = await getTranscriber((p) => {
      self.postMessage({ type: "progress", payload: p });
    });
    self.postMessage({ type: "device", payload: deviceUsed });

    const chunks = splitAudio(audioData);
    self.postMessage({ type: "chunkTotal", payload: chunks.length });

    const allCues = [];
    for (let i = 0; i < chunks.length; i++) {
      self.postMessage({ type: "chunkProgress", payload: { index: i + 1, total: chunks.length } });
      const result = await transcriber(chunks[i].data, {
        language: "chinese",
        task: "transcribe",
        return_timestamps: true,
      });
      const subChunks =
        (result && result.chunks) ||
        (result && result.text ? [{ text: result.text, timestamp: [0, chunks[i].data.length / SAMPLE_RATE] }] : []);
      subChunks.forEach((c) => {
        if (!c.text || !c.text.trim()) return;
        const start = chunks[i].offsetSec + ((c.timestamp && c.timestamp[0]) || 0);
        const end = chunks[i].offsetSec + ((c.timestamp && c.timestamp[1]) || ((c.timestamp && c.timestamp[0]) || 0) + 3);
        allCues.push({ start, end, text: c.text.trim() });
      });
    }
    self.postMessage({ type: "done", payload: allCues });
  } catch (err) {
    self.postMessage({ type: "error", payload: (err && err.message) || "Lỗi không rõ khi chạy AI." });
  }
};

