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

// Tab limit descriptions
export const LIMIT_DESCRIPTIONS = {
  2: "Minimalist mode - perfect for focused work sessions",
  3: "Focused browsing - ideal for research and deep work",
  4: "Balanced approach - controlled multitasking",
  5: "Recommended for balanced browsing",
  6: "Moderate flexibility - good for most users",
  7: "Relaxed limits - still maintains awareness",
  8: "Generous allowance - gentle guidance"
};