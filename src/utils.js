/**
 * General utilities for Your Sincere Tab Keeper
 * Shared functions used across multiple modules
 */

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