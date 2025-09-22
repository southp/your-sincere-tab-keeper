/**
 * Background Popup Notifications - Testable popup communication logic
 * Extracted from background.js for better testability and modularity
 */

import { Logger } from '../debug.js';
import { isSpecialTab, isMazeTab } from '../utils.js';
import { getMazeSessionData } from '../maze/maze-session.js';

const logger = new Logger('POPUP-NOTIFICATIONS');

/**
 * Notify popup about updates when it's open
 */
export async function notifyPopupUpdate(tabManager) {
  try {
    // Get current data for popup
    const [tabs, session, stats] = await Promise.all([
      chrome.tabs.query({}),
      getMazeSessionData(),
      tabManager.getStats()
    ]);

    // Filter regular tabs (not special or maze tabs)
    const regularTabs = tabs.filter(tab => !isSpecialTab(tab) && !isMazeTab(tab));
    const currentLimit = stats.tabLimit;

    // Send updates to popup (will be ignored if popup isn't open)
    await sendTabCountUpdate(regularTabs.length, currentLimit);
    await sendMazeStatusUpdate(!!session);

    return {
      success: true,
      data: {
        tabCount: regularTabs.length,
        currentLimit,
        hasSession: !!session
      }
    };

  } catch (error) {
    logger.error('Error notifying popup:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send tab count update to popup
 */
export async function sendTabCountUpdate(tabCount, currentLimit) {
  try {
    await chrome.runtime.sendMessage({
      type: 'POPUP_UPDATE_TAB_COUNT',
      data: { tabCount, currentLimit }
    });
    return { success: true };
  } catch {
    // Popup is not open, this is expected and not an error
    return { success: false, reason: 'popup-not-open' };
  }
}

/**
 * Send maze status update to popup
 */
export async function sendMazeStatusUpdate(hasSession) {
  try {
    await chrome.runtime.sendMessage({
      type: 'POPUP_UPDATE_MAZE_STATUS',
      data: { hasSession }
    });
    return { success: true };
  } catch {
    // Popup is not open, this is expected and not an error
    return { success: false, reason: 'popup-not-open' };
  }
}
