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
    url: string;
    browser_download_url: string;
    size: number;
    id: number;
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
  assetId?: number;
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

// ─── Configuration ───────────────────────────────────────────────────────
//
// GITHUB_REPO: The repository where releases are published.
// GITHUB_TOKEN: Injected at build time via VITE_GITHUB_TOKEN env var.
//   Required because the account is not publicly visible to unauthenticated
//   GitHub API calls. Set it in your local .env file:
//     VITE_GITHUB_TOKEN=ghp_your_token_here
//   To generate: https://github.com/settings/tokens (scope: public_repo)
//
const GITHUB_REPO = 'mrsaggynutz/Cassidey-App';
const GITHUB_TOKEN: string = (import.meta as any).env?.VITE_GITHUB_TOKEN || '';
const PACKAGE_VERSION = '2.0.4'; // Keep in sync with package.json

// ─── Version Helpers ─────────────────────────────────────────────────────

function parseVersion(tag: string): string {
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

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }
  return headers;
}

// ─── Public API ──────────────────────────────────────────────────────────

export async function checkForUpdate(): Promise<UpdateInfo> {
  let currentVersion = PACKAGE_VERSION;

  try {
    if (Capacitor.isNativePlatform()) {
      const native = await AppUpdater.getCurrentVersion();
      currentVersion = native.versionName;
    }
  } catch {
    // Fallback to package.json version
  }

  // Fetch latest release from GitHub (authenticated)
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
    { headers: githubHeaders() }
  );

  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status}`);
  }

  const release: GitHubRelease = await res.json();
  const latestVersion = parseVersion(release.tag_name);

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
    assetId: apkAsset?.id,
  };
}

export async function downloadUpdate(
  url: string,
  onProgress?: (percent: number) => void,
  assetId?: number
): Promise<void> {
  let res: Response;

  if (assetId && GITHUB_TOKEN) {
    // Authenticated download via GitHub API (required for hidden accounts)
    const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/assets/${assetId}`;
    res = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/octet-stream',
      },
    });
  } else {
    res = await fetch(url);
  }

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

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  const base64 = uint8ArrayToBase64(combined);
  await AppUpdater.saveAndInstallApk({ base64Data: base64 });
}

export async function triggerInstall(): Promise<void> {
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
declare const Capacitor: any;
