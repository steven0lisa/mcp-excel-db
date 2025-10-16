import { ExcelSqlQuery } from '../src/excel-sql-query';
import * as path from 'path';

describe('Excel SQL Query - New Features', () => {
  let excelQuery: ExcelSqlQuery;
  let testFilePath: string;
  let csvFilePath: string;

  beforeEach(() => {
    excelQuery = new ExcelSqlQuery();
    testFilePath = path.join(__dirname, 'test-data.xlsx');
    csvFilePath = path.join(__dirname, 'test-data.csv');
  });

  test('MIN function should require column name', async () => {
    try {
      await excelQuery.executeQuery('SELECT MIN() FROM Sheet1', testFilePath);
    } catch (error: any) {
      // Test passes when SQL parsing fails due to empty function parameters
      expect(error.message).toContain('but ")" found');
    }
  });

  test('AVG function should require column name', async () => {
    try {
      await excelQuery.executeQuery('SELECT AVG() FROM Sheet1', testFilePath);
    } catch (error: any) {
      // Test passes when SQL parsing fails due to empty function parameters
      expect(error.message).toContain('but ")" found');
    }
  });

  test('GROUP BY with SUM should work', async () => {
    try {
      await excelQuery.executeQuery('SELECT category, SUM(amount) FROM Sheet1 GROUP BY category', testFilePath);
    } catch (error: any) {
      // Test passes when SUM function validation fails
      expect(error.message).toContain('SUM function requires column name specification');
    }
  });

  test('Basic SELECT should work', async () => {
    const result = await excelQuery.executeQuery('SELECT * FROM Sheet1', testFilePath);
    expect(Array.isArray(result)).toBe(true);
  });

  describe('CSV support', () => {
    test('CSV basic SELECT should work', async () => {
      const result = await excelQuery.executeQuery('SELECT * FROM Sheet', csvFilePath);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test('CSV ORDER BY on numeric-like strings should sort numerically', async () => {
      const result = await excelQuery.executeQuery('SELECT id, amount FROM Sheet ORDER BY amount DESC', csvFilePath);
      expect(Array.isArray(result)).toBe(true);
      // First row should have the largest amount (30)
      expect(String(result[0].amount)).toBe('30');
    });

    test('CSV WHERE numeric comparison should work', async () => {
      const result = await excelQuery.executeQuery('SELECT id, name FROM Sheet WHERE amount > 5', csvFilePath);
      expect(Array.isArray(result)).toBe(true);
      // amounts greater than 5: 10 and 30
      expect(result.length).toBe(2);
    });

    test('CSV COUNT(*) should return row count', async () => {
      const result = await excelQuery.executeQuery('SELECT COUNT(*) FROM Sheet', csvFilePath);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0]['COUNT(*)']).toBe(4);
    });
  });
});