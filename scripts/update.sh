#!/bin/bash

# update.sh - Main pipeline script for adding new photos
#
# Usage:
#   ./scripts/update.sh <path-to-instagram-export.zip>
#   ./scripts/update.sh <path-to-folder-with-images>
#
# Environment variables (optional):
#   OPENAI_API_KEY        - For OpenAI vision API (recommended)
#   OLLAMA_HOST           - Ollama host (default: http://localhost:11434)
#   OLLAMA_MODEL          - Ollama model (default: llava)
#   CLOUDINARY_CLOUD_NAME - For Cloudinary uploads
#   CLOUDINARY_API_KEY    - For Cloudinary uploads
#   CLOUDINARY_API_SECRET - For Cloudinary uploads

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Change to project directory
cd "$PROJECT_DIR"

# Check for input path
if [ -z "$1" ]; then
    echo -e "${RED}Error: No input path provided${NC}"
    echo ""
    echo "Usage:"
    echo "  ./scripts/update.sh <path-to-instagram-export.zip>"
    echo "  ./scripts/update.sh <path-to-folder-with-images>"
    echo ""
    echo "Example:"
    echo "  ./scripts/update.sh ~/Downloads/instagram-export.zip"
    echo "  ./scripts/update.sh ~/Pictures/new-photos/"
    exit 1
fi

INPUT_PATH="$1"

# Check if input exists
if [ ! -e "$INPUT_PATH" ]; then
    echo -e "${RED}Error: File or folder not found: $INPUT_PATH${NC}"
    exit 1
fi

echo ""
echo "========================================"
echo "  Photo Gallery Update Pipeline"
echo "========================================"
echo ""

# Check for AI configuration
if [ -n "$OPENAI_API_KEY" ]; then
    echo -e "${GREEN}✓${NC} Using OpenAI API for classification"
elif command -v ollama &> /dev/null; then
    echo -e "${GREEN}✓${NC} Using Ollama for classification"
else
    echo -e "${YELLOW}!${NC} No AI configured. Install Ollama or set OPENAI_API_KEY"
    echo "  Classification and captioning will use fallback values."
fi

# Check for Cloudinary
if [ -n "$CLOUDINARY_CLOUD_NAME" ] && [ -n "$CLOUDINARY_API_KEY" ]; then
    echo -e "${GREEN}✓${NC} Cloudinary configured for uploads"
else
    echo -e "${YELLOW}!${NC} Cloudinary not configured. Photos stored locally only."
fi

echo ""

# Step 1: Process export
echo -e "${YELLOW}Step 1/4:${NC} Processing export..."
node scripts/process-export.js "$INPUT_PATH"

# Check if there are photos to process
if [ ! -f "$SCRIPT_DIR/pending-photos.json" ]; then
    echo ""
    echo -e "${YELLOW}No new photos to process.${NC}"
    exit 0
fi

PHOTO_COUNT=$(node -e "console.log(require('./scripts/pending-photos.json').length)")
if [ "$PHOTO_COUNT" -eq 0 ]; then
    echo ""
    echo -e "${YELLOW}No new photos to process.${NC}"
    exit 0
fi

echo ""

# Step 2: Classify images
echo -e "${YELLOW}Step 2/4:${NC} Classifying images..."
node scripts/classify-images.js
echo ""

# Step 3: Generate captions
echo -e "${YELLOW}Step 3/4:${NC} Generating captions..."
node scripts/generate-captions.js
echo ""

# Step 4: Update photos.yaml
echo -e "${YELLOW}Step 4/4:${NC} Updating photos.yaml..."
node scripts/update-photos-yaml.js
echo ""

echo "========================================"
echo ""

# Build site
echo -e "${YELLOW}Building site...${NC}"
npm run build
echo ""

# Preview prompt
echo -e "${GREEN}Preview the site?${NC}"
read -p "Start preview server? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting preview server at http://localhost:4321"
    echo "Press Ctrl+C to stop the server when done."
    echo ""
    npm run preview &
    PREVIEW_PID=$!

    # Wait for user to be done previewing
    echo ""
    read -p "Press Enter when done previewing..."
    kill $PREVIEW_PID 2>/dev/null || true
fi

# Deploy prompt
echo ""
echo -e "${GREEN}Deploy changes?${NC}"
read -p "Commit and push to deploy? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Committing changes..."
    git add .
    git commit -m "Add new photos $(date +%Y-%m-%d)"

    echo "Pushing to remote..."
    git push

    echo ""
    echo -e "${GREEN}Deployed!${NC} Netlify will build and deploy automatically."
else
    echo ""
    echo "Changes not committed. To deploy later:"
    echo "  git add ."
    echo "  git commit -m 'Add new photos'"
    echo "  git push"
fi

echo ""
echo "Done!"
