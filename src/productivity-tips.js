/**
 * Productivity tips for post-maze completion
 * Gentle nudges toward better tab management and focus
 */

export const PRODUCTIVITY_TIPS = [
  {
    title: "The 2-Minute Rule",
    message: "If a task takes less than 2 minutes, do it immediately instead of opening a new tab to 'remember' it later."
  },
  {
    title: "One Tab, One Task",
    message: "Focus on completing one task before opening another tab. Your brain works better with single-tasking."
  },
  {
    title: "Bookmark, Don't Hoard",
    message: "That interesting article can be bookmarked for later. You don't need to keep 20 tabs open 'just in case'."
  },
  {
    title: "The Tab Audit",
    message: "Every hour, ask yourself: 'Which of these tabs am I actually using right now?' Close the rest."
  },
  {
    title: "Time-Box Your Browsing",
    message: "Set a 25-minute timer for focused work. When it rings, then you can check those other tabs."
  },
  {
    title: "Write It Down",
    message: "Keep a notepad for quick thoughts instead of opening tabs as 'reminders'. Your future self will thank you."
  },
  {
    title: "The Fresh Start",
    message: "Close all tabs at the end of each day. Tomorrow's work deserves a clean, focused environment."
  },
  {
    title: "Quality Over Quantity",
    message: "Three focused tabs accomplish more than thirty distracted ones. Choose mindfully."
  },
  {
    title: "Digital Minimalism",
    message: "Your browser is a tool, not a storage system. Use it intentionally, not habitually."
  },
  {
    title: "The Power of Focus",
    message: "Deep work happens in distraction-free environments. Fewer tabs = more accomplished goals."
  }
];

/**
 * Get a random productivity tip
 * @returns {Object} Random tip with title and message
 */
export function getRandomTip() {
  const randomIndex = Math.floor(Math.random() * PRODUCTIVITY_TIPS.length);
  return PRODUCTIVITY_TIPS[randomIndex];
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