# Shalini Prabha Photography Gallery - Requirements Summary

## Project Overview

Photography portfolio website with print inquiry system.

- **Tech Stack:** Astro, Netlify (free tier), Netlify Forms, Google Analytics
- **URL:** `[site-name].netlify.app`
- **Design:** Minimal, white background, photo-focused

## Site Structure

```
Homepage
├── Sticky header (logo + nav + search)
├── Hero image (configurable)
└── Photo wall (masonry, recent or random)

Category Galleries (/birds, /wildlife, /landscapes, /flora-macro)
├── Masonry grid of photos
├── Filter bar (Landscapes only: Mountains, Waterfalls, Cityscapes)
└── Click → Lightbox

Photo Detail Pages (/birds/[slug], etc.)
├── Large image
├── Title, description, species, location
├── "Request Print" button → Contact form
└── Prev/Next navigation

Other Pages
├── /about - Markdown bio
├── /contact - Netlify Forms
└── /search - Fuse.js client-side search
```

## Key Features

### Photo Display
- Masonry grid layout (preserves aspect ratios)
- Lightbox for quick browsing (arrow keys, ESC to close)
- Dedicated pages for SEO and sharing
- Responsive images

### Navigation
- Sticky header with category links
- Mobile hamburger menu
- Search bar in header

### Print Sales
- Inquiry-based (no e-commerce)
- "Contact for Print Options" button
- Pre-populates contact form with photo reference

### Configuration
All content via YAML/Markdown files in `/config`:
- `site.yaml` - site name, hero, social links, analytics
- `categories.yaml` - category definitions and filters
- `photos.yaml` - photo metadata (AI-generated, manually editable)
- `about.md` - bio content

### SEO
- Descriptive URLs (`/birds/resplendent-quetzal`)
- Meta tags (title, description, Open Graph)
- Schema.org ImageObject structured data
- Auto-generated sitemap
- Google Analytics

### Update Workflow
1. Export Instagram data (zip)
2. Run: `./scripts/update.sh path/to/export.zip`
3. Script: extracts → classifies → captions → updates YAML → builds → deploys

## Design Specs

### Colors
- Background: White (#FFFFFF)
- Text: Dark gray (#1a1a1a)
- Accent: Minimal (let photos be the color)

### Typography
- System fonts (fast loading)
- Clean, readable

### Layout
- Max content width: ~1400px
- Generous whitespace
- Photos as hero elements

## Technical Constraints

### Netlify Free Tier
- 100GB bandwidth/month
- 300 build minutes/month
- 100 form submissions/month

### Image Handling
- Photos have existing watermarks (no processing needed)
- Generate responsive sizes at build time
- Start with Netlify hosting; migrate to Cloudinary if quota issues

### Performance Targets
- Lighthouse Performance: >90
- First Contentful Paint: <1.5s

## Out of Scope (Future)
- Custom domain
- Print-on-demand integration
- Newsletter signup
- Bird sub-filtering by species/location
- Multi-language support
