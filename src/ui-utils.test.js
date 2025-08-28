/**
 * Tests for UI utility functions
 */

import { formatHourRange } from './ui-utils.js';

describe('UI Utils', () => {
  describe('formatHourRange', () => {
    it('should format early AM hours correctly', () => {
      expect(formatHourRange(1)).toBe('1 AM-2 AM');
      expect(formatHourRange(6)).toBe('6 AM-7 AM');
    });

    it('should format late AM hours correctly', () => {
      expect(formatHourRange(11)).toBe('11 AM-12 PM');
    });

    it('should format early PM hours correctly', () => {
      expect(formatHourRange(13)).toBe('1 PM-2 PM');
      expect(formatHourRange(18)).toBe('6 PM-7 PM');
    });

    it('should format late PM hours correctly', () => {
      expect(formatHourRange(23)).toBe('11 PM-12 AM');
    });

    it('should format noon correctly', () => {
      expect(formatHourRange(12)).toBe('12 PM-1 PM');
    });

    it('should format midnight correctly', () => {
      expect(formatHourRange(0)).toBe('12 AM-1 AM');
    });

    it('should handle edge case of 23 -> 0 transition', () => {
      expect(formatHourRange(23)).toBe('11 PM-12 AM');
    });

    it('should format all 24 hours with valid patterns', () => {
      for (let hour = 0; hour < 24; hour++) {
        const formatted = formatHourRange(hour);
        
        // Verify format pattern: should match "XX AM-XX AM" or "XX PM-XX PM" or mixed
        expect(formatted).toMatch(/^\d{1,2} (AM|PM)-\d{1,2} (AM|PM)$/);
        
        // Should contain exactly one dash
        expect(formatted.split('-')).toHaveLength(2);
      }
    });

    it('should handle key time transitions correctly', () => {
      expect(formatHourRange(11)).toBe('11 AM-12 PM'); // AM to PM (11 AM to noon)
      expect(formatHourRange(23)).toBe('11 PM-12 AM'); // PM to AM (11 PM to midnight)
      expect(formatHourRange(0)).toBe('12 AM-1 AM');   // Midnight to 1 AM
      expect(formatHourRange(12)).toBe('12 PM-1 PM');  // Noon to 1 PM
    });

    it('should produce unique strings for each hour', () => {
      const results = new Set();
      for (let hour = 0; hour < 24; hour++) {
        const formatted = formatHourRange(hour);
        expect(results.has(formatted)).toBe(false); // Should be unique
        results.add(formatted);
      }
      expect(results.size).toBe(24); // All should be unique
    });

    it('should handle boundary values correctly', () => {
      // Test the specific hours that often cause issues
      const testCases = [
        { hour: 0, expected: '12 AM-1 AM' },   // Midnight
        { hour: 1, expected: '1 AM-2 AM' },    // 1 AM
        { hour: 11, expected: '11 AM-12 PM' }, // 11 AM (before noon)
        { hour: 12, expected: '12 PM-1 PM' },  // Noon
        { hour: 13, expected: '1 PM-2 PM' },   // 1 PM
        { hour: 23, expected: '11 PM-12 AM' }  // 11 PM (before midnight)
      ];

      testCases.forEach(({ hour, expected }) => {
        expect(formatHourRange(hour)).toBe(expected);
      });
    });
  });
});