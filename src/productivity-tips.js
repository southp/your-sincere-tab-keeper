/**
 * Productivity tips for post-maze completion
 * Gentle nudges toward better tab management and focus
 */

const PRODUCTIVITY_TIP_KEYS = [
  { titleKey: 'tip1Title', messageKey: 'tip1Message' },
  { titleKey: 'tip2Title', messageKey: 'tip2Message' },
  { titleKey: 'tip3Title', messageKey: 'tip3Message' },
  { titleKey: 'tip4Title', messageKey: 'tip4Message' },
  { titleKey: 'tip5Title', messageKey: 'tip5Message' },
  { titleKey: 'tip6Title', messageKey: 'tip6Message' },
  { titleKey: 'tip7Title', messageKey: 'tip7Message' },
  { titleKey: 'tip8Title', messageKey: 'tip8Message' },
  { titleKey: 'tip9Title', messageKey: 'tip9Message' },
  { titleKey: 'tip10Title', messageKey: 'tip10Message' }
];

/**
 * Get a random productivity tip
 * @returns {Object} Random tip with localized title and message
 */
export function getRandomTip() {
  const randomIndex = Math.floor(Math.random() * PRODUCTIVITY_TIP_KEYS.length);
  const tipKeys = PRODUCTIVITY_TIP_KEYS[randomIndex];
  
  return {
    title: chrome.i18n.getMessage(tipKeys.titleKey),
    message: chrome.i18n.getMessage(tipKeys.messageKey)
  };
}

/**
 * Get a tip that hasn't been shown recently (basic deduplication)
 * @param {string[]} recentTipTitles - Array of recently shown tip titles
 * @returns {Object} A tip that hasn't been shown recently, or random if all have been shown
 */
export function getUniqueTip(recentTipTitles = []) {
  // Filter out recently shown tips
  const availableTips = PRODUCTIVITY_TIPS.filter(tip => 
    !recentTipTitles.includes(tip.title)
  );
  
  // If all tips have been shown recently, reset and use any tip
  if (availableTips.length === 0) {
    return getRandomTip();
  }
  
  // Return a random tip from available ones
  const randomIndex = Math.floor(Math.random() * availableTips.length);
  return availableTips[randomIndex];
}