/**
 * Your Sincere Tab Keeper - Background Service Worker
 * Manages tab limits, maze redirects, and extension state
 *
 * This file now serves as the main coordinator between Chrome extension events
 * and the modular background functionality. Complex logic has been extracted
 * into focused modules for better testability and maintainability.
 */

import { Logger } from './debug.js';
import { TabManager } from './tab-manager.js';
import { setupDebugUtilities } from './background/debug-utilities.js';
import { handleExtensionStartup, handleExtensionInstalled } from './background/extension-lifecycle.js';
import { handleTabCreated, handleTabUpdated, handleTabRemoved, handleTabReplaced } from './background/tab-event-handlers.js';
import { dispatchMessage } from './background/message-dispatcher.js';
import { notifyPopupUpdate } from './background/popup-notifications.js';

// Create scoped logger for service worker coordination
const _logger = new Logger('SERVICE-WORKER');

// Initialize the tab manager (core application logic)
const tabManager = new TabManager();

// Setup development debugging utilities
setupDebugUtilities(tabManager);

// Initialize extension on startup
chrome.runtime.onStartup.addListener(async () => {
  await handleExtensionStartup(tabManager);
});

chrome.runtime.onInstalled.addListener(async (details) => {
  await handleExtensionInstalled(tabManager, details);
});

// Extension initialization is now handled by extension-lifecycle.js

/**
 * Handle new tab creation - main tab limiting logic
 */
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tabManager.isInitialized) {
    const { handleExtensionStartup: handleStartup } = await import('./background/extension-lifecycle.js');
    await handleStartup(tabManager);
  }

  await handleTabCreated(tabManager, tab);
  await notifyPopupUpdate(tabManager);
});

/**
 * Handle tab updates (URL changes, loading states)
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tabManager.isInitialized) return;

  await handleTabUpdated(tabManager, tabId, changeInfo, tab);
});

/**
 * Clean up when tabs are closed
 */
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await handleTabRemoved(tabManager, tabId);
  await notifyPopupUpdate(tabManager);
});

/**
 * Handle tab replacement due to prerendering
 */
chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  handleTabReplaced(tabManager, addedTabId, removedTabId);
});

/**
 * Handle tab replacement via webNavigation (alternative event)
 * This provides additional coverage for prerendering tab replacements
 */
chrome.webNavigation.onTabReplaced.addListener((details) => {
  // details.tabId is the new tab, details.replacedTabId is the old tab
  handleTabReplaced(tabManager, details.tabId, details.replacedTabId);
});

// Popup notification logic is now handled by popup-notifications.js

/**
 * Handle messages from content scripts and pages
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle async message dispatch
  (async () => {
    try {
      await dispatchMessage(tabManager, message, sender, sendResponse);
    } catch (error) {
      _logger.error('Message dispatch failed:', error);
      sendResponse({ error: error.message });
    }
  })();

  // Only return true for messages that need async responses
  const asyncMessages = ['GET_STATS', 'RESET_STATS', 'CHECK_MAZE_COMPLETED', 'CREATE_MAZE_TAB'];
  return asyncMessages.includes(message.type);
});

// Message handling logic is now handled by message-dispatcher.js and message-handlers.js


// Debug utilities setup is now handled by debug-utilities.js

// Initialize on service worker startup
handleExtensionStartup(tabManager);

