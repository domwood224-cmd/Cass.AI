import { registerPlugin } from '@capacitor/core';

// ─── Native Plugin Bridge ───────────────────────────────────────────────

interface AppUpdaterPlugin {
  getCurrentVersion(): Promise<{ versionName: string; versionCode: number }>;
  canRequestPackageInstalls(): Promise<{ allowed: boolean }>;
  requestInstallPermission(): Promise<{ granted: boolean }>;
  saveAndInstallApk(options: { base64Data: string }): Promise<{ saved: boolean; path: string; sizeBytes: number }>;
  triggerInstall(): Promise<{ launched: boolean }>;
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

// ─── Types ───────────────────────────────────────────────────────────────

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  releaseUrl: string;
  apkSize: number;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'
  | 'not_available';

// ─── Version Helpers ─────────────────────────────────────────────────────

const GITHUB_REPO = 'mrsaggynutz/https-github.com-mrsaggynutz-Cassidey';
const PACKAGE_VERSION = '2.0.4'; // Keep in sync with package.json

function parseVersion(tag: string): string {
  // Strip 'v' prefix if present: "v2.1.0" → "2.1.0"
  return tag.replace(/^v/, '');
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

// ─── Public API ──────────────────────────────────────────────────────────

export async function checkForUpdate(): Promise<UpdateInfo> {
  let currentVersion = PACKAGE_VERSION;

  // On native Android, use the actual APK version
  try {
    if (Capacitor.isNativePlatform()) {
      const native = await AppUpdater.getCurrentVersion();
      currentVersion = native.versionName;
    }
  } catch {
    // Fallback to package.json version
  }

  // Fetch latest release from GitHub
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
    {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    }
  );

  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status}`);
  }

  const release: GitHubRelease = await res.json();
  const latestVersion = parseVersion(release.tag_name);

  // Find the APK asset
  const apkAsset = release.assets.find(
    (a) => a.name.endsWith('.apk') && !a.name.endsWith('-unsigned.apk')
  );

  const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

  return {
    available: hasUpdate,
    currentVersion,
    latestVersion,
    releaseNotes: release.body || '',
    downloadUrl: apkAsset?.browser_download_url || '',
    releaseUrl: release.html_url,
    apkSize: apkAsset?.size || 0,
  };
}

export async function downloadUpdate(
  url: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const contentLength = Number(res.headers.get('content-length') || 0);
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const chunks: Uint8Array[] = [];
  let receivedLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedLength += value.length;

    if (contentLength > 0 && onProgress) {
      onProgress(Math.round((receivedLength / contentLength) * 100));
    }
  }

  // Combine chunks into single ArrayBuffer
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  // Convert to base64 for native plugin
  const base64 = uint8ArrayToBase64(combined);

  // Save to device storage via native plugin
  await AppUpdater.saveAndInstallApk({ base64Data: base64 });
}

export async function triggerInstall(): Promise<void> {
  // Check if we have install permission on Android 8+
  if (Capacitor.isNativePlatform()) {
    const { allowed } = await AppUpdater.canRequestPackageInstalls();
    if (!allowed) {
      const { granted } = await AppUpdater.requestInstallPermission();
      if (!granted) {
        throw new Error('Install permission denied. Please enable "Allow from this source" in settings.');
      }
    }
  }

  await AppUpdater.triggerInstall();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

// Capacitor global — defined by @capacitor/core at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Capacitor: any;
