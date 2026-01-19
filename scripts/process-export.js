#!/usr/bin/env node

/**
 * process-export.js
 *
 * Extracts photos and metadata from an Instagram export zip file.
 * Copies new photos to public/photos/pending/ for classification.
 * Outputs a manifest of new photos for the next steps in the pipeline.
 *
 * Usage: node scripts/process-export.js <path-to-instagram-export.zip>
 */

import { createReadStream, existsSync, mkdirSync, writeFileSync, readdirSync, copyFileSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PENDING_DIR = join(__dirname, '..', 'public', 'photos', 'pending');
const MANIFEST_PATH = join(__dirname, 'pending-photos.json');

async function main() {
  const zipPath = process.argv[2];

  if (!zipPath) {
    console.error('Usage: node scripts/process-export.js <path-to-instagram-export.zip>');
    console.error('       node scripts/process-export.js <path-to-folder-with-images>');
    process.exit(1);
  }

  if (!existsSync(zipPath)) {
    console.error(`Error: File or folder not found: ${zipPath}`);
    process.exit(1);
  }

  // Create pending directory if it doesn't exist
  if (!existsSync(PENDING_DIR)) {
    mkdirSync(PENDING_DIR, { recursive: true });
  }

  let photos = [];

  // Check if it's a zip file or a folder
  if (zipPath.endsWith('.zip')) {
    photos = await processZipExport(zipPath);
  } else {
    photos = await processFolderExport(zipPath);
  }

  if (photos.length === 0) {
    console.log('No new photos found to process.');
    return;
  }

  // Write manifest for next steps
  writeFileSync(MANIFEST_PATH, JSON.stringify(photos, null, 2));
  console.log(`\nManifest written to: ${MANIFEST_PATH}`);
  console.log(`\nNext step: node scripts/classify-images.js`);
}

async function processZipExport(zipPath) {
  console.log(`Processing Instagram export: ${zipPath}`);

  // Create temp directory for extraction
  const tempDir = join(__dirname, '.temp-export');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  // Extract zip
  console.log('Extracting zip file...');
  await execAsync(`unzip -o -q "${zipPath}" -d "${tempDir}"`);

  const photos = [];

  // Find media files - Instagram exports have various structures
  const mediaLocations = [
    join(tempDir, 'media', 'posts'),
    join(tempDir, 'your_instagram_activity', 'content', 'posts'),
    join(tempDir, 'media'),
    tempDir
  ];

  // Find the posts JSON for captions
  const postsJsonLocations = [
    join(tempDir, 'content', 'posts_1.json'),
    join(tempDir, 'your_instagram_activity', 'content', 'posts_1.json'),
  ];

  let postsData = [];
  for (const jsonPath of postsJsonLocations) {
    if (existsSync(jsonPath)) {
      try {
        const { readFileSync } = await import('fs');
        const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
        postsData = data;
        console.log(`Found posts metadata: ${jsonPath}`);
        break;
      } catch (e) {
        // Continue to next location
      }
    }
  }

  // Find and copy media files
  for (const mediaDir of mediaLocations) {
    if (existsSync(mediaDir)) {
      const mediaFiles = findMediaFiles(mediaDir);

      for (const filePath of mediaFiles) {
        const fileName = basename(filePath);
        const destPath = join(PENDING_DIR, fileName);

        // Skip if already exists
        if (existsSync(destPath)) {
          console.log(`Skipping (exists): ${fileName}`);
          continue;
        }

        copyFileSync(filePath, destPath);
        console.log(`Copied: ${fileName}`);

        // Try to find caption from posts data
        let caption = '';
        if (postsData.length > 0) {
          const post = postsData.find(p => {
            const media = p.media?.[0];
            return media && basename(media.uri) === fileName;
          });
          if (post?.media?.[0]?.title) {
            caption = post.media[0].title;
          }
        }

        photos.push({
          filename: fileName,
          path: destPath,
          originalPath: filePath,
          instagramCaption: caption,
          processedAt: new Date().toISOString()
        });
      }

      if (photos.length > 0) break; // Found photos, stop searching
    }
  }

  // Cleanup temp directory
  await execAsync(`rm -rf "${tempDir}"`);

  console.log(`\nExtracted ${photos.length} new photos to: ${PENDING_DIR}`);
  return photos;
}

async function processFolderExport(folderPath) {
  console.log(`Processing folder: ${folderPath}`);

  const photos = [];
  const mediaFiles = findMediaFiles(folderPath);

  for (const filePath of mediaFiles) {
    const fileName = basename(filePath);
    const destPath = join(PENDING_DIR, fileName);

    // Skip if already exists
    if (existsSync(destPath)) {
      console.log(`Skipping (exists): ${fileName}`);
      continue;
    }

    copyFileSync(filePath, destPath);
    console.log(`Copied: ${fileName}`);

    photos.push({
      filename: fileName,
      path: destPath,
      originalPath: filePath,
      instagramCaption: '',
      processedAt: new Date().toISOString()
    });
  }

  console.log(`\nCopied ${photos.length} new photos to: ${PENDING_DIR}`);
  return photos;
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

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
