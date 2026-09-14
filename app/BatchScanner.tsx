"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";

function parseBatchFromOcr(text: string) {
  const cleaned = String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[|]/g, "I");

  const patterns = [
    /batch\s*#\s*(\d{4,12})/i,
    /batch\s*number\s*[:#]?\s*(\d{4,12})/i,
    /batch[#:\-\s]+(\d{4,12})/i,
    /b[a4]tch\s*[#8s]?\s*(\d{4,12})/i,
    /batch\s+summary\s+for[\s\S]{0,60}?(\d{4,12})/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

function boostContrast(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  const contrast = 1.5;
  const intercept = 128 * (1 - contrast);
  for (let i = 0; i < pixels.length; i += 4) {
    const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    const value = Math.max(0, Math.min(255, gray * contrast + intercept));
    pixels[i] = pixels[i + 1] = pixels[i + 2] = value;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

async function sourceToCanvas(source: CanvasImageSource, width: number, height: number) {
  const cropHeight = Math.max(Math.round(height * 0.42), 80);
  const scale = width < 1400 ? 2 : 1.4;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(cropHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the photo.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, cropHeight, 0, 0, canvas.width, canvas.height);
  return boostContrast(canvas);
}

async function fileToCanvas(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    return await sourceToCanvas(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

function videoToCanvas(video: HTMLVideoElement) {
  return sourceToCanvas(video, video.videoWidth, video.videoHeight);
}

export default function BatchScanner({
  onDetected,
  onClose,
}: {
  onDetected: (batchNumber: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<any>(null);
  const handled = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [readerReady, setReaderReady] = useState(false);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [cameraError, setCameraError] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Live camera is not available. Take a photo of the slip instead.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play();
        setCameraReady(true);
      } catch {
        if (!cancelled) {
          setCameraError("Camera preview could not start. Take a photo of the slip instead.");
        }
      }
    }

    async function startReader() {
      try {
        const { createWorker, PSM } = await import("tesseract.js");
        const worker = await createWorker("eng", 1, {
          workerPath:
            "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js",
          corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0",
          logger: (message) => {
            if (message.status === "recognizing text") {
              setProgress(Math.round((message.progress || 0) * 100));
            }
          },
        });
        await worker.setParameters({
          tessedit_char_whitelist:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789# ",
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        });
        if (cancelled) {
          await worker.terminate();
          return;
        }
        workerRef.current = worker;
        setReaderReady(true);
      } catch {
        if (!cancelled) {
          setError("Could not load the batch reader. Check the connection and try again.");
        }
      }
    }

    void startCamera();
    void startReader();

    return () => {
      cancelled = true;
      stopCamera();
      const worker = workerRef.current;
      workerRef.current = null;
      worker?.terminate();
    };
  }, [stopCamera]);

  const readCanvas = useCallback(
    async (canvas: HTMLCanvasElement) => {
      if (handled.current) return;
      const worker = workerRef.current;
      if (!worker) {
        setError("The batch reader is still loading. Try capture again in a moment.");
        return;
      }

      setReading(true);
      setError("");
      setProgress(0);

      try {
        const { data } = await worker.recognize(canvas);
        const batchNumber = parseBatchFromOcr(data.text || "");
        if (!batchNumber) {
          setError("Could not find a Batch# on that photo. Line up the title and try again.");
          return;
        }
        handled.current = true;
        stopCamera();
        onDetected(batchNumber);
      } catch {
        setError("Could not read that photo. Try capturing again.");
      } finally {
        setReading(false);
      }
    },
    [onDetected, stopCamera]
  );

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("Camera is not ready yet.");
      return;
    }
    const canvas = await videoToCanvas(video);
    await readCanvas(canvas);
  }, [readCanvas]);

  const handleFile = useCallback(
      async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const canvas = await fileToCanvas(file);
      await readCanvas(canvas);
    },
    [readCanvas]
  );

  const status = reading
    ? `Reading batch number${progress ? ` (${progress}%)` : "…"}`
    : cameraError
      ? cameraError
      : !cameraReady
        ? "Starting camera…"
        : !readerReady
          ? "Camera ready. Loading reader…"
          : "Line up the Batch# in the box, then capture.";

  return (
    <div className="scanner-overlay">
      <div className="scanner-card">
        <h2>Capture batch slip</h2>
        <p>{status}</p>
        <div className={`scanner-view${cameraReady ? " is-live" : ""}`}>
          <video ref={videoRef} className="scanner-video" autoPlay muted playsInline />
          <div className="scanner-guide" aria-hidden="true">
            <span>Batch#</span>
          </div>
          {reading ? <div className="scanner-reading">Reading…</div> : null}
        </div>
        {error ? <div className="error-banner">{error}</div> : null}
        <div className="scanner-actions">
          {cameraReady ? (
            <button
              type="button"
              className="primary-btn"
              disabled={reading || !readerReady}
              onClick={() => void captureFrame()}
            >
              {reading ? "Reading…" : "Capture"}
            </button>
          ) : null}
          <button
            type="button"
            className="ghost-btn"
            disabled={reading || !readerReady}
            onClick={() => fileRef.current?.click()}
          >
            Take photo
          </button>
          <button type="button" className="ghost-btn" disabled={reading} onClick={onClose}>
            Cancel
          </button>
        </div>
        <input
          ref={fileRef}
          className="visually-hidden"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => void handleFile(event)}
        />
      </div>
    </div>
  );
}
