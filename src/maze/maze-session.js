/**
 * Maze Session Management
 * Handles session persistence, completion tracking, and Chrome extension communication
 */

import { Logger } from '../debug.js';

// Create logger for this module
const logger = new Logger('MAZE-SESSION');

// Direct Chrome storage interface for maze session data
const MAZE_SESSION_KEY = 'currentMazeSession';

// =============================================================================
// MAZE SESSION STORAGE OPERATIONS
// =============================================================================

/**
 * Get current maze session data directly from Chrome session storage
 */
async function getMazeSession() {
  try {
    const result = await chrome.storage.session.get([MAZE_SESSION_KEY]);
    return result[MAZE_SESSION_KEY] || null;
  } catch (error) {
    logger.error('Failed to get maze session:', error);
    return null;
  }
}

/**
 * Set current maze session data directly to Chrome session storage
 */
async function setMazeSession(sessionData) {
  try {
    await chrome.storage.session.set({ [MAZE_SESSION_KEY]: sessionData });
    logger.log('Set maze session data:', sessionData);
  } catch (error) {
    logger.error('Failed to set maze session:', error);
    throw error;
  }
}

/**
 * Clear current maze session data directly from Chrome session storage
 */
async function clearMazeSessionStorage() {
  try {
    await chrome.storage.session.remove([MAZE_SESSION_KEY]);
    logger.log('Cleared maze session data');
  } catch (error) {
    logger.error('Failed to clear maze session:', error);
    throw error;
  }
}

// =============================================================================
// SESSION DATA MANAGEMENT
// =============================================================================

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
 * Load maze session data from Chrome session storage
 */
export async function loadMazeSessionData() {
  try {
    // Try to get existing session data
    const storedSessionData = await getMazeSession();

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
 * Set maze session data (exported for external use)
 */
export async function saveMazeSession(data) {
  try {
    await setMazeSession(data);
    // Also update local session data
    sessionData.action = data.action;
    sessionData.difficulty = data.difficulty || 0;
    logger.log('Saved maze session data:', data);
  } catch (error) {
    logger.error('Failed to save maze session:', error);
    throw error;
  }
}

/**
 * Get maze session data (exported for external use)
 */
export async function getMazeSessionData() {
  try {
    return await getMazeSession();
  } catch (error) {
    logger.error('Failed to get maze session:', error);
    return null;
  }
}

/**
 * Clear maze session after completion or tab close
 */
export async function clearMazeSession() {
  try {
    await clearMazeSessionStorage();
    // Reset local session data as well
    sessionData.action = null;
    sessionData.difficulty = 0;
    logger.log('Cleared maze session');
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

