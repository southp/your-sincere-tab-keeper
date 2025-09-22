/**
 * Background Tab Event Handlers - Testable tab event processing logic
 * Extracted from background.js for better testability and modularity
 */

import { Logger } from '../debug.js';
import { isSpecialTab, isMazeTab } from '../utils.js';
import { clearMazeSession } from '../maze/maze-session.js';
import { usageDataStore } from '../usage-data-store.js';

const logger = new Logger('TAB-EVENT-HANDLERS');

/**
 * Handle new tab creation - main tab limiting logic
 */
export async function handleTabCreated(tabManager, tab) {
  logger.log('New tab created:', tab.id, tab.url);

  // Record daily activity (only once per day)
  try {
    const store = usageDataStore();
    await store.recordTodayActivity();
  } catch (error) {
    logger.warn('Failed to record daily activity:', error);
  }

  // Use TabManager to check how tab should be handled
  const result = await tabManager.shouldAllowNewTab(tab);

  switch (result.action) {
    case 'allow':
      // Tab is allowed, do nothing
      break;
    case 'redirect-to-maze':
      await tabManager.handleTabLimitExceeded(tab);
      break;
    case 'show-notification':
      await handleShowBlobForExcessTab(tab);
      break;
  }

  return result;
}

/**
 * Handle tab updates (URL changes, loading states)
 */
export async function handleTabUpdated(tabManager, tabId, changeInfo, tab) {
  // Handle tab loading completion
  if (changeInfo.status === 'complete') {
    tabManager.onTabLoadComplete(tabId);
  }

  // Handle URL changes in tabs
  if (changeInfo.url && !isSpecialTab(tab)) {
    // Special case: If this is the maze tab trying to navigate away, restore it instead of showing blob
    if (tabId === tabManager.mazeTabId && !isMazeTab(tab)) {
      logger.log('Maze tab attempting navigation to:', changeInfo.url, '- restoring maze');
      await tabManager.restoreMazeTab(tabId, changeInfo.url);
      return { action: 'restored-maze' };
    }

    // Regular case: Non-maze tab getting a URL
    if (!isMazeTab(tab)) {
      logger.log('Tab URL changed:', tabId, 'from empty to', changeInfo.url);

      // Use TabManager to check how tab should be handled
      const result = await tabManager.shouldAllowNewTab(tab);

      switch (result.action) {
        case 'allow':
          // Tab is allowed, do nothing
          break;
        case 'redirect-to-maze':
          logger.log('Tab limit exceeded during URL change, blocking navigation');
          await tabManager.handleTabLimitExceeded(tab);
          break;
        case 'show-notification':
          await handleShowBlobForUrlChange(tabId);
          break;
      }

      return result;
    }
  }

  return { action: 'no-action' };
}

/**
 * Handle tab removal and conscious closure detection
 */
export async function handleTabRemoved(tabManager, tabId) {
  logger.log('Tab removed:', tabId, 'Current maze tab ID:', tabManager.mazeTabId);

  // Check if this was the maze tab and clear session if so
  if (tabManager.mazeTabId === tabId) {
    try {
      logger.log('Removing maze tab - clearing session');
      await clearMazeSession();
      logger.log('Cleared maze session after maze tab was closed:', tabId);
    } catch (error) {
      logger.error('Failed to clear maze session on tab close:', error);
    }
  } else {
    logger.log('Not the maze tab, session will remain');
  }

  tabManager.onTabRemoved(tabId);

  // Check if tab closure brings count below limit (conscious closure)
  const consciousClosureData = await tabManager.checkForConsciousClosure();
  if (consciousClosureData) {
    return handleConsciousClosure(consciousClosureData);
  }

  return { consciousClosureDetected: false };
}

/**
 * Handle tab replacement due to prerendering
 */
export function handleTabReplaced(tabManager, addedTabId, removedTabId) {
  tabManager.onTabReplaced(addedTabId, removedTabId);
  return { success: true };
}

/**
 * Show blob page for excess tab creation
 */
async function handleShowBlobForExcessTab(tab) {
  try {
    logger.log('Showing playful blob for excess tab:', tab.id, '- maze already exists');
    const blobUrl = chrome.runtime.getURL('src/blob.html');
    await chrome.tabs.update(tab.id, { url: blobUrl });
  } catch (error) {
    logger.error('Failed to show blob page, closing excess tab:', tab.id, error);
    try {
      await chrome.tabs.remove(tab.id);
    } catch (closeError) {
      logger.error('Failed to close tab after blob error:', closeError);
    }
  }
}

/**
 * Show blob page for URL change on excess tab
 */
async function handleShowBlobForUrlChange(tabId) {
  try {
    logger.log('Showing playful blob for tab URL change:', tabId, '- maze already exists');
    const blobUrl = chrome.runtime.getURL('src/blob.html');
    await chrome.tabs.update(tabId, { url: blobUrl });
  } catch (error) {
    logger.error('Failed to show blob page, closing tab:', tabId, error);
    try {
      await chrome.tabs.remove(tabId);
    } catch (closeError) {
      logger.error('Failed to close tab after blob error:', closeError);
    }
  }
}

/**
 * Handle conscious closure notification
 */
async function handleConsciousClosure(consciousClosureData) {
  try {
    await chrome.tabs.sendMessage(consciousClosureData.mazeTabId, {
      type: 'CONSCIOUS_CLOSURE_DETECTED',
      data: {
        currentCount: consciousClosureData.currentCount,
        limit: consciousClosureData.limit
      }
    });
    logger.log(`🎉 Notified maze tab ${consciousClosureData.mazeTabId} of conscious closure`);
    return { consciousClosureDetected: true, data: consciousClosureData };
  } catch (error) {
    logger.error('Error notifying maze tab of conscious closure:', error);
    return { consciousClosureDetected: false, error: error.message };
  }
}
