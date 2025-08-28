/**
 * Shared constants for Your Sincere Tab Keeper
 * Centralized configuration to avoid duplication
 */

import { getI18nMessage } from './ui-utils.js';

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
    2: getI18nMessage('tabLimitDesc2'),
    3: getI18nMessage('tabLimitDesc3'), 
    4: getI18nMessage('tabLimitDesc4'),
    5: getI18nMessage('tabLimitDesc5'),
    6: getI18nMessage('tabLimitDesc6'),
    7: getI18nMessage('tabLimitDesc7'),
    8: getI18nMessage('tabLimitDesc8')
  };
  return descriptions[limit] || descriptions[5];
}