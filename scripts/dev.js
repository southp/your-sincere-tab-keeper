#!/usr/bin/env node

/**
 * Development script for Your Sincere Tab Keeper
 * Starts Vite dev server with HMR for Chrome extension development
 */

import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🚀 Starting Your Sincere Tab Keeper development server...');
console.log('📝 Instructions:');
console.log('   1. Open Chrome and go to chrome://extensions/');
console.log('   2. Enable "Developer mode"');
console.log('   3. Click "Load unpacked" and select the dist/ folder');
console.log('   4. The extension will auto-reload when you make changes');
console.log('');

const devProcess = exec('vite', { cwd: rootDir });

devProcess.stdout.on('data', (data) => {
  console.log(data.toString());
});

devProcess.stderr.on('data', (data) => {
  console.error(data.toString());
});

devProcess.on('close', (code) => {
  console.log(`Development server exited with code ${code}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  devProcess.kill('SIGINT');
  process.exit(0);
});

