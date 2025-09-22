/**
 * Integration tests for background script message handling
 * Tests the complete message flow that the popup depends on
 */

import { dispatchMessage } from './message-dispatcher.js';
import { TabManager } from '../tab-manager.js';

// Mock Chrome APIs completely
global.chrome = {
  runtime: {
    onMessage: { addListener: jest.fn() },
    onStartup: { addListener: jest.fn() },
    onInstalled: { addListener: jest.fn() },
    sendMessage: jest.fn(),
    getURL: jest.fn()
  },
  tabs: {
    query: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    sendMessage: jest.fn(),
    onCreated: { addListener: jest.fn() },
    onUpdated: { addListener: jest.fn() },
    onRemoved: { addListener: jest.fn() },
    onReplaced: { addListener: jest.fn() }
  },
  webNavigation: {
    onTabReplaced: { addListener: jest.fn() }
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

describe('Background Message Integration', () => {
  let tabManager;

  beforeEach(() => {
    tabManager = new TabManager();
    jest.clearAllMocks();
  });

  describe('Message Dispatcher Integration', () => {
    it('should handle async messages and return correct channel management flags', async () => {
      const mockSendResponse = jest.fn();

      // Test GET_STATS (should keep channel open)
      const statsResult = await dispatchMessage(
        tabManager,
        { type: 'GET_STATS' },
        { tab: { id: 123 } },
        mockSendResponse
      );

      expect(typeof statsResult).toBe('boolean');
      expect(statsResult).toBe(true); // Critical: must return true for async messages
      expect(mockSendResponse).toHaveBeenCalled();
    });

    it('should provide response format that popup.js expects', async () => {
      // Mock storage to return test data
      chrome.storage.local.get.mockImplementation((keys) => {
        const mockData = {
          tabLimit: 5,
          dailyMazes: { '2024-01-01': 3 },
          blockedAttempts: { '2024-01-01': 7 }
        };

        if (Array.isArray(keys)) {
          const result = {};
          keys.forEach(key => {
            result[key] = mockData[key];
          });
          return Promise.resolve(result);
        }
        return Promise.resolve(mockData);
      });

      const mockSendResponse = jest.fn();

      await dispatchMessage(
        tabManager,
        { type: 'GET_STATS' },
        { tab: { id: 123 } },
        mockSendResponse
      );

      // Verify popup.js contract expectations - check the full stats object structure
      const response = mockSendResponse.mock.calls[0][0];
      expect(response).toEqual(expect.objectContaining({
        tabLimit: 5,
        mazesCompleted: expect.any(Number), // This gets calculated from dailyMazes
        dailyMazesCompleted: expect.any(Number)
      }));

      // The stats object contains both raw data and computed values
      expect(response.dailyMazes).toBeDefined();
      expect(response.blockedAttempts).toBeDefined();

      // Verify no error field (popup checks for this)
      expect(response.error).toBeUndefined();
    });

    it('should handle message errors gracefully', async () => {
      const mockSendResponse = jest.fn();

      // Force an error by making storage fail
      chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

      const result = await dispatchMessage(
        tabManager,
        { type: 'GET_STATS' },
        { tab: { id: 123 } },
        mockSendResponse
      );

      // GET_STATS still keeps channel open even for errors to send error response
      expect(result).toBe(true); // GET_STATS always keeps channel open
      expect(mockSendResponse).toHaveBeenCalledWith({ error: expect.any(String) });
    });
  });

});
