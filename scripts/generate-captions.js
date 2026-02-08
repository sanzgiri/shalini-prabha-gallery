#!/usr/bin/env node

/**
 * generate-captions.js
 *
 * Generates titles and descriptions for classified photos using AI.
 * Uses the classification data and original Instagram caption for context.
 *
 * Usage: node scripts/generate-captions.js
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

const CLASSIFIED_PATH = join(__dirname, 'classified-photos.json');
const CAPTIONED_PATH = join(__dirname, 'captioned-photos.json');

function getCaptionPrompt(photo) {
  const { classification, instagramCaption, instagramLocation } = photo;

  return `Generate a title and description for this photograph.

Context:
- Category: ${classification.category}
${classification.species ? `- Species: ${classification.species}` : ''}
${classification.location ? `- Location: ${classification.location}` : ''}
${instagramLocation ? `- Instagram location: ${instagramLocation}` : ''}
${instagramCaption ? `- Original Instagram caption: "${instagramCaption}"` : ''}

Requirements:
- Title: Short, evocative (3-8 words). Include species name if applicable.
- Description: 1-2 sentences. Describe the scene, highlight notable features, mention location if known.
- Tone: Professional but warm, suitable for a photography portfolio.
- Do not invent specific details not visible in the image or provided in context.

Respond ONLY with valid JSON in this exact format:
{
  "title": "string",
  "description": "string"
}`;
}

async function main() {
  if (!existsSync(CLASSIFIED_PATH)) {
    console.error('No classified photos found.');
    console.error('Run classify-images.js first.');
    process.exit(1);
  }

  const photos = JSON.parse(readFileSync(CLASSIFIED_PATH, 'utf-8'));

  if (photos.length === 0) {
    console.log('No photos to caption.');
    return;
  }

  console.log(`Generating captions for ${photos.length} photos...\n`);

  const useOpenAI = !!process.env.OPENAI_API_KEY;
  console.log(`Using: ${useOpenAI ? 'OpenAI API' : 'Ollama (local)'}\n`);

  const captioned = [];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    console.log(`[${i + 1}/${photos.length}] Generating caption: ${photo.filename}`);

    try {
      const prompt = getCaptionPrompt(photo);
      const result = useOpenAI
        ? await generateWithOpenAI(photo.path, prompt)
        : await generateWithOllama(photo.path, prompt);

      captioned.push({
        ...photo,
        caption: result
      });
      console.log(`  -> "${result.title}"`);
    } catch (err) {
      console.error(`  -> Error: ${err.message}`);
      // Generate fallback caption from classification
      const fallbackTitle = generateFallbackTitle(photo);
      captioned.push({
        ...photo,
        caption: {
          title: fallbackTitle,
          description: `A ${photo.classification.category} photograph.`,
          error: err.message
        }
      });
      console.log(`  -> Fallback: "${fallbackTitle}"`);
    }

    // Small delay to avoid rate limiting
    await sleep(500);
  }

  writeFileSync(CAPTIONED_PATH, JSON.stringify(captioned, null, 2));
  console.log(`\nCaption generation complete. Results saved to: ${CAPTIONED_PATH}`);
  console.log(`\nNext step: node scripts/update-photos-yaml.js`);
}

async function generateWithOllama(imagePath, prompt) {
  const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llava';

  const imageData = readFileSync(imagePath);
  const base64Image = imageData.toString('base64');

  const response = await fetch(`${host}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      images: [base64Image],
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status}`);
  }

  const data = await response.json();
  return parseCaptionResponse(data.response);
}

async function generateWithOpenAI(imagePath, prompt) {
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
            { type: 'text', text: prompt },
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
  return parseCaptionResponse(content);
}

function parseCaptionResponse(response) {
  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (!parsed.title || !parsed.description) {
    throw new Error('Missing title or description in response');
  }

  return {
    title: parsed.title.trim(),
    description: parsed.description.trim()
  };
}

function generateFallbackTitle(photo) {
  const { classification, filename } = photo;

  if (classification.species) {
    return classification.species;
  }

  // Generate from filename (remove extension, replace dashes/underscores with spaces)
  const name = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  return name || `${classification.category} Photo`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
