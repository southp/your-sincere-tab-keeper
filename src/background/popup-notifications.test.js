/**
 * Tests for popup notifications module
 */

import * as popupNotifications from './popup-notifications.js';
import { getMazeSessionData } from '../maze/maze-session.js';

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
    query: jest.fn()
  },
  runtime: {
    sendMessage: jest.fn()
  }
};

describe('Popup Notifications', () => {
  let mockTabManager;

  beforeEach(() => {
    mockTabManager = {
      getStats: jest.fn()
    };

    jest.clearAllMocks();
  });

  describe('notifyPopupUpdate', () => {
    it('should notify popup with current data', async () => {
      const mockTabs = [
        { id: 1, url: 'https://example.com' },
        { id: 2, url: 'chrome-extension://test/options.html' },
        { id: 3, url: 'https://another.com' }
      ];
      const mockSession = { id: 'test-session' };
      const mockStats = { tabLimit: 5 };

      chrome.tabs.query.mockResolvedValue(mockTabs);
      getMazeSessionData.mockResolvedValue(mockSession);
      mockTabManager.getStats.mockResolvedValue(mockStats);
      isSpecialTab.mockImplementation(tab => tab.url.includes('chrome-extension'));
      isMazeTab.mockReturnValue(false);
      chrome.runtime.sendMessage.mockResolvedValue();

      const result = await popupNotifications.notifyPopupUpdate(mockTabManager);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        tabCount: 2, // Only non-special tabs
        currentLimit: 5,
        hasSession: true
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'POPUP_UPDATE_TAB_COUNT',
        data: { tabCount: 2, currentLimit: 5 }
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'POPUP_UPDATE_MAZE_STATUS',
        data: { hasSession: true }
      });
    });

    it('should handle errors gracefully', async () => {
      chrome.tabs.query.mockRejectedValue(new Error('Query failed'));

      const result = await popupNotifications.notifyPopupUpdate(mockTabManager);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Query failed');
    });
  });

  describe('sendTabCountUpdate', () => {
    it('should send tab count update successfully', async () => {
      chrome.runtime.sendMessage.mockResolvedValue();

      const result = await popupNotifications.sendTabCountUpdate(3, 5);

      expect(result.success).toBe(true);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'POPUP_UPDATE_TAB_COUNT',
        data: { tabCount: 3, currentLimit: 5 }
      });
    });

    it('should handle popup not open', async () => {
      chrome.runtime.sendMessage.mockRejectedValue(new Error('No popup'));

      const result = await popupNotifications.sendTabCountUpdate(3, 5);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('popup-not-open');
    });
  });

  describe('sendMazeStatusUpdate', () => {
    it('should send maze status update successfully', async () => {
      chrome.runtime.sendMessage.mockResolvedValue();

      const result = await popupNotifications.sendMazeStatusUpdate(true);

      expect(result.success).toBe(true);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'POPUP_UPDATE_MAZE_STATUS',
        data: { hasSession: true }
      });
    });

    it('should handle popup not open', async () => {
      chrome.runtime.sendMessage.mockRejectedValue(new Error('No popup'));

      const result = await popupNotifications.sendMazeStatusUpdate(false);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('popup-not-open');
    });
  });
});