/**
 * Blob page script - handles countdown and interactions
 */

import { Logger } from './debug.js';
import { initializeI18n, getI18nMessage } from './ui-utils.js';

const blobLogger = new Logger('BLOB');

// Initialize i18n when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeI18n();

  // Initialize the countdown message
  const closeTimerMessageEl = document.getElementById('closeTimerMessage');
  if (closeTimerMessageEl) {
    closeTimerMessageEl.textContent = getI18nMessage('tabWillCloseIn', ['6']);
  }
});

// Countdown and auto-close
let timeLeft = 6;
const closeTimerMessageEl = document.getElementById('closeTimerMessage');

// Update countdown every second
const countdown = setInterval(() => {
  timeLeft--;
  closeTimerMessageEl.textContent = getI18nMessage('tabWillCloseIn', [timeLeft.toString()]);

  if (timeLeft <= 0) {
    clearInterval(countdown);
    closeTimerMessageEl.textContent = getI18nMessage('tabWillCloseIn', ['0']);

    // Try multiple methods to close the tab
    try {
      // Method 1: Use chrome.tabs API through background script
      chrome.runtime.sendMessage({ type: 'CLOSE_BLOB_TAB' });
    } catch {
      blobLogger.log('Chrome API close failed, trying window.close()');
      // Method 2: Standard window.close()
      window.close();
    }

    // Method 3: Fallback - redirect to about:blank after a short delay
    setTimeout(() => {
      window.location.href = 'about:blank';
    }, 500);
  }
}, 1000);

// Add some interactive blob behavior
const blob = document.querySelector('.blob');

blob.addEventListener('mouseenter', () => {
  blob.style.transform = 'scale(1.1)';
});

blob.addEventListener('mouseleave', () => {
  blob.style.transform = 'scale(1)';
});

// Try to focus the maze tab when clicked
blob.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'FOCUS_MAZE_TAB' });
});

// Make the CTA button clickable
const mazeHint = document.querySelector('.maze-hint');
mazeHint.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'FOCUS_MAZE_TAB' });
});

// Also allow clicking anywhere else to focus maze
document.addEventListener('click', (e) => {
  if (e.target !== blob && !e.target.closest('.blob') && !e.target.closest('.maze-hint')) {
    chrome.runtime.sendMessage({ type: 'FOCUS_MAZE_TAB' });
  }
});
