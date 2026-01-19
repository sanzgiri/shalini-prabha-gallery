import type { APIRoute } from 'astro';
import { getPhotos, getCategories } from '../utils/config';

export const GET: APIRoute = async () => {
  const photos = getPhotos();
  const categories = getCategories();

  // Create a map of category IDs to names
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));

  // Build search index with relevant fields
  const searchIndex = photos.map(photo => ({
    id: photo.id,
    slug: photo.slug,
    category: photo.category,
    categoryName: categoryMap.get(photo.category) || photo.category,
    title: photo.title,
    description: photo.description,
    species: photo.species || '',
    location: photo.location || '',
    filters: photo.filters,
    cloudinary_id: photo.cloudinary_id,
    width: photo.width,
    height: photo.height,
  }));

  return new Response(JSON.stringify(searchIndex), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
