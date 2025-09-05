import { UsageDataStore } from './usage-data-store.js';
import { TAB_LIMITS } from './constants.js';

describe('UsageDataStore', () => {
  let mockStorage;
  let store;
  let originalConsole;

  beforeEach(() => {
    mockStorage = {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    };

    store = new UsageDataStore(mockStorage);

    // Mock console methods to avoid test noise
    originalConsole = { ...console };
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
  });

  describe('constructor', () => {
    it('should use provided storage provider', () => {
      const customStorage = { get: jest.fn(), set: jest.fn(), remove: jest.fn() };
      const customStore = new UsageDataStore(customStorage);
      expect(customStore.storage).toBe(customStorage);
    });

    it('should throw error if no storage provider', () => {
      // Temporarily undefine chrome to test the error case
      const originalChrome = global.chrome;
      global.chrome = undefined;

      expect(() => new UsageDataStore(null)).toThrow('Storage provider is required');

      // Restore chrome
      global.chrome = originalChrome;
    });
  });

  describe('getTodayKey', () => {
    it('should return YYYY-MM-DD format for current date', () => {
      const mockDate = new Date('2024-03-15T10:30:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const key = store.getTodayKey();
      expect(key).toBe('2024-03-15');

      global.Date.mockRestore();
    });

    it('should pad single digits with zeros', () => {
      const mockDate = new Date('2024-01-05T10:30:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const key = store.getTodayKey();
      expect(key).toBe('2024-01-05');

      global.Date.mockRestore();
    });
  });

  describe('Settings Operations', () => {
    describe('getTabLimit', () => {
      it('should return stored tab limit', async () => {
        mockStorage.get.mockResolvedValue({ tabLimit: 15 });

        const result = await store.getTabLimit();

        expect(mockStorage.get).toHaveBeenCalledWith(['tabLimit']);
        expect(result).toBe(15);
      });

      it('should return default if no limit stored', async () => {
        mockStorage.get.mockResolvedValue({});

        const result = await store.getTabLimit();

        expect(result).toBe(TAB_LIMITS.DEFAULT);
      });

      it('should return default on error', async () => {
        mockStorage.get.mockRejectedValue(new Error('Storage error'));

        const result = await store.getTabLimit();

        expect(result).toBe(TAB_LIMITS.DEFAULT);
      });
    });

    describe('setTabLimit', () => {
      it('should set valid tab limit', async () => {
        const newLimit = 5; // Use a valid limit within TAB_LIMITS range

        await store.setTabLimit(newLimit);

        expect(mockStorage.set).toHaveBeenCalledWith({ tabLimit: newLimit });
      });

      it('should reject limit below minimum', async () => {
        await expect(store.setTabLimit(TAB_LIMITS.MIN - 1))
          .rejects.toThrow(`Tab limit must be between ${TAB_LIMITS.MIN} and ${TAB_LIMITS.MAX}`);
      });

      it('should reject limit above maximum', async () => {
        await expect(store.setTabLimit(TAB_LIMITS.MAX + 1))
          .rejects.toThrow(`Tab limit must be between ${TAB_LIMITS.MIN} and ${TAB_LIMITS.MAX}`);
      });

      it('should propagate storage errors', async () => {
        mockStorage.set.mockRejectedValue(new Error('Storage error'));

        await expect(store.setTabLimit(5)).rejects.toThrow('Storage error'); // Use valid limit
      });
    });

    describe('getInstallDate', () => {
      it('should return stored install date', async () => {
        const installDate = 1640995200000; // 2022-01-01
        mockStorage.get.mockResolvedValue({ installDate });

        const result = await store.getInstallDate();

        expect(mockStorage.get).toHaveBeenCalledWith(['installDate']);
        expect(result).toBe(installDate);
      });

      it('should return current time if no date stored', async () => {
        mockStorage.get.mockResolvedValue({});
        const beforeCall = Date.now();

        const result = await store.getInstallDate();

        const afterCall = Date.now();
        expect(result).toBeGreaterThanOrEqual(beforeCall);
        expect(result).toBeLessThanOrEqual(afterCall);
      });
    });

    describe('setInstallDate', () => {
      it('should set provided timestamp', async () => {
        const timestamp = 1640995200000;

        await store.setInstallDate(timestamp);

        expect(mockStorage.set).toHaveBeenCalledWith({ installDate: timestamp });
      });

      it('should use current time if no timestamp provided', async () => {
        const beforeCall = Date.now();

        await store.setInstallDate();

        const setCall = mockStorage.set.mock.calls[0][0];
        expect(setCall.installDate).toBeGreaterThanOrEqual(beforeCall);
        expect(setCall.installDate).toBeLessThanOrEqual(Date.now());
      });
    });
  });

  describe('Statistics Operations', () => {
    describe('getStatistics', () => {
      it('should return complete statistics object', async () => {
        const mockData = {
          mazesCompleted: 25,
          blockedAttempts: 10,
          tabLimit: 15,
          installDate: 1640995200000
        };
        mockStorage.get.mockResolvedValue(mockData);

        const result = await store.getStatistics();

        expect(mockStorage.get).toHaveBeenCalledWith([
          'mazesCompleted', 'blockedAttempts', 'tabLimit', 'installDate'
        ]);
        expect(result).toEqual(mockData);
      });

      it('should return defaults for missing values', async () => {
        mockStorage.get.mockResolvedValue({});
        const beforeCall = Date.now();

        const result = await store.getStatistics();

        expect(result.mazesCompleted).toBe(0);
        expect(result.blockedAttempts).toBe(0);
        expect(result.tabLimit).toBe(TAB_LIMITS.DEFAULT);
        expect(result.installDate).toBeGreaterThanOrEqual(beforeCall);
      });
    });

    describe('incrementStatistic', () => {
      it('should increment existing statistic', async () => {
        mockStorage.get.mockResolvedValue({ mazesCompleted: 5 });

        const result = await store.incrementStatistic('mazesCompleted');

        expect(mockStorage.get).toHaveBeenCalledWith(['mazesCompleted']);
        expect(mockStorage.set).toHaveBeenCalledWith({ mazesCompleted: 6 });
        expect(result).toBe(6);
      });

      it('should initialize and increment new statistic', async () => {
        mockStorage.get.mockResolvedValue({});

        const result = await store.incrementStatistic('newStat');

        expect(mockStorage.set).toHaveBeenCalledWith({ newStat: 1 });
        expect(result).toBe(1);
      });

      it('should handle storage errors', async () => {
        mockStorage.get.mockRejectedValue(new Error('Storage error'));

        await expect(store.incrementStatistic('testStat')).rejects.toThrow('Storage error');
      });
    });

    describe('incrementMazesCompleted', () => {
      it('should increment mazes completed', async () => {
        mockStorage.get.mockResolvedValue({ mazesCompleted: 10 });

        const result = await store.incrementMazesCompleted();

        expect(mockStorage.set).toHaveBeenCalledWith({ mazesCompleted: 11 });
        expect(result).toBe(11);
      });
    });

    describe('incrementBlockedAttempts', () => {
      it('should increment blocked attempts', async () => {
        mockStorage.get.mockResolvedValue({ blockedAttempts: 3 });

        const result = await store.incrementBlockedAttempts();

        expect(mockStorage.set).toHaveBeenCalledWith({ blockedAttempts: 4 });
        expect(result).toBe(4);
      });
    });

    describe('resetStatistics', () => {
      it('should remove statistics keys', async () => {
        await store.resetStatistics();

        expect(mockStorage.remove).toHaveBeenCalledWith([
          'mazesCompleted',
          'blockedAttempts',
          'dailyMazes',
          'dailyTabLimits',
          'dailyBlockedAttempts',
          'limitHitTimestamps'
        ]);
      });
    });
  });

  describe('Daily Tracking Operations', () => {
    beforeEach(() => {
      const mockDate = new Date('2024-03-15T10:30:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    });

    afterEach(() => {
      global.Date.mockRestore();
    });

    describe('getTodayMazeCount', () => {
      it('should return today\'s maze count', async () => {
        const dailyMazes = { '2024-03-15': 5 };
        mockStorage.get.mockResolvedValue({ dailyMazes });

        const result = await store.getTodayMazeCount();

        expect(mockStorage.get).toHaveBeenCalledWith(['dailyMazes']);
        expect(result).toBe(5);
      });

      it('should return 0 if no data for today', async () => {
        mockStorage.get.mockResolvedValue({ dailyMazes: {} });

        const result = await store.getTodayMazeCount();

        expect(result).toBe(0);
      });

      it('should return 0 if no dailyMazes object', async () => {
        mockStorage.get.mockResolvedValue({});

        const result = await store.getTodayMazeCount();

        expect(result).toBe(0);
      });

      it('should handle storage errors gracefully', async () => {
        mockStorage.get.mockRejectedValue(new Error('Storage error'));

        const result = await store.getTodayMazeCount();

        expect(result).toBe(0);
      });
    });

    describe('incrementTodayMazeCount', () => {
      it('should increment existing count', async () => {
        const dailyMazes = { '2024-03-15': 3 };
        mockStorage.get.mockResolvedValue({ dailyMazes });

        const result = await store.incrementTodayMazeCount();

        expect(mockStorage.set).toHaveBeenCalledWith({
          dailyMazes: { '2024-03-15': 4 }
        });
        expect(result).toBe(4);
      });

      it('should initialize count for new day', async () => {
        mockStorage.get.mockResolvedValue({ dailyMazes: {} });

        const result = await store.incrementTodayMazeCount();

        expect(mockStorage.set).toHaveBeenCalledWith({
          dailyMazes: { '2024-03-15': 1 }
        });
        expect(result).toBe(1);
      });

      it('should preserve other days when incrementing today', async () => {
        const dailyMazes = {
          '2024-03-10': 8,
          '2024-03-11': 12,
          '2024-03-12': 6,
          '2024-03-13': 9,
          '2024-03-14': 5
        };
        mockStorage.get.mockResolvedValue({ dailyMazes });

        const result = await store.incrementTodayMazeCount();

        expect(mockStorage.set).toHaveBeenCalledWith({
          dailyMazes: {
            '2024-03-10': 8,   // All preserved
            '2024-03-11': 12,
            '2024-03-12': 6,
            '2024-03-13': 9,
            '2024-03-14': 5,
            '2024-03-15': 1    // New entry for today
          }
        });
        expect(result).toBe(1);
      });

      it('should handle storage get errors gracefully', async () => {
        mockStorage.get.mockRejectedValue(new Error('Storage error'));

        await expect(store.incrementTodayMazeCount()).rejects.toThrow('Storage error');
      });

      it('should handle storage set errors gracefully', async () => {
        mockStorage.get.mockResolvedValue({ dailyMazes: {} });
        mockStorage.set.mockRejectedValue(new Error('Storage set error'));

        await expect(store.incrementTodayMazeCount()).rejects.toThrow('Storage set error');
      });
    });

    describe('recordTodayTabLimit', () => {
      it('should record tab limit for today', async () => {
        const dailyTabLimits = { '2024-03-14': 10 };
        mockStorage.get.mockResolvedValue({ dailyTabLimits });

        await store.recordTodayTabLimit(15);

        expect(mockStorage.set).toHaveBeenCalledWith({
          dailyTabLimits: { '2024-03-14': 10, '2024-03-15': 15 }
        });
      });
    });

    describe('incrementTodayBlockedCount', () => {
      it('should increment blocked count for today', async () => {
        const dailyBlockedAttempts = { '2024-03-15': 2 };
        mockStorage.get.mockResolvedValue({ dailyBlockedAttempts });

        const result = await store.incrementTodayBlockedCount();

        expect(mockStorage.set).toHaveBeenCalledWith({
          dailyBlockedAttempts: { '2024-03-15': 3 }
        });
        expect(result).toBe(3);
      });
    });

    describe('cross-day behavior', () => {
      it('should handle different days independently for maze counts', async () => {
        // Mock getTodayKey to simulate different days
        const originalGetTodayKey = store.getTodayKey;

        // Test March 15th
        store.getTodayKey = () => '2024-03-15';
        mockStorage.get.mockResolvedValue({
          dailyMazes: { '2024-03-15': 5 }
        });

        let count = await store.getTodayMazeCount();
        expect(count).toBe(5);

        // Switch to March 16th
        store.getTodayKey = () => '2024-03-16';

        count = await store.getTodayMazeCount();
        expect(count).toBe(0); // Should be 0 for the new day

        // Restore original method
        store.getTodayKey = originalGetTodayKey;
      });

      it('should create separate entries when incrementing on different days', async () => {
        const originalGetTodayKey = store.getTodayKey;

        // Start with March 15th
        store.getTodayKey = () => '2024-03-15';
        mockStorage.get.mockResolvedValue({
          dailyMazes: { '2024-03-15': 3 }
        });

        await store.incrementTodayMazeCount();

        expect(mockStorage.set).toHaveBeenCalledWith({
          dailyMazes: { '2024-03-15': 4 }
        });

        // Switch to next day (March 16th)
        store.getTodayKey = () => '2024-03-16';

        // Mock the storage to return the updated data from previous day
        mockStorage.get.mockResolvedValue({
          dailyMazes: { '2024-03-15': 4 }
        });

        await store.incrementTodayMazeCount();

        // Should create a new entry for the new day
        expect(mockStorage.set).toHaveBeenLastCalledWith({
          dailyMazes: {
            '2024-03-15': 4,  // Previous day preserved
            '2024-03-16': 1   // New day starts at 1
          }
        });

        // Restore original method
        store.getTodayKey = originalGetTodayKey;
      });
    });

    describe('getDailyTrackingData', () => {
      it('should return all daily tracking data', async () => {
        const mockData = {
          dailyMazes: { '2024-03-15': 5 },
          dailyTabLimits: { '2024-03-15': 15 },
          dailyBlockedAttempts: { '2024-03-15': 2 }
        };
        mockStorage.get.mockResolvedValue(mockData);

        const result = await store.getDailyTrackingData();

        expect(mockStorage.get).toHaveBeenCalledWith([
          'dailyMazes', 'dailyTabLimits', 'dailyBlockedAttempts'
        ]);
        expect(result).toEqual(mockData);
      });

      it('should return empty objects for missing data', async () => {
        mockStorage.get.mockResolvedValue({});

        const result = await store.getDailyTrackingData();

        expect(result).toEqual({
          dailyMazes: {},
          dailyTabLimits: {},
          dailyBlockedAttempts: {}
        });
      });
    });
  });


  describe('Analytics Operations', () => {
    describe('logLimitHitTimestamp', () => {
      it('should add timestamp to array', async () => {
        const existingTimestamps = [1000, 2000];
        mockStorage.get.mockResolvedValue({ limitHitTimestamps: existingTimestamps });

        const beforeCall = Date.now();
        const result = await store.logLimitHitTimestamp();
        const afterCall = Date.now();

        const setCall = mockStorage.set.mock.calls[0][0];
        expect(setCall.limitHitTimestamps).toHaveLength(3);
        expect(setCall.limitHitTimestamps[0]).toBe(1000);
        expect(setCall.limitHitTimestamps[1]).toBe(2000);
        expect(setCall.limitHitTimestamps[2]).toBeGreaterThanOrEqual(beforeCall);
        expect(setCall.limitHitTimestamps[2]).toBeLessThanOrEqual(afterCall);
        expect(result).toBe(setCall.limitHitTimestamps[2]);
      });

      it('should limit to 100 timestamps', async () => {
        const existingTimestamps = Array.from({ length: 100 }, (_, i) => i);
        mockStorage.get.mockResolvedValue({ limitHitTimestamps: existingTimestamps });

        await store.logLimitHitTimestamp();

        const setCall = mockStorage.set.mock.calls[0][0];
        expect(setCall.limitHitTimestamps).toHaveLength(100);
        expect(setCall.limitHitTimestamps[0]).toBe(1); // First element removed
      });
    });

    describe('setTimestamp', () => {
      it('should set timestamp with provided value', async () => {
        const timestamp = 1234567890;

        await store.setTimestamp('lastAction', timestamp);

        expect(mockStorage.set).toHaveBeenCalledWith({ lastAction: timestamp });
      });

      it('should use current time if no timestamp provided', async () => {
        const beforeCall = Date.now();

        await store.setTimestamp('lastAction');

        const setCall = mockStorage.set.mock.calls[0][0];
        expect(setCall.lastAction).toBeGreaterThanOrEqual(beforeCall);
        expect(setCall.lastAction).toBeLessThanOrEqual(Date.now());
      });
    });

    describe('getLimitHitTimestamps', () => {
      it('should return timestamps array', async () => {
        const timestamps = [1000, 2000, 3000];
        mockStorage.get.mockResolvedValue({ limitHitTimestamps: timestamps });

        const result = await store.getLimitHitTimestamps();

        expect(result).toEqual(timestamps);
        expect(mockStorage.get).toHaveBeenCalledWith(['limitHitTimestamps']);
      });

      it('should return empty array if no timestamps', async () => {
        mockStorage.get.mockResolvedValue({});

        const result = await store.getLimitHitTimestamps();

        expect(result).toEqual([]);
      });

      it('should handle storage errors gracefully', async () => {
        const error = new Error('Storage error');
        mockStorage.get.mockRejectedValue(error);

        const result = await store.getLimitHitTimestamps();

        expect(result).toEqual([]);
      });
    });

    describe('calculatePeakActivityHour', () => {
      it('should return null if less than 10 timestamps', async () => {
        const timestamps = Array.from({ length: 9 }, (_, i) =>
          new Date(2023, 0, 1, 10, 0, 0).getTime() + (i * 60000) // 9 timestamps at 10 AM
        );
        mockStorage.get.mockResolvedValue({ limitHitTimestamps: timestamps });

        const result = await store.calculatePeakActivityHour();

        expect(result).toBeNull();
      });

      it('should calculate peak hour correctly with sufficient data', async () => {
        // Create timestamps: 5 at 10 AM, 8 at 2 PM, 3 at 6 PM
        const timestamps = [
          ...Array.from({ length: 5 }, () => new Date(2023, 0, 1, 10, 0, 0).getTime()),
          ...Array.from({ length: 8 }, () => new Date(2023, 0, 1, 14, 0, 0).getTime()),
          ...Array.from({ length: 3 }, () => new Date(2023, 0, 1, 18, 0, 0).getTime())
        ];
        mockStorage.get.mockResolvedValue({ limitHitTimestamps: timestamps });

        const result = await store.calculatePeakActivityHour();

        expect(result).toEqual({
          hour: 14,
          count: 8,
          totalHits: 16
        });
      });

      it('should handle ties by returning first hour with max count', async () => {
        // Create equal hits at 10 AM and 2 PM
        const timestamps = [
          ...Array.from({ length: 5 }, () => new Date(2023, 0, 1, 10, 0, 0).getTime()),
          ...Array.from({ length: 5 }, () => new Date(2023, 0, 1, 14, 0, 0).getTime())
        ];
        mockStorage.get.mockResolvedValue({ limitHitTimestamps: timestamps });

        const result = await store.calculatePeakActivityHour();

        expect(result.hour).toBe(10); // First occurrence should win
        expect(result.count).toBe(5);
      });

      it('should handle midnight hour correctly', async () => {
        const timestamps = Array.from({ length: 10 }, () =>
          new Date(2023, 0, 1, 0, 0, 0).getTime()
        );
        mockStorage.get.mockResolvedValue({ limitHitTimestamps: timestamps });

        const result = await store.calculatePeakActivityHour();

        expect(result.hour).toBe(0);
        expect(result.count).toBe(10);
        expect(result.totalHits).toBe(10);
      });

      it('should handle storage errors gracefully', async () => {
        const error = new Error('Storage error');
        mockStorage.get.mockRejectedValue(error);

        const result = await store.calculatePeakActivityHour();

        expect(result).toBeNull();
      });
    });


    describe('getExtendedStatistics integration', () => {
      it('should include peak activity hour in extended stats', async () => {
        // Mock basic stats
        mockStorage.get.mockImplementation(async (keys) => {
          if (keys.includes('limitHitTimestamps')) {
            return {
              limitHitTimestamps: Array.from({ length: 15 }, () =>
                new Date(2023, 0, 1, 14, 0, 0).getTime()
              )
            };
          }
          return {
            mazesCompleted: 10,
            blockedAttempts: 15,
            tabLimit: 5,
            installDate: Date.now(),
            dailyMazes: {},
            dailyTabLimits: {},
            dailyBlockedAttempts: {}
          };
        });

        const result = await store.getExtendedStatistics();

        expect(result.peakActivityHour).toEqual({
          hour: 14,
          count: 15,
          totalHits: 15
        });
      });

      it('should handle null peak activity in extended stats', async () => {
        mockStorage.get.mockImplementation(async (keys) => {
          if (keys.includes('limitHitTimestamps')) {
            return { limitHitTimestamps: [] }; // Insufficient data
          }
          return {
            mazesCompleted: 10,
            blockedAttempts: 15,
            tabLimit: 5,
            installDate: Date.now(),
            dailyMazes: {},
            dailyTabLimits: {},
            dailyBlockedAttempts: {}
          };
        });

        const result = await store.getExtendedStatistics();

        expect(result.peakActivityHour).toBeNull();
      });
    });
  });


  describe('Initialization & Setup', () => {
    describe('initializeDefaults', () => {
      it('should initialize install date and tab limit', async () => {
        mockStorage.get.mockResolvedValueOnce({}); // For initializeInstallDate
        mockStorage.get.mockResolvedValueOnce({ tabLimit: TAB_LIMITS.DEFAULT }); // For getTabLimit

        const result = await store.initializeDefaults();

        expect(result).toBe(true);
        expect(mockStorage.set).toHaveBeenCalledWith(
          expect.objectContaining({ installDate: expect.any(Number) })
        );
        expect(mockStorage.set).toHaveBeenCalledWith({ tabLimit: TAB_LIMITS.DEFAULT });
      });
    });

    describe('exportAllData', () => {
      it('should export all storage data with timestamp', async () => {
        const mockData = { tabLimit: 15, mazesCompleted: 5 };
        mockStorage.get.mockResolvedValue(mockData);

        const beforeCall = new Date().toISOString();
        const result = await store.exportAllData();
        const afterCall = new Date().toISOString();

        expect(mockStorage.get).toHaveBeenCalledWith(null);
        expect(result.data).toEqual(mockData);
        expect(result.exportDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(result.exportDate >= beforeCall && result.exportDate <= afterCall).toBe(true);
      });
    });
  });

  describe('getExtendedStatistics', () => {
    beforeEach(() => {
      const mockDate = new Date('2024-03-15T10:30:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    });

    afterEach(() => {
      global.Date.mockRestore();
    });

    it('should return combined statistics and daily data', async () => {
      // Mock all the async calls in the correct order they're made
      const basicStats = {
        mazesCompleted: 25,
        blockedAttempts: 10,
        tabLimit: 15,
        installDate: 1640995200000
      };
      const dailyData = {
        dailyMazes: { '2024-03-15': 5 },
        dailyTabLimits: { '2024-03-15': 15 },
        dailyBlockedAttempts: { '2024-03-15': 2 }
      };

      // Setup mocks for all calls in getExtendedStatistics
      mockStorage.get
        .mockResolvedValueOnce(basicStats) // getStatistics call
        .mockResolvedValueOnce(dailyData)  // getDailyTrackingData call
        .mockResolvedValueOnce({ dailyMazes: { '2024-03-15': 5 } }); // getTodayMazeCount call

      const result = await store.getExtendedStatistics();

      expect(result).toEqual({
        ...basicStats,
        dailyMazesCompleted: 5,
        peakActivityHour: null, // No timestamps, so null
        ...dailyData
      });
    });
  });
});
