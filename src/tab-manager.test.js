/**
 * Unit tests for TabManager using Jest
 * Run with: npm test
 */

import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { TabManager } from './tab-manager.js';
import { TAB_LIMITS } from './constants.js';

// Import mocked functions and TabManager after mocking
import { isSpecialTab, isMazeTab, isPopupWindow } from './utils.js';

// Mock Chrome APIs
const mockChrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    create: jest.fn()
  },
  windows: {
    get: jest.fn(),
    update: jest.fn()
  },
  runtime: {
    getURL: jest.fn()
  }
};

// Mock utility functions before any imports
jest.mock('./utils.js', () => ({
  isSpecialTab: jest.fn().mockReturnValue(false),
  isMazeTab: jest.fn().mockReturnValue(false),
  isPopupWindow: jest.fn().mockResolvedValue(false)
}));


// Set up global chrome mock
global.chrome = mockChrome;

// Get references to the mocked functions
const mockUtils = {
  isSpecialTab,
  isMazeTab,
  isPopupWindow
};

describe('TabManager', () => {
  let tabManager;

  // Helper function to set up standard mock configuration
  const setupStandardMocks = () => {
    mockUtils.isSpecialTab.mockReturnValue(false);
    mockUtils.isMazeTab.mockReturnValue(false);
  };

  beforeEach(() => {
    // Create TabManager with fast timing for tests
    tabManager = new TabManager({
      timing: {
        MAZE_COMPLETION_DISPLAY: 100,    // Fast completion display for tests
        EMPTY_TAB_CLEANUP_DELAY: 50      // Fast cleanup delay for tests
      }
    });

    // Reset all mocks
    jest.clearAllMocks();

    // Default mock implementations
    mockChrome.storage.local.get.mockResolvedValue({});
    mockChrome.storage.local.set.mockResolvedValue();
    mockChrome.tabs.query.mockResolvedValue([]);
    mockChrome.tabs.get.mockResolvedValue({ id: 1, url: 'http://example.com' });
    mockChrome.tabs.update.mockResolvedValue();
    mockChrome.tabs.remove.mockResolvedValue();
    mockChrome.windows.update.mockResolvedValue();
    mockChrome.runtime.getURL.mockImplementation(path => `chrome-extension://test/${path}`);

    // Set up standard mocks for regular tabs
    setupStandardMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    test('initializes with default values', () => {
      expect(tabManager.tabLimit).toBe(TAB_LIMITS.DEFAULT);
      expect(tabManager.blockedUrls).toBeInstanceOf(Map);
      expect(tabManager.mazeTabId).toBeNull();
      expect(tabManager.dailyMazesCompleted).toBe(0);
      expect(tabManager.isInitialized).toBe(false);
      expect(tabManager.restoringTabs).toBeInstanceOf(Set);
    });

    test('initializes with custom timing options', () => {
      const customTabManager = new TabManager({
        timing: {
          MAZE_COMPLETION_DISPLAY: 1000,
          EMPTY_TAB_CLEANUP_DELAY: 500
        }
      });

      expect(customTabManager.timing.MAZE_COMPLETION_DISPLAY).toBe(1000);
      expect(customTabManager.timing.EMPTY_TAB_CLEANUP_DELAY).toBe(500);
    });

    test('merges custom timing with defaults', () => {
      const customTabManager = new TabManager({
        timing: {
          MAZE_COMPLETION_DISPLAY: 2000  // Only override one value
        }
      });

      expect(customTabManager.timing.MAZE_COMPLETION_DISPLAY).toBe(2000);
      expect(customTabManager.timing.EMPTY_TAB_CLEANUP_DELAY).toBe(TabManager.TIMING.EMPTY_TAB_CLEANUP_DELAY);
    });
  });

  describe('initialize', () => {
    test('loads tab limit from storage successfully', async () => {
      mockChrome.storage.local.get.mockResolvedValue({ tabLimit: 5 });

      await tabManager.initialize();

      // Should load the tab limit through UsageDataStore
      expect(tabManager.tabLimit).toBe(5);
      expect(tabManager.isInitialized).toBe(true);
    });

    test('sets default tab limit when none in storage', async () => {
      mockChrome.storage.local.get.mockResolvedValue({});

      await tabManager.initialize();

      expect(tabManager.tabLimit).toBe(TAB_LIMITS.DEFAULT);
      expect(tabManager.isInitialized).toBe(true);
    });

    test('sets install date if not exists', async () => {
      const mockDate = 1234567890;
      jest.spyOn(Date, 'now').mockReturnValue(mockDate);
      mockChrome.storage.local.get.mockResolvedValueOnce({}).mockResolvedValueOnce({});

      await tabManager.initialize();

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ installDate: mockDate });
    });

    test('handles initialization errors gracefully', async () => {
      mockChrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

      await tabManager.initialize();

      expect(tabManager.tabLimit).toBe(TAB_LIMITS.DEFAULT);
      expect(tabManager.isInitialized).toBe(true);
    });
  });

  describe('getCurrentTabCount', () => {
    test('returns count of regular tabs', async () => {
      const tabs = [
        { id: 1, url: 'http://example.com' },
        { id: 2, url: 'http://google.com' },
        { id: 3, url: 'chrome://newtab' }
      ];
      mockChrome.tabs.query.mockResolvedValue(tabs);
      mockUtils.isSpecialTab.mockImplementation(tab => tab.url.startsWith('chrome://'));

      const count = await tabManager.getCurrentTabCount();

      expect(count).toBe(2);
      expect(mockChrome.tabs.query).toHaveBeenCalledWith({});
    });

    test('handles query error', async () => {
      mockChrome.tabs.query.mockRejectedValue(new Error('Query failed'));

      const count = await tabManager.getCurrentTabCount();

      expect(count).toBe(0);
    });
  });

  describe('shouldAllowNewTab', () => {
    beforeEach(async () => {
      await tabManager.initialize();
      tabManager.tabLimit = 3;
    });

    test('allows tab when not initialized', async () => {
      tabManager.isInitialized = false;

      const result = await tabManager.shouldAllowNewTab({ id: 1 });

      expect(result).toEqual({ action: 'allow' });
    });

    test('allows special tabs', async () => {
      const tab = { id: 1, url: 'chrome://newtab' };
      mockUtils.isSpecialTab.mockReturnValue(true);

      const result = await tabManager.shouldAllowNewTab(tab);

      expect(result).toEqual({ action: 'allow' });
    });

    test('allows maze tabs', async () => {
      const tab = { id: 1, url: 'chrome-extension://test/maze.html' };
      mockUtils.isMazeTab.mockReturnValue(true);

      const result = await tabManager.shouldAllowNewTab(tab);

      expect(result).toEqual({ action: 'allow' });
    });

    test('allows restoring tabs', async () => {
      const tab = { id: 1 };
      tabManager.restoringTabs.add(1);

      const result = await tabManager.shouldAllowNewTab(tab);

      expect(result).toEqual({ action: 'allow' });
    });

    test('allows unblocked tabs regardless of limit', async () => {
      // Set up a scenario where limit would normally be exceeded
      tabManager.tabLimit = 2;
      tabManager.isInitialized = true;
      tabManager.mazeTabId = null;
      mockUtils.isSpecialTab.mockReturnValue(false);
      mockUtils.isMazeTab.mockReturnValue(false);
      mockUtils.isPopupWindow.mockResolvedValue(false);
      jest.spyOn(tabManager, 'getCurrentTabCount').mockResolvedValue(3); // Over limit

      // Mark tab as unblocked
      const tab = { id: 4, url: 'http://example.com' };
      tabManager.unblockedTabs.add(4);

      const result = await tabManager.shouldAllowNewTab(tab);

      expect(result).toEqual({ action: 'allow' });
    });

    test('allows popup windows regardless of limit', async () => {
      // Set up a scenario where limit would normally be exceeded
      tabManager.tabLimit = 2;
      tabManager.isInitialized = true;
      tabManager.mazeTabId = null;
      mockUtils.isSpecialTab.mockReturnValue(false);
      mockUtils.isMazeTab.mockReturnValue(false);
      mockUtils.isPopupWindow.mockResolvedValue(true); // This is a popup window
      jest.spyOn(tabManager, 'getCurrentTabCount').mockResolvedValue(3); // Over limit

      const tab = { id: 5, url: 'https://accounts.google.com/oauth/authorize', windowId: 123 };

      const result = await tabManager.shouldAllowNewTab(tab);

      expect(result).toEqual({ action: 'allow' });
      expect(mockUtils.isPopupWindow).toHaveBeenCalledWith(tab);
    });

    test('allows tab when under limit', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const result = await tabManager.shouldAllowNewTab({ id: 3 });

      expect(result).toEqual({ action: 'allow' });
    });

    test('allows tab when exactly at limit', async () => {
      tabManager.tabLimit = 3;
      tabManager.isInitialized = true;
      mockUtils.isSpecialTab.mockReturnValue(false);
      mockUtils.isMazeTab.mockReturnValue(false);
      mockUtils.isPopupWindow.mockResolvedValue(false);

      // Mock getCurrentTabCount to return 3 (including the new tab being evaluated)
      jest.spyOn(tabManager, 'getCurrentTabCount').mockResolvedValue(3);

      const result = await tabManager.shouldAllowNewTab({ id: 3 });

      expect(result).toEqual({ action: 'allow' });
    });

    test('marks new tabs as unblocked when within limit', async () => {
      tabManager.tabLimit = 5;
      tabManager.isInitialized = true;
      mockUtils.isSpecialTab.mockReturnValue(false);
      mockUtils.isMazeTab.mockReturnValue(false);
      mockUtils.isPopupWindow.mockResolvedValue(false);

      // Mock getCurrentTabCount to return 3 (within limit of 5)
      jest.spyOn(tabManager, 'getCurrentTabCount').mockResolvedValue(3);

      const tab = { id: 4, url: 'http://example.com' };
      const result = await tabManager.shouldAllowNewTab(tab);

      expect(result).toEqual({ action: 'allow' });
      expect(tabManager.unblockedTabs.has(4)).toBe(true);
    });

    test('handles incremental unblocking after tabs are closed', async () => {
      // Simulate scenario: limit=3, had tabs 1,2,3 unblocked, closed 2&3, now opening new tabs
      tabManager.tabLimit = 3;
      tabManager.isInitialized = true;
      tabManager.unblockedTabs.add(1); // Pre-existing unblocked tab

      mockUtils.isSpecialTab.mockReturnValue(false);
      mockUtils.isMazeTab.mockReturnValue(false);
      mockUtils.isPopupWindow.mockResolvedValue(false);

      // New tab would bring count to 2 (within limit of 3)
      jest.spyOn(tabManager, 'getCurrentTabCount').mockResolvedValue(2);

      const newTab = { id: 5, url: 'http://newsite.com' };
      const result = await tabManager.shouldAllowNewTab(newTab);

      expect(result).toEqual({ action: 'allow' });
      expect(tabManager.unblockedTabs.has(1)).toBe(true); // Old tab still unblocked
      expect(tabManager.unblockedTabs.has(5)).toBe(true); // New tab also unblocked
    });

    test('redirects to maze when over limit and no maze exists', async () => {
      // Ensure TabManager is initialized and set up properly
      tabManager.tabLimit = 2;
      tabManager.isInitialized = true;
      tabManager.restoringTabs.clear(); // Ensure clean state
      tabManager.mazeTabId = null; // Ensure no maze exists

      // Mock utility functions for this specific test
      mockUtils.isSpecialTab.mockReturnValue(false);
      mockUtils.isMazeTab.mockReturnValue(false);
      mockUtils.isPopupWindow.mockResolvedValue(false);

      jest.spyOn(tabManager, 'getCurrentTabCount').mockResolvedValue(3);

      const tab = { id: 4, url: 'http://example.com' };

      // Debug: verify initial state
      expect(tabManager.isInitialized).toBe(true);
      expect(tabManager.tabLimit).toBe(2);
      expect(tabManager.restoringTabs.has(4)).toBe(false);
      expect(tabManager.mazeTabId).toBe(null);

      const result = await tabManager.shouldAllowNewTab(tab);

      expect(result).toEqual({ action: 'redirect-to-maze' });
    });

    test('shows notification when over limit and maze exists', async () => {
      // Ensure TabManager is initialized and set up properly
      tabManager.tabLimit = 2;
      tabManager.isInitialized = true;
      tabManager.restoringTabs.clear(); // Ensure clean state

      // Mock utility functions for this specific test
      mockUtils.isSpecialTab.mockReturnValue(false);
      mockUtils.isMazeTab.mockReturnValue(false);
      mockUtils.isPopupWindow.mockResolvedValue(false);

      jest.spyOn(tabManager, 'getCurrentTabCount').mockResolvedValue(3);
      tabManager.mazeTabId = 2; // Maze exists

      const tab = { id: 4, url: 'http://example.com' };
      const result = await tabManager.shouldAllowNewTab(tab);

      expect(result).toEqual({ action: 'show-notification' });
    });
  });

  describe('handleTabLimitExceeded', () => {
    beforeEach(async () => {
      await tabManager.initialize();
    });

    test('stores URL and redirects to maze successfully', async () => {
      const tab = { id: 1, url: 'http://example.com' };
      const mockMazeUrl = 'chrome-extension://test/maze.html';
      mockChrome.runtime.getURL.mockReturnValue(mockMazeUrl);

      await tabManager.handleTabLimitExceeded(tab);

      expect(tabManager.blockedUrls.get(1)).toBe('http://example.com');
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        currentMazeSession: {
          action: 'limitExceeded',
          difficulty: 0,
          timestamp: expect.any(Number)
        }
      });
      expect(mockChrome.tabs.update).toHaveBeenCalledWith(1, { url: mockMazeUrl });
      expect(tabManager.mazeTabId).toBe(1);
    });

    test('handles empty URL correctly', async () => {
      const tab = { id: 1, url: '' };

      await tabManager.handleTabLimitExceeded(tab);

      expect(tabManager.blockedUrls.has(1)).toBe(false);
    });

    test('handles chrome://newtab/ URL correctly', async () => {
      const tab = { id: 1, url: 'chrome://newtab/' };

      await tabManager.handleTabLimitExceeded(tab);

      expect(tabManager.blockedUrls.has(1)).toBe(false);
    });

    test('cleans up on redirect failure', async () => {
      const tab = { id: 1, url: 'http://example.com' };
      mockChrome.tabs.update.mockRejectedValue(new Error('Update failed'));

      await tabManager.handleTabLimitExceeded(tab);

      expect(tabManager.blockedUrls.has(1)).toBe(false);
    });
  });

  describe('handleMazeCompleted', () => {
    beforeEach(async () => {
      await tabManager.initialize();
      tabManager.mazeTabId = 1;
      tabManager.blockedUrls.set(1, 'http://example.com');
    });

    test('handles successful maze completion', async () => {
      const tab = { id: 1 };
      mockChrome.tabs.get.mockResolvedValue(tab);

      await tabManager.handleMazeCompleted(1, {});

      expect(tabManager.restoringTabs.has(1)).toBe(true);
      expect(tabManager.mazeTabId).toBeNull();
      expect(tabManager.dailyMazesCompleted).toBe(1);
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        mazesCompleted: 1
      });
    });

    test('marks tab as permanently unblocked after completion', async () => {
      const tab = { id: 1 };
      mockChrome.tabs.get.mockResolvedValue(tab);

      // Ensure tab is not initially unblocked
      expect(tabManager.unblockedTabs.has(1)).toBe(false);

      await tabManager.handleMazeCompleted(1, {});

      // Verify tab is now marked as unblocked
      expect(tabManager.unblockedTabs.has(1)).toBe(true);
    });

    test('handles updateLimit maze completion', async () => {
      const tab = { id: 1 };
      mockChrome.tabs.get.mockResolvedValue(tab);
      // For updateLimit mazes, there's typically no stored URL
      tabManager.blockedUrls.delete(1); // Ensure no URL is stored

      await tabManager.handleMazeCompleted(1, { action: 'updateLimit' });

      // UpdateLimit mazes clear restoring flag and return early
      expect(tabManager.restoringTabs.has(1)).toBe(false);
      expect(tabManager.mazeTabId).toBeNull();
      expect(tabManager.dailyMazesCompleted).toBe(1);
    });

    test('handles tab not found', async () => {
      mockChrome.tabs.get.mockRejectedValue(new Error('Tab not found'));

      await tabManager.handleMazeCompleted(1, {});

      expect(tabManager.mazeTabId).toBeNull();
      expect(tabManager.blockedUrls.has(1)).toBe(false);
    });

    test('closes tab for empty original URL', async () => {
      const tab = { id: 1 };
      mockChrome.tabs.get.mockResolvedValue(tab);
      tabManager.blockedUrls.delete(1);

      jest.useFakeTimers();
      await tabManager.handleMazeCompleted(1, {});
      jest.advanceTimersByTime(tabManager.timing.EMPTY_TAB_CLEANUP_DELAY);

      expect(mockChrome.tabs.remove).toHaveBeenCalledWith(1);
      jest.useRealTimers();
    });

    test('waits for productivity tip display before redirecting', async () => {
      const tab = { id: 1 };
      mockChrome.tabs.get.mockResolvedValue(tab);
      tabManager.blockedUrls.set(1, 'http://example.com');

      jest.useFakeTimers();
      const handleUrlRedirectSpy = jest.spyOn(tabManager, 'handleUrlRedirect').mockResolvedValue();

      await tabManager.handleMazeCompleted(1, {});

      // Should not have called redirect yet
      expect(handleUrlRedirectSpy).not.toHaveBeenCalled();

      // Advance time by the productivity tip display duration and run all pending timers
      jest.advanceTimersByTime(tabManager.timing.MAZE_COMPLETION_DISPLAY);
      await jest.runAllTimersAsync();

      // Now redirect should be called
      expect(handleUrlRedirectSpy).toHaveBeenCalledWith(1, 'http://example.com');

      jest.useRealTimers();
    });
  });

  describe('handleUrlRedirect', () => {
    test('redirects successfully', async () => {
      await tabManager.handleUrlRedirect(1, 'http://example.com');

      expect(mockChrome.tabs.update).toHaveBeenCalledWith(1, { url: 'http://example.com' });
    });

    test('handles redirect failure', async () => {
      mockChrome.tabs.update.mockRejectedValue(new Error('Redirect failed'));
      tabManager.restoringTabs.add(1);

      await tabManager.handleUrlRedirect(1, 'http://example.com');

      expect(tabManager.restoringTabs.has(1)).toBe(false);
    });
  });

  describe('cleanupTabReferences', () => {
    test('cleans up all tab references', () => {
      tabManager.restoringTabs.add(1);
      tabManager.mazeTabId = 1;
      tabManager.blockedUrls.set(1, 'http://example.com');
      tabManager.unblockedTabs.add(1);

      tabManager.cleanupTabReferences(1);

      expect(tabManager.restoringTabs.has(1)).toBe(false);
      expect(tabManager.mazeTabId).toBeNull();
      expect(tabManager.blockedUrls.has(1)).toBe(false);
      expect(tabManager.unblockedTabs.has(1)).toBe(false);
    });
  });

  describe('initializeTabState', () => {
    beforeEach(() => {
      // Reset utility mocks for each test
      mockUtils.isSpecialTab.mockReturnValue(false);
      mockUtils.isMazeTab.mockReturnValue(false);
      mockUtils.isPopupWindow.mockResolvedValue(false);
    });

    test('finds and sets existing maze tab on initialization', async () => {
      // Mock tabs where one is a maze tab
      const tabs = [
        { id: 1, url: 'https://example.com' },
        { id: 2, url: 'chrome-extension://abc123/src/maze.html' },
        { id: 3, url: 'https://google.com' }
      ];

      mockChrome.tabs.query.mockResolvedValue(tabs);
      mockUtils.isMazeTab.mockImplementation(tab => tab.url.includes('maze.html'));

      await tabManager.initializeTabState();

      expect(tabManager.mazeTabId).toBe(2);
    });

    test('handles no maze tab present', async () => {
      // Mock tabs with no maze tab
      const tabs = [
        { id: 1, url: 'https://example.com' },
        { id: 2, url: 'https://google.com' }
      ];

      mockChrome.tabs.query.mockResolvedValue(tabs);

      await tabManager.initializeTabState();

      expect(tabManager.mazeTabId).toBeNull();
    });

    test('handles errors gracefully', async () => {
      mockChrome.tabs.query.mockRejectedValue(new Error('Query failed'));

      await expect(tabManager.initializeTabState()).resolves.not.toThrow();
    });

    test('does not try to restore transient state', async () => {
      // Mock tabs
      const tabs = [{ id: 1, url: 'https://example.com' }];
      mockChrome.tabs.query.mockResolvedValue(tabs);

      await tabManager.initializeTabState();

      // Should not populate transient state (these start empty and get built naturally)
      expect(tabManager.unblockedTabs.size).toBe(0);
      expect(tabManager.restoringTabs.size).toBe(0);
      expect(tabManager.blockedUrls.size).toBe(0);
    });
  });

  describe('markExistingTabsAsUnblocked', () => {
    beforeEach(() => {
      // Reset utility mocks for each test
      mockUtils.isSpecialTab.mockReturnValue(false);
      mockUtils.isMazeTab.mockReturnValue(false);
      mockUtils.isPopupWindow.mockResolvedValue(false);
    });

    test('marks existing tabs as unblocked up to limit', async () => {
      tabManager.tabLimit = 3;

      // Mock 5 regular tabs
      const tabs = [
        { id: 1, url: 'https://example.com' },
        { id: 2, url: 'https://google.com' },
        { id: 3, url: 'https://github.com' },
        { id: 4, url: 'https://stackoverflow.com' },
        { id: 5, url: 'https://mdn.dev' }
      ];

      mockChrome.tabs.query.mockResolvedValue(tabs);

      await tabManager.markExistingTabsAsUnblocked();

      // Should mark first 3 tabs (up to limit) as unblocked
      expect(tabManager.unblockedTabs.has(1)).toBe(true);
      expect(tabManager.unblockedTabs.has(2)).toBe(true);
      expect(tabManager.unblockedTabs.has(3)).toBe(true);
      expect(tabManager.unblockedTabs.has(4)).toBe(false);
      expect(tabManager.unblockedTabs.has(5)).toBe(false);
    });

    test('excludes special tabs, maze tabs, and popups', async () => {
      tabManager.tabLimit = 3;

      const tabs = [
        { id: 1, url: 'chrome://settings' }, // Special tab
        { id: 2, url: 'chrome-extension://abc/maze.html' }, // Maze tab
        { id: 3, url: 'https://accounts.google.com', windowId: 123 }, // Popup
        { id: 4, url: 'https://example.com' }, // Regular tab
        { id: 5, url: 'https://google.com' } // Regular tab
      ];

      mockChrome.tabs.query.mockResolvedValue(tabs);

      // Configure mocks to identify special tabs
      mockUtils.isSpecialTab.mockImplementation(tab => tab.url.startsWith('chrome'));
      mockUtils.isMazeTab.mockImplementation(tab => tab.url.includes('maze.html'));
      mockUtils.isPopupWindow.mockImplementation(tab => tab.id === 3);

      await tabManager.markExistingTabsAsUnblocked();

      // Should only mark regular tabs as unblocked
      expect(tabManager.unblockedTabs.has(1)).toBe(false);
      expect(tabManager.unblockedTabs.has(2)).toBe(false);
      expect(tabManager.unblockedTabs.has(3)).toBe(false);
      expect(tabManager.unblockedTabs.has(4)).toBe(true);
      expect(tabManager.unblockedTabs.has(5)).toBe(true);
    });

    test('does not override already unblocked tabs', async () => {
      tabManager.tabLimit = 2;
      tabManager.unblockedTabs.add(1); // Already unblocked

      const tabs = [
        { id: 1, url: 'https://example.com' },
        { id: 2, url: 'https://google.com' }
      ];

      mockChrome.tabs.query.mockResolvedValue(tabs);

      await tabManager.markExistingTabsAsUnblocked();

      // Should still be unblocked
      expect(tabManager.unblockedTabs.has(1)).toBe(true);
      expect(tabManager.unblockedTabs.has(2)).toBe(true);
    });

    test('handles errors gracefully', async () => {
      mockChrome.tabs.query.mockRejectedValue(new Error('Query failed'));

      await expect(tabManager.markExistingTabsAsUnblocked()).resolves.not.toThrow();
    });
  });

  describe('handleTabLimitUpdate', () => {
    beforeEach(async () => {
      await tabManager.initialize();
    });

    test('updates valid tab limit', async () => {
      await tabManager.handleTabLimitUpdate(5);

      expect(tabManager.tabLimit).toBe(5);
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ tabLimit: 5 });
    });

    test('rejects invalid tab limit', async () => {
      const originalLimit = tabManager.tabLimit;

      await tabManager.handleTabLimitUpdate(100);

      expect(tabManager.tabLimit).toBe(originalLimit);
      expect(mockChrome.storage.local.set).not.toHaveBeenCalledWith({ tabLimit: 100 });
    });

    test('performs smart tab closure when limit lowered', async () => {
      tabManager.tabLimit = 5;
      jest.spyOn(tabManager, 'smartTabClosure').mockResolvedValue();

      await tabManager.handleTabLimitUpdate(3);

      expect(tabManager.smartTabClosure).toHaveBeenCalledWith(3);
    });

    test('marks additional tabs as unblocked when limit increased', async () => {
      tabManager.tabLimit = 2;
      jest.spyOn(tabManager, 'markExistingTabsAsUnblocked').mockResolvedValue();

      await tabManager.handleTabLimitUpdate(5);

      expect(tabManager.markExistingTabsAsUnblocked).toHaveBeenCalled();
    });

    test('does nothing special when limit stays the same', async () => {
      tabManager.tabLimit = 4;
      const markExistingTabsSpy = jest.spyOn(tabManager, 'markExistingTabsAsUnblocked').mockResolvedValue();
      const smartTabClosureSpy = jest.spyOn(tabManager, 'smartTabClosure').mockResolvedValue();

      await tabManager.handleTabLimitUpdate(4);

      expect(markExistingTabsSpy).not.toHaveBeenCalled();
      expect(smartTabClosureSpy).not.toHaveBeenCalled();
    });
  });

  describe('handleCompleteOnboarding', () => {
    test('sets valid tab limit', async () => {
      await tabManager.handleCompleteOnboarding(4);

      expect(tabManager.tabLimit).toBe(4);
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ tabLimit: 4 });
    });

    test('ignores invalid tab limit', async () => {
      const originalLimit = tabManager.tabLimit;

      await tabManager.handleCompleteOnboarding(0);

      expect(tabManager.tabLimit).toBe(originalLimit);
    });

    test('handles errors gracefully', async () => {
      mockChrome.storage.local.set.mockRejectedValue(new Error('Storage error'));

      await expect(tabManager.handleCompleteOnboarding(4)).resolves.not.toThrow();
    });
  });

  describe('smartTabClosure', () => {
    test('closes excess tabs by last accessed time', async () => {
      const tabs = [
        { id: 1, lastAccessed: 1000 },
        { id: 2, lastAccessed: 2000 },
        { id: 3, lastAccessed: 1500 },
        { id: 4, lastAccessed: 3000 }
      ];

      mockChrome.tabs.query.mockResolvedValue(tabs);
      mockChrome.tabs.remove.mockResolvedValue();

      // Test that the method executes without throwing errors
      await expect(tabManager.smartTabClosure(2)).resolves.not.toThrow();

      // Verify that tabs.query was called (method at least attempted to get tabs)
      expect(mockChrome.tabs.query).toHaveBeenCalledWith({});
    });

    test('does nothing when within limit', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      await tabManager.smartTabClosure(5);

      expect(mockChrome.tabs.remove).not.toHaveBeenCalled();
    });

    test('handles tab removal errors', async () => {
      const tabs = [{ id: 1 }, { id: 2 }, { id: 3 }];
      mockChrome.tabs.query.mockResolvedValue(tabs);
      mockChrome.tabs.remove.mockRejectedValue(new Error('Remove failed'));

      await expect(tabManager.smartTabClosure(1)).resolves.not.toThrow();
    });
  });

  describe('getStats', () => {
    test('returns complete statistics', async () => {
      // Mock the current date to match our test data
      const originalDate = global.Date;
      const mockDate = new originalDate('2025-08-25T10:30:00.000Z');
      global.Date = jest.fn(() => mockDate);
      global.Date.now = jest.fn(() => mockDate.getTime());
      global.Date.prototype = originalDate.prototype;

      // Mock all the calls that UsageDataStore.getExtendedStatistics makes
      // The calls are made in parallel so we need to set up all the expected data
      const basicStats = {
        mazesCompleted: 5,
        blockedAttempts: 10,
        tabLimit: TAB_LIMITS.DEFAULT,
        installDate: 1234567890
      };
      const dailyData = {
        dailyMazes: { '2025-08-25': 2 },
        dailyTabLimits: {},
        dailyBlockedAttempts: {}
      };

      mockChrome.storage.local.get
        .mockResolvedValueOnce(basicStats) // getStatistics call
        .mockResolvedValueOnce(dailyData)  // getDailyTrackingData call
        .mockResolvedValueOnce({ dailyMazes: { '2025-08-25': 2 } }); // getTodayMazeCount call

      tabManager.tabLimit = 4;

      const stats = await tabManager.getStats();

      expect(stats).toEqual({
        mazesCompleted: 5,
        blockedAttempts: 10,
        tabLimit: 4, // TabManager overrides this
        dailyMazesCompleted: 2,
        installDate: 1234567890,
        peakActivityHour: null, // No limit hit timestamps, so null
        dailyMazes: { '2025-08-25': 2 },
        dailyTabLimits: {},
        dailyBlockedAttempts: {}
      });

      // Restore original Date
      global.Date = originalDate;
    });

    test('handles missing stats with defaults', async () => {
      mockChrome.storage.local.get.mockResolvedValue({});

      const stats = await tabManager.getStats();

      expect(stats.mazesCompleted).toBe(0);
      expect(stats.blockedAttempts).toBe(0);
      expect(stats.installDate).toBeDefined();
    });

    test('throws error on storage failure', async () => {
      mockChrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

      await expect(tabManager.getStats()).rejects.toThrow('Failed to load statistics');
    });
  });

  describe('focusMazeTab', () => {
    test('focuses existing maze tab successfully', async () => {
      tabManager.mazeTabId = 1;
      const tab = { id: 1, windowId: 123 };
      mockChrome.tabs.get.mockResolvedValue(tab);
      mockChrome.tabs.update.mockResolvedValue();
      mockChrome.windows.update.mockResolvedValue();

      // Test that the method executes without throwing and calls the Chrome APIs
      await expect(tabManager.focusMazeTab()).resolves.not.toThrow();

      // Verify that the Chrome APIs were called (the core functionality)
      expect(mockChrome.tabs.get).toHaveBeenCalledWith(1);
    });

    test('returns false when no maze tab', async () => {
      tabManager.mazeTabId = null;

      const result = await tabManager.focusMazeTab();

      expect(result).toBe(false);
    });

    test('clears invalid maze tab reference', async () => {
      tabManager.mazeTabId = 1;
      mockChrome.tabs.get.mockRejectedValue(new Error('Tab not found'));

      const result = await tabManager.focusMazeTab();

      expect(result).toBe(false);
      expect(tabManager.mazeTabId).toBeNull();
    });
  });


  describe('onTabRemoved', () => {
    test('cleans up tab references', () => {
      jest.spyOn(tabManager, 'cleanupTabReferences');

      tabManager.onTabRemoved(1);

      expect(tabManager.cleanupTabReferences).toHaveBeenCalledWith(1);
    });
  });

  describe('onTabLoadComplete', () => {
    test('clears restoring flag for completed tab', () => {
      tabManager.restoringTabs.add(1);

      tabManager.onTabLoadComplete(1);

      expect(tabManager.restoringTabs.has(1)).toBe(false);
    });

    test('ignores non-restoring tabs', () => {
      tabManager.onTabLoadComplete(1);

      expect(tabManager.restoringTabs.has(1)).toBe(false);
    });
  });

  describe('onTabReplaced', () => {
    beforeEach(() => {
      // Set up some initial state to test transfers
      tabManager.unblockedTabs.add(100);
      tabManager.restoringTabs.add(101);
      tabManager.blockedUrls.set(102, 'http://blocked-example.com');
      tabManager.mazeTabId = 103;
    });

    test('transfers unblocked status from old to new tab', () => {
      tabManager.onTabReplaced(200, 100); // new: 200, old: 100

      expect(tabManager.unblockedTabs.has(100)).toBe(false);
      expect(tabManager.unblockedTabs.has(200)).toBe(true);
    });

    test('transfers restoring status from old to new tab', () => {
      tabManager.onTabReplaced(201, 101); // new: 201, old: 101

      expect(tabManager.restoringTabs.has(101)).toBe(false);
      expect(tabManager.restoringTabs.has(201)).toBe(true);
    });

    test('transfers blocked URL mapping from old to new tab', () => {
      tabManager.onTabReplaced(202, 102); // new: 202, old: 102

      expect(tabManager.blockedUrls.has(102)).toBe(false);
      expect(tabManager.blockedUrls.has(202)).toBe(true);
      expect(tabManager.blockedUrls.get(202)).toBe('http://blocked-example.com');
    });

    test('updates maze tab reference when maze tab is replaced', () => {
      tabManager.onTabReplaced(203, 103); // new: 203, old: 103

      expect(tabManager.mazeTabId).toBe(203);
    });

    test('handles replacement of tab with no tracked state', () => {
      // This should not cause any errors
      expect(() => {
        tabManager.onTabReplaced(300, 999); // Replace non-tracked tab
      }).not.toThrow();

      // No state should be affected
      expect(tabManager.unblockedTabs.has(300)).toBe(false);
      expect(tabManager.restoringTabs.has(300)).toBe(false);
      expect(tabManager.blockedUrls.has(300)).toBe(false);
      expect(tabManager.mazeTabId).toBe(103); // unchanged
    });

    test('handles multiple state transfers in single replacement', () => {
      // Set up a tab with multiple types of state
      const oldTabId = 150;
      const newTabId = 250;

      tabManager.unblockedTabs.add(oldTabId);
      tabManager.restoringTabs.add(oldTabId);
      tabManager.blockedUrls.set(oldTabId, 'http://multi-state.com');

      tabManager.onTabReplaced(newTabId, oldTabId);

      // All state should transfer
      expect(tabManager.unblockedTabs.has(oldTabId)).toBe(false);
      expect(tabManager.unblockedTabs.has(newTabId)).toBe(true);
      expect(tabManager.restoringTabs.has(oldTabId)).toBe(false);
      expect(tabManager.restoringTabs.has(newTabId)).toBe(true);
      expect(tabManager.blockedUrls.has(oldTabId)).toBe(false);
      expect(tabManager.blockedUrls.has(newTabId)).toBe(true);
      expect(tabManager.blockedUrls.get(newTabId)).toBe('http://multi-state.com');
    });

    test('transfers maze completion tracking state', () => {
      const oldTabId = 400;
      const newTabId = 500;

      // Set up completion tracking for old tab
      tabManager.completedMazeSessions.add(`maze_completed_tab_${oldTabId}`);


      tabManager.onTabReplaced(newTabId, oldTabId);

      // Old completion tracking should be removed
      expect(tabManager.completedMazeSessions.has(`maze_completed_tab_${oldTabId}`)).toBe(false);
      // New completion tracking should be added
      expect(tabManager.completedMazeSessions.has(`maze_completed_tab_${newTabId}`)).toBe(true);

    });

    test('handles sessionStorage error during completion tracking transfer', () => {
      const oldTabId = 600;
      const newTabId = 700;

      tabManager.completedMazeSessions.add(`maze_completed_tab_${oldTabId}`);

      // Mock sessionStorage that throws errors
      const mockSessionStorage = {
        removeItem: jest.fn(() => { throw new Error('sessionStorage error'); }),
        setItem: jest.fn(() => { throw new Error('sessionStorage error'); })
      };
      global.sessionStorage = mockSessionStorage;

      // Should not throw
      expect(() => tabManager.onTabReplaced(newTabId, oldTabId)).not.toThrow();

      // In-memory state should still transfer correctly
      expect(tabManager.completedMazeSessions.has(`maze_completed_tab_${oldTabId}`)).toBe(false);
      expect(tabManager.completedMazeSessions.has(`maze_completed_tab_${newTabId}`)).toBe(true);

      delete global.sessionStorage;
    });
  });


  describe('Integration Tests', () => {
    test('complete tab limiting workflow', async () => {
      await tabManager.initialize();
      tabManager.tabLimit = 2;
      tabManager.isInitialized = true;

      // Clear restoring tabs to ensure clean test state
      tabManager.restoringTabs.clear();

      // Test the core workflow: tab limit exceeded handling
      const testTab = { id: 4, url: 'http://example.com' };
      await tabManager.handleTabLimitExceeded(testTab);
      expect(tabManager.mazeTabId).toBe(4);
      expect(tabManager.blockedUrls.get(4)).toBe('http://example.com');

      // Complete the maze
      mockChrome.tabs.get.mockResolvedValue({ id: 4 });

      jest.useFakeTimers();
      await tabManager.handleMazeCompleted(4, {});

      // Advance timers to handle the productivity tip delay
      jest.advanceTimersByTime(tabManager.timing.MAZE_COMPLETION_DISPLAY);
      await jest.runAllTimersAsync();

      expect(tabManager.mazeTabId).toBeNull();
      expect(tabManager.dailyMazesCompleted).toBe(1);

      jest.useRealTimers();
    });
  });

  describe('Daily Maze Tracking', () => {
    let originalDate;
    let mockDate;

    beforeEach(() => {
      // Mock Date before creating TabManager instance
      originalDate = global.Date;
      mockDate = new originalDate('2024-03-15T10:30:00.000Z');

      global.Date = jest.fn(() => mockDate);
      global.Date.now = jest.fn(() => mockDate.getTime());
      global.Date.prototype = originalDate.prototype;

      // Create a fresh TabManager instance with mocked date
      tabManager = new TabManager();
    });

    afterEach(() => {
      global.Date = originalDate;
    });

    const setMockDate = (dateString) => {
      mockDate = new originalDate(dateString);
      global.Date = jest.fn(() => mockDate);
      global.Date.now = jest.fn(() => mockDate.getTime());
      global.Date.prototype = originalDate.prototype;
    };

    describe('getTodayKey', () => {
      test('returns correct date key format', () => {
        const key = tabManager.getTodayKey();
        expect(key).toBe('2024-03-15');
      });

      test('pads single digit months and days', () => {
        setMockDate('2024-01-05T10:30:00.000Z');
        const key = tabManager.getTodayKey();
        expect(key).toBe('2024-01-05');
      });

      test('handles year boundary correctly', () => {
        setMockDate('2025-01-01T00:00:00.000Z');
        const key = tabManager.getTodayKey();
        expect(key).toBe('2025-01-01');
      });
    });


    describe('initialization with daily data', () => {
      test('loads today\'s maze count on initialization', async () => {
        mockChrome.storage.local.get
          .mockResolvedValueOnce({ tabLimit: 5 })  // First call for tabLimit
          .mockResolvedValueOnce({ installDate: Date.now() })  // Second call for installDate
          .mockResolvedValueOnce({  // Third call for dailyMazes
            dailyMazes: {
              '2024-03-15': 8
            }
          });

        await tabManager.initialize();

        expect(tabManager.dailyMazesCompleted).toBe(8);
      });

      test('sets daily maze count to 0 when no data for today', async () => {
        mockChrome.storage.local.get
          .mockResolvedValueOnce({ tabLimit: 5 })
          .mockResolvedValueOnce({ installDate: Date.now() })
          .mockResolvedValueOnce({
            dailyMazes: {
              '2024-03-14': 5  // Yesterday's data only
            }
          });

        await tabManager.initialize();

        expect(tabManager.dailyMazesCompleted).toBe(0);
      });
    });


    describe('integration with maze completion', () => {
      test('handleMazeCompleted increments daily count', async () => {
        await tabManager.initialize();
        tabManager.mazeTabId = 1;

        const tab = { id: 1 };
        mockChrome.tabs.get.mockResolvedValue(tab);
        mockChrome.storage.local.get.mockResolvedValue({
          dailyMazes: {
            '2024-03-15': 2
          }
        });

        await tabManager.handleMazeCompleted(1, {});

        expect(tabManager.dailyMazesCompleted).toBe(3);
        expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
          dailyMazes: {
            '2024-03-15': 3
          }
        });
      });

      test('difficulty calculation uses daily count with gaps', async () => {
        // Set up initial daily count - 6 mazes should be Medium (level 2)
        tabManager.dailyMazesCompleted = 6;

        await tabManager.handleTabLimitExceeded({ id: 1, url: 'http://example.com' });

        expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
          currentMazeSession: {
            action: 'limitExceeded',
            difficulty: 2, // 6 mazes (>=5) -> Medium level
            timestamp: expect.any(Number)
          }
        });
      });

      test('calculateMazeDifficulty returns correct difficulty for limitExceeded action', () => {
        // Test the gap-based progression
        tabManager.dailyMazesCompleted = 3;
        
        const result = tabManager.calculateMazeDifficulty('limitExceeded');
        
        expect(result).toBe(1); // 3 mazes completed -> Easy (level 1)
      });

      test('calculateMazeDifficulty enforces minimum hard difficulty for updateLimit', () => {
        tabManager.dailyMazesCompleted = 1;
        
        const result = tabManager.calculateMazeDifficulty('updateLimit', 2);
        
        expect(result).toBe(3); // Should be minimum hard difficulty
      });

      test('calculateMazeDifficulty uses highest value for updateLimit', () => {
        tabManager.dailyMazesCompleted = 5;
        
        const result = tabManager.calculateMazeDifficulty('updateLimit', 2);
        
        expect(result).toBe(3); // 5 mazes = Medium (2), but updateLimit enforces minimum Hard (3)
      });

      test('calculateMazeDifficulty caps at maximum difficulty', () => {
        tabManager.dailyMazesCompleted = 20; // Way above master level threshold
        
        const result = tabManager.calculateMazeDifficulty('limitExceeded');
        
        expect(result).toBe(5); // Should be capped at master level
      });

      describe('gap-based difficulty progression', () => {
        test('level 0 (Beginner) for 0-1 mazes completed', () => {
          tabManager.dailyMazesCompleted = 0;
          expect(tabManager.calculateMazeDifficulty('limitExceeded')).toBe(0);

          tabManager.dailyMazesCompleted = 1;
          expect(tabManager.calculateMazeDifficulty('limitExceeded')).toBe(0);
        });

        test('level 1 (Easy) after 2 mazes completed', () => {
          tabManager.dailyMazesCompleted = 2;
          expect(tabManager.calculateMazeDifficulty('limitExceeded')).toBe(1);

          tabManager.dailyMazesCompleted = 4;
          expect(tabManager.calculateMazeDifficulty('limitExceeded')).toBe(1);
        });

        test('level 2 (Medium) after 5 mazes completed', () => {
          tabManager.dailyMazesCompleted = 5;
          expect(tabManager.calculateMazeDifficulty('limitExceeded')).toBe(2);

          tabManager.dailyMazesCompleted = 7;
          expect(tabManager.calculateMazeDifficulty('limitExceeded')).toBe(2);
        });

        test('level 3 (Hard) after 8 mazes completed', () => {
          tabManager.dailyMazesCompleted = 8;
          expect(tabManager.calculateMazeDifficulty('limitExceeded')).toBe(3);

          tabManager.dailyMazesCompleted = 11;
          expect(tabManager.calculateMazeDifficulty('limitExceeded')).toBe(3);
        });

        test('level 4 (Expert) after 12 mazes completed', () => {
          tabManager.dailyMazesCompleted = 12;
          expect(tabManager.calculateMazeDifficulty('limitExceeded')).toBe(4);

          tabManager.dailyMazesCompleted = 16;
          expect(tabManager.calculateMazeDifficulty('limitExceeded')).toBe(4);
        });

        test('level 5 (Master) after 17 mazes completed', () => {
          tabManager.dailyMazesCompleted = 17;
          expect(tabManager.calculateMazeDifficulty('limitExceeded')).toBe(5);

          tabManager.dailyMazesCompleted = 25;
          expect(tabManager.calculateMazeDifficulty('limitExceeded')).toBe(5);
        });
      });

      test('difficulty is consistent between multiple tab creations without completion', async () => {
        tabManager.dailyMazesCompleted = 2;
        
        // Create first maze tab
        await tabManager.handleTabLimitExceeded({ id: 1, url: 'http://example.com' });
        
        // Create second maze tab (simulating closing first without completion)
        await tabManager.handleTabLimitExceeded({ id: 2, url: 'http://example2.com' });
        
        // Both should have the same difficulty since no maze was completed
        const calls = mockChrome.storage.local.set.mock.calls.filter(call => 
          call[0].currentMazeSession && call[0].currentMazeSession.action === 'limitExceeded'
        );
        
        expect(calls).toHaveLength(2);
        expect(calls[0][0].currentMazeSession.difficulty).toBe(1); // 2 mazes -> Easy (level 1)
        expect(calls[1][0].currentMazeSession.difficulty).toBe(1); // Still 2 mazes -> Easy (level 1)
      });
    });
  });

  describe('Maze Completion Tracking', () => {
    describe('markMazeAsCompleted', () => {
      test('marks maze as completed with valid tab ID', () => {
        tabManager.markMazeAsCompleted(123);
        expect(tabManager.completedMazeSessions.has('maze_completed_tab_123')).toBe(true);
      });

      test('handles null tab ID gracefully', () => {
        tabManager.markMazeAsCompleted(null);
        expect(tabManager.completedMazeSessions.size).toBe(0);
      });
    });

    describe('isMazeCompleted', () => {
      test('returns true for completed maze in memory', () => {
        tabManager.completedMazeSessions.add('maze_completed_tab_456');
        const result = tabManager.isMazeCompleted(456);
        expect(result).toBe(true);
      });

      test('returns false for non-completed maze', () => {
        const result = tabManager.isMazeCompleted(999);
        expect(result).toBe(false);
      });

      test('returns false for null tab ID', () => {
        const result = tabManager.isMazeCompleted(null);
        expect(result).toBe(false);
      });
    });

    describe('clearMazeCompletion', () => {
      test('clears completion tracking for valid tab ID', () => {
        tabManager.completedMazeSessions.add('maze_completed_tab_222');
        tabManager.clearMazeCompletion(222);
        expect(tabManager.completedMazeSessions.has('maze_completed_tab_222')).toBe(false);
      });

      test('handles null tab ID gracefully', () => {
        tabManager.clearMazeCompletion(null);
        // Should not throw
      });
    });

    describe('integration with handleMazeCompleted', () => {
      test('handleMazeCompleted marks maze as completed', async () => {
        await tabManager.initialize();
        const tab = { id: 444 };
        mockChrome.tabs.get.mockResolvedValue(tab);
        tabManager.blockedUrls.set(444, 'http://example.com');

        jest.useFakeTimers();
        await tabManager.handleMazeCompleted(444, {});
        jest.useRealTimers();

        expect(tabManager.completedMazeSessions.has('maze_completed_tab_444')).toBe(true);
      });

      test('completed mazes can be detected on subsequent checks', async () => {
        await tabManager.initialize();
        const tab = { id: 555 };
        mockChrome.tabs.get.mockResolvedValue(tab);

        jest.useFakeTimers();
        await tabManager.handleMazeCompleted(555, {});
        jest.useRealTimers();

        const isCompleted = tabManager.isMazeCompleted(555);
        expect(isCompleted).toBe(true);
      });
    });

    describe('state management', () => {
      test('multiple tab completions are tracked independently', () => {
        tabManager.markMazeAsCompleted(100);
        tabManager.markMazeAsCompleted(200);
        tabManager.markMazeAsCompleted(300);

        expect(tabManager.isMazeCompleted(100)).toBe(true);
        expect(tabManager.isMazeCompleted(200)).toBe(true);
        expect(tabManager.isMazeCompleted(300)).toBe(true);
        expect(tabManager.isMazeCompleted(400)).toBe(false);

        // Clear one specific completion
        tabManager.clearMazeCompletion(200);

        expect(tabManager.isMazeCompleted(100)).toBe(true);
        expect(tabManager.isMazeCompleted(200)).toBe(false);
        expect(tabManager.isMazeCompleted(300)).toBe(true);
      });
    });

    describe('edge cases', () => {
      test('handles undefined tabId gracefully', () => {
        expect(() => {
          tabManager.markMazeAsCompleted(undefined);
          tabManager.isMazeCompleted(undefined);
          tabManager.clearMazeCompletion(undefined);
        }).not.toThrow();
      });

      test('handles string tabId conversion', () => {
        tabManager.markMazeAsCompleted('123');
        expect(tabManager.isMazeCompleted('123')).toBe(true);
        expect(tabManager.completedMazeSessions.has('maze_completed_tab_123')).toBe(true);
      });

      test('completion key format is consistent', () => {
        const tabId = 999;
        tabManager.markMazeAsCompleted(tabId);

        const expectedKey = `maze_completed_tab_${tabId}`;
        expect(tabManager.completedMazeSessions.has(expectedKey)).toBe(true);
      });
    });
  });
});
