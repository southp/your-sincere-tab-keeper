/**
 * Your Sincere Tab Keeper - Maze Game
 * A challenging maze game with Chrome Dino aesthetic
 */

import { TAB_LIMITS } from './constants.js';
import { renderLimitButtons, setupLimitButtonListeners, updateLimitDescription, initializeI18n, getI18nMessage } from './ui-utils.js';
import { Logger } from './debug.js';
import { MazeModel, WALL, PATH, GOAL } from './maze-model.js';
import { getRandomTip } from './productivity-tips.js';
import { isDevelopment } from './env.js';
import { usageDataStore } from './usage-data-store.js';
import { 
  celebrationState, 
  wallPushingState, 
  idleState,
  IDLE_CONFIG,
  startCelebration,
  updateCelebration,
  getPlayerHopOffset,
  updateWallPushing,
  handleWallPushingRelease,
  updateSweat,
  updateIdleBehavior,
  isBlinking,
  resetIdleState
} from './maze-game/maze-effects.js';
import { 
  playerVisualPos,
  eyeDirection,
  lastMovementDirection,
  PLAYER_COLORS,
  initializePlayer,
  canMoveTo,
  updateEyeDirection,
  renderPlayer
} from './maze-game/maze-player.js';
import { 
  movementState,
  currentVelocity,
  isMoving,
  MOVEMENT_CONFIG,
  setupEventListeners,
  updateMovement,
  movePlayer as movePlayerInput
} from './maze-game/maze-input.js';
import { 
  ambientAnimationTime,
  startAnimationLoop,
  stopAnimationLoop,
  createAnimateFunction,
  getFlagWaveOffset,
  setupAnimationCleanup,
  resetAnimationTiming
} from './maze-game/maze-animation.js';
import { 
  initializeRenderer,
  getCellSize,
  updateCanvasSize,
  createRenderMazeFunction,
  getCanvasContext
} from './maze-game/maze-renderer.js';
import { 
  clearMazeSession,
  getSessionAction,
  getSessionDifficulty,
  initializeSession
} from './maze-game/maze-session.js';

// Create scoped logger for maze functionality
const mazeLogger = new Logger('MAZE-GAME');

// Game state
let mazeModel = new MazeModel();
let canvas, ctx;
let gameStartTime;
let timerInterval;
let currentDifficulty = 0;
let isHandlingCompletion = false; // Prevent multiple completion handlers
const isHandlingCompletionRef = { current: false }; // Reference for animation system

// Animation system now imported from maze-animation.js

// Movement configuration is now imported from maze-input.js

// Session data will be managed by maze-session.js module

// DOM elements
const difficultyLevelEl = document.getElementById('difficultyLevel');
const mazeSizeEl = document.getElementById('mazeSize');
const timerEl = document.getElementById('timer');
const challengeMessageEl = document.getElementById('challengeMessage');
const motivationMessageEl = document.getElementById('motivationMessage');
const dailyMazesEl = document.getElementById('dailyMazes');
const totalMazesEl = document.getElementById('totalMazes');
const mazeOverlay = document.getElementById('mazeOverlay');

// Colors (Chrome Dino inspired)
const COLORS = {
  wall: '#535353',
  path: '#f7f7f7',
  player: PLAYER_COLORS.player,
  goal: '#4ecdc4',
  background: '#2a2a2a',
  border: '#666'
};

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

// Motivational messages
function getMotivationMessages() {
  return [
    getI18nMessage('motivation1'),
    getI18nMessage('motivation2'),
    getI18nMessage('motivation3'),
    getI18nMessage('motivation4'),
    getI18nMessage('motivation5'),
    getI18nMessage('motivation6'),
    getI18nMessage('motivation7'),
    getI18nMessage('motivation8')
  ];
}


/**
 * Show completed maze message instead of the game
 */
function showCompletedMazeMessage() {
  // Hide the normal maze interface
  document.querySelector('.maze-container').style.display = 'none';

  // Show the completed maze message
  document.getElementById('completedMazeMessage').style.display = 'flex';
}


// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize internationalization
  initializeI18n();

  // Initialize session management and check completion status
  const sessionInfo = await initializeSession(mazeLogger);
  
  if (sessionInfo.isCompleted) {
    showCompletedMazeMessage();
    return; // Don't initialize the game
  }

  await initializeGame(sessionInfo);
  setupEventListeners();
  await loadStats();

  // Setup development debugging utilities
  setupMazeDebugUtilities();

  // Note: Challenge message and theme will be set after difficulty is loaded
});



/**
 * Initialize the maze game
 */
async function initializeGame(sessionInfo) {
  canvas = document.getElementById('mazeCanvas');
  
  // Initialize the renderer
  const rendererResult = initializeRenderer(canvas);
  ctx = rendererResult.ctx;

  // Use difficulty from session data (single source of truth)
  const difficultySettings = getDifficultySettings();
  currentDifficulty = Math.min(sessionInfo.difficulty, difficultySettings.length - 1);
  const currentDifficultySettings = difficultySettings[currentDifficulty];

  mazeLogger.log('Using difficulty from session data:', {
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

  // Update UI
  difficultyLevelEl.textContent = currentDifficultySettings.name;
  mazeSizeEl.textContent = `${mazeModel.size}x${mazeModel.size}`;

  // Set challenge message based on action and difficulty level
  if (sessionInfo.action === 'updateLimit') {
    challengeMessageEl.setAttribute('data-i18n', 'solveMazeToUpdateLimit');
    challengeMessageEl.textContent = getI18nMessage('solveMazeToUpdateLimit');
  } else {
    // Set challenge message based on difficulty level
    if (currentDifficulty === 6) { // Insane level
      challengeMessageEl.setAttribute('data-i18n', 'solveMazeToOpenInsane');
      challengeMessageEl.textContent = getI18nMessage('solveMazeToOpenInsane');
    } else {
      challengeMessageEl.setAttribute('data-i18n', 'solveMazeToOpen');
      challengeMessageEl.textContent = getI18nMessage('solveMazeToOpen');
    }
  }

  // Apply inferno theme for insane difficulty
  if (currentDifficulty === 6) { // Insane level
    document.body.classList.add('inferno-theme');
  } else {
    document.body.classList.remove('inferno-theme');
  }

  // Start timer
  gameStartTime = Date.now();
  startTimer();

  // Set random motivation message
  const motivationMessages = getMotivationMessages();
  const randomMessage = motivationMessages[Math.floor(Math.random() * motivationMessages.length)];
  motivationMessageEl.textContent = randomMessage;

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
    eyeDirection,
    startCelebration,
    isHandlingCompletionRef
  );

  // Start animation loop for smooth movement
  startAnimationLoop(animate);
}



/**
 * Animation loop for smooth movement and rendering
 */
// animate function moved to maze-animation.js

// updateMovement function moved to maze-input.js
/*
Duplicate updateMovement function removed - now imported from maze-input.js
function removeThisLater(deltaTime) {
  if (!deltaTime || deltaTime > 100) return; // Skip large time jumps or pauses

  const dt = deltaTime / 1000; // Convert to seconds
  const currentTime = performance.now();

  // Skip update if delta time is too small to prevent floating point precision issues
  if (dt < 0.001) return;

  // Stop all movement during celebration
  if (celebrationState.active) {
    currentVelocity.x = 0;
    currentVelocity.y = 0;
    isMoving = false;
    return;
  }

  // Calculate intended movement direction
  let intendedVelocity = { x: 0, y: 0 };
  let anyKeyPressed = false;

  // Check each direction and calculate velocity with acceleration
  Object.keys(movementState).forEach(direction => {
    const state = movementState[direction];
    if (!state.pressed) return;

    anyKeyPressed = true;
    const timeHeld = currentTime - state.timePressed;
    let speed = MOVEMENT_CONFIG.baseSpeed;

    // Apply smooth acceleration after initial delay
    if (timeHeld > MOVEMENT_CONFIG.keyRepeatDelay) {
      const accelerationTime = (timeHeld - MOVEMENT_CONFIG.keyRepeatDelay) / 1000;
      speed = Math.min(
        MOVEMENT_CONFIG.maxSpeed,
        MOVEMENT_CONFIG.baseSpeed + (MOVEMENT_CONFIG.acceleration * accelerationTime)
      );
    }

    // Apply direction
    switch (direction) {
      case 'up': intendedVelocity.y = -speed; break;
      case 'down': intendedVelocity.y = speed; break;
      case 'left': intendedVelocity.x = -speed; break;
      case 'right': intendedVelocity.x = speed; break;
    }
  });

  // Handle diagonal movement (normalize)
  if (intendedVelocity.x !== 0 && intendedVelocity.y !== 0) {
    const magnitude = Math.sqrt(intendedVelocity.x ** 2 + intendedVelocity.y ** 2);
    intendedVelocity.x = (intendedVelocity.x / magnitude) * Math.abs(intendedVelocity.x);
    intendedVelocity.y = (intendedVelocity.y / magnitude) * Math.abs(intendedVelocity.y);
  }

  // Smooth velocity changes
  if (anyKeyPressed) {
    currentVelocity.x = intendedVelocity.x;
    currentVelocity.y = intendedVelocity.y;
    isMoving = true;

    // Reset idle state when moving
    resetIdleState();

    // Update eye direction based on movement
    updateEyeDirection(intendedVelocity, dt);
  } else {
    currentVelocity.x = 0;
    currentVelocity.y = 0;
    isMoving = false;

    // Handle wall pushing release (easter egg)
    handleWallPushingRelease(currentTime);

    // Also reset wall pushing state when not moving
    updateWallPushing(currentTime, { x: 0, y: 0 }, false);

    // Update idle behavior
    updateIdleBehavior(currentTime, dt, playerVisualPos, eyeDirection);
  }

  // Update visual position with precise collision detection
  if (isMoving) {
    // Store previous position for wall pushing detection
    const prevX = playerVisualPos.x;
    const prevY = playerVisualPos.y;

    let newVisualX = playerVisualPos.x + (currentVelocity.x * dt);
    let newVisualY = playerVisualPos.y + (currentVelocity.y * dt);

    // Check X-axis movement separately to allow sliding along walls
    const targetLogicalX = Math.round(newVisualX);
    if (canMoveTo(targetLogicalX, Math.round(playerVisualPos.y), mazeModel, WALL)) {
      // Check if we're not going too far beyond the cell boundary
      const cellCenterX = Math.round(playerVisualPos.x);
      const maxDistance = 0.1; // Allow only 10% deviation from cell center

      if (Math.abs(newVisualX - cellCenterX) <= maxDistance ||
          canMoveTo(Math.floor(newVisualX), Math.round(playerVisualPos.y), mazeModel, WALL) &&
          canMoveTo(Math.ceil(newVisualX), Math.round(playerVisualPos.y), mazeModel, WALL)) {
        playerVisualPos.x = newVisualX;
      } else {
        // Stop at the boundary
        playerVisualPos.x = cellCenterX + Math.sign(newVisualX - cellCenterX) * maxDistance;
      }
    }

    // Check Y-axis movement separately to allow sliding along walls
    const targetLogicalY = Math.round(newVisualY);
    if (canMoveTo(Math.round(playerVisualPos.x), targetLogicalY, mazeModel, WALL)) {
      // Check if we're not going too far beyond the cell boundary
      const cellCenterY = Math.round(playerVisualPos.y);
      const maxDistance = 0.1; // Allow only 10% deviation from cell center

      if (Math.abs(newVisualY - cellCenterY) <= maxDistance ||
          canMoveTo(Math.round(playerVisualPos.x), Math.floor(newVisualY), mazeModel, WALL) &&
          canMoveTo(Math.round(playerVisualPos.x), Math.ceil(newVisualY), mazeModel, WALL)) {
        playerVisualPos.y = newVisualY;
      } else {
        // Stop at the boundary
        playerVisualPos.y = cellCenterY + Math.sign(newVisualY - cellCenterY) * maxDistance;
      }
    }

    // Check for wall pushing (easter egg)
    const positionChanged = Math.abs(playerVisualPos.x - prevX) > 0.001 ||
                           Math.abs(playerVisualPos.y - prevY) > 0.001;
    updateWallPushing(currentTime, intendedVelocity, positionChanged);

    // Check for goal completion - trigger when avatar center is close to goal center
    const distanceToGoal = Math.sqrt(
      Math.pow(playerVisualPos.x - mazeModel.goalPos.x, 2) +
      Math.pow(playerVisualPos.y - mazeModel.goalPos.y, 2)
    );

    if (distanceToGoal < 0.3 && !celebrationState.active && !isHandlingCompletion) {
      // Goal reached! Trigger celebration immediately
      startCelebration(mazeModel.goalPos);

      // Update logical position to goal for consistency
      mazeModel.playerPos.x = mazeModel.goalPos.x;
      mazeModel.playerPos.y = mazeModel.goalPos.y;
      playerVisualPos.x = mazeModel.goalPos.x;
      playerVisualPos.y = mazeModel.goalPos.y;

      // Delay completion to show celebration animation
      setTimeout(() => {
        handleMazeComplete();
      }, celebrationState.duration);
    } else {
      // Update logical position if we've moved to a new cell (for normal movement)
      const currentLogicalX = Math.round(playerVisualPos.x);
      const currentLogicalY = Math.round(playerVisualPos.y);

      if (currentLogicalX !== mazeModel.playerPos.x || currentLogicalY !== mazeModel.playerPos.y) {
        // Double-check that the logical position is valid
        if (canMoveTo(currentLogicalX, currentLogicalY, mazeModel, WALL)) {
          mazeModel.movePlayer(
            currentLogicalX - mazeModel.playerPos.x,
            currentLogicalY - mazeModel.playerPos.y
          );
        }
      }
    }
  }
}
*/

// getFlagWaveOffset function moved to maze-animation.js

/**
 * Handle player movement (legacy function - now just triggers movement state)
 */
// movePlayer function moved to maze-input.js as movePlayerInput

/**
 * Show completion message with productivity tip
 */
function showCompletionMessage() {
  const tip = getRandomTip();

  // Update the overlay content with the productivity tip
  const overlayContent = document.querySelector('#mazeOverlay .overlay-content');
  overlayContent.innerHTML = `
    <div class="success-icon">🎉</div>
    <h3>${getI18nMessage('congratulations')}</h3>
    <p class="completion-message">${getI18nMessage('mazeCompletionWithTip')}</p>
    <div class="productivity-tip">
      <h4>💡 ${tip.title}</h4>
      <p>${tip.message}</p>
    </div>
    <div class="loading-spinner"></div>
  `;

  mazeOverlay.style.display = 'flex';
}

/**
 * Handle maze completion
 */
async function handleMazeComplete() {
  if (isHandlingCompletion) return; // Prevent multiple completion handlers

  isHandlingCompletion = true;
  isHandlingCompletionRef.current = true;
  stopTimer();

  // Stop animation loop
  stopAnimationLoop();

  // Show completion overlay with productivity tip and send completion message
  // Note: TabManager will mark the maze as completed when it receives the MAZE_COMPLETED message
  showCompletionMessage();
  await sendMazeCompletionMessage();

  // Clear the maze session now that it's completed
  await clearMazeSession(mazeLogger);
}

/**
 * Send maze completion message
 */
async function sendMazeCompletionMessage() {
  try {
    mazeLogger.log('Sending maze completion message...');

    await chrome.runtime.sendMessage({
      type: 'MAZE_COMPLETED',
      data: {
        difficulty: currentDifficulty,
        time: mazeModel.getElapsedTime(),
        size: mazeModel.size,
        action: getSessionAction()
      }
    });

    mazeLogger.log('Maze completion message sent successfully');

    // Handle different completion types
    if (getSessionAction() === 'updateLimit') {
      // Extended delay to show productivity tip, then show limit update modal
      setTimeout(async () => {
        mazeOverlay.style.display = 'none';
        await showUpdateLimitModal();
      }, 5000);
    } else {
      // Normal maze completion - show tip for 5 seconds, then background will handle URL loading
      mazeLogger.log('Normal maze completion - showing productivity tip for 5 seconds');
      // Note: Background script will wait for this delay before redirecting
    }

  } catch (error) {
    mazeLogger.error('Error sending maze completion message:', error);
  }
}


/**
 * Show the update limit modal
 */
async function showUpdateLimitModal() {
  const modal = document.getElementById('updateLimitModal');
  if (!modal) {
    mazeLogger.error('Update limit modal not found');
    return;
  }

  // Set up the limit selector BEFORE showing the modal to prevent flash
  await setupLimitSelector();
  modal.style.display = 'flex';
}

/**
 * Setup limit selector in modal
 */
async function setupLimitSelector() {
  // Get current tab limit from background script
  let currentLimit = TAB_LIMITS.DEFAULT; // Default fallback
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    if (response && !response.error) {
      currentLimit = response.tabLimit || TAB_LIMITS.DEFAULT;
    }
  } catch (error) {
    mazeLogger.error('Failed to get current tab limit:', error);
  }

  let selectedLimit = currentLimit;

  // Generate buttons dynamically with current limit selected and highlighted
  renderLimitButtons('limitOptions', currentLimit, currentLimit);

  // Query elements fresh from the modal
  const modalLimitDesc = document.getElementById('modalLimitDescription');
  const confirmBtn = document.getElementById('confirmLimitBtn');
  const cancelBtn = document.getElementById('cancelLimitBtn');

  if (!modalLimitDesc || !confirmBtn || !cancelBtn) {
    mazeLogger.error('Modal elements not found');
    return;
  }

  // Function to update confirm button state
  const updateConfirmButton = (newSelectedLimit) => {
    const isUnchanged = newSelectedLimit === currentLimit;
    confirmBtn.disabled = isUnchanged;
    confirmBtn.textContent = isUnchanged ?
      getI18nMessage('currentLimitSelected') :
      getI18nMessage('setLimitTo', [newSelectedLimit.toString()]);
  };

  // Set up button event listeners using shared utility
  setupLimitButtonListeners('#limitOptions', (limit) => {
    selectedLimit = limit;
    updateLimitDescription('modalLimitDescription', limit);
    updateConfirmButton(limit);
  });

  // Set initial description and confirm button state
  updateLimitDescription('modalLimitDescription', selectedLimit);
  updateConfirmButton(selectedLimit);

  // Confirm button handler
  confirmBtn.addEventListener('click', async () => {
    try {
      confirmBtn.classList.add('loading');
      confirmBtn.disabled = true;

      // Send new limit to background
      await chrome.runtime.sendMessage({
        type: 'UPDATE_TAB_LIMIT',
        limit: selectedLimit
      });

      // Show success message
      const modal = document.getElementById('updateLimitModal');
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2>🎯 Tab Limit Updated!</h2>
            <p>Your new tab limit is set to ${selectedLimit}.</p>
            <p style="margin-top: 16px;">If you had more tabs open than your new limit, excess tabs have been automatically closed to keep your newest ones.</p>
          </div>
          <div class="modal-actions">
            <button id="okBtn" class="primary-btn">
              OK
            </button>
          </div>
        </div>
      `;

      // Add event listener to the OK button
      const okBtn = document.getElementById('okBtn');
      okBtn.addEventListener('click', () => {
        // Navigate current tab to options page instead of opening new tab
        window.location.href = chrome.runtime.getURL('src/options.html');
      });

    } catch (error) {
      mazeLogger.error('Error updating tab limit:', error);
      // eslint-disable-next-line no-alert
      alert(getI18nMessage('failedToUpdateTabLimit')); // Intentional: User needs immediate error feedback
    } finally {
      confirmBtn.classList.remove('loading');
      confirmBtn.disabled = false;
    }
  });

  // Cancel button handler
  cancelBtn.addEventListener('click', () => {
    window.close();
  });
}

/**
 * Start the game timer
 */
function startTimer() {
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - gameStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, 1000);
}

/**
 * Stop the game timer
 */
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

/**
 * Load and display statistics
 */
async function loadStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });

    if (response && !response.error) {
      dailyMazesEl.textContent = response.dailyMazesCompleted || 0;
      totalMazesEl.textContent = response.mazesCompleted || 0;
    }
  } catch (error) {
    mazeLogger.error('Error loading stats:', error);
  }
}

/**
 * Setup event listeners with smooth movement support
 */
// setupEventListeners function moved to maze-input.js

// Prevent context menu on canvas
canvas?.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

// Focus handling
window.addEventListener('focus', () => {
  // Refresh stats when tab gains focus
  loadStats();
});

// Setup animation cleanup on page unload
setupAnimationCleanup();

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
    // Core maze inspection
    mazeModel: mazeModel,
    currentDifficulty: () => currentDifficulty,
    gameState: () => ({
      gameStartTime,
      cellSize: getCellSize(),
      isHandlingCompletion,
      action: getSessionAction(),
      difficulty: getSessionDifficulty()
    }),

    // Difficulty manipulation
    setDifficulty: (newDifficulty) => {
      const allDifficultySettings = getDifficultySettings();
      if (newDifficulty < 0 || newDifficulty >= allDifficultySettings.length) {
        console.error(`❌ Invalid difficulty. Must be 0-${allDifficultySettings.length - 1}`);
        return;
      }

      currentDifficulty = newDifficulty;
      const difficultySettings = allDifficultySettings[currentDifficulty];

      // Regenerate maze with new difficulty
      mazeModel.initialize(difficultySettings);
      updateCanvasSize();
      renderMaze(mazeModel);

      // Update UI
      difficultyLevelEl.textContent = difficultySettings.name;
      mazeSizeEl.textContent = `${mazeModel.size}x${mazeModel.size}`;

      mazeLogger.log(`🎯 Set difficulty to ${currentDifficulty} (${difficultySettings.name})`);
    },

    // Maze completion helpers
    finishMaze: () => {
      mazeLogger.log('🏁 Force finishing maze...');
      handleMazeComplete();
    },

    solveInstantly: () => {
      // Move player to goal position
      mazeModel.playerPos.x = mazeModel.goalPos.x;
      mazeModel.playerPos.y = mazeModel.goalPos.y;
      renderMaze(mazeModel);

      mazeLogger.log('✨ Teleported player to goal');

      // Trigger completion
      setTimeout(() => {
        handleMazeComplete();
      }, 500);
    },

    // Maze inspection utilities
    getMazeGrid: () => mazeModel.grid,
    getPlayerPos: () => ({ ...mazeModel.playerPos }),
    getGoalPos: () => ({ ...mazeModel.goalPos }),
    getMazeSize: () => mazeModel.size,

    // Path finding helpers
    findPath: () => {
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

      // Visual highlight on canvas
      const pathCtx = canvas.getContext('2d');
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
      gameStartTime = Date.now();
      mazeLogger.log('⏱️ Reset timer');
    },

    // Render helpers
    rerender: () => {
      renderMaze(mazeModel);
      mazeLogger.log('🎨 Re-rendered maze');
    },

    regenerate: () => {
      const difficultySettings = getDifficultySettings()[currentDifficulty];
      mazeModel.initialize(difficultySettings);
      updateCanvasSize();
      renderMaze(mazeModel);
      mazeLogger.log('🔄 Regenerated maze');
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

