/**
 * Shared UI utilities for Your Sincere Tab Keeper
 * Common functions for generating and managing UI elements
 */

import { TAB_LIMITS, LIMIT_DESCRIPTIONS } from './constants.js';
import { Logger } from './debug.js';

const uiLogger = new Logger('UI-UTILS');

/**
 * Generate limit buttons HTML dynamically
 * @param {number} selectedLimit - The limit to mark as selected
 * @param {number} currentLimit - The current limit to highlight with special styling
 * @returns {string} HTML string for the buttons
 */
export function generateLimitButtonsHTML(selectedLimit = TAB_LIMITS.DEFAULT, currentLimit = null) {
  const buttonsHTML = [];
  for (let limit = TAB_LIMITS.MIN; limit <= TAB_LIMITS.MAX; limit++) {
    const selected = limit === selectedLimit ? 'selected' : '';
    const current = currentLimit && limit === currentLimit ? 'current' : '';
    const classes = ['limit-btn', selected, current].filter(Boolean).join(' ');
    buttonsHTML.push(`<button class="${classes}" data-limit="${limit}">${limit}</button>`);
  }
  return buttonsHTML.join('\n          ');
}

/**
 * Render limit buttons into a container
 * @param {string} containerId - ID of the container element
 * @param {number} selectedLimit - The limit to mark as selected
 * @param {number} currentLimit - The current limit to highlight with special styling
 */
export function renderLimitButtons(containerId, selectedLimit = TAB_LIMITS.DEFAULT, currentLimit = null) {
  const container = document.getElementById(containerId);
  if (!container) {
    uiLogger.error(`Container with ID "${containerId}" not found`);
    return;
  }
  
  container.innerHTML = generateLimitButtonsHTML(selectedLimit, currentLimit);
}

/**
 * Setup event listeners for limit buttons
 * @param {string} containerSelector - CSS selector for the container
 * @param {function} onLimitChange - Callback when limit is selected
 */
export function setupLimitButtonListeners(containerSelector, onLimitChange) {
  const buttons = document.querySelectorAll(`${containerSelector} .limit-btn`);
  
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove previous selection
      buttons.forEach(btn => btn.classList.remove('selected'));
      
      // Add selection to clicked button
      button.classList.add('selected');
      
      // Get selected limit and call callback
      const limit = parseInt(button.dataset.limit);
      if (onLimitChange) {
        onLimitChange(limit);
      }
    });
  });
}

/**
 * Update description text for a limit
 * @param {string} elementId - ID of the description element
 * @param {number} limit - The limit to show description for
 */
export function updateLimitDescription(elementId, limit) {
  const element = document.getElementById(elementId);
  if (element && LIMIT_DESCRIPTIONS[limit]) {
    element.textContent = LIMIT_DESCRIPTIONS[limit];
  }
}