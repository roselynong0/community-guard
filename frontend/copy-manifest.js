import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = ['site.webmanifest', 'browserconfig.xml', 'robots.txt'];
const sourceDir = path.join(__dirname, 'public');
const destDir = path.join(__dirname, 'dist');

console.log('Source dir:', sourceDir);
console.log('Dest dir:', destDir);

files.forEach(file => {
  const src = path.join(sourceDir, file);
  const dest = path.join(destDir, file);
  
  console.log(`Checking ${src}...`);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✅ Copied ${file} to dist/`);
  } else {
    console.warn(`⚠️ ${file} not found at ${src}`);
  }
});
