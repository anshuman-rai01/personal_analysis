import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FORECAST_MIN_ACTIVE_DAYS,
  FORECAST_RELIABLE_ACTIVE_DAYS,
  FORECAST_MIN_CSV_ROWS,
  evaluateActiveDays,
  scenarioToModule,
  countCsvDataRows,
  buildInsufficientBody,
} from './thresholds.ts';
import { FORECAST_MIN_ACTIVE_DAYS as ASSISTANT_MIN_DAYS } from './thresholds.ts';

describe('Forecasting Thresholds & Evaluation Suite (Pure Unit Tests)', () => {
  describe('evaluateActiveDays', () => {
    it('returns insufficient for 0 days with 14 remaining', () => {
      const res = evaluateActiveDays(0);
      assert.deepEqual(res, {
        status: 'insufficient',
        allowed: false,
        remaining: 14,
      });
    });

    it('returns insufficient for 13 days with 1 remaining', () => {
      const res = evaluateActiveDays(13);
      assert.deepEqual(res, {
        status: 'insufficient',
        allowed: false,
        remaining: 1,
      });
    });

    it('returns low_confidence for 14 days with 0 remaining and allowed=true', () => {
      const res = evaluateActiveDays(14);
      assert.deepEqual(res, {
        status: 'low_confidence',
        allowed: true,
        remaining: 0,
      });
    });

    it('returns low_confidence for 27 days with 0 remaining and allowed=true', () => {
      const res = evaluateActiveDays(27);
      assert.deepEqual(res, {
        status: 'low_confidence',
        allowed: true,
        remaining: 0,
      });
    });

    it('returns reliable for 28 days with allowed=true', () => {
      const res = evaluateActiveDays(28);
      assert.deepEqual(res, {
        status: 'reliable',
        allowed: true,
        remaining: 0,
      });
    });

    it('returns reliable for 60 days with allowed=true', () => {
      const res = evaluateActiveDays(60);
      assert.deepEqual(res, {
        status: 'reliable',
        allowed: true,
        remaining: 0,
      });
    });

    it('safely handles negative numbers and NaN', () => {
      assert.equal(evaluateActiveDays(-5).allowed, false);
      assert.equal(evaluateActiveDays(NaN).allowed, false);
    });
  });

  describe('countCsvDataRows', () => {
    it('returns 0 for empty or whitespace-only strings', () => {
      assert.equal(countCsvDataRows(''), 0);
      assert.equal(countCsvDataRows('   \n  \r\n  '), 0);
    });

    it('returns 0 for header-only CSV with LF or CRLF', () => {
      assert.equal(countCsvDataRows('date,amount,category\n'), 0);
      assert.equal(countCsvDataRows('date,amount,category\r\n'), 0);
      assert.equal(countCsvDataRows('date,amount,category'), 0);
    });

    it('correctly counts data rows with CRLF and trailing newline', () => {
      const csv = [
        'date,hours,focus',
        '2026-10-01,2,8',
        '2026-10-02,3,7',
        '2026-10-03,1,9',
        '2026-10-04,4,8',
        '2026-10-05,2,7',
      ].join('\r\n') + '\r\n';

      assert.equal(countCsvDataRows(csv), 5);
    });

    it('ignores empty lines interspersed between rows', () => {
      const csv = 'header1,header2\r\n\r\nrow1,val1\r\n\r\nrow2,val2\n\n';
      assert.equal(countCsvDataRows(csv), 2);
    });

    it('counts 14 rows accurately', () => {
      const rows = ['h1,h2'];
      for (let i = 1; i <= 14; i++) {
        rows.push(`2026-10-${String(i).padStart(2, '0')},100`);
      }
      assert.equal(countCsvDataRows(rows.join('\r\n')), 14);
    });
  });

  describe('scenarioToModule', () => {
    it('maps study_career to study', () => {
      assert.equal(scenarioToModule('study_career'), 'study');
    });

    it('maps wealth_accumulation to finance', () => {
      assert.equal(scenarioToModule('wealth_accumulation'), 'finance');
    });

    it('maps lifestyle_habits and lifestyle_balance to habits', () => {
      assert.equal(scenarioToModule('lifestyle_habits'), 'habits');
      assert.equal(scenarioToModule('lifestyle_balance'), 'habits');
    });

    it('returns null for unknown scenarios', () => {
      assert.equal(scenarioToModule('random_scenario'), null);
      assert.equal(scenarioToModule(''), null);
    });
  });

  describe('buildInsufficientBody', () => {
    it('constructs tracked history error body', () => {
      const body = buildInsufficientBody('study', 'tracked', 6, 14);
      assert.equal(body.code, 'INSUFFICIENT_DATA');
      assert.equal(body.module, 'study');
      assert.equal(body.source, 'tracked');
      assert.equal(body.have, 6);
      assert.equal(body.required, 14);
      assert.equal(body.remaining, 8);
      assert.match(body.error, /You have logged 6 of the 14 days of study activity needed/);
      assert.match(body.error, /Log 8 more days to unlock/);
    });

    it('constructs CSV error body', () => {
      const body = buildInsufficientBody('finance', 'csv', 5, 14);
      assert.equal(body.code, 'INSUFFICIENT_DATA');
      assert.equal(body.module, 'finance');
      assert.equal(body.source, 'csv');
      assert.equal(body.have, 5);
      assert.equal(body.required, 14);
      assert.equal(body.remaining, 9);
      assert.match(body.error, /Uploaded CSV has insufficient data rows \(5 rows\)/);
    });
  });

  describe('Single Source of Truth Alignment', () => {
    it('confirms assistant imports and matches the shared constants', () => {
      assert.equal(FORECAST_MIN_ACTIVE_DAYS, 14);
      assert.equal(FORECAST_RELIABLE_ACTIVE_DAYS, 28);
      assert.equal(FORECAST_MIN_CSV_ROWS, 14);
      assert.equal(ASSISTANT_MIN_DAYS, FORECAST_MIN_ACTIVE_DAYS);
    });
  });
});
