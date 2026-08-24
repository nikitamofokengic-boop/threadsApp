import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('dist');
const destDir = path.resolve('android/app/src/main/assets/dist');

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(srcDir)) {
  console.log(`Copying web bundle from ${srcDir} to ${destDir}...`);
  copyRecursive(srcDir, destDir);
  console.log('Successfully bundled web assets for Android APK build!');
} else {
  console.error(`Dist directory ${srcDir} does not exist. Run "npm run build" first.`);
}
