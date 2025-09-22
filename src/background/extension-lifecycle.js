/**
 * Background Extension Lifecycle - Testable extension initialization logic
 * Extracted from background.js for better testability and modularity
 */

import { Logger } from '../debug.js';
import { onboardingState } from '../onboarding-state.js';
import { usageDataStore } from '../usage-data-store.js';

const logger = new Logger('EXTENSION-LIFECYCLE');

/**
 * Initialize extension state and load settings
 */
export async function initializeExtension(tabManager) {
  try {
    await tabManager.initialize();

    // Record daily activity on extension startup
    try {
      const store = usageDataStore();
      await store.recordTodayActivity();
    } catch (error) {
      logger.warn('Failed to record daily activity on startup:', error);
    }

    logger.log('Service worker initialized successfully');
    return { success: true };
  } catch (error) {
    logger.error('Failed to initialize extension:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle extension startup event
 */
export function handleExtensionStartup(tabManager) {
  return initializeExtension(tabManager);
}

/**
 * Handle extension installation/update event
 */
export async function handleExtensionInstalled(tabManager, details) {
  const initResult = await initializeExtension(tabManager);

  if (details.reason === 'install') {
    try {
      // Set onboarding state for first-time users
      await onboardingState.setActive();

      // Open options page (onboarding state will be detected by the page)
      await chrome.tabs.create({
        url: chrome.runtime.getURL('src/options.html')
      });
      logger.log('Set onboarding state and opened options page for new installation');
      return { ...initResult, onboardingOpened: true };
    } catch (error) {
      logger.error('Failed to setup onboarding:', error);
      return { ...initResult, onboardingOpened: false, onboardingError: error.message };
    }
  }

  return { ...initResult, onboardingOpened: false };
}
