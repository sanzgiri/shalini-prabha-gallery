import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { SiteConfig, Category, Photo, NavItem } from '../types';

// Base path for config files
const CONFIG_DIR = path.join(process.cwd(), 'config');

/**
 * Load and parse a YAML file
 */
function loadYaml<T>(filename: string): T {
  const filePath = path.join(CONFIG_DIR, filename);
  const fileContents = fs.readFileSync(filePath, 'utf8');
  return yaml.load(fileContents) as T;
}

/**
 * Get site configuration
 */
export function getSiteConfig(): SiteConfig {
  return loadYaml<SiteConfig>('site.yaml');
}

/**
 * Get all categories
 */
export function getCategories(): Category[] {
  const data = loadYaml<{ categories: Category[] }>('categories.yaml');
  return data.categories;
}

/**
 * Get navigation items from categories
 */
export function getNavItems(): NavItem[] {
  const categories = getCategories();
  return categories.map((cat) => ({
    name: cat.name,
    slug: `/${cat.slug}/`,
  }));
}

/**
 * Get a single category by ID
 */
export function getCategoryById(id: string): Category | undefined {
  const categories = getCategories();
  return categories.find((cat) => cat.id === id);
}

/**
 * Get a single category by slug
 */
export function getCategoryBySlug(slug: string): Category | undefined {
  const categories = getCategories();
  return categories.find((cat) => cat.slug === slug);
}

/**
 * Get all photos
 */
export function getPhotos(): Photo[] {
  const data = loadYaml<{ photos: Photo[] }>('photos.yaml');
  return data.photos;
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get photos filtered by category (randomized order)
 */
export function getPhotosByCategory(categoryId: string): Photo[] {
  const photos = getPhotos();
  const filtered = photos.filter((photo) => photo.category === categoryId);
  return shuffleArray(filtered);
}

/**
 * Get photos filtered by category and optional filter (randomized order)
 */
export function getPhotosByCategoryAndFilter(
  categoryId: string,
  filterId?: string
): Photo[] {
  const photos = getPhotosByCategory(categoryId);
  if (!filterId) {
    return photos;
  }
  const filtered = photos.filter((photo) => photo.filters.includes(filterId));
  return shuffleArray(filtered);
}

/**
 * Get a single photo by slug
 */
export function getPhotoBySlug(slug: string): Photo | undefined {
  const photos = getPhotos();
  return photos.find((photo) => photo.slug === slug);
}

/**
 * Get a single photo by slug within a specific category
 */
export function getPhotoByCategoryAndSlug(
  categoryId: string,
  slug: string
): Photo | undefined {
  const photos = getPhotosByCategory(categoryId);
  return photos.find((photo) => photo.slug === slug);
}

/**
 * Get recent photos (sorted by date, newest first)
 */
export function getRecentPhotos(count: number): Photo[] {
  const photos = getPhotos();
  return photos
    .sort((a, b) => new Date(b.date_taken).getTime() - new Date(a.date_taken).getTime())
    .slice(0, count);
}

/**
 * Get random photos
 */
export function getRandomPhotos(count: number): Photo[] {
  const photos = getPhotos();
  const shuffled = [...photos].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get photos for the homepage photo wall based on config
 */
export function getPhotoWallPhotos(): Photo[] {
  const config = getSiteConfig();
  const { mode, count } = config.photo_wall;

  if (mode === 'random') {
    return getRandomPhotos(count);
  }
  return getRecentPhotos(count);
}

/**
 * Cloudinary URL helper - get base URL for transformations
 */
export const CLOUDINARY_BASE = 'https://res.cloudinary.com/dsilndqt6/image/upload';

/**
 * Generate Cloudinary URL with transformations
 */
export function getCloudinaryUrl(
  publicId: string,
  options?: {
    width?: number;
    height?: number;
    quality?: number | 'auto';
    format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
    crop?: 'fill' | 'fit' | 'scale' | 'thumb';
  }
): string {
  const transforms: string[] = [];

  if (options?.width) transforms.push(`w_${options.width}`);
  if (options?.height) transforms.push(`h_${options.height}`);
  if (options?.quality) transforms.push(`q_${options.quality}`);
  if (options?.format) transforms.push(`f_${options.format}`);
  if (options?.crop) transforms.push(`c_${options.crop}`);

  const transformString = transforms.length > 0 ? transforms.join(',') + '/' : '';

  return `${CLOUDINARY_BASE}/${transformString}${publicId}`;
}
