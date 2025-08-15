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
 * Check if tab is a maze tab
 */
export function isMazeTab(tab) {
  return tab.url && tab.url.includes('maze.html');
}