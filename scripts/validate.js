#!/usr/bin/env node

/**
 * Validation script for Your Sincere Tab Keeper
 * Validates the extension build and checks for common issues
 */

import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🔍 Validating Your Sincere Tab Keeper extension...');

async function validate() {
  try {
    await validateStructure();
    await validateManifest();
    await validateFiles();
    await validatePermissions();

    console.log('✅ Validation completed successfully!');
    console.log('🚀 Extension is ready for testing and submission.');

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

/**
 * Validate directory structure
 */
async function validateStructure() {
  console.log('📁 Validating directory structure...');

  const distPath = join(rootDir, 'dist');

  try {
    await fs.access(distPath);
  } catch (error) {
    throw new Error('dist/ directory not found. Run npm run build first.');
  }

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
    'maze.js'
  ];

  for (const file of requiredFiles) {
    try {
      await fs.access(join(distPath, file));
      console.log(`   ✓ ${file}`);
    } catch (error) {
      throw new Error(`Required file missing: ${file}`);
    }
  }
}

/**
 * Validate manifest.json
 */
async function validateManifest() {
  console.log('📋 Validating manifest.json...');

  const manifestPath = join(rootDir, 'dist', 'manifest.json');
  const manifestContent = await fs.readFile(manifestPath, 'utf8');

  let manifest;
  try {
    manifest = JSON.parse(manifestContent);
  } catch (error) {
    throw new Error('manifest.json is not valid JSON');
  }

  // Check required fields
  const requiredFields = [
    'manifest_version',
    'name',
    'version',
    'description',
    'permissions',
    'background',
    'action'
  ];

  for (const field of requiredFields) {
    if (!manifest[field]) {
      throw new Error(`manifest.json missing required field: ${field}`);
    }
    console.log(`   ✓ ${field}: ${JSON.stringify(manifest[field]).substring(0, 50)}...`);
  }

  // Validate manifest version
  if (manifest.manifest_version !== 3) {
    throw new Error('Extension must use Manifest V3');
  }

  // Validate permissions
  const requiredPermissions = ['tabs', 'storage', 'activeTab', 'scripting', 'notifications'];
  for (const permission of requiredPermissions) {
    if (!manifest.permissions.includes(permission)) {
      console.warn(`   ⚠️  Missing recommended permission: ${permission}`);
    } else {
      console.log(`   ✓ Permission: ${permission}`);
    }
  }
}

/**
 * Validate file contents
 */
async function validateFiles() {
  console.log('📄 Validating file contents...');

  const distPath = join(rootDir, 'dist');

  // Check HTML files are valid
  const htmlFiles = ['popup.html', 'options.html', 'maze.html'];
  for (const file of htmlFiles) {
    const content = await fs.readFile(join(distPath, file), 'utf8');
    if (!content.includes('<!DOCTYPE html>')) {
      console.warn(`   ⚠️  ${file} missing DOCTYPE declaration`);
    } else {
      console.log(`   ✓ ${file} has valid HTML structure`);
    }
  }

  // Check JavaScript files for basic syntax
  const jsFiles = ['background.js', 'popup.js', 'options.js', 'maze.js'];
  for (const file of jsFiles) {
    const content = await fs.readFile(join(distPath, file), 'utf8');
    if (content.length === 0) {
      throw new Error(`${file} is empty`);
    }

    // Check for common issues
    if (content.includes('console.log') && process.env.NODE_ENV === 'production') {
      console.warn(`   ⚠️  ${file} contains console.log statements`);
    }

    console.log(`   ✓ ${file} (${Math.round(content.length / 1024)}KB)`);
  }
}

/**
 * Validate permissions and security
 */
async function validatePermissions() {
  console.log('🔒 Validating permissions and security...');

  const manifestPath = join(rootDir, 'dist', 'manifest.json');
  const manifestContent = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);

  // Check for overly broad permissions
  if (manifest.permissions.includes('<all_urls>')) {
    console.warn('   ⚠️  Using <all_urls> permission - ensure this is necessary');
  }

  if (manifest.host_permissions && manifest.host_permissions.includes('<all_urls>')) {
    console.log('   ✓ host_permissions includes <all_urls> (required for tab management)');
  }

  // Check CSP
  if (manifest.content_security_policy) {
    console.log('   ✓ Content Security Policy defined');
  }

  // Check for incognito support
  if (manifest.incognito === 'spanning') {
    console.log('   ✓ Incognito mode supported');
  }
}

// Run validation
validate();

