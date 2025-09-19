/**
 * Your Sincere Tab Keeper - Maze Game
 * A challenging maze game with Chrome Dino aesthetic
 */

import { initializeI18n, getDifficultySettings, getI18nMessage } from './ui-utils.js';
import { Logger } from './debug.js';
import { isDevelopment } from './env.js';
import { WALL } from './maze/maze-model.js';
import { setDebugHighlightedPath, clearDebugHighlightedPath } from './maze/maze-renderer.js';
import {
  getSessionAction,
  getSessionDifficulty,
  initializeSession
} from './maze/maze-session.js';
import {
  initializeUI,
  showCompletedMazeMessage,
  loadStats,
  resetTimer as resetUITimer,
  updateGameUI
} from './maze/maze-ui.js';
import {
  initializeGame,
  handleMazeComplete,
  setupGameEventListeners,
  getGameState,
  regenerateMaze,
  rerenderMaze,
  updateGameStartTime,
  setGameDifficulty
} from './maze/maze-game.js';

// Create scoped logger for maze functionality
const mazeLogger = new Logger('MAZE-GAME');

// All game state, animation, movement, session data, and UI management
// is now handled by their respective modules in maze/

// Difficulty settings are now centralized in constants.js


// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize internationalization
  initializeI18n();

  // Initialize UI system
  initializeUI();

  // Set up message listener for conscious closure notifications
  setupMessageListener();

  // Initialize session management and check completion status
  const sessionInfo = await initializeSession();

  if (sessionInfo.isCompleted) {
    showCompletedMazeMessage();
    return; // Don't initialize the game
  }

  initializeGame(sessionInfo, getDifficultySettings());
  setupGameEventListeners();
  await loadStats();

  // Focus handling for stats refresh
  window.addEventListener('focus', () => {
    loadStats(mazeLogger);
  });

  // Setup development debugging utilities
  setupMazeDebugUtilities();

  // Note: Challenge message and theme will be set after difficulty is loaded
});


/**
 * Animation loop for smooth movement and rendering
 */
// animate function moved to maze-animation.js

// updateMovement function moved to maze-input.js

// getFlagWaveOffset function moved to maze-animation.js

/**
 * Handle player movement (legacy function - now just triggers movement state)
 */
// movePlayer function moved to maze-input.js as movePlayerInput


/**
 * Setup event listeners with smooth movement support
 */
// setupEventListeners function moved to maze-input.js

// Event listeners are now handled by the game controller

/**
 * Setup message listener for conscious closure notifications
 */
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    if (message.type === 'CONSCIOUS_CLOSURE_DETECTED') {
      mazeLogger.log('🎉 Received conscious closure notification:', message.data);
      handleConsciousClosureDetected(message.data);
    } else if (message.type === 'NAVIGATION_BLOCKED') {
      mazeLogger.log('🚫 Received navigation blocked notification:', message.data);
      handleNavigationBlocked(message.data);
    }
  });
}

/**
 * Handle conscious closure detection
 */
function handleConsciousClosureDetected(_data) {
  try {
    mazeLogger.log('🚀 Processing conscious closure - showing celebration dialog');

    // Update tab title to indicate unblocking
    document.title = getI18nMessage('consciousClosureTabTitle');

    // Show celebration dialog using existing maze completion UI
    showConsciousClosureDialog();

    // Start redirect countdown
    setTimeout(async () => {
      await sendConsciousClosureCompletedMessage();
    }, 5000); // 5 second delay to match existing completion flow

  } catch (error) {
    mazeLogger.error('Error handling conscious closure detection:', error);
  }
}

/**
 * Show conscious closure celebration dialog using existing UI
 */
function showConsciousClosureDialog() {
  // Reuse the existing overlay structure
  const mazeOverlay = document.getElementById('mazeOverlay');
  const overlayContent = document.querySelector('#mazeOverlay .overlay-content');

  if (!mazeOverlay || !overlayContent) {
    mazeLogger.error('Maze overlay elements not found for conscious closure dialog');
    return;
  }

  // Use existing completion dialog structure with conscious closure messages
  overlayContent.innerHTML = `
    <div class="success-icon">🎯</div>
    <h3>${getI18nMessage('consciousClosureTitle')}</h3>
    <p class="completion-message">${getI18nMessage('consciousClosureMessage')}</p>
    <div class="loading-spinner"></div>
  `;

  mazeOverlay.style.display = 'flex';
  mazeLogger.log('✅ Conscious closure celebration dialog displayed');
}

/**
 * Send conscious closure completion message to background
 */
async function sendConsciousClosureCompletedMessage() {
  try {
    mazeLogger.log('Sending conscious closure completion message...');

    await chrome.runtime.sendMessage({
      type: 'CONSCIOUS_CLOSURE_COMPLETED',
      data: {
        action: getSessionAction(),
        timestamp: Date.now()
      }
    });

    mazeLogger.log('✅ Conscious closure completion message sent successfully');

  } catch (error) {
    mazeLogger.error('Error sending conscious closure completion message:', error);
  }
}

/**
 * Handle navigation blocked notification
 */
function handleNavigationBlocked(data) {
  try {
    mazeLogger.log('🚫 Navigation blocked:', data);

    // Update tab title to show feedback
    const originalTitle = document.title;
    document.title = '🚫 Navigation blocked - Complete maze first';

    // Show temporary notification overlay
    showNavigationBlockedNotification(data.blockedUrl);

    // Restore original title after a few seconds
    setTimeout(() => {
      // Only restore if title hasn't been changed by something else
      if (document.title === '🚫 Navigation blocked - Complete maze first') {
        document.title = originalTitle;
      }
    }, 3000);

  } catch (error) {
    mazeLogger.error('Error handling navigation blocked:', error);
  }
}

/**
 * Show temporary notification about blocked navigation
 */
function showNavigationBlockedNotification(blockedUrl) {
  // Create notification overlay
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff6b6b;
    color: white;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
    z-index: 10000;
    font-family: 'Segoe UI', sans-serif;
    font-size: 14px;
    max-width: 300px;
    animation: slideIn 0.3s ease-out;
  `;

  const shortUrl = blockedUrl ? new URL(blockedUrl).hostname : 'that page';
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 18px;">🚫</span>
      <div>
        <div style="font-weight: bold;">Navigation blocked</div>
        <div style="font-size: 12px; opacity: 0.9;">Complete the maze to visit ${shortUrl}</div>
      </div>
    </div>
  `;

  // Add animation keyframes to head
  if (!document.getElementById('navigationBlockedStyles')) {
    const style = document.createElement('style');
    style.id = 'navigationBlockedStyles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);
}

/**
 * Setup maze debugging utilities for development environment
 */
async function setupMazeDebugUtilities() {
  if (!(await isDevelopment())) {
    return; // Only enable in development mode
  }

  mazeLogger.log('🔧 Maze debug utilities enabled for development');

  // Expose maze debugging utilities
  /* eslint-disable no-console */
  globalThis.debugMaze = {
    // Core game state access
    getGameState,
    gameState: () => ({
      ...getGameState(),
      action: getSessionAction(),
      difficulty: getSessionDifficulty()
    }),
    getDifficultySettings,

    // Difficulty manipulation
    setDifficulty: (newDifficulty) => {
      const allDifficultySettings = getDifficultySettings();
      if (newDifficulty < 0 || newDifficulty >= allDifficultySettings.length) {
        console.error(`❌ Invalid difficulty. Must be 0-${allDifficultySettings.length - 1}`);
        return;
      }

      const result = setGameDifficulty(newDifficulty, allDifficultySettings);

      // Update UI elements (inferno theme, tagline, etc.)
      updateGameUI(result.settings, result.mazeModel.size, getSessionAction(), newDifficulty);
      console.log(`✅ Set difficulty to: ${result.settings.name} (${result.settings.size}x${result.settings.size})`);
      return result;
    },

    getCurrentDifficulty: () => {
      const gameState = getGameState();
      return gameState.currentDifficulty;
    },

    // Maze completion helpers
    solveInstantly: () => {
      const gameState = getGameState();
      if (!gameState.mazeModel) {
        console.error('❌ No maze model available');
        return;
      }

      // Move player to goal position
      gameState.mazeModel.playerPos.x = gameState.mazeModel.goalPos.x;
      gameState.mazeModel.playerPos.y = gameState.mazeModel.goalPos.y;

      mazeLogger.log('✨ Teleported player to goal');

      // Trigger completion after a short delay
      setTimeout(() => {
        handleMazeComplete();
      }, 500);
    },

    // Maze inspection utilities (using game state)
    getMazeGrid: () => {
      const gameState = getGameState();
      return gameState.mazeModel ? gameState.mazeModel.grid : null;
    },
    getPlayerPos: () => {
      const gameState = getGameState();
      return gameState.mazeModel ? { ...gameState.mazeModel.playerPos } : null;
    },
    getGoalPos: () => {
      const gameState = getGameState();
      return gameState.mazeModel ? { ...gameState.mazeModel.goalPos } : null;
    },
    getMazeSize: () => {
      const gameState = getGameState();
      return gameState.mazeModel ? gameState.mazeModel.size : null;
    },

    // Path finding helpers
    findPath: () => {
      const gameState = getGameState();
      if (!gameState.mazeModel) {
        console.error('❌ No maze model available');
        return null;
      }

      const { mazeModel } = gameState;

      // Simple pathfinding to show solution
      const visited = new Set();
      const queue = [{ ...mazeModel.playerPos, path: [{ ...mazeModel.playerPos }] }];

      while (queue.length > 0) {
        const { x, y, path: currentPath } = queue.shift();
        const key = `${x},${y}`;

        if (visited.has(key)) continue;
        visited.add(key);

        if (x === mazeModel.goalPos.x && y === mazeModel.goalPos.y) {
          return currentPath;
        }

        // Check all 4 directions
        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        for (const [dx, dy] of directions) {
          const newX = x + dx;
          const newY = y + dy;

          if (newX >= 0 && newX < mazeModel.size &&
              newY >= 0 && newY < mazeModel.size &&
              mazeModel.grid[newY][newX] !== WALL) {
            queue.push({
              x: newX,
              y: newY,
              path: [...currentPath, { x: newX, y: newY }]
            });
          }
        }
      }
      return null; // No path found
    },

    // Visual helpers
    highlightPath: () => {
      const path = globalThis.debugMaze.findPath();
      if (!path) {
        console.log('❌ No path found to goal');
        return null;
      }

      console.log(`🗺️ Path to goal (${path.length} steps):`, path);

      // Set the path to be highlighted during rendering
      setDebugHighlightedPath(path);

      // Force a re-render to show the highlight immediately
      rerenderMaze();

      console.log('✨ Path highlighted! Call debugMaze.clearHighlight() to remove it.');
      return path;
    },

    // Clear path highlighting
    clearHighlight: () => {
      clearDebugHighlightedPath();
      rerenderMaze();
      console.log('🧹 Path highlight cleared');
    },

    // Timer manipulation
    resetTimer: () => {
      const newStartTime = updateGameStartTime();
      resetUITimer(newStartTime);
      mazeLogger.log('⏱️ Reset timer');
      return newStartTime;
    },

    // Render helpers
    rerender: () => {
      rerenderMaze();
      mazeLogger.log('🎨 Re-rendered maze');
    },

    regenerate: () => {
      const gameState = getGameState();
      if (!gameState.mazeModel) {
        console.error('❌ No maze model available');
        return;
      }

      const result = regenerateMaze();
      mazeLogger.log('🔄 Regenerated maze');
      return result;
    },

    // Help function
    help: () => {
      console.log(`
🧩 Maze Debug Utilities
=======================

Difficulty Control:
  debugMaze.setDifficulty(0-6)     - Set difficulty (0=Beginner, 6=Insane)
  debugMaze.getCurrentDifficulty() - Get current difficulty level

Maze Completion:
  debugMaze.solveInstantly()       - Teleport to goal and finish

Maze Inspection:
  debugMaze.gameState()            - Get current game state
  debugMaze.getMazeGrid()          - Get maze grid (2D array)
  debugMaze.getPlayerPos()         - Get player position {x, y}
  debugMaze.getGoalPos()           - Get goal position {x, y}

Pathfinding & Hints:
  debugMaze.findPath()             - Find solution path to goal
  debugMaze.highlightPath()        - Visually highlight solution path
  debugMaze.clearHighlight()       - Clear path highlighting

Visual & Testing:
  debugMaze.rerender()             - Re-render maze canvas
  debugMaze.regenerate()           - Generate new maze (same difficulty)
  debugMaze.resetTimer()           - Reset timer to current time

Utilities:
  debugMaze.help()                 - Show this help message

Example Usage:
  debugMaze.setDifficulty(3)       // Set to Hard difficulty
  debugMaze.getCurrentDifficulty() // Check current difficulty
  debugMaze.highlightPath()        // Show solution path
  debugMaze.clearHighlight()       // Clear path highlighting
  debugMaze.solveInstantly()       // Skip to completion
      `);
    }
  };

  // Show initial help message
  setTimeout(() => {
    console.log('🧩 Maze debugging utilities loaded! Type debugMaze.help() for usage.');
  }, 1000);
}

