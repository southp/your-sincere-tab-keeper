/**
 * Your Sincere Tab Keeper - Options Page Script
 * Handles settings, onboarding, and statistics display
 */

import { TAB_LIMITS } from './constants.js';
import { renderLimitButtons, setupLimitButtonListeners, updateLimitDescription, initializeI18n, getI18nMessage, formatHourRange } from './ui-utils.js';
import { Logger } from './debug.js';
import { usageDataStore } from './usage-data-store.js';
import { isSpecialTab, isMazeTab } from './utils.js';
import './trend-graph.js';

const optionsLogger = new Logger('OPTIONS');

// DOM elements
const onboardingSection = document.getElementById('onboardingSection');
const settingsSection = document.getElementById('settingsSection');
const statsSection = document.getElementById('statsSection');
const footer = document.querySelector('.footer');
const currentTabLimitEl = document.getElementById('currentTabLimit');
const completeOnboardingBtn = document.getElementById('completeOnboardingBtn');
const changeLimitBtn = document.getElementById('changeLimitBtn');

// Statistics elements
const totalMazesCompletedEl = document.getElementById('totalMazesCompleted');
const totalBlockedAttemptsEl = document.getElementById('totalBlockedAttempts');
const daysActiveEl = document.getElementById('daysActive');
const currentStreakEl = document.getElementById('currentStreak');
const peakActivityTimeEl = document.getElementById('peakActivityTime');

// Footer elements
const resetStatsBtn = document.getElementById('resetStatsBtn');
const exportStatsBtn = document.getElementById('exportStatsBtn');
const importStatsBtn = document.getElementById('importStatsBtn');

// Selected limit for onboarding
let selectedLimit = TAB_LIMITS.DEFAULT;

// Initialize options page
document.addEventListener('DOMContentLoaded', async () => {
  initializeI18n();
  updateRangeText();
  loadVersionNumber();
  await checkOnboardingStatus();
  await loadCurrentSettings();
  await loadStatistics();
  await loadTrendData();
  setupEventListeners();
});

/**
 * Load and display version number from manifest
 */
function loadVersionNumber() {
  try {
    const manifest = chrome.runtime.getManifest();
    const versionElement = document.getElementById('versionNumber');
    if (versionElement && manifest.version) {
      versionElement.textContent = manifest.version;
    }
  } catch (error) {
    optionsLogger.error('Failed to load version number:', error);
  }
}


/**
 * Update range text elements dynamically
 */
function updateRangeText() {
  const rangeElements = document.querySelectorAll('[data-range-text]');
  rangeElements.forEach(element => {
    element.textContent = getI18nMessage('howItWorks1');
  });
}

/**
 * Check if this is the first time opening options (onboarding)
 */
function checkOnboardingStatus() {
  const urlParams = new URLSearchParams(window.location.search);
  const isOnboarding = urlParams.get('onboarding') === 'true';

  if (isOnboarding) {
    // Show only onboarding section, hide everything else
    onboardingSection.style.display = 'block';
    settingsSection.style.display = 'none';
    statsSection.style.display = 'none';
    footer.style.display = 'none';

    // Set up limit selector
    setupLimitSelector();
  } else {
    // Normal options page - show all sections
    onboardingSection.style.display = 'none';
    settingsSection.style.display = 'block';
    statsSection.style.display = 'block';
    footer.style.display = 'block';
  }
}

/**
 * Setup limit selector for onboarding
 */
function setupLimitSelector() {
  // Generate buttons dynamically
  renderLimitButtons('onboardingLimitOptions', TAB_LIMITS.DEFAULT);

  // Set up button event listeners using shared utility
  setupLimitButtonListeners('#onboardingLimitOptions', (limit) => {
    selectedLimit = limit;
    updateLimitDescription('limitDescription', limit);
  });

  // Set initial description
  updateLimitDescription('limitDescription', selectedLimit);
}

/**
 * Load current extension settings
 */
async function loadCurrentSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });

    if (response && !response.error) {
      currentTabLimitEl.textContent = response.tabLimit;
    } else {
      optionsLogger.error('Failed to load settings:', response?.error);
    }
  } catch (error) {
    optionsLogger.error('Error loading settings:', error);
  }
}

/**
 * Load and display statistics
 */
async function loadStatistics() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });

    if (response && !response.error) {
      totalMazesCompletedEl.textContent = response.mazesCompleted || 0;
      totalBlockedAttemptsEl.textContent = response.blockedAttempts || 0;
      currentStreakEl.textContent = response.dailyMazesCompleted || 0;

      // Calculate days active
      const installDate = response.installDate || Date.now();
      const daysActive = Math.floor((Date.now() - installDate) / (1000 * 60 * 60 * 24));
      daysActiveEl.textContent = Math.max(1, daysActive);

      // Handle peak activity time
      if (response.peakActivityHour) {
        peakActivityTimeEl.textContent = formatHourRange(response.peakActivityHour.hour);
      } else {
        peakActivityTimeEl.textContent = getI18nMessage('peakActivityInsufficientData');
      }

    } else {
      optionsLogger.error('Failed to load statistics:', response?.error);
    }
  } catch (error) {
    optionsLogger.error('Error loading statistics:', error);
  }
}

/**
 * Load trend data and pass to TrendGraph component
 */
async function loadTrendData() {
  try {
    const store = usageDataStore();
    const result = await store.getDailyTrackingData();

    const trendGraph = document.querySelector('trend-graph');
    if (trendGraph) {
      trendGraph.setData(result);
    }
  } catch (error) {
    optionsLogger.error('Error loading trend data:', error);
  }
}


/**
 * Setup event listeners
 */
function setupEventListeners() {
  completeOnboardingBtn?.addEventListener('click', handleCompleteOnboarding);
  changeLimitBtn?.addEventListener('click', handleChangeLimit);
  resetStatsBtn?.addEventListener('click', handleResetStats);
  exportStatsBtn?.addEventListener('click', handleExportStats);
  importStatsBtn?.addEventListener('click', handleImportStats);
}

/**
 * Handle onboarding completion
 */
async function handleCompleteOnboarding() {
  try {
    completeOnboardingBtn.classList.add('loading');
    completeOnboardingBtn.disabled = true;

    // First, check how many regular tabs are currently open (excluding special tabs)
    const tabs = await chrome.tabs.query({});
    const regularTabs = tabs.filter(tab => !isSpecialTab(tab) && !isMazeTab(tab));
    const regularTabCount = regularTabs.length;

    if (regularTabCount > selectedLimit) {
      const tabsToClose = regularTabCount - selectedLimit;

      // Show confirmation dialog about tab closure
      const confirmed = await showTabClosureConfirmation(regularTabCount, selectedLimit, tabsToClose);

      if (!confirmed) {
        completeOnboardingBtn.classList.remove('loading');
        completeOnboardingBtn.disabled = false;
        return; // User cancelled
      }
    }

    // Save selected limit using data store
    const store = usageDataStore();
    await store.setTabLimit(selectedLimit);
    await store.setInstallDate();

    // Send message to background script for smart tab management
    await chrome.runtime.sendMessage({
      type: 'COMPLETE_ONBOARDING',
      limit: selectedLimit
    });

    // Hide onboarding and show all main sections
    onboardingSection.style.display = 'none';
    settingsSection.style.display = 'block';
    statsSection.style.display = 'block';
    footer.style.display = 'block';

    // Refresh the page to show updated settings
    await loadCurrentSettings();
    await loadStatistics();
    await loadTrendData();

    // Show success message
    showNotification(getI18nMessage('tabLimitSetSuccess'), 'success');

  } catch (error) {
    optionsLogger.error('Error completing onboarding:', error);
    showNotification(getI18nMessage('settingsSaveFailed'), 'error');
  } finally {
    completeOnboardingBtn.classList.remove('loading');
    completeOnboardingBtn.disabled = false;
  }
}

/**
 * Handle tab limit change (requires maze)
 */
async function handleChangeLimit() {
  try {
    changeLimitBtn.classList.add('loading');
    changeLimitBtn.disabled = true;

    // Use consolidated maze creation logic in background
    await chrome.runtime.sendMessage({
      type: 'CREATE_MAZE_TAB',
      data: { action: 'updateLimit' }
    });

    showNotification(getI18nMessage('solveMazeToUpdateLimit'), 'info');

  } catch (error) {
    optionsLogger.error('Error starting limit change:', error);
    showNotification(getI18nMessage('failedToStartUpdate'), 'error');
  } finally {
    changeLimitBtn.classList.remove('loading');
    changeLimitBtn.disabled = false;
  }
}

/**
 * Handle statistics reset
 */
async function handleResetStats() {
  // eslint-disable-next-line no-alert
  if (!confirm(getI18nMessage('confirmResetStats'))) { // Intentional: Confirmation required for destructive action
    return;
  }

  try {
    resetStatsBtn.classList.add('loading');

    // Reset statistics using background script message
    const response = await chrome.runtime.sendMessage({ type: 'RESET_STATS' });

    if (response.error) {
      throw new Error(response.error);
    }

    // Reload statistics display
    await loadStatistics();
    await loadTrendData();

    showNotification(getI18nMessage('statsResetSuccess'), 'success');

  } catch (error) {
    optionsLogger.error('Error resetting statistics:', error);
    showNotification(getI18nMessage('statsResetFailed'), 'error');
  } finally {
    resetStatsBtn.classList.remove('loading');
  }
}

/**
 * Handle statistics export
 */
async function handleExportStats() {
  try {
    exportStatsBtn.classList.add('loading');

    const store = usageDataStore();
    const exportData = await store.exportAllData();

    // Create and download JSON file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `tab-keeper-stats-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);

    showNotification(getI18nMessage('dataExportSuccess'), 'success');

  } catch (error) {
    optionsLogger.error('Error exporting statistics:', error);
    showNotification(getI18nMessage('dataExportFailed'), 'error');
  } finally {
    exportStatsBtn.classList.remove('loading');
  }
}

/**
 * Handle statistics import
 */
function handleImportStats() {
  try {
    // Create file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';

    fileInput.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        importStatsBtn.classList.add('loading');

        // Read file content
        const fileContent = await file.text();
        let importData;

        try {
          importData = JSON.parse(fileContent);
        } catch {
          showNotification(getI18nMessage('dataImportInvalidJSON'), 'error');
          return;
        }

        // Validate data before showing confirmation
        const store = usageDataStore();
        try {
          // Pre-validate the import data structure and Tab Keeper format
          if (!importData || typeof importData !== 'object' || Array.isArray(importData)) {
            showNotification(getI18nMessage('dataImportInvalidFormat'), 'error');
            return;
          }

          if (!importData.data || typeof importData.data !== 'object' || Array.isArray(importData.data)) {
            showNotification(getI18nMessage('dataImportMissingData'), 'error');
            return;
          }

          if (!importData.exportDate) {
            showNotification(getI18nMessage('dataImportMissingExportDate'), 'error');
            return;
          }

          // Validate Tab Keeper data schema
          store.validateTabKeeperData(importData.data);

        } catch (validationError) {
          // Show specific validation error with helpful message
          const errorMessage = getI18nMessage('dataImportValidationFailed') + ': ' + validationError.message;
          showNotification(errorMessage, 'error');
          return;
        }

        // Show confirmation dialog only after validation passes
        const confirmed = await showImportConfirmation();
        if (!confirmed) return;

        // Perform import (validation already passed)
        await store.importAllData(importData);

        showNotification(getI18nMessage('dataImportSuccess'), 'success');

        // Reload the page to show updated data
        setTimeout(() => {
          window.location.reload();
        }, 1500);

      } catch (error) {
        optionsLogger.error('Error importing statistics:', error);

        // Show specific error message if it's a rollback scenario
        if (error.message && error.message.includes('rolled back')) {
          showNotification(getI18nMessage('dataImportRollback') + ': ' + error.message, 'error');
        } else {
          showNotification(getI18nMessage('dataImportFailed'), 'error');
        }
      } finally {
        importStatsBtn.classList.remove('loading');
      }
    };

    // Trigger file selection
    fileInput.click();

  } catch (error) {
    optionsLogger.error('Error creating file input:', error);
    showNotification(getI18nMessage('dataImportFailed'), 'error');
  }
}

/**
 * Show import confirmation dialog
 */
function showImportConfirmation() {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      padding: 30px;
      border-radius: 12px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      text-align: center;
    `;

    // Create content
    modal.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
      <h2 style="color: #e74c3c; margin-bottom: 15px;">${getI18nMessage('importDataWarningTitle')}</h2>
      <p style="margin-bottom: 20px; line-height: 1.5; color: #666;">${getI18nMessage('importDataWarningMessage')}</p>
      <div style="display: flex; gap: 15px; justify-content: center; margin-top: 25px;">
        <button id="cancelImport" style="
          padding: 12px 24px;
          background: #95a5a6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">${getI18nMessage('cancelAction')}</button>
        <button id="confirmImport" style="
          padding: 12px 24px;
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">${getI18nMessage('confirmImport')}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Handle button clicks
    const cancelBtn = modal.querySelector('#cancelImport');
    const confirmBtn = modal.querySelector('#confirmImport');

    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(false);
    });

    confirmBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(true);
    });

    // Handle escape key and backdrop click
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(overlay);
        document.removeEventListener('keydown', handleEscape);
        resolve(false);
      }
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        document.removeEventListener('keydown', handleEscape);
        resolve(false);
      }
    });

    document.addEventListener('keydown', handleEscape);
  });
}

/**
 * Show tab closure confirmation dialog
 */
function showTabClosureConfirmation(currentCount, newLimit, tabsToClose) {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      backdrop-filter: blur(5px);
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      border-radius: 20px;
      padding: 32px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      text-align: center;
      animation: modalSlideIn 0.3s ease-out;
    `;

    modal.innerHTML = `
      <div style="font-size: 3em; margin-bottom: 16px;">⚠️</div>
      <h2 style="color: #333; margin-bottom: 16px; font-size: 1.5em;">${getI18nMessage('tooManyTabsOpen')}</h2>
      <p style="color: #666; line-height: 1.6; margin-bottom: 24px; font-size: 1.1em;">
        ${getI18nMessage('tabCountVsLimit', [`<strong>${currentCount} ${getI18nMessage('tabs')}</strong>`, `<strong>${newLimit} ${getI18nMessage('tabs')}</strong>`])}
        <br><br>
        ${getI18nMessage('keepRecentTabsClose', [`<strong>${newLimit} ${getI18nMessage('mostRecentTabs')}</strong>`, `<strong>${tabsToClose} ${getI18nMessage('tabs')}</strong>`])}
      </p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="confirmClose" style="
          background: linear-gradient(45deg, #4ecdc4, #44a08d);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 1em;
          cursor: pointer;
          transition: all 0.2s ease;
        ">${getI18nMessage('continueCloseTabs')}</button>
        <button id="cancelClose" style="
          background: #f8f9fa;
          color: #666;
          border: 2px solid #e9ecef;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 1em;
          cursor: pointer;
          transition: all 0.2s ease;
        ">${getI18nMessage('cancel')}</button>
      </div>
    `;

    // Add animation CSS
    const style = document.createElement('style');
    style.textContent = `
      @keyframes modalSlideIn {
        from {
          opacity: 0;
          transform: translateY(-50px) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      #confirmClose:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(68, 160, 141, 0.4);
      }
      #cancelClose:hover {
        background: #e9ecef;
        border-color: #adb5bd;
      }
    `;
    document.head.appendChild(style);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Handle button clicks
    modal.querySelector('#confirmClose').addEventListener('click', () => {
      document.body.removeChild(overlay);
      document.head.removeChild(style);
      resolve(true);
    });

    modal.querySelector('#cancelClose').addEventListener('click', () => {
      document.body.removeChild(overlay);
      document.head.removeChild(style);
      resolve(false);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        document.head.removeChild(style);
        resolve(false);
      }
    });
  });
}

/**
 * Show notification to user
 */
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000;
    max-width: 350px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  `;

  // Set colors based on type
  let colors = {};
  switch (type) {
    case 'success':
      colors = {
        background: '#d4edda',
        color: '#155724',
        border: '1px solid #c3e6cb'
      };
      break;
    case 'error':
      colors = {
        background: '#f8d7da',
        color: '#721c24',
        border: '1px solid #f5c6cb'
      };
      break;
    default:
      colors = {
        background: '#d1ecf1',
        color: '#0c5460',
        border: '1px solid #bee5eb'
      };
  }

  notification.style.background = colors.background;
  notification.style.color = colors.color;
  notification.style.border = colors.border;

  // Create message element
  const messageElement = document.createElement('span');
  messageElement.textContent = message;
  messageElement.style.flex = '1';

  // Create dismiss button
  const dismissButton = document.createElement('button');
  dismissButton.textContent = '×';
  dismissButton.style.cssText = `
    background: none;
    border: none;
    font-size: 18px;
    font-weight: bold;
    cursor: pointer;
    padding: 0;
    margin: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s ease;
    color: inherit;
    opacity: 0.7;
  `;

  // Add hover effect to dismiss button
  dismissButton.addEventListener('mouseenter', () => {
    dismissButton.style.opacity = '1';
    dismissButton.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
  });

  dismissButton.addEventListener('mouseleave', () => {
    dismissButton.style.opacity = '0.7';
    dismissButton.style.backgroundColor = 'transparent';
  });

  // Add click handler to dismiss button
  dismissButton.addEventListener('click', () => {
    dismissNotification(notification);
  });

  // Assemble notification
  notification.appendChild(messageElement);
  notification.appendChild(dismissButton);
  document.body.appendChild(notification);

  // Remove after 20 seconds (increased from 4 seconds)
  const timeoutId = setTimeout(() => {
    dismissNotification(notification);
  }, 20000);

  // Store timeout ID so we can cancel it if manually dismissed
  notification._timeoutId = timeoutId;
}

/**
 * Dismiss a notification with animation
 */
function dismissNotification(notification) {
  if (!notification.parentNode) return;

  // Clear the auto-dismiss timeout if it exists
  if (notification._timeoutId) {
    clearTimeout(notification._timeoutId);
  }

  notification.style.animation = 'slideOut 0.3s ease';
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 300);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

