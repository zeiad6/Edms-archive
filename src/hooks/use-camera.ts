"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Manages camera lifecycle: start, stop, capture photo, toggle facing mode.
 *
 * Returns refs for `<video>` and `<canvas>` elements that the caller must
 * wire into JSX.  The stream is automatically cleaned up on unmount.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  /** Request camera access and attach the stream to the video element. */
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch {
      setCameraActive(false);
      throw new Error("تعذر الوصول إلى الكاميرا. تأكد من منح إذن الوصول.");
    }
  }, [facingMode]);

  /** Stop all tracks and deactivate the camera. */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  /** Capture the current video frame as a JPEG data-URL (quality 0.9). */
  const capturePhoto = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  }, []);

  /** Toggle between front/back camera. */
  const toggleFacingMode = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  /** Clean up on unmount. */
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    cameraActive,
    facingMode,
    startCamera,
    stopCamera,
    capturePhoto,
    toggleFacingMode,
  } as const;
}
