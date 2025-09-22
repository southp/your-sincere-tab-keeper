/**
 * Tests for extension lifecycle module
 */

import * as extensionLifecycle from './extension-lifecycle.js';

// Mock Chrome APIs
global.chrome = {
  tabs: {
    create: jest.fn()
  },
  runtime: {
    getURL: jest.fn()
  },
  storage: {
    local: {
      set: jest.fn(),
      get: jest.fn(),
      remove: jest.fn()
    }
  }
};

describe('Extension Lifecycle', () => {
  let mockTabManager;

  beforeEach(() => {
    mockTabManager = {
      initialize: jest.fn()
    };

    jest.clearAllMocks();
    chrome.runtime.getURL.mockReturnValue('chrome-extension://test/src/options.html');
    chrome.storage.local.set.mockResolvedValue();
  });

  describe('initializeExtension', () => {
    it('should initialize successfully', async () => {
      mockTabManager.initialize.mockResolvedValue();

      const result = await extensionLifecycle.initializeExtension(mockTabManager);

      expect(result.success).toBe(true);
      expect(mockTabManager.initialize).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockTabManager.initialize.mockRejectedValue(new Error('Init failed'));

      const result = await extensionLifecycle.initializeExtension(mockTabManager);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Init failed');
    });
  });

  describe('handleExtensionStartup', () => {
    it('should handle startup', () => {
      mockTabManager.initialize.mockResolvedValue();

      const result = extensionLifecycle.handleExtensionStartup(mockTabManager);

      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('handleExtensionInstalled', () => {
    it('should handle first install and open onboarding', async () => {
      mockTabManager.initialize.mockResolvedValue();
      chrome.tabs.create.mockResolvedValue();

      const details = { reason: 'install' };
      const result = await extensionLifecycle.handleExtensionInstalled(mockTabManager, details);

      expect(result.success).toBe(true);
      expect(result.onboardingOpened).toBe(true);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        '_onboarding_state': { isActive: true, startTime: expect.any(Number) }
      });
      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'chrome-extension://test/src/options.html'
      });
    });

    it('should handle update without opening onboarding', async () => {
      mockTabManager.initialize.mockResolvedValue();

      const details = { reason: 'update' };
      const result = await extensionLifecycle.handleExtensionInstalled(mockTabManager, details);

      expect(result.success).toBe(true);
      expect(result.onboardingOpened).toBe(false);
      expect(chrome.tabs.create).not.toHaveBeenCalled();
    });

    it('should handle onboarding setup failure', async () => {
      mockTabManager.initialize.mockResolvedValue();
      chrome.storage.local.set.mockRejectedValue(new Error('Storage failed'));

      const details = { reason: 'install' };
      const result = await extensionLifecycle.handleExtensionInstalled(mockTabManager, details);

      expect(result.success).toBe(true);
      expect(result.onboardingOpened).toBe(false);
      expect(result.onboardingError).toBe('Storage failed');
    });
  });
});
