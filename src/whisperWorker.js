// Web Worker: chạy toàn bộ việc tải mô hình AI + nhận diện giọng nói ở một luồng
// riêng biệt, tách khỏi luồng chính của trang. Nếu không làm vậy, việc AI tính
// toán sẽ làm "đơ" toàn bộ giao diện (đúng lỗi "This page isn't responding" gặp
// phải) vì JavaScript trên luồng chính không thể vừa tính toán nặng vừa vẽ lại
// màn hình cùng lúc.

let transcriberPromise = null;

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
    return pipeline("automatic-speech-recognition", "Xenova/whisper-base", {
      progress_callback: onProgress,
    });
  })().catch((e) => {
    transcriberPromise = null; // cho phép thử lại lần sau thay vì kẹt lỗi mãi mãi
    throw e;
  });
  return transcriberPromise;
}

self.onmessage = async (e) => {
  const { type, audioData } = e.data || {};
  if (type !== "transcribe") return;

  try {
    const transcriber = await getTranscriber((p) => {
      self.postMessage({ type: "progress", payload: p });
    });
    self.postMessage({ type: "status", payload: "transcribing" });
    const output = await transcriber(audioData, {
      language: "chinese",
      task: "transcribe",
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    self.postMessage({ type: "done", payload: output });
  } catch (err) {
    self.postMessage({ type: "error", payload: (err && err.message) || "Lỗi không rõ khi chạy AI." });
  }
};
