/**
 * Maze Session Management
 * Handles session persistence, completion tracking, and Chrome extension communication
 */

import { usageDataStore } from '../usage-data-store.js';

// Session data (will be injected by the session system)
export let sessionData = {
  action: null,
  difficulty: 0
};

/**
 * Check if this is a completed maze session that user navigated back to
 */
export async function isCompletedMazeSession(mazeLogger) {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_MAZE_COMPLETED' });
    return response?.isCompleted || false;
  } catch (error) {
    mazeLogger.error('Error checking completed maze session:', error);
    return false;
  }
}

/**
 * Load maze session data from Chrome storage
 */
export async function loadMazeSessionData(mazeLogger) {
  try {
    // Try to get existing session data
    const store = usageDataStore();
    const storedSessionData = await store.getMazeSession();

    if (storedSessionData) {
      sessionData.action = storedSessionData.action;
      sessionData.difficulty = storedSessionData.difficulty || 0;

      mazeLogger.log('Loaded maze session data:', { 
        action: sessionData.action, 
        difficulty: sessionData.difficulty 
      });
      mazeLogger.log('Action loaded from storage:', sessionData.action);

      // Note: Session data will be cleared when maze is completed, not on load
    } else {
      mazeLogger.warn('No maze session data found, using defaults');
      mazeLogger.log('Setting action to null (default)');
      // Set defaults
      sessionData.action = null;
      sessionData.difficulty = 0;
    }
  } catch (error) {
    mazeLogger.error('Error loading maze session data:', error);
    // Use safe defaults
    sessionData.action = null;
    sessionData.difficulty = 0;
  }

  return sessionData;
}

/**
 * Clear maze session after completion
 */
export async function clearMazeSession(mazeLogger) {
  try {
    const store = usageDataStore();
    await store.clearMazeSession();
    mazeLogger.log('Cleared maze session after completion');
  } catch (error) {
    mazeLogger.error('Failed to clear maze session:', error);
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
export async function initializeSession(mazeLogger) {
  // Load session data first
  const data = await loadMazeSessionData(mazeLogger);
  
  // Check if this is a completed session
  const isCompleted = await isCompletedMazeSession(mazeLogger);
  
  return {
    action: data.action,
    difficulty: data.difficulty,
    isCompleted
  };
}