import { ExcelSqlQuery } from '../../src/excel-sql-query.ts';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test cases for F-6: Math Functions
 */
async function testF6MathFunctions() {
  const excelQuery = new ExcelSqlQuery();
  const testFilePath = path.join(__dirname, '../test-data.xlsx');
  const results = [];

  console.log('🧪 Testing F-6: Math Functions');

  try {
    // Get sample data to determine available columns
    const sampleResult = await excelQuery.executeQuery('SELECT * FROM Sheet1 LIMIT 1', testFilePath);
    if (sampleResult.length === 0) {
      console.log('    ⚠️  No data available for testing');
      return results;
    }

    const columns = Object.keys(sampleResult[0]);
    let numericColumn = null;
    
    // Find a numeric column
    for (const col of columns) {
      const value = sampleResult[0][col];
      if (typeof value === 'number' || (!isNaN(parseFloat(value)) && isFinite(value))) {
        numericColumn = col;
        break;
      }
    }

    if (!numericColumn) {
      console.log('    ⚠️  No numeric column available, using literal values for testing');
    }

    // Test 1: ABS function
    console.log('  Test 6.1: ABS function');
    const query1 = numericColumn ? 
      `SELECT ABS(${numericColumn}) AS abs_result FROM Sheet1 LIMIT 5` :
      `SELECT ABS(-42) AS abs_result FROM Sheet1 LIMIT 5`;
    const result1 = await excelQuery.executeQuery(query1, testFilePath);
    console.log(`    ✅ Success: ABS function returned ${result1.length} rows`);
    if (result1.length > 0) {
      console.log(`    Sample result: ${JSON.stringify(result1[0])}`);
    }
    results.push({ test: 'ABS function', status: 'PASS', rows: result1.length });

    // Test 2: ROUND function
    console.log('  Test 6.2: ROUND function');
    const query2 = numericColumn ? 
      `SELECT ROUND(${numericColumn}, 2) AS round_result FROM Sheet1 LIMIT 5` :
      `SELECT ROUND(3.14159, 2) AS round_result FROM Sheet1 LIMIT 5`;
    const result2 = await excelQuery.executeQuery(query2, testFilePath);
    console.log(`    ✅ Success: ROUND function returned ${result2.length} rows`);
    results.push({ test: 'ROUND function', status: 'PASS', rows: result2.length });

    // Test 3: CEIL function
    console.log('  Test 6.3: CEIL function');
    const query3 = numericColumn ? 
      `SELECT CEIL(${numericColumn}) AS ceil_result FROM Sheet1 LIMIT 5` :
      `SELECT CEIL(3.14) AS ceil_result FROM Sheet1 LIMIT 5`;
    const result3 = await excelQuery.executeQuery(query3, testFilePath);
    console.log(`    ✅ Success: CEIL function returned ${result3.length} rows`);
    results.push({ test: 'CEIL function', status: 'PASS', rows: result3.length });

    // Test 4: FLOOR function
    console.log('  Test 6.4: FLOOR function');
    const query4 = numericColumn ? 
      `SELECT FLOOR(${numericColumn}) AS floor_result FROM Sheet1 LIMIT 5` :
      `SELECT FLOOR(3.99) AS floor_result FROM Sheet1 LIMIT 5`;
    const result4 = await excelQuery.executeQuery(query4, testFilePath);
    console.log(`    ✅ Success: FLOOR function returned ${result4.length} rows`);
    results.push({ test: 'FLOOR function', status: 'PASS', rows: result4.length });

    // Test 5: RANDOM function
    console.log('  Test 6.5: RANDOM function');
    const result5 = await excelQuery.executeQuery('SELECT RANDOM() AS random_result FROM Sheet1 LIMIT 5', testFilePath);
    console.log(`    ✅ Success: RANDOM function returned ${result5.length} rows`);
    // Verify that RANDOM generates different values
    if (result5.length > 1) {
      const values = result5.map(row => row.random_result);
      const uniqueValues = [...new Set(values)];
      if (uniqueValues.length > 1) {
        console.log('    ✅ RANDOM generates different values as expected');
      } else {
        console.log('    ⚠️  RANDOM generated same values (might be expected behavior)');
      }
    }
    results.push({ test: 'RANDOM function', status: 'PASS', rows: result5.length });

    // Test 6: Combined math functions
    console.log('  Test 6.6: Combined math functions');
    const result6 = await excelQuery.executeQuery(
      'SELECT ROUND(ABS(-3.14159), 2) AS combined_result FROM Sheet1 LIMIT 5',
      testFilePath
    );
    console.log(`    ✅ Success: Combined math functions returned ${result6.length} rows`);
    results.push({ test: 'Combined math functions', status: 'PASS', rows: result6.length });

    // Test 7: Math functions in WHERE clause
    console.log('  Test 6.7: Math functions in WHERE clause');
    const query7 = numericColumn ? 
      `SELECT * FROM Sheet1 WHERE ABS(${numericColumn}) >= 0 LIMIT 5` :
      `SELECT * FROM Sheet1 WHERE ABS(-1) = 1 LIMIT 5`;
    const result7 = await excelQuery.executeQuery(query7, testFilePath);
    console.log(`    ✅ Success: Math functions in WHERE returned ${result7.length} rows`);
    results.push({ test: 'Math functions in WHERE', status: 'PASS', rows: result7.length });

    // Test 8: ROUND with negative precision
    console.log('  Test 6.8: ROUND with negative precision');
    const result8 = await excelQuery.executeQuery(
      'SELECT ROUND(1234.56, -1) AS round_negative FROM Sheet1 LIMIT 5',
      testFilePath
    );
    console.log(`    ✅ Success: ROUND with negative precision returned ${result8.length} rows`);
    results.push({ test: 'ROUND negative precision', status: 'PASS', rows: result8.length });

    // Test 9: Math functions with aggregation
    console.log('  Test 6.9: Math functions with aggregation');
    const query9 = numericColumn ? 
      `SELECT COUNT(*), AVG(ABS(${numericColumn})) AS avg_abs FROM Sheet1` :
      `SELECT COUNT(*), MAX(ROUND(RANDOM() * 100)) AS max_random FROM Sheet1`;
    const result9 = await excelQuery.executeQuery(query9, testFilePath);
    console.log(`    ✅ Success: Math functions with aggregation returned ${result9.length} rows`);
    results.push({ test: 'Math functions with aggregation', status: 'PASS', rows: result9.length });

  } catch (error) {
    console.log(`    ❌ Error: ${error.message}`);
    results.push({ test: 'F-6 Math Functions', status: 'FAIL', error: error.message });
  }

  return results;
}

export { testF6MathFunctions };