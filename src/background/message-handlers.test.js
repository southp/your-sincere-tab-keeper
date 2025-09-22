/**
 * Tests for message handlers module
 */

import * as messageHandlers from './message-handlers.js';
import { usageDataStore } from '../usage-data-store.js';
import { clearMazeSession } from '../maze/maze-session.js';

// Mock dependencies
jest.mock('../usage-data-store.js');
jest.mock('../maze/maze-session.js');

describe('Message Handlers', () => {
  let mockTabManager;

  beforeEach(() => {
    mockTabManager = {
      handleMazeCompleted: jest.fn(),
      handleConsciousClosure: jest.fn(),
      handleTabLimitUpdate: jest.fn(),
      handleCompleteOnboarding: jest.fn(),
      getStats: jest.fn(),
      createMazeTabOrBlob: jest.fn(),
      isMazeCompleted: jest.fn(),
      focusMazeTab: jest.fn(),
      dailyMazesCompleted: 0
    };

    jest.clearAllMocks();
  });

  describe('handleGetStats', () => {
    it('should return stats successfully', async () => {
      const mockStats = { tabLimit: 5, mazesCompleted: 3 };
      mockTabManager.getStats.mockResolvedValue(mockStats);

      const result = await messageHandlers.handleGetStats(mockTabManager);

      expect(result).toEqual({ success: true, data: mockStats });
      expect(mockTabManager.getStats).toHaveBeenCalled();
    });

    it('should handle stats error', async () => {
      mockTabManager.getStats.mockRejectedValue(new Error('Stats error'));

      const result = await messageHandlers.handleGetStats(mockTabManager);

      expect(result).toEqual({ success: false, error: 'Failed to load statistics' });
    });
  });

  describe('handleResetStats', () => {
    it('should reset stats successfully', async () => {
      const mockStore = {
        resetStatistics: jest.fn().mockResolvedValue()
      };
      usageDataStore.mockReturnValue(mockStore);

      const result = await messageHandlers.handleResetStats(mockTabManager);

      expect(result).toEqual({ success: true });
      expect(mockStore.resetStatistics).toHaveBeenCalled();
      expect(mockTabManager.dailyMazesCompleted).toBe(0);
    });

    it('should handle reset error', async () => {
      const mockStore = {
        resetStatistics: jest.fn().mockRejectedValue(new Error('Reset error'))
      };
      usageDataStore.mockReturnValue(mockStore);

      const result = await messageHandlers.handleResetStats(mockTabManager);

      expect(result).toEqual({ success: false, error: 'Failed to reset statistics' });
    });
  });

  describe('handleCreateMazeTab', () => {
    it('should create maze tab successfully', async () => {
      const mockResult = { created: true };
      mockTabManager.createMazeTabOrBlob.mockResolvedValue(mockResult);

      const result = await messageHandlers.handleCreateMazeTab(mockTabManager, { action: 'test' });

      expect(result).toEqual({ success: true, data: mockResult });
      expect(mockTabManager.createMazeTabOrBlob).toHaveBeenCalledWith({ action: 'test' });
    });

    it('should handle maze creation error', async () => {
      mockTabManager.createMazeTabOrBlob.mockRejectedValue(new Error('Creation failed'));

      const result = await messageHandlers.handleCreateMazeTab(mockTabManager, {});

      expect(result).toEqual({ success: false, error: 'Creation failed' });
    });
  });

  describe('handleCheckMazeCompleted', () => {
    it('should return maze completion status', () => {
      mockTabManager.isMazeCompleted.mockReturnValue(true);

      const result = messageHandlers.handleCheckMazeCompleted(mockTabManager, 123);

      expect(result).toEqual({ success: true, data: { isCompleted: true } });
      expect(mockTabManager.isMazeCompleted).toHaveBeenCalledWith(123);
    });
  });

  describe('handleConsciousClosureCompleted', () => {
    it('should handle conscious closure completion', async () => {
      mockTabManager.handleConsciousClosure.mockResolvedValue();
      clearMazeSession.mockResolvedValue();

      await messageHandlers.handleConsciousClosureCompleted(mockTabManager, 123, {});

      expect(mockTabManager.handleConsciousClosure).toHaveBeenCalledWith(123, {});
      expect(clearMazeSession).toHaveBeenCalled();
    });
  });
});