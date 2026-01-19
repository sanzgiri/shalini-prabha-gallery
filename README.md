# Shalini Prabha Photography Gallery

Photography portfolio and print inquiry website built with Astro and hosted on Netlify.

## For Claude Code

**Start here.** This project should be built in phases.

### Documentation

1. **REQUIREMENTS.md** - High-level project requirements and specs
2. **IMPLEMENTATION_GUIDE.md** - Detailed phased build instructions with acceptance criteria

### Sample Data

The `config/` folder contains pre-populated YAML files with sample photo data. Use these for development and testing before connecting the AI processing pipeline.

### Build Order

```
Phase 1: Foundation      → Basic Astro site, layout, navigation
Phase 2: Config System   → YAML parsing, TypeScript types
Phase 3: Gallery         → Masonry grid, lightbox, filtering
Phase 4: Photo Pages     → Individual photo routes, SEO
Phase 5: Contact/Forms   → Netlify Forms integration
Phase 6: Search          → Fuse.js client-side search
Phase 7: SEO/Analytics   → Meta tags, sitemap, GA
Phase 8: Scripts         → Instagram processing pipeline
```

### Quick Commands

```bash
# Start Phase 1
npm create astro@latest . -- --template minimal --install --git
npm install js-yaml fuse.js sharp @astrojs/sitemap

# Development
npm run dev

# Build & Preview
npm run build
npm run preview
```

## Project Structure

```
├── config/
│   ├── site.yaml          # Site configuration
│   ├── categories.yaml    # Gallery categories
│   ├── photos.yaml        # Photo metadata
│   └── about.md           # About page content
├── src/
│   ├── components/        # Astro components
│   ├── layouts/           # Page layouts
│   ├── pages/             # Route pages
│   └── utils/             # Helper functions
├── public/
│   └── photos/            # Image files
├── scripts/               # Processing scripts (Phase 8)
├── REQUIREMENTS.md        # Project requirements
└── IMPLEMENTATION_GUIDE.md # Build instructions
```

## License

All photographs © Shalini Prabha. All rights reserved.
