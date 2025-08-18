/**
 * TabManager - Core application logic for tab management
 * 
 * This class encapsulates all the business logic for tab limiting, maze handling,
 * and state management, separate from Chrome service worker event handling.
 */

import { TAB_LIMITS } from './constants.js';
import { Logger } from './debug.js';
import { isSpecialTab, isMazeTab } from './utils.js';

export class TabManager {
  // Configurable timing constants
  static TIMING = {
    MAZE_COMPLETION_DISPLAY: 5000,    // How long to show productivity tip
    EMPTY_TAB_CLEANUP_DELAY: 800      // Delay before closing empty tabs
  };

  constructor(options = {}) {
    // Allow timing override for testing
    this.timing = { ...TabManager.TIMING, ...options.timing };
    
    // Initialize loggers
    this.tabLogger = new Logger('TAB-MANAGER');
    this.mazeLogger = new Logger('MAZE-MANAGER');
    this.storageLogger = new Logger('STORAGE-MANAGER');
    this.generalLogger = new Logger('TAB-MANAGER-GENERAL');
    
    // In-memory state
    this.tabLimit = TAB_LIMITS.DEFAULT;
    this.blockedUrls = new Map(); // tabId -> original URL mapping
    this.mazeTabId = null; // Track current maze tab
    this.mazesCompleted = 0; // Session counter for difficulty scaling
    this.isInitialized = false;
    this.restoringTabs = new Set(); // Track tabs currently being restored
  }

  /**
   * Initialize the tab manager with settings from storage
   */
  async initialize() {
    try {
      // Load tab limit from storage
      const result = await chrome.storage.local.get(['tabLimit']);
      if (result.tabLimit) {
        this.tabLimit = result.tabLimit;
        this.tabLogger.log('Loaded tab limit from storage:', this.tabLimit);
      } else {
        this.tabLimit = TAB_LIMITS.DEFAULT;
        await chrome.storage.local.set({ tabLimit: this.tabLimit });
        this.tabLogger.log('Set default tab limit:', this.tabLimit);
      }

      // Set install date if not exists
      const installResult = await chrome.storage.local.get(['installDate']);
      if (!installResult.installDate) {
        await chrome.storage.local.set({ installDate: Date.now() });
        this.storageLogger.log('Set install date');
      }

      this.isInitialized = true;
      this.generalLogger.log('TabManager initialized successfully');
    } catch (error) {
      this.generalLogger.error('Failed to initialize TabManager:', error);
      // Set safe defaults
      this.tabLimit = TAB_LIMITS.DEFAULT;
      this.isInitialized = true;
    }
  }

  /**
   * Get current tab count excluding special tabs
   */
  async getCurrentTabCount() {
    try {
      const tabs = await chrome.tabs.query({});
      const regularTabs = tabs.filter(tab => !isSpecialTab(tab) && !isMazeTab(tab));
      return regularTabs.length;
    } catch (error) {
      this.tabLogger.error('Error getting current tab count:', error);
      return 0;
    }
  }

  /**
   * Check if tab creation should be allowed and how it should be handled
   * @returns {Object} - { action: 'allow' | 'redirect-to-maze' | 'show-notification' }
   */
  async shouldAllowNewTab(tab) {
    if (!this.isInitialized) return { action: 'allow' };
    
    // Allow special tabs and maze tabs
    if (isSpecialTab(tab) || isMazeTab(tab)) return { action: 'allow' };
    
    // Allow tabs being restored from maze completion
    if (this.restoringTabs.has(tab.id)) return { action: 'allow' };
    
    const currentCount = await this.getCurrentTabCount();
    
    // If under limit, allow
    if (currentCount < this.tabLimit) return { action: 'allow' };
    
    // Over limit - check if maze already exists
    if (this.mazeTabId) {
      // Maze already exists, show notification instead of creating another maze
      return { action: 'show-notification' };
    } else {
      // No maze exists, redirect to maze
      return { action: 'redirect-to-maze' };
    }
  }

  /**
   * Handle tab limit exceeded - redirect to maze
   */
  async handleTabLimitExceeded(tab) {
    try {
      this.tabLogger.log('Tab limit exceeded. Redirecting tab', tab.id, 'to maze');
      
      // Store original URL for later restoration
      if (tab.url && tab.url !== 'chrome://newtab/' && tab.url !== 'about:blank' && tab.url.trim() !== '') {
        this.blockedUrls.set(tab.id, tab.url);
        this.tabLogger.log('Stored original URL for tab', tab.id, ':', tab.url);
      } else {
        this.tabLogger.log('No URL to store for tab', tab.id, '- will default to new tab page');
      }
      
      // Store maze session data securely in Chrome storage
      await chrome.storage.local.set({
        currentMazeSession: {
          tabId: tab.id,
          difficulty: this.mazesCompleted,
          timestamp: Date.now()
        }
      });
      
      // Redirect to maze
      const mazeUrl = chrome.runtime.getURL('src/maze.html');
      
      try {
        await chrome.tabs.update(tab.id, { url: mazeUrl });
        this.mazeTabId = tab.id;
        this.tabLogger.log('Successfully redirected tab to maze');
        
        // Log limit hit for analytics
        await this.logLimitHitTimestamp();
      } catch (redirectError) {
        this.tabLogger.error('Failed to redirect tab to maze:', redirectError);
        // Clean up stored URL on failure
        this.blockedUrls.delete(tab.id);
      }
      
    } catch (error) {
      this.tabLogger.error('Error in handleTabLimitExceeded:', error);
    }
  }

  /**
   * Handle maze completion
   */
  async handleMazeCompleted(tabId, data) {
    this.mazeLogger.log('Maze completed for tab:', tabId, 'data:', data);
    
    try {
      // Verify the tab still exists before processing
      let tab;
      try {
        tab = await chrome.tabs.get(tabId);
        if (!tab) {
          this.tabLogger.error('Tab', tabId, 'no longer exists');
          return;
        }
      } catch (tabError) {
        this.tabLogger.error('Failed to get tab', tabId, '- may have been closed:', tabError);
        this.cleanupTabReferences(tabId);
        return;
      }
      
      // Check if this is an updateLimit maze by looking at message data or checking storage
      let isUpdateLimitMaze = false;
      
      if (data && data.action === 'updateLimit') {
        isUpdateLimitMaze = true;
      } else {
        // Fallback: check current storage
        try {
          const result = await chrome.storage.local.get(['currentMazeSession']);
          isUpdateLimitMaze = result.currentMazeSession && result.currentMazeSession.action === 'updateLimit';
        } catch (error) {
          this.mazeLogger.error('Failed to check maze session for updateLimit action:', error);
        }
      }
      
      // Mark tab as being restored
      this.restoringTabs.add(tabId);
      this.tabLogger.log('Marked tab as restoring:', tabId);
      
      // Reset maze tab tracking
      if (this.mazeTabId === tabId) {
        this.mazeTabId = null;
        this.mazeLogger.log('Reset maze tab tracking for tab:', tabId);
      }
      
      // Increment completion counters
      this.mazesCompleted++;
      await this.incrementStat('mazesCompleted');
      
      // Handle URL restoration
      const originalUrl = this.blockedUrls.get(tabId);
      this.tabLogger.log('Retrieved original URL for tab', tabId, ':', originalUrl || 'none (will use new tab page)');
      
      // Clean up stored URL
      if (this.blockedUrls.has(tabId)) {
        this.blockedUrls.delete(tabId);
      }
      
      // Determine target URL
      let targetUrl = originalUrl;
      
      if (!originalUrl || originalUrl.trim() === '' || originalUrl === 'about:blank') {
        if (isUpdateLimitMaze) {
          // Update limit mazes handle their own completion flow via modal
          this.restoringTabs.delete(tabId);
          return;
        }
        
        this.tabLogger.log('No valid stored URL for tab', tabId, '- closing maze tab to allow fresh new tab');
        // For empty tabs, close the maze and let user start fresh
        setTimeout(async () => {
          try {
            await chrome.tabs.remove(tabId);
            this.mazeLogger.log('Closed maze tab', tabId, 'for fresh start');
          } catch (error) {
            this.mazeLogger.error('Failed to close maze tab:', error);
            // Fallback to new tab redirect
            await this.handleUrlRedirect(tabId, 'chrome://newtab/');
          }
          this.restoringTabs.delete(tabId);
        }, this.timing.EMPTY_TAB_CLEANUP_DELAY);
        return;
      } else {
        this.tabLogger.log('Using stored URL for tab', tabId, ':', originalUrl);
      }
      
      // Wait to allow productivity tip to be displayed
      setTimeout(async () => {
        await this.handleUrlRedirect(tabId, targetUrl);
        this.mazeLogger.log('Maze completion handling finished for tab:', tabId);
      }, this.timing.MAZE_COMPLETION_DISPLAY);
      
    } catch (error) {
      this.mazeLogger.error('Error in handleMazeCompleted:', error);
      this.cleanupTabReferences(tabId);
    }
  }

  /**
   * Handle URL redirect after maze completion
   */
  async handleUrlRedirect(tabId, originalUrl) {
    try {
      this.tabLogger.log('Redirecting tab', tabId, 'to:', originalUrl);
      
      await chrome.tabs.update(tabId, { url: originalUrl });
      this.tabLogger.log('Successfully redirected tab:', tabId);
      
      // Don't delete restoringTabs flag immediately - let the tab loading event handle it
      // This prevents the tab from getting another maze during the redirect process
      
    } catch (error) {
      this.tabLogger.error('Failed to redirect tab', tabId, 'to:', originalUrl, error);
      this.restoringTabs.delete(tabId);
    }
  }

  /**
   * Clean up all references to a tab
   */
  cleanupTabReferences(tabId) {
    this.restoringTabs.delete(tabId);
    if (this.mazeTabId === tabId) {
      this.mazeTabId = null;
    }
    if (this.blockedUrls.has(tabId)) {
      this.blockedUrls.delete(tabId);
    }
    this.generalLogger.log('Cleaned up all references for tab:', tabId);
  }

  /**
   * Handle tab limit updates
   */
  async handleTabLimitUpdate(newLimit) {
    if (newLimit >= TAB_LIMITS.MIN && newLimit <= TAB_LIMITS.MAX) {
      const oldLimit = this.tabLimit;
      this.tabLimit = newLimit;
      await chrome.storage.local.set({ tabLimit: newLimit });
      this.generalLogger.log('Tab limit updated from', oldLimit, 'to:', newLimit);
      
      // If the new limit is lower, close excess tabs intelligently
      if (newLimit < oldLimit) {
        await this.smartTabClosure(newLimit);
      }
    } else {
      this.generalLogger.error('Invalid tab limit:', newLimit);
    }
  }

  /**
   * Handle onboarding completion
   */
  async handleCompleteOnboarding(newLimit) {
    try {
      if (newLimit && newLimit >= TAB_LIMITS.MIN && newLimit <= TAB_LIMITS.MAX) {
        this.tabLimit = newLimit;
        await chrome.storage.local.set({ tabLimit: newLimit });
        this.generalLogger.log('Onboarding completed with tab limit:', newLimit);
      }
    } catch (error) {
      this.generalLogger.error('Error completing onboarding:', error);
    }
  }

  /**
   * Intelligently close excess tabs when limit is reduced
   */
  async smartTabClosure(limit) {
    try {
      const tabs = await chrome.tabs.query({});
      const regularTabs = tabs.filter(tab => !isSpecialTab(tab) && !isMazeTab(tab));
      
      if (regularTabs.length <= limit) {
        this.tabLogger.log('No excess tabs to close');
        return;
      }
      
      const excessCount = regularTabs.length - limit;
      this.tabLogger.log(`Need to close ${excessCount} excess tabs`);
      
      // Sort by last accessed time, close oldest tabs first
      const sortedTabs = regularTabs.sort((a, b) => {
        const aTime = a.lastAccessed || 0;
        const bTime = b.lastAccessed || 0;
        return aTime - bTime;
      });
      
      const tabsToClose = sortedTabs.slice(0, excessCount);
      
      for (const tab of tabsToClose) {
        try {
          await chrome.tabs.remove(tab.id);
          this.tabLogger.log('Closed excess tab:', tab.id, tab.title);
        } catch (error) {
          this.tabLogger.error('Failed to close tab:', tab.id, error);
        }
      }
      
    } catch (error) {
      this.tabLogger.error('Error in smart tab closure:', error);
    }
  }

  /**
   * Get statistics for display
   */
  async getStats() {
    try {
      const stats = await chrome.storage.local.get([
        'mazesCompleted', 'blockedAttempts', 'installDate'
      ]);
      
      return {
        mazesCompleted: stats.mazesCompleted || 0,
        blockedAttempts: stats.blockedAttempts || 0,
        tabLimit: this.tabLimit,
        sessionMazesCompleted: this.mazesCompleted,
        installDate: stats.installDate || Date.now()
      };
    } catch (error) {
      this.generalLogger.error('Failed to get stats:', error);
      throw new Error('Failed to load statistics');
    }
  }

  /**
   * Focus the existing maze tab if it exists
   */
  async focusMazeTab() {
    if (!this.mazeTabId) return false;
    
    try {
      const tab = await chrome.tabs.get(this.mazeTabId);
      if (tab && isMazeTab(tab)) {
        await chrome.tabs.update(this.mazeTabId, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
        this.tabLogger.log('Focused existing maze tab:', this.mazeTabId);
        return true;
      }
    } catch (error) {
      this.tabLogger.error('Error focusing maze tab:', error);
      this.mazeTabId = null; // Clear invalid reference
    }
    
    return false;
  }

  /**
   * Handle tab removed event
   */
  onTabRemoved(tabId) {
    this.cleanupTabReferences(tabId);
  }

  /**
   * Handle tab loading completion
   */
  onTabLoadComplete(tabId) {
    if (this.restoringTabs.has(tabId)) {
      this.restoringTabs.delete(tabId);
      this.tabLogger.log('Tab', tabId, 'finished loading after maze completion - cleared restoring flag');
    }
  }

  /**
   * Log limit hit timestamp for analytics
   */
  async logLimitHitTimestamp() {
    try {
      await this.incrementStat('blockedAttempts');
      const timestamp = Date.now();
      await chrome.storage.local.set({ lastLimitHit: timestamp });
      this.storageLogger.log('Logged limit hit timestamp:', timestamp);
    } catch (error) {
      this.storageLogger.error('Error logging limit hit timestamp:', error);
    }
  }

  /**
   * Increment a statistic in storage
   */
  async incrementStat(statName) {
    try {
      const result = await chrome.storage.local.get([statName]);
      const currentValue = result[statName] || 0;
      const newValue = currentValue + 1;
      await chrome.storage.local.set({ [statName]: newValue });
      this.storageLogger.log(`Incremented ${statName} to:`, newValue);
    } catch (error) {
      this.storageLogger.error(`Error incrementing ${statName}:`, error);
    }
  }
}