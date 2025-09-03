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

// Eye direction tracking
let eyeDirection = { x: 0, y: 0 }; // Current eye look direction
let lastMovementDirection = { x: 0, y: 0 }; // Last significant movement direction

// Wall pushing state for easter egg
let wallPushingState = {
  active: false,
  startTime: 0,
  direction: { x: 0, y: 0 },
  sweatDrops: [],
  gasping: false,
  gaspStartTime: 0,
  gaspDuration: 3000, // 3 seconds of gasping
  breathOffset: 0 // Vertical breathing offset during gasping
};

// Goal celebration animation system
let celebrationState = {
  active: false,
  startTime: 0,
  duration: 2000, // 2 seconds of celebration
  sparkles: []
};

// Ambient animation system
let ambientAnimationTime = 0; // Running time for ambient animations

// Idle behavior system
let idleState = {
  lastMovementTime: 0,
  currentState: 'awake', // 'awake', 'blinking', 'looking', 'napping', 'sleeping'
  blinkTimer: 0,
  lookDirection: { x: 0, y: 0 },
  lookTimer: 0,
  sleepParticles: []
};

// Idle timing configuration
const IDLE_CONFIG = {
  blinkStartDelay: 5000,    // 5 seconds before blinking starts
  lookingStartDelay: 10000, // 10 seconds before looking around starts
  nappingStartDelay: 20000, // 20 seconds before napping starts
  sleepingStartDelay: 25000, // 25 seconds before ZZZ appears
  blinkInterval: 3000,      // Blink every 3 seconds when idle
  lookInterval: 2000,       // Change look direction every 2 seconds
  zzzInterval: 1500,        // New ZZZ every 1.5 seconds
  maxZzzParticles: 3        // Maximum ZZZ particles at any time
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

  // Note: Challenge message and theme will be set after difficulty is loaded
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

      // Note: Session data will be cleared when maze is completed, not on load
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

  // Use difficulty calculated by background script (single source of truth)
  const difficultySettings = getDifficultySettings();
  currentDifficulty = Math.min(difficulty, difficultySettings.length - 1);
  const currentDifficultySettings = difficultySettings[currentDifficulty];

  mazeLogger.log('Using difficulty from background script:', {
    action,
    storedDifficulty: difficulty,
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

  // Set challenge message based on action and difficulty level
  if (action === 'updateLimit') {
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
  playerVisualPos.x = mazeModel.playerPos.x;
  playerVisualPos.y = mazeModel.playerPos.y;

  // Initialize idle behavior system
  idleState.lastMovementTime = performance.now();
  idleState.currentState = 'awake';
  idleState.sleepParticles = [];

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

  // Draw goal with waving flag (after borders so flag appears on top)
  const goalCenterX = model.goalPos.x * cellSize + cellSize / 2;
  const goalCenterY = model.goalPos.y * cellSize + cellSize / 2;

  // Draw goal base (flagpole)
  ctx.fillStyle = '#8B4513'; // Brown flagpole
  const poleWidth = Math.max(1, cellSize / 12);
  const poleHeight = cellSize * 0.7;
  ctx.fillRect(
    goalCenterX - poleWidth / 2,
    goalCenterY - poleHeight / 2,
    poleWidth,
    poleHeight
  );

  // Draw waving flag with flowing motion
  ctx.fillStyle = COLORS.goal;
  const flagWidth = cellSize * 0.6;
  const flagHeight = cellSize * 0.25;
  const flagX = goalCenterX;
  const flagY = goalCenterY - poleHeight / 3;

  // Create simple waving flag effect with gentle curves
  ctx.beginPath();
  ctx.moveTo(flagX, flagY); // Left edge attached to pole - no movement

  // Top edge with gentle wave using quadratic curve
  const midWaveTop = getFlagWaveOffset(0.5);
  const endWaveTop = getFlagWaveOffset(1);
  ctx.quadraticCurveTo(
    flagX + flagWidth * 0.5,
    flagY + (midWaveTop * cellSize),
    flagX + flagWidth,
    flagY + (endWaveTop * cellSize)
  );

  // Right edge
  const endWaveBottom = getFlagWaveOffset(1);
  ctx.lineTo(flagX + flagWidth, flagY + flagHeight + (endWaveBottom * cellSize));

  // Bottom edge with matching gentle wave
  const midWaveBottom = getFlagWaveOffset(0.5);
  ctx.quadraticCurveTo(
    flagX + flagWidth * 0.5,
    flagY + flagHeight + (midWaveBottom * cellSize),
    flagX,
    flagY + flagHeight // Left edge attached to pole - no movement
  );

  ctx.closePath();
  ctx.fill();

  // Draw player using smooth visual position with celebration hopping
  ctx.fillStyle = COLORS.player;
  const hopOffset = getPlayerHopOffset();
  
  // Calculate player size and centering for better alignment
  const playerSize = Math.max(2, Math.floor(cellSize * 0.9)); // 90% of cell size, minimum 2px
  const centerOffset = (cellSize - playerSize) / 2; // Center the player in the cell
  
  const playerX = playerVisualPos.x * cellSize + centerOffset;
  const playerY = playerVisualPos.y * cellSize + centerOffset + (hopOffset * cellSize);

  ctx.fillRect(playerX, playerY, playerSize, playerSize);

  // Add player eyes with different states - only if cell is big enough
  if (cellSize >= 4) { // Lower threshold for smaller mazes
    let eyeSize = Math.max(1, Math.floor(cellSize / 10)); // Size relative to cell (original sizing)
    const baseEyeOffset = Math.floor(playerSize * 0.25); // Offset relative to player size

    // Wall pushing effects (easter egg)
    let eyeSizeMultiplier = 1.0;
    let isGaspingNow = false;

    if (wallPushingState.active) {
      const pushingDuration = performance.now() - wallPushingState.startTime;
      // Eyes grow bigger after 10 seconds
      if (pushingDuration > 10000) {
        const growthTime = Math.min((pushingDuration - 10000) / 3000, 1); // Grow over 3 seconds
        // Use smooth easing function for natural growth
        const smoothGrowth = Math.sin(growthTime * Math.PI * 0.5); // Sine easing
        eyeSizeMultiplier = 1.0 + (smoothGrowth * 1.0); // Up to 2x size (more reasonable)
      }
    } else if (wallPushingState.gasping) {
      const gaspingDuration = performance.now() - wallPushingState.gaspStartTime;
      if (gaspingDuration < wallPushingState.gaspDuration) {
        isGaspingNow = true;
        // Breathing rhythm - slower and more natural (800ms per breath cycle)
        const breathCycle = (gaspingDuration / 800) * Math.PI * 2;
        const breathIntensity = Math.sin(breathCycle) * 0.4 + 1.0; // 40% variation
        eyeSizeMultiplier = breathIntensity;

        // Add vertical breathing movement
        const breathOffset = Math.sin(breathCycle) * 2; // 2 pixels up/down
        wallPushingState.breathOffset = breathOffset;
      } else {
        // Stop gasping
        wallPushingState.gasping = false;
        wallPushingState.breathOffset = 0;
      }
    }

    eyeSize = Math.floor(eyeSize * eyeSizeMultiplier);

    // Calculate eye positions with directional offset (use original eye size for positioning)
    const originalEyeSize = Math.max(1, Math.floor(cellSize / 10));
    const eyeShiftX = eyeDirection.x * (originalEyeSize * 1.5);
    const eyeShiftY = eyeDirection.y * (originalEyeSize * 1.5);

    // Center the grown eyes properly
    const eyeGrowthOffset = (eyeSize - originalEyeSize) / 2;
    const breathingOffset = wallPushingState.breathOffset || 0;
    const leftEyeX = playerX + baseEyeOffset + eyeShiftX - eyeGrowthOffset;
    const rightEyeX = playerX + playerSize - baseEyeOffset - eyeSize + eyeShiftX - eyeGrowthOffset;
    const eyeY = playerY + baseEyeOffset + (hopOffset * cellSize) + eyeShiftY - eyeGrowthOffset + breathingOffset;

    // Draw eyes based on current state
    if (isGaspingNow) {
      // Draw gasping eyes (wide open white rectangles, pulsing with breathing)
      ctx.fillStyle = '#fff';

      // Left gasping eye (white rectangle, no pupils to match avatar style)
      ctx.fillRect(leftEyeX, eyeY, eyeSize, eyeSize);
      // Right gasping eye
      ctx.fillRect(rightEyeX, eyeY, eyeSize, eyeSize);

    } else if (celebrationState.active) {
      // Draw happy celebration eyes as hyphens (like ^_^)
      ctx.fillStyle = '#000';
      const hyphenWidth = eyeSize * 2; // Make them bigger than normal sleepy eyes
      const hyphenHeight = Math.max(2, eyeSize / 3); // Thick enough to be visible

      // Left happy hyphen eye
      ctx.fillRect(leftEyeX - eyeSize/4, eyeY + eyeSize/2, hyphenWidth, hyphenHeight);
      // Right happy hyphen eye
      ctx.fillRect(rightEyeX - eyeSize/4, eyeY + eyeSize/2, hyphenWidth, hyphenHeight);

    } else if (idleState.currentState === 'napping' || idleState.currentState === 'sleeping') {
      // Draw sleepy hyphen-shaped eyes
      ctx.fillStyle = '#000';
      const hyphenWidth = eyeSize * 1.5;
      const hyphenHeight = Math.max(1, eyeSize / 3);

      // Left sleepy eye
      ctx.fillRect(leftEyeX - eyeSize/4, eyeY + eyeSize/3, hyphenWidth, hyphenHeight);
      // Right sleepy eye
      ctx.fillRect(rightEyeX - eyeSize/4, eyeY + eyeSize/3, hyphenWidth, hyphenHeight);

    } else if (idleState.currentState === 'blinking' && isBlinking()) {
      // Draw closed eyes (thin horizontal lines)
      ctx.fillStyle = '#000';
      const blinkHeight = Math.max(1, eyeSize / 4);

      // Left closed eye
      ctx.fillRect(leftEyeX, eyeY + eyeSize/2, eyeSize, blinkHeight);
      // Right closed eye
      ctx.fillRect(rightEyeX, eyeY + eyeSize/2, eyeSize, blinkHeight);

    } else {
      // Draw normal white eyes
      ctx.fillStyle = '#fff';

      // Left eye
      ctx.fillRect(leftEyeX, eyeY, eyeSize, eyeSize);
      // Right eye
      ctx.fillRect(rightEyeX, eyeY, eyeSize, eyeSize);
    }
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

  // Draw sweat drops (easter egg)
  if (wallPushingState.sweatDrops.length > 0) {
    ctx.fillStyle = '#87CEEB'; // Sky blue for sweat
    wallPushingState.sweatDrops.forEach(drop => {
      ctx.globalAlpha = drop.life;
      const dropX = drop.x * cellSize;
      const dropY = drop.y * cellSize;
      const dropSize = Math.max(1, cellSize / 20);

      // Draw small oval for sweat drop
      ctx.beginPath();
      ctx.ellipse(dropX, dropY, dropSize, dropSize * 1.5, 0, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Reset alpha
    ctx.globalAlpha = 1.0;
  }

  // Draw ZZZ particles when sleeping
  if (idleState.currentState === 'sleeping' && idleState.sleepParticles.length > 0) {
    ctx.fillStyle = '#888'; // Gentle gray color
    ctx.font = `${Math.max(12, cellSize * 0.4)}px serif`; // Elegant serif font
    ctx.textAlign = 'center';

    idleState.sleepParticles.forEach(particle => {
      ctx.globalAlpha = particle.alpha; // Use the particle's computed alpha

      ctx.fillText(
        'z',
        particle.x * cellSize,
        particle.y * cellSize
      );
    });

    // Reset alpha and text properties
    ctx.globalAlpha = 1.0;
    ctx.textAlign = 'left';
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

  // Update wall pushing effects (including sweat fade-out)
  updateSweat(currentTime);

  // Update ambient animation time
  ambientAnimationTime += deltaTime;

  // Always render to ensure consistent ambient animations (flag waving, etc.)
  renderMaze(mazeModel);

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
    idleState.lastMovementTime = currentTime;
    idleState.currentState = 'awake';
    idleState.sleepParticles = [];

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
    updateIdleBehavior(currentTime, dt);
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
    if (canMoveTo(targetLogicalX, Math.round(playerVisualPos.y))) {
      // Check if we're not going too far beyond the cell boundary
      const cellCenterX = Math.round(playerVisualPos.x);
      const maxDistance = 0.1; // Allow only 10% deviation from cell center

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
      const maxDistance = 0.1; // Allow only 10% deviation from cell center

      if (Math.abs(newVisualY - cellCenterY) <= maxDistance ||
          canMoveTo(Math.round(playerVisualPos.x), Math.floor(newVisualY)) &&
          canMoveTo(Math.round(playerVisualPos.x), Math.ceil(newVisualY))) {
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
 * Update eye direction based on movement
 */
function updateEyeDirection(velocity, deltaTime) {
  // Normalize velocity for eye direction (max strength of 1.0)
  const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
  if (speed < 0.5) return; // Don't update for very slow movement

  const normalizedX = velocity.x / speed;
  const normalizedY = velocity.y / speed;

  // Smoothly interpolate eye direction toward movement direction
  const lerpSpeed = 8.0; // How quickly eyes follow movement direction
  const targetX = normalizedX * 1.0; // Max eye offset (100% for obvious movement)
  const targetY = normalizedY * 1.0;

  eyeDirection.x += (targetX - eyeDirection.x) * lerpSpeed * deltaTime;
  eyeDirection.y += (targetY - eyeDirection.y) * lerpSpeed * deltaTime;

  // Update last movement direction for reference
  lastMovementDirection.x = normalizedX;
  lastMovementDirection.y = normalizedY;
}

/**
 * Update idle behavior system
 */
function updateIdleBehavior(currentTime, deltaTime) {
  const idleTime = currentTime - idleState.lastMovementTime;

  // Update idle state based on time
  if (idleTime > IDLE_CONFIG.sleepingStartDelay) {
    if (idleState.currentState !== 'sleeping') {
      idleState.currentState = 'sleeping';
      idleState.sleepParticles = [];
    }
  } else if (idleTime > IDLE_CONFIG.nappingStartDelay) {
    if (idleState.currentState !== 'napping') {
      idleState.currentState = 'napping';
    }
  } else if (idleTime > IDLE_CONFIG.lookingStartDelay) {
    if (idleState.currentState !== 'looking') {
      idleState.currentState = 'looking';
      idleState.lookTimer = 0;
    }
  } else if (idleTime > IDLE_CONFIG.blinkStartDelay) {
    if (idleState.currentState !== 'blinking') {
      idleState.currentState = 'blinking';
      idleState.blinkTimer = 0;
    }
  }

  // Handle state-specific behavior
  switch (idleState.currentState) {
    case 'blinking':
      updateBlinkingBehavior(currentTime);
      break;
    case 'looking':
      updateLookingBehavior(currentTime);
      break;
    case 'napping':
      // Eyes remain closed, no special updates needed
      break;
    case 'sleeping':
      updateSleepingBehavior(currentTime, deltaTime);
      break;
  }
}

/**
 * Update blinking behavior
 */
function updateBlinkingBehavior(currentTime) {
  // Gradually return eyes to center and trigger periodic blinks
  eyeDirection.x = eyeDirection.x * 0.95;
  eyeDirection.y = eyeDirection.y * 0.95;

  // Snap to zero if very close
  if (Math.abs(eyeDirection.x) < 0.01) eyeDirection.x = 0;
  if (Math.abs(eyeDirection.y) < 0.01) eyeDirection.y = 0;

  // Update blink timer for periodic blinking (handled in rendering)
  idleState.blinkTimer = currentTime;
}

/**
 * Update looking around behavior
 */
function updateLookingBehavior(currentTime) {
  // Change look direction periodically
  if (currentTime - idleState.lookTimer > IDLE_CONFIG.lookInterval) {
    // Pick a new random direction to look
    const directions = [
      { x: -0.8, y: 0 },    // Left
      { x: 0.8, y: 0 },     // Right
      { x: 0, y: -0.8 },    // Up
      { x: 0, y: 0.8 },     // Down
      { x: -0.6, y: -0.6 }, // Up-left
      { x: 0.6, y: -0.6 },  // Up-right
      { x: 0, y: 0 }        // Center (rest)
    ];

    idleState.lookDirection = directions[Math.floor(Math.random() * directions.length)];
    idleState.lookTimer = currentTime;
  }

  // Smoothly interpolate to look direction
  const lerpSpeed = 3.0;
  const dt = 1/60; // Approximate delta time
  eyeDirection.x += (idleState.lookDirection.x - eyeDirection.x) * lerpSpeed * dt;
  eyeDirection.y += (idleState.lookDirection.y - eyeDirection.y) * lerpSpeed * dt;
}

/**
 * Update sleeping behavior with ZZZ particles
 */
function updateSleepingBehavior(currentTime, deltaTime) {
  // Ensure minimum deltaTime to prevent particles getting stuck
  const dt = Math.max(deltaTime, 16) / 1000; // Minimum 16ms (60fps)

  // Update existing ZZZ particles
  idleState.sleepParticles = idleState.sleepParticles.filter(particle => {
    particle.age += dt;

    // Smooth fade in during first 0.3 seconds
    if (particle.age < 0.3) {
      particle.alpha = particle.age / 0.3;
    }
    // Fade out during last 0.3 seconds (faster fade-out)
    else if (particle.age > 2.7) {
      particle.alpha = Math.max(0, (3 - particle.age) / 0.3);
    }
    // Full opacity in middle phase
    else {
      particle.alpha = 1.0;
    }

    // Float upward with slight deceleration
    particle.y -= (0.8 - (particle.age * 0.1)) * dt;
    // Gentle horizontal drift
    particle.x += particle.drift * dt;

    return particle.age < 3; // Remove after 3 seconds
  });

  // Add new ZZZ particle if under limit and enough time has passed
  if (idleState.sleepParticles.length < IDLE_CONFIG.maxZzzParticles) {
    const lastParticle = idleState.sleepParticles[idleState.sleepParticles.length - 1];
    const shouldSpawn = idleState.sleepParticles.length === 0 ||
      (lastParticle && currentTime - lastParticle.birthTime > IDLE_CONFIG.zzzInterval);

    if (shouldSpawn) {
      // Create predefined spawn positions to avoid overlapping
      const spawnPositions = [
        { x: 0.1, y: -0.1 },    // Left position - very close to avatar
        { x: 0.25, y: -0.12 },  // Center position - slightly higher
        { x: 0.4, y: -0.1 }     // Right position - very close to avatar
      ];

      const positionIndex = idleState.sleepParticles.length % spawnPositions.length;
      const basePos = spawnPositions[positionIndex];

      const newParticle = {
        x: playerVisualPos.x + basePos.x + (Math.random() - 0.5) * 0.1, // Small random variation
        y: playerVisualPos.y + basePos.y + (Math.random() - 0.5) * 0.05,
        age: 0,
        birthTime: currentTime,
        drift: (Math.random() - 0.5) * 0.3, // Reduced drift for less chaos
        size: 0.9 + Math.random() * 0.2, // More consistent sizing
        alpha: 0 // Start transparent
      };

      idleState.sleepParticles.push(newParticle);

    }
  }
}

/**
 * Check if avatar is currently blinking
 */
function isBlinking() {
  if (idleState.currentState !== 'blinking') return false;

  const timeSinceLastBlink = performance.now() - idleState.blinkTimer;
  const blinkCycle = timeSinceLastBlink % IDLE_CONFIG.blinkInterval;

  // Blink for 200ms every blinkInterval
  return blinkCycle < 200;
}

/**
 * Update wall pushing state (easter egg)
 */
function updateWallPushing(currentTime, intendedVelocity, positionChanged) {
  // Check if player is trying to move but position didn't change (blocked by wall)
  const isBlocked = (intendedVelocity.x !== 0 || intendedVelocity.y !== 0) && !positionChanged;

  if (isBlocked) {
    const direction = { x: Math.sign(intendedVelocity.x), y: Math.sign(intendedVelocity.y) };

    // Check if this is the same direction as before
    if (wallPushingState.active &&
        wallPushingState.direction.x === direction.x &&
        wallPushingState.direction.y === direction.y) {
      // Continue pushing in same direction - update sweat
      updateSweat(currentTime);
    } else {
      // Start new wall pushing session
      wallPushingState.active = true;
      wallPushingState.startTime = currentTime;
      wallPushingState.direction = direction;
      wallPushingState.sweatDrops = [];
      wallPushingState.gasping = false;
    }
  } else {
    // Not blocked - reset pushing state
    if (wallPushingState.active) {
      wallPushingState.active = false;
    }
  }
}

/**
 * Handle wall pushing release (easter egg)
 */
function handleWallPushingRelease(currentTime) {
  if (wallPushingState.active) {
    const pushingDuration = currentTime - wallPushingState.startTime;

    // If was pushing for more than 10 seconds, trigger gasping
    if (pushingDuration > 10000) {
      wallPushingState.gasping = true;
      wallPushingState.gaspStartTime = currentTime;
    }

    wallPushingState.active = false;
  }
}

/**
 * Update sweat drops during wall pushing
 */
function updateSweat(currentTime) {
  // Only create new sweat drops if actively pushing against wall
  if (wallPushingState.active) {
    const pushingDuration = currentTime - wallPushingState.startTime;

    // Start sweating after 13 seconds (10 + 3)
    if (pushingDuration > 13000) {
      // Add new sweat drop occasionally
      if (Math.random() < 0.05) { // 5% chance per frame
        wallPushingState.sweatDrops.push({
          x: playerVisualPos.x + (Math.random() - 0.5) * 0.3,
          y: playerVisualPos.y - 0.1,
          life: 1.0,
          speed: 0.5 + Math.random() * 0.3
        });
      }
    }
  }

  // Always update existing sweat drops (so they fade out naturally)
  const dt = 16 / 1000; // Approximate deltaTime
  wallPushingState.sweatDrops = wallPushingState.sweatDrops.filter(drop => {
    drop.y += drop.speed * dt;
    drop.life -= dt;
    return drop.life > 0 && drop.y < playerVisualPos.y + 1;
  });
}

/**
 * Get flag wave offset for goal animation
 */
function getFlagWaveOffset(position = 0.5) {
  const waveSpeed = 2.5; // Speed of wave traveling across flag
  const waveAmplitude = 0.08; // Gentler wave amplitude (in cells)

  // Create a traveling wave that flows from left to right
  // Position 0 = left edge (attached to pole), position 1 = right edge (free)
  const time = ambientAnimationTime / 1000;
  const wavePhase = (time * waveSpeed) - (position * Math.PI * 1.5);

  // The wave amplitude increases towards the free end of the flag
  // Attached edge (position=0) has no movement, free edge (position=1) has full movement
  const amplitudeMultiplier = position * position; // Quadratic increase towards free end

  // Simple sine wave that grows stronger towards the free end
  return Math.sin(wavePhase) * waveAmplitude * amplitudeMultiplier;
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

  // Clear the maze session now that it's completed
  try {
    const store = usageDataStore();
    await store.clearMazeSession();
    mazeLogger.log('Cleared maze session after completion');
  } catch (error) {
    mazeLogger.error('Failed to clear maze session:', error);
  }
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

