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
   * Reset all statistics
   */
  async resetStatistics() {
    try {
      await this.storage.remove(['mazesCompleted', 'blockedAttempts']);
      this.logger.log('Reset all statistics');
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
  // SESSION DATA OPERATIONS
  // =============================================================================

  /**
   * Get current maze session data
   */
  async getMazeSession() {
    try {
      const result = await this.storage.get(['currentMazeSession']);
      return result.currentMazeSession || null;
    } catch (error) {
      this.logger.error('Failed to get maze session:', error);
      return null;
    }
  }

  /**
   * Set current maze session data
   */
  async setMazeSession(sessionData) {
    try {
      await this.storage.set({ currentMazeSession: sessionData });
      this.logger.log('Set maze session data:', sessionData);
    } catch (error) {
      this.logger.error('Failed to set maze session:', error);
      throw error;
    }
  }

  /**
   * Clear current maze session data
   */
  async clearMazeSession() {
    try {
      await this.storage.remove(['currentMazeSession']);
      this.logger.log('Cleared maze session data');
    } catch (error) {
      this.logger.error('Failed to clear maze session:', error);
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