# CMS Workflow Guide (Future Option)

This documents the fully automated CMS workflow for adding individual photos without Instagram export.

> **Note:** This is more complex to set up. The batch script approach is recommended for bulk imports with Instagram captions.

## Overview

```
Upload photo in CMS → Auto-upload to Cloudinary → AI generates metadata → Review → Save
```

**Use cases:**
- Adding photos not from Instagram
- Non-technical users adding photos
- One-off photo additions

**Limitations:**
- No Instagram captions (AI generates from scratch)
- Less accurate than batch script with captions
- Requires serverless function setup

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Decap CMS Admin                         │
│                   (/admin/index.html)                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudinary Media Library                        │
│         (drag & drop upload, auto-resize)                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           Netlify Serverless Function                        │
│         (netlify/functions/classify-photo.js)               │
│                      │                                       │
│                      ▼                                       │
│              OpenAI Vision API                               │
│         (classify + generate caption)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              CMS Fields Auto-populated                       │
│    (title, description, category, species, location)        │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup Steps

### Step 1: Enable Netlify Identity

1. Go to Netlify Dashboard → Site Settings → Identity
2. Click "Enable Identity"
3. Under Registration, select "Invite only"
4. Under Services, enable "Git Gateway"

### Step 2: Invite Users

1. Identity → Invite users
2. Enter email addresses for CMS access
3. Users receive invite and set password

### Step 3: Set Environment Variables

In Netlify Dashboard → Site Settings → Environment Variables:

```
OPENAI_API_KEY=sk-...
CLOUDINARY_CLOUD_NAME=dsilndqt6
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### Step 4: Create Serverless Function

Create `netlify/functions/classify-photo.js`:

```javascript
const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { imageUrl } = JSON.parse(event.body);

    // Call OpenAI Vision API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this photograph and provide:
1. category: birds, wildlife, landscapes, or flora-macro
2. filter: mountains, waterfalls, cityscapes, or null (only for landscapes)
3. species: specific species name or null
4. location: inferred location or null
5. title: short evocative title (3-8 words)
6. description: 1-2 sentences describing the scene

Respond with JSON only.`
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            }
          ]
        }],
        max_tokens: 300
      })
    });

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    const result = JSON.parse(content.match(/\{[\s\S]*\}/)[0]);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

### Step 5: Configure Cloudinary Media Library

Update `public/admin/config.yml`:

```yaml
backend:
  name: git-gateway
  branch: main

# Cloudinary media library
media_library:
  name: cloudinary
  config:
    cloud_name: dsilndqt6
    api_key: YOUR_CLOUDINARY_API_KEY
    multiple: false
    default_transformations:
      - - fetch_format: auto
          quality: auto
```

### Step 6: Add Custom Widget for AI

Create `public/admin/ai-widget.js`:

```javascript
const AIClassifyButton = createClass({
  handleClick: async function() {
    const imageUrl = this.props.value;
    if (!imageUrl) {
      alert('Please upload an image first');
      return;
    }

    this.setState({ loading: true });

    try {
      const response = await fetch('/.netlify/functions/classify-photo', {
        method: 'POST',
        body: JSON.stringify({ imageUrl })
      });
      const data = await response.json();

      // Update form fields
      this.props.onChange(data);
    } catch (error) {
      alert('AI classification failed: ' + error.message);
    }

    this.setState({ loading: false });
  },

  render: function() {
    return h('button', {
      onClick: this.handleClick,
      disabled: this.state?.loading
    }, this.state?.loading ? 'Classifying...' : 'Generate with AI');
  }
});

CMS.registerWidget('ai-classify', AIClassifyButton);
```

### Step 7: Install Dependencies

```bash
npm install node-fetch@2
```

### Step 8: Deploy and Test

```bash
git add .
git commit -m "Add CMS with AI classification"
git push
```

Access CMS at: `https://your-site.netlify.app/admin/`

---

## User Workflow

1. Go to `/admin/` and log in
2. Click "Photos" → "Add Photo"
3. Click image field → Upload photo (goes to Cloudinary)
4. Click "Generate with AI" button
5. Review auto-filled fields (title, description, category, etc.)
6. Adjust if needed
7. Click "Publish"

---

## Cost Considerations

| Item | Cost |
|------|------|
| OpenAI API | ~$0.001 per photo |
| Cloudinary | Free tier: 25GB storage, 25GB bandwidth/month |
| Netlify Functions | Free tier: 125k invocations/month |

---

## Comparison: Batch Script vs CMS

| Aspect | Batch Script | CMS Workflow |
|--------|--------------|--------------|
| Instagram captions | ✅ Yes | ❌ No |
| AI accuracy | Better | Good |
| Setup complexity | Simple | Complex |
| Bulk processing | ✅ Fast | ❌ One at a time |
| Non-technical users | ❌ Command line | ✅ Web interface |
| Best for | Initial import, Instagram photos | One-off additions |

---

## Files Created (Not Yet Implemented)

The following files need to be created to enable this workflow:

- [ ] `netlify/functions/classify-photo.js` - Serverless function
- [ ] `public/admin/ai-widget.js` - Custom CMS widget
- [ ] Update `public/admin/config.yml` - Cloudinary media library config
- [ ] `package.json` - Add node-fetch dependency

The basic CMS structure (`public/admin/index.html` and `public/admin/config.yml`) is already in place for manual editing.
