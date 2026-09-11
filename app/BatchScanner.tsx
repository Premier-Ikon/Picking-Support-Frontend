"use client";

import { useEffect, useRef, useState } from "react";

function parseScannedBatch(raw: string) {
  const text = String(raw || "").trim();
  const match = text.match(/#?(\d{4,12})/);
  if (match) return match[1];

  const digits = text.replace(/\D/g, "");
  if (digits.length >= 4 && digits.length <= 12) return digits;
  return null;
}

export default function BatchScanner({
  onDetected,
  onClose,
}: {
  onDetected: (batchNumber: string) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const handled = useRef(false);

  useEffect(() => {
    let scanner: { stop: () => Promise<void>; clear?: () => Promise<void> } | null =
      null;
    let cancelled = false;

    async function start() {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
          "html5-qrcode"
        );
        if (cancelled) return;

        const instance = new Html5Qrcode("batch-scanner-view", {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
        });
        scanner = instance;

        await instance.start(
          { facingMode: "environment" },
          {
            fps: 12,
            qrbox: { width: 280, height: 140 },
            aspectRatio: 1.777,
          },
          (decodedText) => {
            if (handled.current) return;
            const batchNumber = parseScannedBatch(decodedText);
            if (!batchNumber) {
              setError("Could not read a batch number. Try again.");
              return;
            }
            handled.current = true;
            onDetected(batchNumber);
          },
          () => {}
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Camera could not be opened. You can still type the batch number."
          );
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (!scanner) return;
      scanner.stop().catch(() => {});
    };
  }, [onDetected]);

  return (
    <div className="scanner-overlay">
      <div className="scanner-card">
        <h2>Scan batch</h2>
        <p>Point the camera at the barcode on the batch sheet.</p>
        <div id="batch-scanner-view" className="scanner-view" />
        {error ? <div className="error-banner">{error}</div> : null}
        <button type="button" className="ghost-btn scanner-close" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
