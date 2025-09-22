/**
 * Tests for onboarding state management
 */

import { onboardingState } from './onboarding-state.js';

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      set: jest.fn(),
      get: jest.fn(),
      remove: jest.fn()
    }
  }
};

describe('Onboarding State', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setActive', () => {
    it('should set onboarding as active with timestamp', async () => {
      chrome.storage.local.set.mockResolvedValue();

      await onboardingState.setActive();

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        '_onboarding_state': {
          isActive: true,
          startTime: expect.any(Number)
        }
      });
    });
  });

  describe('isActive', () => {
    it('should return true when onboarding is active', async () => {
      chrome.storage.local.get.mockResolvedValue({
        '_onboarding_state': { isActive: true, startTime: Date.now() }
      });

      const result = await onboardingState.isActive();

      expect(result).toBe(true);
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['_onboarding_state']);
    });

    it('should return false when onboarding is not active', async () => {
      chrome.storage.local.get.mockResolvedValue({
        '_onboarding_state': { isActive: false, startTime: Date.now() }
      });

      const result = await onboardingState.isActive();

      expect(result).toBe(false);
    });

    it('should return false when no onboarding state exists', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const result = await onboardingState.isActive();

      expect(result).toBe(false);
    });

    it('should handle storage errors gracefully', async () => {
      chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

      const result = await onboardingState.isActive();

      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove onboarding state', async () => {
      chrome.storage.local.remove.mockResolvedValue();

      await onboardingState.clear();

      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['_onboarding_state']);
    });
  });

  describe('getInfo', () => {
    it('should return onboarding info when available', async () => {
      const mockState = { isActive: true, startTime: 123456789 };
      chrome.storage.local.get.mockResolvedValue({
        '_onboarding_state': mockState
      });

      const result = await onboardingState.getInfo();

      expect(result).toEqual(mockState);
    });

    it('should return null when no state exists', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const result = await onboardingState.getInfo();

      expect(result).toBe(null);
    });

    it('should handle storage errors gracefully', async () => {
      chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

      const result = await onboardingState.getInfo();

      expect(result).toBe(null);
    });
  });
});
