import { ExcelSqlQuery } from '../../src/excel-sql-query.ts';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test cases for F-3: Table Aliases
 */
async function testF3TableAliases() {
  const excelQuery = new ExcelSqlQuery();
  const testFilePath = path.join(__dirname, '../test-data.xlsx');
  const results = [];

  console.log('🧪 Testing F-3: Table Aliases');

  try {
    // Get sample data to determine available columns
    const sampleResult = await excelQuery.executeQuery('SELECT * FROM Sheet1 LIMIT 1', testFilePath);
    if (sampleResult.length === 0) {
      console.log('    ⚠️  No data available for testing');
      return results;
    }

    const columns = Object.keys(sampleResult[0]);
    const firstColumn = columns[0];

    // Test 1: Basic table alias with AS keyword
    console.log('  Test 3.1: Table alias with AS keyword');
    const result1 = await excelQuery.executeQuery('SELECT * FROM Sheet1 AS s1', testFilePath);
    console.log(`    ✅ Success: Table alias with AS returned ${result1.length} rows`);
    results.push({ test: 'Table alias with AS', status: 'PASS', rows: result1.length });

    // Test 2: Table alias without AS keyword
    console.log('  Test 3.2: Table alias without AS keyword');
    const result2 = await excelQuery.executeQuery('SELECT * FROM Sheet1 s1', testFilePath);
    console.log(`    ✅ Success: Table alias without AS returned ${result2.length} rows`);
    results.push({ test: 'Table alias without AS', status: 'PASS', rows: result2.length });

    // Test 3: Column reference with table alias
    console.log('  Test 3.3: Column reference with table alias');
    const result3 = await excelQuery.executeQuery(`SELECT s1.${firstColumn} FROM Sheet1 AS s1`, testFilePath);
    console.log(`    ✅ Success: Column reference with alias returned ${result3.length} rows`);
    results.push({ test: 'Column reference with alias', status: 'PASS', rows: result3.length });

    // Test 4: Table alias in WHERE clause
    console.log('  Test 3.4: Table alias in WHERE clause');
    const result4 = await excelQuery.executeQuery(`SELECT s1.${firstColumn} FROM Sheet1 AS s1 WHERE s1.${firstColumn} IS NOT NULL`, testFilePath);
    console.log(`    ✅ Success: Table alias in WHERE returned ${result4.length} rows`);
    results.push({ test: 'Table alias in WHERE', status: 'PASS', rows: result4.length });

    // Test 5: Multiple column references with alias
    if (columns.length >= 2) {
      const secondColumn = columns[1];
      console.log('  Test 3.5: Multiple columns with table alias');
      const result5 = await excelQuery.executeQuery(`SELECT s1.${firstColumn}, s1.${secondColumn} FROM Sheet1 AS s1`, testFilePath);
      console.log(`    ✅ Success: Multiple columns with alias returned ${result5.length} rows`);
      results.push({ test: 'Multiple columns with alias', status: 'PASS', rows: result5.length });
    }

    // Test 6: Table alias with ORDER BY
    console.log('  Test 3.6: Table alias with ORDER BY');
    const result6 = await excelQuery.executeQuery(`SELECT s1.${firstColumn} FROM Sheet1 AS s1 ORDER BY s1.${firstColumn}`, testFilePath);
    console.log(`    ✅ Success: Table alias with ORDER BY returned ${result6.length} rows`);
    results.push({ test: 'Table alias with ORDER BY', status: 'PASS', rows: result6.length });

    // Test 7: Table alias with COUNT function
    console.log('  Test 3.7: Table alias with aggregate function');
    const result7 = await excelQuery.executeQuery(`SELECT COUNT(s1.${firstColumn}) FROM Sheet1 AS s1`, testFilePath);
    console.log(`    ✅ Success: Table alias with COUNT function`);
    results.push({ test: 'Table alias with COUNT', status: 'PASS' });

  } catch (error) {
    console.log(`    ❌ Error: ${error.message}`);
    results.push({ test: 'F-3 Table Aliases', status: 'FAIL', error: error.message });
  }

  return results;
}

export { testF3TableAliases };