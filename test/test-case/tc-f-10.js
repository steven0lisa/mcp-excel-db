import { ExcelSqlQuery } from '../../src/excel-sql-query.ts';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test cases for F-10: RIGHT JOIN and FULL OUTER JOIN Support
 */
async function testF10JoinOperations() {
  const excelQuery = new ExcelSqlQuery();
  const testFilePath = path.join(__dirname, '../test-data-with-join.xlsx');
  const results = [];

  console.log('🧪 Testing F-10: RIGHT JOIN and FULL OUTER JOIN Support');

  try {
    // Test 1: Basic RIGHT JOIN
    console.log('  Test 10.1: Basic RIGHT JOIN');
    try {
      const result1 = await excelQuery.executeQuery(`
        SELECT s1.name as sheet1_name, s2.supplier 
        FROM Sheet2 s2 
        RIGHT JOIN Sheet1 s1 ON s2.sheet1_id = s1.id
      `, testFilePath);
      console.log(`    ✅ Success: RIGHT JOIN returned ${result1.length} rows`);
      results.push({ test: 'RIGHT JOIN basic', status: 'PASS', rows: result1.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'RIGHT JOIN basic', status: 'FAIL', error: error.message });
    }

    // Test 2: FULL OUTER JOIN basic functionality
    console.log('  Test 10.2: Basic FULL OUTER JOIN');
    try {
      const result2 = await excelQuery.executeQuery(`
        SELECT s1.name as sheet1_name, s2.id as sheet2_id 
        FROM Sheet1 s1 
        FULL OUTER JOIN Sheet2 s2 ON s1.id = s2.sheet1_id
      `, testFilePath);
      console.log(`    ✅ Success: FULL OUTER JOIN returned ${result2.length} rows`);
      results.push({ test: 'FULL OUTER JOIN basic', status: 'PASS', rows: result2.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'FULL OUTER JOIN basic', status: 'FAIL', error: error.message });
    }

    // Test 3: RIGHT JOIN with WHERE clause
    console.log('  Test 10.3: RIGHT JOIN with WHERE clause');
    try {
      const result3 = await excelQuery.executeQuery(`
        SELECT s1.name as sheet1_name, s2.supplier 
        FROM Sheet2 s2 
        RIGHT JOIN Sheet1 s1 ON s2.sheet1_id = s1.id 
        WHERE s1.amount > 5
      `, testFilePath);
      console.log(`    ✅ Success: RIGHT JOIN with WHERE returned ${result3.length} rows`);
      results.push({ test: 'RIGHT JOIN with WHERE clause', status: 'PASS', rows: result3.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'RIGHT JOIN with WHERE clause', status: 'FAIL', error: error.message });
    }

    // Test 4: FULL OUTER JOIN with multiple columns
    console.log('  Test 10.4: FULL OUTER JOIN with multiple columns');
    try {
      const result4 = await excelQuery.executeQuery(`
        SELECT s1.id, s1.name, s1.amount, s2.supplier, s2.rating
        FROM Sheet1 s1
        FULL OUTER JOIN Sheet2 s2 ON s1.id = s2.sheet1_id
      `, testFilePath);
      console.log(`    ✅ Success: FULL OUTER JOIN with multiple columns returned ${result4.length} rows`);
      results.push({ test: 'FULL OUTER JOIN multiple columns', status: 'PASS', rows: result4.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'FULL OUTER JOIN multiple columns', status: 'FAIL', error: error.message });
    }

    // Test 5: RIGHT JOIN with table alias
    console.log('  Test 10.5: RIGHT JOIN with table alias');
    try {
      const result5 = await excelQuery.executeQuery(`
        SELECT s1.name as sheet1_name, s2.supplier 
        FROM Sheet2 s2 
        RIGHT JOIN Sheet1 s1 ON s2.sheet1_id = s1.id
      `, testFilePath);
      console.log(`    ✅ Success: RIGHT JOIN with alias returned ${result5.length} rows`);
      results.push({ test: 'RIGHT JOIN with alias', status: 'PASS', rows: result5.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'RIGHT JOIN with alias', status: 'FAIL', error: error.message });
    }

    // Test 6: FULL OUTER JOIN with ORDER BY
    console.log('  Test 10.6: FULL OUTER JOIN with ORDER BY');
    try {
      const result6 = await excelQuery.executeQuery(`
        SELECT s1.name as sheet1_name, s2.supplier 
        FROM Sheet1 s1 
        FULL OUTER JOIN Sheet2 s2 ON s1.id = s2.sheet1_id
        ORDER BY s1.name
      `, testFilePath);
      console.log(`    ✅ Success: FULL OUTER JOIN with ORDER BY returned ${result6.length} rows`);
      results.push({ test: 'FULL OUTER JOIN with ORDER BY', status: 'PASS', rows: result6.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'FULL OUTER JOIN with ORDER BY', status: 'FAIL', error: error.message });
    }

    // Test 7: Complex RIGHT JOIN with multiple conditions
    console.log('  Test 10.7: RIGHT JOIN with complex conditions');
    try {
      const result7 = await excelQuery.executeQuery(`
        SELECT s1.name as sheet1_name, s1.amount, s2.supplier, s2.rating
        FROM Sheet2 s2 
        RIGHT JOIN Sheet1 s1 ON s2.sheet1_id = s1.id AND s2.rating > 4
      `, testFilePath);
      console.log(`    ✅ Success: Complex RIGHT JOIN returned ${result7.length} rows`);
      results.push({ test: 'RIGHT JOIN complex conditions', status: 'PASS', rows: result7.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'RIGHT JOIN complex conditions', status: 'FAIL', error: error.message });
    }

    // Test 8: FULL OUTER JOIN with NULL handling
    console.log('  Test 10.8: FULL OUTER JOIN NULL handling');
    try {
      const result8 = await excelQuery.executeQuery(`
        SELECT s1.name as sheet1_name, s2.supplier 
        FROM Sheet1 s1 
        FULL OUTER JOIN Sheet2 s2 ON s1.id = s2.sheet1_id
        WHERE s1.id IS NULL OR s2.sheet1_id IS NULL
      `, testFilePath);
      console.log(`    ✅ Success: FULL OUTER JOIN NULL handling returned ${result8.length} rows`);
      results.push({ test: 'FULL OUTER JOIN NULL handling', status: 'PASS', rows: result8.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'FULL OUTER JOIN NULL handling', status: 'FAIL', error: error.message });
    }

    // Test 9: CROSS JOIN functionality - Cartesian product
    console.log('  Test 10.9: CROSS JOIN Cartesian product');
    try {
      const result9 = await excelQuery.executeQuery(`
        SELECT s1.name, s2.supplier 
        FROM Sheet1 s1 
        CROSS JOIN Sheet2 s2
      `, testFilePath);
      // Should return 5 * 5 = 25 rows (Cartesian product)
      const expectedRows = 25;
      if (result9.length === expectedRows) {
        console.log(`    ✅ Success: CROSS JOIN returned ${result9.length} rows (Cartesian product)`);
        results.push({ test: 'CROSS JOIN Cartesian product', status: 'PASS', rows: result9.length });
      } else {
        console.log(`    ❌ Error: Expected ${expectedRows} rows, got ${result9.length}`);
        results.push({ test: 'CROSS JOIN Cartesian product', status: 'FAIL', error: `Expected ${expectedRows} rows, got ${result9.length}` });
      }
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'CROSS JOIN Cartesian product', status: 'FAIL', error: error.message });
    }

    // Test 10: Error handling - Non-existent table
    console.log('  Test 10.10: Error handling - Non-existent table');
    try {
      await excelQuery.executeQuery(`
        SELECT s1.name 
        FROM Sheet1 s1 
        RIGHT JOIN NonExistentSheet t ON s1.id = t.id
      `, testFilePath);
      console.log('    ❌ Error: Should have thrown an exception for non-existent table');
      results.push({ test: 'Non-existent table error', status: 'FAIL', error: 'Should have thrown exception' });
    } catch (error) {
      console.log(`    ✅ Success: Correctly threw error for non-existent table: ${error.message}`);
      results.push({ test: 'Non-existent table error', status: 'PASS', error: error.message });
    }

  } catch (error) {
    console.log(`    ❌ Setup Error: ${error.message}`);
    results.push({ test: 'F-10 JOIN Operations Setup', status: 'FAIL', error: error.message });
  }

  return results;
}

export { testF10JoinOperations };