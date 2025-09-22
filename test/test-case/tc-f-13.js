/**
 * Test Case F-13: Field Existence Validation
 * Tests that the system returns appropriate error messages when SQL queries reference non-existent fields
 */

import { ExcelSqlQuery } from '../../dist/src/excel-sql-query.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testFieldExistenceValidation() {
  const tester = new ExcelSqlQuery();
  const testFile = path.join(__dirname, '../test-data.xlsx');

  console.log('🧪 Testing F-13: Field Existence Validation\n');

  let passedTests = 0;
  let totalTests = 0;

  function runTest(testName, sql, shouldFail = true) {
    totalTests++;
    console.log(`📋 Test ${totalTests}: ${testName}`);
    console.log(`   SQL: ${sql}`);

    return tester.executeQuery(sql, testFile)
      .then(result => {
        if (shouldFail) {
          console.log(`   ❌ FAILED: Expected error but query succeeded`);
          console.log(`   Result:`, result.slice(0, 3));
        } else {
          console.log(`   ✅ PASSED: Query executed successfully`);
          passedTests++;
        }
      })
      .catch(error => {
        if (shouldFail) {
          if (error.message.includes('does not exist')) {
            console.log(`   ✅ PASSED: Got expected error - ${error.message}`);
            passedTests++;
          } else {
            console.log(`   ❌ FAILED: Got unexpected error - ${error.message}`);
          }
        } else {
          console.log(`   ❌ FAILED: Unexpected error - ${error.message}`);
        }
      })
      .finally(() => {
        console.log('');
      });
  }

  // Test 1: Non-existent field in SELECT
  await runTest(
    'Non-existent field in SELECT',
    "SELECT NonExistentField FROM Sheet1"
  );

  // Test 2: Mix of existing and non-existent fields
  await runTest(
    'Mix of existing and non-existent fields',
    "SELECT name, NonExistentField, amount FROM Sheet1"
  );

  // Test 3: Non-existent field in WHERE clause
  await runTest(
    'Non-existent field in WHERE clause',
    "SELECT * FROM Sheet1 WHERE NonExistentField = 'test'"
  );

  // Test 4: Non-existent field in ORDER BY
  await runTest(
    'Non-existent field in ORDER BY',
    "SELECT * FROM Sheet1 ORDER BY NonExistentField"
  );

  // Test 5: Function with non-existent field argument
  await runTest(
    'Function with non-existent field argument',
    "SELECT UPPER(NonExistentField) FROM Sheet1"
  );

  // Test 6: Valid query (should succeed)
  await runTest(
    'Valid query with existing fields',
    "SELECT name, amount FROM Sheet1",
    false
  );

  // Test 7: Valid WHERE clause (should succeed)
  await runTest(
    'Valid WHERE clause with existing field',
    "SELECT * FROM Sheet1 WHERE amount > 25",
    false
  );

  // Test 8: Valid ORDER BY (should succeed)
  await runTest(
    'Valid ORDER BY with existing field',
    "SELECT * FROM Sheet1 ORDER BY name",
    false
  );

  // Test 9: Valid function call (should succeed)
  await runTest(
    'Valid function call with existing field',
    "SELECT UPPER(name) FROM Sheet1",
    false
  );

  // Test 10: Double-quoted non-existent field
  await runTest(
    'Double-quoted non-existent field',
    'SELECT "NonExistentField" FROM Sheet1'
  );

  // Test 11: Wildcard should not trigger validation error
  await runTest(
    'Wildcard selection should succeed',
    "SELECT * FROM Sheet1",
    false
  );

  // Test 12: Complex expression with non-existent field
  await runTest(
    'Complex expression with non-existent field',
    "SELECT name, amount * 2, NonExistentField FROM Sheet1"
  );

  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed\n`);

  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! F-13 feature is working correctly.');
    return true;
  } else {
    console.log('❌ Some tests failed. Please check the implementation.');
    return false;
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testFieldExistenceValidation()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testFieldExistenceValidation };