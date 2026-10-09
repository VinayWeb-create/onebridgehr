/**
 * Resilient Geolocation Utility
 *
 * Solves "Timeout expired" and indoor satellite attenuation issues on mobile devices:
 * 1. Requests high-accuracy GPS with an extended timeout (18s) and allows recent cached fixes (15s).
 * 2. If high-accuracy times out (e.g. indoors/basement/thick walls), automatically falls back
 *    to network/Wi-Fi/cell-tower triangulation (enableHighAccuracy: false), which resolves in 1-2s.
 * 3. Provides human-friendly explanations for error states.
 */

export interface ResilientPositionOptions {
  highAccuracyTimeout?: number;
  fallbackTimeout?: number;
  maximumAge?: number;
  onFallback?: () => void;
}

export function getFriendlyGpsErrorMessage(err: any): string {
  if (!err) return 'Unknown GPS error';
  if (typeof err === 'string') return err;
  if (err.code === 1) {
    return 'Location permission was denied. Please allow location access in your browser or device settings.';
  }
  if (err.code === 2) {
    return 'Location signal unavailable. Ensure GPS is turned on and try stepping near a window.';
  }
  if (err.code === 3) {
    return 'GPS lock timed out indoors. Please enable Google Location Accuracy / Wi-Fi scanning in your phone settings, or step near a window.';
  }
  return err.message || 'Unable to determine GPS location.';
}

export function getResilientPosition(
  onSuccess: (position: GeolocationPosition) => void,
  onError: (error: GeolocationPositionError | Error) => void,
  options: ResilientPositionOptions = {}
): void {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    onError(new Error('Geolocation is not supported by your browser or device.'));
    return;
  }

  const {
    highAccuracyTimeout = 18000,
    fallbackTimeout = 15000,
    maximumAge = 15000,
    onFallback,
  } = options;

  navigator.geolocation.getCurrentPosition(
    (pos) => onSuccess(pos),
    (err) => {
      // If error is timeout (code 3) or position unavailable (code 2), attempt Wi-Fi / cell tower fallback
      if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
        onFallback?.();
        navigator.geolocation.getCurrentPosition(
          (pos) => onSuccess(pos),
          (fallbackErr) => onError(fallbackErr),
          {
            enableHighAccuracy: false,
            timeout: fallbackTimeout,
            maximumAge: 30000,
          }
        );
      } else {
        onError(err);
      }
    },
    {
      enableHighAccuracy: true,
      timeout: highAccuracyTimeout,
      maximumAge,
    }
  );
}
