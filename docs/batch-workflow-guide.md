# Batch Processing Workflow Guide

This is the recommended approach for adding photos from Instagram exports.

## Overview

```
Instagram Export (with captions) → Batch Script (AI) → photos.yaml → Build → Deploy
```

**Advantages:**
- Uses your Instagram captions for better descriptions
- AI cleans up and formats (doesn't generate from scratch)
- Cost-effective (~$2 for 1,700 photos)
- Bulk processing is efficient

---

## Configuration Checklist

### 1. Environment Variables

Add these to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
# Required: OpenAI API key
export OPENAI_API_KEY="sk-..."

# Required: Cloudinary credentials
export CLOUDINARY_CLOUD_NAME="dsilndqt6"
export CLOUDINARY_API_KEY="your-api-key"
export CLOUDINARY_API_SECRET="your-api-secret"
```

Reload your shell:
```bash
source ~/.zshrc
```

### 2. Verify Configuration

```bash
# Check environment variables are set
echo $OPENAI_API_KEY
echo $CLOUDINARY_CLOUD_NAME
```

### 3. Project Structure

Ensure these directories exist:
```
photos/
├── posts/              # Existing photos (YYYYMM folders)
├── instagram-export/   # New Instagram export goes here
│   ├── content/
│   │   └── posts_1.json   # Captions
│   └── media/
│       └── posts/         # Photos
```

---

## Step-by-Step Process

### Step 1: Export from Instagram

1. Go to **Instagram.com** → Settings → **Your Activity** → **Download Your Information**
2. Select **"Some of your information"**
3. Check:
   - ✅ **Posts** (includes captions)
   - ✅ **Photos and videos**
4. Format: **JSON**
5. Request download and wait for email

### Step 2: Extract Export

```bash
cd /Users/sanzgiri/photo-gallery-claude-code

# Extract to instagram-export folder
unzip ~/Downloads/instagram-*.zip -d photos/instagram-export/
```

### Step 3: Check Status

```bash
node scripts/batch-process.js --status
```

Expected output:
```
========================================
  Batch Processing Status
========================================

Total photos: 1676
Processed: 0
  - Successful: 0
  - Failed: 0
Pending: 1676

Cost Summary:
  Input tokens: 0
  Output tokens: 0
  Total cost: $0.0000
```

### Step 4: Run Test Batch

Start with a small batch to verify everything works:

```bash
node scripts/batch-process.js --batch-size 10
```

Review the output:
- Check category classifications are correct
- Check titles make sense
- Check costs are as expected (~$0.01 for 10 photos)

### Step 5: Process All Photos

Run in batches of 100:

```bash
# First batch
node scripts/batch-process.js --batch-size 100

# Continue until complete (run multiple times)
node scripts/batch-process.js --batch-size 100
```

Progress is saved after each photo. You can stop and resume anytime.

### Step 6: Build and Preview

```bash
npm run build
npm run preview
```

Open http://localhost:4321 and verify:
- Photos appear in correct categories
- Titles and descriptions look good
- Search works
- Lightbox works

### Step 7: Deploy

```bash
git add .
git commit -m "Add photos from Instagram export $(date +%Y-%m-%d)"
git push
```

Netlify auto-deploys from the push.

---

## Testing Checklist

### Before Processing
- [ ] OpenAI API key is set
- [ ] Cloudinary credentials are set
- [ ] Instagram export is extracted
- [ ] `posts_1.json` exists (for captions)

### After Processing
- [ ] `config/photos.yaml` has new entries
- [ ] Photos copied to `public/photos/{category}/`
- [ ] Photos uploaded to Cloudinary
- [ ] Build completes without errors

### After Deployment
- [ ] Site loads correctly
- [ ] All categories show photos
- [ ] Individual photo pages work
- [ ] Search finds photos
- [ ] Contact form works

---

## Troubleshooting

### "No Instagram captions found"
- Check `photos/instagram-export/content/posts_1.json` exists
- The script checks multiple locations automatically

### Rate limit errors
- Wait a few minutes and run again
- Progress is saved, it will resume

### Wrong category classification
- Edit `config/photos.yaml` manually or via CMS
- Or adjust and re-run for specific photos

### Reset and start over
```bash
rm scripts/batch-progress.json
```

---

## Cost Tracking

The script tracks costs in real-time:

```
[1/100] 202401/photo1.jpg
  ✓ birds - "Great Blue Heron at Dawn" ($0.0012)
[2/100] 202401/photo2.jpg
  ✓ landscapes - "Mountain Lake Reflection" ($0.0011)
...

Batch cost: $0.1234
Total cost so far: $0.1234
```

Check cumulative costs anytime:
```bash
node scripts/batch-process.js --status
```

---

## Ongoing Workflow

For future Instagram exports:

1. Export new photos from Instagram (with captions)
2. Extract to `photos/instagram-export/`
3. Run batch script
4. Review and deploy

The script automatically skips already-processed photos.
