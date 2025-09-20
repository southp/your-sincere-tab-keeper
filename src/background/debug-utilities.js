/**
 * Background Debug Utilities - Development-only debugging functionality
 * Extracted from background.js for better organization and testability
 */

import { Logger } from '../debug.js';
import { isDevelopment } from '../env.js';
import { isSpecialTab, isMazeTab } from '../utils.js';
import { setLocaleOverride } from '../ui-utils.js';
import { usageDataStore } from '../usage-data-store.js';
import { getMazeSessionData } from '../maze/maze-session.js';
import { generateRichData, generateSparseData, generateExtremeData } from '../test-data-generator.js';

const logger = new Logger('DEBUG-UTILITIES');

/**
 * Setup debugging utilities for development environment
 */
export async function setupDebugUtilities(tabManager) {
  if (!(await isDevelopment())) {
    return { enabled: false, reason: 'not-development' };
  }

  logger.log('🔧 Development mode detected - setting up debug utilities');

  // Expose tab manager for console inspection
  globalThis.debugTabKeeper = createDebugInterface(tabManager);

  // Show initial help message
  setTimeout(() => {
    console.log('🔧 Tab Keeper debugging utilities loaded! Type debugTabKeeper.help() for usage.');
  }, 1000);

  return { enabled: true };
}

/**
 * Create the debug interface object
 */
function createDebugInterface(tabManager) {
  return {
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
    getStats: () => tabManager.getStats(),

    // Maze session inspection
    getMazeSession: async () => {
      try {
        return await getMazeSessionData();
      } catch (error) {
        logger.error('Failed to get maze session in debug:', error);
        return null;
      }
    },

    // State management helpers
    clearUnblockedTabs: () => {
      tabManager.unblockedTabs.clear();
      logger.log('🧹 Cleared all unblocked tabs');
    },

    clearRestoringTabs: () => {
      tabManager.restoringTabs.clear();
      logger.log('🧹 Cleared all restoring tabs');
    },

    resetState: () => {
      tabManager.unblockedTabs.clear();
      tabManager.restoringTabs.clear();
      tabManager.blockedUrls.clear();
      tabManager.mazeTabId = null;
      logger.log('🔄 Reset all tab manager state');
    },

    // Testing helpers
    simulateTabLimit: async (limit) => {
      await tabManager.updateTabLimit(limit);
      logger.log(`🎯 Set tab limit to ${limit} for testing`);
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

      logger.log(`🎮 Set daily maze count to ${count} for testing`);
      logger.log(`💡 This will give you difficulty level: ${tabManager.calculateMazeDifficulty('limitExceeded')}`);
      return count;
    },

    forceBlock: async (url) => {
      const tabs = await chrome.tabs.query({});
      const regularTabs = tabs.filter(tab => !isSpecialTab(tab) && !isMazeTab(tab));

      if (regularTabs.length >= tabManager.tabLimit) {
        logger.log(`🚫 Would block new tab with URL: ${url} (${regularTabs.length}/${tabManager.tabLimit} tabs)`);
        return true;
      } else {
        logger.log(`✅ Would allow new tab with URL: ${url} (${regularTabs.length}/${tabManager.tabLimit} tabs)`);
        return false;
      }
    },

    // Locale testing helpers
    setLocale: async (locale) => {
      try {
        const result = await setLocaleOverride(locale);
        if (result) {
          logger.log(`🌍 Locale override set to: ${locale || 'default'}`);
          logger.log('💡 Refresh any open extension pages to see changes');
        }
        return result;
      } catch (error) {
        logger.error('Failed to set locale override:', error);
        return false;
      }
    },

    getAvailableLocales: () => {
      const locales = ['en', 'zh_TW'];
      console.log('🌍 Available locales:');
      locales.forEach(locale => {
        const name = locale === 'en' ? 'English' : 'Traditional Chinese (zh_TW)';
        console.log(`  ${locale} - ${name}`);
      });
      return locales;
    },

    // Component testing helpers
    openTrendGraphTestPage: async () => {
      try {
        const testPageUrl = chrome.runtime.getURL('src/test-trend-graph.html');
        await chrome.tabs.create({ url: testPageUrl });
        logger.log('🧪 Opened trend graph test page');
        return true;
      } catch (error) {
        logger.error('Failed to open trend graph test page:', error);
        return false;
      }
    },

    // Data generation helpers
    generateRichTestData: () => generateTestData(generateRichData, 'rich'),
    generateSparseTestData: () => generateTestData(generateSparseData, 'sparse'),
    generateExtremeTestData: () => generateTestData(generateExtremeData, 'extreme'),

    // Help function
    help: () => {
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
}

/**
 * Helper function for data generation
 */
async function generateTestData(generatorFn, type) {
  try {
    const data = generatorFn();
    const store = usageDataStore();

    // Format data for import (needs exportDate wrapper)
    const importData = {
      data: data,
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };

    // Import the generated data
    await store.importAllData(importData);

    const typeDescriptions = {
      rich: 'Generated and imported rich test dataset (90 days)',
      sparse: 'Generated and imported sparse test dataset',
      extreme: 'Generated and imported extreme test dataset'
    };

    logger.log(`📊 ${typeDescriptions[type]}`);
    if (type === 'rich') {
      logger.log(`✨ Dataset includes ${Object.keys(data.dailyMazes || {}).length} maze days, ${Object.keys(data.dailyTabLimits || {}).length} tab limit days`);
    }
    return data;
  } catch (error) {
    logger.error(`Failed to generate ${type} test data:`, error);
    throw error;
  }
}
