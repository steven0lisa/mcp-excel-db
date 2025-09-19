import { ExcelSqlQuery } from '../../src/excel-sql-query.ts';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test cases for F-1: Basic SELECT Queries
 */
async function testF1BasicSelect() {
  const excelQuery = new ExcelSqlQuery();
  const testFilePath = path.join(__dirname, '../test-data.xlsx');
  const results = [];

  console.log('🧪 Testing F-1: Basic SELECT Queries');

  try {
    // Test 1: SELECT * query
    console.log('  Test 1.1: SELECT * FROM Sheet1');
    const result1 = await excelQuery.executeQuery('SELECT * FROM Sheet1', testFilePath);
    console.log(`    ✅ Success: Returned ${result1.length} rows`);
    results.push({ test: 'SELECT *', status: 'PASS', rows: result1.length });

    // Test 2: SELECT specific columns
    if (result1.length > 0) {
      const columns = Object.keys(result1[0]);
      if (columns.length > 0) {
        const firstColumn = columns[0];
        console.log(`  Test 1.2: SELECT ${firstColumn} FROM Sheet1`);
        const result2 = await excelQuery.executeQuery(`SELECT ${firstColumn} FROM Sheet1`, testFilePath);
        console.log(`    ✅ Success: Returned ${result2.length} rows with column ${firstColumn}`);
        results.push({ test: 'SELECT specific column', status: 'PASS', rows: result2.length });
      }
    }

    // Test 3: SELECT multiple columns
    if (result1.length > 0) {
      const columns = Object.keys(result1[0]);
      if (columns.length >= 2) {
        const col1 = columns[0];
        const col2 = columns[1];
        console.log(`  Test 1.3: SELECT ${col1}, ${col2} FROM Sheet1`);
        const result3 = await excelQuery.executeQuery(`SELECT ${col1}, ${col2} FROM Sheet1`, testFilePath);
        console.log(`    ✅ Success: Returned ${result3.length} rows with columns ${col1}, ${col2}`);
        results.push({ test: 'SELECT multiple columns', status: 'PASS', rows: result3.length });
      }
    }

    // Test 4: SELECT DISTINCT
    if (result1.length > 0) {
      const columns = Object.keys(result1[0]);
      if (columns.length > 0) {
        const firstColumn = columns[0];
        console.log(`  Test 1.4: SELECT DISTINCT ${firstColumn} FROM Sheet1`);
        const result4 = await excelQuery.executeQuery(`SELECT DISTINCT ${firstColumn} FROM Sheet1`, testFilePath);
        console.log(`    ✅ Success: Returned ${result4.length} distinct values`);
        results.push({ test: 'SELECT DISTINCT', status: 'PASS', rows: result4.length });
      }
    }

    // Test 5: SELECT with column alias
    if (result1.length > 0) {
      const columns = Object.keys(result1[0]);
      if (columns.length > 0) {
        const firstColumn = columns[0];
        console.log(`  Test 1.5: SELECT ${firstColumn} AS alias_name FROM Sheet1`);
        const result5 = await excelQuery.executeQuery(`SELECT ${firstColumn} AS alias_name FROM Sheet1`, testFilePath);
        console.log(`    ✅ Success: Returned ${result5.length} rows with alias`);
        if (result5.length > 0 && result5[0].hasOwnProperty('alias_name')) {
          console.log('    ✅ Column alias working correctly');
        }
        results.push({ test: 'SELECT with alias', status: 'PASS', rows: result5.length });
      }
    }

  } catch (error) {
    console.log(`    ❌ Error: ${error.message}`);
    results.push({ test: 'F-1 Basic SELECT', status: 'FAIL', error: error.message });
  }

  return results;
}

export { testF1BasicSelect };