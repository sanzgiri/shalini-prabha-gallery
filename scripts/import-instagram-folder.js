#!/usr/bin/env node

/**
 * import-instagram-folder.js
 *
 * Process a folder of images with Instagram metadata:
 * - Copies images to public/photos/pending
 * - Builds pending-photos.json with captions/date/location
 * - Runs classify-images, generate-captions, update-photos-yaml
 *
 * Usage:
 *   node scripts/import-instagram-folder.js <path-to-folder> [--metadata <path-to-posts.json>]
 */

import { existsSync, mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PENDING_DIR = join(__dirname, '..', 'public', 'photos', 'pending');
const MANIFEST_PATH = join(__dirname, 'pending-photos.json');

function usage() {
  console.log(`
Usage:
  node scripts/import-instagram-folder.js <path-to-folder> [--metadata <path-to-posts.json>]
`);
}

function parseArgs(args) {
  const out = { _: [] };
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        out[key] = true;
        i += 1;
      } else {
        out[key] = next;
        i += 2;
      }
    } else {
      out._.push(arg);
      i += 1;
    }
  }
  return out;
}

function findMediaFiles(dir) {
  const files = [];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  function walk(currentDir) {
    if (!existsSync(currentDir)) return;
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (imageExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

function findMetadataFile(folderPath) {
  const candidates = [
    join(folderPath, 'content', 'posts_1.json'),
    join(folderPath, 'your_instagram_activity', 'content', 'posts_1.json'),
    join(folderPath, 'posts_1.json'),
    join(folderPath, 'posts.json')
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback: search for posts_*.json
  const stack = [folderPath];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        if (/^posts_\d+\.json$/i.test(entry.name)) {
          return fullPath;
        }
      }
    }
  }

  return null;
}

function extractCaption(post, media) {
  return (
    media?.title ||
    media?.caption ||
    post?.title ||
    post?.caption ||
    ''
  );
}

function extractLocation(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return (
      value.name ||
      value.location_name ||
      value.title ||
      value.city_name ||
      ''
    );
  }
  return '';
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const ms = num > 1e12 ? num : num * 1000;
  return ms;
}

function toDateString(timestampMs) {
  if (!timestampMs) return '';
  try {
    return new Date(timestampMs).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function buildMetadataIndex(posts) {
  const index = new Map();

  for (const post of posts) {
    const mediaItems = Array.isArray(post?.media) ? post.media : [];
    const postTimestamp = normalizeTimestamp(post?.creation_timestamp || post?.taken_at || post?.timestamp);
    const postLocation = extractLocation(post?.location || post?.location_name);

    for (const media of mediaItems) {
      const uri = media?.uri || media?.media_uri || media?.path || '';
      const filename = uri ? basename(uri) : '';
      if (!filename) continue;

      const caption = extractCaption(post, media);
      const mediaTimestamp = normalizeTimestamp(media?.creation_timestamp || media?.taken_at);
      const timestampMs = mediaTimestamp || postTimestamp;
      const date = toDateString(timestampMs);
      const location = extractLocation(media?.location) || postLocation;

      index.set(filename, {
        caption,
        timestampMs,
        date,
        location
      });
    }
  }

  return index;
}

function loadPosts(metadataPath) {
  if (!metadataPath || !existsSync(metadataPath)) return [];
  try {
    const raw = readFileSync(metadataPath, 'utf8');
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.posts)) return data.posts;
    if (Array.isArray(data?.data)) return data.data;
  } catch {
    return [];
  }
  return [];
}

function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptPath} exited with code ${code}`));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const folderPath = args._[0];

  if (!folderPath) {
    usage();
    process.exit(1);
  }

  if (!existsSync(folderPath)) {
    console.error(`Error: Folder not found: ${folderPath}`);
    process.exit(1);
  }

  if (!existsSync(PENDING_DIR)) {
    mkdirSync(PENDING_DIR, { recursive: true });
  }

  const metadataPath = args.metadata || findMetadataFile(folderPath);
  const posts = loadPosts(metadataPath);
  const metadataIndex = buildMetadataIndex(posts);

  if (!metadataPath) {
    console.log('No Instagram metadata file found. Proceeding without captions/date/location.');
  } else {
    console.log(`Using metadata: ${metadataPath}`);
  }

  const mediaFiles = findMediaFiles(folderPath);
  if (mediaFiles.length === 0) {
    console.log('No images found in folder.');
    return;
  }

  const manifest = [];

  for (const filePath of mediaFiles) {
    const fileName = basename(filePath);
    const destPath = join(PENDING_DIR, fileName);

    if (existsSync(destPath)) {
      console.log(`Skipping (exists): ${fileName}`);
      continue;
    }

    copyFileSync(filePath, destPath);
    const meta = metadataIndex.get(fileName) || {};

    manifest.push({
      filename: fileName,
      path: destPath,
      originalPath: filePath,
      instagramCaption: meta.caption || '',
      instagramTimestamp: meta.timestampMs || null,
      instagramDate: meta.date || '',
      instagramLocation: meta.location || '',
      processedAt: new Date().toISOString()
    });
  }

  if (manifest.length === 0) {
    console.log('No new photos to process.');
    return;
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written to: ${MANIFEST_PATH}`);

  await runScript(join(__dirname, 'classify-images.js'));
  await runScript(join(__dirname, 'generate-captions.js'));
  await runScript(join(__dirname, 'update-photos-yaml.js'));
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
