const fs = require('fs');
const path = require('path');

const prismaCacheDir = path.join(process.cwd(), 'node_modules', '.prisma');

if (fs.existsSync(prismaCacheDir)) {
  fs.rmSync(prismaCacheDir, { recursive: true, force: true });
  console.log(`Removed stale Prisma cache: ${prismaCacheDir}`);
} else {
  console.log(`No stale Prisma cache found at ${prismaCacheDir}`);
}
