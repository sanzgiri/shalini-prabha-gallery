#!/usr/bin/env node

/**
 * classify-images.js
 *
 * Classifies pending photos using an AI vision model.
 * Supports Ollama (local) or OpenAI API.
 *
 * Usage: node scripts/classify-images.js
 *
 * Environment variables:
 *   OPENAI_API_KEY - For OpenAI API (optional, uses Ollama if not set)
 *   OLLAMA_HOST    - Ollama host (default: http://localhost:11434)
 *   OLLAMA_MODEL   - Ollama vision model (default: llava)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MANIFEST_PATH = join(__dirname, 'pending-photos.json');
const CLASSIFIED_PATH = join(__dirname, 'classified-photos.json');

const CLASSIFICATION_PROMPT = `Analyze this photograph and provide classification data.

1. CATEGORY: Choose exactly one: birds, wildlife, landscapes, flora-macro
   - birds: Any bird species
   - wildlife: Mammals, reptiles, amphibians, insects (not birds)
   - landscapes: Scenic views, mountains, waterfalls, cityscapes, seascapes
   - flora-macro: Flowers, plants, trees, macro/close-up photography

2. SUB_FILTER (only if category is "landscapes"): mountains, waterfalls, cityscapes, or null

3. SPECIES (if birds or wildlife): Specific species name, or null if uncertain

4. LOCATION: Inferred location based on habitat, species, or visual cues. Use null if cannot determine.

Respond ONLY with valid JSON in this exact format:
{
  "category": "string",
  "filter": "string or null",
  "species": "string or null",
  "location": "string or null"
}`;

async function main() {
  if (!existsSync(MANIFEST_PATH)) {
    console.error('No pending photos manifest found.');
    console.error('Run process-export.js first to extract photos.');
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));

  if (manifest.length === 0) {
    console.log('No photos to classify.');
    return;
  }

  console.log(`Classifying ${manifest.length} photos...\n`);

  const useOpenAI = !!process.env.OPENAI_API_KEY;
  const classifier = useOpenAI ? classifyWithOpenAI : classifyWithOllama;

  console.log(`Using: ${useOpenAI ? 'OpenAI API' : 'Ollama (local)'}\n`);

  const classified = [];

  for (let i = 0; i < manifest.length; i++) {
    const photo = manifest[i];
    console.log(`[${i + 1}/${manifest.length}] Classifying: ${photo.filename}`);

    try {
      const result = await classifier(photo.path);
      classified.push({
        ...photo,
        classification: result
      });
      console.log(`  -> ${result.category}${result.species ? ` (${result.species})` : ''}`);
    } catch (err) {
      console.error(`  -> Error: ${err.message}`);
      classified.push({
        ...photo,
        classification: {
          category: 'flora-macro', // Default fallback
          filter: null,
          species: null,
          location: null,
          error: err.message
        }
      });
    }

    // Small delay to avoid rate limiting
    await sleep(500);
  }

  writeFileSync(CLASSIFIED_PATH, JSON.stringify(classified, null, 2));
  console.log(`\nClassification complete. Results saved to: ${CLASSIFIED_PATH}`);
  console.log(`\nNext step: node scripts/generate-captions.js`);
}

async function classifyWithOllama(imagePath) {
  const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llava';

  const imageData = readFileSync(imagePath);
  const base64Image = imageData.toString('base64');

  const response = await fetch(`${host}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: CLASSIFICATION_PROMPT,
      images: [base64Image],
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status}`);
  }

  const data = await response.json();
  return parseClassificationResponse(data.response);
}

async function classifyWithOpenAI(imagePath) {
  const apiKey = process.env.OPENAI_API_KEY;

  const imageData = readFileSync(imagePath);
  const base64Image = imageData.toString('base64');
  const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: CLASSIFICATION_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 300
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `OpenAI request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  return parseClassificationResponse(content);
}

function parseClassificationResponse(response) {
  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate and normalize
  const validCategories = ['birds', 'wildlife', 'landscapes', 'flora-macro'];
  const validFilters = ['mountains', 'waterfalls', 'cityscapes'];

  const category = validCategories.includes(parsed.category) ? parsed.category : 'flora-macro';
  const filter = category === 'landscapes' && validFilters.includes(parsed.filter) ? parsed.filter : null;

  return {
    category,
    filter,
    species: parsed.species || null,
    location: parsed.location || null
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
