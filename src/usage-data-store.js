/**
 * Usage Data Store - Centralized storage operations with semantic API
 *
 * This module provides a clean, testable interface for all Chrome storage operations,
 * eliminating direct chrome.storage.local usage throughout the codebase.
 * All methods are unit-testable and provide clear semantic naming for tab keeper usage data.
 */

import { TAB_LIMITS } from './constants.js';
import { Logger } from './debug.js';

class UsageDataStore {
  constructor(storageProvider = null) {
    // Allow injection of storage provider for testing
    this.storage = storageProvider || chrome?.storage?.local;
    this.logger = new Logger('USAGE-DATA-STORE');

    if (!this.storage) {
      throw new Error('Storage provider is required');
    }
  }

  /**
   * Get today's date key for daily tracking (YYYY-MM-DD format)
   */
  getTodayKey() {
    const today = new Date();
    return today.getFullYear() + '-' +
           String(today.getMonth() + 1).padStart(2, '0') + '-' +
           String(today.getDate()).padStart(2, '0');
  }

  // =============================================================================
  // SETTINGS OPERATIONS
  // =============================================================================

  /**
   * Get the current tab limit setting
   */
  async getTabLimit() {
    try {
      const result = await this.storage.get(['tabLimit']);
      return result.tabLimit || TAB_LIMITS.DEFAULT;
    } catch (error) {
      this.logger.error('Failed to get tab limit:', error);
      return TAB_LIMITS.DEFAULT;
    }
  }

  /**
   * Set the tab limit setting
   */
  async setTabLimit(newLimit) {
    try {
      if (newLimit < TAB_LIMITS.MIN || newLimit > TAB_LIMITS.MAX) {
        throw new Error(`Tab limit must be between ${TAB_LIMITS.MIN} and ${TAB_LIMITS.MAX}`);
      }
      await this.storage.set({ tabLimit: newLimit });
      this.logger.log('Set tab limit to:', newLimit);
    } catch (error) {
      this.logger.error('Failed to set tab limit:', error);
      throw error;
    }
  }

  /**
   * Get the installation date
   */
  async getInstallDate() {
    try {
      const result = await this.storage.get(['installDate']);
      return result.installDate || Date.now();
    } catch (error) {
      this.logger.error('Failed to get install date:', error);
      return Date.now();
    }
  }

  /**
   * Set the installation date (typically only called once during installation)
   */
  async setInstallDate(timestamp = Date.now()) {
    try {
      await this.storage.set({ installDate: timestamp });
      this.logger.log('Set install date to:', new Date(timestamp));
    } catch (error) {
      this.logger.error('Failed to set install date:', error);
      throw error;
    }
  }

  /**
   * Initialize installation date if not already set
   */
  async initializeInstallDate() {
    try {
      const result = await this.storage.get(['installDate']);
      if (!result.installDate) {
        await this.setInstallDate();
      }
      return result.installDate || Date.now();
    } catch (error) {
      this.logger.error('Failed to initialize install date:', error);
      throw error;
    }
  }

  // =============================================================================
  // STATISTICS OPERATIONS
  // =============================================================================

  /**
   * Get all statistics
   */
  async getStatistics() {
    try {
      const result = await this.storage.get([
        'mazesCompleted', 'blockedAttempts', 'tabLimit', 'installDate'
      ]);

      return {
        mazesCompleted: result.mazesCompleted || 0,
        blockedAttempts: result.blockedAttempts || 0,
        tabLimit: result.tabLimit || TAB_LIMITS.DEFAULT,
        installDate: result.installDate || Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to get statistics:', error);
      throw error;
    }
  }

  /**
   * Increment a statistic counter
   */
  async incrementStatistic(statName) {
    try {
      const result = await this.storage.get([statName]);
      const currentValue = result[statName] || 0;
      const newValue = currentValue + 1;
      await this.storage.set({ [statName]: newValue });
      this.logger.log(`Incremented ${statName} to:`, newValue);
      return newValue;
    } catch (error) {
      this.logger.error(`Failed to increment ${statName}:`, error);
      throw error;
    }
  }

  /**
   * Increment mazes completed count
   */
  incrementMazesCompleted() {
    return this.incrementStatistic('mazesCompleted');
  }

  /**
   * Increment blocked attempts count
   */
  incrementBlockedAttempts() {
    return this.incrementStatistic('blockedAttempts');
  }

  /**
   * Reset all statistics and usage data
   */
  async resetStatistics() {
    try {
      // Remove all statistics and tracking data
      const keysToRemove = [
        // Basic statistics
        'mazesCompleted',
        'blockedAttempts',

        // Daily tracking data (trends)
        'dailyMazes',
        'dailyTabLimits',
        'dailyBlockedAttempts',

        // Activity tracking
        'limitHitTimestamps'
      ];

      await this.storage.remove(keysToRemove);
      this.logger.log('Reset all statistics and tracking data:', keysToRemove);
    } catch (error) {
      this.logger.error('Failed to reset statistics:', error);
      throw error;
    }
  }

  // =============================================================================
  // DAILY TRACKING OPERATIONS
  // =============================================================================

  /**
   * Get today's maze completion count
   */
  async getTodayMazeCount() {
    try {
      const todayKey = this.getTodayKey();
      const result = await this.storage.get(['dailyMazes']);
      const dailyMazes = result.dailyMazes || {};
      return dailyMazes[todayKey] || 0;
    } catch (error) {
      this.logger.error('Failed to get today\'s maze count:', error);
      return 0;
    }
  }

  /**
   * Increment today's maze completion count
   */
  async incrementTodayMazeCount() {
    try {
      const todayKey = this.getTodayKey();
      const result = await this.storage.get(['dailyMazes']);
      const dailyMazes = result.dailyMazes || {};

      dailyMazes[todayKey] = (dailyMazes[todayKey] || 0) + 1;
      await this.storage.set({ dailyMazes });

      const newCount = dailyMazes[todayKey];
      this.logger.log(`Incremented today's maze count to ${newCount}`);
      return newCount;
    } catch (error) {
      this.logger.error('Failed to increment today\'s maze count:', error);
      throw error;
    }
  }

  /**
   * Record today's tab limit for trend tracking
   */
  async recordTodayTabLimit(tabLimit) {
    try {
      const todayKey = this.getTodayKey();
      const result = await this.storage.get(['dailyTabLimits']);
      const dailyTabLimits = result.dailyTabLimits || {};

      dailyTabLimits[todayKey] = tabLimit;
      await this.storage.set({ dailyTabLimits });

      this.logger.log(`Recorded today's tab limit: ${tabLimit}`);
    } catch (error) {
      this.logger.error('Failed to record today\'s tab limit:', error);
      throw error;
    }
  }

  /**
   * Increment today's blocked attempts count
   */
  async incrementTodayBlockedCount() {
    try {
      const todayKey = this.getTodayKey();
      const result = await this.storage.get(['dailyBlockedAttempts']);
      const dailyBlockedAttempts = result.dailyBlockedAttempts || {};

      dailyBlockedAttempts[todayKey] = (dailyBlockedAttempts[todayKey] || 0) + 1;
      await this.storage.set({ dailyBlockedAttempts });

      const newCount = dailyBlockedAttempts[todayKey];
      this.logger.log(`Incremented today's blocked count to ${newCount}`);
      return newCount;
    } catch (error) {
      this.logger.error('Failed to increment today\'s blocked count:', error);
      throw error;
    }
  }

  /**
   * Get all daily tracking data for trend analysis
   */
  async getDailyTrackingData() {
    try {
      const result = await this.storage.get([
        'dailyMazes', 'dailyTabLimits', 'dailyBlockedAttempts'
      ]);

      return {
        dailyMazes: result.dailyMazes || {},
        dailyTabLimits: result.dailyTabLimits || {},
        dailyBlockedAttempts: result.dailyBlockedAttempts || {}
      };
    } catch (error) {
      this.logger.error('Failed to get daily tracking data:', error);
      return {
        dailyMazes: {},
        dailyTabLimits: {},
        dailyBlockedAttempts: {}
      };
    }
  }

  /**
   * Get comprehensive stats including daily data
   */
  async getExtendedStatistics() {
    try {
      const [basicStats, dailyData, todayMazeCount, peakActivity] = await Promise.all([
        this.getStatistics(),
        this.getDailyTrackingData(),
        this.getTodayMazeCount(),
        this.calculatePeakActivityHour()
      ]);

      return {
        ...basicStats,
        dailyMazesCompleted: todayMazeCount,
        peakActivityHour: peakActivity,
        ...dailyData
      };
    } catch (error) {
      this.logger.error('Failed to get extended statistics:', error);
      throw error;
    }
  }


  // =============================================================================
  // ANALYTICS OPERATIONS
  // =============================================================================

  /**
   * Log a limit hit timestamp for analytics
   */
  async logLimitHitTimestamp() {
    try {
      const now = Date.now();
      const result = await this.storage.get(['limitHitTimestamps']);
      const timestamps = result.limitHitTimestamps || [];

      // Add current timestamp
      timestamps.push(now);

      // Keep only last 100 timestamps to prevent storage bloat
      const recentTimestamps = timestamps.slice(-100);

      await this.storage.set({ limitHitTimestamps: recentTimestamps });

      this.logger.log('Logged limit hit timestamp:', new Date(now).toLocaleString());
      return now;
    } catch (error) {
      this.logger.error('Failed to log limit hit timestamp:', error);
      throw error;
    }
  }

  /**
   * Set a generic timestamp tracking field
   */
  async setTimestamp(key, timestamp = Date.now()) {
    try {
      await this.storage.set({ [key]: timestamp });
      this.logger.log(`Set ${key} timestamp:`, new Date(timestamp));
    } catch (error) {
      this.logger.error(`Failed to set ${key} timestamp:`, error);
      throw error;
    }
  }

  /**
   * Get all limit hit timestamps for analysis
   */
  async getLimitHitTimestamps() {
    try {
      const result = await this.storage.get(['limitHitTimestamps']);
      return result.limitHitTimestamps || [];
    } catch (error) {
      this.logger.error('Failed to get limit hit timestamps:', error);
      return [];
    }
  }

  /**
   * Calculate peak activity hour from limit hit timestamps
   * Returns null if insufficient data (less than 10 hits)
   */
  async calculatePeakActivityHour() {
    try {
      const timestamps = await this.getLimitHitTimestamps();

      // Need at least 10 data points for meaningful analysis
      if (timestamps.length < 10) {
        return null;
      }

      // Count hits by hour (0-23)
      const hourCounts = new Array(24).fill(0);

      timestamps.forEach(timestamp => {
        const date = new Date(timestamp);
        const hour = date.getHours();
        hourCounts[hour]++;
      });

      // Find hour with most hits
      let maxCount = 0;
      let peakHour = 0;

      hourCounts.forEach((count, hour) => {
        if (count > maxCount) {
          maxCount = count;
          peakHour = hour;
        }
      });

      return {
        hour: peakHour,
        count: maxCount,
        totalHits: timestamps.length
      };
    } catch (error) {
      this.logger.error('Failed to calculate peak activity hour:', error);
      return null;
    }
  }


  // =============================================================================
  // INITIALIZATION & SETUP
  // =============================================================================

  /**
   * Initialize all required default values
   */
  async initializeDefaults() {
    try {
      // Initialize install date if not set
      await this.initializeInstallDate();

      // Ensure tab limit is set
      const tabLimit = await this.getTabLimit();
      if (tabLimit === TAB_LIMITS.DEFAULT) {
        await this.setTabLimit(TAB_LIMITS.DEFAULT);
      }

      this.logger.log('Initialized default values');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize defaults:', error);
      throw error;
    }
  }

  /**
   * Export all data for backup/analysis
   */
  async exportAllData() {
    try {
      const result = await this.storage.get(null); // Get all data
      return {
        exportDate: new Date().toISOString(),
        data: result
      };
    } catch (error) {
      this.logger.error('Failed to export data:', error);
      throw error;
    }
  }

  /**
   * Validate Tab Keeper data structure and values
   * @param {Object} data - The data object to validate
   * @throws {Error} If data structure or values are invalid
   */
  validateTabKeeperData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Data must be an object');
    }

    // Define expected Tab Keeper data schema
    const schema = {
      // Core statistics (optional, defaults to 0)
      mazesCompleted: { type: 'number', min: 0, optional: true },
      blockedAttempts: { type: 'number', min: 0, optional: true },
      
      // Settings (optional with defaults)
      tabLimit: { type: 'number', min: TAB_LIMITS.MIN, max: TAB_LIMITS.MAX, optional: true },
      installDate: { type: 'number', min: 0, optional: true },
      
      // Daily tracking data (optional, must be objects with YYYY-MM-DD keys)
      dailyMazes: { type: 'object', optional: true, dateKeyed: true },
      dailyTabLimits: { type: 'object', optional: true, dateKeyed: true },
      dailyBlockedAttempts: { type: 'object', optional: true, dateKeyed: true },
      
      // Analytics data (optional)
      limitHitTimestamps: { type: 'array', itemType: 'number', maxLength: 100, optional: true },
      
      // Import metadata (optional)
      importDate: { type: 'string', optional: true },
      originalExportDate: { type: 'string', optional: true }
    };

    // Check for unexpected properties (not part of Tab Keeper schema)
    const knownKeys = Object.keys(schema);
    const dataKeys = Object.keys(data);
    const unknownKeys = dataKeys.filter(key => !knownKeys.includes(key));
    
    if (unknownKeys.length > 0) {
      throw new Error(`Unknown properties detected (not Tab Keeper data): ${unknownKeys.join(', ')}`);
    }

    // Validate each property according to schema
    for (const [key, rules] of Object.entries(schema)) {
      const value = data[key];
      
      // Skip validation for optional missing properties
      if (value === undefined && rules.optional) {
        continue;
      }
      
      // Check required properties
      if (value === undefined && !rules.optional) {
        throw new Error(`Missing required property: ${key}`);
      }
      
      // Skip null/undefined values for optional properties
      if (value === null || value === undefined) {
        continue;
      }
      
      // Type validation
      if (rules.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new Error(`Property '${key}' must be a finite number, got: ${typeof value}`);
        }
        if (rules.min !== undefined && value < rules.min) {
          throw new Error(`Property '${key}' must be >= ${rules.min}, got: ${value}`);
        }
        if (rules.max !== undefined && value > rules.max) {
          throw new Error(`Property '${key}' must be <= ${rules.max}, got: ${value}`);
        }
      } else if (rules.type === 'string') {
        if (typeof value !== 'string') {
          throw new Error(`Property '${key}' must be a string, got: ${typeof value}`);
        }
        if (key.includes('Date')) {
          // Validate ISO date strings
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            throw new Error(`Property '${key}' must be a valid ISO date string, got: ${value}`);
          }
        }
      } else if (rules.type === 'object') {
        if (typeof value !== 'object' || Array.isArray(value) || value === null) {
          throw new Error(`Property '${key}' must be an object, got: ${typeof value}`);
        }
        
        // Validate date-keyed objects
        if (rules.dateKeyed) {
          const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;
          for (const [dateKey, dateValue] of Object.entries(value)) {
            if (!dateKeyPattern.test(dateKey)) {
              throw new Error(`Property '${key}' must have YYYY-MM-DD date keys, got: ${dateKey}`);
            }
            if (typeof dateValue !== 'number' || !Number.isFinite(dateValue) || dateValue < 0) {
              throw new Error(`Property '${key}' values must be non-negative numbers, got: ${dateValue} for key ${dateKey}`);
            }
          }
        }
      } else if (rules.type === 'array') {
        if (!Array.isArray(value)) {
          throw new Error(`Property '${key}' must be an array, got: ${typeof value}`);
        }
        if (rules.maxLength !== undefined && value.length > rules.maxLength) {
          throw new Error(`Property '${key}' array length must be <= ${rules.maxLength}, got: ${value.length}`);
        }
        if (rules.itemType) {
          for (let i = 0; i < value.length; i++) {
            const item = value[i];
            if (rules.itemType === 'number') {
              if (typeof item !== 'number' || !Number.isFinite(item)) {
                throw new Error(`Property '${key}' array items must be finite numbers, got: ${typeof item} at index ${i}`);
              }
            }
          }
        }
      }
    }
  }

  /**
   * Import and replace all data from backup
   * @param {Object} importData - The import data object with exportDate and data properties
   * @throws {Error} If import data is invalid or import fails
   */
  async importAllData(importData) {
    try {
      // Validate import data structure
      if (!importData || typeof importData !== 'object' || Array.isArray(importData)) {
        throw new Error('Invalid import data: must be an object');
      }

      if (!importData.data || typeof importData.data !== 'object' || Array.isArray(importData.data)) {
        throw new Error('Invalid import data: missing or invalid data property');
      }

      if (!importData.exportDate) {
        throw new Error('Invalid import data: missing exportDate');
      }

      // Validate that exportDate is a valid ISO string
      const exportDate = new Date(importData.exportDate);
      if (isNaN(exportDate.getTime())) {
        throw new Error('Invalid import data: exportDate is not a valid date');
      }

      // Validate that the data conforms to Tab Keeper schema
      this.validateTabKeeperData(importData.data);

      this.logger.log('Starting transaction-safe data import from', importData.exportDate);

      // Step 1: Create backup of existing data
      const existingData = await this.storage.get(null);
      this.logger.log('Created backup of existing data');

      try {
        // Step 2: Clear existing data 
        await this.storage.clear();
        this.logger.log('Cleared existing data');

        // Step 3: Import new data
        await this.storage.set(importData.data);
        this.logger.log('Imported new data successfully');

        // Step 4: Add import metadata
        await this.storage.set({
          importDate: new Date().toISOString(),
          originalExportDate: importData.exportDate
        });

        this.logger.log('Data import completed successfully');
        return true;

      } catch (importError) {
        this.logger.error('Import failed, attempting rollback:', importError);

        try {
          // Step 5: Rollback - restore original data if import failed
          await this.storage.clear();
          await this.storage.set(existingData);
          this.logger.log('Successfully rolled back to original data');
          
          throw new Error(`Import failed and was rolled back: ${importError.message}`);
        } catch (rollbackError) {
          this.logger.error('CRITICAL: Rollback failed:', rollbackError);
          throw new Error(`Import failed and rollback also failed. Data may be lost. Import error: ${importError.message}. Rollback error: ${rollbackError.message}`);
        }
      }

    } catch (error) {
      this.logger.error('Failed to import data:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
let _usageDataStore = null;
export const usageDataStore = () => {
  if (!_usageDataStore) {
    _usageDataStore = new UsageDataStore();
  }
  return _usageDataStore;
};

export { UsageDataStore };
