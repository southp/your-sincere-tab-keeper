/**
 * General utilities for Your Sincere Tab Keeper
 * Shared functions used across multiple modules
 */

import { Logger } from './debug.js';

// Create scoped logger for utility functions
const utilsLogger = new Logger('UTILS');

// Special protocols that should be ignored for tab limiting
const SPECIAL_PROTOCOLS = ['chrome:', 'chrome-extension:', 'edge:', 'about:'];

/**
 * Check if tab should be ignored (special pages, extensions, etc.)
 */
export function isSpecialTab(tab) {
  if (!tab.url) return true;
  return SPECIAL_PROTOCOLS.some(protocol => tab.url.startsWith(protocol));
}

/**
 * Check if tab is a maze tab from this extension
 */
export function isMazeTab(tab) {
  if (!tab.url) return false;

  // Check if the URL is from our extension and points to maze.html
  const extensionBaseUrl = chrome.runtime.getURL('');
  return tab.url.startsWith(extensionBaseUrl) && tab.url.includes('maze.html');
}

/**
 * Check if tab is in a popup window (e.g., SSO authentication)
 * Popup windows should be allowed regardless of tab limits to prevent
 * breaking authentication flows and other critical popup-based interactions.
 */
export async function isPopupWindow(tab) {
  if (!tab.windowId) return false;

  try {
    // Get the window information to check its type
    const window = await chrome.windows.get(tab.windowId);

    // Return true if this is a popup window
    return window.type === 'popup';
  } catch (error) {
    // If we can't get window info, assume it's not a popup
    utilsLogger.warn('Failed to get window info for tab:', tab.id, error);
    return false;
  }
}
