import path from 'path';
import { fileURLToPath } from 'url';
import { ExcelSqlQuery } from '../../dist/src/excel-sql-query.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test cases for F-9: IN and NOT IN Expressions
 * Tests various scenarios of IN and NOT IN operators in WHERE clauses
 */
async function testF9InExpressions() {
  console.log('\n=== F-9: IN and NOT IN Expressions Tests ===');
  
  const excelQuery = new ExcelSqlQuery();
  const testFilePath = path.join(__dirname, '../test-data.xlsx');
  const results = [];
  
  try {
    console.log('✅ Starting F-9 tests with test data');
    
    // Test 1: Basic IN with string values
    console.log('\n📋 Test 1: Basic IN with string values');
    try {
      const result1 = await excelQuery.executeQuery(
        "SELECT name, category FROM Sheet1 WHERE category IN ('A', 'B')",
        testFilePath
      );
      console.log(`    ✅ Success: IN with strings returned ${result1.length} rows`);
      console.log(`    📊 Sample result:`, result1.slice(0, 2));
      results.push({ test: 'IN with strings', status: 'PASS', rows: result1.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'IN with strings', status: 'FAIL', error: error.message });
    }
    
    // Test 2: Basic NOT IN with string values
    console.log('\n📋 Test 2: Basic NOT IN with string values');
    try {
      const result2 = await excelQuery.executeQuery(
        "SELECT name, category FROM Sheet1 WHERE category NOT IN ('A', 'B')",
        testFilePath
      );
      console.log(`    ✅ Success: NOT IN with strings returned ${result2.length} rows`);
      console.log(`    📊 Sample result:`, result2.slice(0, 2));
      results.push({ test: 'NOT IN with strings', status: 'PASS', rows: result2.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'NOT IN with strings', status: 'FAIL', error: error.message });
    }
    
    // Test 3: IN with numeric values
    console.log('\n📋 Test 3: IN with numeric values');
    try {
      const result3 = await excelQuery.executeQuery(
        "SELECT name, age FROM Sheet1 WHERE age IN (25, 30, 35)",
        testFilePath
      );
      console.log(`    ✅ Success: IN with numbers returned ${result3.length} rows`);
      console.log(`    📊 Sample result:`, result3.slice(0, 2));
      results.push({ test: 'IN with numbers', status: 'PASS', rows: result3.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'IN with numbers', status: 'FAIL', error: error.message });
    }
    
    // Test 4: NOT IN with numeric values
    console.log('\n📋 Test 4: NOT IN with numeric values');
    try {
      const result4 = await excelQuery.executeQuery(
        "SELECT name, age FROM Sheet1 WHERE age NOT IN (25, 30)",
        testFilePath
      );
      console.log(`    ✅ Success: NOT IN with numbers returned ${result4.length} rows`);
      console.log(`    📊 Sample result:`, result4.slice(0, 2));
      results.push({ test: 'NOT IN with numbers', status: 'PASS', rows: result4.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'NOT IN with numbers', status: 'FAIL', error: error.message });
    }
    
    // Test 5: IN with mixed data types
    console.log('\n📋 Test 5: IN with mixed data types');
    try {
      const result5 = await excelQuery.executeQuery(
        "SELECT * FROM Sheet1 WHERE category IN ('A', 'B', 'C')",
        testFilePath
      );
      console.log(`    ✅ Success: IN with mixed types returned ${result5.length} rows`);
      results.push({ test: 'IN with mixed types', status: 'PASS', rows: result5.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'IN with mixed types', status: 'FAIL', error: error.message });
    }
    
    // Test 6: IN combined with AND condition
    console.log('\n📋 Test 6: IN combined with AND condition');
    try {
      const result6 = await excelQuery.executeQuery(
        "SELECT name, category, age FROM Sheet1 WHERE category IN ('A', 'B') AND age > 20",
        testFilePath
      );
      console.log(`    ✅ Success: IN with AND returned ${result6.length} rows`);
      console.log(`    📊 Sample result:`, result6.slice(0, 2));
      results.push({ test: 'IN with AND', status: 'PASS', rows: result6.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'IN with AND', status: 'FAIL', error: error.message });
    }
    
    // Test 7: NOT IN combined with OR condition
    console.log('\n📋 Test 7: NOT IN combined with OR condition');
    try {
      const result7 = await excelQuery.executeQuery(
        "SELECT name, category FROM Sheet1 WHERE category NOT IN ('X', 'Y') OR category = 'A'",
        testFilePath
      );
      console.log(`    ✅ Success: NOT IN with OR returned ${result7.length} rows`);
      results.push({ test: 'NOT IN with OR', status: 'PASS', rows: result7.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'NOT IN with OR', status: 'FAIL', error: error.message });
    }
    
    // Test 8: IN with single value (equivalent to =)
    console.log('\n📋 Test 8: IN with single value');
    try {
      const result8 = await excelQuery.executeQuery(
        "SELECT name FROM Sheet1 WHERE category IN ('A')",
        testFilePath
      );
      console.log(`    ✅ Success: IN with single value returned ${result8.length} rows`);
      results.push({ test: 'IN with single value', status: 'PASS', rows: result8.length });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'IN with single value', status: 'FAIL', error: error.message });
    }
    
    // Test 9: Empty IN list (should handle gracefully)
    console.log('\n📋 Test 9: Error handling - malformed IN');
    try {
      const result9 = await excelQuery.executeQuery(
        "SELECT name FROM Sheet1 WHERE category IN",
        testFilePath
      );
      console.log(`    ❌ Unexpected success: Should have failed`);
      results.push({ test: 'Error handling', status: 'FAIL', error: 'Should have thrown error' });
    } catch (error) {
      console.log(`    ✅ Expected error: ${error.message}`);
      results.push({ test: 'Error handling', status: 'PASS', error: error.message });
    }
    
    // Test 10: Case sensitivity test
    console.log('\n📋 Test 10: Case sensitivity');
    try {
      const result10a = await excelQuery.executeQuery(
        "SELECT name FROM Sheet1 WHERE category IN ('a', 'b')",
        testFilePath
      );
      const result10b = await excelQuery.executeQuery(
        "SELECT name FROM Sheet1 WHERE category IN ('A', 'B')",
        testFilePath
      );
      console.log(`    ✅ Success: Lowercase IN returned ${result10a.length} rows`);
      console.log(`    ✅ Success: Uppercase IN returned ${result10b.length} rows`);
      results.push({ test: 'Case sensitivity', status: 'PASS', 
        note: `lowercase: ${result10a.length}, uppercase: ${result10b.length}` });
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ test: 'Case sensitivity', status: 'FAIL', error: error.message });
    }
    
  } catch (error) {
    console.log(`❌ Failed to load test data: ${error.message}`);
    results.push({ test: 'Data loading', status: 'FAIL', error: error.message });
  }
  
  // Summary
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`\n📊 F-9 Test Summary:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  
  return results;
}

export default testF9InExpressions;
export { testF9InExpressions };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testF9InExpressions().catch(console.error);
}