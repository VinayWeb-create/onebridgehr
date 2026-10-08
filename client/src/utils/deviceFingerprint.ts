/**
 * Device Fingerprinting and Metadata Utilities for Smart Attendance
 */

const STORAGE_KEY = 'codabs_device_fingerprint_id';

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  browser: string;
  os: string;
}

export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(STORAGE_KEY);
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  return deviceId;
}

export function getClientDeviceInfo(): DeviceInfo {
  const deviceId = getOrCreateDeviceId();
  const userAgent = navigator.userAgent;

  let os = 'Unknown OS';
  if (/Windows/i.test(userAgent)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(userAgent)) os = 'macOS';
  else if (/Linux/i.test(userAgent)) os = 'Linux';
  else if (/Android/i.test(userAgent)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(userAgent)) os = 'iOS';

  let browser = 'Unknown Browser';
  if (/Edg\//i.test(userAgent)) browser = 'Edge';
  else if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) browser = 'Chrome';
  else if (/Firefox\//i.test(userAgent)) browser = 'Firefox';
  else if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) browser = 'Safari';
  else if (/Opera|OPR\//i.test(userAgent)) browser = 'Opera';

  const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
  const deviceName = `${os} ${isMobile ? 'Mobile' : 'Workstation'} (${browser})`;

  return {
    deviceId,
    deviceName,
    browser,
    os,
  };
}
