#!/usr/bin/env node

/**
 * batch-process.js
 *
 * Processes photos in batches from the photos/posts directory.
 * Supports resuming, batch size configuration, and progress tracking.
 *
 * Usage:
 *   node scripts/batch-process.js                    # Process all pending
 *   node scripts/batch-process.js --batch-size 50   # Custom batch size
 *   node scripts/batch-process.js --folder 202401   # Process specific folder
 *   node scripts/batch-process.js --dry-run         # Preview without processing
 *   node scripts/batch-process.js --status          # Show progress status
 *
 * Environment variables:
 *   OPENAI_API_KEY        - Required for AI classification
 *   CLOUDINARY_CLOUD_NAME - For uploads
 *   CLOUDINARY_API_KEY    - For uploads
 *   CLOUDINARY_API_SECRET - For uploads
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, copyFileSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const POSTS_DIR = join(__dirname, '..', 'photos', 'posts');
const PHOTOS_DIR = join(__dirname, '..', 'public', 'photos');
const PHOTOS_YAML_PATH = join(__dirname, '..', 'config', 'photos.yaml');
const PROGRESS_PATH = join(__dirname, 'batch-progress.json');

// Instagram export paths (will check multiple possible locations)
const INSTAGRAM_EXPORT_DIR = join(__dirname, '..', 'photos', 'instagram-export');
const INSTAGRAM_JSON_PATHS = [
  join(INSTAGRAM_EXPORT_DIR, 'content', 'posts_1.json'),
  join(INSTAGRAM_EXPORT_DIR, 'content', 'archived_posts.json'),
  join(INSTAGRAM_EXPORT_DIR, 'your_instagram_activity', 'content', 'posts_1.json'),
  join(__dirname, '..', 'photos', 'content', 'posts_1.json'),
];

const DEFAULT_BATCH_SIZE = 50;

// Model configuration - set USE_OLLAMA=true for local inference
const USE_OLLAMA = process.env.USE_OLLAMA === 'true'; // Default to OpenAI
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2-vision:11b';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// OpenAI pricing per 1M tokens (only used if USE_OLLAMA=false)
const PRICING = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 }
};
const OPENAI_MODEL = 'gpt-4o-mini';

// Global caption map (loaded once)
let captionMap = null;

/**
 * Load Instagram captions from posts_1.json and create a mapping
 * from filename to caption data
 */
function loadInstagramCaptions() {
  if (captionMap !== null) return captionMap;

  captionMap = new Map();
  let filesLoaded = 0;

  for (const jsonPath of INSTAGRAM_JSON_PATHS) {
    if (existsSync(jsonPath)) {
      try {
        const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

        // Handle different JSON structures:
        // - posts_1.json: array of posts directly
        // - archived_posts.json: { ig_archived_post_media: [...] }
        let posts = [];
        if (Array.isArray(data)) {
          posts = data;
        } else if (data.ig_archived_post_media) {
          posts = data.ig_archived_post_media;
        } else if (data.posts) {
          posts = data.posts;
        }

        let countFromFile = 0;
        for (const post of posts) {
          const media = post.media || [];
          for (const item of media) {
            if (item.uri) {
              // Extract just the filename from the uri path
              const filename = basename(item.uri);
              captionMap.set(filename, {
                caption: item.title || '',
                timestamp: item.creation_timestamp,
                location: post.location || null
              });
              countFromFile++;
            }
          }
        }

        if (countFromFile > 0) {
          console.log(`Loaded ${countFromFile} captions from ${basename(jsonPath)}`);
          filesLoaded++;
        }
      } catch (e) {
        console.log(`Warning: Could not parse ${jsonPath}: ${e.message}`);
      }
    }
  }

  if (filesLoaded > 0) {
    console.log(`Total: ${captionMap.size} captions loaded\n`);
  } else {
    console.log('No Instagram captions found (will use AI-only for descriptions)\n');
  }

  return captionMap;
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  batchSize: DEFAULT_BATCH_SIZE,
  folder: null,
  dryRun: false,
  status: false,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--batch-size' && args[i + 1]) {
    options.batchSize = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--folder' && args[i + 1]) {
    options.folder = args[i + 1];
    i++;
  } else if (args[i] === '--dry-run') {
    options.dryRun = true;
  } else if (args[i] === '--status') {
    options.status = true;
  }
}

async function main() {
  // Load or initialize progress
  let progress = loadProgress();

  if (options.status) {
    showStatus(progress);
    return;
  }

  // Get all photos to process
  const allPhotos = getAllPhotos(options.folder);
  const pendingPhotos = allPhotos.filter(p => !progress.processed.includes(p.relativePath));

  console.log('\n========================================');
  console.log('  Batch Photo Processor');
  console.log('========================================\n');
  console.log(`Total photos found: ${allPhotos.length}`);
  console.log(`Already processed: ${progress.processed.length}`);
  console.log(`Pending: ${pendingPhotos.length}`);
  console.log(`Batch size: ${options.batchSize}`);
  console.log('');

  if (pendingPhotos.length === 0) {
    console.log('All photos have been processed!');
    return;
  }

  // Get batch to process
  const batch = pendingPhotos.slice(0, options.batchSize);
  console.log(`Processing batch of ${batch.length} photos...\n`);

  if (options.dryRun) {
    console.log('DRY RUN - would process these photos:');
    batch.forEach((p, i) => console.log(`  ${i + 1}. ${p.relativePath}`));
    return;
  }

  // Check for required configuration
  if (USE_OLLAMA) {
    console.log(`Using Ollama (${OLLAMA_MODEL}) at ${OLLAMA_URL}\n`);
  } else {
    if (!process.env.OPENAI_API_KEY) {
      console.error('Error: OPENAI_API_KEY environment variable required');
      console.error('Set it with: export OPENAI_API_KEY="sk-..."');
      console.error('Or use Ollama (default): ensure ollama is running');
      process.exit(1);
    }
    console.log(`Using OpenAI (${OPENAI_MODEL})\n`);
  }

  // Process batch
  const results = [];
  let batchTokens = { input: 0, output: 0 };
  let batchCost = 0;

  for (let i = 0; i < batch.length; i++) {
    const photo = batch[i];
    console.log(`[${i + 1}/${batch.length}] ${photo.relativePath}`);

    try {
      const result = await processPhoto(photo);
      results.push(result);
      progress.processed.push(photo.relativePath);
      progress.successful++;

      // Track tokens and cost (single call now)
      const usage = result.caption.usage || { prompt_tokens: 0, completion_tokens: 0 };
      const inputTokens = usage.prompt_tokens;
      const outputTokens = usage.completion_tokens;

      progress.tokens = progress.tokens || { input: 0, output: 0 };
      progress.tokens.input += inputTokens;
      progress.tokens.output += outputTokens;

      batchTokens.input += inputTokens;
      batchTokens.output += outputTokens;

      const photoCost = USE_OLLAMA ? 0 : (inputTokens * PRICING[OPENAI_MODEL].input + outputTokens * PRICING[OPENAI_MODEL].output) / 1000000;
      progress.cost = (progress.cost || 0) + photoCost;
      batchCost += photoCost;

      console.log(`  ✓ ${result.classification.category} - "${result.caption.title}" ($${photoCost.toFixed(4)})`);
    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
      progress.processed.push(photo.relativePath);
      progress.failed++;
      progress.errors.push({ path: photo.relativePath, error: err.message });
    }

    // Save progress after each photo
    saveProgress(progress);

    // Small delay to avoid rate limiting
    await sleep(300);
  }

  // Update photos.yaml with successful results
  if (results.length > 0) {
    await updatePhotosYaml(results);
  }

  console.log('\n========================================');
  console.log(`Batch complete!`);
  console.log(`  Successful: ${results.length}`);
  console.log(`  Failed: ${batch.length - results.length}`);
  console.log(`  Remaining: ${pendingPhotos.length - batch.length}`);
  console.log('');
  console.log(`Batch cost: $${batchCost.toFixed(4)}`);
  console.log(`Total cost so far: $${(progress.cost || 0).toFixed(4)}`);
  console.log('========================================\n');

  if (pendingPhotos.length > batch.length) {
    console.log('Run again to process the next batch:');
    console.log('  node scripts/batch-process.js\n');
  }
}

function loadProgress() {
  if (existsSync(PROGRESS_PATH)) {
    return JSON.parse(readFileSync(PROGRESS_PATH, 'utf-8'));
  }
  return {
    processed: [],
    successful: 0,
    failed: 0,
    errors: [],
    tokens: { input: 0, output: 0 },
    cost: 0,
    startedAt: new Date().toISOString()
  };
}

function saveProgress(progress) {
  progress.updatedAt = new Date().toISOString();
  writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

function showStatus(progress) {
  const allPhotos = getAllPhotos();
  const pending = allPhotos.length - progress.processed.length;

  console.log('\n========================================');
  console.log('  Batch Processing Status');
  console.log('========================================\n');
  console.log(`Total photos: ${allPhotos.length}`);
  console.log(`Processed: ${progress.processed.length}`);
  console.log(`  - Successful: ${progress.successful}`);
  console.log(`  - Failed: ${progress.failed}`);
  console.log(`Pending: ${pending}`);
  console.log('');

  // Cost information
  const tokens = progress.tokens || { input: 0, output: 0 };
  const cost = progress.cost || 0;
  console.log('Cost Summary:');
  console.log(`  Input tokens: ${tokens.input.toLocaleString()}`);
  console.log(`  Output tokens: ${tokens.output.toLocaleString()}`);
  console.log(`  Total cost: $${cost.toFixed(4)}`);

  if (pending > 0 && progress.processed.length > 0) {
    const avgCostPerPhoto = cost / progress.processed.length;
    const estimatedRemaining = avgCostPerPhoto * pending;
    console.log(`  Estimated remaining: $${estimatedRemaining.toFixed(2)}`);
  }
  console.log('');

  if (progress.errors.length > 0) {
    console.log('Recent errors:');
    progress.errors.slice(-5).forEach(e => {
      console.log(`  - ${e.path}: ${e.error}`);
    });
    console.log('');
  }

  if (progress.startedAt) {
    console.log(`Started: ${progress.startedAt}`);
  }
  if (progress.updatedAt) {
    console.log(`Last update: ${progress.updatedAt}`);
  }
  console.log('');
}

function getAllPhotos(specificFolder = null) {
  const photos = [];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  // Load Instagram captions
  const captions = loadInstagramCaptions();

  if (!existsSync(POSTS_DIR)) {
    console.error(`Error: Photos directory not found: ${POSTS_DIR}`);
    process.exit(1);
  }

  const folders = specificFolder
    ? [specificFolder]
    : readdirSync(POSTS_DIR).filter(f => {
        const fullPath = join(POSTS_DIR, f);
        return statSync(fullPath).isDirectory() && /^\d{6}$/.test(f);
      }).sort();

  for (const folder of folders) {
    const folderPath = join(POSTS_DIR, folder);
    if (!existsSync(folderPath)) continue;

    const files = readdirSync(folderPath);
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (imageExtensions.includes(ext)) {
        // Get Instagram caption if available
        const instagramData = captions.get(file) || {};

        photos.push({
          filename: file,
          folder: folder,
          relativePath: `${folder}/${file}`,
          fullPath: join(folderPath, file),
          date: parseDate(folder),
          instagramCaption: instagramData.caption || '',
          instagramLocation: instagramData.location || null
        });
      }
    }
  }

  return photos;
}

function parseDate(folder) {
  // folder format: YYYYMM
  const year = folder.substring(0, 4);
  const month = folder.substring(4, 6);
  return `${year}-${month}-01`;
}

async function processPhoto(photo) {
  // Single LLM call for classification + caption
  const result = await analyzePhoto(photo.fullPath, photo.instagramCaption, photo.instagramLocation);

  // Generate slug and ID
  const slug = generateSlug(result.title);

  // Copy to appropriate category folder
  const categoryDir = join(PHOTOS_DIR, result.category);
  if (!existsSync(categoryDir)) {
    mkdirSync(categoryDir, { recursive: true });
  }

  const ext = extname(photo.filename);
  const newFilename = `${slug}${ext}`;
  const destPath = join(categoryDir, newFilename);

  // Handle duplicate slugs
  let finalSlug = slug;
  let finalFilename = newFilename;
  let finalDestPath = destPath;
  let counter = 2;

  while (existsSync(finalDestPath)) {
    finalSlug = `${slug}-${counter}`;
    finalFilename = `${finalSlug}${ext}`;
    finalDestPath = join(categoryDir, finalFilename);
    counter++;
  }

  copyFileSync(photo.fullPath, finalDestPath);

  // Upload to Cloudinary if configured
  let cloudinaryId = null;
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
    cloudinaryId = await uploadToCloudinary(finalDestPath, result.category, finalSlug);
  }

  // Get image dimensions
  const dimensions = await getImageDimensions(finalDestPath);

  return {
    photo,
    classification: {
      category: result.category,
      filter: result.filter,
      species: result.species,
      location: result.location
    },
    caption: {
      title: result.title,
      description: result.description,
      usage: result.usage
    },
    slug: finalSlug,
    filename: finalFilename,
    destPath: finalDestPath,
    cloudinaryId,
    dimensions
  };
}

async function analyzePhoto(imagePath, instagramCaption = '', instagramLocation = null) {
  const imageData = readFileSync(imagePath);
  const base64Image = imageData.toString('base64');
  const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  const locationHint = instagramLocation ? `\nKnown location: ${instagramLocation}` : '';
  const captionHint = instagramCaption && instagramCaption.trim().length > 10
    ? `\nOriginal Instagram caption:\n"${instagramCaption}"`
    : '';

  const prompt = `Analyze this photograph and provide classification and caption.

${captionHint}${locationHint}

Return a JSON object with these fields:

1. category: Choose exactly one: "birds", "wildlife", "landscapes", "flora-macro"
   - birds: Any bird species
   - wildlife: Mammals, reptiles, amphibians, insects (not birds)
   - landscapes: Scenic views, mountains, waterfalls, cityscapes, seascapes
   - flora-macro: Flowers, plants, trees, macro/close-up photography

2. filter: For landscapes only, one of: "mountains", "waterfalls", "cityscapes", or null

3. species: For birds/wildlife, the specific species name (e.g., "Great Blue Heron"), or null

4. location: Inferred or known location, or null

5. title: A short, evocative title (3-8 words). Include species name if applicable.

6. description: 1-2 sentences. If Instagram caption provided, clean it up (remove hashtags, keep meaning). Otherwise describe the scene.

Respond ONLY with valid JSON:
{"category":"string","filter":"string|null","species":"string|null","location":"string|null","title":"string","description":"string"}`;

  let content, usage;

  if (USE_OLLAMA) {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{
          role: 'user',
          content: prompt,
          images: [base64Image]
        }],
        stream: false
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama error: ${response.status} - ${text}`);
    }

    const data = await response.json();
    content = data.message?.content;
    usage = { prompt_tokens: 0, completion_tokens: 0 };
  } else {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY.trim()}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
          ]
        }],
        max_tokens: 300
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    content = data.choices[0]?.message?.content;
    usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');

  const parsed = JSON.parse(jsonMatch[0]);
  const validCategories = ['birds', 'wildlife', 'landscapes', 'flora-macro'];
  const validFilters = ['mountains', 'waterfalls', 'cityscapes'];

  return {
    category: validCategories.includes(parsed.category) ? parsed.category : 'flora-macro',
    filter: parsed.category === 'landscapes' && validFilters.includes(parsed.filter) ? parsed.filter : null,
    species: parsed.species || null,
    location: parsed.location || null,
    title: parsed.title?.trim() || 'Untitled',
    description: parsed.description?.trim() || '',
    usage
  };
}

// Legacy function - kept for reference but no longer used
async function classifyImage(imagePath, instagramLocation = null) {
  const imageData = readFileSync(imagePath);
  const base64Image = imageData.toString('base64');
  const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  const locationHint = instagramLocation ? `\n\nKnown location from metadata: ${instagramLocation}` : '';

  const prompt = `Analyze this photograph and classify it.

1. CATEGORY: Choose exactly one: birds, wildlife, landscapes, flora-macro
   - birds: Any bird species
   - wildlife: Mammals, reptiles, amphibians, insects (not birds)
   - landscapes: Scenic views, mountains, waterfalls, cityscapes, seascapes
   - flora-macro: Flowers, plants, trees, macro/close-up photography

2. FILTER (only for landscapes): mountains, waterfalls, cityscapes, or null

3. SPECIES (for birds/wildlife): Specific species name, or null if uncertain

4. LOCATION: Inferred location, or null if unknown${locationHint}

Respond ONLY with JSON:
{"category":"string","filter":"string|null","species":"string|null","location":"string|null"}`;

  let content, usage;

  if (USE_OLLAMA) {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{
          role: 'user',
          content: prompt,
          images: [base64Image]
        }],
        stream: false
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama error: ${response.status} - ${text}`);
    }

    const data = await response.json();
    content = data.message?.content;
    usage = { prompt_tokens: 0, completion_tokens: 0 };
  } else {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY.trim()}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
          ]
        }],
        max_tokens: 200
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    content = data.choices[0]?.message?.content;
    usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');

  const parsed = JSON.parse(jsonMatch[0]);
  const validCategories = ['birds', 'wildlife', 'landscapes', 'flora-macro'];
  const validFilters = ['mountains', 'waterfalls', 'cityscapes'];

  return {
    category: validCategories.includes(parsed.category) ? parsed.category : 'flora-macro',
    filter: parsed.category === 'landscapes' && validFilters.includes(parsed.filter) ? parsed.filter : null,
    species: parsed.species || null,
    location: parsed.location || null,
    usage
  };
}

async function generateCaption(imagePath, classification, instagramCaption = '') {
  const imageData = readFileSync(imagePath);
  const base64Image = imageData.toString('base64');
  const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  const context = [
    `Category: ${classification.category}`,
    classification.species ? `Species: ${classification.species}` : null,
    classification.location ? `Location: ${classification.location}` : null
  ].filter(Boolean).join('\n');

  // If we have a good Instagram caption, use it with minimal AI help
  const hasInstagramCaption = instagramCaption && instagramCaption.trim().length > 10;

  const prompt = hasInstagramCaption
    ? `Create a title and clean description for this photograph.

Context:
${context}

Original Instagram caption:
"${instagramCaption}"

Requirements:
- Title: Extract or create a short title (3-8 words) from the caption. Include species name if applicable.
- Description: Clean up the Instagram caption into 1-2 professional sentences. Remove hashtags but keep the meaning. Keep details the photographer mentioned.

Respond ONLY with JSON:
{"title":"string","description":"string"}`
    : `Generate a title and description for this photograph.

Context:
${context}

Requirements:
- Title: Short, evocative (3-8 words). Include species name if applicable.
- Description: 1-2 sentences describing the scene.

Respond ONLY with JSON:
{"title":"string","description":"string"}`;

  let content, usage;

  if (USE_OLLAMA) {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{
          role: 'user',
          content: prompt,
          images: [base64Image]
        }],
        stream: false
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama error: ${response.status} - ${text}`);
    }

    const data = await response.json();
    content = data.message?.content;
    usage = { prompt_tokens: 0, completion_tokens: 0 };
  } else {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY.trim()}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
          ]
        }],
        max_tokens: 200
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    content = data.choices[0]?.message?.content;
    usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    title: parsed.title?.trim() || 'Untitled',
    description: parsed.description?.trim() || '',
    hadInstagramCaption: hasInstagramCaption,
    usage
  };
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

async function uploadToCloudinary(imagePath, category, slug) {
  try {
    const cloudinaryModule = await import('cloudinary');
    const cloudinary = cloudinaryModule.v2;

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    const result = await cloudinary.uploader.upload(imagePath, {
      folder: `photo-gallery/${category}`,
      public_id: slug,
      overwrite: true,
      resource_type: 'image'
    });

    return `photo-gallery/${category}/${slug}`;
  } catch (err) {
    console.log(`    (Cloudinary upload failed: ${err.message})`);
    return null;
  }
}

async function getImageDimensions(imagePath) {
  try {
    const sharp = await import('sharp');
    const metadata = await sharp.default(imagePath).metadata();
    return { width: metadata.width, height: metadata.height };
  } catch (e) {
    return { width: 1200, height: 800 }; // fallback
  }
}

async function updatePhotosYaml(results) {
  // Load existing photos
  let existingPhotos = [];
  if (existsSync(PHOTOS_YAML_PATH)) {
    const yamlContent = readFileSync(PHOTOS_YAML_PATH, 'utf-8');
    const parsed = yaml.load(yamlContent);
    existingPhotos = parsed?.photos || [];
  }

  // Generate IDs for new photos
  const categoryCounters = {};
  for (const photo of existingPhotos) {
    if (!categoryCounters[photo.category]) {
      categoryCounters[photo.category] = 0;
    }
    const num = parseInt(photo.id?.split('-').pop(), 10) || 0;
    if (num > categoryCounters[photo.category]) {
      categoryCounters[photo.category] = num;
    }
  }

  const prefixes = {
    birds: 'bird',
    wildlife: 'wildlife',
    landscapes: 'landscape',
    'flora-macro': 'flora'
  };

  const newPhotos = results.map(r => {
    const category = r.classification.category;
    if (!categoryCounters[category]) categoryCounters[category] = 0;
    categoryCounters[category]++;

    const id = `${prefixes[category] || category}-${String(categoryCounters[category]).padStart(3, '0')}`;

    const entry = {
      id,
      filename: r.filename,
      slug: r.slug,
      category: r.classification.category,
      filters: r.classification.filter ? [r.classification.filter] : [],
      title: r.caption.title,
      description: r.caption.description,
      date_taken: r.photo.date,
      available_for_print: true
    };

    if (r.classification.species) entry.species = r.classification.species;
    if (r.classification.location) entry.location = r.classification.location;
    if (r.cloudinaryId) entry.cloudinary_id = r.cloudinaryId;
    if (r.dimensions) {
      entry.width = r.dimensions.width;
      entry.height = r.dimensions.height;
    }

    return entry;
  });

  const allPhotos = [...existingPhotos, ...newPhotos];

  const yamlOutput = yaml.dump({ photos: allPhotos }, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: true
  });

  writeFileSync(PHOTOS_YAML_PATH, yamlOutput);
  console.log(`\nUpdated photos.yaml: +${newPhotos.length} photos (total: ${allPhotos.length})`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
