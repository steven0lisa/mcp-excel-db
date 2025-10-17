import { ExcelSqlQuery } from './dist/src/excel-sql-query.js';
import path from 'path';

const query = new ExcelSqlQuery();

// Test with the exact SQL from tc-f-2.js that's failing
const testSql = "SELECT * FROM Sheet1 LIMIT 1";
const testFile = path.join(process.cwd(), 'test', 'test-data.xlsx');

console.log('Testing SQL:', testSql);
console.log('File path:', testFile);

try {
  const result = await query.executeQuery(testSql, testFile);
  console.log('Success:', result);
  
  // Now test the problematic query
  const columns = Object.keys(result[0]);
  const firstColumn = columns[0];
  const testSql2 = `SELECT COUNT(*) FROM Sheet1 WHERE ${firstColumn} IS NOT NULL`;
  console.log('Testing SQL2:', testSql2);
  
  const result2 = await query.executeQuery(testSql2, testFile);
  console.log('Success2:', result2);
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}
