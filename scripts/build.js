#!/usr/bin/env node

/**
 * Production build script for Your Sincere Tab Keeper
 * Creates optimized build for Chrome Web Store submission
 */

import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🚀 Building Your Sincere Tab Keeper for production...');

async function build() {
  try {
    // Clean previous build
    console.log('🧹 Cleaning previous build...');
    try {
      await fs.rm(join(rootDir, 'dist'), { recursive: true, force: true });
    } catch (error) {
      // Ignore if dist doesn't exist
    }

    // Run Vite build
    console.log('📦 Running Vite build...');
    await runCommand('vite build');

    // Copy manifest from root
    console.log('📋 Copying manifest...');
    await copyManifest();

    // Optimize manifest for production
    console.log('⚙️ Optimizing manifest...');
    await optimizeManifest();

    // Copy assets to build
    console.log('📋 Copying assets...');
    await copyAssets();

    // Flatten HTML files to root
    console.log('📄 Flattening HTML files...');
    await flattenHtmlFiles();

    // Remove development files
    console.log('🗑️ Removing development files...');
    await cleanupDevFiles();

    // Validate build
    console.log('✅ Validating build...');
    await validateBuild();

    console.log('🎉 Production build completed successfully!');
    console.log('📁 Build output: dist/');
    console.log('');
    console.log('Next steps:');
    console.log('1. Test the extension by loading dist/ as unpacked extension');
    console.log('2. Create a ZIP file for Chrome Web Store submission');
    console.log('3. Review all files in dist/ before submission');

  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

/**
 * Run a command and return a promise
 */
function runCommand(command) {
  return new Promise((resolve, reject) => {
    const process = exec(command, { cwd: rootDir });
    
    process.stdout.on('data', (data) => {
      console.log(data.toString());
    });
    
    process.stderr.on('data', (data) => {
      console.error(data.toString());
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

/**
 * Copy manifest.json from root to dist
 */
async function copyManifest() {
  const sourceManifest = join(rootDir, 'manifest.json');
  const destManifest = join(rootDir, 'dist', 'manifest.json');
  
  try {
    const manifestContent = await fs.readFile(sourceManifest, 'utf8');
    await fs.writeFile(destManifest, manifestContent);
    console.log('   ✓ Manifest copied from root');
  } catch (error) {
    throw new Error(`Failed to copy manifest: ${error.message}`);
  }
}

/**
 * Optimize manifest for production
 */
async function optimizeManifest() {
  const manifestPath = join(rootDir, 'dist', 'manifest.json');
  
  try {
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    
    // Update paths for production build (HTML files will be moved to root)
    if (manifest.action && manifest.action.default_popup) {
      manifest.action.default_popup = manifest.action.default_popup.replace('src/', '');
    }
    if (manifest.options_page) {
      manifest.options_page = manifest.options_page.replace('src/', '');
    }
    if (manifest.background && manifest.background.service_worker) {
      manifest.background.service_worker = manifest.background.service_worker.replace('src/', '');
    }
    
    // Remove development-specific fields if any
    // Add production optimizations
    manifest.content_security_policy = {
      extension_pages: "script-src 'self'; object-src 'self'"
    };
    
    // Ensure all required fields are present
    if (!manifest.version) {
      manifest.version = '1.0.0';
    }
    
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('   ✓ Manifest optimized for production');
  } catch (error) {
    throw new Error(`Failed to optimize manifest: ${error.message}`);
  }
}

/**
 * Copy assets from assets/ to dist/
 */
async function copyAssets() {
  const assetsPath = join(rootDir, 'assets');
  const distPath = join(rootDir, 'dist');
  
  try {
    // Check if assets directory exists
    await fs.access(assetsPath);
    
    // Copy entire assets directory to dist
    await fs.cp(assetsPath, join(distPath, 'assets'), { recursive: true });
    
    console.log('   ✓ Assets copied to dist/assets/');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('   ⚠ No assets directory found, skipping...');
    } else {
      throw new Error(`Failed to copy assets: ${error.message}`);
    }
  }
}

/**
 * Move HTML files from dist/src/ to dist/ root
 */
async function flattenHtmlFiles() {
  const distPath = join(rootDir, 'dist');
  const srcPath = join(distPath, 'src');
  
  try {
    // Check if src directory exists in dist
    await fs.access(srcPath);
    
    // Get all HTML files in dist/src/
    const files = await fs.readdir(srcPath);
    const htmlFiles = files.filter(file => file.endsWith('.html'));
    
    // Move each HTML file to dist root
    for (const file of htmlFiles) {
      const srcFile = join(srcPath, file);
      const destFile = join(distPath, file);
      await fs.rename(srcFile, destFile);
      console.log(`   ✓ Moved ${file} to root`);
    }
    
    // Remove empty src directory if it's empty
    try {
      const remainingFiles = await fs.readdir(srcPath);
      if (remainingFiles.length === 0) {
        await fs.rmdir(srcPath);
        console.log('   ✓ Removed empty src directory');
      }
    } catch (error) {
      // Ignore if directory not empty or doesn't exist
    }
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('   ⚠ No src directory found in dist, skipping...');
    } else {
      throw new Error(`Failed to flatten HTML files: ${error.message}`);
    }
  }
}

/**
 * Remove development files from build
 */
async function cleanupDevFiles() {
  const distPath = join(rootDir, 'dist');
  
  // Files and patterns to remove from production build
  const devFiles = [
    'README.md',
    '.gitignore',
    'package.json',
    'package-lock.json',
    'vite.config.js',
    'scripts',
    'node_modules'
  ];
  
  for (const file of devFiles) {
    try {
      await fs.rm(join(distPath, file), { recursive: true, force: true });
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }
  
  console.log('   ✓ Development files cleaned');
}

/**
 * Validate the build output
 */
async function validateBuild() {
  const distPath = join(rootDir, 'dist');
  
  // Check required files
  const requiredFiles = [
    'manifest.json',
    'background.js',
    'popup.html',
    'popup.css',
    'popup.js',
    'options.html',
    'options.css',
    'options.js',
    'maze.html',
    'maze.css',
    'maze.js',
    'blob.html',
    'blob.js'
  ];
  
  for (const file of requiredFiles) {
    try {
      await fs.access(join(distPath, file));
      console.log(`   ✓ ${file} exists`);
    } catch (error) {
      throw new Error(`Required file missing: ${file}`);
    }
  }
  
  // Validate manifest
  try {
    const manifestContent = await fs.readFile(join(distPath, 'manifest.json'), 'utf8');
    const manifest = JSON.parse(manifestContent);
    
    if (!manifest.name || !manifest.version || !manifest.manifest_version) {
      throw new Error('Manifest missing required fields');
    }
    
    console.log(`   ✓ Manifest valid (v${manifest.version})`);
  } catch (error) {
    throw new Error(`Invalid manifest: ${error.message}`);
  }
  
  console.log('   ✓ Build validation passed');
}

// Run the build
build();

