/**
 * Your Sincere Tab Keeper - Maze Game
 * A challenging maze game with Chrome Dino aesthetic
 */

import { TAB_LIMITS, LIMIT_DESCRIPTIONS } from './constants.js';
import { renderLimitButtons, setupLimitButtonListeners, updateLimitDescription } from './ui-utils.js';
import { logger } from './debug.js';

// Game state
let maze = [];
let mazeSize = 15;
let cellSize = 30;
let playerPos = { x: 1, y: 1 };
let goalPos = { x: 0, y: 0 };
let canvas, ctx;
let gameStartTime;
let timerInterval;
let isGameComplete = false;
let currentDifficulty = 0;

// URL parameters
const urlParams = new URLSearchParams(window.location.search);
const tabId = urlParams.get('tabId');
const action = urlParams.get('action');
const difficulty = parseInt(urlParams.get('difficulty')) || 0;

// DOM elements
const difficultyLevelEl = document.getElementById('difficultyLevel');
const mazeSizeEl = document.getElementById('mazeSize');
const timerEl = document.getElementById('timer');
const challengeMessageEl = document.getElementById('challengeMessage');
const motivationMessageEl = document.getElementById('motivationMessage');
const sessionMazesEl = document.getElementById('sessionMazes');
const totalMazesEl = document.getElementById('totalMazes');
const resetMazeBtn = document.getElementById('resetMazeBtn');
const giveUpBtn = document.getElementById('giveUpBtn');
const mazeOverlay = document.getElementById('mazeOverlay');

// Update limit modal elements
const updateLimitModal = document.getElementById('updateLimitModal');
const limitButtons = document.querySelectorAll('.limit-btn');
const modalLimitDescription = document.getElementById('modalLimitDescription');
const confirmLimitBtn = document.getElementById('confirmLimitBtn');
const cancelLimitBtn = document.getElementById('cancelLimitBtn');

// Maze generation constants
const WALL = 1;
const PATH = 0;
const PLAYER = 2;
const GOAL = 3;

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
const DIFFICULTY_SETTINGS = [
  { name: 'Beginner', size: 5, description: 'Perfect for getting started' },
  { name: 'Easy', size: 8, description: 'A gentle challenge' },
  { name: 'Medium', size: 12, description: 'Getting more interesting' },
  { name: 'Hard', size: 19, description: 'Now we\'re talking!' },
  { name: 'Expert', size: 25, description: 'For the determined' },
  { name: 'Master', size: 30, description: 'Serious commitment required' }
];

// Motivational messages
const MOTIVATION_MESSAGES = [
  "Every maze solved is a step toward more mindful browsing! 🌟",
  "Your focus is growing stronger with each challenge! 💪",
  "Building better habits, one maze at a time! 🎯",
  "Patience and persistence will guide you through! 🧭",
  "Each wall you navigate brings clarity to your goals! 🔍",
  "Mindful browsing starts with mindful problem-solving! 🧠",
  "You're training your brain for better digital habits! 🏋️‍♂️",
  "Every step in the maze is a step toward awareness! 👣"
];


// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  await initializeGame();
  setupEventListeners();
  await loadStats();
  
  // Handle different actions
  if (action === 'updateLimit') {
    challengeMessageEl.textContent = 'Solve this maze to update your tab limit!';
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
  cellSize = Math.max(4, Math.floor(canvasSize / mazeSize));
  
  // Adjust canvas size to be exact multiple of cell size for crisp rendering
  const actualCanvasSize = mazeSize * cellSize;
  
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
  if (maze.length > 0) {
    renderMaze();
  }
}

/**
 * Initialize the maze game
 */
async function initializeGame() {
  canvas = document.getElementById('mazeCanvas');
  ctx = canvas.getContext('2d');
  
  // Set difficulty based on session count
  currentDifficulty = Math.min(difficulty, DIFFICULTY_SETTINGS.length - 1);
  const difficultySettings = DIFFICULTY_SETTINGS[currentDifficulty];
  
  mazeSize = difficultySettings.size;
  
  // Calculate responsive canvas size
  updateCanvasSize();
  
  // Add debounced resize listener for responsive updates
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(updateCanvasSize, 100);
  });
  
  // Update UI
  difficultyLevelEl.textContent = difficultySettings.name;
  mazeSizeEl.textContent = `${mazeSize}x${mazeSize}`;
  
  // Generate maze
  generateMaze();
  
  // Start timer
  gameStartTime = Date.now();
  startTimer();
  
  // Set random motivation message
  const randomMessage = MOTIVATION_MESSAGES[Math.floor(Math.random() * MOTIVATION_MESSAGES.length)];
  motivationMessageEl.textContent = randomMessage;
  
  // Initial render
  renderMaze();
}

/**
 * Generate maze using recursive backtracking algorithm
 */
function generateMaze() {
  // Initialize maze with walls
  maze = Array(mazeSize).fill().map(() => Array(mazeSize).fill(WALL));
  
  // Starting position (always odd coordinates for proper maze generation)
  const startX = 1;
  const startY = 1;
  maze[startY][startX] = PATH;
  
  // Stack for backtracking
  const stack = [{ x: startX, y: startY }];
  
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = getUnvisitedNeighbors(current.x, current.y);
    
    if (neighbors.length > 0) {
      // Choose random neighbor
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      
      // Remove wall between current and next
      const wallX = current.x + (next.x - current.x) / 2;
      const wallY = current.y + (next.y - current.y) / 2;
      maze[wallY][wallX] = PATH;
      maze[next.y][next.x] = PATH;
      
      stack.push(next);
    } else {
      stack.pop();
    }
  }
  
  // Set player and goal positions
  playerPos = { x: startX, y: startY };
  
  // Place goal at the farthest reachable position
  goalPos = findFarthestPosition(startX, startY);
  maze[goalPos.y][goalPos.x] = GOAL;
}

/**
 * Get unvisited neighbors for maze generation
 */
function getUnvisitedNeighbors(x, y) {
  const neighbors = [];
  const directions = [
    { x: 0, y: -2 }, // Up
    { x: 2, y: 0 },  // Right
    { x: 0, y: 2 },  // Down
    { x: -2, y: 0 }  // Left
  ];
  
  for (const dir of directions) {
    const newX = x + dir.x;
    const newY = y + dir.y;
    
    if (newX > 0 && newX < mazeSize - 1 && 
        newY > 0 && newY < mazeSize - 1 && 
        maze[newY][newX] === WALL) {
      neighbors.push({ x: newX, y: newY });
    }
  }
  
  return neighbors;
}

/**
 * Find the farthest reachable position from start using BFS
 */
function findFarthestPosition(startX, startY) {
  const visited = Array(mazeSize).fill().map(() => Array(mazeSize).fill(false));
  const queue = [{ x: startX, y: startY, distance: 0 }];
  visited[startY][startX] = true;
  
  let farthest = { x: startX, y: startY };
  let maxDistance = 0;
  
  while (queue.length > 0) {
    const current = queue.shift();
    
    if (current.distance > maxDistance) {
      maxDistance = current.distance;
      farthest = { x: current.x, y: current.y };
    }
    
    // Check all 4 directions
    const directions = [
      { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }
    ];
    
    for (const dir of directions) {
      const newX = current.x + dir.x;
      const newY = current.y + dir.y;
      
      if (newX >= 0 && newX < mazeSize && 
          newY >= 0 && newY < mazeSize && 
          !visited[newY][newX] && 
          maze[newY][newX] === PATH) {
        visited[newY][newX] = true;
        queue.push({ x: newX, y: newY, distance: current.distance + 1 });
      }
    }
  }
  
  return farthest;
}

/**
 * Render the maze on canvas - optimized for performance
 */
function renderMaze() {
  // Clear canvas
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Batch drawing operations for better performance
  
  // Draw walls in one pass
  ctx.fillStyle = COLORS.wall;
  for (let y = 0; y < mazeSize; y++) {
    for (let x = 0; x < mazeSize; x++) {
      if (maze[y][x] === WALL) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }
  
  // Draw paths in one pass
  ctx.fillStyle = COLORS.path;
  for (let y = 0; y < mazeSize; y++) {
    for (let x = 0; x < mazeSize; x++) {
      if (maze[y][x] === PATH || maze[y][x] === GOAL) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }
  
  // Draw goal
  ctx.fillStyle = COLORS.goal;
  ctx.fillRect(
    goalPos.x * cellSize + 2,
    goalPos.y * cellSize + 2,
    cellSize - 4,
    cellSize - 4
  );
  
  // Only draw borders for smaller mazes to avoid performance issues
  if (mazeSize <= 25) {
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // Draw grid lines efficiently
    for (let i = 0; i <= mazeSize; i++) {
      // Vertical lines
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, mazeSize * cellSize);
      
      // Horizontal lines
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(mazeSize * cellSize, i * cellSize);
    }
    
    ctx.stroke();
  }
  
  // Draw player
  ctx.fillStyle = COLORS.player;
  const playerX = playerPos.x * cellSize + 3;
  const playerY = playerPos.y * cellSize + 3;
  const playerSize = Math.max(4, cellSize - 6);
  
  ctx.fillRect(playerX, playerY, playerSize, playerSize);
  
  // Add player eyes (Chrome Dino style) - only if cell is big enough
  if (cellSize >= 8) {
    ctx.fillStyle = '#fff';
    const eyeSize = Math.max(1, Math.floor(cellSize / 10));
    const eyeOffset = Math.floor(cellSize * 0.3);
    
    ctx.fillRect(
      playerPos.x * cellSize + eyeOffset,
      playerPos.y * cellSize + eyeOffset,
      eyeSize,
      eyeSize
    );
    ctx.fillRect(
      playerPos.x * cellSize + Math.floor(cellSize * 0.6),
      playerPos.y * cellSize + eyeOffset,
      eyeSize,
      eyeSize
    );
  }
}

/**
 * Handle player movement
 */
function movePlayer(dx, dy) {
  if (isGameComplete) return;
  
  const newX = playerPos.x + dx;
  const newY = playerPos.y + dy;
  
  // Check bounds and walls
  if (newX >= 0 && newX < mazeSize && 
      newY >= 0 && newY < mazeSize && 
      maze[newY][newX] !== WALL) {
    
    playerPos.x = newX;
    playerPos.y = newY;
    
    renderMaze();
    
    // Check if goal reached
    if (newX === goalPos.x && newY === goalPos.y) {
      handleMazeComplete();
    }
  }
}

/**
 * Handle maze completion
 */
async function handleMazeComplete() {
  if (isGameComplete) return; // Prevent multiple completions
  
  isGameComplete = true;
  stopTimer();
  
  // Show completion overlay
  mazeOverlay.style.display = 'flex';
  
  // Add delay before sending completion message to let UI settle
  setTimeout(async () => {
    await sendMazeCompletionMessage();
  }, 500); // Back to simple approach
}

/**
 * Send maze completion message with basic error handling
 */
async function sendMazeCompletionMessage() {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      logger.log(`Sending maze completion message (attempt ${retryCount + 1})...`);
      
      // Check if chrome runtime is available before sending
      if (!chrome?.runtime) {
        throw new Error('Chrome runtime not available');
      }
      
      await chrome.runtime.sendMessage({
        type: 'MAZE_COMPLETED',
        data: {
          difficulty: currentDifficulty,
          time: Date.now() - gameStartTime,
          size: mazeSize,
          tabId: parseInt(tabId) || null
        }
      });
      
      logger.log('Maze completion message sent successfully');
      
      // Handle different completion types
      if (action === 'updateLimit') {
        // Wait for success animation, then show limit update modal
        setTimeout(async () => {
          try {
            mazeOverlay.style.display = 'none';
            await showUpdateLimitModal();
          } catch (error) {
            logger.error('Error showing update limit modal:', error);
          }
        }, 2000);
      } else {
        // Normal maze completion - background will handle URL loading
        logger.log('Normal maze completion - waiting for background script redirect');
        
        // Set a timeout to prevent infinite waiting if background fails
        setTimeout(() => {
          if (isGameComplete && document.visibilityState === 'visible') {
            logger.warn('Background script may have failed, attempting self-close');
            window.close();
          }
        }, 10000); // 10 second timeout
      }
      
      return; // Success, exit retry loop
      
    } catch (error) {
      retryCount++;
      logger.error(`Error sending maze completion message (attempt ${retryCount}):`, error);
      
      if (retryCount >= maxRetries) {
        logger.error('All retry attempts failed, using fallback');
        await handleCompletionFallback();
        return;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
    }
  }
}

/**
 * Fallback handling when maze completion fails
 */
async function handleCompletionFallback() {
  try {
    logger.log('Attempting fallback maze completion handling...');
    
    // Try different approaches to handle the completion
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        // Try to send a simpler close message
        await chrome.runtime.sendMessage({ type: 'CLOSE_BLOB_TAB' });
        return;
      } catch (e) {
        logger.log('Close message failed, trying window.close');
      }
    }
    
    // Last resort: close window directly
    setTimeout(() => {
      window.close();
    }, 1000);
    
  } catch (fallbackError) {
    logger.error('All fallback methods failed:', fallbackError);
    // Show user message as final fallback
    if (mazeOverlay) {
      mazeOverlay.innerHTML = `
        <div style="padding: 20px; text-align: center; background: white; border-radius: 10px;">
          <h3>Maze Complete!</h3>
          <p>Please manually close this tab or navigate to your desired page.</p>
          <button id="fallbackCloseBtn" style="padding: 10px 20px; margin-top: 10px; background: #4ecdc4; color: white; border: none; border-radius: 5px; cursor: pointer;">
            Close Tab
          </button>
        </div>
      `;
      
      // Add event listener to the close button
      const fallbackCloseBtn = document.getElementById('fallbackCloseBtn');
      if (fallbackCloseBtn) {
        fallbackCloseBtn.addEventListener('click', () => {
          window.close();
        });
      }
    }
  }
}

/**
 * Show the update limit modal
 */
async function showUpdateLimitModal() {
  const modal = document.getElementById('updateLimitModal');
  if (!modal) {
    logger.error('Update limit modal not found');
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
    logger.error('Failed to get current tab limit:', error);
  }
  
  let selectedLimit = currentLimit;
  
  // Generate buttons dynamically with current limit selected and highlighted
  renderLimitButtons('limitOptions', currentLimit, currentLimit);
  
  // Query elements fresh from the modal
  const modalLimitDesc = document.getElementById('modalLimitDescription');
  const confirmBtn = document.getElementById('confirmLimitBtn');
  const cancelBtn = document.getElementById('cancelLimitBtn');
  
  if (!modalLimitDesc || !confirmBtn || !cancelBtn) {
    logger.error('Modal elements not found');
    return;
  }
  
  // Function to update confirm button state
  const updateConfirmButton = (newSelectedLimit) => {
    const isUnchanged = newSelectedLimit === currentLimit;
    confirmBtn.disabled = isUnchanged;
    confirmBtn.textContent = isUnchanged ? 'Current Limit Selected' : `Set Limit to ${newSelectedLimit}`;
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
        chrome.runtime.openOptionsPage();
      });
      
    } catch (error) {
      logger.error('Error updating tab limit:', error);
      alert('Failed to update tab limit. Please try again.');
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
      sessionMazesEl.textContent = response.sessionMazesCompleted || 0;
      totalMazesEl.textContent = response.mazesCompleted || 0;
    }
  } catch (error) {
    logger.error('Error loading stats:', error);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Keyboard controls
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        movePlayer(0, -1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        movePlayer(0, 1);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        movePlayer(-1, 0);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        movePlayer(1, 0);
        break;
    }
  });
  
  // Button handlers
  resetMazeBtn.addEventListener('click', () => {
    if (confirm('Generate a new maze? Your current progress will be lost.')) {
      isGameComplete = false;
      mazeOverlay.style.display = 'none';
      stopTimer();
      initializeGame();
    }
  });
  
  giveUpBtn.addEventListener('click', () => {
    if (confirm('Give up on this maze? The tab will be closed.')) {
      window.close();
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

