# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Photography portfolio website for Shalini Prabha built with Astro and hosted on Netlify. The site features a masonry gallery layout, lightbox viewer, client-side search with Fuse.js, and Netlify Forms for print inquiries.

## Development Commands

```bash
npm run dev       # Start dev server at localhost:4321
npm run build     # Build static site to dist/
npm run preview   # Preview production build locally
```

## Build Phases

This project uses a phased implementation approach. See IMPLEMENTATION_GUIDE.md for detailed instructions and acceptance criteria for each phase:

1. **Foundation** - Base Astro site, layout, navigation
2. **Config System** - YAML parsing, TypeScript types
3. **Gallery** - Masonry grid, lightbox, filtering
4. **Photo Pages** - Individual photo routes, SEO
5. **Contact/Forms** - Netlify Forms integration
6. **Search** - Fuse.js client-side search
7. **SEO/Analytics** - Meta tags, sitemap, GA
8. **Scripts** - Instagram processing pipeline

## Architecture

### Data Flow

All content is YAML/Markdown driven from the `config/` directory:
- `site.yaml` - Site metadata, hero config, social links, analytics ID
- `categories.yaml` - Gallery categories (birds, wildlife, landscapes, flora-macro) and filters
- `photos.yaml` - Photo metadata (filename, slug, category, species, location, title, description)
- `about.md` - About page content

### Key Directories

- `src/components/` - Astro components (PhotoCard, MasonryGrid, Lightbox, FilterBar, SearchBar, ContactForm)
- `src/layouts/` - Page layouts (BaseLayout, GalleryLayout, PhotoLayout)
- `src/pages/` - Route pages with category subdirectories for dynamic photo routes
- `src/utils/` - Config loaders and search utilities
- `public/photos/` - Photo assets
- `scripts/` - Instagram export processing and AI classification (Phase 8)

### URL Structure

- `/birds/`, `/wildlife/`, `/landscapes/`, `/flora-macro/` - Category galleries
- `/birds/[slug]`, etc. - Individual photo pages
- `/about`, `/contact`, `/search` - Static pages

### Gallery Features

- Masonry grid preserves photo aspect ratios
- Lightbox opens on photo click with keyboard navigation (arrows, ESC)
- Landscapes page has sub-filters: Mountains, Waterfalls, Cityscapes
- Homepage photo wall shows recent or random photos (configurable in site.yaml)

## Tech Stack

- **Astro 4** - Static site generator
- **TypeScript** - Type safety
- **Fuse.js** - Client-side search
- **Sharp** - Image processing
- **js-yaml** - YAML config parsing
- **@astrojs/sitemap** - Auto-generated sitemap

## Deployment

Target: Netlify free tier
- Build command: `npm run build`
- Publish directory: `dist`
- Forms require `data-netlify="true"` attribute

## Photo Data

1,700+ photos available in `photos/posts/` organized by date (YYYYMM subdirectories). Sample data in `config/photos.yaml` for development.
