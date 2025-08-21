/**
 * Your Sincere Tab Keeper - Maze Game
 * A challenging maze game with Chrome Dino aesthetic
 */

import { TAB_LIMITS, LIMIT_DESCRIPTIONS } from './constants.js';
import { renderLimitButtons, setupLimitButtonListeners, updateLimitDescription } from './ui-utils.js';
import { Logger } from './debug.js';
import { MazeModel, WALL, PATH, PLAYER, GOAL } from './maze-model.js';
import { getRandomTip } from './productivity-tips.js';

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

// Maze session data (will be loaded from storage)
let tabId = null;
let action = null;
let difficulty = 0;

// DOM elements
const difficultyLevelEl = document.getElementById('difficultyLevel');
const mazeSizeEl = document.getElementById('mazeSize');
const timerEl = document.getElementById('timer');
const challengeMessageEl = document.getElementById('challengeMessage');
const motivationMessageEl = document.getElementById('motivationMessage');
const sessionMazesEl = document.getElementById('sessionMazes');
const totalMazesEl = document.getElementById('totalMazes');
const mazeOverlay = document.getElementById('mazeOverlay');

// Update limit modal elements
const updateLimitModal = document.getElementById('updateLimitModal');
const limitButtons = document.querySelectorAll('.limit-btn');
const modalLimitDescription = document.getElementById('modalLimitDescription');
const confirmLimitBtn = document.getElementById('confirmLimitBtn');
const cancelLimitBtn = document.getElementById('cancelLimitBtn');


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
const DIFFICULTY_SETTINGS = [
  { name: 'Beginner', size: 5, description: 'Perfect for getting started' },
  { name: 'Easy', size: 9, description: 'A gentle challenge' },
  { name: 'Medium', size: 13, description: 'Getting more interesting' },
  { name: 'Hard', size: 19, description: 'Now we\'re talking!' },
  { name: 'Expert', size: 25, description: 'For the determined' },
  { name: 'Master', size: 31, description: 'Serious commitment required' }
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
  // Load maze session data from storage first
  await loadMazeSessionData();
  
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
    // Generate a unique session key based on current tab
    const sessionKey = `mazeSession_${Date.now()}`;
    
    // Try to get existing session data
    const result = await chrome.storage.local.get(['currentMazeSession']);
    const sessionData = result.currentMazeSession;
    
    if (sessionData) {
      tabId = sessionData.tabId;
      action = sessionData.action;
      difficulty = sessionData.difficulty || 0;
      
      mazeLogger.log('Loaded maze session data:', { tabId, action, difficulty });
      mazeLogger.log('Action loaded from storage:', action);
      
      // Clear the session data to prevent reuse
      await chrome.storage.local.remove(['currentMazeSession']);
    } else {
      mazeLogger.warn('No maze session data found, using defaults');
      mazeLogger.log('Setting action to null (default)');
      // Set defaults
      tabId = null;
      action = null;
      difficulty = 0;
    }
  } catch (error) {
    mazeLogger.error('Error loading maze session data:', error);
    // Use safe defaults
    tabId = null;
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
  
  // Get current session stats to determine difficulty
  let sessionMazesCompleted = 0;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    if (response && !response.error) {
      sessionMazesCompleted = response.sessionMazesCompleted || 0;
    }
  } catch (error) {
    mazeLogger.error('Error getting session stats for difficulty:', error);
  }
  
  // Set difficulty based on session completed mazes and action type
  let calculatedDifficulty = sessionMazesCompleted;
  
  // For updateLimit actions, ensure minimum Hard difficulty (index 3)
  if (action === 'updateLimit') {
    const minHardDifficulty = 3; // Hard level index
    calculatedDifficulty = Math.max(sessionMazesCompleted, minHardDifficulty);
  }
  
  // Use stored difficulty as fallback, but prioritize calculated difficulty
  calculatedDifficulty = Math.max(difficulty, calculatedDifficulty);
  currentDifficulty = Math.min(calculatedDifficulty, DIFFICULTY_SETTINGS.length - 1);
  const difficultySettings = DIFFICULTY_SETTINGS[currentDifficulty];
  
  mazeLogger.log('Difficulty calculation:', { 
    action,
    storedDifficulty: difficulty, 
    sessionMazesCompleted, 
    calculatedDifficulty,
    finalDifficulty: currentDifficulty 
  });
  
  // Initialize maze model with difficulty settings
  mazeModel.initialize(difficultySettings);
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
  difficultyLevelEl.textContent = difficultySettings.name;
  mazeSizeEl.textContent = `${mazeModel.size}x${mazeModel.size}`;
  
  // Start timer
  gameStartTime = Date.now();
  startTimer();
  
  // Set random motivation message
  const randomMessage = MOTIVATION_MESSAGES[Math.floor(Math.random() * MOTIVATION_MESSAGES.length)];
  motivationMessageEl.textContent = randomMessage;
  
  // Initial render
  renderMaze(mazeModel);
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
  
  // Draw player
  ctx.fillStyle = COLORS.player;
  const playerX = model.playerPos.x * cellSize + 3;
  const playerY = model.playerPos.y * cellSize + 3;
  const playerSize = Math.max(4, cellSize - 6);
  
  ctx.fillRect(playerX, playerY, playerSize, playerSize);
  
  // Add player eyes (Chrome Dino style) - only if cell is big enough
  if (cellSize >= 8) {
    ctx.fillStyle = '#fff';
    const eyeSize = Math.max(1, Math.floor(cellSize / 10));
    const eyeOffset = Math.floor(cellSize * 0.3);
    
    ctx.fillRect(
      model.playerPos.x * cellSize + eyeOffset,
      model.playerPos.y * cellSize + eyeOffset,
      eyeSize,
      eyeSize
    );
    ctx.fillRect(
      model.playerPos.x * cellSize + Math.floor(cellSize * 0.6),
      model.playerPos.y * cellSize + eyeOffset,
      eyeSize,
      eyeSize
    );
  }
}

/**
 * Handle player movement
 */
function movePlayer(dx, dy) {
  const goalReached = mazeModel.movePlayer(dx, dy);
  
  renderMaze(mazeModel);
  
  // Check if goal reached
  if (goalReached) {
    handleMazeComplete();
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
    <h3>Congratulations!</h3>
    <p class="completion-message">You solved the maze! Here's a productivity tip while we redirect you:</p>
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
  
  // Show completion overlay with productivity tip and send completion message
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
        tabId: parseInt(tabId) || null,
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
        // Navigate current tab to options page instead of opening new tab
        window.location.href = chrome.runtime.getURL('src/options.html');
      });
      
    } catch (error) {
      mazeLogger.error('Error updating tab limit:', error);
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
    mazeLogger.error('Error loading stats:', error);
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

