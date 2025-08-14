/**
 * Your Sincere Tab Keeper - Options Page Script
 * Handles settings, onboarding, and statistics display
 */

import { TAB_LIMITS, LIMIT_DESCRIPTIONS } from './constants.js';
import { renderLimitButtons, setupLimitButtonListeners, updateLimitDescription } from './ui-utils.js';
import { logger } from './debug.js';

// DOM elements
const onboardingSection = document.getElementById('onboardingSection');
const settingsSection = document.getElementById('settingsSection');
const statsSection = document.getElementById('statsSection');
const aboutSection = document.getElementById('aboutSection');
const footer = document.querySelector('.footer');
const currentTabLimitEl = document.getElementById('currentTabLimit');
const limitButtons = document.querySelectorAll('.limit-btn');
const completeOnboardingBtn = document.getElementById('completeOnboardingBtn');
const changeLimitBtn = document.getElementById('changeLimitBtn');
const limitDescriptionEl = document.getElementById('limitDescription');

// Statistics elements
const totalMazesCompletedEl = document.getElementById('totalMazesCompleted');
const totalBlockedAttemptsEl = document.getElementById('totalBlockedAttempts');
const daysActiveEl = document.getElementById('daysActive');
const currentStreakEl = document.getElementById('currentStreak');
const insightsListEl = document.getElementById('insightsList');

// Footer elements
const resetStatsBtn = document.getElementById('resetStatsBtn');
const exportStatsBtn = document.getElementById('exportStatsBtn');

// Selected limit for onboarding
let selectedLimit = TAB_LIMITS.DEFAULT;

// Initialize options page
document.addEventListener('DOMContentLoaded', async () => {
  updateRangeText();
  await checkOnboardingStatus();
  await loadCurrentSettings();
  await loadStatistics();
  setupEventListeners();
  generateInsights();
});

/**
 * Update range text elements dynamically
 */
function updateRangeText() {
  const rangeElements = document.querySelectorAll('[data-range-text]');
  rangeElements.forEach(element => {
    element.textContent = element.textContent.replace('{{RANGE}}', TAB_LIMITS.RANGE_TEXT);
  });
}

/**
 * Check if this is the first time opening options (onboarding)
 */
async function checkOnboardingStatus() {
  const urlParams = new URLSearchParams(window.location.search);
  const isOnboarding = urlParams.get('onboarding') === 'true';
  
  if (isOnboarding) {
    // Show only onboarding section, hide everything else
    onboardingSection.style.display = 'block';
    settingsSection.style.display = 'none';
    statsSection.style.display = 'none';
    aboutSection.style.display = 'none';
    footer.style.display = 'none';
    
    // Set up limit selector
    setupLimitSelector();
  } else {
    // Normal options page - show all sections
    onboardingSection.style.display = 'none';
    settingsSection.style.display = 'block';
    statsSection.style.display = 'block';
    aboutSection.style.display = 'block';
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
      logger.error('Failed to load settings:', response?.error);
    }
  } catch (error) {
    logger.error('Error loading settings:', error);
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
      currentStreakEl.textContent = response.sessionMazesCompleted || 0;
      
      // Calculate days active
      const installDate = response.installDate || Date.now();
      const daysActive = Math.floor((Date.now() - installDate) / (1000 * 60 * 60 * 24));
      daysActiveEl.textContent = Math.max(1, daysActive);
      
    } else {
      logger.error('Failed to load statistics:', response?.error);
    }
  } catch (error) {
    logger.error('Error loading statistics:', error);
  }
}

/**
 * Generate personalized insights based on user statistics
 */
async function generateInsights() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    
    if (!response || response.error) {
      return;
    }
    
    const insights = [];
    const mazesCompleted = response.mazesCompleted || 0;
    const blockedAttempts = response.blockedAttempts || 0;
    const tabLimit = response.tabLimit || 5;
    
    // Generate insights based on statistics
    if (mazesCompleted === 0 && blockedAttempts === 0) {
      insights.push({
        icon: '🌟',
        text: 'Welcome! Your journey to mindful browsing starts now.'
      });
    } else if (mazesCompleted > 0) {
      if (mazesCompleted === 1) {
        insights.push({
          icon: '🎯',
          text: 'Great job solving your first maze! Every journey begins with a single step.'
        });
      } else if (mazesCompleted < 10) {
        insights.push({
          icon: '💪',
          text: `You've solved ${mazesCompleted} mazes! You're building great habits.`
        });
      } else {
        insights.push({
          icon: '🏆',
          text: `Impressive! ${mazesCompleted} mazes solved. You're a mindful browsing champion!`
        });
      }
    }
    
    if (blockedAttempts > mazesCompleted * 2) {
      insights.push({
        icon: '🤔',
        text: 'You have more blocked attempts than completed mazes. Consider if you really need all those tabs.'
      });
    }
    
    if (tabLimit <= 3) {
      insights.push({
        icon: '🔥',
        text: 'You chose a strict limit! This level of focus will supercharge your productivity.'
      });
    } else if (tabLimit >= 8) {
      insights.push({
        icon: '🌈',
        text: 'You prefer flexibility in your browsing. The extension is here as a gentle reminder.'
      });
    }
    
    // Success rate insight
    if (blockedAttempts > 0) {
      const successRate = Math.round((mazesCompleted / blockedAttempts) * 100);
      if (successRate >= 80) {
        insights.push({
          icon: '✨',
          text: `${successRate}% maze completion rate - you're committed to your goals!`
        });
      } else if (successRate < 50) {
        insights.push({
          icon: '💭',
          text: 'Consider if closing the maze tab means you didn\'t really need that new tab after all.'
        });
      }
    }
    
    // Default insight if no specific ones apply
    if (insights.length === 0) {
      insights.push({
        icon: '🎯',
        text: 'Keep going! You\'re building great habits one tab at a time.'
      });
    }
    
    // Display insights
    insightsListEl.innerHTML = '';
    insights.forEach(insight => {
      const insightEl = document.createElement('div');
      insightEl.className = 'insight-item';
      insightEl.innerHTML = `
        <span class="insight-icon">${insight.icon}</span>
        <span class="insight-text">${insight.text}</span>
      `;
      insightsListEl.appendChild(insightEl);
    });
    
  } catch (error) {
    logger.error('Error generating insights:', error);
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
}

/**
 * Handle onboarding completion
 */
async function handleCompleteOnboarding() {
  try {
    completeOnboardingBtn.classList.add('loading');
    completeOnboardingBtn.disabled = true;
    
    // First, check how many tabs are currently open
    const tabs = await chrome.tabs.query({});
    const currentTabCount = tabs.length;
    
    if (currentTabCount > selectedLimit) {
      const tabsToClose = currentTabCount - selectedLimit;
      
      // Show confirmation dialog about tab closure
      const confirmed = await showTabClosureConfirmation(currentTabCount, selectedLimit, tabsToClose);
      
      if (!confirmed) {
        completeOnboardingBtn.classList.remove('loading');
        completeOnboardingBtn.disabled = false;
        return; // User cancelled
      }
    }
    
    // Save selected limit
    await chrome.storage.local.set({ 
      tabLimit: selectedLimit,
      installDate: Date.now()
    });
    
    // Send message to background script for smart tab management
    await chrome.runtime.sendMessage({
      type: 'COMPLETE_ONBOARDING',
      limit: selectedLimit
    });
    
    // Hide onboarding and show all main sections
    onboardingSection.style.display = 'none';
    settingsSection.style.display = 'block';
    statsSection.style.display = 'block';
    aboutSection.style.display = 'block';
    footer.style.display = 'block';
    
    // Refresh the page to show updated settings
    await loadCurrentSettings();
    await loadStatistics();
    generateInsights();
    
    // Show success message
    showNotification('Tab limit set successfully! Your journey begins now.', 'success');
    
  } catch (error) {
    logger.error('Error completing onboarding:', error);
    showNotification('Failed to save settings. Please try again.', 'error');
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
    
    // Get current session difficulty and ensure minimum Hard level for limit updates
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    const currentDifficulty = response?.sessionMazesCompleted || 0;
    const minHardDifficulty = 3; // Hard level index
    const updateLimitDifficulty = Math.max(currentDifficulty, minHardDifficulty);
    
    // Create maze tab for limit update
    const mazeUrl = chrome.runtime.getURL(`maze.html?action=updateLimit&difficulty=${updateLimitDifficulty}`);
    await chrome.tabs.create({ url: mazeUrl });
    
    showNotification('Solve the maze to update your tab limit!', 'info');
    
  } catch (error) {
    logger.error('Error starting limit change:', error);
    showNotification('Failed to start limit update process.', 'error');
  } finally {
    changeLimitBtn.classList.remove('loading');
    changeLimitBtn.disabled = false;
  }
}

/**
 * Handle statistics reset
 */
async function handleResetStats() {
  if (!confirm('Are you sure you want to reset all statistics? This action cannot be undone.')) {
    return;
  }
  
  try {
    resetStatsBtn.classList.add('loading');
    
    // Reset statistics in storage
    await chrome.storage.local.remove([
      'mazesCompleted',
      'blockedAttempts'
    ]);
    
    // Reload statistics display
    await loadStatistics();
    generateInsights();
    
    showNotification('Statistics reset successfully!', 'success');
    
  } catch (error) {
    logger.error('Error resetting statistics:', error);
    showNotification('Failed to reset statistics.', 'error');
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
    
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    
    if (response && !response.error) {
      const exportData = {
        exportDate: new Date().toISOString(),
        tabLimit: response.tabLimit,
        mazesCompleted: response.mazesCompleted || 0,
        blockedAttempts: response.blockedAttempts || 0,
        installDate: new Date(response.installDate || Date.now()).toISOString(),
        daysActive: Math.floor((Date.now() - (response.installDate || Date.now())) / (1000 * 60 * 60 * 24))
      };
      
      // Create and download JSON file
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `tab-keeper-stats-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      
      showNotification('Statistics exported successfully!', 'success');
    } else {
      throw new Error('Failed to get statistics');
    }
    
  } catch (error) {
    logger.error('Error exporting statistics:', error);
    showNotification('Failed to export statistics.', 'error');
  } finally {
    exportStatsBtn.classList.remove('loading');
  }
}

/**
 * Show tab closure confirmation dialog
 */
async function showTabClosureConfirmation(currentCount, newLimit, tabsToClose) {
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
      <h2 style="color: #333; margin-bottom: 16px; font-size: 1.5em;">Too Many Tabs Open</h2>
      <p style="color: #666; line-height: 1.6; margin-bottom: 24px; font-size: 1.1em;">
        You currently have <strong>${currentCount} tabs</strong> open, but your new limit is <strong>${newLimit} tabs</strong>.
        <br><br>
        We'll keep your <strong>${newLimit} most recent tabs</strong> and close the other <strong>${tabsToClose} tabs</strong> to match your new limit.
      </p>
      <div style="background: #f8f9fa; border-radius: 12px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #4ecdc4;">
        <p style="margin: 0; color: #555; font-size: 0.95em;">
          💡 <strong>Smart Tab Management:</strong> We'll close your oldest tabs first, keeping the ones you've opened most recently.
        </p>
      </div>
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
        ">Continue & Close Tabs</button>
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
        ">Cancel</button>
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
    padding: 12px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.3s ease;
  `;
  
  // Set colors based on type
  switch (type) {
    case 'success':
      notification.style.background = '#d4edda';
      notification.style.color = '#155724';
      notification.style.border = '1px solid #c3e6cb';
      break;
    case 'error':
      notification.style.background = '#f8d7da';
      notification.style.color = '#721c24';
      notification.style.border = '1px solid #f5c6cb';
      break;
    default:
      notification.style.background = '#d1ecf1';
      notification.style.color = '#0c5460';
      notification.style.border = '1px solid #bee5eb';
  }
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Remove after 4 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);
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

