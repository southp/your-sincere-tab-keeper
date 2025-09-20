/**
 * Background Message Dispatcher - Central message routing logic
 * Extracted from background.js for better testability and modularity
 */

import { Logger } from '../debug.js';
import * as messageHandlers from './message-handlers.js';
import { notifyPopupUpdate } from './popup-notifications.js';

const logger = new Logger('MESSAGE-DISPATCHER');

/**
 * Dispatch incoming messages to appropriate handlers
 */
export async function dispatchMessage(tabManager, message, sender, sendResponse) {
  try {
    const result = await routeMessage(tabManager, message, sender);

    if (result.needsPopupUpdate) {
      await notifyPopupUpdate(tabManager);
    }

    if (result.response) {
      sendResponse(result.response);
    }

    return result.keepChannelOpen || false;
  } catch (error) {
    logger.error('Error dispatching message:', error);
    sendResponse({ error: error.message });
    return false;
  }
}

/**
 * Route message to appropriate handler based on type
 */
async function routeMessage(tabManager, message, sender) {
  switch (message.type) {
    case 'MAZE_COMPLETED':
      await messageHandlers.handleMazeCompleted(tabManager, sender.tab.id, message.data);
      return { needsPopupUpdate: true };

    case 'CONSCIOUS_CLOSURE_COMPLETED':
      await messageHandlers.handleConsciousClosureCompleted(tabManager, sender.tab.id, message.data);
      return { needsPopupUpdate: true };

    case 'GET_BLOCKED_URL': {
      const blockedUrlResult = messageHandlers.handleGetBlockedUrl();
      return { response: blockedUrlResult.data };
    }

    case 'UPDATE_TAB_LIMIT':
      await messageHandlers.handleTabLimitUpdate(tabManager, message.limit);
      return { needsPopupUpdate: true };

    case 'COMPLETE_ONBOARDING':
      await messageHandlers.handleCompleteOnboarding(tabManager, message.limit);
      return { needsPopupUpdate: true };

    case 'GET_STATS': {
      const statsResult = await messageHandlers.handleGetStats(tabManager);
      return {
        response: statsResult.success ? statsResult.data : { error: statsResult.error },
        keepChannelOpen: true
      };
    }

    case 'RESET_STATS': {
      const resetResult = await messageHandlers.handleResetStats(tabManager);
      return {
        response: resetResult.success ? { success: true } : { error: resetResult.error },
        keepChannelOpen: true
      };
    }

    case 'FOCUS_MAZE_TAB':
      await messageHandlers.handleFocusMazeTab(tabManager);
      return {};

    case 'CHECK_MAZE_COMPLETED': {
      const completedResult = messageHandlers.handleCheckMazeCompleted(tabManager, sender.tab.id);
      return {
        response: completedResult.data,
        keepChannelOpen: true
      };
    }

    case 'CLOSE_BLOB_TAB':
      await messageHandlers.handleCloseBlobTab(sender.tab.id);
      return {};

    case 'CREATE_MAZE_TAB': {
      const createResult = await messageHandlers.handleCreateMazeTab(tabManager, message.data);
      return {
        response: createResult.success ? { success: true } : { error: createResult.error },
        keepChannelOpen: true
      };
    }

    default:
      logger.warn('Unknown message type:', message.type);
      return {};
  }
}
