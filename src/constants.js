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

// Maze difficulty settings - centralized configuration
export function getDifficultySettings() {
  return [
    { name: getI18nMessage('difficultyBeginner'), size: 9, description: getI18nMessage('difficultyBeginnerDesc') },
    { name: getI18nMessage('difficultyEasy'), size: 11, description: getI18nMessage('difficultyEasyDesc') },
    { name: getI18nMessage('difficultyMedium'), size: 15, description: getI18nMessage('difficultyMediumDesc') },
    { name: getI18nMessage('difficultyHard'), size: 21, description: getI18nMessage('difficultyHardDesc') },
    { name: getI18nMessage('difficultyExpert'), size: 27, description: getI18nMessage('difficultyExpertDesc') },
    { name: getI18nMessage('difficultyMaster'), size: 39, description: getI18nMessage('difficultyMasterDesc') },
    { name: getI18nMessage('difficultyInsane'), size: 101, description: getI18nMessage('difficultyInsaneDesc') }
  ];
}
