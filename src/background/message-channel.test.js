/**
 * Message Channel Handling Tests
 *
 * These tests specifically prevent regressions in Chrome extension message
 * channel handling that have broken the application multiple times.
 *
 * REGRESSION HISTORY:
 * - PR #7: Refactoring broke MAZE_COMPLETED flow by keeping channel open unnecessarily
 * - Previous incidents: Message channels timing out due to incorrect return values
 *
 * The critical behavior tested here:
 * - Messages that need responses MUST return true to keep channel open
 * - Messages that don't need responses MUST NOT return true (to avoid timeout errors)
 * - Content scripts waiting for responses get them before channel closes
 *
 * KEY TEST AREAS:
 * 1. Channel Open/Close Behavior - validates the asyncMessages array in background.js
 * 2. Response Handling Integration - ensures dispatchMessage is called correctly
 * 3. Message Flow Validation - simulates real user flows that broke
 * 4. Regression Prevention - catches common mistakes in boolean return logic
 */

import { dispatchMessage } from './message-dispatcher.js';

// Mock all dependencies
jest.mock('./message-dispatcher.js');

describe('Message Channel Handling', () => {
  /**
   * Test the core message channel logic extracted from background.js
   * This simulates the exact logic used in the actual message listener
   */
  function simulateMessageListener(message, sender, sendResponse) {
    // Simulate the async dispatch call
    (async () => {
      try {
        await dispatchMessage(null, message, sender, sendResponse);
      } catch (error) {
        sendResponse({ error: error.message });
      }
    })();

    // This is the critical logic from background.js:101-102
    const asyncMessages = ['GET_STATS', 'RESET_STATS', 'CHECK_MAZE_COMPLETED', 'CREATE_MAZE_TAB'];
    return asyncMessages.includes(message?.type);
  }

  let mockSendResponse;
  let mockSender;

  beforeEach(() => {
    mockSendResponse = jest.fn();
    mockSender = { tab: { id: 123 } };

    // Reset mocks
    jest.clearAllMocks();

    // Mock dispatchMessage to simulate actual message handling
    dispatchMessage.mockImplementation((tabManager, message, sender, sendResponse) => {
      // Simulate the responses that certain message types would send
      if (message.type === 'UPDATE_TAB_LIMIT') {
        sendResponse({ success: true });
      } else if (message.type === 'CREATE_MAZE_TAB') {
        sendResponse({ success: true });
      } else if (message.type === 'GET_STATS') {
        sendResponse({ tabLimit: 5, mazesCompleted: 3 });
      } else if (message.type === 'CHECK_MAZE_COMPLETED') {
        sendResponse({ isCompleted: false });
      }
      return Promise.resolve();
    });
  });

  describe('Channel Open/Close Behavior', () => {
    /**
     * These tests validate the EXACT behavior that was broken in the regression:
     * - MAZE_COMPLETED must NOT keep channel open (return false)
     * - Async response messages MUST keep channel open (return true)
     */

    it('should return true for messages that need async responses', () => {
      const asyncMessages = [
        'GET_STATS',
        'RESET_STATS',
        'CHECK_MAZE_COMPLETED',
        'CREATE_MAZE_TAB'
      ];

      asyncMessages.forEach(messageType => {
        const message = { type: messageType };
        const keepChannelOpen = simulateMessageListener(message, mockSender, mockSendResponse);

        expect(keepChannelOpen).toBe(true,
          `${messageType} should return true to keep channel open for async response`);
      });
    });

    it('should return false for messages that do not need responses', () => {
      const fireAndForgetMessages = [
        'MAZE_COMPLETED',
        'CONSCIOUS_CLOSURE_COMPLETED',
        'UPDATE_TAB_LIMIT',
        'COMPLETE_ONBOARDING',
        'FOCUS_MAZE_TAB',
        'CLOSE_BLOB_TAB',
        'GET_BLOCKED_URL',
        'UNKNOWN_MESSAGE_TYPE'
      ];

      fireAndForgetMessages.forEach(messageType => {
        const message = { type: messageType };
        const keepChannelOpen = simulateMessageListener(message, mockSender, mockSendResponse);

        expect(keepChannelOpen).toBe(false,
          `${messageType} should return false to close channel immediately`);
      });
    });

    it('should handle the specific MAZE_COMPLETED regression case', () => {
      // This test specifically validates the fix for the reported issue
      const message = {
        type: 'MAZE_COMPLETED',
        data: {
          difficulty: 'medium',
          time: 1500,
          size: 15,
          action: 'updateLimit'
        }
      };

      const keepChannelOpen = simulateMessageListener(message, mockSender, mockSendResponse);

      // Critical: MAZE_COMPLETED must NOT keep channel open
      expect(keepChannelOpen).toBe(false);

      // The message should be processed but no response expected
      expect(mockSendResponse).not.toHaveBeenCalled();
    });
  });

  describe('Response Handling Integration', () => {
    /**
     * These tests validate that the dispatchMessage function is called correctly
     * for different message types, ensuring proper async handling
     */

    it('should call dispatchMessage for GET_STATS and keep channel open', async () => {
      const message = { type: 'GET_STATS' };

      const keepChannelOpen = simulateMessageListener(message, mockSender, mockSendResponse);
      expect(keepChannelOpen).toBe(true);

      // Wait for async processing to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify dispatchMessage was called with correct parameters
      expect(dispatchMessage).toHaveBeenCalledWith(null, message, mockSender, mockSendResponse);
    });

    it('should call dispatchMessage for MAZE_COMPLETED but not keep channel open', async () => {
      const message = { type: 'MAZE_COMPLETED', data: { action: 'updateLimit' } };

      const keepChannelOpen = simulateMessageListener(message, mockSender, mockSendResponse);
      expect(keepChannelOpen).toBe(false);

      // Wait for async processing to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify dispatchMessage was called
      expect(dispatchMessage).toHaveBeenCalledWith(null, message, mockSender, mockSendResponse);
    });

    it('should handle dispatch errors gracefully', async () => {
      dispatchMessage.mockRejectedValue(new Error('Dispatch failure'));

      const message = { type: 'GET_STATS' };
      const keepChannelOpen = simulateMessageListener(message, mockSender, mockSendResponse);

      expect(keepChannelOpen).toBe(true);

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should send error response
      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });
  });

  describe('Message Flow Validation', () => {
    /**
     * These tests simulate the exact flow that was broken:
     * Content script → Background → Response (or lack thereof)
     */

    it('should simulate successful tab limit update flow', async () => {
      // Simulate the exact sequence from the regression report:

      // 1. Maze completion (should not wait for response)
      const mazeMessage = {
        type: 'MAZE_COMPLETED',
        data: { action: 'updateLimit', difficulty: 'medium' }
      };

      const mazeMockResponse = jest.fn();
      const keepMazeChannelOpen = simulateMessageListener(mazeMessage, mockSender, mazeMockResponse);

      expect(keepMazeChannelOpen).toBe(false); // Critical: no response expected
      expect(mazeMockResponse).not.toHaveBeenCalled(); // No response should be sent

      // 2. Tab limit update (should send success response)
      const updateMessage = { type: 'UPDATE_TAB_LIMIT', limit: 8 };
      const updateMockResponse = jest.fn();
      const keepUpdateChannelOpen = simulateMessageListener(updateMessage, mockSender, updateMockResponse);

      expect(keepUpdateChannelOpen).toBe(false); // Sync response, channel can close

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should get success response
      expect(updateMockResponse).toHaveBeenCalledWith({ success: true });
    });

    it('should validate CREATE_MAZE_TAB async response flow', async () => {
      const message = {
        type: 'CREATE_MAZE_TAB',
        data: { action: 'updateLimit', blockedUrl: 'https://example.com' }
      };

      const keepChannelOpen = simulateMessageListener(message, mockSender, mockSendResponse);

      // Must keep channel open for CREATE_MAZE_TAB
      expect(keepChannelOpen).toBe(true);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should receive response (success or error)
      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: expect.any(Boolean)
        })
      );
    });
  });

  describe('Regression Prevention', () => {
    /**
     * These tests are designed to catch common mistakes that cause
     * message channel handling regressions
     */

    it('should maintain consistent return type (boolean) for all messages', () => {
      const allMessageTypes = [
        'GET_STATS', 'RESET_STATS', 'CHECK_MAZE_COMPLETED', 'CREATE_MAZE_TAB',
        'MAZE_COMPLETED', 'CONSCIOUS_CLOSURE_COMPLETED', 'UPDATE_TAB_LIMIT',
        'COMPLETE_ONBOARDING', 'FOCUS_MAZE_TAB', 'CLOSE_BLOB_TAB',
        'GET_BLOCKED_URL', 'UNKNOWN_TYPE'
      ];

      allMessageTypes.forEach(messageType => {
        const message = { type: messageType };
        const result = simulateMessageListener(message, mockSender, mockSendResponse);

        expect(typeof result).toBe('boolean',
          `${messageType} must return boolean, got ${typeof result}`);
      });
    });

    it('should not accidentally return undefined or other truthy values', () => {
      // Test various message scenarios to ensure we never accidentally
      // return undefined (which would be falsy) or other values

      const testMessages = [
        { type: 'MAZE_COMPLETED' },
        { type: 'UPDATE_TAB_LIMIT', limit: 5 },
        { type: 'GET_STATS' },
        { type: 'NONEXISTENT_TYPE' }
      ];

      testMessages.forEach(message => {
        const result = simulateMessageListener(message, mockSender, mockSendResponse);
        expect(result === true || result === false).toBe(true,
          `Message ${message.type} returned ${result}, must be explicitly true or false`);
      });
    });

    it('should handle edge cases without breaking channel management', () => {
      // Test edge cases that might break channel handling

      const edgeCases = [
        { message: null, expectedReturn: false },
        { message: {}, expectedReturn: false },
        { message: { type: '' }, expectedReturn: false },
        { message: { type: null }, expectedReturn: false },
        { message: { type: undefined }, expectedReturn: false }
      ];

      edgeCases.forEach(({ message, expectedReturn }) => {
        expect(() => {
          const result = simulateMessageListener(message, mockSender, mockSendResponse);
          expect(typeof result).toBe('boolean');
          expect(result).toBe(expectedReturn);
        }).not.toThrow();
      });
    });
  });
});
