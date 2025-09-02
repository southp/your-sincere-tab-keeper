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

// Create scoped logger for maze functionality
const mazeLogger = new Logger('MAZE-GAME');

// Game state
let mazeModel = new MazeModel();
let cellSize = 30;
let canvas, ctx;
let gameStartTime;
let timerInterval;
let currentDifficulty = 0;
let isHandlingCompletion = false; // Prevent multiple completion handlers

// Smooth movement system
let animationFrameId = null;
let playerVisualPos = { x: 1, y: 1 }; // Smooth interpolated position for rendering
let movementState = {
  up: { pressed: false, timePressed: 0 },
  down: { pressed: false, timePressed: 0 },
  left: { pressed: false, timePressed: 0 },
  right: { pressed: false, timePressed: 0 }
};
let currentVelocity = { x: 0, y: 0 };
let isMoving = false;
let lastFrameTime = 0;

// Goal celebration animation system
let celebrationState = {
  active: false,
  startTime: 0,
  duration: 2000, // 2 seconds of celebration
  sparkles: []
};

// Movement configuration
const MOVEMENT_CONFIG = {
  baseSpeed: 4.0,          // Base movement speed (cells per second)
  maxSpeed: 16.0,           // Maximum movement speed (cells per second)
  acceleration: 6.0,       // Acceleration rate (cells/s² per second)
  smoothingFactor: 0.85,   // Position interpolation smoothing (0-1)
  keyRepeatDelay: 150      // ms before acceleration starts
};

// Maze session data (will be loaded from storage)
let action = null;
let difficulty = 0;

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
  player: '#ff6b6b',
  goal: '#4ecdc4',
  background: '#2a2a2a',
  border: '#666'
};

// Difficulty settings - streamlined progression
// Note: All sizes must be odd for proper maze generation algorithm
function getDifficultySettings() {
  return [
    { name: getI18nMessage('difficultyBeginner'), size: 5, description: getI18nMessage('difficultyBeginnerDesc') },
    { name: getI18nMessage('difficultyEasy'), size: 9, description: getI18nMessage('difficultyEasyDesc') },
    { name: getI18nMessage('difficultyMedium'), size: 13, description: getI18nMessage('difficultyMediumDesc') },
    { name: getI18nMessage('difficultyHard'), size: 19, description: getI18nMessage('difficultyHardDesc') },
    { name: getI18nMessage('difficultyExpert'), size: 25, description: getI18nMessage('difficultyExpertDesc') },
    { name: getI18nMessage('difficultyMaster'), size: 31, description: getI18nMessage('difficultyMasterDesc') }
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
 * Check if this is a completed maze session that user navigated back to
 */
async function isCompletedMazeSession() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_MAZE_COMPLETED' });
    return response?.isCompleted || false;
  } catch (error) {
    mazeLogger.error('Error checking completed maze session:', error);
    return false;
  }
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

  // Check if this is a completed maze that user navigated back to
  if (await isCompletedMazeSession()) {
    showCompletedMazeMessage();
    return; // Don't initialize the game
  }

  // Load maze session data from storage first
  await loadMazeSessionData();

  await initializeGame();
  setupEventListeners();
  await loadStats();

  // Setup development debugging utilities
  setupMazeDebugUtilities();

  // Handle different actions
  if (action === 'updateLimit') {
    challengeMessageEl.textContent = getI18nMessage('solveMazeToUpdateLimit');
  }
});

/**
 * Update canvas size responsively based on container and screen size
 */
function updateCanvasSize() {
  if (!canvas) return;

  const wrapper = document.querySelector('.maze-wrapper');
  if (!wrapper) return;

  // Get the container dimensions minus padding
  const wrapperStyle = getComputedStyle(wrapper);
  const wrapperPadding = parseInt(wrapperStyle.paddingLeft) + parseInt(wrapperStyle.paddingRight);
  const maxWidth = wrapper.clientWidth - wrapperPadding;
  const maxHeight = window.innerHeight * 0.6; // Max 60% of viewport height

  // Calculate the optimal canvas size (square)
  const maxCanvasSize = Math.min(maxWidth, maxHeight, 800); // Cap at 800px for very large screens
  const minCanvasSize = 200; // Minimum size for usability
  const canvasSize = Math.max(minCanvasSize, Math.min(maxCanvasSize, maxWidth));

  // Calculate cell size based on canvas size and maze size
  cellSize = Math.max(4, Math.floor(canvasSize / mazeModel.size));

  // Adjust canvas size to be exact multiple of cell size for crisp rendering
  const actualCanvasSize = mazeModel.size * cellSize;

  // Set canvas size (this automatically clears the canvas)
  canvas.width = actualCanvasSize;
  canvas.height = actualCanvasSize;

  // Set CSS size for proper scaling on high-DPI displays
  canvas.style.width = actualCanvasSize + 'px';
  canvas.style.height = actualCanvasSize + 'px';

  // Handle high-DPI displays for crisp rendering
  const dpr = window.devicePixelRatio || 1;
  if (dpr > 1) {
    canvas.width = actualCanvasSize * dpr;
    canvas.height = actualCanvasSize * dpr;
    canvas.style.width = actualCanvasSize + 'px';
    canvas.style.height = actualCanvasSize + 'px';
    ctx.scale(dpr, dpr);
  }

  // Re-render if maze exists
  if (mazeModel.grid.length > 0) {
    renderMaze(mazeModel);
  }
}

/**
 * Load maze session data from Chrome storage
 */
async function loadMazeSessionData() {
  try {
    // Try to get existing session data
    const store = usageDataStore();
    const sessionData = await store.getMazeSession();

    if (sessionData) {
      action = sessionData.action;
      difficulty = sessionData.difficulty || 0;

      mazeLogger.log('Loaded maze session data:', { action, difficulty });
      mazeLogger.log('Action loaded from storage:', action);

      // Clear the session data to prevent reuse
      await store.clearMazeSession();
    } else {
      mazeLogger.warn('No maze session data found, using defaults');
      mazeLogger.log('Setting action to null (default)');
      // Set defaults
      action = null;
      difficulty = 0;
    }
  } catch (error) {
    mazeLogger.error('Error loading maze session data:', error);
    // Use safe defaults
    action = null;
    difficulty = 0;
  }
}

/**
 * Initialize the maze game
 */
async function initializeGame() {
  canvas = document.getElementById('mazeCanvas');
  ctx = canvas.getContext('2d');

  // Get current daily stats to determine difficulty
  let dailyMazesCompleted = 0;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    if (response && !response.error) {
      dailyMazesCompleted = response.dailyMazesCompleted || 0;
    }
  } catch (error) {
    mazeLogger.error('Error getting daily stats for difficulty:', error);
  }

  // Set difficulty based on daily completed mazes and action type
  let calculatedDifficulty = dailyMazesCompleted;

  // For updateLimit actions, ensure minimum Hard difficulty (index 3)
  if (action === 'updateLimit') {
    const minHardDifficulty = 3; // Hard level index
    calculatedDifficulty = Math.max(dailyMazesCompleted, minHardDifficulty);
  }

  // Use stored difficulty as fallback, but prioritize calculated difficulty
  calculatedDifficulty = Math.max(difficulty, calculatedDifficulty);
  const difficultySettings = getDifficultySettings();
  currentDifficulty = Math.min(calculatedDifficulty, difficultySettings.length - 1);
  const currentDifficultySettings = difficultySettings[currentDifficulty];

  mazeLogger.log('Difficulty calculation:', {
    action,
    storedDifficulty: difficulty,
    dailyMazesCompleted,
    calculatedDifficulty,
    finalDifficulty: currentDifficulty
  });

  // Initialize maze model with difficulty settings
  mazeModel.initialize(currentDifficultySettings);
  isHandlingCompletion = false; // Reset completion handler flag

  // Calculate responsive canvas size after model is initialized
  updateCanvasSize();

  // Add debounced resize listener for responsive updates
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(updateCanvasSize, 100);
  });

  // Update UI
  difficultyLevelEl.textContent = currentDifficultySettings.name;
  mazeSizeEl.textContent = `${mazeModel.size}x${mazeModel.size}`;

  // Start timer
  gameStartTime = Date.now();
  startTimer();

  // Set random motivation message
  const motivationMessages = getMotivationMessages();
  const randomMessage = motivationMessages[Math.floor(Math.random() * motivationMessages.length)];
  motivationMessageEl.textContent = randomMessage;

  // Initialize smooth movement system
  playerVisualPos.x = mazeModel.playerPos.x;
  playerVisualPos.y = mazeModel.playerPos.y;

  // Initial render
  renderMaze(mazeModel);

  // Start animation loop for smooth movement
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(animate);
}


/**
 * Render the maze on canvas - optimized for performance
 * @param {MazeModel} model - The maze model to render
 */
function renderMaze(model) {
  // Clear canvas
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Batch drawing operations for better performance

  // Draw walls in one pass
  ctx.fillStyle = COLORS.wall;
  for (let y = 0; y < model.size; y++) {
    for (let x = 0; x < model.size; x++) {
      if (model.grid[y][x] === WALL) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  // Draw paths in one pass
  ctx.fillStyle = COLORS.path;
  for (let y = 0; y < model.size; y++) {
    for (let x = 0; x < model.size; x++) {
      if (model.grid[y][x] === PATH || model.grid[y][x] === GOAL) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  // Draw goal
  ctx.fillStyle = COLORS.goal;
  ctx.fillRect(
    model.goalPos.x * cellSize + 2,
    model.goalPos.y * cellSize + 2,
    cellSize - 4,
    cellSize - 4
  );

  // Only draw borders for smaller mazes to avoid performance issues
  if (model.size <= 25) {
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Draw grid lines efficiently
    for (let i = 0; i <= model.size; i++) {
      // Vertical lines
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, model.size * cellSize);

      // Horizontal lines
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(model.size * cellSize, i * cellSize);
    }

    ctx.stroke();
  }

  // Draw player using smooth visual position with celebration hopping
  ctx.fillStyle = COLORS.player;
  const hopOffset = getPlayerHopOffset();
  const playerX = playerVisualPos.x * cellSize + 3;
  const playerY = playerVisualPos.y * cellSize + 3 + (hopOffset * cellSize);
  const playerSize = Math.max(4, cellSize - 6);

  ctx.fillRect(playerX, playerY, playerSize, playerSize);

  // Add player eyes (Chrome Dino style) - only if cell is big enough
  if (cellSize >= 8) {
    ctx.fillStyle = '#fff';
    const eyeSize = Math.max(1, Math.floor(cellSize / 10));
    const eyeOffset = Math.floor(cellSize * 0.3);

    ctx.fillRect(
      playerVisualPos.x * cellSize + eyeOffset,
      playerVisualPos.y * cellSize + eyeOffset + (hopOffset * cellSize),
      eyeSize,
      eyeSize
    );
    ctx.fillRect(
      playerVisualPos.x * cellSize + Math.floor(cellSize * 0.6),
      playerVisualPos.y * cellSize + eyeOffset + (hopOffset * cellSize),
      eyeSize,
      eyeSize
    );
  }

  // Draw celebration sparkles
  if (celebrationState.active) {
    celebrationState.sparkles.forEach(sparkle => {
      ctx.fillStyle = sparkle.color;
      ctx.globalAlpha = sparkle.life;
      
      const sparkleX = sparkle.x * cellSize;
      const sparkleY = sparkle.y * cellSize;
      
      ctx.fillRect(
        sparkleX - sparkle.size / 2,
        sparkleY - sparkle.size / 2,
        sparkle.size,
        sparkle.size
      );
    });
    
    // Reset alpha
    ctx.globalAlpha = 1.0;
  }
}

/**
 * Animation loop for smooth movement and rendering
 */
function animate(currentTime) {
  if (!canvas) return;

  const deltaTime = currentTime - lastFrameTime;
  lastFrameTime = currentTime;

  // Update movement physics
  const previousPos = { x: playerVisualPos.x, y: playerVisualPos.y };
  updateMovement(deltaTime);
  
  // Update celebration animation
  updateCelebration(deltaTime);

  // Only render if player position has changed, we're moving, or celebration is active
  const positionChanged =
    Math.abs(playerVisualPos.x - previousPos.x) > 0.001 ||
    Math.abs(playerVisualPos.y - previousPos.y) > 0.001;

  if (positionChanged || isMoving || celebrationState.active) {
    renderMaze(mazeModel);
  }

  // Continue animation loop
  animationFrameId = requestAnimationFrame(animate);
}

/**
 * Update player movement with smooth physics
 */
function updateMovement(deltaTime) {
  if (!deltaTime || deltaTime > 100) return; // Skip large time jumps or pauses

  const dt = deltaTime / 1000; // Convert to seconds
  const currentTime = performance.now();

  // Skip update if delta time is too small to prevent floating point precision issues
  if (dt < 0.001) return;

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
  } else {
    currentVelocity.x = 0;
    currentVelocity.y = 0;
    isMoving = false;
  }

  // Update visual position with precise collision detection
  if (isMoving) {
    let newVisualX = playerVisualPos.x + (currentVelocity.x * dt);
    let newVisualY = playerVisualPos.y + (currentVelocity.y * dt);

    // Check X-axis movement separately to allow sliding along walls
    const targetLogicalX = Math.round(newVisualX);
    if (canMoveTo(targetLogicalX, Math.round(playerVisualPos.y))) {
      // Check if we're not going too far beyond the cell boundary
      const cellCenterX = Math.round(playerVisualPos.x);
      const maxDistance = 0.4; // Allow 40% deviation from cell center
      
      if (Math.abs(newVisualX - cellCenterX) <= maxDistance || 
          canMoveTo(Math.floor(newVisualX), Math.round(playerVisualPos.y)) && 
          canMoveTo(Math.ceil(newVisualX), Math.round(playerVisualPos.y))) {
        playerVisualPos.x = newVisualX;
      } else {
        // Stop at the boundary
        playerVisualPos.x = cellCenterX + Math.sign(newVisualX - cellCenterX) * maxDistance;
      }
    }

    // Check Y-axis movement separately to allow sliding along walls  
    const targetLogicalY = Math.round(newVisualY);
    if (canMoveTo(Math.round(playerVisualPos.x), targetLogicalY)) {
      // Check if we're not going too far beyond the cell boundary
      const cellCenterY = Math.round(playerVisualPos.y);
      const maxDistance = 0.4; // Allow 40% deviation from cell center
      
      if (Math.abs(newVisualY - cellCenterY) <= maxDistance ||
          canMoveTo(Math.round(playerVisualPos.x), Math.floor(newVisualY)) &&
          canMoveTo(Math.round(playerVisualPos.x), Math.ceil(newVisualY))) {
        playerVisualPos.y = newVisualY;
      } else {
        // Stop at the boundary
        playerVisualPos.y = cellCenterY + Math.sign(newVisualY - cellCenterY) * maxDistance;
      }
    }

    // Check for goal completion - trigger when avatar center is close to goal center
    const distanceToGoal = Math.sqrt(
      Math.pow(playerVisualPos.x - mazeModel.goalPos.x, 2) +
      Math.pow(playerVisualPos.y - mazeModel.goalPos.y, 2)
    );
    
    if (distanceToGoal < 0.3 && !celebrationState.active && !isHandlingCompletion) {
      // Goal reached! Trigger celebration immediately
      startCelebration();
      
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
        if (canMoveTo(currentLogicalX, currentLogicalY)) {
          mazeModel.movePlayer(
            currentLogicalX - mazeModel.playerPos.x,
            currentLogicalY - mazeModel.playerPos.y
          );
        }
      }
    }
  }
}

/**
 * Check if player can move to a specific position
 */
function canMoveTo(x, y) {
  return x >= 0 && x < mazeModel.size &&
         y >= 0 && y < mazeModel.size &&
         mazeModel.grid[y] && mazeModel.grid[y][x] !== WALL;
}

/**
 * Start celebration animation when goal is reached
 */
function startCelebration() {
  celebrationState.active = true;
  celebrationState.startTime = performance.now();
  celebrationState.sparkles = [];
  
  // Create initial sparkles around the goal
  for (let i = 0; i < 20; i++) {
    celebrationState.sparkles.push(createSparkle());
  }
}

/**
 * Create a sparkle particle for celebration
 */
function createSparkle() {
  const goalX = mazeModel.goalPos.x;
  const goalY = mazeModel.goalPos.y;
  
  return {
    x: goalX + (Math.random() - 0.5) * 2,
    y: goalY + (Math.random() - 0.5) * 2,
    vx: (Math.random() - 0.5) * 4,
    vy: (Math.random() - 0.5) * 4 - 2, // Bias upward
    life: 1.0,
    decay: 0.015 + Math.random() * 0.01,
    size: 2 + Math.random() * 3,
    color: `hsl(${Math.random() * 60 + 40}, 70%, ${50 + Math.random() * 30}%)`
  };
}

/**
 * Update celebration animation
 */
function updateCelebration(deltaTime) {
  if (!celebrationState.active) return;
  
  const elapsed = performance.now() - celebrationState.startTime;
  const dt = deltaTime / 1000;
  
  // Update sparkles
  celebrationState.sparkles = celebrationState.sparkles.filter(sparkle => {
    // Update position
    sparkle.x += sparkle.vx * dt;
    sparkle.y += sparkle.vy * dt;
    sparkle.vy += 3 * dt; // Gravity
    
    // Update life
    sparkle.life -= sparkle.decay;
    
    return sparkle.life > 0;
  });
  
  // Add more sparkles periodically
  if (elapsed < celebrationState.duration * 0.7 && Math.random() < 0.1) {
    celebrationState.sparkles.push(createSparkle());
  }
  
  // End celebration
  if (elapsed >= celebrationState.duration) {
    celebrationState.active = false;
    celebrationState.sparkles = [];
  }
}

/**
 * Get player hop offset for celebration animation
 */
function getPlayerHopOffset() {
  if (!celebrationState.active) return 0;
  
  const elapsed = performance.now() - celebrationState.startTime;
  const hopFreq = 1; // hops per second - much slower for better visibility
  const hopHeight = 0.15; // maximum hop height in cells
  
  // Create a bouncing animation
  const phase = (elapsed / 1000) * hopFreq * Math.PI * 2;
  const bounce = Math.abs(Math.sin(phase));
  
  return -bounce * hopHeight; // Negative Y means upward
}

/**
 * Handle player movement (legacy function - now just triggers movement state)
 */
function movePlayer(dx, dy) {
  // This function is kept for compatibility but movement is now handled by the animation loop
  // We can still use it for instant movement in special cases (like debug commands)
  const goalReached = mazeModel.movePlayer(dx, dy);

  // Snap visual position to logical position for instant movement
  playerVisualPos.x = mazeModel.playerPos.x;
  playerVisualPos.y = mazeModel.playerPos.y;

  if (goalReached) {
    startCelebration();
    // Delay completion to show celebration animation
    setTimeout(() => {
      handleMazeComplete();
    }, celebrationState.duration);
  }
}

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
  stopTimer();

  // Stop animation loop
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Show completion overlay with productivity tip and send completion message
  // Note: TabManager will mark the maze as completed when it receives the MAZE_COMPLETED message
  showCompletionMessage();
  await sendMazeCompletionMessage();
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
        action: action
      }
    });

    mazeLogger.log('Maze completion message sent successfully');

    // Handle different completion types
    if (action === 'updateLimit') {
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
function setupEventListeners() {
  // State-based keyboard controls for smooth movement
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return; // Ignore auto-repeat events

    const currentTime = performance.now();

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        if (!movementState.up.pressed) {
          movementState.up.pressed = true;
          movementState.up.timePressed = currentTime;
        }
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        if (!movementState.down.pressed) {
          movementState.down.pressed = true;
          movementState.down.timePressed = currentTime;
        }
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        if (!movementState.left.pressed) {
          movementState.left.pressed = true;
          movementState.left.timePressed = currentTime;
        }
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        if (!movementState.right.pressed) {
          movementState.right.pressed = true;
          movementState.right.timePressed = currentTime;
        }
        break;
    }
  });

  // Handle key releases
  document.addEventListener('keyup', (e) => {
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        movementState.up.pressed = false;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        movementState.down.pressed = false;
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        movementState.left.pressed = false;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        movementState.right.pressed = false;
        break;
    }
  });

}

// Prevent context menu on canvas
canvas?.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

// Focus handling
window.addEventListener('focus', () => {
  // Refresh stats when tab gains focus
  loadStats();
});

// Cleanup animation loop on page unload
window.addEventListener('beforeunload', () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
});

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
      cellSize,
      isHandlingCompletion,
      action,
      difficulty
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

