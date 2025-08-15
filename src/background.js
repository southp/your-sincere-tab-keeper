/**
 * Your Sincere Tab Keeper - Background Service Worker
 * Manages tab limits, maze redirects, and extension state
 */

import { TAB_LIMITS } from './constants.js';
import { Logger } from './debug.js';
import { isSpecialTab, isMazeTab } from './utils.js';

// Create scoped loggers for different areas of functionality
const initLogger = new Logger('INIT');
const tabLogger = new Logger('TAB');
const mazeLogger = new Logger('MAZE');
const storageLogger = new Logger('STORAGE');
const notificationLogger = new Logger('NOTIFICATION');
const generalLogger = new Logger('BACKGROUND');

// In-memory state (resets on browser restart)
let tabLimit = TAB_LIMITS.DEFAULT; // Default limit, will be loaded from storage
let blockedUrls = new Map(); // tabId -> original URL mapping
let mazeTabId = null; // Track current maze tab
let mazesCompleted = 0; // Session counter for difficulty scaling (resets on browser restart)
let isInitialized = false;
let restoringTabs = new Set(); // Track tabs currently being restored from maze completion

// Initialize extension on startup
chrome.runtime.onStartup.addListener(async () => {
  await initializeExtension();
});

chrome.runtime.onInstalled.addListener(async (details) => {
  await initializeExtension();
  
  if (details.reason === 'install') {
    // Show onboarding page for first-time users
    chrome.tabs.create({
      url: chrome.runtime.getURL('options.html?onboarding=true')
    });
  }
});

/**
 * Initialize extension state and load settings
 */
async function initializeExtension() {
  try {
    // Load tab limit from storage
    const result = await chrome.storage.local.get(['tabLimit']);
    if (result.tabLimit) {
      tabLimit = result.tabLimit;
    }
    
    // Reset session counters
    mazesCompleted = 0;
    mazeTabId = null;
    blockedUrls.clear();
    
    isInitialized = true;
    initLogger.log('Your Sincere Tab Keeper initialized with limit:', tabLimit);
  } catch (error) {
    initLogger.error('Failed to initialize extension:', error);
  }
}

/**
 * Handle new tab creation - main tab limiting logic
 */
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!isInitialized) {
    await initializeExtension();
  }
  
  // Skip special pages and extension pages
  if (isSpecialTab(tab)) {
    return;
  }
  
  tabLogger.log('New tab created:', tab.id, tab.url);
  
  // Count current non-maze tabs
  const tabCount = await getCurrentTabCount();
  tabLogger.log('Current tab count:', tabCount, 'Limit:', tabLimit);
  
  // Check limit for ANY new tab, including empty ones
  if (tabCount > tabLimit) {
    await handleTabLimitExceeded(tab);
  }
});

/**
 * Handle tab updates (URL changes, loading states)
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!isInitialized) return;
  
  // Check if this is a restoring tab that has finished loading
  if (restoringTabs.has(tabId)) {
    // If the tab has finished loading (status is complete), clear the restoring flag
    if (changeInfo.status === 'complete') {
      restoringTabs.delete(tabId);
      tabLogger.log('Tab', tabId, 'finished loading after maze completion - cleared restoring flag');
    } else {
      tabLogger.log('Skipping tab limit check for restoring tab:', tabId, 'status:', changeInfo.status);
    }
    return;
  }
  
  // If a tab gets a real URL after being created empty, check limits again
  if (changeInfo.url && !isSpecialTab(tab) && !isMazeTab(tab)) {
    tabLogger.log('Tab URL changed:', tabId, 'from empty to', changeInfo.url);
    
    const tabCount = await getCurrentTabCount();
    tabLogger.log('Tab count during URL change:', tabCount, 'Limit:', tabLimit);
    
    // Apply the same strict limiting logic
    if (tabCount > tabLimit) {
      tabLogger.log('Tab limit exceeded during URL change, blocking navigation');
      await handleTabLimitExceeded(tab);
    }
  }
});

/**
 * Clean up when tabs are closed
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  if (blockedUrls.has(tabId)) {
    blockedUrls.delete(tabId);
    tabLogger.log('Cleaned up blocked URL for closed tab:', tabId);
  }
  
  if (mazeTabId === tabId) {
    mazeTabId = null;
    mazeLogger.log('Maze tab closed');
  }
  
  if (restoringTabs.has(tabId)) {
    restoringTabs.delete(tabId);
    tabLogger.log('Cleaned up restoring tab flag for closed tab:', tabId);
  }
});

/**
 * Handle messages from content scripts and pages
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'MAZE_COMPLETED':
      handleMazeCompleted(sender.tab.id, message.data);
      break;
    case 'GET_BLOCKED_URL':
      sendResponse({ url: blockedUrls.get(sender.tab.id) });
      break;
    case 'UPDATE_TAB_LIMIT':
      handleTabLimitUpdate(message.limit);
      break;
    case 'COMPLETE_ONBOARDING':
      handleCompleteOnboarding(message.limit);
      break;
    case 'GET_STATS':
      handleGetStats(sendResponse);
      return true; // Keep message channel open for async response
    case 'FOCUS_MAZE_TAB':
      handleFocusMazeTab();
      break;
    case 'CLOSE_BLOB_TAB':
      handleCloseBlobTab(sender.tab.id);
      break;
    default:
      generalLogger.warn('Unknown message type:', message.type);
  }
});

/**
 * Count current non-maze tabs (includes both normal and incognito tabs)
 */
async function getCurrentTabCount() {
  try {
    // Query all tabs across all windows (normal and incognito)
    const tabs = await chrome.tabs.query({});
    const nonMazeTabs = tabs.filter(tab => !isSpecialTab(tab) && !isMazeTab(tab));
    
    tabLogger.log(`Total tabs: ${tabs.length}, Non-maze tabs: ${nonMazeTabs.length}`);
    
    // Log incognito tab count for debugging
    const incognitoTabs = tabs.filter(tab => tab.incognito && !isSpecialTab(tab) && !isMazeTab(tab));
    if (incognitoTabs.length > 0) {
      tabLogger.log(`Incognito tabs: ${incognitoTabs.length}`);
    }
    
    return nonMazeTabs.length;
  } catch (error) {
    tabLogger.error('Failed to get tab count:', error);
    return 0;
  }
}

/**
 * Handle when tab limit is exceeded
 */
async function handleTabLimitExceeded(tab) {
  // If there's already a maze tab open, block this new tab entirely
  if (mazeTabId) {
    try {
      // Verify the maze tab still exists
      await chrome.tabs.get(mazeTabId);
      
      // Show the playful blob (don't auto-focus maze tab so users can enjoy the blob)
      try {
        tabLogger.log('Showing playful blob for excess tab:', tab.id, '- maze already exists');
        const blobUrl = chrome.runtime.getURL(`blob.html`);
        await chrome.tabs.update(tab.id, { url: blobUrl });
        // Keep this tab active so users can see the delightful blob
      } catch (blobError) {
        tabLogger.log('Could not show blob, closing excess tab:', tab.id);
        try {
          await chrome.tabs.remove(tab.id);
        } catch (closeError) {
          tabLogger.error('Could not close or redirect excess tab:', closeError);
        }
      }
      
      // Track blocked attempt
      await incrementStat('blockedAttempts');
      await logLimitHitTimestamp();
      
      return;
    } catch (error) {
      // Maze tab probably closed, reset the ID and continue with normal maze logic
      mazeTabId = null;
      mazeLogger.log('Previous maze tab not found, creating new maze');
    }
  }
  
  // Store the original URL (if any) - include chrome://newtab/ for empty tabs
  if (tab.url) {
    blockedUrls.set(tab.id, tab.url);
    tabLogger.log('Stored original URL for tab', tab.id, ':', tab.url);
  } else {
    tabLogger.log('No URL to store for tab', tab.id, '- will default to new tab page');
  }
  
  // Redirect to maze
  const mazeUrl = chrome.runtime.getURL(`maze.html?tabId=${tab.id}&difficulty=${mazesCompleted}`);
  
  try {
    await chrome.tabs.update(tab.id, { url: mazeUrl });
    mazeTabId = tab.id;
    
    // Track blocked attempt
    await incrementStat('blockedAttempts');
    
    // Log timestamp when limit is hit
    await logLimitHitTimestamp();
    
    mazeLogger.log('Redirected tab to maze:', tab.id, 'Original URL:', blockedUrls.get(tab.id));
  } catch (error) {
    mazeLogger.error('Failed to redirect tab to maze:', error);
  }
}

/**
 * Handle maze completion with improved error handling and timing
 */
async function handleMazeCompleted(tabId, data) {
  mazeLogger.log('Maze completed for tab:', tabId, 'data:', data);
  
  try {
    // Verify the tab still exists before processing
    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
      if (!tab) {
        tabLogger.error('Tab', tabId, 'no longer exists');
        return;
      }
    } catch (tabError) {
      tabLogger.error('Failed to get tab', tabId, '- may have been closed:', tabError);
      // Clean up any references to this tab
      cleanupTabReferences(tabId);
      return;
    }
    
    // Check if this is an updateLimit maze by looking at the URL
    const isUpdateLimitMaze = tab.url && tab.url.includes('action=updateLimit');
    
    // Mark tab as being restored to prevent tab limiting logic from interfering
    restoringTabs.add(tabId);
    tabLogger.log('Marked tab as restoring:', tabId);
    
    // Reset maze tab tracking FIRST to prevent triggering another maze
    if (mazeTabId === tabId) {
      mazeTabId = null;
      mazeLogger.log('Reset maze tab tracking for tab:', tabId);
    }
    
    // Increment session counter for difficulty scaling and track completion
    mazesCompleted++;
    await incrementStat('mazesCompleted');
    
    const originalUrl = blockedUrls.get(tabId);
    tabLogger.log('Retrieved original URL for tab', tabId, ':', originalUrl || 'none (will use new tab page)');
    
    // Clean up stored URL first
    if (blockedUrls.has(tabId)) {
      blockedUrls.delete(tabId);
    }
    
    // Determine target URL with better handling
    let targetUrl = originalUrl;
    
    if (!originalUrl || originalUrl.trim() === '' || originalUrl === 'about:blank') {
      if (isUpdateLimitMaze) {
        // Update limit mazes handle their own completion flow via modal
        restoringTabs.delete(tabId);
        return;
      }
      
      tabLogger.log('No valid stored URL for tab', tabId, '- closing maze tab to allow fresh new tab');
      // For truly empty tabs, close the maze and let user start fresh
      setTimeout(async () => {
        try {
          await chrome.tabs.remove(tabId);
          mazeLogger.log('Closed maze tab', tabId, 'for fresh start');
        } catch (error) {
          mazeLogger.error('Failed to close maze tab:', error);
          // Fallback to new tab redirect
          await handleUrlRedirect(tabId, 'chrome://newtab/');
        }
        restoringTabs.delete(tabId);
      }, 800);
      return;
    } else {
      tabLogger.log('Using stored URL for tab', tabId, ':', originalUrl);
    }
    
    await handleUrlRedirect(tabId, targetUrl);
    
    mazeLogger.log('Maze completion handling finished for tab:', tabId);
    
  } catch (error) {
    mazeLogger.error('Error in handleMazeCompleted:', error);
    // Clean up on any error
    cleanupTabReferences(tabId);
  }
}

/**
 * Handle URL redirect with robust error handling
 */
async function handleUrlRedirect(tabId, originalUrl) {
  try {
    tabLogger.log('Preparing to redirect tab', tabId, 'to original URL:', originalUrl);
    
    // Add a delay to let the maze completion UI show and prevent race conditions
    setTimeout(async () => {
      try {
        // Double-check tab still exists before redirect
        const tab = await chrome.tabs.get(tabId);
        if (!tab) {
          tabLogger.warn('Tab', tabId, 'was closed before redirect could complete');
          restoringTabs.delete(tabId);
          return;
        }
        
        tabLogger.log('Redirecting tab', tabId, 'to:', originalUrl);
        
        // Handle special case for chrome://newtab/ - some browsers don't handle it well
        let targetUrl = originalUrl;
        if (originalUrl === 'chrome://newtab/' || originalUrl === 'about:blank') {
          tabLogger.log('Detected new tab URL, using alternative approach for tab:', tabId);
          // For new tab pages, try to reload instead of redirecting
          try {
            await chrome.tabs.reload(tabId);
            tabLogger.log('Reloaded new tab page for tab:', tabId);
            tabLogger.log('Restoring flag will be cleared when tab finishes loading');
            return; // Exit early since we handled it with reload
          } catch (reloadError) {
            tabLogger.log('Reload failed, falling back to URL redirect:', reloadError);
            targetUrl = 'chrome://newtab/';
          }
        }
        
        await chrome.tabs.update(tabId, { url: targetUrl });
        tabLogger.log('Successfully initiated redirect for tab:', tabId, 'to:', targetUrl);
        tabLogger.log('Restoring flag will be cleared when tab finishes loading');
        
        // Safety timeout in case tab never finishes loading
        setTimeout(() => {
          if (restoringTabs.has(tabId)) {
            restoringTabs.delete(tabId);
            tabLogger.log('Safety timeout: Removed restoring flag for tab:', tabId);
          }
        }, 10000); // 10 second safety timeout
        
      } catch (redirectError) {
        tabLogger.error('Failed to redirect tab', tabId, 'to original URL:', redirectError);
        
        // Try alternative handling
        try {
          // If redirect fails, try navigating to a safe page
          await chrome.tabs.update(tabId, { url: 'chrome://newtab/' });
          tabLogger.log('Redirected to new tab page as fallback for tab:', tabId);
        } catch (fallbackError) {
          tabLogger.error('Fallback redirect also failed for tab:', tabId, fallbackError);
          // Close the tab if all else fails
          try {
            await chrome.tabs.remove(tabId);
            tabLogger.log('Closed problematic tab:', tabId);
          } catch (closeError) {
            tabLogger.error('Could not close problematic tab:', closeError);
          }
        }
        
        restoringTabs.delete(tabId);
      }
    }, 800); // Slightly longer delay for large mazes
    
  } catch (error) {
    generalLogger.error('Error in handleUrlRedirect:', error);
    restoringTabs.delete(tabId);
  }
}


/**
 * Clean up all references to a tab
 */
function cleanupTabReferences(tabId) {
  restoringTabs.delete(tabId);
  if (mazeTabId === tabId) {
    mazeTabId = null;
  }
  if (blockedUrls.has(tabId)) {
    blockedUrls.delete(tabId);
  }
  generalLogger.log('Cleaned up all references for tab:', tabId);
}

/**
 * Handle tab limit updates (from maze completion)
 */
async function handleTabLimitUpdate(newLimit) {
  if (newLimit >= TAB_LIMITS.MIN && newLimit <= TAB_LIMITS.MAX) {
    const oldLimit = tabLimit;
    tabLimit = newLimit;
    await chrome.storage.local.set({ tabLimit: newLimit });
    generalLogger.log('Tab limit updated from', oldLimit, 'to:', newLimit);
    
    // If the new limit is lower, close excess tabs intelligently
    if (newLimit < oldLimit) {
      generalLogger.log('Limit lowered, performing smart tab closure');
      await smartTabClosure(newLimit);
    }
  }
}

/**
 * Handle onboarding completion with smart tab management
 */
async function handleCompleteOnboarding(newLimit) {
  if (newLimit >= TAB_LIMITS.MIN && newLimit <= TAB_LIMITS.MAX) {
    tabLimit = newLimit;
    await chrome.storage.local.set({ tabLimit: newLimit });
    generalLogger.log('Onboarding completed with tab limit:', newLimit);
    
    // Smart tab management: close oldest tabs, keep newest ones
    await smartTabClosure(newLimit);
  }
}

/**
 * Smart tab closure - keep newest tabs up to limit, close oldest ones
 */
async function smartTabClosure(limit) {
  try {
    // Get all tabs
    const tabs = await chrome.tabs.query({});
    
    // Filter out special tabs (extension pages, chrome pages) and maze tabs
    const regularTabs = tabs.filter(tab => !isSpecialTab(tab) && !isMazeTab(tab));
    
    generalLogger.log(`Smart tab closure: ${regularTabs.length} regular tabs, limit: ${limit}`);
    
    if (regularTabs.length <= limit) {
      generalLogger.log('No tabs need to be closed - within limit');
      return;
    }
    
    // Sort tabs by ID (newer tabs have higher IDs in Chrome)
    // Keep the newest tabs (highest IDs), close the oldest ones (lowest IDs)
    const sortedTabs = regularTabs.sort((a, b) => b.id - a.id);
    const tabsToKeep = sortedTabs.slice(0, limit);
    const tabsToClose = sortedTabs.slice(limit);
    
    generalLogger.log(`Keeping ${tabsToKeep.length} newest tabs, closing ${tabsToClose.length} oldest tabs`);
    
    // Close the oldest tabs
    for (const tab of tabsToClose) {
      try {
        await chrome.tabs.remove(tab.id);
        tabLogger.log(`Closed tab: ${tab.id} (${tab.title || tab.url})`);
      } catch (error) {
        tabLogger.error('Failed to close tab:', tab.id, error);
      }
    }
    
    generalLogger.log('Smart tab closure completed successfully');
    
  } catch (error) {
    generalLogger.error('Failed to perform smart tab closure:', error);
  }
}

/**
 * Trigger browser restart without tabs
 * Chrome extensions cannot directly restart the browser,
 * so we'll close all tabs and show restart instructions
 */
async function triggerBrowserRestart() {
  try {
    // Get all tabs
    const tabs = await chrome.tabs.query({});
    
    // Close all tabs except the current one (which will show restart instructions)
    const tabsToClose = tabs.filter(tab => !tab.url.includes('maze.html'));
    
    for (const tab of tabsToClose) {
      try {
        await chrome.tabs.remove(tab.id);
      } catch (error) {
        tabLogger.error('Failed to close tab:', tab.id, error);
      }
    }
    
    // The maze tab will handle showing restart instructions
    generalLogger.log('Closed all tabs for restart process');
    
  } catch (error) {
    generalLogger.error('Failed to trigger browser restart:', error);
  }
}

/**
 * Get extension statistics
 */
async function handleGetStats(sendResponse) {
  try {
    const stats = await chrome.storage.local.get([
      'mazesCompleted',
      'blockedAttempts',
      'installDate'
    ]);
    
    sendResponse({
      mazesCompleted: stats.mazesCompleted || 0,
      blockedAttempts: stats.blockedAttempts || 0,
      tabLimit: tabLimit,
      sessionMazesCompleted: mazesCompleted,
      installDate: stats.installDate || Date.now()
    });
  } catch (error) {
    generalLogger.error('Failed to get stats:', error);
    sendResponse({ error: 'Failed to load statistics' });
  }
}

/**
 * Show notification when user tries to open tab while maze exists
 */
async function showMazeExistsNotification() {
  try {
    // Create a notification using Chrome's notification API
    const notificationId = 'maze-exists-' + Date.now();
    
    await chrome.notifications.create(notificationId, {
      type: 'basic',
      title: 'Your Sincere Tab Keeper',
      message: 'You already have a maze to solve! 🧩',
      contextMessage: 'Focus on the current maze before opening new tabs.',
      priority: 1,
      requireInteraction: false
    });
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      chrome.notifications.clear(notificationId);
    }, 3000);
    
    generalLogger.log('Showed maze exists notification');
  } catch (error) {
    generalLogger.error('Failed to show maze exists notification:', error);
    // Fallback: Set a flag that the popup can check
    await chrome.storage.local.set({ 
      showMazeAlert: true,
      mazeAlertTime: Date.now()
    });
  }
}

/**
 * Log timestamp when limit is hit for insights
 */
async function logLimitHitTimestamp() {
  try {
    const now = Date.now();
    const result = await chrome.storage.local.get(['limitHitTimestamps']);
    const timestamps = result.limitHitTimestamps || [];
    
    // Add current timestamp
    timestamps.push(now);
    
    // Keep only last 100 timestamps to prevent storage bloat
    const recentTimestamps = timestamps.slice(-100);
    
    await chrome.storage.local.set({ limitHitTimestamps: recentTimestamps });
    
    generalLogger.log('Logged limit hit timestamp:', new Date(now).toLocaleString());
  } catch (error) {
    generalLogger.error('Failed to log limit hit timestamp:', error);
  }
}

/**
 * Focus the existing maze tab when user clicks blob
 */
async function handleFocusMazeTab() {
  if (mazeTabId) {
    try {
      await chrome.tabs.update(mazeTabId, { active: true });
      generalLogger.log('Focused maze tab:', mazeTabId);
    } catch (error) {
      generalLogger.error('Failed to focus maze tab:', error);
      mazeTabId = null; // Reset if tab doesn't exist
    }
  }
}

/**
 * Close blob tab after countdown expires
 */
async function handleCloseBlobTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    generalLogger.log('Closed blob tab:', tabId);
  } catch (error) {
    generalLogger.error('Failed to close blob tab:', error);
  }
}

/**
 * Increment a statistic counter
 */
async function incrementStat(statName) {
  try {
    const result = await chrome.storage.local.get([statName]);
    const currentValue = result[statName] || 0;
    await chrome.storage.local.set({ [statName]: currentValue + 1 });
  } catch (error) {
    generalLogger.error(`Failed to increment ${statName}:`, error);
  }
}

// Initialize on service worker startup
initializeExtension();

