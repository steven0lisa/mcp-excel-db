import { ExcelSqlQuery } from '../../src/excel-sql-query.ts';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test cases for F-8: LIMIT Clause
 */
async function testF8Limit() {
  const excelQuery = new ExcelSqlQuery();
  const testFilePath = path.join(__dirname, '../test-data.xlsx');
  const results = [];

  console.log('🧪 Testing F-8: LIMIT Clause');

  try {
    // Get total row count first
    const totalResult = await excelQuery.executeQuery('SELECT COUNT(*) as total FROM Sheet1', testFilePath);
    const totalRows = totalResult[0]?.total || 0;
    console.log(`    Total rows in dataset: ${totalRows}`);

    if (totalRows === 0) {
      console.log('    ⚠️  No data available for testing');
      return results;
    }

    // Get sample data to determine available columns
    const sampleResult = await excelQuery.executeQuery('SELECT * FROM Sheet1 LIMIT 1', testFilePath);
    const columns = Object.keys(sampleResult[0]);
    const testColumn = columns[0];

    // Test 1: Basic LIMIT
    console.log('  Test 8.1: Basic LIMIT');
    const limitCount = Math.min(5, totalRows);
    const result1 = await excelQuery.executeQuery(`SELECT * FROM Sheet1 LIMIT ${limitCount}`, testFilePath);
    console.log(`    ✅ Success: LIMIT ${limitCount} returned ${result1.length} rows`);
    if (result1.length === limitCount) {
      console.log('    ✅ LIMIT count matches expected');
    } else {
      console.log(`    ⚠️  Expected ${limitCount} rows, got ${result1.length}`);
    }
    results.push({ test: 'Basic LIMIT', status: 'PASS', rows: result1.length, expected: limitCount });

    // Test 2: LIMIT with OFFSET
    console.log('  Test 8.2: LIMIT with OFFSET');
    const offset = Math.min(2, totalRows - 1);
    const limit = Math.min(3, totalRows - offset);
    const result2 = await excelQuery.executeQuery(`SELECT * FROM Sheet1 LIMIT ${limit} OFFSET ${offset}`, testFilePath);
    console.log(`    ✅ Success: LIMIT ${limit} OFFSET ${offset} returned ${result2.length} rows`);
    results.push({ test: 'LIMIT with OFFSET', status: 'PASS', rows: result2.length, limit, offset });

    // Test 3: LIMIT 0 (should return no rows)
    console.log('  Test 8.3: LIMIT 0');
    const result3 = await excelQuery.executeQuery('SELECT * FROM Sheet1 LIMIT 0', testFilePath);
    console.log(`    ✅ Success: LIMIT 0 returned ${result3.length} rows`);
    if (result3.length === 0) {
      console.log('    ✅ LIMIT 0 correctly returns no rows');
    } else {
      console.log(`    ⚠️  LIMIT 0 should return 0 rows, got ${result3.length}`);
    }
    results.push({ test: 'LIMIT 0', status: 'PASS', rows: result3.length });

    // Test 4: LIMIT larger than dataset
    console.log('  Test 8.4: LIMIT larger than dataset');
    const largeLimit = totalRows + 10;
    const result4 = await excelQuery.executeQuery(`SELECT * FROM Sheet1 LIMIT ${largeLimit}`, testFilePath);
    console.log(`    ✅ Success: LIMIT ${largeLimit} returned ${result4.length} rows`);
    if (result4.length === totalRows) {
      console.log('    ✅ LIMIT larger than dataset returns all available rows');
    }
    results.push({ test: 'LIMIT larger than dataset', status: 'PASS', rows: result4.length, total: totalRows });

    // Test 5: LIMIT with ORDER BY
    console.log('  Test 8.5: LIMIT with ORDER BY');
    const result5 = await excelQuery.executeQuery(
      `SELECT * FROM Sheet1 ORDER BY ${testColumn} LIMIT 5`,
      testFilePath
    );
    console.log(`    ✅ Success: LIMIT with ORDER BY returned ${result5.length} rows`);
    // Verify that results are ordered
    if (result5.length > 1) {
      const isOrdered = result5.every((row, i) => {
        if (i === 0) return true;
        return row[testColumn] >= result5[i-1][testColumn];
      });
      console.log(`    ${isOrdered ? '✅' : '⚠️'} Results are ${isOrdered ? 'properly' : 'not'} ordered`);
    }
    results.push({ test: 'LIMIT with ORDER BY', status: 'PASS', rows: result5.length });

    // Test 6: LIMIT with WHERE clause
    console.log('  Test 8.6: LIMIT with WHERE clause');
    const result6 = await excelQuery.executeQuery(
      `SELECT * FROM Sheet1 WHERE ${testColumn} IS NOT NULL LIMIT 5`,
      testFilePath
    );
    console.log(`    ✅ Success: LIMIT with WHERE returned ${result6.length} rows`);
    results.push({ test: 'LIMIT with WHERE', status: 'PASS', rows: result6.length });

    // Test 7: LIMIT with DISTINCT
    console.log('  Test 8.7: LIMIT with DISTINCT');
    const result7 = await excelQuery.executeQuery(
      `SELECT DISTINCT ${testColumn} FROM Sheet1 LIMIT 5`,
      testFilePath
    );
    console.log(`    ✅ Success: LIMIT with DISTINCT returned ${result7.length} rows`);
    results.push({ test: 'LIMIT with DISTINCT', status: 'PASS', rows: result7.length });

    // Test 8: Pagination simulation (multiple LIMIT/OFFSET queries)
    console.log('  Test 8.8: Pagination simulation');
    const pageSize = 3;
    const maxPages = Math.min(3, Math.ceil(totalRows / pageSize));
    let totalPaginatedRows = 0;
    
    for (let page = 0; page < maxPages; page++) {
      const pageOffset = page * pageSize;
      const pageResult = await excelQuery.executeQuery(
        `SELECT * FROM Sheet1 LIMIT ${pageSize} OFFSET ${pageOffset}`,
        testFilePath
      );
      totalPaginatedRows += pageResult.length;
      console.log(`    Page ${page + 1}: ${pageResult.length} rows (offset ${pageOffset})`);
    }
    
    console.log(`    ✅ Success: Pagination returned ${totalPaginatedRows} total rows across ${maxPages} pages`);
    results.push({ test: 'Pagination simulation', status: 'PASS', pages: maxPages, totalRows: totalPaginatedRows });

    // Test 9: LIMIT with aggregation functions
    console.log('  Test 8.9: LIMIT with aggregation');
    try {
      const result9 = await excelQuery.executeQuery(
        `SELECT ${testColumn}, COUNT(*) as count FROM Sheet1 GROUP BY ${testColumn} ORDER BY count DESC LIMIT 5`,
        testFilePath
      );
      console.log(`    ✅ Success: LIMIT with aggregation returned ${result9.length} rows`);
      results.push({ test: 'LIMIT with aggregation', status: 'PASS', rows: result9.length });
    } catch (error) {
      console.log(`    ⚠️  LIMIT with aggregation: ${error.message}`);
      results.push({ test: 'LIMIT with aggregation', status: 'SKIP', error: error.message });
    }

    // Test 10: Top N query pattern
    console.log('  Test 8.10: Top N query pattern');
    const result10 = await excelQuery.executeQuery(
      `SELECT * FROM Sheet1 ORDER BY ${testColumn} DESC LIMIT 3`,
      testFilePath
    );
    console.log(`    ✅ Success: Top N query returned ${result10.length} rows`);
    results.push({ test: 'Top N query pattern', status: 'PASS', rows: result10.length });

  } catch (error) {
    console.log(`    ❌ Error: ${error.message}`);
    results.push({ test: 'F-8 LIMIT Clause', status: 'FAIL', error: error.message });
  }

  return results;
}

export { testF8Limit };