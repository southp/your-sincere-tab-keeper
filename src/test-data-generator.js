/**
 * Test data generators for Tab Keeper statistics
 * Shared between trend graph test page and debug utilities
 */

/**
 * Format date as YYYY-MM-DD string
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate realistic limit hit timestamps with activity patterns
 */
function generateRealisticTimestamps(startDate, endDate, totalBlocked) {
  const timestamps = [];
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  
  // Define realistic activity patterns (peak hours in day)
  const hourWeights = [
    0.1, 0.05, 0.02, 0.02, 0.02, 0.05, // 0-5: Low activity (night)
    0.1, 0.15, 0.2, 0.25, 0.3, 0.3,    // 6-11: Morning ramp up
    0.25, 0.2, 0.25, 0.3, 0.35, 0.4,   // 12-17: Afternoon peak
    0.35, 0.3, 0.25, 0.2, 0.15, 0.12   // 18-23: Evening decline
  ];

  // Generate approximately totalBlocked/4 timestamps (not every blocked attempt creates a timestamp)
  // Limit to maximum 100 to respect validation constraints
  const numTimestamps = Math.min(100, Math.max(10, Math.floor(totalBlocked / 4)));
  
  for (let i = 0; i < numTimestamps; i++) {
    // Random day within period
    const randomMs = Math.random() * (endDate.getTime() - startDate.getTime());
    const baseTimestamp = startDate.getTime() + randomMs;
    
    // Apply hour weighting for realistic time-of-day distribution
    const randomHour = selectWeightedHour(hourWeights);
    const randomMinute = Math.floor(Math.random() * 60);
    const randomSecond = Math.floor(Math.random() * 60);
    
    // Create timestamp with realistic hour
    const date = new Date(baseTimestamp);
    date.setHours(randomHour, randomMinute, randomSecond, 0);
    
    timestamps.push(date.getTime());
  }
  
  // Sort timestamps chronologically
  return timestamps.sort((a, b) => a - b);
}

/**
 * Select an hour based on weighted probabilities
 */
function selectWeightedHour(weights) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (let hour = 0; hour < 24; hour++) {
    random -= weights[hour];
    if (random <= 0) {
      return hour;
    }
  }
  
  return 14; // Default to 2 PM if something goes wrong
}

/**
 * Generate rich dataset with realistic patterns (90 days)
 */
function generateRichData() {
  const data = {
    dailyMazes: {},
    dailyTabLimits: {},
    dailyBlockedAttempts: {}
  };

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 90);

  let totalMazes = 0;
  let totalBlocked = 0;

  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dateKey = formatDate(d);
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Realistic patterns: less activity on weekends, varying engagement
    const baseActivity = isWeekend ? 0.3 : 1.0;
    const randomFactor = 0.5 + Math.random() * 0.8;
    const activityLevel = baseActivity * randomFactor;

    // Generate maze completions (0-8 per day, with realistic distribution)
    const mazeCount = Math.floor(Math.random() * 8 * activityLevel);
    if (mazeCount > 0) {
      data.dailyMazes[dateKey] = mazeCount;
      totalMazes += mazeCount;
    }

    // Generate tab limits (2-8, with preference for middle values)
    const tabLimit = Math.floor(2 + Math.random() * 6.5);
    data.dailyTabLimits[dateKey] = tabLimit;

    // Generate blocked attempts (0-15, correlated with activity)
    const blockedCount = Math.floor(Math.random() * 15 * activityLevel);
    if (blockedCount > 0) {
      data.dailyBlockedAttempts[dateKey] = blockedCount;
      totalBlocked += blockedCount;
    }
  }

  // Add aggregate statistics
  data.mazesCompleted = totalMazes;
  data.blockedAttempts = totalBlocked;
  data.installDate = startDate.getTime(); // Set install date to start of data period

  // Generate realistic limit hit timestamps for peak activity calculation
  data.limitHitTimestamps = generateRealisticTimestamps(startDate, today, totalBlocked);

  return data;
}

/**
 * Generate sparse dataset with gaps
 */
function generateSparseData() {
  const data = {
    dailyMazes: {},
    dailyTabLimits: {},
    dailyBlockedAttempts: {}
  };

  const today = new Date();
  const dates = [];

  // Generate only 15 random dates in the last 60 days
  for (let i = 0; i < 15; i++) {
    const randomDays = Math.floor(Math.random() * 60);
    const date = new Date(today);
    date.setDate(today.getDate() - randomDays);
    dates.push(date);
  }

  let totalMazes = 0;
  let totalBlocked = 0;

  dates.forEach(date => {
    const dateKey = formatDate(date);

    // Sparse but meaningful data
    if (Math.random() > 0.3) {
      const mazeCount = Math.floor(Math.random() * 5) + 1;
      data.dailyMazes[dateKey] = mazeCount;
      totalMazes += mazeCount;
    }

    data.dailyTabLimits[dateKey] = Math.floor(Math.random() * 4) + 3;

    if (Math.random() > 0.4) {
      const blockedCount = Math.floor(Math.random() * 8) + 1;
      data.dailyBlockedAttempts[dateKey] = blockedCount;
      totalBlocked += blockedCount;
    }
  });

  // Add aggregate statistics
  data.mazesCompleted = totalMazes;
  data.blockedAttempts = totalBlocked;
  data.installDate = Date.now() - (60 * 24 * 60 * 60 * 1000); // 60 days ago

  // Generate realistic limit hit timestamps for peak activity calculation
  const startDate = new Date(Date.now() - (60 * 24 * 60 * 60 * 1000));
  data.limitHitTimestamps = generateRealisticTimestamps(startDate, today, totalBlocked);

  return data;
}

/**
 * Generate extreme values to test edge cases
 */
function generateExtremeData() {
  const data = {
    dailyMazes: {},
    dailyTabLimits: {},
    dailyBlockedAttempts: {}
  };

  const today = new Date();
  const scenarios = [
    { mazes: 0, tabLimit: 2, blocked: 0 },      // Minimal activity
    { mazes: 50, tabLimit: 8, blocked: 100 },  // Maximum activity
    { mazes: 25, tabLimit: 2, blocked: 200 },  // High blocking with low limit
    { mazes: 1, tabLimit: 8, blocked: 0 },     // High limit, low activity
    { mazes: 30, tabLimit: 5, blocked: 5 }    // High maze completion
  ];

  let totalMazes = 0;
  let totalBlocked = 0;

  scenarios.forEach((scenario, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (index * 10));
    const dateKey = formatDate(date);

    data.dailyMazes[dateKey] = scenario.mazes;
    data.dailyTabLimits[dateKey] = scenario.tabLimit;
    data.dailyBlockedAttempts[dateKey] = scenario.blocked;
    
    totalMazes += scenario.mazes;
    totalBlocked += scenario.blocked;
  });

  // Add aggregate statistics
  data.mazesCompleted = totalMazes;
  data.blockedAttempts = totalBlocked;
  data.installDate = Date.now() - (50 * 24 * 60 * 60 * 1000); // 50 days ago

  // Generate realistic limit hit timestamps for peak activity calculation
  const startDate = new Date(Date.now() - (50 * 24 * 60 * 60 * 1000));
  data.limitHitTimestamps = generateRealisticTimestamps(startDate, new Date(), totalBlocked);

  return data;
}

/**
 * Generate empty dataset
 */
function generateEmptyData() {
  return {
    dailyMazes: {},
    dailyTabLimits: {},
    dailyBlockedAttempts: {},
    mazesCompleted: 0,
    blockedAttempts: 0,
    installDate: Date.now(),
    limitHitTimestamps: [] // No timestamps for empty dataset
  };
}

// Export for ES6 modules
export {
  formatDate,
  generateRichData,
  generateSparseData,
  generateExtremeData,
  generateEmptyData
};

// Export for CommonJS/browser globals (for background script)
if (typeof globalThis !== 'undefined') {
  globalThis.TestDataGenerator = {
    formatDate,
    generateRichData,
    generateSparseData,
    generateExtremeData,
    generateEmptyData
  };
}
