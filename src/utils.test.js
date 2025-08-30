/**
 * Unit tests for utility functions
 * Run with: npm test
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Import after mocking
import { isSpecialTab, isMazeTab, isPopupWindow } from './utils.js';

// Mock Chrome APIs
const mockChrome = {
  windows: {
    get: jest.fn()
  },
  runtime: {
    getURL: jest.fn()
  }
};

// Set up global chrome mock
global.chrome = mockChrome;

describe('Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isSpecialTab', () => {
    test('returns true for tabs without URL', () => {
      const tab = { id: 1 };
      expect(isSpecialTab(tab)).toBe(true);
    });

    test('returns true for chrome: URLs', () => {
      const tab = { id: 1, url: 'chrome://settings/' };
      expect(isSpecialTab(tab)).toBe(true);
    });

    test('returns true for extension URLs', () => {
      const tab = { id: 1, url: 'chrome-extension://abc123/page.html' };
      expect(isSpecialTab(tab)).toBe(true);
    });

    test('returns false for regular websites', () => {
      const tab = { id: 1, url: 'https://example.com' };
      expect(isSpecialTab(tab)).toBe(false);
    });
  });

  describe('isMazeTab', () => {
    beforeEach(() => {
      mockChrome.runtime.getURL.mockReturnValue('chrome-extension://abc123/');
    });

    test('returns false for tabs without URL', () => {
      const tab = { id: 1 };
      expect(isMazeTab(tab)).toBe(false);
    });

    test('returns true for maze.html from this extension', () => {
      const tab = { id: 1, url: 'chrome-extension://abc123/src/maze.html' };
      expect(isMazeTab(tab)).toBe(true);
    });

    test('returns false for other extension pages', () => {
      const tab = { id: 1, url: 'chrome-extension://abc123/src/options.html' };
      expect(isMazeTab(tab)).toBe(false);
    });

    test('returns false for regular websites', () => {
      const tab = { id: 1, url: 'https://example.com' };
      expect(isMazeTab(tab)).toBe(false);
    });
  });

  describe('isPopupWindow', () => {
    test('returns false for tabs without windowId', async () => {
      const tab = { id: 1, url: 'https://example.com' };
      const result = await isPopupWindow(tab);
      expect(result).toBe(false);
    });

    test('returns true for popup window type', async () => {
      mockChrome.windows.get.mockResolvedValue({ type: 'popup' });

      const tab = { id: 1, url: 'https://accounts.google.com/oauth', windowId: 123 };
      const result = await isPopupWindow(tab);

      expect(result).toBe(true);
      expect(mockChrome.windows.get).toHaveBeenCalledWith(123);
    });

    test('returns false for normal window type', async () => {
      mockChrome.windows.get.mockResolvedValue({ type: 'normal' });

      const tab = { id: 1, url: 'https://example.com', windowId: 123 };
      const result = await isPopupWindow(tab);

      expect(result).toBe(false);
      expect(mockChrome.windows.get).toHaveBeenCalledWith(123);
    });

    test('returns false when window info cannot be retrieved', async () => {
      mockChrome.windows.get.mockRejectedValue(new Error('Window not found'));

      const tab = { id: 1, url: 'https://example.com', windowId: 123 };
      const result = await isPopupWindow(tab);

      expect(result).toBe(false);
    });
  });
});