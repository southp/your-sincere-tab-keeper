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

// Maze difficulty configuration
export const DIFFICULTY_LEVELS = {
  BEGINNER: 0,
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
  EXPERT: 4,
  MASTER: 5,
  INSANE: 6
};

// Required maze completions to reach each difficulty level
export const DIFFICULTY_THRESHOLDS = {
  [DIFFICULTY_LEVELS.BEGINNER]: 0,   // Default starting level
  [DIFFICULTY_LEVELS.EASY]: 2,       // After 2 mazes -> Easy
  [DIFFICULTY_LEVELS.MEDIUM]: 5,     // After 5 mazes -> Medium
  [DIFFICULTY_LEVELS.HARD]: 8,       // After 8 mazes -> Hard
  [DIFFICULTY_LEVELS.EXPERT]: 12,    // After 12 mazes -> Expert
  [DIFFICULTY_LEVELS.MASTER]: 17,    // After 17 mazes -> Master
  [DIFFICULTY_LEVELS.INSANE]: 117    // After 117 mazes -> Insane
};

// Minimum difficulty for specific actions
export const DIFFICULTY_CONSTRAINTS = {
  UPDATE_LIMIT_MIN: DIFFICULTY_LEVELS.HARD,  // updateLimit requires minimum Hard difficulty
  MAX_DIFFICULTY: DIFFICULTY_LEVELS.INSANE   // Maximum difficulty level
};
