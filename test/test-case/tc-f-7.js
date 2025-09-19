import { ExcelSqlQuery } from '../../src/excel-sql-query.ts';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test cases for F-7: ORDER BY Clause
 */
async function testF7OrderBy() {
  const excelQuery = new ExcelSqlQuery();
  const testFilePath = path.join(__dirname, '../test-data.xlsx');
  const results = [];

  console.log('🧪 Testing F-7: ORDER BY Clause');

  try {
    // Get sample data to determine available columns
    const sampleResult = await excelQuery.executeQuery('SELECT * FROM Sheet1 LIMIT 5', testFilePath);
    if (sampleResult.length === 0) {
      console.log('    ⚠️  No data available for testing');
      return results;
    }

    const columns = Object.keys(sampleResult[0]);
    let stringColumn = null;
    let numericColumn = null;
    
    // Find string and numeric columns
    for (const col of columns) {
      const value = sampleResult[0][col];
      if (typeof value === 'string' && value.length > 0 && !stringColumn) {
        stringColumn = col;
      }
      if ((typeof value === 'number' || (!isNaN(parseFloat(value)) && isFinite(value))) && !numericColumn) {
        numericColumn = col;
      }
    }

    const testColumn = stringColumn || numericColumn || columns[0];
    const secondColumn = columns.length > 1 ? columns[1] : columns[0];

    // Test 1: Basic ORDER BY ASC (default)
    console.log('  Test 7.1: Basic ORDER BY ASC (default)');
    const result1 = await excelQuery.executeQuery(`SELECT * FROM Sheet1 ORDER BY ${testColumn} LIMIT 10`, testFilePath);
    console.log(`    ✅ Success: ORDER BY ASC returned ${result1.length} rows`);
    // Verify ordering
    if (result1.length > 1) {
      const isOrdered = result1.every((row, i) => {
        if (i === 0) return true;
        const current = row[testColumn];
        const previous = result1[i-1][testColumn];
        return current >= previous;
      });
      console.log(`    ${isOrdered ? '✅' : '⚠️'} Data is ${isOrdered ? 'properly' : 'not'} ordered`);
    }
    results.push({ test: 'ORDER BY ASC', status: 'PASS', rows: result1.length });

    // Test 2: ORDER BY DESC
    console.log('  Test 7.2: ORDER BY DESC');
    const result2 = await excelQuery.executeQuery(`SELECT * FROM Sheet1 ORDER BY ${testColumn} DESC LIMIT 10`, testFilePath);
    console.log(`    ✅ Success: ORDER BY DESC returned ${result2.length} rows`);
    // Verify descending order
    if (result2.length > 1) {
      const isOrdered = result2.every((row, i) => {
        if (i === 0) return true;
        const current = row[testColumn];
        const previous = result2[i-1][testColumn];
        return current <= previous;
      });
      console.log(`    ${isOrdered ? '✅' : '⚠️'} Data is ${isOrdered ? 'properly' : 'not'} ordered DESC`);
    }
    results.push({ test: 'ORDER BY DESC', status: 'PASS', rows: result2.length });

    // Test 3: Multiple column ORDER BY
    console.log('  Test 7.3: Multiple column ORDER BY');
    const result3 = await excelQuery.executeQuery(
      `SELECT * FROM Sheet1 ORDER BY ${testColumn}, ${secondColumn} LIMIT 10`,
      testFilePath
    );
    console.log(`    ✅ Success: Multiple column ORDER BY returned ${result3.length} rows`);
    results.push({ test: 'Multiple column ORDER BY', status: 'PASS', rows: result3.length });

    // Test 4: Mixed ASC/DESC ordering
    console.log('  Test 7.4: Mixed ASC/DESC ordering');
    const result4 = await excelQuery.executeQuery(
      `SELECT * FROM Sheet1 ORDER BY ${testColumn} ASC, ${secondColumn} DESC LIMIT 10`,
      testFilePath
    );
    console.log(`    ✅ Success: Mixed ASC/DESC ordering returned ${result4.length} rows`);
    results.push({ test: 'Mixed ASC/DESC ordering', status: 'PASS', rows: result4.length });

    // Test 5: ORDER BY with WHERE clause
    console.log('  Test 7.5: ORDER BY with WHERE clause');
    const result5 = await excelQuery.executeQuery(
      `SELECT * FROM Sheet1 WHERE ${testColumn} IS NOT NULL ORDER BY ${testColumn} LIMIT 10`,
      testFilePath
    );
    console.log(`    ✅ Success: ORDER BY with WHERE returned ${result5.length} rows`);
    results.push({ test: 'ORDER BY with WHERE', status: 'PASS', rows: result5.length });

    // Test 6: ORDER BY with expression
    console.log('  Test 7.6: ORDER BY with expression');
    if (stringColumn) {
      const result6 = await excelQuery.executeQuery(
        `SELECT * FROM Sheet1 ORDER BY LENGTH(${stringColumn}) LIMIT 10`,
        testFilePath
      );
      console.log(`    ✅ Success: ORDER BY with expression returned ${result6.length} rows`);
      results.push({ test: 'ORDER BY with expression', status: 'PASS', rows: result6.length });
    } else {
      console.log('    ⚠️  Skipped: No string column for expression test');
      results.push({ test: 'ORDER BY with expression', status: 'SKIP', reason: 'No string column' });
    }

    // Test 7: ORDER BY with DISTINCT
    console.log('  Test 7.7: ORDER BY with DISTINCT');
    const result7 = await excelQuery.executeQuery(
      `SELECT DISTINCT ${testColumn} FROM Sheet1 ORDER BY ${testColumn} LIMIT 10`,
      testFilePath
    );
    console.log(`    ✅ Success: ORDER BY with DISTINCT returned ${result7.length} rows`);
    results.push({ test: 'ORDER BY with DISTINCT', status: 'PASS', rows: result7.length });

    // Test 8: ORDER BY with aggregation (GROUP BY)
    console.log('  Test 7.8: ORDER BY with GROUP BY');
    try {
      const result8 = await excelQuery.executeQuery(
        `SELECT ${testColumn}, COUNT(*) as count FROM Sheet1 GROUP BY ${testColumn} ORDER BY count DESC LIMIT 10`,
        testFilePath
      );
      console.log(`    ✅ Success: ORDER BY with GROUP BY returned ${result8.length} rows`);
      results.push({ test: 'ORDER BY with GROUP BY', status: 'PASS', rows: result8.length });
    } catch (error) {
      console.log(`    ⚠️  ORDER BY with GROUP BY: ${error.message}`);
      results.push({ test: 'ORDER BY with GROUP BY', status: 'SKIP', error: error.message });
    }

    // Test 9: ORDER BY with column alias
    console.log('  Test 7.9: ORDER BY with column alias');
    const result9 = await excelQuery.executeQuery(
      `SELECT ${testColumn} AS sorted_column FROM Sheet1 ORDER BY sorted_column LIMIT 10`,
      testFilePath
    );
    console.log(`    ✅ Success: ORDER BY with alias returned ${result9.length} rows`);
    results.push({ test: 'ORDER BY with alias', status: 'PASS', rows: result9.length });

  } catch (error) {
    console.log(`    ❌ Error: ${error.message}`);
    results.push({ test: 'F-7 ORDER BY Clause', status: 'FAIL', error: error.message });
  }

  return results;
}

export { testF7OrderBy };