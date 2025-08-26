/**
 * Shared constants for Your Sincere Tab Keeper
 * Centralized configuration to avoid duplication
 */

// Tab limit configuration
export const TAB_LIMITS = {
  MIN: 2,
  MAX: 8,
  DEFAULT: 5,
  get RANGE_TEXT() {
    return `${this.MIN}-${this.MAX}`;
  }
};

// Tab limit descriptions - now using i18n
export function getTabLimitDescription(limit) {
  const descriptions = {
    2: chrome.i18n.getMessage('tabLimitDesc2'),
    3: chrome.i18n.getMessage('tabLimitDesc3'), 
    4: chrome.i18n.getMessage('tabLimitDesc4'),
    5: chrome.i18n.getMessage('tabLimitDesc5'),
    6: chrome.i18n.getMessage('tabLimitDesc6'),
    7: chrome.i18n.getMessage('tabLimitDesc7'),
    8: chrome.i18n.getMessage('tabLimitDesc8')
  };
  return descriptions[limit] || descriptions[5];
}