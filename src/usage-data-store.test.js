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
      remove: jest.fn(),
      clear: jest.fn()
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

        expect(mockStorage.get).toHaveBeenCalledWith(UsageDataStore.getSchemaKeys());
        expect(result.data).toEqual(mockData);
        expect(result.exportDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(result.exportDate >= beforeCall && result.exportDate <= afterCall).toBe(true);
      });

      it('should only request schema-compliant properties from storage', async () => {
        const mockData = {
          mazesCompleted: 100,
          blockedAttempts: 50
        };
        mockStorage.get.mockResolvedValue(mockData);

        const result = await store.exportAllData();

        // Verify only Tab Keeper schema properties are requested
        expect(mockStorage.get).toHaveBeenCalledWith(UsageDataStore.getSchemaKeys());
        
        // Verify export contains only the returned schema properties
        expect(result.data).toEqual({
          mazesCompleted: 100,
          blockedAttempts: 50
        });
        expect(result.exportDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });

      it('should have consistent schema between export and validation', () => {
        // Verify that the schema used for export keys matches the validation schema
        const schemaKeys = UsageDataStore.getSchemaKeys();
        const validationSchema = UsageDataStore.TAB_KEEPER_SCHEMA;
        
        // All export keys should exist in validation schema
        schemaKeys.forEach(key => {
          expect(validationSchema[key]).toBeDefined();
        });
        
        // All validation schema keys should be in export keys
        Object.keys(validationSchema).forEach(key => {
          expect(schemaKeys).toContain(key);
        });
        
        // Schema should contain expected Tab Keeper properties
        expect(schemaKeys).toEqual(expect.arrayContaining([
          'mazesCompleted', 'blockedAttempts', 'tabLimit', 'installDate',
          'dailyMazes', 'dailyTabLimits', 'dailyBlockedAttempts', 
          'limitHitTimestamps', 'importDate', 'originalExportDate'
        ]));
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

  describe('importAllData', () => {
    it('should successfully import valid data and replace existing data', async () => {
      // Setup existing data
      mockStorage.get.mockResolvedValueOnce({ blockedAttempts: 5 });
      await store.incrementBlockedAttempts();
      mockStorage.get.mockResolvedValueOnce({ mazesCompleted: 3 });
      await store.incrementMazesCompleted();
      mockStorage.set.mockClear(); // Clear previous calls

      const importData = {
        exportDate: '2024-01-15T10:30:00.000Z',
        data: {
          mazesCompleted: 50,
          blockedAttempts: 100,
          installDate: 1704067200000,
          tabLimit: 5,
          limitHitTimestamps: [1704067800000, 1704154200000],
          dailyMazes: { '2024-01-15': 10, '2024-01-16': 8 },
          dailyBlockedAttempts: { '2024-01-15': 20 }
        }
      };

      const result = await store.importAllData(importData);

      expect(result).toBe(true);
      expect(mockStorage.clear).toHaveBeenCalledTimes(1);
      expect(mockStorage.set).toHaveBeenCalledWith(importData.data);
      expect(mockStorage.set).toHaveBeenCalledWith({
        importDate: expect.any(String),
        originalExportDate: '2024-01-15T10:30:00.000Z'
      });
    });

    it('should reject null or undefined import data', async () => {
      await expect(store.importAllData(null)).rejects.toThrow('Invalid import data: must be an object');
      await expect(store.importAllData(undefined)).rejects.toThrow('Invalid import data: must be an object');
    });

    it('should reject non-object import data', async () => {
      await expect(store.importAllData('string')).rejects.toThrow('Invalid import data: must be an object');
      await expect(store.importAllData(123)).rejects.toThrow('Invalid import data: must be an object');
      await expect(store.importAllData([])).rejects.toThrow('Invalid import data: must be an object');
    });

    it('should reject import data missing data property', async () => {
      const invalidData = {
        exportDate: '2024-01-15T10:30:00.000Z'
        // missing data property
      };

      await expect(store.importAllData(invalidData)).rejects.toThrow('Invalid import data: missing or invalid data property');
    });

    it('should reject import data with invalid data property', async () => {
      const invalidData = {
        exportDate: '2024-01-15T10:30:00.000Z',
        data: 'not an object'
      };

      await expect(store.importAllData(invalidData)).rejects.toThrow('Invalid import data: missing or invalid data property');
    });

    it('should reject import data missing exportDate', async () => {
      const invalidData = {
        data: { totalMazesCompleted: 10 }
        // missing exportDate
      };

      await expect(store.importAllData(invalidData)).rejects.toThrow('Invalid import data: missing exportDate');
    });

    it('should reject import data with invalid exportDate', async () => {
      const invalidData = {
        exportDate: 'not-a-date',
        data: { totalMazesCompleted: 10 }
      };

      await expect(store.importAllData(invalidData)).rejects.toThrow('Invalid import data: exportDate is not a valid date');
    });

    it('should handle storage.clear failure', async () => {
      const importData = {
        exportDate: '2024-01-15T10:30:00.000Z',
        data: { mazesCompleted: 10 }
      };

      mockStorage.clear.mockRejectedValue(new Error('Storage clear failed'));

      await expect(store.importAllData(importData)).rejects.toThrow('Storage clear failed');
    });

    it('should handle storage.set failure', async () => {
      const importData = {
        exportDate: '2024-01-15T10:30:00.000Z',
        data: { mazesCompleted: 10 }
      };

      mockStorage.set.mockRejectedValue(new Error('Storage set failed'));

      await expect(store.importAllData(importData)).rejects.toThrow('Storage set failed');
    });

    it('should import empty data object', async () => {
      const importData = {
        exportDate: '2024-01-15T10:30:00.000Z',
        data: {}
      };

      const result = await store.importAllData(importData);

      expect(result).toBe(true);
      expect(mockStorage.clear).toHaveBeenCalledTimes(1);
      expect(mockStorage.set).toHaveBeenCalledWith({});
    });

    it('should preserve import metadata', async () => {
      const importData = {
        exportDate: '2024-01-15T10:30:00.000Z',
        data: { mazesCompleted: 25 }
      };

      await store.importAllData(importData);

      // Check that import metadata was added
      const metadataCall = mockStorage.set.mock.calls.find(call =>
        call[0].importDate && call[0].originalExportDate
      );

      expect(metadataCall).toBeTruthy();
      expect(metadataCall[0].originalExportDate).toBe('2024-01-15T10:30:00.000Z');
      expect(metadataCall[0].importDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle different date formats in exportDate', async () => {
      const importData = {
        exportDate: '2024-01-15T10:30:00Z', // Different format (no milliseconds)
        data: { mazesCompleted: 15 }
      };

      const result = await store.importAllData(importData);
      expect(result).toBe(true);
    });

    it('should completely replace existing data', async () => {
      // Setup existing data with multiple properties
      const existingData = {
        totalMazesCompleted: 100,
        totalBlockedAttempts: 200,
        existingProperty: 'should be removed'
      };
      mockStorage.get.mockResolvedValue(existingData);

      const importData = {
        exportDate: '2024-01-15T10:30:00.000Z',
        data: {
          mazesCompleted: 50, // Different value
          blockedAttempts: 25 // Valid property
          // Note: existingProperty not included (will be removed)
        }
      };

      await store.importAllData(importData);

      // Verify clear was called (removes all existing data)
      expect(mockStorage.clear).toHaveBeenCalledTimes(1);

      // Verify only the imported data was set
      expect(mockStorage.set).toHaveBeenCalledWith({
        mazesCompleted: 50,
        blockedAttempts: 25
      });
    });
  });

  describe('validateTabKeeperData', () => {
    it('should accept valid empty data object', () => {
      expect(() => store.validateTabKeeperData({})).not.toThrow();
    });

    it('should accept valid complete data object', () => {
      const validData = {
        mazesCompleted: 50,
        blockedAttempts: 100,
        tabLimit: 5,
        installDate: 1704067200000,
        dailyMazes: { '2024-01-15': 10, '2024-01-16': 5 },
        dailyTabLimits: { '2024-01-15': 5, '2024-01-16': 3 },
        dailyBlockedAttempts: { '2024-01-15': 20 },
        limitHitTimestamps: [1704067800000, 1704154200000],
        importDate: '2024-01-15T10:30:00.000Z',
        originalExportDate: '2024-01-14T15:20:00.000Z'
      };

      expect(() => store.validateTabKeeperData(validData)).not.toThrow();
    });

    it('should reject non-object data', () => {
      expect(() => store.validateTabKeeperData(null)).toThrow('Data must be an object');
      expect(() => store.validateTabKeeperData('string')).toThrow('Data must be an object');
      expect(() => store.validateTabKeeperData(123)).toThrow('Data must be an object');
      expect(() => store.validateTabKeeperData([])).toThrow('Data must be an object');
    });

    it('should reject unknown properties', () => {
      const invalidData = {
        mazesCompleted: 10,
        unknownProperty: 'test',
        anotherUnknown: 123
      };

      expect(() => store.validateTabKeeperData(invalidData))
        .toThrow('Unknown properties detected (not Tab Keeper data): unknownProperty, anotherUnknown');
    });

    describe('number validation', () => {
      it('should validate mazesCompleted', () => {
        expect(() => store.validateTabKeeperData({ mazesCompleted: 'not a number' }))
          .toThrow("Property 'mazesCompleted' must be a finite number");

        expect(() => store.validateTabKeeperData({ mazesCompleted: -5 }))
          .toThrow("Property 'mazesCompleted' must be >= 0");

        expect(() => store.validateTabKeeperData({ mazesCompleted: Infinity }))
          .toThrow("Property 'mazesCompleted' must be a finite number");

        expect(() => store.validateTabKeeperData({ mazesCompleted: NaN }))
          .toThrow("Property 'mazesCompleted' must be a finite number");

        expect(() => store.validateTabKeeperData({ mazesCompleted: 50 })).not.toThrow();
      });

      it('should validate blockedAttempts', () => {
        expect(() => store.validateTabKeeperData({ blockedAttempts: -1 }))
          .toThrow("Property 'blockedAttempts' must be >= 0");

        expect(() => store.validateTabKeeperData({ blockedAttempts: 100 })).not.toThrow();
      });

      it('should validate tabLimit within bounds', () => {
        expect(() => store.validateTabKeeperData({ tabLimit: 0 }))
          .toThrow("Property 'tabLimit' must be >= 2");

        expect(() => store.validateTabKeeperData({ tabLimit: 10 }))
          .toThrow("Property 'tabLimit' must be <= 8");

        expect(() => store.validateTabKeeperData({ tabLimit: 5 })).not.toThrow();
      });

      it('should validate installDate', () => {
        expect(() => store.validateTabKeeperData({ installDate: -1 }))
          .toThrow("Property 'installDate' must be >= 0");

        expect(() => store.validateTabKeeperData({ installDate: Date.now() })).not.toThrow();
      });
    });

    describe('string validation', () => {
      it('should validate date strings', () => {
        expect(() => store.validateTabKeeperData({ importDate: 123 }))
          .toThrow("Property 'importDate' must be a string");

        expect(() => store.validateTabKeeperData({ importDate: 'not-a-date' }))
          .toThrow("Property 'importDate' must be a valid ISO date string");

        expect(() => store.validateTabKeeperData({ originalExportDate: 'invalid-date-format' }))
          .toThrow("Property 'originalExportDate' must be a valid ISO date string");

        expect(() => store.validateTabKeeperData({ importDate: '2024-01-15T10:30:00.000Z' })).not.toThrow();
        expect(() => store.validateTabKeeperData({ originalExportDate: '2024-01-15T10:30:00Z' })).not.toThrow();
      });
    });

    describe('object validation', () => {
      it('should validate dailyMazes object', () => {
        expect(() => store.validateTabKeeperData({ dailyMazes: 'not an object' }))
          .toThrow("Property 'dailyMazes' must be an object");

        expect(() => store.validateTabKeeperData({ dailyMazes: [] }))
          .toThrow("Property 'dailyMazes' must be an object");

        // Note: null is skipped for optional properties, so this won't throw
        expect(() => store.validateTabKeeperData({ dailyMazes: {} })).not.toThrow();
      });

      it('should validate date-keyed objects have proper keys', () => {
        expect(() => store.validateTabKeeperData({ dailyMazes: { 'invalid-key': 5 } }))
          .toThrow("Property 'dailyMazes' must have YYYY-MM-DD date keys, got: invalid-key");

        expect(() => store.validateTabKeeperData({ dailyTabLimits: { '2024-1-1': 3 } }))
          .toThrow("Property 'dailyTabLimits' must have YYYY-MM-DD date keys, got: 2024-1-1");

        expect(() => store.validateTabKeeperData({ dailyBlockedAttempts: { '24-01-01': 2 } }))
          .toThrow("Property 'dailyBlockedAttempts' must have YYYY-MM-DD date keys, got: 24-01-01");
      });

      it('should validate date-keyed objects have proper values', () => {
        expect(() => store.validateTabKeeperData({ dailyMazes: { '2024-01-15': 'not a number' } }))
          .toThrow("Property 'dailyMazes' values must be non-negative numbers, got: not a number for key 2024-01-15");

        expect(() => store.validateTabKeeperData({ dailyTabLimits: { '2024-01-15': -1 } }))
          .toThrow("Property 'dailyTabLimits' values must be non-negative numbers, got: -1 for key 2024-01-15");

        expect(() => store.validateTabKeeperData({ dailyBlockedAttempts: { '2024-01-15': Infinity } }))
          .toThrow("Property 'dailyBlockedAttempts' values must be non-negative numbers, got: Infinity for key 2024-01-15");

        expect(() => store.validateTabKeeperData({
          dailyMazes: { '2024-01-15': 10, '2024-01-16': 5 }
        })).not.toThrow();
      });
    });

    describe('array validation', () => {
      it('should validate limitHitTimestamps array', () => {
        expect(() => store.validateTabKeeperData({ limitHitTimestamps: 'not an array' }))
          .toThrow("Property 'limitHitTimestamps' must be an array");

        expect(() => store.validateTabKeeperData({ limitHitTimestamps: {} }))
          .toThrow("Property 'limitHitTimestamps' must be an array");
      });

      it('should enforce array length limits', () => {
        const tooManyTimestamps = Array.from({ length: 101 }, () => Date.now());

        expect(() => store.validateTabKeeperData({ limitHitTimestamps: tooManyTimestamps }))
          .toThrow("Property 'limitHitTimestamps' array length must be <= 100, got: 101");

        const validTimestamps = Array.from({ length: 50 }, () => Date.now());
        expect(() => store.validateTabKeeperData({ limitHitTimestamps: validTimestamps })).not.toThrow();
      });

      it('should validate array item types', () => {
        expect(() => store.validateTabKeeperData({ limitHitTimestamps: ['not a number', 123] }))
          .toThrow("Property 'limitHitTimestamps' array items must be finite numbers, got: string at index 0");

        expect(() => store.validateTabKeeperData({ limitHitTimestamps: [123, Infinity] }))
          .toThrow("Property 'limitHitTimestamps' array items must be finite numbers, got: number at index 1");

        expect(() => store.validateTabKeeperData({ limitHitTimestamps: [1704067800000, 1704154200000] }))
          .not.toThrow();
      });
    });

    describe('null and undefined handling', () => {
      it('should skip null/undefined for optional properties', () => {
        expect(() => store.validateTabKeeperData({ mazesCompleted: null })).not.toThrow();
        expect(() => store.validateTabKeeperData({ dailyMazes: undefined })).not.toThrow();
        expect(() => store.validateTabKeeperData({ dailyMazes: null })).not.toThrow();
      });
    });
  });

  describe('importAllData with validation', () => {
    it('should reject random JSON that is not Tab Keeper data', async () => {
      const randomJson = {
        exportDate: '2024-01-15T10:30:00.000Z',
        data: {
          randomProperty: 'not tab keeper data',
          anotherProperty: { nested: 'object' },
          numbers: [1, 2, 3]
        }
      };

      await expect(store.importAllData(randomJson))
        .rejects.toThrow('Unknown properties detected (not Tab Keeper data): randomProperty, anotherProperty, numbers');
    });

    it('should reject data with invalid values', async () => {
      const invalidData = {
        exportDate: '2024-01-15T10:30:00.000Z',
        data: {
          mazesCompleted: -5, // Invalid: negative
          tabLimit: 20        // Invalid: above max
        }
      };

      await expect(store.importAllData(invalidData))
        .rejects.toThrow("Property 'mazesCompleted' must be >= 0");
    });

    it('should accept valid Tab Keeper data and proceed with import', async () => {
      const validData = {
        exportDate: '2024-01-15T10:30:00.000Z',
        data: {
          mazesCompleted: 25,
          blockedAttempts: 50,
          tabLimit: 5,
          dailyMazes: { '2024-01-15': 3 }
        }
      };

      const result = await store.importAllData(validData);

      expect(result).toBe(true);
      expect(mockStorage.clear).toHaveBeenCalledTimes(1);
      expect(mockStorage.set).toHaveBeenCalledWith(validData.data);
    });
  });

  describe('importAllData transaction safety', () => {
    it('should backup data before import and succeed normally', async () => {
      const existingData = { mazesCompleted: 10, blockedAttempts: 20 };
      const validImportData = {
        exportDate: '2024-01-15T10:30:00.000Z',
        data: { mazesCompleted: 50, tabLimit: 5 }
      };

      // Mock existing data backup
      mockStorage.get.mockResolvedValueOnce(existingData);

      const result = await store.importAllData(validImportData);

      expect(result).toBe(true);
      expect(mockStorage.get).toHaveBeenCalledWith(null); // Backup call
      expect(mockStorage.clear).toHaveBeenCalledTimes(1);
      expect(mockStorage.set).toHaveBeenCalledWith(validImportData.data);
    });

    it('should rollback to original data if import fails', async () => {
      const existingData = { mazesCompleted: 10, blockedAttempts: 20 };
      const validImportData = {
        exportDate: '2024-01-15T10:30:00.000Z',
        data: { mazesCompleted: 50, tabLimit: 5 }
      };

      // Mock backup call
      mockStorage.get.mockResolvedValueOnce(existingData);

      // Mock import failure
      mockStorage.set.mockRejectedValueOnce(new Error('Storage write failed'));

      // Mock successful rollback
      mockStorage.clear.mockResolvedValue(); // For rollback clear
      mockStorage.set.mockResolvedValueOnce(existingData); // For rollback restore

      await expect(store.importAllData(validImportData))
        .rejects.toThrow('Import failed and was rolled back: Storage write failed');

      // Verify rollback sequence
      expect(mockStorage.get).toHaveBeenCalledWith(null); // Initial backup
      expect(mockStorage.clear).toHaveBeenCalledTimes(2); // Initial clear + rollback clear
      expect(mockStorage.set).toHaveBeenCalledWith(existingData); // Rollback restore
    });

    it('should handle rollback failure gracefully', async () => {
      const existingData = { mazesCompleted: 10, blockedAttempts: 20 };
      const validImportData = {
        exportDate: '2024-01-15T10:30:00.000Z',
        data: { mazesCompleted: 50, tabLimit: 5 }
      };

      // Mock backup call
      mockStorage.get.mockResolvedValueOnce(existingData);

      // Mock import failure
      mockStorage.set.mockRejectedValueOnce(new Error('Storage write failed'));

      // Mock rollback failure
      mockStorage.set.mockRejectedValueOnce(new Error('Rollback failed'));

      await expect(store.importAllData(validImportData))
        .rejects.toThrow('Import failed and rollback also failed. Data may be lost. Import error: Storage write failed. Rollback error: Rollback failed');

      expect(mockStorage.get).toHaveBeenCalledWith(null); // Backup attempt
    });

    it('should handle backup failure before import', async () => {
      const validImportData = {
        exportDate: '2024-01-15T10:30:00.000Z',
        data: { mazesCompleted: 50, tabLimit: 5 }
      };

      // Mock backup failure
      mockStorage.get.mockRejectedValueOnce(new Error('Cannot read existing data'));

      await expect(store.importAllData(validImportData))
        .rejects.toThrow('Cannot read existing data');

      // Should not proceed to clear/import if backup fails
      expect(mockStorage.clear).not.toHaveBeenCalled();
      expect(mockStorage.set).not.toHaveBeenCalled();
    });

    it('should rollback when metadata addition fails', async () => {
      const existingData = { mazesCompleted: 10, blockedAttempts: 20 };
      const validImportData = {
        exportDate: '2024-01-15T10:30:00.000Z',
        data: { mazesCompleted: 50, tabLimit: 5 }
      };

      // Mock backup call
      mockStorage.get.mockResolvedValueOnce(existingData);

      // Mock successful data import but metadata failure
      mockStorage.set
        .mockResolvedValueOnce(undefined) // Import data succeeds
        .mockRejectedValueOnce(new Error('Metadata write failed')); // Metadata fails

      // Mock successful rollback
      mockStorage.set.mockResolvedValueOnce(existingData); // Rollback restore

      await expect(store.importAllData(validImportData))
        .rejects.toThrow('Import failed and was rolled back: Metadata write failed');

      // Verify complete rollback occurred
      expect(mockStorage.set).toHaveBeenCalledWith(existingData); // Rollback
    });

    it('should preserve original data integrity during rollback', async () => {
      const complexExistingData = {
        mazesCompleted: 75,
        blockedAttempts: 150,
        tabLimit: 3,
        installDate: 1703980800000,
        dailyMazes: { '2024-01-10': 5, '2024-01-11': 3 },
        dailyBlockedAttempts: { '2024-01-10': 12 },
        limitHitTimestamps: [1703980900000, 1703981000000]
      };

      const validImportData = {
        exportDate: '2024-01-15T10:30:00.000Z',
        data: { mazesCompleted: 25, tabLimit: 8 }
      };

      // Mock backup of complex data
      mockStorage.get.mockResolvedValueOnce(complexExistingData);

      // Mock import failure after clear
      mockStorage.set.mockRejectedValueOnce(new Error('Import write failed'));

      // Mock successful rollback
      mockStorage.set.mockResolvedValueOnce(complexExistingData);

      await expect(store.importAllData(validImportData))
        .rejects.toThrow('Import failed and was rolled back: Import write failed');

      // Verify exact original data was restored
      expect(mockStorage.set).toHaveBeenCalledWith(complexExistingData);
    });
  });
});
