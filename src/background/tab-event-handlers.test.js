/**
 * Tests for tab event handlers module
 */

import * as tabEventHandlers from './tab-event-handlers.js';
import { clearMazeSession } from '../maze/maze-session.js';

// Mock dependencies
jest.mock('../maze/maze-session.js');
jest.mock('../utils.js', () => ({
  isSpecialTab: jest.fn(),
  isMazeTab: jest.fn()
}));

import { isSpecialTab, isMazeTab } from '../utils.js';

// Mock Chrome APIs
global.chrome = {
  tabs: {
    update: jest.fn(),
    remove: jest.fn(),
    sendMessage: jest.fn()
  },
  runtime: {
    getURL: jest.fn()
  }
};

describe('Tab Event Handlers', () => {
  let mockTabManager;

  beforeEach(() => {
    mockTabManager = {
      shouldAllowNewTab: jest.fn(),
      handleTabLimitExceeded: jest.fn(),
      restoreMazeTab: jest.fn(),
      onTabLoadComplete: jest.fn(),
      onTabRemoved: jest.fn(),
      onTabReplaced: jest.fn(),
      checkForConsciousClosure: jest.fn(),
      mazeTabId: null
    };

    jest.clearAllMocks();
    chrome.runtime.getURL.mockReturnValue('chrome-extension://test/src/blob.html');
  });

  describe('handleTabCreated', () => {
    it('should allow tab when under limit', async () => {
      const mockTab = { id: 123, url: 'https://example.com' };
      mockTabManager.shouldAllowNewTab.mockResolvedValue({ action: 'allow' });

      const result = await tabEventHandlers.handleTabCreated(mockTabManager, mockTab);

      expect(result).toEqual({ action: 'allow' });
      expect(mockTabManager.shouldAllowNewTab).toHaveBeenCalledWith(mockTab);
    });

    it('should redirect to maze when limit exceeded', async () => {
      const mockTab = { id: 123, url: 'https://example.com' };
      mockTabManager.shouldAllowNewTab.mockResolvedValue({ action: 'redirect-to-maze' });

      const result = await tabEventHandlers.handleTabCreated(mockTabManager, mockTab);

      expect(result).toEqual({ action: 'redirect-to-maze' });
      expect(mockTabManager.handleTabLimitExceeded).toHaveBeenCalledWith(mockTab);
    });

    it('should show blob when maze already exists', async () => {
      const mockTab = { id: 123, url: 'https://example.com' };
      mockTabManager.shouldAllowNewTab.mockResolvedValue({ action: 'show-notification' });
      chrome.tabs.update.mockResolvedValue();

      const result = await tabEventHandlers.handleTabCreated(mockTabManager, mockTab);

      expect(result).toEqual({ action: 'show-notification' });
      expect(chrome.tabs.update).toHaveBeenCalledWith(123, { url: 'chrome-extension://test/src/blob.html' });
    });
  });

  describe('handleTabUpdated', () => {
    it('should handle tab loading completion', async () => {
      const changeInfo = { status: 'complete' };
      const tab = { id: 123, url: 'https://example.com' };

      await tabEventHandlers.handleTabUpdated(mockTabManager, 123, changeInfo, tab);

      expect(mockTabManager.onTabLoadComplete).toHaveBeenCalledWith(123);
    });

    it('should restore maze tab when it tries to navigate away', async () => {
      isSpecialTab.mockReturnValue(false);
      isMazeTab.mockReturnValue(false);
      mockTabManager.mazeTabId = 123;

      const changeInfo = { url: 'https://example.com' };
      const tab = { id: 123, url: 'https://example.com' };

      const result = await tabEventHandlers.handleTabUpdated(mockTabManager, 123, changeInfo, tab);

      expect(result).toEqual({ action: 'restored-maze' });
      expect(mockTabManager.restoreMazeTab).toHaveBeenCalledWith(123, 'https://example.com');
    });
  });

  describe('handleTabRemoved', () => {
    it('should clear maze session when maze tab is closed', async () => {
      mockTabManager.mazeTabId = 123;
      mockTabManager.checkForConsciousClosure.mockResolvedValue(null);
      clearMazeSession.mockResolvedValue();

      const result = await tabEventHandlers.handleTabRemoved(mockTabManager, 123);

      expect(clearMazeSession).toHaveBeenCalled();
      expect(mockTabManager.onTabRemoved).toHaveBeenCalledWith(123);
      expect(result.consciousClosureDetected).toBe(false);
    });

    it('should handle conscious closure detection', async () => {
      mockTabManager.mazeTabId = 456;
      const consciousClosureData = { mazeTabId: 456, currentCount: 3, limit: 5 };
      mockTabManager.checkForConsciousClosure.mockResolvedValue(consciousClosureData);
      chrome.tabs.sendMessage.mockResolvedValue();

      const result = await tabEventHandlers.handleTabRemoved(mockTabManager, 123);

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(456, {
        type: 'CONSCIOUS_CLOSURE_DETECTED',
        data: { currentCount: 3, limit: 5 }
      });
      expect(result.consciousClosureDetected).toBe(true);
    });
  });

  describe('handleTabReplaced', () => {
    it('should handle tab replacement', () => {
      const result = tabEventHandlers.handleTabReplaced(mockTabManager, 123, 456);

      expect(result).toEqual({ success: true });
      expect(mockTabManager.onTabReplaced).toHaveBeenCalledWith(123, 456);
    });
  });
});