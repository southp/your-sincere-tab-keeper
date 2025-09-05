/**
 * Your Sincere Tab Keeper - Popup Script
 * Handles popup UI interactions and displays current stats
 */

import { Logger } from './debug.js';
import { isSpecialTab, isMazeTab } from './utils.js';
import { initializeI18n, getI18nMessage } from './ui-utils.js';
import { getMazeSessionData } from './maze/maze-session.js';

// Create scoped logger for popup functionality
const popupLogger = new Logger('POPUP');

// DOM elements
const currentLimitEl = document.getElementById('currentLimit');
const tabCountEl = document.getElementById('tabCount');
const mazesCompletedEl = document.getElementById('mazesCompleted');
const blockedAttemptsEl = document.getElementById('blockedAttempts');
const updateLimitBtn = document.getElementById('updateLimitBtn');
const viewStatsBtn = document.getElementById('viewStatsBtn');
const mazeStatusEl = document.getElementById('mazeStatus');
const dailyTipEl = document.getElementById('dailyTip');

// Tips array for random display
const tips = [
  getI18nMessage('tip1'),
  getI18nMessage('tip2'),
  getI18nMessage('tip3'),
  getI18nMessage('tip4'),
  getI18nMessage('tip5'),
  getI18nMessage('tip6'),
  getI18nMessage('tip7'),
  getI18nMessage('tip8')
];

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  initializeI18n();
  await loadStats();
  await checkCurrentTabs();
  await checkForExistingMaze();
  displayRandomTip();
  setupEventListeners();
});


/**
 * Load and display extension statistics
 */
async function loadStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });

    if (response && !response.error) {
      currentLimitEl.textContent = response.tabLimit;
      mazesCompletedEl.textContent = response.mazesCompleted;
      blockedAttemptsEl.textContent = response.blockedAttempts;
    } else {
      popupLogger.error('Failed to load stats:', response?.error);
      showError(getI18nMessage('failedToLoadStats'));
    }
  } catch (error) {
    popupLogger.error('Error loading stats:', error);
    showError(getI18nMessage('failedToConnect'));
  }
}

/**
 * Check current tab count and update display
 */
async function checkCurrentTabs() {
  try {
    const tabs = await chrome.tabs.query({});

    // Filter out special tabs and maze tabs
    const regularTabs = tabs.filter(tab => !isSpecialTab(tab) && !isMazeTab(tab));

    tabCountEl.textContent = regularTabs.length;

    // Highlight if over limit
    const currentLimit = parseInt(currentLimitEl.textContent);
    if (regularTabs.length > currentLimit) {
      tabCountEl.classList.add('over-limit');
    } else {
      tabCountEl.classList.remove('over-limit');
    }

  } catch (error) {
    popupLogger.error('Error checking tabs:', error);
    tabCountEl.textContent = '?';
  }
}


/**
 * Display a random tip in the footer
 */
function displayRandomTip() {
  const randomTip = tips[Math.floor(Math.random() * tips.length)];
  dailyTipEl.textContent = randomTip;
}

/**
 * Setup event listeners for buttons
 */
function setupEventListeners() {
  updateLimitBtn.addEventListener('click', handleUpdateLimit);
  viewStatsBtn.addEventListener('click', handleViewStats);
  // Add click handler for maze status banner to focus maze tab
  mazeStatusEl.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'FOCUS_MAZE_TAB' });
      window.close(); // Close popup after focusing maze
    } catch (error) {
      popupLogger.error('Failed to focus maze tab:', error);
    }
  });
}

/**
 * Handle update limit button click
 */
async function handleUpdateLimit() {
  try {
    updateLimitBtn.classList.add('loading');
    updateLimitBtn.disabled = true;

    // Use consolidated maze creation logic in background
    await chrome.runtime.sendMessage({
      type: 'CREATE_MAZE_TAB',
      data: { action: 'updateLimit' }
    });

    // Close popup
    window.close();

  } catch (error) {
    popupLogger.error('Error creating maze tab for limit update:', error);
    showError(getI18nMessage('failedToStartUpdate'));
  } finally {
    updateLimitBtn.classList.remove('loading');
    updateLimitBtn.disabled = false;
  }
}

/**
 * Handle view stats button click
 */
async function handleViewStats() {
  try {
    viewStatsBtn.classList.add('loading');
    viewStatsBtn.disabled = true;

    // Open options page with stats focus
    await chrome.runtime.openOptionsPage();

    // Close popup
    window.close();

  } catch (error) {
    popupLogger.error('Error opening options page:', error);
    showError(getI18nMessage('failedToOpenStats'));
  } finally {
    viewStatsBtn.classList.remove('loading');
    viewStatsBtn.disabled = false;
  }
}

/**
 * Show error message to user
 */
function showError(message) {
  // Create temporary error display
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    right: 10px;
    background: #f8d7da;
    color: #721c24;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 1000;
  `;
  errorDiv.textContent = message;

  document.body.appendChild(errorDiv);

  // Remove after 3 seconds
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.parentNode.removeChild(errorDiv);
    }
  }, 3000);
}

/**
 * Check for existing maze session and show yellow banner if needed
 */
async function checkForExistingMaze() {
  try {
    const session = await getMazeSessionData();

    if (session) {
      // Show the yellow banner and make it clickable
      mazeStatusEl.style.display = 'block';
      mazeStatusEl.style.cursor = 'pointer';
    } else {
      mazeStatusEl.style.display = 'none';
    }
  } catch (error) {
    popupLogger.error('Error checking for existing maze:', error);
  }
}


/**
 * Refresh popup data periodically
 */
setInterval(async () => {
  await checkCurrentTabs();
  await checkForExistingMaze();
}, 2000);

