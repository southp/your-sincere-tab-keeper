/**
 * Background Message Handlers - Testable message processing logic
 * Extracted from background.js for better testability and modularity
 */

import { Logger } from '../debug.js';
import { usageDataStore } from '../usage-data-store.js';
import { clearMazeSession } from '../maze/maze-session.js';

const logger = new Logger('MESSAGE-HANDLERS');

/**
 * Handle maze completion message
 */
export async function handleMazeCompleted(tabManager, tabId, data) {
  await tabManager.handleMazeCompleted(tabId, data);
}

/**
 * Handle conscious closure completion message
 */
export async function handleConsciousClosureCompleted(tabManager, tabId, data) {
  await tabManager.handleConsciousClosure(tabId, data);
  await clearMazeSession();
}

/**
 * Handle tab limit update message
 */
export async function handleTabLimitUpdate(tabManager, limit) {
  await tabManager.handleTabLimitUpdate(limit);
}

/**
 * Handle onboarding completion message
 */
export async function handleCompleteOnboarding(tabManager, limit) {
  await tabManager.handleCompleteOnboarding(limit);
}

/**
 * Get extension statistics
 */
export async function handleGetStats(tabManager) {
  try {
    const stats = await tabManager.getStats();
    return { success: true, data: stats };
  } catch (error) {
    logger.error('Failed to get stats:', error);
    return { success: false, error: 'Failed to load statistics' };
  }
}

/**
 * Handle stats reset including TabManager state
 */
export async function handleResetStats(tabManager) {
  try {
    // Reset storage data using data store
    const store = usageDataStore();
    await store.resetStatistics();

    // Reset TabManager's in-memory state
    tabManager.dailyMazesCompleted = 0;

    logger.log('Statistics reset successfully');
    return { success: true };
  } catch (error) {
    logger.error('Failed to reset stats:', error);
    return { success: false, error: 'Failed to reset statistics' };
  }
}

/**
 * Handle maze tab creation
 */
export async function handleCreateMazeTab(tabManager, data) {
  try {
    const result = await tabManager.createMazeTabOrBlob(data);
    logger.log('Maze creation result:', result);
    return { success: true, data: result };
  } catch (error) {
    logger.error('Error creating maze tab:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Close blob tab after countdown expires
 */
export async function handleCloseBlobTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    logger.log('Closed blob tab:', tabId);
    return { success: true };
  } catch (error) {
    logger.error('Failed to close blob tab:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if maze is completed for the requesting tab
 */
export function handleCheckMazeCompleted(tabManager, tabId) {
  const isCompleted = tabManager.isMazeCompleted(tabId);
  return { success: true, data: { isCompleted } };
}

/**
 * Handle focus maze tab request
 */
export async function handleFocusMazeTab(tabManager) {
  try {
    await tabManager.focusMazeTab();
    return { success: true };
  } catch (error) {
    logger.error('Failed to focus maze tab:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle GET_BLOCKED_URL request (legacy functionality)
 */
export function handleGetBlockedUrl() {
  // This functionality is now handled internally by TabManager
  return { success: true, data: { url: null } };
}
