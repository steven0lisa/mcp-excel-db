import { ExcelSqlQuery } from '../../src/excel-sql-query.ts';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * F-16: 列信息获取和大小写敏感性测试
 * 测试列名获取的准确性、大小写处理和格式兼容性
 */
async function testF16() {
  console.log('\n🧪 Testing F-16: 列信息获取和大小写敏感性测试');
  
  const excelQuery = new ExcelSqlQuery();
  const testResults = [];
  
  // 创建测试数据文件
  await createTestFiles();
  
  try {
    // 测试1: 基本列信息获取
    console.log('\n📋 Test 1: 基本列信息获取');
    const basicFile = path.join(__dirname, '../test-data-basic-columns.xlsx');
    
    const basicColumnInfo = await excelQuery.getWorksheetColumns(basicFile);
    console.log('基本列信息:', basicColumnInfo);
    
    if (basicColumnInfo.length > 0 && basicColumnInfo[0].columns.length > 0) {
      const expectedColumns = ['Name', 'Age', 'City', 'Salary'];
      const actualColumns = basicColumnInfo[0].columns;
      const columnsMatch = expectedColumns.every(col => actualColumns.includes(col));
      
      testResults.push({
        test: 'Basic column info retrieval',
        status: columnsMatch ? 'PASS' : 'FAIL',
        details: `期望列: ${expectedColumns.join(', ')}, 实际列: ${actualColumns.join(', ')}`
      });
    } else {
      testResults.push({
        test: 'Basic column info retrieval',
        status: 'FAIL',
        details: 'getWorksheetColumns 返回空结果'
      });
    }
    
    // 测试2: 大小写混合列名处理
    console.log('\n📋 Test 2: 大小写混合列名处理');
    const mixedCaseFile = path.join(__dirname, '../test-data-mixed-case-columns.xlsx');
    
    const mixedCaseColumnInfo = await excelQuery.getWorksheetColumns(mixedCaseFile);
    console.log('混合大小写列信息:', mixedCaseColumnInfo);
    
    if (mixedCaseColumnInfo.length > 0 && mixedCaseColumnInfo[0].columns.length > 0) {
      const actualColumns = mixedCaseColumnInfo[0].columns;
      const expectedColumns = ['PAT_Type', 'GeoSize', 'CAI', 'DataValue', 'user_ID', 'Email_Address'];
      
      // 验证列名完全匹配（包括大小写）
      const exactMatch = expectedColumns.every(col => actualColumns.includes(col));
      
      testResults.push({
        test: 'Mixed case column handling',
        status: exactMatch ? 'PASS' : 'FAIL',
        details: `期望列: ${expectedColumns.join(', ')}, 实际列: ${actualColumns.join(', ')}`
      });
      
      // 测试使用实际列名进行查询
      try {
        const firstColumn = actualColumns[0];
        const queryResult = await excelQuery.executeQuery(`SELECT ${firstColumn} FROM Sheet1 LIMIT 1`, mixedCaseFile);
        testResults.push({
          test: 'Query with actual column names',
          status: 'PASS',
          details: `使用列名 "${firstColumn}" 查询成功`
        });
      } catch (error) {
        testResults.push({
          test: 'Query with actual column names',
          status: 'FAIL',
          details: `查询失败: ${error.message}`
        });
      }
    } else {
      testResults.push({
        test: 'Mixed case column handling',
        status: 'FAIL',
        details: '无法获取混合大小写列信息'
      });
    }
    
    // 测试3: 特殊字符列名处理
    console.log('\n📋 Test 3: 特殊字符列名处理');
    const specialCharFile = path.join(__dirname, '../test-data-special-char-columns.xlsx');
    
    const specialCharColumnInfo = await excelQuery.getWorksheetColumns(specialCharFile);
    console.log('特殊字符列信息:', specialCharColumnInfo);
    
    if (specialCharColumnInfo.length > 0 && specialCharColumnInfo[0].columns.length > 0) {
      const actualColumns = specialCharColumnInfo[0].columns;
      const expectedColumns = ['姓名', '年龄', 'Email@Address', 'Phone#Number', 'Data-Value', 'User ID'];
      
      const hasSpecialChars = expectedColumns.some(col => actualColumns.includes(col));
      
      testResults.push({
        test: 'Special character column names',
        status: hasSpecialChars ? 'PASS' : 'FAIL',
        details: `期望包含特殊字符列，实际列: ${actualColumns.join(', ')}`
      });
      
      // 测试特殊字符列名查询
      try {
        const chineseColumn = actualColumns.find(col => /[\u4e00-\u9fff]/.test(col));
        if (chineseColumn) {
          await excelQuery.executeQuery(`SELECT \`${chineseColumn}\` FROM Sheet1 LIMIT 1`, specialCharFile);
          testResults.push({
            test: 'Special character column query',
            status: 'PASS',
            details: `特殊字符列名 "${chineseColumn}" 查询成功`
          });
        } else {
          testResults.push({
            test: 'Special character column query',
            status: 'SKIP',
            details: '未找到特殊字符列名'
          });
        }
      } catch (error) {
        testResults.push({
          test: 'Special character column query',
          status: 'FAIL',
          details: `特殊字符列名查询失败: ${error.message}`
        });
      }
    } else {
      testResults.push({
        test: 'Special character column names',
        status: 'FAIL',
        details: '无法获取特殊字符列信息'
      });
    }
    
    // 测试4: 空列名和默认列名处理
    console.log('\n📋 Test 4: 空列名和默认列名处理');
    const emptyColumnFile = path.join(__dirname, '../test-data-empty-columns.xlsx');
    
    const emptyColumnInfo = await excelQuery.getWorksheetColumns(emptyColumnFile);
    console.log('空列名文件信息:', emptyColumnInfo);
    
    if (emptyColumnInfo.length > 0 && emptyColumnInfo[0].columns.length > 0) {
      const actualColumns = emptyColumnInfo[0].columns;
      const hasDefaultColumns = actualColumns.some(col => col.startsWith('Column'));
      
      testResults.push({
        test: 'Empty column name handling',
        status: hasDefaultColumns ? 'PASS' : 'FAIL',
        details: `空列名处理，生成列名: ${actualColumns.join(', ')}`
      });
    } else {
      testResults.push({
        test: 'Empty column name handling',
        status: 'FAIL',
        details: '无法处理空列名文件'
      });
    }
    
    // 测试5: CSV文件列信息获取
    console.log('\n📋 Test 5: CSV文件列信息获取');
    const csvFile = path.join(__dirname, '../test-data-columns.csv');
    
    if (fs.existsSync(csvFile)) {
      const csvColumnInfo = await excelQuery.getWorksheetColumns(csvFile);
      console.log('CSV列信息:', csvColumnInfo);
      
      if (csvColumnInfo.length > 0 && csvColumnInfo[0].columns.length > 0) {
        testResults.push({
          test: 'CSV column info retrieval',
          status: 'PASS',
          details: `CSV列名: ${csvColumnInfo[0].columns.join(', ')}`
        });
      } else {
        testResults.push({
          test: 'CSV column info retrieval',
          status: 'FAIL',
          details: 'CSV文件列信息获取失败'
        });
      }
    } else {
      testResults.push({
        test: 'CSV column info retrieval',
        status: 'SKIP',
        details: 'CSV测试文件不存在'
      });
    }
    
    // 测试6: 大文件列信息获取性能
    console.log('\n📋 Test 6: 大文件列信息获取性能');
    const largeFile = path.join(__dirname, '../test-data-large-columns.xlsx');
    
    const startTime = Date.now();
    const largeFileColumnInfo = await excelQuery.getWorksheetColumns(largeFile);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (largeFileColumnInfo.length > 0 && largeFileColumnInfo[0].columns.length > 0) {
      testResults.push({
        test: 'Large file column info performance',
        status: duration < 5000 ? 'PASS' : 'FAIL', // 5秒内完成
        details: `大文件列信息获取耗时: ${duration}ms, 列数: ${largeFileColumnInfo[0].columns.length}`
      });
    } else {
      testResults.push({
        test: 'Large file column info performance',
        status: 'FAIL',
        details: '大文件列信息获取失败'
      });
    }
    
    // 测试7: 多工作表列信息获取
    console.log('\n📋 Test 7: 多工作表列信息获取');
    const multiSheetFile = path.join(__dirname, '../test-data-multi-sheet-columns.xlsx');
    
    const multiSheetColumnInfo = await excelQuery.getWorksheetColumns(multiSheetFile);
    console.log('多工作表列信息:', multiSheetColumnInfo);
    
    if (multiSheetColumnInfo.length > 1) {
      const allSheetsHaveColumns = multiSheetColumnInfo.every(sheet => sheet.columns.length > 0);
      testResults.push({
        test: 'Multi-sheet column info retrieval',
        status: allSheetsHaveColumns ? 'PASS' : 'FAIL',
        details: `${multiSheetColumnInfo.length} 个工作表，列信息获取状态: ${multiSheetColumnInfo.map(s => `${s.table_name}(${s.columns.length}列)`).join(', ')}`
      });
    } else {
      testResults.push({
        test: 'Multi-sheet column info retrieval',
        status: 'FAIL',
        details: '多工作表列信息获取失败'
      });
    }
    
    // 测试8: 列名与查询一致性验证
    console.log('\n📋 Test 8: 列名与查询一致性验证');
    const consistencyFile = path.join(__dirname, '../test-data-consistency-columns.xlsx');
    
    const consistencyColumnInfo = await excelQuery.getWorksheetColumns(consistencyFile);
    if (consistencyColumnInfo.length > 0 && consistencyColumnInfo[0].columns.length > 0) {
      const columns = consistencyColumnInfo[0].columns;
      let consistencyTestPassed = true;
      const failedColumns = [];
      
      // 测试每个列名是否可以用于查询
      for (const column of columns.slice(0, 5)) { // 测试前5列
        try {
          await excelQuery.executeQuery(`SELECT \`${column}\` FROM Sheet1 LIMIT 1`, consistencyFile);
          console.log(`✅ 列名 "${column}" 查询成功`);
        } catch (error) {
          console.log(`❌ 列名 "${column}" 查询失败: ${error.message}`);
          consistencyTestPassed = false;
          failedColumns.push(column);
        }
      }
      
      testResults.push({
        test: 'Column name query consistency',
        status: consistencyTestPassed ? 'PASS' : 'FAIL',
        details: consistencyTestPassed ? 
          `所有列名查询一致性验证通过` : 
          `失败的列名: ${failedColumns.join(', ')}`
      });
    } else {
      testResults.push({
        test: 'Column name query consistency',
        status: 'FAIL',
        details: '无法获取列信息进行一致性验证'
      });
    }
    
  } catch (error) {
    console.error('❌ F-16 测试执行失败:', error);
    testResults.push({
      test: 'F-16 Overall',
      status: 'ERROR',
      details: error.message
    });
  } finally {
    // 清理测试文件
    await cleanupTestFiles();
  }
  
  // 输出测试结果
  console.log('\n📊 F-16 测试结果汇总:');
  testResults.forEach(result => {
    const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : result.status === 'SKIP' ? '⏭️' : '⚠️';
    console.log(`${status} ${result.test}: ${result.details}`);
  });
  
  const passCount = testResults.filter(r => r.status === 'PASS').length;
  const totalCount = testResults.filter(r => r.status !== 'SKIP').length;
  console.log(`\n🎯 F-16 测试通过率: ${passCount}/${totalCount} (${((passCount/totalCount)*100).toFixed(1)}%)`);
  
  return testResults;
}

/**
 * 创建测试数据文件
 */
async function createTestFiles() {
  const testDir = path.dirname(__filename);
  
  // 创建基本列信息测试文件
  const basicWorkbook = new ExcelJS.Workbook();
  const basicSheet = basicWorkbook.addWorksheet('Sheet1');
  basicSheet.addRow(['Name', 'Age', 'City', 'Salary']);
  basicSheet.addRow(['Alice', 25, 'New York', 50000]);
  basicSheet.addRow(['Bob', 30, 'London', 60000]);
  await basicWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-basic-columns.xlsx'));
  
  // 创建混合大小写列名文件
  const mixedCaseWorkbook = new ExcelJS.Workbook();
  const mixedCaseSheet = mixedCaseWorkbook.addWorksheet('Sheet1');
  mixedCaseSheet.addRow(['PAT_Type', 'GeoSize', 'CAI', 'DataValue', 'user_ID', 'Email_Address']);
  mixedCaseSheet.addRow(['Type1', 'Large', 100, 1.5, 'user001', 'alice@example.com']);
  mixedCaseSheet.addRow(['Type2', 'Small', 200, 2.5, 'user002', 'bob@example.com']);
  await mixedCaseWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-mixed-case-columns.xlsx'));
  
  // 创建特殊字符列名文件
  const specialCharWorkbook = new ExcelJS.Workbook();
  const specialCharSheet = specialCharWorkbook.addWorksheet('Sheet1');
  specialCharSheet.addRow(['姓名', '年龄', 'Email@Address', 'Phone#Number', 'Data-Value', 'User ID']);
  specialCharSheet.addRow(['张三', 25, 'zhang@example.com', '123-456-7890', 100.5, 'U001']);
  specialCharSheet.addRow(['李四', 30, 'li@example.com', '098-765-4321', 200.8, 'U002']);
  await specialCharWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-special-char-columns.xlsx'));
  
  // 创建空列名文件
  const emptyColumnWorkbook = new ExcelJS.Workbook();
  const emptyColumnSheet = emptyColumnWorkbook.addWorksheet('Sheet1');
  emptyColumnSheet.addRow(['Name', '', 'Age', '', 'City']); // 包含空列名
  emptyColumnSheet.addRow(['Alice', 'Data1', 25, 'Data2', 'New York']);
  await emptyColumnWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-empty-columns.xlsx'));
  
  // 创建CSV测试文件
  const csvContent = 'Product,Price,Category,InStock\nApple,1.5,Fruit,true\nBanana,0.8,Fruit,false\nCarrot,2.0,Vegetable,true';
  fs.writeFileSync(path.join(testDir, '../test-data-columns.csv'), csvContent);
  
  // 创建大文件（模拟大量列）
  const largeWorkbook = new ExcelJS.Workbook();
  const largeSheet = largeWorkbook.addWorksheet('Sheet1');
  const largeHeaders = [];
  for (let i = 1; i <= 50; i++) {
    largeHeaders.push(`Column${i}`);
  }
  largeSheet.addRow(largeHeaders);
  // 添加一些数据行
  for (let row = 1; row <= 100; row++) {
    const rowData = largeHeaders.map((_, index) => `Data${row}_${index + 1}`);
    largeSheet.addRow(rowData);
  }
  await largeWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-large-columns.xlsx'));
  
  // 创建多工作表文件
  const multiSheetWorkbook = new ExcelJS.Workbook();
  
  const sheet1 = multiSheetWorkbook.addWorksheet('Users');
  sheet1.addRow(['UserID', 'Username', 'Email']);
  sheet1.addRow([1, 'alice', 'alice@example.com']);
  
  const sheet2 = multiSheetWorkbook.addWorksheet('Products');
  sheet2.addRow(['ProductID', 'ProductName', 'Price', 'Category']);
  sheet2.addRow([1, 'Apple', 1.5, 'Fruit']);
  
  const sheet3 = multiSheetWorkbook.addWorksheet('Orders');
  sheet3.addRow(['OrderID', 'UserID', 'ProductID', 'Quantity', 'OrderDate']);
  sheet3.addRow([1, 1, 1, 5, '2024-01-01']);
  
  await multiSheetWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-multi-sheet-columns.xlsx'));
  
  // 创建一致性测试文件
  const consistencyWorkbook = new ExcelJS.Workbook();
  const consistencySheet = consistencyWorkbook.addWorksheet('Sheet1');
  consistencySheet.addRow(['ID', 'Name', 'Email', 'Phone', 'Address', 'City', 'Country']);
  consistencySheet.addRow([1, 'Alice', 'alice@example.com', '123-456-7890', '123 Main St', 'New York', 'USA']);
  consistencySheet.addRow([2, 'Bob', 'bob@example.com', '098-765-4321', '456 Oak Ave', 'London', 'UK']);
  await consistencyWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-consistency-columns.xlsx'));
}

/**
 * 清理测试文件
 */
async function cleanupTestFiles() {
  const testDir = path.dirname(__filename);
  const testFiles = [
    '../test-data-basic-columns.xlsx',
    '../test-data-mixed-case-columns.xlsx',
    '../test-data-special-char-columns.xlsx',
    '../test-data-empty-columns.xlsx',
    '../test-data-columns.csv',
    '../test-data-large-columns.xlsx',
    '../test-data-multi-sheet-columns.xlsx',
    '../test-data-consistency-columns.xlsx'
  ];
  
  for (const file of testFiles) {
    const filePath = path.join(testDir, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

export { testF16 };