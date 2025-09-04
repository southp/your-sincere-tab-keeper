/**
 * Main Maze Game Controller
 * Coordinates all maze game modules and handles core game lifecycle
 */

import { Logger } from '../debug.js';
import { MazeModel, WALL } from './maze-model.js';
import {
  celebrationState,
  wallPushingState,
  idleState,
  startCelebration,
  updateCelebration,
  getPlayerHopOffset,
  updateWallPushing,
  handleWallPushingRelease,
  updateSweat,
  updateIdleBehavior,
  isBlinking,
  resetIdleState
} from './maze-effects.js';
import {
  playerVisualPos,
  eyeDirection,
  initializePlayer,
  canMoveTo,
  updateEyeDirection,
  renderPlayer
} from './maze-player.js';
import {
  setupEventListeners,
  updateMovement
} from './maze-input.js';
import {
  startAnimationLoop,
  stopAnimationLoop,
  createAnimateFunction,
  getFlagWaveOffset,
  setupAnimationCleanup,
  resetAnimationTiming
} from './maze-animation.js';
import {
  initializeRenderer,
  updateCanvasSize,
  createRenderMazeFunction
} from './maze-renderer.js';
import {
  clearMazeSession,
  getSessionAction
} from './maze-session.js';
import {
  updateGameUI,
  showCompletionMessage,
  startTimer,
  stopTimer,
  showUpdateLimitModal,
  hideCompletionOverlay
} from './maze-ui.js';

// Create logger for this module
const logger = new Logger('MAZE-GAME');

// Game state
let mazeModel = new MazeModel();
let canvas, ctx;
let gameStartTime;
let currentDifficulty = 0;
let isHandlingCompletion = false;
const isHandlingCompletionRef = { current: false };

// Colors (Chrome Dino inspired)
const COLORS = {
  wall: '#535353',
  path: '#f7f7f7',
  player: '#ff6b6b',
  goal: '#4ecdc4',
  background: '#2a2a2a',
  border: '#666'
};

/**
 * Initialize the maze game with session information
 */
export function initializeGame(sessionInfo, difficultySettings) {
  canvas = document.getElementById('mazeCanvas');

  // Initialize the renderer
  const rendererResult = initializeRenderer(canvas);
  ctx = rendererResult.ctx;

  // Use difficulty from session data (single source of truth)
  currentDifficulty = Math.min(sessionInfo.difficulty, difficultySettings.length - 1);
  const currentDifficultySettings = difficultySettings[currentDifficulty];

  logger.log('Using difficulty from session data:', {
    action: sessionInfo.action,
    storedDifficulty: sessionInfo.difficulty,
    finalDifficulty: currentDifficulty
  });

  // Initialize maze model with difficulty settings
  mazeModel.initialize(currentDifficultySettings);
  isHandlingCompletion = false; // Reset completion handler flag

  // Create renderMaze function with all dependencies
  const renderMaze = createRenderMazeFunction(
    COLORS,
    getFlagWaveOffset,
    renderPlayer,
    getPlayerHopOffset,
    celebrationState,
    wallPushingState,
    idleState,
    isBlinking
  );

  // Calculate responsive canvas size after model is initialized
  updateCanvasSize(mazeModel, renderMaze);

  // Add debounced resize listener for responsive updates
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => updateCanvasSize(mazeModel, renderMaze), 100);
  });

  // Update UI with game information
  updateGameUI(currentDifficultySettings, mazeModel.size, sessionInfo.action, currentDifficulty);

  // Start timer
  gameStartTime = Date.now();
  startTimer(gameStartTime);

  // Initialize smooth movement system
  initializePlayer(mazeModel.playerPos);

  // Initialize idle behavior system
  resetIdleState();

  // Initial render
  renderMaze(mazeModel);

  // Create animation function with all dependencies
  const animate = createAnimateFunction(
    canvas,
    updateMovement,
    updateCelebration,
    updateSweat,
    renderMaze,
    handleMazeComplete,
    // Dependencies
    celebrationState,
    playerVisualPos,
    mazeModel,
    WALL,
    canMoveTo,
    updateWallPushing,
    handleWallPushingRelease,
    resetIdleState,
    updateEyeDirection,
    updateIdleBehavior,
    // Additional dependencies
    eyeDirection,
    startCelebration,
    isHandlingCompletionRef
  );

  // Start animation loop for smooth movement
  startAnimationLoop(animate);

  return {
    mazeModel,
    currentDifficulty,
    gameStartTime
  };
}

/**
 * Handle maze completion
 */
export async function handleMazeComplete() {
  if (isHandlingCompletion) return; // Prevent multiple completion handlers

  isHandlingCompletion = true;
  isHandlingCompletionRef.current = true;
  stopTimer();

  // Stop animation loop
  stopAnimationLoop();

  // Show completion overlay with productivity tip and send completion message
  showCompletionMessage();
  await sendMazeCompletionMessage();

  // Clear the maze session now that it's completed
  await clearMazeSession();
}

/**
 * Send maze completion message with UI handling
 */
export async function sendMazeCompletionMessage() {
  try {
    logger.log('Sending maze completion message...');

    await chrome.runtime.sendMessage({
      type: 'MAZE_COMPLETED',
      data: {
        difficulty: currentDifficulty,
        time: mazeModel.getElapsedTime(),
        size: mazeModel.size,
        action: getSessionAction()
      }
    });

    logger.log('Maze completion message sent successfully');

    // Handle different completion types
    if (getSessionAction() === 'updateLimit') {
      // Extended delay to show productivity tip, then show limit update modal
      setTimeout(async () => {
        hideCompletionOverlay();
        await showUpdateLimitModal();
      }, 5000);
    } else {
      // Normal maze completion - show tip for 5 seconds, then background will handle URL loading
      logger.log('Normal maze completion - showing productivity tip for 5 seconds');
      // Note: Background script will wait for this delay before redirecting
    }

  } catch (error) {
    logger.error('Error sending maze completion message:', error);
  }
}

/**
 * Setup game event listeners
 */
export function setupGameEventListeners() {
  setupEventListeners();

  // Prevent context menu on canvas
  canvas?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });


  // Setup animation cleanup on page unload
  setupAnimationCleanup();
}

/**
 * Get current game state for debugging
 */
export function getGameState() {
  return {
    mazeModel,
    currentDifficulty,
    gameStartTime,
    isHandlingCompletion,
    canvas,
    ctx
  };
}

/**
 * Reset animation timing (useful when starting new games)
 */
export function resetGame() {
  resetAnimationTiming();
  isHandlingCompletion = false;
  isHandlingCompletionRef.current = false;
}

/**
 * Regenerate maze with current difficulty
 */
export function regenerateMaze(difficultySettings) {
  if (!difficultySettings) {
    const gameState = getGameState();
    if (!gameState.mazeModel) return;
    difficultySettings = gameState.mazeModel.getConfig();
  }

  mazeModel.initialize(difficultySettings);

  // Get the current renderMaze function and re-render
  const renderMaze = createRenderMazeFunction(
    COLORS,
    getFlagWaveOffset,
    renderPlayer,
    getPlayerHopOffset,
    celebrationState,
    wallPushingState,
    idleState,
    isBlinking
  );

  renderMaze(mazeModel);

  return mazeModel;
}

/**
 * Re-render the current maze
 */
export function rerenderMaze() {
  const renderMaze = createRenderMazeFunction(
    COLORS,
    getFlagWaveOffset,
    renderPlayer,
    getPlayerHopOffset,
    celebrationState,
    wallPushingState,
    idleState,
    isBlinking
  );

  renderMaze(mazeModel);
}

/**
 * Update game start time (for timer reset)
 */
export function updateGameStartTime(newStartTime = Date.now()) {
  gameStartTime = newStartTime;
  return gameStartTime;
}

/**
 * Set difficulty and reinitialize game
 */
export function setGameDifficulty(newDifficulty, difficultySettings) {
  currentDifficulty = newDifficulty;
  const settings = difficultySettings[newDifficulty];

  // Reinitialize maze with new difficulty
  mazeModel.initialize(settings);

  // Create renderMaze function and update canvas size
  const renderMaze = createRenderMazeFunction(
    COLORS,
    getFlagWaveOffset,
    renderPlayer,
    getPlayerHopOffset,
    celebrationState,
    wallPushingState,
    idleState,
    isBlinking
  );

  // Update canvas size
  updateCanvasSize(mazeModel, renderMaze);

  // Re-render
  renderMaze(mazeModel);

  logger.log(`🎯 Set difficulty to ${newDifficulty} (${settings.name})`);

  return {
    difficulty: newDifficulty,
    settings,
    mazeModel
  };
}
