# Batch Processing Guide

This guide explains how to process your Instagram photos and add them to the gallery.

## Prerequisites

- OpenAI API key (get one at [platform.openai.com](https://platform.openai.com))
- Cloudinary credentials (already configured)

## Step 1: Export from Instagram

1. Go to **Instagram.com** → Settings → **Your Activity** → **Download Your Information**
2. Select **"Some of your information"**
3. Check these boxes:
   - ✅ **Posts** (includes captions in JSON)
   - ✅ **Photos and videos**
4. Choose **JSON** format (not HTML)
5. Select date range (or all time)
6. Request download
7. Wait for email notification (can take up to 48 hours)
8. Download the zip file

## Step 2: Extract the Export

```bash
# Navigate to project directory
cd /Users/sanzgiri/photo-gallery-claude-code

# Extract the Instagram export
unzip ~/Downloads/instagram-*.zip -d photos/instagram-export/
```

The export structure should look like:
```
photos/instagram-export/
├── content/
│   └── posts_1.json      # Captions and metadata
├── media/
│   └── posts/            # Photo files
│       ├── 202401/
│       ├── 202402/
│       └── ...
```

## Step 3: Set Environment Variables

```bash
# Required: OpenAI API key
export OPENAI_API_KEY="sk-..."

# Optional: Cloudinary (if not already in environment)
export CLOUDINARY_CLOUD_NAME="dsilndqt6"
export CLOUDINARY_API_KEY="your-api-key"
export CLOUDINARY_API_SECRET="your-api-secret"
```

## Step 4: Check Status

```bash
node scripts/batch-process.js --status
```

This shows:
- Total photos found
- Already processed count
- Pending count
- Cost summary

## Step 5: Process in Batches

```bash
# Process 100 photos at a time (recommended)
node scripts/batch-process.js --batch-size 100
```

Each photo will show:
- Category classification (birds, wildlife, landscapes, flora-macro)
- Generated title
- Cost for that photo

After each batch completes, you'll see:
```
========================================
Batch complete!
  Successful: 100
  Failed: 0
  Remaining: 1576

Batch cost: $0.1234
Total cost so far: $0.1234
========================================
```

## Step 6: Continue Processing

Run the same command again to process the next batch:

```bash
node scripts/batch-process.js --batch-size 100
```

Progress is automatically saved. You can stop and resume anytime.

## Step 7: Review and Build

After all photos are processed:

```bash
# Build the site
npm run build

# Preview locally
npm run preview
```

Review the site at http://localhost:4321

## Step 8: Deploy

```bash
git add .
git commit -m "Add photos from Instagram export"
git push
```

Netlify will automatically build and deploy.

---

## Command Reference

| Command | Description |
|---------|-------------|
| `node scripts/batch-process.js --status` | Show progress and cost |
| `node scripts/batch-process.js --batch-size 50` | Process 50 photos |
| `node scripts/batch-process.js --batch-size 100` | Process 100 photos |
| `node scripts/batch-process.js --dry-run` | Preview without processing |
| `node scripts/batch-process.js --folder 202401` | Process specific month |

## Cost Estimates

Using `gpt-4o-mini`:
- ~$0.001 per photo
- 1,700 photos ≈ $1.50 - $2.00 total

## Troubleshooting

**"OPENAI_API_KEY environment variable required"**
```bash
export OPENAI_API_KEY="sk-..."
```

**Rate limit errors**
- The script has built-in delays
- If you hit limits, wait a few minutes and run again

**Resume after interruption**
- Progress is saved after each photo
- Just run the command again to continue

**Reset progress and start over**
```bash
rm scripts/batch-progress.json
```
