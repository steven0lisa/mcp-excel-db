import { ExcelSqlQuery } from '../src/excel-sql-query.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Test Excel SQL query functionality
 */
async function testExcelSql() {
  try {
    const excelQuery = new ExcelSqlQuery();
    const testFilePath = path.join(__dirname, 'test-data.xlsx');
    
    // Check if test file exists
    if (!fs.existsSync(testFilePath)) {
      console.log('❌ Test file not found');
      return;
    }
    
    // Load Excel file
    console.log('🔄 Loading Excel file...');
    
    // Get worksheet information
    const worksheetInfo = await excelQuery.getWorksheetInfo(testFilePath);
    const worksheets = worksheetInfo.map(info => info.table_name);
    console.log(`📋 Available worksheets: ${worksheets.join(', ')}`);
    
    if (worksheets.length === 0) {
      console.log('❌ No worksheets found');
      return;
    }
    
    const sheetName = worksheets[0];
    const rowCount = worksheetInfo[0].row_count;
    
    // Get column information (execute a simple query to get column names)
    const sampleResult = await excelQuery.executeQuery(`SELECT * FROM ${sheetName} LIMIT 1`, testFilePath);
    const columns = sampleResult.length > 0 ? Object.keys(sampleResult[0]) : [];
    
    console.log(`📊 Worksheet "${sheetName}" information:`);
    console.log(`   - Columns: ${columns.length}`);
    console.log(`   - Rows: ${rowCount}`);
    console.log(`   - Column names: ${columns.join(', ')}`);
    
    console.log('\n🧪 Starting SQL query tests...\n');
    
    // Test case 1: SELECT * query
    console.log('Test 1: SELECT * query');
    try {
      const result1 = await excelQuery.executeQuery(`SELECT * FROM ${sheetName}`, testFilePath);
      console.log(`✅ Query successful, returned ${result1.length} rows of data`);
      if (result1.length > 0) {
        console.log('   Sample data:', JSON.stringify(result1[0], null, 2));
      } else {
        console.log('   All data:', JSON.stringify(result1, null, 2));
      }
    } catch (error) {
      console.log(`❌ Query failed: ${error}`);
    }
    
    // Test case 2: Specific column query
    console.log('\nTest 2: Specific column query');
    if (columns.length > 0) {
      const firstColumn = columns[0];
      try {
        const result2 = await excelQuery.executeQuery(`SELECT ${firstColumn} FROM ${sheetName}`, testFilePath);
        console.log(`✅ Query successful, returned ${result2.length} rows of data`);
        if (result2.length > 0) {
          console.log('   Sample data:', JSON.stringify(result2[0], null, 2));
        } else {
          console.log('   All data:', JSON.stringify(result2, null, 2));
        }
      } catch (error) {
        console.log(`❌ Query failed: ${error}`);
      }
    }
    
    // Test case 3: DISTINCT query
    console.log('\nTest 3: DISTINCT query');
    if (columns.length > 0) {
      const firstColumn = columns[0];
      try {
        const result3 = await excelQuery.executeQuery(`SELECT DISTINCT ${firstColumn} FROM ${sheetName}`, testFilePath);
        console.log(`✅ Query successful, returned ${result3.length} unique values`);
        console.log('   All values:', JSON.stringify(result3, null, 2));
      } catch (error) {
        console.log(`❌ Query failed: ${error}`);
      }
    }
    
    // Test case 4: COUNT query
    console.log('\nTest 4: COUNT query');
    try {
      const result4 = await excelQuery.executeQuery(`SELECT COUNT(*) FROM ${sheetName}`, testFilePath);
      console.log(`✅ Query successful, result:`, JSON.stringify(result4, null, 2));
    } catch (error) {
      console.log(`❌ Query failed: ${error}`);
    }
    
    // Test case 5: WHERE condition query
    console.log('\nTest 5: WHERE condition query');
    if (columns.length > 0) {
      const firstColumn = columns[0];
      try {
        const result5 = await excelQuery.executeQuery(`SELECT COUNT(*) FROM ${sheetName} WHERE ${firstColumn} IS NOT NULL`, testFilePath);
        console.log(`✅ Query successful, non-null rows: ${result5[0]['count(*)']} rows`);
      } catch (error) {
        console.log(`❌ Query failed: ${error}`);
      }
    }
    
    // Test case 6: ORDER BY query
    console.log('\nTest 6: ORDER BY query');
    if (columns.length > 0) {
      const firstColumn = columns[0];
      try {
        const result6 = await excelQuery.executeQuery(`SELECT * FROM ${sheetName} ORDER BY ${firstColumn}`, testFilePath);
        console.log(`✅ Query successful, returned ${result6.length} rows of sorted data`);
      } catch (error) {
        console.log(`❌ Query failed: ${error}`);
      }
    }
    
    // Test unsupported syntax
    console.log('\n🚫 Testing unsupported syntax...\n');
    
    const unsupportedQueries = [
      'INSERT INTO Sheet1 VALUES (1, 2, 3)',
      'UPDATE Sheet1 SET col1 = 1',
      'DELETE FROM Sheet1',
      'SELECT * FROM Sheet1 HAVING COUNT(*) > 1',
      'WITH cte AS (SELECT * FROM Sheet1) SELECT * FROM cte'
    ];
    
    for (let i = 0; i < unsupportedQueries.length; i++) {
      console.log(`Unsupported syntax test ${i + 1}: ${unsupportedQueries[i]}`);
      try {
        await excelQuery.executeQuery(unsupportedQueries[i], testFilePath);
        console.log('❌ Should have thrown an exception but did not');
      } catch (error) {
        console.log(`✅ Correctly threw exception: ${error}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error occurred during testing:', error);
  }
}

// Run tests
testExcelSql();