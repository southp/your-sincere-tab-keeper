/**
 * TabManager - Core application logic for tab management
 * 
 * This class encapsulates all the business logic for tab limiting, maze handling,
 * and state management, separate from Chrome service worker event handling.
 */

import { TAB_LIMITS } from './constants.js';
import { Logger } from './debug.js';
import { isSpecialTab, isMazeTab, isPopupWindow } from './utils.js';
import { usageDataStore } from './usage-data-store.js';

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
    this.dailyMazesCompleted = 0; // Daily counter for difficulty scaling
    this.isInitialized = false;
    this.restoringTabs = new Set(); // Track tabs currently being restored
    this.unblockedTabs = new Set(); // Track tabs that have solved mazes and are permanently unblocked
    this.completedMazeSessions = new Set(); // Track completed maze sessions to prevent re-entry
  }

  /**
   * Get today's date key for daily tracking (YYYY-MM-DD format)
   */
  getTodayKey() {
    const today = new Date();
    return today.getFullYear() + '-' + 
           String(today.getMonth() + 1).padStart(2, '0') + '-' + 
           String(today.getDate()).padStart(2, '0');
  }

  /**
   * Get or initialize today's maze completion count
   */
  async getTodayMazeCount() {
    try {
      const store = usageDataStore();
      return await store.getTodayMazeCount();
    } catch (error) {
      this.storageLogger.error('Failed to get today\'s maze count:', error);
      return 0;
    }
  }

  /**
   * Increment today's maze completion count
   */
  async incrementTodayMazeCount() {
    try {
      const store = usageDataStore();
      this.dailyMazesCompleted = await store.incrementTodayMazeCount();
      
      this.storageLogger.log(`Incremented today's maze count to ${this.dailyMazesCompleted}`);
    } catch (error) {
      this.storageLogger.error('Failed to increment today\'s maze count:', error);
    }
  }

  /**
   * Record today's tab limit for trend tracking
   */
  async recordTodayTabLimit() {
    try {
      const store = usageDataStore();
      await store.recordTodayTabLimit(this.tabLimit);
      
      this.storageLogger.log(`Recorded today's tab limit: ${this.tabLimit}`);
    } catch (error) {
      this.storageLogger.error('Failed to record today\'s tab limit:', error);
    }
  }

  /**
   * Increment today's blocked attempts count
   */
  async incrementTodayBlockedCount() {
    try {
      const store = usageDataStore();
      const newCount = await store.incrementTodayBlockedCount();
      
      this.storageLogger.log(`Incremented today's blocked count to ${newCount}`);
    } catch (error) {
      this.storageLogger.error('Failed to increment today\'s blocked count:', error);
    }
  }

  /**
   * Initialize the tab manager with settings from storage
   */
  async initialize() {
    try {
      // Load tab limit from storage
      const store = usageDataStore();
      this.tabLimit = await store.getTabLimit();
      this.tabLogger.log('Loaded tab limit from storage:', this.tabLimit);

      // Initialize install date if not exists
      await store.initializeInstallDate();
      this.storageLogger.log('Initialized install date');

      // Load today's maze completion count
      this.dailyMazesCompleted = await this.getTodayMazeCount();
      this.storageLogger.log('Loaded today\'s maze count:', this.dailyMazesCompleted);

      // Record today's tab limit for trend tracking
      await this.recordTodayTabLimit();

      // Initialize tab state based on currently open tabs
      await this.initializeTabState();

      // Mark existing tabs as unblocked to prevent counter-intuitive behavior
      await this.markExistingTabsAsUnblocked();

      this.isInitialized = true;
      this.generalLogger.log('TabManager initialized successfully');
    } catch (error) {
      this.generalLogger.error('Failed to initialize TabManager:', error);
      // Set safe defaults
      this.tabLimit = TAB_LIMITS.DEFAULT;
      this.dailyMazesCompleted = 0;
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
    
    // Allow popup windows (SSO authentication, payment flows, etc.)
    if (await isPopupWindow(tab)) {
      this.tabLogger.log('Allowing popup window for tab:', tab.id);
      return { action: 'allow' };
    }
    
    // Allow tabs being restored from maze completion
    if (this.restoringTabs.has(tab.id)) return { action: 'allow' };
    
    // Allow tabs that have been permanently unblocked by solving a maze
    if (this.unblockedTabs.has(tab.id)) return { action: 'allow' };
    
    const currentCount = await this.getCurrentTabCount();
    
    // If within limit (including the new tab), allow and mark as unblocked
    // Note: currentCount includes the tab being evaluated since onCreated fires after tab creation
    if (currentCount <= this.tabLimit) {
      // Mark this tab as unblocked so it won't show mazes on URL changes
      this.unblockedTabs.add(tab.id);
      this.tabLogger.log('Marked new tab as unblocked (within limit):', tab.id);
      return { action: 'allow' };
    }
    
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
      
      // Store maze session data using data store
      const store = usageDataStore();
      await store.setMazeSession({
        tabId: tab.id,
        difficulty: this.dailyMazesCompleted,
        timestamp: Date.now()
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
          const store = usageDataStore();
          const session = await store.getMazeSession();
          isUpdateLimitMaze = session && session.action === 'updateLimit';
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
      await this.incrementTodayMazeCount();
      await this.incrementStat('mazesCompleted');
      
      // Mark this tab as permanently unblocked for its lifetime
      this.unblockedTabs.add(tabId);
      this.tabLogger.log('Marked tab as permanently unblocked:', tabId);
      
      // Mark maze as completed to prevent re-entry on navigation
      this.markMazeAsCompleted(tabId);
      
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
   * Mark a maze session as completed to prevent re-entry on navigation
   */
  markMazeAsCompleted(tabId) {
    if (tabId) {
      const completionKey = `maze_completed_tab_${tabId}`;
      this.completedMazeSessions.add(completionKey);
      this.mazeLogger.log('Marked maze as completed for tab:', tabId);
      
      // Store in sessionStorage as well for persistence across page reloads
      try {
        sessionStorage.setItem(completionKey, 'true');
      } catch (error) {
        this.mazeLogger.error('Error storing completion marker in sessionStorage:', error);
      }
    }
  }

  /**
   * Check if a maze session has already been completed
   */
  isMazeCompleted(tabId) {
    if (!tabId) return false;
    
    const completionKey = `maze_completed_tab_${tabId}`;
    
    // Check in-memory state first
    if (this.completedMazeSessions.has(completionKey)) {
      return true;
    }
    
    // Check sessionStorage as fallback
    try {
      const isCompleted = sessionStorage.getItem(completionKey) === 'true';
      if (isCompleted) {
        // Sync back to in-memory state
        this.completedMazeSessions.add(completionKey);
      }
      return isCompleted;
    } catch (error) {
      this.mazeLogger.error('Error checking completion marker in sessionStorage:', error);
      return false;
    }
  }

  /**
   * Clear completion tracking for a tab (used when maze tab is closed or replaced)
   */
  clearMazeCompletion(tabId) {
    if (tabId) {
      const completionKey = `maze_completed_tab_${tabId}`;
      this.completedMazeSessions.delete(completionKey);
      
      try {
        sessionStorage.removeItem(completionKey);
      } catch (error) {
        this.mazeLogger.error('Error removing completion marker from sessionStorage:', error);
      }
      
      this.mazeLogger.log('Cleared maze completion marker for tab:', tabId);
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
    this.unblockedTabs.delete(tabId);
    if (this.mazeTabId === tabId) {
      this.mazeTabId = null;
    }
    if (this.blockedUrls.has(tabId)) {
      this.blockedUrls.delete(tabId);
    }
    this.generalLogger.log('Cleaned up all references for tab:', tabId);
  }

  /**
   * Initialize tab state based on currently open tabs
   * Since service workers don't persist across browser restarts or terminations,
   * we need to rebuild our in-memory state from the current browser state.
   */
  async initializeTabState() {
    try {
      // Get all currently existing tabs
      const existingTabs = await chrome.tabs.query({});
      
      // Check if any tab looks like a maze tab from this extension
      const mazeTab = existingTabs.find(tab => isMazeTab(tab));
      if (mazeTab) {
        this.mazeTabId = mazeTab.id;
        this.tabLogger.log('Found existing maze tab on initialization:', mazeTab.id);
      }
      
      // Note: We intentionally don't try to restore other state like unblockedTabs,
      // restoringTabs, or blockedUrls because:
      // 1. Service workers lose all memory on restart/termination
      // 2. These states are transient and will be rebuilt naturally as users interact
      // 3. markExistingTabsAsUnblocked() will handle the unblocked tabs properly
      
      this.generalLogger.log('Initialized tab state from current browser state');
      
    } catch (error) {
      this.generalLogger.error('Error initializing tab state:', error);
    }
  }

  /**
   * Mark existing tabs as unblocked to prevent counter-intuitive behavior
   * When users have tabs open before reaching their limit, those tabs should
   * remain unblocked even if their URLs change later.
   */
  async markExistingTabsAsUnblocked() {
    try {
      // Get all currently existing tabs
      const existingTabs = await chrome.tabs.query({});
      
      // Filter to regular tabs (exclude special tabs, maze tabs, popups)
      const regularTabs = [];
      for (const tab of existingTabs) {
        if (!isSpecialTab(tab) && !isMazeTab(tab) && !(await isPopupWindow(tab))) {
          regularTabs.push(tab);
        }
      }
      
      // Sort tabs by ID (older tabs typically have lower IDs)
      regularTabs.sort((a, b) => a.id - b.id);
      
      // Mark up to the tab limit as unblocked
      const tabsToUnblock = regularTabs.slice(0, this.tabLimit);
      
      tabsToUnblock.forEach(tab => {
        if (!this.unblockedTabs.has(tab.id)) {
          this.unblockedTabs.add(tab.id);
          this.tabLogger.log('Marked existing tab as unblocked:', tab.id, tab.url);
        }
      });
      
      if (tabsToUnblock.length > 0) {
        this.generalLogger.log(`Marked ${tabsToUnblock.length} existing tabs as unblocked`);
      }
      
    } catch (error) {
      this.generalLogger.error('Error marking existing tabs as unblocked:', error);
    }
  }

  /**
   * Handle tab limit updates
   */
  async handleTabLimitUpdate(newLimit) {
    if (newLimit >= TAB_LIMITS.MIN && newLimit <= TAB_LIMITS.MAX) {
      const oldLimit = this.tabLimit;
      this.tabLimit = newLimit;
      const store = usageDataStore();
      await store.setTabLimit(newLimit);
      await this.recordTodayTabLimit();
      this.generalLogger.log('Tab limit updated from', oldLimit, 'to:', newLimit);
      
      if (newLimit < oldLimit) {
        // If the new limit is lower, close excess tabs intelligently
        await this.smartTabClosure(newLimit);
      } else if (newLimit > oldLimit) {
        // If the new limit is higher, mark additional existing tabs as unblocked
        await this.markExistingTabsAsUnblocked();
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
        const store = usageDataStore();
      await store.setTabLimit(newLimit);
        await this.recordTodayTabLimit();
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
      const store = usageDataStore();
      const extendedStats = await store.getExtendedStatistics();
      
      return {
        ...extendedStats,
        tabLimit: this.tabLimit
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
   * Handle tab replacement due to prerendering
   * When Chrome prerenders a page and swaps it in, the tab ID changes.
   * We need to transfer all references from the old tab ID to the new one.
   */
  onTabReplaced(addedTabId, removedTabId) {
    this.generalLogger.log('Tab replaced due to prerendering:', removedTabId, '→', addedTabId);
    
    // Transfer unblocked status
    if (this.unblockedTabs.has(removedTabId)) {
      this.unblockedTabs.delete(removedTabId);
      this.unblockedTabs.add(addedTabId);
      this.tabLogger.log('Transferred unblocked status:', removedTabId, '→', addedTabId);
    }
    
    // Transfer restoring status
    if (this.restoringTabs.has(removedTabId)) {
      this.restoringTabs.delete(removedTabId);
      this.restoringTabs.add(addedTabId);
      this.tabLogger.log('Transferred restoring status:', removedTabId, '→', addedTabId);
    }
    
    // Transfer blocked URL mapping
    if (this.blockedUrls.has(removedTabId)) {
      const blockedUrl = this.blockedUrls.get(removedTabId);
      this.blockedUrls.delete(removedTabId);
      this.blockedUrls.set(addedTabId, blockedUrl);
      this.tabLogger.log('Transferred blocked URL mapping:', removedTabId, '→', addedTabId);
    }
    
    // Update maze tab reference
    if (this.mazeTabId === removedTabId) {
      this.mazeTabId = addedTabId;
      this.tabLogger.log('Updated maze tab reference:', removedTabId, '→', addedTabId);
    }
    
    // Transfer maze completion tracking
    const removedCompletionKey = `maze_completed_tab_${removedTabId}`;
    const addedCompletionKey = `maze_completed_tab_${addedTabId}`;
    if (this.completedMazeSessions.has(removedCompletionKey)) {
      this.completedMazeSessions.delete(removedCompletionKey);
      this.completedMazeSessions.add(addedCompletionKey);
      this.mazeLogger.log('Transferred maze completion tracking:', removedTabId, '→', addedTabId);
      
      // Also update sessionStorage if possible
      try {
        sessionStorage.removeItem(removedCompletionKey);
        sessionStorage.setItem(addedCompletionKey, 'true');
      } catch (error) {
        this.mazeLogger.error('Error transferring completion marker in sessionStorage:', error);
      }
    }
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
      await this.incrementTodayBlockedCount();
      const store = usageDataStore();
      const timestamp = await store.setTimestamp('lastLimitHit');
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
      const store = usageDataStore();
      const newValue = await store.incrementStatistic(statName);
      this.storageLogger.log(`Incremented ${statName} to:`, newValue);
    } catch (error) {
      this.storageLogger.error(`Error incrementing ${statName}:`, error);
    }
  }
}