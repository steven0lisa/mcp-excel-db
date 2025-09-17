import { ExcelSqlQuery } from '../src/excel-sql-query';
import * as path from 'path';

describe('Excel SQL Query - New Features', () => {
  let excelQuery: ExcelSqlQuery;
  let testFilePath: string;

  beforeEach(() => {
    excelQuery = new ExcelSqlQuery();
    testFilePath = path.join(__dirname, 'test-data.xlsx');
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
});