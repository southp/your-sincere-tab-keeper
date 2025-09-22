/**
 * Tests for message dispatcher - critical message handling functionality
 * These tests prevent regressions in async message handling that have broken multiple times
 */

import { dispatchMessage } from './message-dispatcher.js';
import * as messageHandlers from './message-handlers.js';
import { notifyPopupUpdate } from './popup-notifications.js';

// Mock dependencies
jest.mock('./message-handlers.js');
jest.mock('./popup-notifications.js');

describe('Message Dispatcher', () => {
  let mockTabManager;
  let mockSender;
  let mockSendResponse;

  beforeEach(() => {
    mockTabManager = {
      getStats: jest.fn()
    };
    mockSender = {
      tab: { id: 123 }
    };
    mockSendResponse = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('dispatchMessage', () => {
    it('should handle GET_STATS message and return keepChannelOpen=true', async () => {
      const mockStats = { tabLimit: 5, mazesCompleted: 3 };
      messageHandlers.handleGetStats.mockResolvedValue({
        success: true,
        data: mockStats
      });

      const message = { type: 'GET_STATS' };
      const result = await dispatchMessage(mockTabManager, message, mockSender, mockSendResponse);

      expect(messageHandlers.handleGetStats).toHaveBeenCalledWith(mockTabManager);
      expect(mockSendResponse).toHaveBeenCalledWith(mockStats);
      expect(result).toBe(true); // Critical: must return true to keep channel open
    });

    it('should handle GET_STATS error and send error response', async () => {
      messageHandlers.handleGetStats.mockResolvedValue({
        success: false,
        error: 'Failed to load stats'
      });

      const message = { type: 'GET_STATS' };
      const result = await dispatchMessage(mockTabManager, message, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({ error: 'Failed to load stats' });
      expect(result).toBe(true); // Still keep channel open for error response
    });

    it('should handle RESET_STATS message and return keepChannelOpen=true', async () => {
      messageHandlers.handleResetStats.mockResolvedValue({
        success: true
      });

      const message = { type: 'RESET_STATS' };
      const result = await dispatchMessage(mockTabManager, message, mockSender, mockSendResponse);

      expect(messageHandlers.handleResetStats).toHaveBeenCalledWith(mockTabManager);
      expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
      expect(result).toBe(true); // Critical: must return true to keep channel open
    });

    it('should handle CHECK_MAZE_COMPLETED message and return keepChannelOpen=true', async () => {
      const mockResult = { success: true, data: { isCompleted: false } };
      messageHandlers.handleCheckMazeCompleted.mockReturnValue(mockResult);

      const message = { type: 'CHECK_MAZE_COMPLETED' };
      const result = await dispatchMessage(mockTabManager, message, mockSender, mockSendResponse);

      expect(messageHandlers.handleCheckMazeCompleted).toHaveBeenCalledWith(mockTabManager, 123);
      expect(mockSendResponse).toHaveBeenCalledWith({ isCompleted: false });
      expect(result).toBe(true); // Critical: must return true to keep channel open
    });

    it('should handle CREATE_MAZE_TAB message and return keepChannelOpen=true', async () => {
      messageHandlers.handleCreateMazeTab.mockResolvedValue({
        success: true,
        data: { created: true }
      });

      const message = { type: 'CREATE_MAZE_TAB', data: { action: 'updateLimit' } };
      const result = await dispatchMessage(mockTabManager, message, mockSender, mockSendResponse);

      expect(messageHandlers.handleCreateMazeTab).toHaveBeenCalledWith(mockTabManager, { action: 'updateLimit' });
      expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
      expect(result).toBe(true); // Critical: must return true to keep channel open
    });

    it('should handle messages that need popup updates', async () => {
      messageHandlers.handleMazeCompleted.mockResolvedValue();
      notifyPopupUpdate.mockResolvedValue();

      const message = { type: 'MAZE_COMPLETED', data: {} };
      const result = await dispatchMessage(mockTabManager, message, mockSender, mockSendResponse);

      expect(messageHandlers.handleMazeCompleted).toHaveBeenCalledWith(mockTabManager, 123, {});
      expect(notifyPopupUpdate).toHaveBeenCalledWith(mockTabManager);
      expect(result).toBe(false); // No response needed, channel can close
    });

    it('should handle UPDATE_TAB_LIMIT message and send response', async () => {
      messageHandlers.handleTabLimitUpdate.mockResolvedValue();

      const message = { type: 'UPDATE_TAB_LIMIT', limit: 5 };
      const result = await dispatchMessage(mockTabManager, message, mockSender, mockSendResponse);

      expect(messageHandlers.handleTabLimitUpdate).toHaveBeenCalledWith(mockTabManager, 5);
      expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
      expect(result).toBe(false); // No channel open needed for this response
    });

    it('should handle COMPLETE_ONBOARDING message and send response', async () => {
      messageHandlers.handleCompleteOnboarding.mockResolvedValue();

      const message = { type: 'COMPLETE_ONBOARDING', limit: 3 };
      const result = await dispatchMessage(mockTabManager, message, mockSender, mockSendResponse);

      expect(messageHandlers.handleCompleteOnboarding).toHaveBeenCalledWith(mockTabManager, 3);
      expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
      expect(result).toBe(false); // No channel open needed for this response
    });

    it('should handle unknown message types gracefully', async () => {
      const message = { type: 'UNKNOWN_MESSAGE' };
      const result = await dispatchMessage(mockTabManager, message, mockSender, mockSendResponse);

      expect(mockSendResponse).not.toHaveBeenCalled();
      expect(result).toBe(false); // No response needed
    });

    it('should handle dispatcher errors and send error response', async () => {
      messageHandlers.handleGetStats.mockRejectedValue(new Error('Mock error'));

      const message = { type: 'GET_STATS' };
      const result = await dispatchMessage(mockTabManager, message, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({ error: 'Mock error' });
      expect(result).toBe(false); // Error case, channel can close
    });
  });

  describe('Message Channel Management', () => {
    // These tests specifically validate the critical channel management behavior
    // that has broken multiple times in the past

    it('should return boolean values synchronously for channel management', async () => {
      const testCases = [
        { type: 'GET_STATS', expectedKeepOpen: true },
        { type: 'RESET_STATS', expectedKeepOpen: true },
        { type: 'CHECK_MAZE_COMPLETED', expectedKeepOpen: true },
        { type: 'CREATE_MAZE_TAB', expectedKeepOpen: true },
        { type: 'MAZE_COMPLETED', expectedKeepOpen: false },
        { type: 'FOCUS_MAZE_TAB', expectedKeepOpen: false },
        { type: 'UNKNOWN_TYPE', expectedKeepOpen: false }
      ];

      // Mock all handlers to succeed
      messageHandlers.handleGetStats.mockResolvedValue({ success: true, data: {} });
      messageHandlers.handleResetStats.mockResolvedValue({ success: true });
      messageHandlers.handleCheckMazeCompleted.mockReturnValue({ success: true, data: {} });
      messageHandlers.handleCreateMazeTab.mockResolvedValue({ success: true });
      messageHandlers.handleMazeCompleted.mockResolvedValue();
      messageHandlers.handleFocusMazeTab.mockResolvedValue({ success: true });

      for (const testCase of testCases) {
        const result = await dispatchMessage(
          mockTabManager,
          { type: testCase.type },
          mockSender,
          mockSendResponse
        );

        expect(typeof result).toBe('boolean');
        expect(result).toBe(testCase.expectedKeepOpen);
      }
    });
  });
});
