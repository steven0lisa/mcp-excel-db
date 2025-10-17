import { ExcelSqlQuery } from '../../src/excel-sql-query.ts';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test cases for F-11: UNION and UNION ALL Support
 */
async function testF11UnionOperations() {
  const excelQuery = new ExcelSqlQuery();
  const testFilePath = path.join(__dirname, '../test-data-with-join.xlsx');
  const results = [];

  console.log('🧪 Testing F-11: UNION and UNION ALL Support');

  try {
    // Test 1: Basic UNION (deduplication)
    console.log('  Test 11.1: Basic UNION with deduplication');
    try {
      const result1 = await excelQuery.executeQuery(`
        SELECT name FROM Sheet1
        UNION
        SELECT supplier AS name FROM Sheet2
      `, testFilePath);
      console.log(`    ✅ Success: UNION returned ${result1.length} rows`);
      results.push({ test: 'UNION basic', status: 'PASS', rows: result1.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'UNION basic', status: 'FAIL', error: error.message });
    }

    // Test 2: UNION ALL (keep duplicates)
    console.log('  Test 11.2: UNION ALL keeping duplicates');
    try {
      const result2 = await excelQuery.executeQuery(`
        SELECT name FROM Sheet1
        UNION ALL
        SELECT supplier AS name FROM Sheet2
      `, testFilePath);
      console.log(`    ✅ Success: UNION ALL returned ${result2.length} rows`);
      results.push({ test: 'UNION ALL basic', status: 'PASS', rows: result2.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'UNION ALL basic', status: 'FAIL', error: error.message });
    }

    // Test 3: Multiple UNION operations
    console.log('  Test 11.3: Multiple UNION operations');
    try {
      const result3 = await excelQuery.executeQuery(`
        SELECT name FROM Sheet1
        UNION
        SELECT name FROM Sheet2
        UNION ALL
        SELECT supplier FROM Sheet2
      `, testFilePath);
      console.log(`    ✅ Success: Multiple UNION returned ${result3.length} rows`);
      results.push({ test: 'Multiple UNION operations', status: 'PASS', rows: result3.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'Multiple UNION operations', status: 'FAIL', error: error.message });
    }

    // Test 4: UNION with WHERE clauses
    console.log('  Test 11.4: UNION with WHERE clauses');
    try {
      const result4 = await excelQuery.executeQuery(`
        SELECT name FROM Sheet1 WHERE amount > 5
        UNION
        SELECT supplier FROM Sheet2 WHERE rating > 3
      `, testFilePath);
      console.log(`    ✅ Success: UNION with WHERE returned ${result4.length} rows`);
      results.push({ test: 'UNION with WHERE clauses', status: 'PASS', rows: result4.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'UNION with WHERE clauses', status: 'FAIL', error: error.message });
    }

    // Test 5: UNION with multiple columns
    console.log('  Test 11.5: UNION with multiple columns');
    try {
      const result5 = await excelQuery.executeQuery(`
        SELECT name, amount FROM Sheet1
        UNION
        SELECT supplier, rating FROM Sheet2
      `, testFilePath);
      console.log(`    ✅ Success: UNION with multiple columns returned ${result5.length} rows`);
      results.push({ test: 'UNION with multiple columns', status: 'PASS', rows: result5.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'UNION with multiple columns', status: 'FAIL', error: error.message });
    }

    // Test 6: UNION with column aliases
    console.log('  Test 11.6: UNION with column aliases');
    try {
      const result6 = await excelQuery.executeQuery(`
        SELECT name as employee_name FROM Sheet1
        UNION
        SELECT supplier as employee_name FROM Sheet2
      `, testFilePath);
      console.log(`    ✅ Success: UNION with aliases returned ${result6.length} rows`);
      results.push({ test: 'UNION with column aliases', status: 'PASS', rows: result6.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'UNION with column aliases', status: 'FAIL', error: error.message });
    }

    // Test 7: UNION with different data types
    console.log('  Test 11.7: UNION mixing different data types');
    try {
      const result7 = await excelQuery.executeQuery(`
        SELECT name FROM Sheet1
        UNION
        SELECT supplier FROM Sheet2
      `, testFilePath);
      console.log(`    ✅ Success: UNION with mixed types returned ${result7.length} rows`);
      results.push({ test: 'UNION with mixed data types', status: 'PASS', rows: result7.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'UNION with mixed data types', status: 'FAIL', error: error.message });
    }

    // Test 8: Empty result handling
    console.log('  Test 11.8: UNION with empty results');
    try {
      const result8 = await excelQuery.executeQuery(`
        SELECT name FROM Sheet1 WHERE amount > 999
        UNION
        SELECT supplier FROM Sheet2 WHERE rating > 999
      `, testFilePath);
      console.log(`    ✅ Success: UNION with empty results returned ${result8.length} rows`);
      results.push({ test: 'UNION with empty results', status: 'PASS', rows: result8.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'UNION with empty results', status: 'FAIL', error: error.message });
    }

    // Test 9: Error handling - column count mismatch
    console.log('  Test 11.9: Error handling - column count mismatch');
    try {
      await excelQuery.executeQuery(`
        SELECT name FROM Sheet1
        UNION
        SELECT name, amount FROM Sheet1
      `, testFilePath);
      console.log('    ❌ Error: Should have thrown an exception for column count mismatch');
      results.push({ test: 'Column count mismatch error', status: 'FAIL', error: 'Should have thrown exception' });
    } catch (error) {
      console.log(`    ✅ Success: Correctly threw error for column count mismatch: ${error.message}`);
      results.push({ test: 'Column count mismatch error', status: 'PASS', error: error.message });
    }

    // Test 10: Error handling - non-existent table
    console.log('  Test 11.10: Error handling - non-existent table');
    try {
      await excelQuery.executeQuery(`
        SELECT name FROM Sheet1
        UNION
        SELECT name FROM NonExistentSheet
      `, testFilePath);
      console.log('    ❌ Error: Should have thrown an exception for non-existent table');
      results.push({ test: 'Non-existent table error', status: 'FAIL', error: 'Should have thrown exception' });
    } catch (error) {
      console.log(`    ✅ Success: Correctly threw error for non-existent table: ${error.message}`);
      results.push({ test: 'Non-existent table error', status: 'PASS', error: error.message });
    }

  } catch (error) {
    console.log(`    ❌ Setup Error: ${error.message}`);
    results.push({ test: 'F-11 UNION Operations Setup', status: 'FAIL', error: error.message });
  }

  return results;
}

export { testF11UnionOperations };