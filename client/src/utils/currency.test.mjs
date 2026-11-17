import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatINR,
  formatPayWithBasis,
  calculateShiftTotal,
  formatEstimatedTotal,
  formatOpenPositions
} from './currency.ts';

describe('Pricing, Currency & Payment Calculation Suite', () => {
  describe('formatINR', () => {
    it('formats numbers into Indian Rupee format correctly', () => {
      assert.match(formatINR(800), /₹\s*800/);
      assert.match(formatINR(5600), /₹\s*5,600/);
      assert.equal(formatINR(0), '₹0');
      assert.equal(formatINR(null), '₹0');
      assert.equal(formatINR('invalid'), '₹0');
    });
  });

  describe('calculateShiftTotal & formatEstimatedTotal', () => {
    it('calculates hourly payment as hourly rate × shift duration', () => {
      // Example: ₹800 × 7 hours = ₹5,600
      const total = calculateShiftTotal(800, 'hourly', 7);
      assert.equal(total, 5600);
      assert.match(formatEstimatedTotal(800, 'hourly', 7), /₹\s*5,600\s*\(7 hrs\)/);
    });

    it('keeps per-shift payment at the flat rate without multiplying by hours', () => {
      // Example: ₹800 / shift for 7 hours remains flat ₹800
      const total = calculateShiftTotal(800, 'shift', 7);
      assert.equal(total, 800);
      assert.match(formatEstimatedTotal(800, 'shift', 7), /₹\s*800\s*\(flat \/ shift\)/);
    });

    it('keeps daily payment at the flat rate', () => {
      const total = calculateShiftTotal(650, 'daily', 8);
      assert.equal(total, 650);
      assert.match(formatEstimatedTotal(650, 'daily', 8), /₹\s*650\s*\(flat \/ day\)/);
    });

    it('handles legacy jobs without payment-basis safely by defaulting to hourly', () => {
      const total = calculateShiftTotal(200, undefined, 4);
      assert.equal(total, 800);
    });

    it('handles negative or invalid values safely', () => {
      assert.equal(calculateShiftTotal(-500, 'hourly', 5), 0);
      assert.equal(calculateShiftTotal(null, 'shift', 5), 0);
      assert.equal(calculateShiftTotal(0, 'hourly', 5), 0);
    });
  });

  describe('formatPayWithBasis', () => {
    it('formats hourly rates with slash or per', () => {
      assert.match(formatPayWithBasis(150, 'hourly', 'slash'), /₹\s*150\s*\/\s*hr/);
      assert.match(formatPayWithBasis(150, 'hourly', 'per'), /₹\s*150\s*per\s*hour/);
    });

    it('formats per-shift rates correctly', () => {
      assert.match(formatPayWithBasis(800, 'shift', 'slash'), /₹\s*800\s*\/\s*shift/);
      assert.match(formatPayWithBasis(800, 'shift', 'per'), /₹\s*800\s*per\s*shift/);
    });
  });

  describe('formatOpenPositions', () => {
    it('formats 0 open positions correctly', () => {
      assert.equal(formatOpenPositions(0), 'Showing 0 open positions');
    });

    it('formats 1 open position with singular noun', () => {
      assert.equal(formatOpenPositions(1), 'Showing 1 open position');
    });

    it('formats 2 open positions with plural noun', () => {
      assert.equal(formatOpenPositions(2), 'Showing 2 open positions');
    });

    it('formats 15 open positions with plural noun', () => {
      assert.equal(formatOpenPositions(15), 'Showing 15 open positions');
    });
  });
});
