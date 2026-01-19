# Next Steps - Photo Gallery Launch Checklist

All 8 implementation phases are complete. This document outlines what's needed to launch the site.

## Completed Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Foundation - Astro site, layouts, navigation | ✅ |
| 2 | Config System - YAML parsing, TypeScript types | ✅ |
| 3 | Gallery - Masonry grid, lightbox, filters | ✅ |
| 4 | Photo Pages - Individual routes, SEO | ✅ |
| 5 | Contact Form - Netlify Forms integration | ✅ |
| 6 | Search - Fuse.js client-side search | ✅ |
| 7 | SEO/Analytics - Sitemap, meta tags, GA | ✅ |
| 8 | Processing Scripts - Instagram pipeline | ✅ |

---

## Pre-Launch Checklist

### 1. Content Setup

- [ ] **Update About Page**
  - Edit `config/about.md` with bio and photographer info

- [ ] **Add Real Photos**
  - Option A: Use the processing pipeline with Instagram export
    ```bash
    ./scripts/update.sh ~/Downloads/instagram-export.zip
    ```
  - Option B: Manually add photos to `public/photos/{category}/` and update `config/photos.yaml`

- [ ] **Update Hero Image**
  - Replace hero image in `config/site.yaml`
  - Upload to Cloudinary and update `cloudinary_id`

### 2. Services Configuration

- [ ] **Cloudinary Setup** (for image hosting)
  1. Create account at [cloudinary.com](https://cloudinary.com)
  2. Get credentials from Dashboard > Settings > API Keys
  3. Set environment variables:
     ```bash
     export CLOUDINARY_CLOUD_NAME="your-cloud-name"
     export CLOUDINARY_API_KEY="your-api-key"
     export CLOUDINARY_API_SECRET="your-api-secret"
     ```
  4. Upload existing photos:
     ```bash
     node scripts/upload-to-cloudinary.cjs
     ```

- [ ] **Google Analytics Setup** (optional)
  1. Follow `docs/google-analytics-setup.md`
  2. Add Measurement ID to `config/site.yaml`:
     ```yaml
     analytics:
       google_analytics_id: "G-XXXXXXXXXX"
     ```

- [ ] **OpenAI API Key** (for photo processing pipeline)
  1. Get API key from [platform.openai.com](https://platform.openai.com)
  2. Set environment variable:
     ```bash
     export OPENAI_API_KEY="sk-..."
     ```

### 3. Netlify Deployment

- [ ] **Connect Repository**
  1. Log in to [netlify.com](https://netlify.com)
  2. Click "Add new site" > "Import an existing project"
  3. Connect your GitHub repository

- [ ] **Configure Build Settings**
  - Build command: `npm run build`
  - Publish directory: `dist`
  - Node version: 18 or higher

- [ ] **Enable Netlify Forms**
  - Forms are auto-detected from `data-netlify="true"` attribute
  - Set up email notifications in Site Settings > Forms > Form notifications

- [ ] **Custom Domain** (optional)
  1. Go to Site Settings > Domain Management
  2. Add custom domain
  3. Configure DNS as instructed

### 4. Final Testing

- [ ] **Local Preview**
  ```bash
  npm run build
  npm run preview
  ```

- [ ] **Test All Pages**
  - Homepage loads with photos
  - All category pages work
  - Individual photo pages display correctly
  - Search finds photos
  - Contact form submits (test in Netlify deploy preview)
  - Mobile responsive layout works

- [ ] **SEO Validation**
  - Check `/sitemap-index.xml` loads
  - Verify meta tags with [metatags.io](https://metatags.io)
  - Test structured data with [Google's Rich Results Test](https://search.google.com/test/rich-results)

---

## Post-Launch Tasks

### Adding New Photos

Use the processing pipeline:
```bash
./scripts/update.sh ~/path/to/new-photos/
```

Or manually:
1. Add photos to `public/photos/{category}/`
2. Update `config/photos.yaml` with new entries
3. Upload to Cloudinary
4. Rebuild and deploy

### Monitoring

- Check Netlify Analytics for traffic
- Review Google Analytics for user behavior
- Monitor form submissions in Netlify dashboard

### Maintenance

- Periodically update dependencies: `npm update`
- Check for Astro updates: `npm outdated`
- Review and respond to contact form submissions

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `CLOUDINARY_CLOUD_NAME` | Yes* | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes* | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes* | Cloudinary API secret |
| `OPENAI_API_KEY` | No | For AI photo classification |
| `OLLAMA_HOST` | No | Local Ollama server (default: localhost:11434) |
| `OLLAMA_MODEL` | No | Ollama vision model (default: llava) |

*Required if using Cloudinary for image hosting

---

## Useful Commands

```bash
# Development
npm run dev           # Start dev server

# Build & Preview
npm run build         # Build static site
npm run preview       # Preview production build

# Photo Processing
./scripts/update.sh <path>  # Full pipeline

# Individual Steps
node scripts/process-export.js <path>   # Extract photos
node scripts/classify-images.js         # Classify with AI
node scripts/generate-captions.js       # Generate captions
node scripts/update-photos-yaml.js      # Update config

# Cloudinary Upload
node scripts/upload-to-cloudinary.cjs   # Upload all photos
```

---

## Support

- Astro Documentation: [docs.astro.build](https://docs.astro.build)
- Netlify Documentation: [docs.netlify.com](https://docs.netlify.com)
- Cloudinary Documentation: [cloudinary.com/documentation](https://cloudinary.com/documentation)
