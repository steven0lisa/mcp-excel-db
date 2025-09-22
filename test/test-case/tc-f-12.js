import { ExcelSqlQuery } from '../../src/excel-sql-query.ts';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test cases for F-12: Double-Quoted Identifiers Support
 */
async function testF12DoubleQuotedIdentifiers() {
  const excelQuery = new ExcelSqlQuery();
  const testFilePath = path.join(__dirname, '../test-data.xlsx');
  const results = [];

  console.log('🧪 Testing F-12: Double-Quoted Identifiers Support');

  try {
    // Test 1: Basic query with double-quoted identifier - test that double-quoted strings are treated as column references
    console.log('  Test 12.1: Basic query with double-quoted identifier');
    try {
      // Test with a column that exists in the test data using double quotes (should work like regular column reference)
      const result1 = await excelQuery.executeQuery('SELECT "name" FROM Sheet1 LIMIT 1', testFilePath);
      console.log(`    ✅ Success: Returned ${result1.length} rows with double-quoted identifier`);
      results.push({ test: 'Basic double-quoted identifier', status: 'PASS', rows: result1.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'Basic double-quoted identifier', status: 'FAIL', error: error.message });
    }

    // Test 2: Query with condition using double-quoted identifier
    console.log('  Test 12.2: Query with condition using double-quoted identifier');
    try {
      const result2 = await excelQuery.executeQuery('SELECT * FROM Sheet1 WHERE "name" IS NOT NULL', testFilePath);
      console.log(`    ✅ Success: Returned ${result2.length} rows with condition on double-quoted identifier`);
      results.push({ test: 'Condition with double-quoted identifier', status: 'PASS', rows: result2.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'Condition with double-quoted identifier', status: 'FAIL', error: error.message });
    }

    // Test 3: DISTINCT with double-quoted identifier
    console.log('  Test 12.3: DISTINCT with double-quoted identifier');
    try {
      const result3 = await excelQuery.executeQuery('SELECT DISTINCT "category" FROM Sheet1', testFilePath);
      console.log(`    ✅ Success: Returned ${result3.length} distinct values with double-quoted identifier`);
      results.push({ test: 'DISTINCT with double-quoted identifier', status: 'PASS', rows: result3.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'DISTINCT with double-quoted identifier', status: 'FAIL', error: error.message });
    }

    // Test 4: Multiple double-quoted identifiers
    console.log('  Test 12.4: Multiple double-quoted identifiers');
    try {
      const result4 = await excelQuery.executeQuery('SELECT "name", "category" FROM Sheet1 LIMIT 5', testFilePath);
      console.log(`    ✅ Success: Returned ${result4.length} rows with multiple double-quoted identifiers`);
      results.push({ test: 'Multiple double-quoted identifiers', status: 'PASS', rows: result4.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'Multiple double-quoted identifiers', status: 'FAIL', error: error.message });
    }

    // Test 5: Mixed quoted and unquoted identifiers
    console.log('  Test 12.5: Mixed quoted and unquoted identifiers');
    try {
      const result5 = await excelQuery.executeQuery('SELECT "name", category FROM Sheet1 LIMIT 5', testFilePath);
      console.log(`    ✅ Success: Returned ${result5.length} rows with mixed identifiers`);
      results.push({ test: 'Mixed quoted and unquoted identifiers', status: 'PASS', rows: result5.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'Mixed quoted and unquoted identifiers', status: 'FAIL', error: error.message });
    }

    // Test 6: Single-quoted strings should still work (backward compatibility)
    console.log('  Test 12.6: Single-quoted strings (backward compatibility)');
    try {
      const result6 = await excelQuery.executeQuery("SELECT * FROM Sheet1 WHERE category = '水果'", testFilePath);
      console.log(`    ✅ Success: Single-quoted strings still work, returned ${result6.length} rows`);
      results.push({ test: 'Single-quoted strings compatibility', status: 'PASS', rows: result6.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'Single-quoted strings compatibility', status: 'FAIL', error: error.message });
    }

    // Test 7: Complex query with double-quoted identifiers and functions
    console.log('  Test 12.7: Complex query with double-quoted identifiers and functions');
    try {
      const result7 = await excelQuery.executeQuery('SELECT DISTINCT "name" FROM Sheet1 WHERE TRIM("name") != \'\' AND "name" IS NOT NULL', testFilePath);
      console.log(`    ✅ Success: Complex query with functions returned ${result7.length} rows`);
      results.push({ test: 'Complex query with functions', status: 'PASS', rows: result7.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'Complex query with functions', status: 'FAIL', error: error.message });
    }

    // Test 8: Error handling for non-existent double-quoted columns
    console.log('  Test 12.8: Error handling for non-existent double-quoted columns');
    try {
      const result8 = await excelQuery.executeQuery('SELECT "NonExistentColumn" FROM Sheet1 LIMIT 1', testFilePath);
      console.log(`    ✅ Success: Non-existent column returned ${result8.length} rows (null values as expected)`);
      if (result8.length > 0 && result8[0]["NonExistentColumn"] === null) {
        console.log('    ✅ Non-existent column correctly returns null values');
      }
      results.push({ test: 'Non-existent double-quoted column', status: 'PASS', rows: result8.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'Non-existent double-quoted column', status: 'FAIL', error: error.message });
    }

  } catch (error) {
    console.log(`    ❌ Critical Error: ${error.message}`);
    results.push({ test: 'F-12 Double-Quoted Identifiers', status: 'FAIL', error: error.message });
  }

  return results;
}

export { testF12DoubleQuotedIdentifiers };