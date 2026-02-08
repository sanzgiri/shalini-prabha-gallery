#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const PHOTOS_PATH = path.join(process.cwd(), 'config', 'photos.yaml');
const CATEGORIES_PATH = path.join(process.cwd(), 'config', 'categories.yaml');

function usage() {
  console.log(`
Manage photos in config/photos.yaml

Usage:
  node scripts/manage-photos.js remove <cloudinary-id-or-url> [more...]
  node scripts/manage-photos.js add --category <slug> --title <title> --cloudinary-id <id-or-url> [options]

Add options:
  --slug <slug>                 Custom slug (defaults to slugified title)
  --description <text>          Description (defaults to empty)
  --filters <a,b,c>             Comma-separated filters
  --species <text>              Species (optional)
  --location <text>             Location (optional)
  --date <YYYY-MM-DD>           Date taken (defaults to today)
  --available-for-print <bool>  true|false (defaults to true)
  --width <number>              Image width (optional)
  --height <number>             Image height (optional)
  --filename <name>             Filename (defaults to "<slug>.jpg")
  --dry-run                     Show changes without writing
`);
}

function loadYaml(filePath) {
  const contents = fs.readFileSync(filePath, 'utf8');
  return yaml.load(contents);
}

function savePhotos(photos) {
  const output = yaml.dump({ photos }, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: true
  });
  fs.writeFileSync(PHOTOS_PATH, output);
}

function normalizeCloudinaryId(input) {
  if (!input) return '';
  const trimmed = input.trim();

  const match = trimmed.match(/photo-gallery\/[\w\-\/]+/);
  if (match) return match[0];

  try {
    const url = new URL(trimmed);
    if (!url.hostname.includes('cloudinary.com')) {
      return trimmed;
    }

    const segments = url.pathname.split('/').filter(Boolean);
    const uploadIndex = segments.indexOf('upload');
    if (uploadIndex === -1) return trimmed;

    const afterUpload = segments.slice(uploadIndex + 1);
    const galleryIndex = afterUpload.indexOf('photo-gallery');
    if (galleryIndex !== -1) {
      return afterUpload.slice(galleryIndex).join('/');
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function ensureUniqueSlug(baseSlug, photos) {
  let slug = baseSlug;
  let counter = 2;
  const existing = new Set(photos.map((p) => p.slug));
  while (existing.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
  return slug;
}

function nextIdForCategory(category, photos) {
  const prefixMap = {
    birds: 'bird-',
    wildlife: 'wildlife-',
    landscapes: 'landscape-',
    'flora-macro': 'flora-'
  };
  const prefix = prefixMap[category];
  if (!prefix) return null;

  const numbers = photos
    .map((p) => p.id)
    .filter((id) => typeof id === 'string' && id.startsWith(prefix))
    .map((id) => {
      const match = id.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });

  const next = (Math.max(0, ...numbers) + 1).toString().padStart(3, '0');
  return `${prefix}${next}`;
}

function parseFlags(args) {
  const flags = { _: [] };
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
        i += 1;
      } else {
        flags[key] = next;
        i += 2;
      }
    } else {
      flags._.push(arg);
      i += 1;
    }
  }
  return flags;
}

function getCategories() {
  if (!fs.existsSync(CATEGORIES_PATH)) return [];
  const data = loadYaml(CATEGORIES_PATH);
  return data?.categories || [];
}

function removePhotos(targets, { dryRun }) {
  const data = loadYaml(PHOTOS_PATH);
  const photos = data?.photos || [];
  const normalizedTargets = targets.map(normalizeCloudinaryId).filter(Boolean);
  if (normalizedTargets.length === 0) {
    console.error('No valid targets provided.');
    process.exit(1);
  }

  const toRemove = new Set(normalizedTargets);
  const kept = [];
  const removed = [];

  for (const photo of photos) {
    const matches = [
      photo.cloudinary_id,
      photo.slug,
      photo.id,
      photo.filename
    ].filter(Boolean);

    const hit = matches.some((value) => toRemove.has(value));
    if (hit) {
      removed.push(photo);
    } else {
      kept.push(photo);
    }
  }

  if (removed.length === 0) {
    console.log('No matching photos found.');
    return;
  }

  console.log(`Removing ${removed.length} photo(s):`);
  removed.forEach((photo) => {
    console.log(`- ${photo.title} (${photo.cloudinary_id})`);
  });

  if (dryRun) {
    console.log('Dry run enabled. No changes written.');
    return;
  }

  savePhotos(kept);
  console.log('config/photos.yaml updated.');
}

function addPhoto(flags) {
  const data = loadYaml(PHOTOS_PATH);
  const photos = data?.photos || [];
  const categories = getCategories().map((cat) => cat.slug);

  const category = flags.category;
  if (!category) {
    console.error('Missing --category.');
    process.exit(1);
  }
  if (categories.length > 0 && !categories.includes(category)) {
    console.error(`Unknown category "${category}". Expected one of: ${categories.join(', ')}`);
    process.exit(1);
  }

  const title = flags.title;
  if (!title) {
    console.error('Missing --title.');
    process.exit(1);
  }

  const cloudinaryId = normalizeCloudinaryId(flags['cloudinary-id']);
  if (!cloudinaryId) {
    console.error('Missing --cloudinary-id.');
    process.exit(1);
  }

  const baseSlug = flags.slug ? slugify(flags.slug) : slugify(title);
  const slug = ensureUniqueSlug(baseSlug, photos);
  const id = nextIdForCategory(category, photos);

  if (!id) {
    console.error('Unable to generate id for category.');
    process.exit(1);
  }

  const filters = typeof flags.filters === 'string' && flags.filters.length > 0
    ? flags.filters.split(',').map((f) => f.trim()).filter(Boolean)
    : [];

  const date = flags.date || new Date().toISOString().slice(0, 10);
  const available = flags['available-for-print'] !== undefined
    ? String(flags['available-for-print']).toLowerCase() !== 'false'
    : true;

  const entry = {
    id,
    filename: flags.filename || `${slug}.jpg`,
    slug,
    category,
    filters,
    species: flags.species || null,
    location: flags.location || null,
    title,
    description: flags.description || '',
    date_taken: date,
    available_for_print: available,
    cloudinary_id: cloudinaryId,
    ...(flags.width ? { width: Number(flags.width) } : {}),
    ...(flags.height ? { height: Number(flags.height) } : {})
  };

  photos.push(entry);

  console.log('Adding photo:');
  console.log(`- ${title} (${cloudinaryId})`);
  console.log(`- slug: ${slug}`);
  console.log(`- id: ${id}`);

  if (flags['dry-run']) {
    console.log('Dry run enabled. No changes written.');
    return;
  }

  savePhotos(photos);
  console.log('config/photos.yaml updated.');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    usage();
    process.exit(1);
  }

  const command = args[0];
  const rest = args.slice(1);

  if (command === 'remove') {
    const flags = parseFlags(rest);
    removePhotos(flags._, { dryRun: !!flags['dry-run'] });
    return;
  }

  if (command === 'add') {
    const flags = parseFlags(rest);
    addPhoto(flags);
    return;
  }

  usage();
  process.exit(1);
}

main();
