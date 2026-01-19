# Google Analytics 4 Setup Guide

This guide walks you through creating a Google Analytics 4 (GA4) property and getting your Measurement ID for the photography portfolio site.

## Prerequisites

- A Google account (Gmail or Google Workspace)

## Step 1: Access Google Analytics

1. Go to [analytics.google.com](https://analytics.google.com)
2. Sign in with your Google account
3. If this is your first time, click **Start measuring**

## Step 2: Create an Account

1. Enter an **Account name** (e.g., "Shalini Prabha Photography")
2. Configure data sharing settings as preferred
3. Click **Next**

## Step 3: Create a Property

1. Enter a **Property name** (e.g., "Photography Portfolio")
2. Select your **Reporting time zone**
3. Select your **Currency**
4. Click **Next**

## Step 4: Business Details

1. Select your **Industry category** (Arts & Entertainment)
2. Select your **Business size**
3. Click **Next**

## Step 5: Business Objectives

1. Select the objectives that apply:
   - "Get baseline reports" is a good starting point
   - "Examine user behavior" for understanding how visitors navigate
2. Click **Create**

## Step 6: Set Up Data Stream

1. Select **Web** as your platform
2. Enter your website URL: `https://shalini-prabha.netlify.app`
3. Enter a **Stream name** (e.g., "Portfolio Website")
4. Click **Create stream**

## Step 7: Get Your Measurement ID

After creating the stream, you'll see your **Measurement ID** displayed. It looks like:

```
G-XXXXXXXXXX
```

Copy this ID.

## Step 8: Add to Your Site

1. Open `config/site.yaml` in your project
2. Find the `analytics` section
3. Add your Measurement ID:

```yaml
analytics:
  google_analytics_id: "G-XXXXXXXXXX"
```

4. Rebuild and deploy your site

## Verification

After deployment:

1. Visit your live site
2. Go to Google Analytics > Reports > Realtime
3. You should see your visit appear within a few seconds

## Additional Resources

- [Google Analytics Help Center](https://support.google.com/analytics)
- [GA4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
