/**
 * Unit tests for TabManager maze creation functionality
 * Separate file to avoid interference with existing tests
 */

import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { TabManager } from './tab-manager.js';
import { TAB_LIMITS, DIFFICULTY_LEVELS } from './constants.js';
import { saveMazeSession, getMazeSessionData } from './maze/maze-session.js';

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

// Mock usage data store
const mockUsageDataStore = {
  getTabLimit: jest.fn(),
  setTabLimit: jest.fn(),
  initializeInstallDate: jest.fn(),
  getTodayMazeCount: jest.fn(),
  recordTodayTabLimit: jest.fn(),
  getExtendedStatistics: jest.fn()
};

// Mock maze session module
jest.mock('./maze/maze-session.js', () => ({
  saveMazeSession: jest.fn(),
  getMazeSessionData: jest.fn()
}));

jest.mock('./usage-data-store.js', () => ({
  usageDataStore: jest.fn(() => mockUsageDataStore)
}));

// Mock utility functions
jest.mock('./utils.js', () => ({
  isSpecialTab: jest.fn().mockReturnValue(false),
  isMazeTab: jest.fn().mockReturnValue(false),
  isPopupWindow: jest.fn().mockResolvedValue(false)
}));

// Set up global chrome mock
global.chrome = mockChrome;

describe('TabManager - Maze Creation', () => {
  let tabManager;

  beforeEach(() => {
    // Create TabManager with fast timing for tests
    tabManager = new TabManager({
      timing: {
        MAZE_COMPLETION_DISPLAY: 100,
        EMPTY_TAB_CLEANUP_DELAY: 50
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
    mockChrome.tabs.create.mockResolvedValue({ id: 123 });
    mockChrome.windows.update.mockResolvedValue();
    mockChrome.runtime.getURL.mockImplementation(path => `chrome-extension://test/${path}`);

    // Reset usage data store mocks
    mockUsageDataStore.getTabLimit.mockResolvedValue(TAB_LIMITS.DEFAULT);
    mockUsageDataStore.setTabLimit.mockResolvedValue();
    mockUsageDataStore.initializeInstallDate.mockResolvedValue();
    mockUsageDataStore.getTodayMazeCount.mockResolvedValue(0);
    mockUsageDataStore.recordTodayTabLimit.mockResolvedValue();
    mockUsageDataStore.getExtendedStatistics.mockResolvedValue({});

    // Reset maze session mocks
    saveMazeSession.mockResolvedValue();
    getMazeSessionData.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createMazeTabOrBlob', () => {
    beforeEach(() => {
      // Reset maze tab ID for each test
      tabManager.mazeTabId = null;
    });

    test('creates maze tab when no maze exists', async () => {
      const mockMazeUrl = 'chrome-extension://test/maze.html';
      const mockNewTab = { id: 123 };

      mockChrome.runtime.getURL.mockReturnValue(mockMazeUrl);
      mockChrome.tabs.create.mockResolvedValue(mockNewTab);

      const result = await tabManager.createMazeTabOrBlob({ action: 'limitExceeded' });

      expect(result).toEqual({ created: 'maze', tabId: 123 });
      expect(mockChrome.runtime.getURL).toHaveBeenCalledWith('src/maze.html');
      expect(mockChrome.tabs.create).toHaveBeenCalledWith({ url: mockMazeUrl });
      expect(tabManager.mazeTabId).toBe(123);
    });

    test('creates blob page when maze already exists', async () => {
      tabManager.mazeTabId = 456; // Existing maze
      const mockBlobUrl = 'chrome-extension://test/blob.html';

      mockChrome.runtime.getURL.mockReturnValue(mockBlobUrl);
      mockChrome.tabs.create.mockResolvedValue({ id: 789 });

      const result = await tabManager.createMazeTabOrBlob({ action: 'limitExceeded' });

      expect(result).toEqual({ created: 'blob' });
      expect(mockChrome.runtime.getURL).toHaveBeenCalledWith('src/blob.html');
      expect(mockChrome.tabs.create).toHaveBeenCalledWith({ url: mockBlobUrl });
      expect(tabManager.mazeTabId).toBe(456); // Should remain unchanged
    });

    test('stores maze session for updateLimit action', async () => {
      const mockMazeUrl = 'chrome-extension://test/maze.html';
      const mockNewTab = { id: 123 };

      mockChrome.runtime.getURL.mockReturnValue(mockMazeUrl);
      mockChrome.tabs.create.mockResolvedValue(mockNewTab);

      // Set up daily mazes completed
      tabManager.dailyMazesCompleted = 2;

      const result = await tabManager.createMazeTabOrBlob({
        action: 'updateLimit',
        difficulty: DIFFICULTY_LEVELS.EASY
      });

      expect(result).toEqual({ created: 'maze', tabId: 123 });

      // Verify maze session was stored (difficulty should be max of current, min hard, and provided)
      // Expected: max(2, 3, 1) = 3
      expect(saveMazeSession).toHaveBeenCalledWith({
        action: 'updateLimit',
        difficulty: DIFFICULTY_LEVELS.HARD,
        timestamp: expect.any(Number)
      });
    });

    test('uses minimum hard difficulty for updateLimit', async () => {
      const mockMazeUrl = 'chrome-extension://test/maze.html';
      const mockNewTab = { id: 123 };

      mockChrome.runtime.getURL.mockReturnValue(mockMazeUrl);
      mockChrome.tabs.create.mockResolvedValue(mockNewTab);

      // Set up daily mazes completed to 0 (below hard level)
      tabManager.dailyMazesCompleted = 0;

      await tabManager.createMazeTabOrBlob({
        action: 'updateLimit'
      });

      // Should use minimum hard difficulty (3)
      expect(saveMazeSession).toHaveBeenCalledWith({
        action: 'updateLimit',
        difficulty: DIFFICULTY_LEVELS.HARD,
        timestamp: expect.any(Number)
      });
    });

    test('uses current difficulty when higher than minimum hard level', async () => {
      const mockMazeUrl = 'chrome-extension://test/maze.html';
      const mockNewTab = { id: 123 };

      mockChrome.runtime.getURL.mockReturnValue(mockMazeUrl);
      mockChrome.tabs.create.mockResolvedValue(mockNewTab);

      // Set up daily mazes completed to high value that exceeds hard level
      tabManager.dailyMazesCompleted = 15; // This would be Expert level (4), but updateLimit enforces minimum Hard (3)

      await tabManager.createMazeTabOrBlob({
        action: 'updateLimit'
      });

      // Should use Expert difficulty (4) since it's higher than minimum Hard (3)
      expect(saveMazeSession).toHaveBeenCalledWith({
        action: 'updateLimit',
        difficulty: DIFFICULTY_LEVELS.EXPERT, // 15 mazes -> Expert
        timestamp: expect.any(Number)
      });
    });


    test('does not store maze session for limitExceeded action', async () => {
      const mockMazeUrl = 'chrome-extension://test/maze.html';
      const mockNewTab = { id: 123 };

      mockChrome.runtime.getURL.mockReturnValue(mockMazeUrl);
      mockChrome.tabs.create.mockResolvedValue(mockNewTab);

      await tabManager.createMazeTabOrBlob({ action: 'limitExceeded' });

      // Should not call setMazeSession for regular limit exceeded
      expect(saveMazeSession).not.toHaveBeenCalled();
    });

    test('handles tab creation errors gracefully', async () => {
      const mockMazeUrl = 'chrome-extension://test/maze.html';

      mockChrome.runtime.getURL.mockReturnValue(mockMazeUrl);
      mockChrome.tabs.create.mockRejectedValue(new Error('Tab creation failed'));

      await expect(tabManager.createMazeTabOrBlob({ action: 'limitExceeded' }))
        .rejects.toThrow('Tab creation failed');

      expect(tabManager.mazeTabId).toBeNull(); // Should not set maze tab ID on failure
    });

    test('handles default options correctly', async () => {
      const mockMazeUrl = 'chrome-extension://test/maze.html';
      const mockNewTab = { id: 123 };

      mockChrome.runtime.getURL.mockReturnValue(mockMazeUrl);
      mockChrome.tabs.create.mockResolvedValue(mockNewTab);

      // Call without any options
      const result = await tabManager.createMazeTabOrBlob();

      expect(result).toEqual({ created: 'maze', tabId: 123 });
      expect(saveMazeSession).not.toHaveBeenCalled();
    });
  });
});
