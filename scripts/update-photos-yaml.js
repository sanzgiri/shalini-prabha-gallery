#!/usr/bin/env node

/**
 * update-photos-yaml.js
 *
 * Merges captioned photo data into config/photos.yaml.
 * - Generates unique IDs and slugs
 * - Moves photos from pending to category folders
 * - Preserves manual overrides in existing entries
 * - Uploads to Cloudinary if configured
 *
 * Usage: node scripts/update-photos-yaml.js
 *
 * Environment variables:
 *   CLOUDINARY_CLOUD_NAME - Cloudinary cloud name
 *   CLOUDINARY_API_KEY    - Cloudinary API key
 *   CLOUDINARY_API_SECRET - Cloudinary API secret
 */

import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CAPTIONED_PATH = join(__dirname, 'captioned-photos.json');
const PHOTOS_YAML_PATH = join(__dirname, '..', 'config', 'photos.yaml');
const PHOTOS_DIR = join(__dirname, '..', 'public', 'photos');

async function main() {
  if (!existsSync(CAPTIONED_PATH)) {
    console.error('No captioned photos found.');
    console.error('Run generate-captions.js first.');
    process.exit(1);
  }

  const captionedPhotos = JSON.parse(readFileSync(CAPTIONED_PATH, 'utf-8'));

  if (captionedPhotos.length === 0) {
    console.log('No photos to add.');
    return;
  }

  // Load existing photos.yaml
  let existingPhotos = [];
  if (existsSync(PHOTOS_YAML_PATH)) {
    const yamlContent = readFileSync(PHOTOS_YAML_PATH, 'utf-8');
    const parsed = yaml.load(yamlContent);
    existingPhotos = parsed?.photos || [];
  }

  // Create a map of existing photos by filename for quick lookup
  const existingByFilename = new Map();
  for (const photo of existingPhotos) {
    if (photo.filename) {
      existingByFilename.set(photo.filename, photo);
    }
  }

  // Check if Cloudinary is configured
  const hasCloudinary = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  let cloudinary = null;
  if (hasCloudinary) {
    const cloudinaryModule = await import('cloudinary');
    cloudinary = cloudinaryModule.v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log('Cloudinary configured for uploads.\n');
  } else {
    console.log('Cloudinary not configured. Photos will be stored locally only.\n');
  }

  console.log(`Processing ${captionedPhotos.length} new photos...\n`);

  const newPhotos = [];

  for (let i = 0; i < captionedPhotos.length; i++) {
    const photo = captionedPhotos[i];
    const {
      filename,
      classification,
      caption,
      path: pendingPath,
      instagramCaption,
      instagramDate,
      instagramTimestamp,
      instagramLocation
    } = photo;

    console.log(`[${i + 1}/${captionedPhotos.length}] ${filename}`);

    // Check if this photo already exists (by filename)
    if (existingByFilename.has(filename)) {
      console.log(`  -> Skipping (already in photos.yaml)`);
      continue;
    }

    // Generate slug from title
    const slug = generateSlug(caption.title);

    // Check for slug conflicts and make unique
    const uniqueSlug = ensureUniqueSlug(slug, existingPhotos, newPhotos);

    // Generate ID
    const id = generateId(classification.category, existingPhotos, newPhotos);

    // Determine category folder
    const categoryDir = join(PHOTOS_DIR, classification.category);
    if (!existsSync(categoryDir)) {
      mkdirSync(categoryDir, { recursive: true });
    }

    // New filename (use slug for consistency)
    const ext = extname(filename);
    const newFilename = `${uniqueSlug}${ext}`;
    const destPath = join(categoryDir, newFilename);

    // Move photo from pending to category folder
    if (existsSync(pendingPath)) {
      renameSync(pendingPath, destPath);
      console.log(`  -> Moved to: ${classification.category}/${newFilename}`);
    }

    // Get image dimensions
    const dimensions = await getImageDimensions(destPath);

    // Upload to Cloudinary if configured
    let cloudinaryId = null;
    if (cloudinary && existsSync(destPath)) {
      try {
        const result = await cloudinary.uploader.upload(destPath, {
          folder: `photo-gallery/${classification.category}`,
          public_id: uniqueSlug,
          overwrite: true,
          resource_type: 'image'
        });
        cloudinaryId = `photo-gallery/${classification.category}/${uniqueSlug}`;
        console.log(`  -> Uploaded to Cloudinary`);
      } catch (err) {
        console.log(`  -> Cloudinary upload failed: ${err.message}`);
      }
    }

    // Create photo entry
    const dateTaken = resolveDateTaken(instagramDate, instagramTimestamp);
    const location = instagramLocation || classification.location || undefined;

    const photoEntry = {
      id,
      filename: newFilename,
      slug: uniqueSlug,
      category: classification.category,
      filters: classification.filter ? [classification.filter] : [],
      species: classification.species || undefined,
      location,
      title: caption.title,
      description: caption.description,
      instagram_caption: instagramCaption || undefined,
      date_taken: dateTaken,
      available_for_print: true,
      ...(cloudinaryId && { cloudinary_id: cloudinaryId }),
      ...(dimensions && { width: dimensions.width, height: dimensions.height })
    };

    // Remove undefined values
    Object.keys(photoEntry).forEach(key => {
      if (photoEntry[key] === undefined) {
        delete photoEntry[key];
      }
    });

    newPhotos.push(photoEntry);
    console.log(`  -> Added: "${caption.title}" (${uniqueSlug})`);
  }

  if (newPhotos.length === 0) {
    console.log('\nNo new photos to add to photos.yaml');
    return;
  }

  // Merge new photos with existing
  const allPhotos = [...existingPhotos, ...newPhotos];

  // Write updated photos.yaml
  const yamlOutput = yaml.dump({ photos: allPhotos }, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: true
  });

  writeFileSync(PHOTOS_YAML_PATH, yamlOutput);
  console.log(`\nUpdated photos.yaml with ${newPhotos.length} new photos.`);
  console.log(`Total photos: ${allPhotos.length}`);

  // Clean up intermediate files
  cleanup();

  console.log('\nPipeline complete! Next steps:');
  console.log('  1. Review changes in config/photos.yaml');
  console.log('  2. Run: npm run build');
  console.log('  3. Preview: npm run preview');
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

function ensureUniqueSlug(slug, existingPhotos, newPhotos) {
  const allSlugs = new Set([
    ...existingPhotos.map(p => p.slug),
    ...newPhotos.map(p => p.slug)
  ]);

  if (!allSlugs.has(slug)) {
    return slug;
  }

  let counter = 2;
  while (allSlugs.has(`${slug}-${counter}`)) {
    counter++;
  }

  return `${slug}-${counter}`;
}

function generateId(category, existingPhotos, newPhotos) {
  const prefix = {
    birds: 'bird',
    wildlife: 'wildlife',
    landscapes: 'landscape',
    'flora-macro': 'flora'
  }[category] || category;

  const existingIds = [
    ...existingPhotos.filter(p => p.category === category).map(p => p.id),
    ...newPhotos.filter(p => p.category === category).map(p => p.id)
  ];

  const numbers = existingIds
    .map(id => parseInt(id.split('-').pop(), 10))
    .filter(n => !isNaN(n));

  const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
  const newNum = String(maxNum + 1).padStart(3, '0');

  return `${prefix}-${newNum}`;
}

async function getImageDimensions(imagePath) {
  try {
    // Try using sharp if available
    const sharp = await import('sharp').catch(() => null);
    if (sharp) {
      const metadata = await sharp.default(imagePath).metadata();
      return { width: metadata.width, height: metadata.height };
    }
  } catch (e) {
    // Ignore errors
  }

  // Return null if we can't determine dimensions
  return null;
}

function resolveDateTaken(instagramDate, instagramTimestamp) {
  if (instagramDate) {
    return instagramDate;
  }

  if (instagramTimestamp) {
    const num = Number(instagramTimestamp);
    if (Number.isFinite(num)) {
      const ms = num > 1e12 ? num : num * 1000;
      return new Date(ms).toISOString().split('T')[0];
    }
  }

  return new Date().toISOString().split('T')[0];
}

function cleanup() {
  const filesToClean = [
    join(__dirname, 'pending-photos.json'),
    join(__dirname, 'classified-photos.json'),
    join(__dirname, 'captioned-photos.json')
  ];

  for (const file of filesToClean) {
    if (existsSync(file)) {
      unlinkSync(file);
    }
  }

  console.log('\nCleaned up intermediate files.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
