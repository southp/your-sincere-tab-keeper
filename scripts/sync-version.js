#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function syncVersion() {
  try {
    // Read manifest.json
    const manifestPath = join(projectRoot, 'manifest.json');
    const manifestContent = readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    const version = manifest.version;

    if (!version) {
      throw new Error('No version found in manifest.json');
    }

    console.log(`Syncing version ${version} from manifest.json to package.json`);

    // Read package.json
    const packagePath = join(projectRoot, 'package.json');
    const packageContent = readFileSync(packagePath, 'utf8');
    const packageJson = JSON.parse(packageContent);

    // Update version
    packageJson.version = version;

    // Write back to package.json with proper formatting
    const updatedContent = JSON.stringify(packageJson, null, 2) + '\n';
    writeFileSync(packagePath, updatedContent);

    console.log(`✅ Successfully updated package.json version to ${version}`);
  } catch (error) {
    console.error('❌ Error syncing version:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  syncVersion();
}

export { syncVersion };
