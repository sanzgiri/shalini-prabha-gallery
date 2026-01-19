# Photo Gallery Implementation Guide for Claude Code

This guide provides phased instructions for building a photography portfolio site. Reference `REQUIREMENTS.md` for full specifications.

## Quick Start

```bash
# Clone/create project directory
mkdir shalini-prabha-gallery && cd shalini-prabha-gallery

# Initialize project
npm create astro@latest . -- --template minimal --install --git

# Install dependencies
npm install js-yaml fuse.js sharp @astrojs/sitemap
```

---

## Project Structure Target

```
shalini-prabha-gallery/
├── src/
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── PhotoCard.astro
│   │   ├── MasonryGrid.astro
│   │   ├── Lightbox.astro
│   │   ├── FilterBar.astro
│   │   ├── SearchBar.astro
│   │   └── ContactForm.astro
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   ├── GalleryLayout.astro
│   │   └── PhotoLayout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── about.astro
│   │   ├── contact.astro
│   │   ├── search.astro
│   │   ├── birds/
│   │   │   ├── index.astro
│   │   │   └── [...slug].astro
│   │   ├── wildlife/
│   │   │   ├── index.astro
│   │   │   └── [...slug].astro
│   │   ├── landscapes/
│   │   │   ├── index.astro
│   │   │   └── [...slug].astro
│   │   └── flora-macro/
│   │       ├── index.astro
│   │       └── [...slug].astro
│   ├── styles/
│   │   └── global.css
│   └── utils/
│       ├── photos.ts
│       └── search.ts
├── public/
│   └── photos/
│       └── [sample photos go here]
├── config/
│   ├── site.yaml
│   ├── categories.yaml
│   ├── photos.yaml
│   └── about.md
├── scripts/
│   ├── process-export.js
│   ├── classify-images.js
│   └── generate-captions.js
├── astro.config.mjs
├── package.json
├── REQUIREMENTS.md
└── README.md
```

---

## Phase 1: Foundation

**Goal:** Basic Astro site with static layout, sample photos, and navigation.

### Tasks

1. **Initialize Astro project** with TypeScript support

2. **Create BaseLayout.astro** with:
   - HTML boilerplate with meta tags
   - Sticky header with logo and navigation
   - Footer with social links
   - Slot for page content

3. **Create global.css** with:
   - CSS reset
   - Minimal white theme (clean, photo-focused)
   - Typography (system fonts)
   - Responsive breakpoints

4. **Create Header.astro**:
   - Site name/logo (left)
   - Navigation links: Birds | Wildlife | Landscapes | Flora & Macro | About (center/right)
   - Search icon (right)
   - Mobile hamburger menu
   - Sticky positioning

5. **Create Footer.astro**:
   - Social media links (read from config)
   - Copyright notice
   - "Contact for Prints" link

6. **Create homepage (index.astro)**:
   - Hero section with featured image (full-width or large)
   - Photo wall section below (placeholder grid for now)

7. **Create placeholder category pages**:
   - `/birds/index.astro`
   - `/wildlife/index.astro`
   - `/landscapes/index.astro`
   - `/flora-macro/index.astro`
   - Each shows category title and placeholder grid

8. **Create About page** (`/about.astro`):
   - Reads content from `config/about.md`

9. **Add sample photos** to `public/photos/`:
   - Use the 6 sample images provided
   - Various aspect ratios (landscape, portrait, square)

### Acceptance Criteria - Phase 1

- [ ] Site builds without errors
- [ ] Homepage displays hero image and placeholder content
- [ ] All navigation links work
- [ ] Mobile responsive (hamburger menu works)
- [ ] About page renders markdown content
- [ ] Clean, minimal white design

---

## Phase 2: Config System & Data Layer

**Goal:** YAML-driven configuration, photo data model, utility functions.

### Tasks

1. **Create config loader utility** (`src/utils/config.ts`):
   ```typescript
   // Functions to load and parse YAML config files
   export function getSiteConfig(): SiteConfig
   export function getCategories(): Category[]
   export function getPhotos(): Photo[]
   export function getPhotosByCategory(categoryId: string): Photo[]
   export function getPhotoBySlug(slug: string): Photo | undefined
   ```

2. **Define TypeScript interfaces** (`src/types.ts`):
   ```typescript
   interface SiteConfig {
     site_name: string
     tagline: string
     hero: { image: string; alt: string }
     photo_wall: { mode: 'recent' | 'random'; count: number }
     social: Record<string, string>
   }
   
   interface Category {
     id: string
     name: string
     slug: string
     filters: { id: string; name: string }[]
   }
   
   interface Photo {
     id: string
     filename: string
     slug: string
     category: string
     filters: string[]
     species?: string
     location?: string
     title: string
     description: string
     date_taken: string
     available_for_print: boolean
   }
   ```

3. **Populate config files** with sample data:
   - `config/site.yaml` - site settings
   - `config/categories.yaml` - category definitions
   - `config/photos.yaml` - sample photo entries

4. **Update Header.astro** to read navigation from categories config

5. **Update Footer.astro** to read social links from site config

6. **Update homepage** to:
   - Read hero image from config
   - Read photo_wall settings from config

### Acceptance Criteria - Phase 2

- [ ] All config files parse without errors
- [ ] Header navigation generated from categories.yaml
- [ ] Footer social links generated from site.yaml
- [ ] Homepage hero reads from config
- [ ] TypeScript types properly defined

---

## Phase 3: Gallery Components

**Goal:** Masonry grid, photo cards, lightbox, category pages with real data.

### Tasks

1. **Create PhotoCard.astro**:
   - Displays photo thumbnail
   - Shows title on hover
   - Click triggers lightbox
   - Responsive image sizing

2. **Create MasonryGrid.astro**:
   - CSS-based masonry layout (use CSS columns or grid)
   - Accepts array of photos as prop
   - Responsive columns (1 on mobile, 2 on tablet, 3-4 on desktop)

3. **Create Lightbox.astro** (or use client-side JS):
   - Modal overlay with dark background
   - Large image display
   - Caption, species, location info
   - Previous/Next navigation arrows
   - Close button
   - "View Details" link to dedicated page
   - Keyboard navigation (arrow keys, ESC)

4. **Create FilterBar.astro**:
   - Horizontal button group for filters
   - "All" button + filter-specific buttons
   - Active state styling
   - Used only on Landscapes page

5. **Create GalleryLayout.astro**:
   - Extends BaseLayout
   - Category title
   - Optional filter bar slot
   - Masonry grid slot

6. **Update category pages** to use real data:
   - Fetch photos by category
   - Pass to MasonryGrid component
   - Landscapes page includes FilterBar

7. **Update homepage photo wall**:
   - Fetch photos based on config (recent or random)
   - Display in MasonryGrid

### Acceptance Criteria - Phase 3

- [ ] Masonry grid displays photos correctly
- [ ] Various aspect ratios handled properly
- [ ] Lightbox opens on photo click
- [ ] Lightbox navigation works (arrows, keyboard)
- [ ] Filter bar filters photos on Landscapes page
- [ ] Homepage photo wall shows correct photos

---

## Phase 4: Individual Photo Pages

**Goal:** Dedicated pages for each photo with full details and print inquiry.

### Tasks

1. **Create PhotoLayout.astro**:
   - Large image display
   - Title, description
   - Species and location (if available)
   - Date taken
   - "Request Print" button
   - Back to gallery link
   - Previous/Next photo navigation

2. **Create dynamic routes** for each category:
   - `/birds/[...slug].astro`
   - `/wildlife/[...slug].astro`
   - `/landscapes/[...slug].astro`
   - `/flora-macro/[...slug].astro`

3. **Implement getStaticPaths()** for each:
   - Generate paths from photos.yaml
   - Pass photo data as props

4. **Add SEO meta tags** to PhotoLayout:
   - Title: `{photo.title} | {site_name}`
   - Description: `{photo.description}`
   - Open Graph image
   - Schema.org ImageObject structured data

5. **Update Lightbox** "View Details" to link to photo page

### Acceptance Criteria - Phase 4

- [ ] Each photo has dedicated URL (e.g., `/birds/resplendent-quetzal`)
- [ ] Photo pages display all metadata
- [ ] "Request Print" button visible
- [ ] SEO meta tags present in HTML
- [ ] Previous/Next navigation works
- [ ] Lightbox links to correct photo page

---

## Phase 5: Contact & Print Inquiry

**Goal:** Contact form with Netlify Forms integration.

### Tasks

1. **Create ContactForm.astro**:
   - Netlify Forms compatible markup
   - Fields: Name, Email, Subject, Message
   - Hidden field for photo reference (if coming from photo page)
   - Submit button
   - Success/error states

2. **Create Contact page** (`/contact.astro`):
   - ContactForm component
   - Brief intro text

3. **Update "Request Print" button** on photo pages:
   - Links to `/contact?photo={photo.slug}`
   - Pre-populates subject/message with photo info

4. **Add Netlify Forms configuration**:
   - Form name attribute
   - Honeypot field for spam prevention

### Acceptance Criteria - Phase 5

- [ ] Contact form renders correctly
- [ ] Form submits to Netlify Forms (test in deploy preview)
- [ ] "Request Print" pre-fills photo reference
- [ ] Honeypot spam prevention in place
- [ ] Success message displays after submission

---

## Phase 6: Search

**Goal:** Client-side search functionality using Fuse.js.

### Tasks

1. **Create search index** at build time:
   - Generate JSON with searchable fields (title, species, location, description, category)
   - Output to `public/search-index.json`

2. **Create SearchBar.astro**:
   - Search input with icon
   - Expandable on click (header integration)
   - Form submits to /search page

3. **Create Search page** (`/search.astro`):
   - Client-side JavaScript to:
     - Load search index
     - Initialize Fuse.js
     - Filter results based on query param
   - Display results in MasonryGrid

4. **Update Header** to include SearchBar

### Acceptance Criteria - Phase 6

- [ ] Search index generated at build time
- [ ] Search bar visible in header
- [ ] Search results page displays matches
- [ ] Searching by species, location, title works
- [ ] No results state handled gracefully

---

## Phase 7: SEO & Analytics

**Goal:** Full SEO optimization and Google Analytics integration.

### Tasks

1. **Add @astrojs/sitemap** integration:
   - Configure in astro.config.mjs
   - Generates sitemap.xml automatically

2. **Create robots.txt** in public folder

3. **Add comprehensive meta tags** to BaseLayout:
   - Canonical URLs
   - Open Graph (og:title, og:description, og:image)
   - Twitter Card meta tags

4. **Add structured data** to photo pages:
   - Schema.org ImageObject JSON-LD
   - Include: name, description, contentUrl, author, datePublished

5. **Add Google Analytics**:
   - Create component for GA script
   - Include in BaseLayout head
   - Use GA4 measurement ID from config

6. **Optimize images**:
   - Ensure responsive srcset
   - Add width/height attributes to prevent layout shift
   - Proper alt text on all images

### Acceptance Criteria - Phase 7

- [ ] sitemap.xml generated and accessible
- [ ] robots.txt present
- [ ] Open Graph meta tags on all pages
- [ ] Structured data on photo pages (validate with Google's tool)
- [ ] Google Analytics tracking code present
- [ ] No Lighthouse SEO warnings

---

## Phase 8: Processing Scripts

**Goal:** Scripts for processing Instagram exports and AI classification.

### Tasks

1. **Create process-export.js**:
   - Accepts path to Instagram export zip
   - Extracts photos and metadata
   - Copies new photos to `public/photos/`
   - Outputs list of new photos for classification

2. **Create classify-images.js**:
   - Accepts list of image paths
   - Calls vision model (Ollama local or API)
   - Returns: category, species, location for each
   - Prompt template for consistent classification

3. **Create generate-captions.js**:
   - Accepts image + classification data + Instagram caption
   - Generates title and description
   - Uses Instagram caption for grounding

4. **Create update-photos-yaml.js**:
   - Merges new photo data into photos.yaml
   - Preserves manual overrides
   - Generates slugs from titles

5. **Create main update.sh script**:
   ```bash
   #!/bin/bash
   # Usage: ./scripts/update.sh ~/Downloads/instagram-export.zip
   
   set -e
   
   ZIP_PATH=$1
   
   echo "Processing Instagram export..."
   node scripts/process-export.js "$ZIP_PATH"
   
   echo "Classifying new images..."
   node scripts/classify-images.js
   
   echo "Generating captions..."
   node scripts/generate-captions.js
   
   echo "Updating photos.yaml..."
   node scripts/update-photos-yaml.js
   
   echo "Building site..."
   npm run build
   
   echo "Preview at http://localhost:4321"
   npm run preview &
   
   read -p "Deploy? (y/n) " -n 1 -r
   echo
   if [[ $REPLY =~ ^[Yy]$ ]]; then
       git add .
       git commit -m "Add new photos $(date +%Y-%m-%d)"
       git push
       echo "Deployed! Netlify will build automatically."
   fi
   ```

### Acceptance Criteria - Phase 8

- [ ] process-export.js extracts photos from zip
- [ ] classify-images.js categorizes photos correctly
- [ ] generate-captions.js produces quality captions
- [ ] photos.yaml updated with new entries
- [ ] Full pipeline works end-to-end
- [ ] Manual overrides in photos.yaml preserved

---

## Configuration Files Reference

### config/site.yaml
```yaml
site_name: "Shalini Prabha"
tagline: "Wildlife & Nature Photography"

hero:
  image: "/photos/hero-featured.jpg"
  alt: "Featured photograph"

photo_wall:
  mode: "recent"  # "recent" or "random"
  count: 20

social:
  instagram: "https://instagram.com/ginnigazes"

analytics:
  google_analytics_id: ""  # Add GA4 measurement ID
```

### config/categories.yaml
```yaml
categories:
  - id: birds
    name: "Birds"
    slug: "birds"
    filters: []

  - id: wildlife
    name: "Wildlife"
    slug: "wildlife"
    filters: []

  - id: landscapes
    name: "Landscapes"
    slug: "landscapes"
    filters:
      - id: mountains
        name: "Mountains"
      - id: waterfalls
        name: "Waterfalls"
      - id: cityscapes
        name: "Cityscapes"

  - id: flora-macro
    name: "Flora & Macro"
    slug: "flora-macro"
    filters: []
```

### config/about.md
```markdown
[Bio content to be provided by site owner]
```

---

## AI Classification Prompts

### Classification Prompt (for classify-images.js)

```
Analyze this photograph and provide:

1. CATEGORY: Choose exactly one: birds, wildlife, landscapes, flora-macro
   - birds: Any bird species
   - wildlife: Mammals, reptiles, amphibians, insects (not birds)
   - landscapes: Scenic views, mountains, waterfalls, cityscapes, seascapes
   - flora-macro: Flowers, plants, trees, macro/close-up photography

2. SUB_FILTER (only if category is "landscapes"): mountains, waterfalls, cityscapes, or none

3. SPECIES (if birds or wildlife): Specific species name, or "Unknown" if uncertain

4. LOCATION: Inferred location based on habitat, species, or visual cues. Use "Unknown" if cannot determine.

Respond in JSON format:
{
  "category": "string",
  "filter": "string or null",
  "species": "string or null",
  "location": "string"
}
```

### Caption Generation Prompt (for generate-captions.js)

```
Generate a title and description for this photograph.

Context:
- Category: {category}
- Species: {species}
- Location: {location}
- Original Instagram caption: {instagram_caption}

Requirements:
- Title: Short, evocative (3-8 words). Include species name if applicable.
- Description: 1-2 sentences. Describe the scene, highlight notable features, mention location if known.
- Tone: Professional but warm, suitable for a photography portfolio.
- Do not invent specific details not visible in the image.

Respond in JSON format:
{
  "title": "string",
  "description": "string"
}
```

---

## Deployment Checklist

Before deploying to Netlify:

- [ ] All config files populated
- [ ] Sample photos replaced with real photos
- [ ] about.md content added
- [ ] Google Analytics ID added (if ready)
- [ ] Site builds successfully locally (`npm run build`)
- [ ] Preview looks correct (`npm run preview`)
- [ ] Forms tested in Netlify deploy preview
- [ ] sitemap.xml generates correctly

### Netlify Setup

1. Connect Git repository to Netlify
2. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Enable Netlify Forms in site settings
4. Set up form notifications (email)

---

## Commands Reference

```bash
# Development
npm run dev          # Start dev server at localhost:4321

# Build
npm run build        # Build static site to dist/

# Preview
npm run preview      # Preview production build locally

# Update (after Phase 8)
./scripts/update.sh ~/path/to/instagram-export.zip
```

---

## Troubleshooting

**Masonry layout gaps:** Ensure images have explicit width/height or use aspect-ratio CSS.

**Lightbox not closing:** Check event propagation on overlay click.

**Search not finding results:** Verify search-index.json is generated and Fuse.js threshold is appropriate.

**Forms not working:** Netlify Forms require the `netlify` or `data-netlify="true"` attribute and a form name.

**Images not loading:** Check paths start with `/photos/` and files exist in `public/photos/`.
