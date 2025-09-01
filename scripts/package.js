#!/usr/bin/env node

/**
 * Chrome Web Store packaging script
 * Creates production-ready ZIP file for Chrome Web Store submission
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('📦 Packaging Your Sincere Tab Keeper for Chrome Web Store...');

async function packageExtension() {
  try {
    // Ensure we have a fresh build
    console.log('🔨 Building extension...');
    await execAsync('npm run build', { cwd: rootDir });

    // Read manifest for version info
    const manifestPath = join(rootDir, 'dist', 'manifest.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    const version = manifest.version;

    // Create packages directory
    const packagesDir = join(rootDir, 'packages');
    try {
      await fs.mkdir(packagesDir, { recursive: true });
    } catch {
      // Directory might already exist
    }

    // Clean up any existing package for this version
    const zipName = `your-sincere-tab-keeper-v${version}.zip`;
    const zipPath = join(packagesDir, zipName);

    try {
      await fs.unlink(zipPath);
      console.log(`🗑️ Removed existing package: ${zipName}`);
    } catch {
      // File might not exist
    }

    console.log(`📂 Creating package: ${zipName}`);

    // Create ZIP file with proper exclusions
    const excludePatterns = [
      '*.DS_Store',
      '*.git*',
      '*.log',
      'node_modules/*',
      'src/*',
      '*.map',
      '*.tmp',
      'Thumbs.db'
    ];

    // Use relative path for zip command
    const relativePath = join('..', 'packages', zipName);
    const excludeArgs = excludePatterns.map(pattern => `-x "${pattern}"`).join(' ');
    const zipCommand = `cd dist && zip -r "${relativePath}" . ${excludeArgs}`;

    console.log(`🤐 Running: ${zipCommand}`);
    await execAsync(zipCommand, { cwd: rootDir });

    // Verify ZIP was created and get file size
    const stats = await fs.stat(zipPath);
    const fileSizeKB = (stats.size / 1024).toFixed(1);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log('✅ Package created successfully!');
    console.log(`📁 Location: packages/${zipName}`);
    console.log(`📊 Size: ${fileSizeKB} KB (${fileSizeMB} MB)`);

    // Validate package contents
    console.log('🔍 Validating package contents...');
    const { stdout: zipContents } = await execAsync(`unzip -l "${zipPath}"`, { cwd: rootDir });

    // Check for required files
    const requiredFiles = [
      'manifest.json',
      'background.js',
      'popup.html',
      'options.html',
      'maze.html',
      'blob.html'
    ];

    const missingFiles = requiredFiles.filter(file => !zipContents.includes(file));

    if (missingFiles.length > 0) {
      console.error('❌ Missing required files:', missingFiles);
      process.exit(1);
    }

    // Count total files in package
    const fileCount = zipContents.split('\n')
      .filter(line => line.trim() && !line.includes('-----') && !line.includes('Archive:'))
      .length - 1; // Subtract 1 for the summary line

    console.log(`📄 Total files: ${fileCount}`);

    // Chrome Web Store size limits check
    const maxSizeBytes = 128 * 1024 * 1024; // 128MB limit
    const warningSize = 50 * 1024 * 1024;   // 50MB warning threshold

    if (stats.size > maxSizeBytes) {
      console.error('❌ Package exceeds Chrome Web Store size limit (128MB)!');
      process.exit(1);
    } else if (stats.size > warningSize) {
      console.warn('⚠️ Package size is approaching Chrome Web Store limits. Consider optimization.');
    }

    console.log('🎉 Package validation passed!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Test the extension by loading dist/ as unpacked extension');
    console.log(`2. Upload packages/${zipName} to Chrome Web Store Developer Dashboard`);
    console.log('3. Fill out store listing details and submit for review');
    console.log('');
    console.log('🔗 Chrome Web Store Developer Dashboard:');
    console.log('   https://chrome.google.com/webstore/devconsole/');

    return zipPath;

  } catch (error) {
    console.error('❌ Packaging failed:', error.message);
    process.exit(1);
  }
}

// Run packaging
packageExtension();
