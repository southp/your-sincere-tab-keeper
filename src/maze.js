/**
 * Your Sincere Tab Keeper - Maze Game
 * A challenging maze game with Chrome Dino aesthetic
 */

import { initializeI18n, getI18nMessage } from './ui-utils.js';
import { Logger } from './debug.js';
import { isDevelopment } from './env.js';
import { WALL } from './maze/maze-model.js';
import { getCellSize } from './maze/maze-renderer.js';
import {
  getSessionAction,
  getSessionDifficulty,
  initializeSession
} from './maze/maze-session.js';
import {
  initializeUI,
  showCompletedMazeMessage,
  loadStats,
  resetTimer as resetUITimer
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

// Difficulty settings - streamlined progression
// Note: All sizes must be odd for proper maze generation algorithm
function getDifficultySettings() {
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


// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize internationalization
  initializeI18n();

  // Initialize UI system
  initializeUI();

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
      console.log(`✅ Set difficulty to: ${result.settings.name} (${result.settings.size}x${result.settings.size})`);
      return result;
    },

    // Maze completion helpers
    finishMaze: () => {
      mazeLogger.log('🏁 Force finishing maze...');
      handleMazeComplete();
    },

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
        return;
      }

      console.log(`🗺️ Path to goal (${path.length} steps):`, path);

      const gameState = getGameState();
      if (!gameState.canvas) {
        console.error('❌ No canvas available for highlighting');
        return path;
      }

      // Visual highlight on canvas
      const pathCtx = gameState.canvas.getContext('2d');
      pathCtx.strokeStyle = '#ffff00';
      pathCtx.lineWidth = 3;
      pathCtx.beginPath();

      for (let i = 0; i < path.length - 1; i++) {
        const from = path[i];
        const to = path[i + 1];

        const cellSize = getCellSize();
        pathCtx.moveTo(
          from.x * cellSize + cellSize / 2,
          from.y * cellSize + cellSize / 2
        );
        pathCtx.lineTo(
          to.x * cellSize + cellSize / 2,
          to.y * cellSize + cellSize / 2
        );
      }
      pathCtx.stroke();

      return path;
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
  debugMaze.setDifficulty(0-5)     - Set difficulty (0=Beginner, 5=Master)
  debugMaze.currentDifficulty()    - Get current difficulty level

Maze Completion:
  debugMaze.finishMaze()           - Force finish maze (triggers completion)
  debugMaze.solveInstantly()       - Teleport to goal and finish

Maze Inspection:
  debugMaze.mazeModel              - Direct access to maze model
  debugMaze.gameState()            - Get current game state
  debugMaze.getMazeGrid()          - Get maze grid (2D array)
  debugMaze.getPlayerPos()         - Get player position {x, y}
  debugMaze.getGoalPos()           - Get goal position {x, y}

Pathfinding & Hints:
  debugMaze.findPath()             - Find solution path to goal
  debugMaze.highlightPath()        - Visually highlight solution path

Visual & Testing:
  debugMaze.rerender()             - Re-render maze canvas
  debugMaze.regenerate()           - Generate new maze (same difficulty)
  debugMaze.resetTimer()           - Reset timer to current time

Utilities:
  debugMaze.help()                 - Show this help message

Example Usage:
  debugMaze.setDifficulty(3)       // Set to Hard difficulty
  debugMaze.highlightPath()        // Show solution
  debugMaze.solveInstantly()       // Skip to completion
      `);
    }
  };

  // Show initial help message
  setTimeout(() => {
    console.log('🧩 Maze debugging utilities loaded! Type debugMaze.help() for usage.');
  }, 1000);
}

