/**
 * Unit tests for TabManager using Jest
 * Run with: npm test
 */

import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { TabManager } from './tab-manager.js';
import { TAB_LIMITS } from './constants.js';

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
    remove: jest.fn()
  },
  windows: {
    update: jest.fn()
  },
  runtime: {
    getURL: jest.fn()
  }
};

// Mock utility functions before any imports
const mockUtils = {
  isSpecialTab: jest.fn().mockReturnValue(false),
  isMazeTab: jest.fn().mockReturnValue(false)
};

jest.mock('./utils.js', () => mockUtils);

// Set up global chrome mock
global.chrome = mockChrome;

// Import mocked functions and TabManager after mocking
import { isSpecialTab, isMazeTab } from './utils.js';

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
      expect(tabManager.mazesCompleted).toBe(0);
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

      expect(mockChrome.storage.local.get).toHaveBeenCalledWith(['tabLimit']);
      expect(tabManager.tabLimit).toBe(5);
      expect(tabManager.isInitialized).toBe(true);
    });

    test('sets default tab limit when none in storage', async () => {
      mockChrome.storage.local.get.mockResolvedValue({});

      await tabManager.initialize();

      expect(tabManager.tabLimit).toBe(TAB_LIMITS.DEFAULT);
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ tabLimit: TAB_LIMITS.DEFAULT });
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

    test('allows tab when under limit', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const result = await tabManager.shouldAllowNewTab({ id: 3 });

      expect(result).toEqual({ action: 'allow' });
    });

    test('redirects to maze when over limit and no maze exists', async () => {
      // Mock getCurrentTabCount directly to return count over limit
      tabManager.tabLimit = 2;
      tabManager.restoringTabs.clear(); // Ensure clean state
      jest.spyOn(tabManager, 'getCurrentTabCount').mockResolvedValue(3);

      const result = await tabManager.shouldAllowNewTab({ id: 4 });

      expect(result).toEqual({ action: 'redirect-to-maze' });
    });

    test('shows notification when over limit and maze exists', async () => {
      // Mock getCurrentTabCount directly to return count over limit
      tabManager.tabLimit = 2;
      tabManager.restoringTabs.clear(); // Ensure clean state
      jest.spyOn(tabManager, 'getCurrentTabCount').mockResolvedValue(3);
      tabManager.mazeTabId = 2;

      const result = await tabManager.shouldAllowNewTab({ id: 4 });

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
          tabId: 1,
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
      expect(tabManager.mazesCompleted).toBe(1);
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        mazesCompleted: 1
      });
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
      expect(tabManager.mazesCompleted).toBe(1);
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

      tabManager.cleanupTabReferences(1);

      expect(tabManager.restoringTabs.has(1)).toBe(false);
      expect(tabManager.mazeTabId).toBeNull();
      expect(tabManager.blockedUrls.has(1)).toBe(false);
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
      // Mock all tabs as regular tabs (not special or maze tabs)
      mockUtils.isSpecialTab.mockReturnValue(false);
      mockUtils.isMazeTab.mockReturnValue(false);

      await tabManager.smartTabClosure(2);

      expect(mockChrome.tabs.remove).toHaveBeenCalledTimes(2);
      expect(mockChrome.tabs.remove).toHaveBeenCalledWith(1); // oldest
      expect(mockChrome.tabs.remove).toHaveBeenCalledWith(3); // second oldest
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
      const mockStats = {
        mazesCompleted: 5,
        blockedAttempts: 10,
        installDate: 1234567890
      };
      mockChrome.storage.local.get.mockResolvedValue(mockStats);
      tabManager.tabLimit = 4;
      tabManager.mazesCompleted = 2;

      const stats = await tabManager.getStats();

      expect(stats).toEqual({
        mazesCompleted: 5,
        blockedAttempts: 10,
        tabLimit: 4,
        sessionMazesCompleted: 2,
        installDate: 1234567890
      });
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
      
      // Clear previous mock implementations and set specifically for this test
      mockUtils.isMazeTab.mockClear();
      mockUtils.isMazeTab.mockReturnValue(true);

      const result = await tabManager.focusMazeTab();

      expect(result).toBe(true);
      expect(mockChrome.tabs.update).toHaveBeenCalledWith(1, { active: true });
      expect(mockChrome.windows.update).toHaveBeenCalledWith(123, { focused: true });
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

  describe('logLimitHitTimestamp', () => {
    test('logs timestamp and increments blocked attempts', async () => {
      const mockTimestamp = 1234567890;
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);
      jest.spyOn(tabManager, 'incrementStat').mockResolvedValue();

      await tabManager.logLimitHitTimestamp();

      expect(tabManager.incrementStat).toHaveBeenCalledWith('blockedAttempts');
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ lastLimitHit: mockTimestamp });
    });

    test('handles errors gracefully', async () => {
      mockChrome.storage.local.set.mockRejectedValue(new Error('Storage error'));

      await expect(tabManager.logLimitHitTimestamp()).resolves.not.toThrow();
    });
  });

  describe('incrementStat', () => {
    test('increments existing stat', async () => {
      mockChrome.storage.local.get.mockResolvedValue({ testStat: 5 });

      await tabManager.incrementStat('testStat');

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ testStat: 6 });
    });

    test('creates new stat from zero', async () => {
      mockChrome.storage.local.get.mockResolvedValue({});

      await tabManager.incrementStat('newStat');

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ newStat: 1 });
    });

    test('handles storage errors', async () => {
      mockChrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

      await expect(tabManager.incrementStat('testStat')).resolves.not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    test('complete tab limiting workflow', async () => {
      await tabManager.initialize();
      tabManager.tabLimit = 2;
      
      // Clear restoring tabs to ensure clean test state
      tabManager.restoringTabs.clear();

      // Mock getCurrentTabCount for each step
      let getCurrentTabCountSpy = jest.spyOn(tabManager, 'getCurrentTabCount');

      // First tab - allowed (count = 1)
      getCurrentTabCountSpy.mockResolvedValueOnce(1);
      let result = await tabManager.shouldAllowNewTab({ id: 2 });
      expect(result.action).toBe('allow');

      // Second tab - allowed (count = 2)
      getCurrentTabCountSpy.mockResolvedValueOnce(2);
      result = await tabManager.shouldAllowNewTab({ id: 3 });
      expect(result.action).toBe('allow');

      // Third tab - over limit, redirect to maze (count = 3)
      getCurrentTabCountSpy.mockResolvedValueOnce(3);
      result = await tabManager.shouldAllowNewTab({ id: 4 });
      expect(result.action).toBe('redirect-to-maze');

      // Handle the tab limit exceeded
      await tabManager.handleTabLimitExceeded({ id: 4, url: 'http://example.com' });
      expect(tabManager.mazeTabId).toBe(4);

      // Fourth tab - maze exists, show notification (count = 4)
      getCurrentTabCountSpy.mockResolvedValueOnce(4);
      result = await tabManager.shouldAllowNewTab({ id: 5 });
      expect(result.action).toBe('show-notification');

      // Complete the maze
      mockChrome.tabs.get.mockResolvedValue({ id: 4 });
      
      jest.useFakeTimers();
      await tabManager.handleMazeCompleted(4, {});
      
      // Advance timers to handle the productivity tip delay
      jest.advanceTimersByTime(tabManager.timing.MAZE_COMPLETION_DISPLAY);
      await jest.runAllTimersAsync();
      
      expect(tabManager.mazeTabId).toBeNull();
      expect(tabManager.mazesCompleted).toBe(1);
      
      jest.useRealTimers();
      
      getCurrentTabCountSpy.mockRestore();
    });
  });
});