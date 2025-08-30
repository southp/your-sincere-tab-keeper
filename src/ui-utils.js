/**
 * Shared UI utilities for Your Sincere Tab Keeper
 * Common functions for generating and managing UI elements
 */

import { TAB_LIMITS, getTabLimitDescription } from './constants.js';
import { Logger } from './debug.js';
import { isDevelopment } from './env.js';

const uiLogger = new Logger('UI-UTILS');

// Development-only locale override system
let localeOverride = null;
let alternateMessages = {};

/**
 * Development-only function to override locale for i18n testing
 * @param {string} locale - Locale to use (e.g., 'en', 'zh_TW') or null/undefined to disable
 */
export async function setLocaleOverride(locale) {
  if (!(await isDevelopment())) {
    console.warn('Locale override is only available in development mode');
    return false;
  }

  if (locale === null || locale === undefined || locale === 'default') {
    localeOverride = null;
    alternateMessages = {};

    // Use Chrome storage API instead of localStorage for service worker compatibility
    try {
      await chrome.storage.local.remove('debugLocaleOverride');
    } catch (error) {
      // Fallback to localStorage if available (for content scripts/pages)
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('debugLocaleOverride');
      }
    }

    console.log('🌍 Locale override disabled - using browser default');

    // Refresh i18n on current page if DOM is available
    if (typeof document !== 'undefined') {
      initializeI18n();
    }
    return true;
  }

  try {
    // Validate locale and load messages
    const messagesUrl = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
    const response = await fetch(messagesUrl);

    if (!response.ok) {
      throw new Error(`Locale '${locale}' not found`);
    }

    alternateMessages = await response.json();
    localeOverride = locale;

    // Use Chrome storage API instead of localStorage for service worker compatibility
    try {
      await chrome.storage.local.set({ debugLocaleOverride: locale });
    } catch (error) {
      // Fallback to localStorage if available (for content scripts/pages)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('debugLocaleOverride', locale);
      }
    }

    console.log(`🌍 Locale override set to: ${locale}`);
    console.log(`📝 Loaded ${Object.keys(alternateMessages).length} message keys`);

    // Refresh i18n on current page if DOM is available
    if (typeof document !== 'undefined') {
      initializeI18n();
    }
    return true;

  } catch (error) {
    console.error(`Failed to set locale override to '${locale}':`, error);
    return false;
  }
}

/**
 * Enhanced chrome.i18n.getMessage with development locale override support
 * @param {string} messageName - Message key
 * @param {string|Array} substitutions - Optional substitutions
 * @returns {string} Localized message
 */
export function getI18nMessage(messageName, substitutions) {
  // Use override locale if active in development
  if (localeOverride && alternateMessages[messageName]) {
    const messageData = alternateMessages[messageName];
    let message = messageData.message || messageData;

    // Handle substitutions
    if (substitutions) {
      const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
      subs.forEach((sub, index) => {
        message = message.replace(new RegExp(`\\$${index + 1}`, 'g'), sub);
        message = message.replace(new RegExp(`\\$\\{${index}\\}`, 'g'), sub);
      });
    }

    return message;
  }

  // Fallback to standard Chrome i18n
  return chrome.i18n.getMessage(messageName, substitutions);
}

/**
 * Initialize locale override from storage (for persistence across page loads)
 */
async function initializeLocaleOverride() {
  if (!(await isDevelopment())) return;

  let savedLocale = null;

  // Try Chrome storage API first (for service worker compatibility)
  try {
    const result = await chrome.storage.local.get('debugLocaleOverride');
    savedLocale = result.debugLocaleOverride;
  } catch (error) {
    // Fallback to localStorage if available (for content scripts/pages)
    if (typeof localStorage !== 'undefined') {
      savedLocale = localStorage.getItem('debugLocaleOverride');
    }
  }

  if (savedLocale) {
    await setLocaleOverride(savedLocale);
  }
}

// Initialize on module load
initializeLocaleOverride();

/**
 * Initialize internationalization for HTML elements
 * Finds all elements with data-i18n attribute and replaces their text content
 */
export function initializeI18n() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const messageKey = element.getAttribute('data-i18n');
    const message = getI18nMessage(messageKey);
    if (message) {
      element.textContent = message;
    }
  });

  // Also refresh TrendGraph components that use shadow DOM
  document.querySelectorAll('trend-graph').forEach(trendGraph => {
    if (typeof trendGraph.refreshLocalization === 'function') {
      trendGraph.refreshLocalization();
    }
  });
}

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
  if (element) {
    element.textContent = getTabLimitDescription(limit);
  }
}

/**
 * Format hour as readable time range (e.g., "2-3 PM")
 * @param {number} hour - Hour in 24-hour format (0-23)
 * @returns {string} Formatted time range
 */
export function formatHourRange(hour) {
  const startHour = hour;
  const endHour = (hour + 1) % 24;

  const formatHour = (h) => {
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
  };

  return `${formatHour(startHour)}-${formatHour(endHour)}`;
}