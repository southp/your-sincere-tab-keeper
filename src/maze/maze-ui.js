/**
 * Maze UI Management
 * Handles DOM updates, modals, timers, statistics, and user interface interactions
 */

import { TAB_LIMITS, DIFFICULTY_LEVELS } from '../constants.js';
import { renderLimitButtons, setupLimitButtonListeners, updateLimitDescription, getI18nMessage } from '../ui-utils.js';
import { getRandomTip } from '../productivity-tips.js';
import { Logger } from '../debug.js';

// Create logger for this module
const logger = new Logger('MAZE-UI');

// DOM elements (cached for performance)
let difficultyLevelEl, mazeSizeEl, timerEl, challengeMessageEl;
let motivationMessageEl, dailyMazesEl, totalMazesEl, mazeOverlay;
let timerInterval;

/**
 * Initialize UI system - cache DOM elements
 */
export function initializeUI() {
  difficultyLevelEl = document.getElementById('difficultyLevel');
  mazeSizeEl = document.getElementById('mazeSize');
  timerEl = document.getElementById('timer');
  challengeMessageEl = document.getElementById('challengeMessage');
  motivationMessageEl = document.getElementById('motivationMessage');
  dailyMazesEl = document.getElementById('dailyMazes');
  totalMazesEl = document.getElementById('totalMazes');
  mazeOverlay = document.getElementById('mazeOverlay');
}

/**
 * Get motivational messages for the UI
 */
export function getMotivationMessages() {
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
export function showCompletedMazeMessage() {
  // Hide the normal maze interface
  document.querySelector('.maze-container').style.display = 'none';

  // Show the completed maze message
  document.getElementById('completedMazeMessage').style.display = 'flex';
}

/**
 * Update game UI with difficulty and maze information
 */
export function updateGameUI(currentDifficultySettings, mazeSize, sessionAction, currentDifficulty) {
  // Update UI elements
  difficultyLevelEl.textContent = currentDifficultySettings.name;
  mazeSizeEl.textContent = `${mazeSize}x${mazeSize}`;

  // Set challenge message based on action and difficulty level
  if (sessionAction === 'updateLimit') {
    challengeMessageEl.setAttribute('data-i18n', 'solveMazeToUpdateLimit');
    challengeMessageEl.textContent = getI18nMessage('solveMazeToUpdateLimit');
  } else {
    // Set challenge message based on difficulty level
    if (currentDifficulty === DIFFICULTY_LEVELS.INSANE) { // Insane level
      challengeMessageEl.setAttribute('data-i18n', 'solveMazeToOpenInsane');
      challengeMessageEl.textContent = getI18nMessage('solveMazeToOpenInsane');
    } else {
      challengeMessageEl.setAttribute('data-i18n', 'solveMazeToOpen');
      challengeMessageEl.textContent = getI18nMessage('solveMazeToOpen');
    }
  }

  // Apply inferno theme for insane difficulty
  if (currentDifficulty === DIFFICULTY_LEVELS.INSANE) { // Insane level
    document.body.classList.add('inferno-theme');
  } else {
    document.body.classList.remove('inferno-theme');
  }

  // Set random motivation message
  const motivationMessages = getMotivationMessages();
  const randomMessage = motivationMessages[Math.floor(Math.random() * motivationMessages.length)];
  motivationMessageEl.textContent = randomMessage;
}

/**
 * Show completion message with productivity tip
 */
export function showCompletionMessage() {
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
 * Start the game timer
 */
export function startTimer(gameStartTime) {
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
export function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

/**
 * Load and display statistics
 */
export async function loadStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });

    if (response && !response.error) {
      dailyMazesEl.textContent = response.dailyMazesCompleted || 0;
      totalMazesEl.textContent = response.mazesCompleted || 0;
    }
  } catch (error) {
    logger.error('Error loading stats:', error);
  }
}

/**
 * Show the update limit modal
 */
export async function showUpdateLimitModal() {
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
      logger.error('Error updating tab limit:', error);
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
 * Hide completion overlay (used by UI completion flow)
 */
export function hideCompletionOverlay() {
  if (mazeOverlay) {
    mazeOverlay.style.display = 'none';
  }
}

/**
 * Get maze overlay element for external manipulation
 */
export function getMazeOverlay() {
  return mazeOverlay;
}

/**
 * Reset timer to current time (for debug utilities)
 */
export function resetTimer(newGameStartTime) {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  startTimer(newGameStartTime);
}
