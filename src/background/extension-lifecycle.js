/**
 * Background Extension Lifecycle - Testable extension initialization logic
 * Extracted from background.js for better testability and modularity
 */

import { Logger } from '../debug.js';

const logger = new Logger('EXTENSION-LIFECYCLE');

/**
 * Initialize extension state and load settings
 */
export async function initializeExtension(tabManager) {
  try {
    await tabManager.initialize();
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
      // Show onboarding page for first-time users
      await chrome.tabs.create({
        url: chrome.runtime.getURL('src/options.html?onboarding=true')
      });
      logger.log('Opened onboarding page for new installation');
      return { ...initResult, onboardingOpened: true };
    } catch (error) {
      logger.error('Failed to open onboarding page:', error);
      return { ...initResult, onboardingOpened: false, onboardingError: error.message };
    }
  }

  return { ...initResult, onboardingOpened: false };
}
