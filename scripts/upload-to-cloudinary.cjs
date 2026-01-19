const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configure Cloudinary - use environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const photosDir = path.join(__dirname, '..', 'public', 'photos');

// Get all photos organized by folder
function getPhotos() {
  const photos = [];
  const categories = ['birds', 'wildlife', 'landscapes', 'flora-macro'];

  // Hero image
  const heroPath = path.join(photosDir, 'hero.jpg');
  if (fs.existsSync(heroPath)) {
    photos.push({ path: heroPath, folder: 'photo-gallery', publicId: 'hero' });
  }

  // Category photos
  for (const category of categories) {
    const categoryDir = path.join(photosDir, category);
    if (fs.existsSync(categoryDir)) {
      const files = fs.readdirSync(categoryDir);
      for (const file of files) {
        if (/\.(jpg|jpeg|png|webp)$/i.test(file)) {
          const name = path.basename(file, path.extname(file));
          photos.push({
            path: path.join(categoryDir, file),
            folder: `photo-gallery/${category}`,
            publicId: name
          });
        }
      }
    }
  }

  return photos;
}

async function uploadPhoto(photo) {
  const result = await cloudinary.uploader.upload(photo.path, {
    folder: photo.folder,
    public_id: photo.publicId,
    overwrite: true,
    resource_type: 'image'
  });
  return result;
}

async function main() {
  const photos = getPhotos();
  console.log(`Found ${photos.length} photos to upload\n`);

  const results = [];

  for (const photo of photos) {
    const name = `${photo.folder}/${photo.publicId}`;
    process.stdout.write(`Uploading ${name}... `);

    try {
      const result = await uploadPhoto(photo);
      console.log('✓');
      results.push({
        publicId: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height
      });
    } catch (err) {
      console.log(`✗ ${err.message}`);
    }
  }

  console.log('\n--- Upload Complete ---\n');
  console.log('Uploaded URLs:\n');

  for (const r of results) {
    console.log(`${r.publicId}: ${r.url}`);
  }

  // Save results to JSON file
  const outputPath = path.join(__dirname, 'cloudinary-urls.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${outputPath}`);
}

main().catch(console.error);
