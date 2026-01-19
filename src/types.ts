// Site configuration types

export interface HeroConfig {
  image: string;
  alt: string;
}

export interface PhotoWallConfig {
  mode: 'recent' | 'random';
  count: number;
}

export interface SocialLinks {
  instagram?: string;
  twitter?: string;
  facebook?: string;
  [key: string]: string | undefined;
}

export interface AnalyticsConfig {
  google_analytics_id: string;
}

export interface ContactConfig {
  form_name: string;
}

export interface SiteConfig {
  site_name: string;
  tagline: string;
  hero: HeroConfig;
  photo_wall: PhotoWallConfig;
  social: SocialLinks;
  analytics: AnalyticsConfig;
  contact: ContactConfig;
}

// Category types

export interface CategoryFilter {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  cover_image: string;
  filters: CategoryFilter[];
}

// Photo types

export interface Photo {
  id: string;
  filename: string;
  slug: string;
  category: string;
  filters: string[];
  species: string | null;
  location: string | null;
  title: string;
  description: string;
  instagram_caption?: string;
  date_taken: string;
  available_for_print: boolean;
  // Cloudinary-specific fields
  cloudinary_id: string;
  width?: number;
  height?: number;
}

// Navigation item for header
export interface NavItem {
  name: string;
  slug: string;
}
