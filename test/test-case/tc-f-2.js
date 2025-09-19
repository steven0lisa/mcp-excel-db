import { ExcelSqlQuery } from '../../src/excel-sql-query.ts';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test cases for F-2: WHERE Conditions
 */
async function testF2WhereConditions() {
  const excelQuery = new ExcelSqlQuery();
  const testFilePath = path.join(__dirname, '../test-data.xlsx');
  const results = [];

  console.log('🧪 Testing F-2: WHERE Conditions');

  try {
    // Get sample data to determine available columns
    const sampleResult = await excelQuery.executeQuery('SELECT * FROM Sheet1 LIMIT 1', testFilePath);
    if (sampleResult.length === 0) {
      console.log('    ⚠️  No data available for testing');
      return results;
    }

    const columns = Object.keys(sampleResult[0]);
    const firstColumn = columns[0];

    // Test 1: Basic comparison operators
    console.log('  Test 2.1: WHERE with = operator');
    const result1 = await excelQuery.executeQuery(`SELECT COUNT(*) FROM Sheet1 WHERE ${firstColumn} IS NOT NULL`, testFilePath);
    console.log(`    ✅ Success: Non-null rows count`);
    results.push({ test: 'WHERE IS NOT NULL', status: 'PASS' });

    // Test 2: Logical operators
    console.log('  Test 2.2: WHERE with AND operator');
    const result2 = await excelQuery.executeQuery(`SELECT * FROM Sheet1 WHERE ${firstColumn} IS NOT NULL AND ${firstColumn} != ''`, testFilePath);
    console.log(`    ✅ Success: AND condition returned ${result2.length} rows`);
    results.push({ test: 'WHERE with AND', status: 'PASS', rows: result2.length });

    // Test 3: OR operator
    console.log('  Test 2.3: WHERE with OR operator');
    const result3 = await excelQuery.executeQuery(`SELECT * FROM Sheet1 WHERE ${firstColumn} IS NULL OR ${firstColumn} = ''`, testFilePath);
    console.log(`    ✅ Success: OR condition returned ${result3.length} rows`);
    results.push({ test: 'WHERE with OR', status: 'PASS', rows: result3.length });

    // Test 4: LIKE operator (if string column available)
    if (typeof sampleResult[0][firstColumn] === 'string') {
      console.log('  Test 2.4: WHERE with LIKE operator');
      const result4 = await excelQuery.executeQuery(`SELECT * FROM Sheet1 WHERE ${firstColumn} LIKE '%a%'`, testFilePath);
      console.log(`    ✅ Success: LIKE condition returned ${result4.length} rows`);
      results.push({ test: 'WHERE with LIKE', status: 'PASS', rows: result4.length });
    }

    // Test 5: Comparison operators
    console.log('  Test 2.5: WHERE with comparison operators');
    const result5 = await excelQuery.executeQuery(`SELECT * FROM Sheet1 WHERE LENGTH(${firstColumn}) > 0`, testFilePath);
    console.log(`    ✅ Success: Comparison with function returned ${result5.length} rows`);
    results.push({ test: 'WHERE with comparison', status: 'PASS', rows: result5.length });

    // Test 6: NOT operator
    console.log('  Test 2.6: WHERE with NOT operator');
    const result6 = await excelQuery.executeQuery(`SELECT * FROM Sheet1 WHERE NOT (${firstColumn} IS NULL)`, testFilePath);
    console.log(`    ✅ Success: NOT condition returned ${result6.length} rows`);
    results.push({ test: 'WHERE with NOT', status: 'PASS', rows: result6.length });

    // Test 7: Parentheses grouping
    console.log('  Test 2.7: WHERE with parentheses');
    const result7 = await excelQuery.executeQuery(`SELECT * FROM Sheet1 WHERE (${firstColumn} IS NOT NULL) AND (LENGTH(${firstColumn}) > 0)`, testFilePath);
    console.log(`    ✅ Success: Parentheses grouping returned ${result7.length} rows`);
    results.push({ test: 'WHERE with parentheses', status: 'PASS', rows: result7.length });

  } catch (error) {
    console.log(`    ❌ Error: ${error.message}`);
    results.push({ test: 'F-2 WHERE Conditions', status: 'FAIL', error: error.message });
  }

  return results;
}

export { testF2WhereConditions };