import fs from 'fs';

const folders = ['node_modules/.vite', 'dist', '.next'];

for (const folder of folders) {
  if (fs.existsSync(folder)) {
    console.log(`[clean-cache] Removing ${folder}...`);
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

console.log('[clean-cache] Build and dev caches cleared successfully.');
