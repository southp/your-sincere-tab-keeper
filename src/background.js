/**
 * Your Sincere Tab Keeper - Background Service Worker
 * Manages tab limits, maze redirects, and extension state
 */

import { Logger } from './debug.js';
import { TabManager } from './tab-manager.js';
import { isSpecialTab, isMazeTab } from './utils.js';
import { isDevelopment } from './env.js';
import { setLocaleOverride } from './ui-utils.js';
import { usageDataStore } from './usage-data-store.js';
import { clearMazeSession, getMazeSessionData } from './maze/maze-session.js';
import { generateRichData, generateSparseData, generateExtremeData } from './test-data-generator.js';

// Create scoped loggers for service worker functionality
const initLogger = new Logger('SERVICE-WORKER-INIT');
const generalLogger = new Logger('SERVICE-WORKER');

// Initialize the tab manager (core application logic)
const tabManager = new TabManager();

// Setup development debugging utilities
setupDebugUtilities();

// Initialize extension on startup
chrome.runtime.onStartup.addListener(async () => {
  await initializeExtension();
});

chrome.runtime.onInstalled.addListener(async (details) => {
  await initializeExtension();

  if (details.reason === 'install') {
    // Show onboarding page for first-time users
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/options.html?onboarding=true')
    });
  }
});

/**
 * Initialize extension state and load settings
 */
async function initializeExtension() {
  try {
    await tabManager.initialize();
    initLogger.log('Service worker initialized successfully');
  } catch (error) {
    initLogger.error('Failed to initialize extension:', error);
  }
}

/**
 * Handle new tab creation - main tab limiting logic
 */
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tabManager.isInitialized) {
    await initializeExtension();
  }

  generalLogger.log('New tab created:', tab.id, tab.url);

  // Use TabManager to check how tab should be handled
  const result = await tabManager.shouldAllowNewTab(tab);

  switch (result.action) {
    case 'allow':
      // Tab is allowed, do nothing
      break;
    case 'redirect-to-maze':
      await tabManager.handleTabLimitExceeded(tab);
      break;
    case 'show-notification':
      // Show the playful blob page instead of closing the tab
      try {
        generalLogger.log('Showing playful blob for excess tab:', tab.id, '- maze already exists');
        const blobUrl = chrome.runtime.getURL('src/blob.html');
        await chrome.tabs.update(tab.id, { url: blobUrl });
      } catch (error) {
        generalLogger.error('Failed to show blob page, closing excess tab:', tab.id, error);
        try {
          await chrome.tabs.remove(tab.id);
        } catch (closeError) {
          generalLogger.error('Failed to close tab after blob error:', closeError);
        }
      }
      break;
  }

  // Notify popup about tab count change
  await notifyPopupUpdate();
});

/**
 * Handle tab updates (URL changes, loading states)
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tabManager.isInitialized) return;

  // Handle tab loading completion
  if (changeInfo.status === 'complete') {
    tabManager.onTabLoadComplete(tabId);
  }

  // If a tab gets a real URL after being created empty, check limits again
  if (changeInfo.url && !isSpecialTab(tab) && !isMazeTab(tab)) {
    generalLogger.log('Tab URL changed:', tabId, 'from empty to', changeInfo.url);

    // Use TabManager to check how tab should be handled
    const result = await tabManager.shouldAllowNewTab(tab);

    switch (result.action) {
      case 'allow':
        // Tab is allowed, do nothing
        break;
      case 'redirect-to-maze':
        generalLogger.log('Tab limit exceeded during URL change, blocking navigation');
        await tabManager.handleTabLimitExceeded(tab);
        break;
      case 'show-notification':
        // Show the playful blob page instead of closing the tab
        try {
          generalLogger.log('Showing playful blob for tab URL change:', tabId, '- maze already exists');
          const blobUrl = chrome.runtime.getURL('src/blob.html');
          await chrome.tabs.update(tabId, { url: blobUrl });
        } catch (error) {
          generalLogger.error('Failed to show blob page, closing tab:', tabId, error);
          try {
            await chrome.tabs.remove(tabId);
          } catch (closeError) {
            generalLogger.error('Failed to close tab after blob error:', closeError);
          }
        }
        break;
    }
  }
});

/**
 * Clean up when tabs are closed
 */
chrome.tabs.onRemoved.addListener(async (tabId) => {
  generalLogger.log('Tab removed:', tabId, 'Current maze tab ID:', tabManager.mazeTabId);

  // Check if this was the maze tab and clear session if so
  if (tabManager.mazeTabId === tabId) {
    try {
      generalLogger.log('Removing maze tab - clearing session');
      await clearMazeSession();
      generalLogger.log('Cleared maze session after maze tab was closed:', tabId);
    } catch (error) {
      generalLogger.error('Failed to clear maze session on tab close:', error);
    }
  } else {
    generalLogger.log('Not the maze tab, session will remain');
  }

  tabManager.onTabRemoved(tabId);

  // Notify popup about tab count and maze status changes
  await notifyPopupUpdate();
});

/**
 * Handle tab replacement due to prerendering
 */
chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  tabManager.onTabReplaced(addedTabId, removedTabId);
});

/**
 * Handle tab replacement via webNavigation (alternative event)
 * This provides additional coverage for prerendering tab replacements
 */
chrome.webNavigation.onTabReplaced.addListener((details) => {
  // details.tabId is the new tab, details.replacedTabId is the old tab
  tabManager.onTabReplaced(details.tabId, details.replacedTabId);
});

/**
 * Notify popup about updates when it's open
 */
async function notifyPopupUpdate() {
  try {
    // Get current data for popup
    const [tabs, session, stats] = await Promise.all([
      chrome.tabs.query({}),
      getMazeSessionData(),
      tabManager.getStats()
    ]);

    // Filter regular tabs (not special or maze tabs)
    const regularTabs = tabs.filter(tab => !isSpecialTab(tab) && !isMazeTab(tab));
    const currentLimit = stats.tabLimit;

    // Send updates to popup (will be ignored if popup isn't open)
    chrome.runtime.sendMessage({
      type: 'POPUP_UPDATE_TAB_COUNT',
      data: { tabCount: regularTabs.length, currentLimit }
    }).catch(() => {
      // Popup is not open, ignore errors
    });

    chrome.runtime.sendMessage({
      type: 'POPUP_UPDATE_MAZE_STATUS',
      data: { hasSession: !!session }
    }).catch(() => {
      // Popup is not open, ignore errors
    });

  } catch (error) {
    generalLogger.error('Error notifying popup:', error);
  }
}

/**
 * Handle messages from content scripts and pages
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'MAZE_COMPLETED':
      tabManager.handleMazeCompleted(sender.tab.id, message.data)
        .then(() => notifyPopupUpdate())
        .catch(error => generalLogger.error('Error handling maze completion:', error));
      break;
    case 'GET_BLOCKED_URL':
      // This functionality is now handled internally by TabManager
      sendResponse({ url: null });
      break;
    case 'UPDATE_TAB_LIMIT':
      tabManager.handleTabLimitUpdate(message.limit)
        .then(() => notifyPopupUpdate())
        .catch(error => generalLogger.error('Error updating tab limit:', error));
      break;
    case 'COMPLETE_ONBOARDING':
      tabManager.handleCompleteOnboarding(message.limit)
        .then(() => notifyPopupUpdate())
        .catch(error => generalLogger.error('Error completing onboarding:', error));
      break;
    case 'GET_STATS':
      handleGetStats(sendResponse);
      return true; // Keep message channel open for async response
    case 'RESET_STATS':
      handleResetStats(sendResponse);
      return true; // Keep message channel open for async response
    case 'FOCUS_MAZE_TAB':
      tabManager.focusMazeTab();
      break;
    case 'CHECK_MAZE_COMPLETED':
    {
      // Check if maze is completed for the requesting tab
      const isCompleted = tabManager.isMazeCompleted(sender.tab.id);
      sendResponse({ isCompleted });
      return true; // Keep message channel open for response
    }
    case 'CLOSE_BLOB_TAB':
      handleCloseBlobTab(sender.tab.id);
      break;
    case 'CREATE_MAZE_TAB':
      handleCreateMazeTab(message.data)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ error: error.message }));
      return true; // Keep message channel open for async response
    default:
      generalLogger.warn('Unknown message type:', message.type);
  }
});

/**
 * Get extension statistics
 */
async function handleGetStats(sendResponse) {
  try {
    const stats = await tabManager.getStats();
    sendResponse(stats);
  } catch (error) {
    generalLogger.error('Failed to get stats:', error);
    sendResponse({ error: 'Failed to load statistics' });
  }
}

/**
 * Handle stats reset including TabManager state
 */
async function handleResetStats(sendResponse) {
  try {
    // Reset storage data using data store
    const store = usageDataStore();
    await store.resetStatistics();

    // Reset TabManager's in-memory state
    tabManager.dailyMazesCompleted = 0;

    generalLogger.log('Statistics reset successfully');
    sendResponse({ success: true });
  } catch (error) {
    generalLogger.error('Failed to reset stats:', error);
    sendResponse({ error: 'Failed to reset statistics' });
  }
}

/**
 * Handle maze tab creation using TabManager
 */
async function handleCreateMazeTab(data) {
  try {
    const result = await tabManager.createMazeTabOrBlob(data);
    generalLogger.log('Maze creation result:', result);
    return result;
  } catch (error) {
    generalLogger.error('Error creating maze tab:', error);
    throw error;
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
 * Setup debugging utilities for development environment
 */
async function setupDebugUtilities() {
  if (!(await isDevelopment())) {
    return; // Only enable in development mode
  }

  generalLogger.log('🔧 Development mode detected - setting up debug utilities');

  // Expose tab manager for console inspection
  globalThis.debugTabKeeper = {
    // Core state inspection
    tabManager: tabManager,

    // Quick state getters
    getState: () => ({
      unblockedTabs: Array.from(tabManager.unblockedTabs),
      restoringTabs: Array.from(tabManager.restoringTabs),
      blockedUrls: Object.fromEntries(tabManager.blockedUrls),
      mazeTabId: tabManager.mazeTabId,
      tabLimit: tabManager.tabLimit
    }),

    // Tab analysis helpers
    getAllTabs: async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.map(tab => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        isSpecial: isSpecialTab(tab),
        isMaze: isMazeTab(tab),
        isUnblocked: tabManager.unblockedTabs.has(tab.id),
        isRestoring: tabManager.restoringTabs.has(tab.id)
      }));
    },

    // Stats inspection
    getStats: () => {
      return tabManager.getStats();
    },

    // Maze session inspection
    getMazeSession: async () => {
      try {
        return await getMazeSessionData();
      } catch (error) {
        generalLogger.error('Failed to get maze session in debug:', error);
        return null;
      }
    },

    // State management helpers
    clearUnblockedTabs: () => {
      tabManager.unblockedTabs.clear();
      generalLogger.log('🧹 Cleared all unblocked tabs');
    },

    clearRestoringTabs: () => {
      tabManager.restoringTabs.clear();
      generalLogger.log('🧹 Cleared all restoring tabs');
    },

    resetState: () => {
      tabManager.unblockedTabs.clear();
      tabManager.restoringTabs.clear();
      tabManager.blockedUrls.clear();
      tabManager.mazeTabId = null;
      generalLogger.log('🔄 Reset all tab manager state');
    },

    // Testing helpers
    simulateTabLimit: async (limit) => {
      await tabManager.updateTabLimit(limit);
      generalLogger.log(`🎯 Set tab limit to ${limit} for testing`);
    },

    setDailyMazeCount: async (count) => {
      // Update the TabManager's in-memory count
      tabManager.dailyMazesCompleted = count;

      // Also update the storage for consistency
      const store = usageDataStore();
      const todayKey = store.getTodayKey();
      const result = await chrome.storage.local.get(['dailyMazes']);
      const dailyMazes = result.dailyMazes || {};
      dailyMazes[todayKey] = count;
      await chrome.storage.local.set({ dailyMazes });

      generalLogger.log(`🎮 Set daily maze count to ${count} for testing`);
      generalLogger.log(`💡 This will give you difficulty level: ${tabManager.calculateMazeDifficulty('limitExceeded')}`);
      return count;
    },

    forceBlock: async (url) => {
      const tabs = await chrome.tabs.query({});
      const regularTabs = tabs.filter(tab => !isSpecialTab(tab) && !isMazeTab(tab));

      if (regularTabs.length >= tabManager.tabLimit) {
        generalLogger.log(`🚫 Would block new tab with URL: ${url} (${regularTabs.length}/${tabManager.tabLimit} tabs)`);
        return true;
      } else {
        generalLogger.log(`✅ Would allow new tab with URL: ${url} (${regularTabs.length}/${tabManager.tabLimit} tabs)`);
        return false;
      }
    },

    // Locale testing helpers
    setLocale: async (locale) => {
      try {
        const result = await setLocaleOverride(locale);
        if (result) {
          generalLogger.log(`🌍 Locale override set to: ${locale || 'default'}`);
          generalLogger.log('💡 Refresh any open extension pages to see changes');
        }
        return result;
      } catch (error) {
        generalLogger.error('Failed to set locale override:', error);
        return false;
      }
    },

    getAvailableLocales: () => {
      const locales = ['en', 'zh_TW'];
      // eslint-disable-next-line no-console
      console.log('🌍 Available locales:');
      locales.forEach(locale => {
        const name = locale === 'en' ? 'English' : 'Traditional Chinese (zh_TW)';
        // eslint-disable-next-line no-console
        console.log(`  ${locale} - ${name}`);
      });
      return locales;
    },

    // Component testing helpers
    openTrendGraphTestPage: async () => {
      try {
        const testPageUrl = chrome.runtime.getURL('src/test-trend-graph.html');
        await chrome.tabs.create({ url: testPageUrl });
        generalLogger.log('🧪 Opened trend graph test page');
        return true;
      } catch (error) {
        generalLogger.error('Failed to open trend graph test page:', error);
        return false;
      }
    },

    // Data generation helpers
    generateRichTestData: async () => {
      try {
        const data = generateRichData();
        const store = usageDataStore();

        // Format data for import (needs exportDate wrapper)
        const importData = {
          data: data,
          exportDate: new Date().toISOString(),
          version: '1.0.0'
        };

        // Import the generated data
        await store.importAllData(importData);

        generalLogger.log('📊 Generated and imported rich test dataset (90 days)');
        generalLogger.log(`✨ Dataset includes ${Object.keys(data.dailyMazes || {}).length} maze days, ${Object.keys(data.dailyTabLimits || {}).length} tab limit days`);
        return data;
      } catch (error) {
        generalLogger.error('Failed to generate rich test data:', error);
        throw error;
      }
    },

    generateSparseTestData: async () => {
      try {
        const data = generateSparseData();
        const store = usageDataStore();

        // Format data for import (needs exportDate wrapper)
        const importData = {
          data: data,
          exportDate: new Date().toISOString(),
          version: '1.0.0'
        };

        // Import the generated data
        await store.importAllData(importData);

        generalLogger.log('📊 Generated and imported sparse test dataset');
        return data;
      } catch (error) {
        generalLogger.error('Failed to generate sparse test data:', error);
        throw error;
      }
    },

    generateExtremeTestData: async () => {
      try {
        const data = generateExtremeData();
        const store = usageDataStore();

        // Format data for import (needs exportDate wrapper)
        const importData = {
          data: data,
          exportDate: new Date().toISOString(),
          version: '1.0.0'
        };

        // Import the generated data
        await store.importAllData(importData);

        generalLogger.log('📊 Generated and imported extreme test dataset');
        return data;
      } catch (error) {
        generalLogger.error('Failed to generate extreme test data:', error);
        throw error;
      }
    },

    // Help function
    help: () => {
      // eslint-disable-next-line no-console
      console.log(`
🔧 Tab Keeper Debug Utilities
==============================

Core Inspection:
  debugTabKeeper.tabManager        - Direct access to tab manager instance
  debugTabKeeper.getState()        - Get current state snapshot
  debugTabKeeper.getAllTabs()      - Get all tabs with keeper status
  debugTabKeeper.getStats()        - Get extension statistics
  debugTabKeeper.getMazeSession()  - Get current maze session data

State Management:
  debugTabKeeper.clearUnblockedTabs()  - Clear unblocked tabs set
  debugTabKeeper.clearRestoringTabs()  - Clear restoring tabs set
  debugTabKeeper.resetState()          - Reset all tab manager state

Testing Helpers:
  debugTabKeeper.simulateTabLimit(n)   - Set tab limit for testing
  debugTabKeeper.setDailyMazeCount(n)  - Set daily maze count for testing difficulty levels
  debugTabKeeper.forceBlock(url)       - Check if URL would be blocked

Component Testing:
  debugTabKeeper.openTrendGraphTestPage() - Open trend graph test page

Data Generation:
  debugTabKeeper.generateRichTestData()    - Generate realistic 90-day dataset
  debugTabKeeper.generateSparseTestData()  - Generate sparse dataset with gaps
  debugTabKeeper.generateExtremeTestData() - Generate extreme values dataset

Localization Testing:
  debugTabKeeper.setLocale('zh_TW')    - Test Traditional Chinese
  debugTabKeeper.setLocale('en')       - Test English
  debugTabKeeper.setLocale()           - Reset to browser default
  debugTabKeeper.setLocale(null)       - Reset to browser default (same as above)
  debugTabKeeper.getAvailableLocales() - List available locales

Utilities:
  debugTabKeeper.help()            - Show this help message

Example Usage:
  debugTabKeeper.getState()
  debugTabKeeper.getAllTabs().then(console.table)
  debugTabKeeper.generateRichTestData()  // Generate 90 days of realistic data
  debugTabKeeper.setLocale('zh_TW')      // Test Chinese localization
  debugTabKeeper.simulateTabLimit(3)
  debugTabKeeper.setDailyMazeCount(120)  // Test insane difficulty (inferno theme!)
      `);
    }
  };

  // Show initial help message
  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.log('🔧 Tab Keeper debugging utilities loaded! Type debugTabKeeper.help() for usage.');
  }, 1000);
}

// Initialize on service worker startup
initializeExtension();

