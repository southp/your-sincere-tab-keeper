/**
 * Your Sincere Tab Keeper - Popup Script
 * Handles popup UI interactions and displays current stats
 */

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
  "💡 Tip: Close unused tabs to stay focused!",
  "🎯 Tip: Try setting a lower limit to build better habits!",
  "🧠 Tip: Each maze makes you more mindful of your browsing!",
  "⭐ Tip: Quality over quantity - keep only tabs you need!",
  "🌟 Tip: Your future self will thank you for fewer tabs!",
  "🚀 Tip: Less tabs = better browser performance!",
  "💪 Tip: Every maze solved is a step toward better habits!",
  "🎨 Tip: A clean tab bar is a clean mind!"
];

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  await checkCurrentTabs();
  await checkForActiveMaze();
  await checkForMazeAlert();
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
      console.error('Failed to load stats:', response?.error);
      showError('Failed to load statistics');
    }
  } catch (error) {
    console.error('Error loading stats:', error);
    showError('Failed to connect to extension');
  }
}

/**
 * Check current tab count and update display
 */
async function checkCurrentTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    
    // Filter out special tabs and maze tabs
    const regularTabs = tabs.filter(tab => {
      if (!tab.url) return false;
      
      const specialProtocols = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'moz-extension:'];
      const isSpecial = specialProtocols.some(protocol => tab.url.startsWith(protocol));
      const isMaze = tab.url.includes('maze.html');
      
      return !isSpecial && !isMaze;
    });
    
    tabCountEl.textContent = regularTabs.length;
    
    // Highlight if over limit
    const currentLimit = parseInt(currentLimitEl.textContent);
    if (regularTabs.length > currentLimit) {
      tabCountEl.classList.add('over-limit');
    } else {
      tabCountEl.classList.remove('over-limit');
    }
    
  } catch (error) {
    console.error('Error checking tabs:', error);
    tabCountEl.textContent = '?';
  }
}

/**
 * Check if there's an active maze tab
 */
async function checkForActiveMaze() {
  try {
    const tabs = await chrome.tabs.query({});
    const mazeTabs = tabs.filter(tab => tab.url && tab.url.includes('maze.html'));
    
    if (mazeTabs.length > 0) {
      mazeStatusEl.style.display = 'block';
      
      // Add click handler to focus maze tab
      mazeStatusEl.addEventListener('click', async () => {
        try {
          await chrome.tabs.update(mazeTabs[0].id, { active: true });
          window.close(); // Close popup after focusing maze
        } catch (error) {
          console.error('Failed to focus maze tab:', error);
        }
      });
      
      mazeStatusEl.style.cursor = 'pointer';
    } else {
      mazeStatusEl.style.display = 'none';
    }
  } catch (error) {
    console.error('Error checking for maze tabs:', error);
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
}

/**
 * Handle update limit button click
 */
async function handleUpdateLimit() {
  try {
    updateLimitBtn.classList.add('loading');
    updateLimitBtn.disabled = true;
    
    // Get current session difficulty and ensure minimum Hard level for limit updates
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    const currentDifficulty = response?.sessionMazesCompleted || 0;
    const minHardDifficulty = 3; // Hard level index
    const updateLimitDifficulty = Math.max(currentDifficulty, minHardDifficulty);
    
    // Create a new tab with maze for limit update
    const mazeUrl = chrome.runtime.getURL(`maze.html?action=updateLimit&difficulty=${updateLimitDifficulty}`);
    await chrome.tabs.create({ url: mazeUrl });
    
    // Close popup
    window.close();
    
  } catch (error) {
    console.error('Error creating maze tab for limit update:', error);
    showError('Failed to start limit update process');
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
    console.error('Error opening options page:', error);
    showError('Failed to open statistics page');
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
 * Check for maze alert notifications
 */
async function checkForMazeAlert() {
  try {
    const result = await chrome.storage.local.get(['showMazeAlert', 'mazeAlertTime']);
    
    if (result.showMazeAlert && result.mazeAlertTime) {
      // Check if alert is recent (within last 5 seconds)
      const timeDiff = Date.now() - result.mazeAlertTime;
      if (timeDiff < 5000) {
        showSpeechBubble('You already have a maze to solve! 🧩', 'Focus on completing the current maze first.');
        
        // Clear the alert flag
        await chrome.storage.local.remove(['showMazeAlert', 'mazeAlertTime']);
      }
    }
  } catch (error) {
    console.error('Error checking for maze alert:', error);
  }
}

/**
 * Show speech bubble notification in popup
 */
function showSpeechBubble(title, message) {
  // Create speech bubble element
  const speechBubble = document.createElement('div');
  speechBubble.className = 'speech-bubble';
  speechBubble.innerHTML = `
    <div class="speech-bubble-content">
      <div class="speech-bubble-title">${title}</div>
      <div class="speech-bubble-message">${message}</div>
    </div>
    <div class="speech-bubble-arrow"></div>
  `;
  
  // Add CSS for speech bubble
  const style = document.createElement('style');
  style.textContent = `
    .speech-bubble {
      position: fixed;
      top: 10px;
      left: 10px;
      right: 10px;
      background: linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 100%);
      color: white;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 4px 20px rgba(255, 107, 107, 0.3);
      z-index: 1000;
      animation: speechBubbleSlide 0.3s ease-out;
    }
    
    .speech-bubble-content {
      text-align: center;
    }
    
    .speech-bubble-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .speech-bubble-message {
      font-size: 12px;
      opacity: 0.9;
    }
    
    .speech-bubble-arrow {
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid #ff6b6b;
    }
    
    @keyframes speechBubbleSlide {
      from {
        transform: translateY(-20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(speechBubble);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    speechBubble.style.animation = 'speechBubbleSlide 0.3s ease-in reverse';
    setTimeout(() => {
      if (speechBubble.parentNode) {
        speechBubble.parentNode.removeChild(speechBubble);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 300);
  }, 3000);
}

/**
 * Refresh popup data periodically
 */
setInterval(async () => {
  await checkCurrentTabs();
  await checkForActiveMaze();
  await checkForMazeAlert();
}, 2000);

