import { testF2WhereConditions } from './test/test-case/tc-f-2.js';

console.log('Running F-2 test directly...');

try {
  const results = await testF2WhereConditions();
  console.log('Test results:', results);
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}
