/**
 * Maze Session Management
 * Handles session persistence, completion tracking, and Chrome extension communication
 */

import { Logger } from '../debug.js';
import { usageDataStore } from '../usage-data-store.js';

// Create logger for this module
const logger = new Logger('MAZE-SESSION');

// Session data (will be injected by the session system)
export let sessionData = {
  action: null,
  difficulty: 0
};

/**
 * Check if this is a completed maze session that user navigated back to
 */
export async function isCompletedMazeSession() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_MAZE_COMPLETED' });
    return response?.isCompleted || false;
  } catch (error) {
    logger.error('Error checking completed maze session:', error);
    return false;
  }
}

/**
 * Load maze session data from Chrome storage
 */
export async function loadMazeSessionData() {
  try {
    // Try to get existing session data
    const store = usageDataStore();
    const storedSessionData = await store.getMazeSession();

    if (storedSessionData) {
      sessionData.action = storedSessionData.action;
      sessionData.difficulty = storedSessionData.difficulty || 0;

      logger.log('Loaded maze session data:', {
        action: sessionData.action,
        difficulty: sessionData.difficulty
      });
      logger.log('Action loaded from storage:', sessionData.action);

      // Note: Session data will be cleared when maze is completed, not on load
    } else {
      logger.warn('No maze session data found, using defaults');
      logger.log('Setting action to null (default)');
      // Set defaults
      sessionData.action = null;
      sessionData.difficulty = 0;
    }
  } catch (error) {
    logger.error('Error loading maze session data:', error);
    // Use safe defaults
    sessionData.action = null;
    sessionData.difficulty = 0;
  }

  return sessionData;
}

/**
 * Clear maze session after completion
 */
export async function clearMazeSession() {
  try {
    const store = usageDataStore();
    await store.clearMazeSession();
    logger.log('Cleared maze session after completion');
  } catch (error) {
    logger.error('Failed to clear maze session:', error);
  }
}


/**
 * Get current session action
 */
export function getSessionAction() {
  return sessionData.action;
}

/**
 * Get current session difficulty
 */
export function getSessionDifficulty() {
  return sessionData.difficulty;
}

/**
 * Initialize session management system
 * Returns a promise that resolves to session data
 */
export async function initializeSession() {
  // Load session data first
  const data = await loadMazeSessionData();

  // Check if this is a completed session
  const isCompleted = await isCompletedMazeSession();

  return {
    action: data.action,
    difficulty: data.difficulty,
    isCompleted
  };
}
