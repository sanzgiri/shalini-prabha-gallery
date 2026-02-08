# Shalini Prabha Photography Gallery

Photography portfolio and print inquiry website built with Astro and hosted on Netlify.

## For Claude Code

**Start here.** This project should be built in phases.

### Documentation

1. **REQUIREMENTS.md** - High-level project requirements and specs
2. **IMPLEMENTATION\_GUIDE.md** - Detailed phased build instructions with acceptance criteria

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

## Managing Photos (Cloudinary)

The site reads photo metadata from `config/photos.yaml`. If your images are already in Cloudinary, you only need to update this file.

### Quick remove/add via script

```bash
# Remove by Cloudinary URL or public ID
node scripts/manage-photos.js remove \
  "https://res.cloudinary.com/<cloud>/image/upload/.../photo-gallery/birds/example" \
  "photo-gallery/birds/another-photo"

# Add a photo
node scripts/manage-photos.js add \
  --category birds \
  --title "My Photo" \
  --description "Short description." \
  --cloudinary-id "photo-gallery/birds/my-photo" \
  --date 2025-01-15 \
  --filters "coast,sunrise"
```

### Import a folder with Instagram metadata

If you have a folder of images plus Instagram export metadata (e.g. `posts_1.json`), you can run:

```bash
node scripts/import-instagram-folder.js /path/to/folder \
  --metadata /path/to/posts_1.json
```

The script will:
- Copy images to `public/photos/pending`
- Attach Instagram caption/date/location from metadata
- Classify category/species/location with AI (Ollama/OpenAI)
- Generate title/description
- Upload to Cloudinary (if env vars are set)
- Update `config/photos.yaml`

### Add a photo

1. Upload the image to Cloudinary (or use an existing asset).
2. Add a new entry under `photos:` in `config/photos.yaml`:

```yaml
  - id: "birds-123"                # unique
    filename: "my-photo.jpg"       # any name (used by scripts)
    slug: "my-photo"               # unique, used in URL
    category: "birds"              # must match categories.yaml
    filters: []                    # or ["mountains"]
    species: "Great Blue Heron"    # or null
    location: "Pacific Northwest"  # or null
    title: "My Photo"
    description: "Short description."
    date_taken: "2025-01-15"
    available_for_print: true
    cloudinary_id: "photo-gallery/birds/my-photo"
    width: 1440                    # optional but recommended
    height: 960                    # optional but recommended
```

### Remove a photo

- Delete its entry from `config/photos.yaml` and push.
- Optionally delete the asset in Cloudinary to reclaim storage.

## License

All photographs © Shalini Prabha. All rights reserved.
