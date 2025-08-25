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
        
        expect(mockStorage.remove).toHaveBeenCalledWith(['mazesCompleted', 'blockedAttempts']);
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

  describe('Session Data Operations', () => {
    describe('getMazeSession', () => {
      it('should return stored session data', async () => {
        const sessionData = { difficulty: 5, startTime: Date.now() };
        mockStorage.get.mockResolvedValue({ currentMazeSession: sessionData });
        
        const result = await store.getMazeSession();
        
        expect(result).toEqual(sessionData);
      });

      it('should return null if no session data', async () => {
        mockStorage.get.mockResolvedValue({});
        
        const result = await store.getMazeSession();
        
        expect(result).toBeNull();
      });
    });

    describe('setMazeSession', () => {
      it('should store session data', async () => {
        const sessionData = { difficulty: 3, startTime: Date.now() };
        
        await store.setMazeSession(sessionData);
        
        expect(mockStorage.set).toHaveBeenCalledWith({
          currentMazeSession: sessionData
        });
      });
    });

    describe('clearMazeSession', () => {
      it('should remove session data', async () => {
        await store.clearMazeSession();
        
        expect(mockStorage.remove).toHaveBeenCalledWith(['currentMazeSession']);
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
  });

  describe('UI State Operations', () => {
    describe('setMazeAlert', () => {
      it('should set alert state to show', async () => {
        const beforeCall = Date.now();
        
        await store.setMazeAlert(true);
        
        const setCall = mockStorage.set.mock.calls[0][0];
        expect(setCall.showMazeAlert).toBe(true);
        expect(setCall.mazeAlertTime).toBeGreaterThanOrEqual(beforeCall);
        expect(setCall.mazeAlertTime).toBeLessThanOrEqual(Date.now());
      });

      it('should clear alert state', async () => {
        await store.setMazeAlert(false);
        
        expect(mockStorage.remove).toHaveBeenCalledWith(['showMazeAlert', 'mazeAlertTime']);
      });

      it('should default to show=true', async () => {
        await store.setMazeAlert();
        
        const setCall = mockStorage.set.mock.calls[0][0];
        expect(setCall.showMazeAlert).toBe(true);
      });
    });

    describe('getMazeAlert', () => {
      it('should return alert state', async () => {
        const alertTime = Date.now();
        mockStorage.get.mockResolvedValue({
          showMazeAlert: true,
          mazeAlertTime: alertTime
        });
        
        const result = await store.getMazeAlert();
        
        expect(result).toEqual({
          show: true,
          time: alertTime
        });
      });

      it('should return false state for missing data', async () => {
        mockStorage.get.mockResolvedValue({});
        
        const result = await store.getMazeAlert();
        
        expect(result).toEqual({
          show: false,
          time: null
        });
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
        ...dailyData
      });
    });
  });
});