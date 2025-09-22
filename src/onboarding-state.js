/**
 * Onboarding State Manager
 * Manages onboarding flow state using chrome.storage.local (separate from exportable stats)
 */

import { Logger } from './debug.js';

const logger = new Logger('ONBOARDING-STATE');
const ONBOARDING_KEY = '_onboarding_state'; // Prefix with _ to keep separate from stats

/**
 * Onboarding state manager
 */
export const onboardingState = {
  /**
   * Set onboarding as active for new installations
   */
  async setActive() {
    const state = {
      isActive: true,
      startTime: Date.now()
    };
    await chrome.storage.local.set({ [ONBOARDING_KEY]: state });
  },

  /**
   * Check if onboarding is currently active
   */
  async isActive() {
    try {
      const result = await chrome.storage.local.get([ONBOARDING_KEY]);
      const state = result[ONBOARDING_KEY];
      return state?.isActive === true;
    } catch (error) {
      logger.warn('Failed to get onboarding state:', error);
      return false;
    }
  },

  /**
   * Clear onboarding state (called when onboarding is completed)
   */
  async clear() {
    await chrome.storage.local.remove([ONBOARDING_KEY]);
  },

  /**
   * Get onboarding session info (for debugging)
   */
  async getInfo() {
    try {
      const result = await chrome.storage.local.get([ONBOARDING_KEY]);
      return result[ONBOARDING_KEY] || null;
    } catch (error) {
      logger.warn('Failed to get onboarding state:', error);
      return null;
    }
  }
};
