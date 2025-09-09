/**
 * Test script for trend-graph component
 * Separated from HTML to comply with CSP
 */

import {
  generateRichData,
  generateSparseData,
  generateExtremeData,
  generateEmptyData
} from './test-data-generator.js';

// Compatibility wrapper for existing code
const MockDataGenerator = {
  generateRichData,
  generateSparseData,
  generateExtremeData,
  generateEmptyData
};

// Test interface functions
let currentData = null;

function loadScenario(scenarioType) {
  console.log(`🔄 Loading scenario: ${scenarioType}`); // eslint-disable-line no-console

  const generators = {
    'rich': () => MockDataGenerator.generateRichData(),
    'sparse': () => MockDataGenerator.generateSparseData(),
    'empty': () => MockDataGenerator.generateEmptyData(),
    'extreme': () => MockDataGenerator.generateExtremeData()
  };

  const generator = generators[scenarioType];
  if (!generator) {
    console.error('Unknown scenario type:', scenarioType); // eslint-disable-line no-console
    return;
  }

  try {
    currentData = generator();
    console.log(`✅ Generated data for ${scenarioType}:`, currentData); // eslint-disable-line no-console

    // Update both graphs
    const mainGraph = document.getElementById('testGraph');
    const responsiveGraph = document.getElementById('responsiveGraph');

    if (mainGraph && typeof mainGraph.setData === 'function') {
      mainGraph.setData(currentData);
    }

    if (responsiveGraph && typeof responsiveGraph.setData === 'function') {
      responsiveGraph.setData(currentData);
    }

    // Update data preview and statistics
    updateDataPreview();
    updateStatistics();

    console.log(`✅ Successfully loaded ${scenarioType} scenario`); // eslint-disable-line no-console

  } catch (error) {
    console.error(`❌ Error loading ${scenarioType} scenario:`, error); // eslint-disable-line no-console
  }
}

function clearGraph() {
  currentData = null;

  const mainGraph = document.getElementById('testGraph');
  const responsiveGraph = document.getElementById('responsiveGraph');

  if (mainGraph && typeof mainGraph.setData === 'function') {
    mainGraph.setData({ dailyMazes: {}, dailyTabLimits: {}, dailyBlockedAttempts: {} });
  }

  if (responsiveGraph && typeof responsiveGraph.setData === 'function') {
    responsiveGraph.setData({ dailyMazes: {}, dailyTabLimits: {}, dailyBlockedAttempts: {} });
  }

  document.getElementById('dataPreview').textContent = 'No data loaded. Click a scenario button above to load test data.';
  document.getElementById('dataStats').style.display = 'none';
}

function updateDataPreview() {
  if (!currentData) return;

  const preview = {
    totalDays: Object.keys(currentData.dailyMazes).length + Object.keys(currentData.dailyTabLimits).length + Object.keys(currentData.dailyBlockedAttempts).length,
    sampleData: {
      dailyMazes: Object.fromEntries(Object.entries(currentData.dailyMazes).slice(0, 5)),
      dailyTabLimits: Object.fromEntries(Object.entries(currentData.dailyTabLimits).slice(0, 5)),
      dailyBlockedAttempts: Object.fromEntries(Object.entries(currentData.dailyBlockedAttempts).slice(0, 5))
    }
  };

  document.getElementById('dataPreview').textContent = JSON.stringify(preview, null, 2);
}

function updateStatistics() {
  if (!currentData) return;

  const mazeCount = Object.values(currentData.dailyMazes).reduce((sum, val) => sum + val, 0);
  const tabLimits = Object.values(currentData.dailyTabLimits);
  const avgTabLimit = tabLimits.length > 0 ? (tabLimits.reduce((sum, val) => sum + val, 0) / tabLimits.length).toFixed(1) : 0;
  const blockedCount = Object.values(currentData.dailyBlockedAttempts).reduce((sum, val) => sum + val, 0);
  const uniqueDays = new Set([
    ...Object.keys(currentData.dailyMazes),
    ...Object.keys(currentData.dailyTabLimits),
    ...Object.keys(currentData.dailyBlockedAttempts)
  ]).size;

  document.getElementById('totalDays').textContent = uniqueDays;
  document.getElementById('totalMazes').textContent = mazeCount;
  document.getElementById('avgTabLimit').textContent = avgTabLimit;
  document.getElementById('totalBlocked').textContent = blockedCount;
  document.getElementById('dataStats').style.display = 'grid';
}

// Set up event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Set up button click handlers
  const buttons = {
    'rich': () => loadScenario('rich'),
    'sparse': () => loadScenario('sparse'),
    'empty': () => loadScenario('empty'),
    'extreme': () => loadScenario('extreme'),
    'clear': () => clearGraph()
  };

  // Add event listeners to buttons based on their text content or data attributes
  document.querySelectorAll('button').forEach(button => {
    const text = button.textContent.toLowerCase();
    if (text.includes('rich')) {
      button.addEventListener('click', buttons.rich);
    } else if (text.includes('sparse')) {
      button.addEventListener('click', buttons.sparse);
    } else if (text.includes('empty')) {
      button.addEventListener('click', buttons.empty);
    } else if (text.includes('extreme')) {
      button.addEventListener('click', buttons.extreme);
    } else if (text.includes('clear')) {
      button.addEventListener('click', buttons.clear);
    }
  });

  // Wait for components to be ready and load initial data
  setTimeout(() => {
    loadScenario('rich');
  }, 500);

  console.log('🧪 Trend Graph Extension Test Page Loaded'); // eslint-disable-line no-console
  console.log('📊 Available test scenarios: rich, sparse, empty, extreme'); // eslint-disable-line no-console
});

// Make functions available globally for console testing
window.trendGraphTest = {
  loadScenario,
  clearGraph,
  getCurrentData: () => currentData,
  MockDataGenerator
};
