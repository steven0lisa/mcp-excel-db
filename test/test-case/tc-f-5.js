import { ExcelSqlQuery } from '../../src/excel-sql-query.ts';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test cases for F-5: String Functions
 */
async function testF5StringFunctions() {
  const excelQuery = new ExcelSqlQuery();
  const testFilePath = path.join(__dirname, '../test-data.xlsx');
  const results = [];

  console.log('🧪 Testing F-5: String Functions');

  try {
    // Get sample data to determine available columns
    const sampleResult = await excelQuery.executeQuery('SELECT * FROM Sheet1 LIMIT 1', testFilePath);
    if (sampleResult.length === 0) {
      console.log('    ⚠️  No data available for testing');
      return results;
    }

    const columns = Object.keys(sampleResult[0]);
    let stringColumn = null;
    
    // Find a string column
    for (const col of columns) {
      if (typeof sampleResult[0][col] === 'string' && sampleResult[0][col].length > 0) {
        stringColumn = col;
        break;
      }
    }

    if (!stringColumn) {
      console.log('    ⚠️  No string column available for testing');
      stringColumn = columns[0]; // Use first column anyway
    }

    // Test 1: LENGTH function
    console.log('  Test 5.1: LENGTH function');
    const result1 = await excelQuery.executeQuery(`SELECT LENGTH(${stringColumn}) AS length_result FROM Sheet1 LIMIT 5`, testFilePath);
    console.log(`    ✅ Success: LENGTH function returned ${result1.length} rows`);
    if (result1.length > 0) {
      console.log(`    Sample result: ${JSON.stringify(result1[0])}`);
    }
    results.push({ test: 'LENGTH function', status: 'PASS', rows: result1.length });

    // Test 2: UPPER function
    console.log('  Test 5.2: UPPER function');
    const result2 = await excelQuery.executeQuery(`SELECT UPPER(${stringColumn}) AS upper_result FROM Sheet1 LIMIT 5`, testFilePath);
    console.log(`    ✅ Success: UPPER function returned ${result2.length} rows`);
    results.push({ test: 'UPPER function', status: 'PASS', rows: result2.length });

    // Test 3: LOWER function
    console.log('  Test 5.3: LOWER function');
    const result3 = await excelQuery.executeQuery(`SELECT LOWER(${stringColumn}) AS lower_result FROM Sheet1 LIMIT 5`, testFilePath);
    console.log(`    ✅ Success: LOWER function returned ${result3.length} rows`);
    results.push({ test: 'LOWER function', status: 'PASS', rows: result3.length });

    // Test 4: TRIM function
    console.log('  Test 5.4: TRIM function');
    const result4 = await excelQuery.executeQuery(`SELECT TRIM(${stringColumn}) AS trim_result FROM Sheet1 LIMIT 5`, testFilePath);
    console.log(`    ✅ Success: TRIM function returned ${result4.length} rows`);
    results.push({ test: 'TRIM function', status: 'PASS', rows: result4.length });

    // Test 5: SUBSTR function
    console.log('  Test 5.5: SUBSTR function');
    const result5 = await excelQuery.executeQuery(`SELECT SUBSTR(${stringColumn}, 1, 3) AS substr_result FROM Sheet1 LIMIT 5`, testFilePath);
    console.log(`    ✅ Success: SUBSTR function returned ${result5.length} rows`);
    results.push({ test: 'SUBSTR function', status: 'PASS', rows: result5.length });

    // Test 6: INSTR function
    console.log('  Test 5.6: INSTR function');
    const result6 = await excelQuery.executeQuery(`SELECT INSTR(${stringColumn}, 'a') AS instr_result FROM Sheet1 LIMIT 5`, testFilePath);
    console.log(`    ✅ Success: INSTR function returned ${result6.length} rows`);
    results.push({ test: 'INSTR function', status: 'PASS', rows: result6.length });

    // Test 7: REPLACE function
    console.log('  Test 5.7: REPLACE function');
    const result7 = await excelQuery.executeQuery(`SELECT REPLACE(${stringColumn}, ' ', '_') AS replace_result FROM Sheet1 LIMIT 5`, testFilePath);
    console.log(`    ✅ Success: REPLACE function returned ${result7.length} rows`);
    results.push({ test: 'REPLACE function', status: 'PASS', rows: result7.length });

    // Test 8: Combined string functions
    console.log('  Test 5.8: Combined string functions');
    const result8 = await excelQuery.executeQuery(
      `SELECT UPPER(TRIM(${stringColumn})) AS combined_result FROM Sheet1 LIMIT 5`,
      testFilePath
    );
    console.log(`    ✅ Success: Combined string functions returned ${result8.length} rows`);
    results.push({ test: 'Combined string functions', status: 'PASS', rows: result8.length });

    // Test 9: String functions in WHERE clause
    console.log('  Test 5.9: String functions in WHERE clause');
    const result9 = await excelQuery.executeQuery(
      `SELECT * FROM Sheet1 WHERE LENGTH(${stringColumn}) > 0 LIMIT 5`,
      testFilePath
    );
    console.log(`    ✅ Success: String functions in WHERE returned ${result9.length} rows`);
    results.push({ test: 'String functions in WHERE', status: 'PASS', rows: result9.length });

  } catch (error) {
    console.log(`    ❌ Error: ${error.message}`);
    results.push({ test: 'F-5 String Functions', status: 'FAIL', error: error.message });
  }

  return results;
}

export { testF5StringFunctions };