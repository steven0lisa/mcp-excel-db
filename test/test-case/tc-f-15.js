import { ExcelSqlQuery } from '../../src/excel-sql-query.ts';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * F-15: 工作表名称和列信息一致性测试
 * 测试工作表名称识别、列信息获取的一致性和可靠性
 */
async function testF15() {
  console.log('\n🧪 Testing F-15: 工作表名称和列信息一致性测试');
  
  const excelQuery = new ExcelSqlQuery();
  const testResults = [];
  
  // 创建测试数据文件
  await createTestFiles();
  
  try {
    // 测试1: 工作表名称一致性 - 单工作表默认命名
    console.log('\n📋 Test 1: 单工作表默认命名一致性');
    const singleSheetFile = path.join(__dirname, '../test-data-single-sheet.xlsx');
    
    const worksheetInfo = await excelQuery.getWorksheetInfo(singleSheetFile);
    console.log('getWorksheetInfo 返回:', worksheetInfo.map(w => w.table_name));
    
    // 验证返回的工作表名称可以用于查询
    const tableName = worksheetInfo[0].table_name;
    try {
      const queryResult = await excelQuery.executeQuery(`SELECT * FROM ${tableName} LIMIT 1`, singleSheetFile);
      testResults.push({
        test: 'Single sheet naming consistency',
        status: 'PASS',
        details: `工作表名称 "${tableName}" 查询成功`
      });
    } catch (error) {
      testResults.push({
        test: 'Single sheet naming consistency',
        status: 'FAIL',
        details: `工作表名称 "${tableName}" 查询失败: ${error.message}`
      });
    }
    
    // 测试2: 列信息获取可靠性
    console.log('\n📋 Test 2: 列信息获取可靠性');
    const columnInfo = await excelQuery.getWorksheetColumns(singleSheetFile);
    console.log('getWorksheetColumns 返回:', columnInfo);
    
    if (columnInfo.length > 0 && columnInfo[0].columns.length > 0) {
      // 验证列名可以用于查询
      const columns = columnInfo[0].columns.slice(0, 3).join(', '); // 取前3列
      try {
        const queryResult = await excelQuery.executeQuery(`SELECT ${columns} FROM ${tableName} LIMIT 1`, singleSheetFile);
        testResults.push({
          test: 'Column info reliability',
          status: 'PASS',
          details: `列名 "${columns}" 查询成功`
        });
      } catch (error) {
        testResults.push({
          test: 'Column info reliability',
          status: 'FAIL',
          details: `列名 "${columns}" 查询失败: ${error.message}`
        });
      }
    } else {
      testResults.push({
        test: 'Column info reliability',
        status: 'FAIL',
        details: 'getWorksheetColumns 返回空结果'
      });
    }
    
    // 测试3: 多工作表文件命名一致性
    console.log('\n📋 Test 3: 多工作表文件命名一致性');
    const multiSheetFile = path.join(__dirname, '../test-data-multi-sheet.xlsx');
    
    const multiWorksheetInfo = await excelQuery.getWorksheetInfo(multiSheetFile);
    console.log('多工作表文件信息:', multiWorksheetInfo.map(w => w.table_name));
    
    let multiSheetTestPassed = true;
    for (const worksheet of multiWorksheetInfo) {
      try {
        await excelQuery.executeQuery(`SELECT * FROM ${worksheet.table_name} LIMIT 1`, multiSheetFile);
        console.log(`✅ 工作表 "${worksheet.table_name}" 查询成功`);
      } catch (error) {
        console.log(`❌ 工作表 "${worksheet.table_name}" 查询失败: ${error.message}`);
        multiSheetTestPassed = false;
      }
    }
    
    testResults.push({
      test: 'Multi-sheet naming consistency',
      status: multiSheetTestPassed ? 'PASS' : 'FAIL',
      details: `${multiWorksheetInfo.length} 个工作表命名一致性测试`
    });
    
    // 测试4: 特殊字符工作表名称
    console.log('\n📋 Test 4: 特殊字符工作表名称');
    const specialCharFile = path.join(__dirname, '../test-data-special-chars.xlsx');
    
    try {
      const specialWorksheetInfo = await excelQuery.getWorksheetInfo(specialCharFile);
      console.log('特殊字符工作表:', specialWorksheetInfo.map(w => w.table_name));
      
      // 尝试查询特殊字符工作表
      const specialTableName = specialWorksheetInfo[0].table_name;
      await excelQuery.executeQuery(`SELECT * FROM \`${specialTableName}\` LIMIT 1`, specialCharFile);
      
      testResults.push({
        test: 'Special character worksheet names',
        status: 'PASS',
        details: `特殊字符工作表 "${specialTableName}" 处理成功`
      });
    } catch (error) {
      testResults.push({
        test: 'Special character worksheet names',
        status: 'FAIL',
        details: `特殊字符工作表处理失败: ${error.message}`
      });
    }
    
    // 测试5: 错误处理一致性
    console.log('\n📋 Test 5: 错误处理一致性');
    try {
      await excelQuery.executeQuery('SELECT * FROM NonExistentSheet LIMIT 1', singleSheetFile);
      testResults.push({
        test: 'Error handling consistency',
        status: 'FAIL',
        details: '应该抛出工作表不存在的错误'
      });
    } catch (error) {
      const errorMessage = error.message;
      const containsWorksheetName = errorMessage.includes('NonExistentSheet');
      testResults.push({
        test: 'Error handling consistency',
        status: containsWorksheetName ? 'PASS' : 'FAIL',
        details: `错误消息: ${errorMessage}`
      });
    }
    
    // 测试6: CSV 文件工作表名称一致性
    console.log('\n📋 Test 6: CSV 文件工作表名称一致性');
    const csvFile = path.join(__dirname, '../test-data.csv');
    
    if (fs.existsSync(csvFile)) {
      const csvWorksheetInfo = await excelQuery.getWorksheetInfo(csvFile);
      console.log('CSV 工作表信息:', csvWorksheetInfo.map(w => w.table_name));
      
      const csvTableName = csvWorksheetInfo[0].table_name;
      try {
        await excelQuery.executeQuery(`SELECT * FROM ${csvTableName} LIMIT 1`, csvFile);
        testResults.push({
          test: 'CSV worksheet naming consistency',
          status: 'PASS',
          details: `CSV 工作表名称 "${csvTableName}" 查询成功`
        });
      } catch (error) {
        testResults.push({
          test: 'CSV worksheet naming consistency',
          status: 'FAIL',
          details: `CSV 工作表名称 "${csvTableName}" 查询失败: ${error.message}`
        });
      }
    } else {
      testResults.push({
        test: 'CSV worksheet naming consistency',
        status: 'SKIP',
        details: 'CSV 测试文件不存在'
      });
    }
    
    // 测试7: 大小写敏感性测试
    console.log('\n📋 Test 7: 列名大小写敏感性测试');
    const mixedCaseFile = path.join(__dirname, '../test-data-mixed-case.xlsx');
    
    try {
      const mixedCaseColumnInfo = await excelQuery.getWorksheetColumns(mixedCaseFile);
      if (mixedCaseColumnInfo.length > 0 && mixedCaseColumnInfo[0].columns.length > 0) {
        const actualColumns = mixedCaseColumnInfo[0].columns;
        console.log('实际列名:', actualColumns);
        
        // 测试使用实际列名查询
        const firstColumn = actualColumns[0];
        await excelQuery.executeQuery(`SELECT ${firstColumn} FROM Sheet1 LIMIT 1`, mixedCaseFile);
        
        testResults.push({
          test: 'Column case sensitivity',
          status: 'PASS',
          details: `列名大小写处理正确，实际列名: ${actualColumns.join(', ')}`
        });
      } else {
        testResults.push({
          test: 'Column case sensitivity',
          status: 'FAIL',
          details: '无法获取列信息'
        });
      }
    } catch (error) {
      testResults.push({
        test: 'Column case sensitivity',
        status: 'FAIL',
        details: `列名大小写测试失败: ${error.message}`
      });
    }
    
    // 测试8: 空文件和边界情况
    console.log('\n📋 Test 8: 空文件和边界情况测试');
    const emptyFile = path.join(__dirname, '../test-data-empty.xlsx');
    
    try {
      const emptyWorksheetInfo = await excelQuery.getWorksheetInfo(emptyFile);
      const emptyColumnInfo = await excelQuery.getWorksheetColumns(emptyFile);
      
      testResults.push({
        test: 'Empty file handling',
        status: 'PASS',
        details: `空文件处理成功，工作表数: ${emptyWorksheetInfo.length}, 列数: ${emptyColumnInfo.length > 0 ? emptyColumnInfo[0].columns.length : 0}`
      });
    } catch (error) {
      testResults.push({
        test: 'Empty file handling',
        status: 'FAIL',
        details: `空文件处理失败: ${error.message}`
      });
    }
    
  } catch (error) {
    console.error('❌ F-15 测试执行失败:', error);
    testResults.push({
      test: 'F-15 Overall',
      status: 'ERROR',
      details: error.message
    });
  } finally {
    // 清理测试文件
    await cleanupTestFiles();
  }
  
  // 输出测试结果
  console.log('\n📊 F-15 测试结果汇总:');
  testResults.forEach(result => {
    const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : result.status === 'SKIP' ? '⏭️' : '⚠️';
    console.log(`${status} ${result.test}: ${result.details}`);
  });
  
  const passCount = testResults.filter(r => r.status === 'PASS').length;
  const totalCount = testResults.filter(r => r.status !== 'SKIP').length;
  console.log(`\n🎯 F-15 测试通过率: ${passCount}/${totalCount} (${((passCount/totalCount)*100).toFixed(1)}%)`);
  
  return testResults;
}

/**
 * 创建测试数据文件
 */
async function createTestFiles() {
  const testDir = path.dirname(__filename);
  
  // 创建单工作表文件
  const singleSheetWorkbook = new ExcelJS.Workbook();
  const worksheet1 = singleSheetWorkbook.addWorksheet('Sheet1');
  worksheet1.addRow(['Name', 'Age', 'City']);
  worksheet1.addRow(['Alice', 25, 'New York']);
  worksheet1.addRow(['Bob', 30, 'London']);
  await singleSheetWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-single-sheet.xlsx'));
  
  // 创建多工作表文件
  const multiSheetWorkbook = new ExcelJS.Workbook();
  const sheet1 = multiSheetWorkbook.addWorksheet('Sheet1');
  sheet1.addRow(['ID', 'Name']);
  sheet1.addRow([1, 'Alice']);
  
  const sheet2 = multiSheetWorkbook.addWorksheet('DataSheet');
  sheet2.addRow(['Product', 'Price']);
  sheet2.addRow(['Apple', 1.5]);
  
  const sheet3 = multiSheetWorkbook.addWorksheet('Summary');
  sheet3.addRow(['Total', 'Count']);
  sheet3.addRow([100, 50]);
  await multiSheetWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-multi-sheet.xlsx'));
  
  // 创建特殊字符工作表文件
  const specialCharWorkbook = new ExcelJS.Workbook();
  const specialSheet = specialCharWorkbook.addWorksheet('数据表-2024');
  specialSheet.addRow(['姓名', '年龄', '城市']);
  specialSheet.addRow(['张三', 25, '北京']);
  await specialCharWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-special-chars.xlsx'));
  
  // 创建混合大小写列名文件
  const mixedCaseWorkbook = new ExcelJS.Workbook();
  const mixedSheet = mixedCaseWorkbook.addWorksheet('Sheet1');
  mixedSheet.addRow(['PAT_Type', 'GeoSize', 'CAI', 'DataValue']);
  mixedSheet.addRow(['Type1', 'Large', 100, 1.5]);
  mixedSheet.addRow(['Type2', 'Small', 200, 2.5]);
  await mixedCaseWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-mixed-case.xlsx'));
  
  // 创建空文件
  const emptyWorkbook = new ExcelJS.Workbook();
  const emptySheet = emptyWorkbook.addWorksheet('Sheet1');
  // 只添加标题行，没有数据
  emptySheet.addRow(['Column1', 'Column2', 'Column3']);
  await emptyWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-empty.xlsx'));
}

/**
 * 清理测试文件
 */
async function cleanupTestFiles() {
  const testDir = path.dirname(__filename);
  const testFiles = [
    '../test-data-single-sheet.xlsx',
    '../test-data-multi-sheet.xlsx',
    '../test-data-special-chars.xlsx',
    '../test-data-mixed-case.xlsx',
    '../test-data-empty.xlsx'
  ];
  
  for (const file of testFiles) {
    const filePath = path.join(testDir, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

export { testF15 };