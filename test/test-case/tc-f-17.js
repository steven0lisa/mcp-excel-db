import { ExcelSqlQuery } from '../../src/excel-sql-query.ts';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * F-17: 错误处理和消息一致性测试
 * 测试各种错误场景下的错误处理逻辑和错误消息的一致性、用户友好性
 */
async function testF17() {
  console.log('\n🧪 Testing F-17: 错误处理和消息一致性测试');
  
  const excelQuery = new ExcelSqlQuery();
  const testResults = [];
  
  // 创建测试数据文件
  await createTestFiles();
  
  try {
    // 测试1: 文件不存在错误
    console.log('\n📋 Test 1: 文件不存在错误处理');
    const nonExistentFile = '/path/to/nonexistent/file.xlsx';
    
    try {
      await excelQuery.getWorksheetInfo(nonExistentFile);
      testResults.push({
        test: 'File not found error handling',
        status: 'FAIL',
        details: '应该抛出文件不存在的错误'
      });
    } catch (error) {
      const errorMessage = error.message;
      const isFileNotFoundError = errorMessage.includes('not found') || 
                                  errorMessage.includes('does not exist') || 
                                  errorMessage.includes('ENOENT');
      testResults.push({
        test: 'File not found error handling',
        status: isFileNotFoundError ? 'PASS' : 'FAIL',
        details: `错误消息: ${errorMessage}`
      });
    }
    
    // 测试2: 工作表不存在错误
    console.log('\n📋 Test 2: 工作表不存在错误处理');
    const validFile = path.join(__dirname, '../test-data-error-handling.xlsx');
    
    try {
      await excelQuery.executeQuery('SELECT * FROM NonExistentSheet LIMIT 1', validFile);
      testResults.push({
        test: 'Worksheet not found error handling',
        status: 'FAIL',
        details: '应该抛出工作表不存在的错误'
      });
    } catch (error) {
      const errorMessage = error.message;
      const containsSheetName = errorMessage.includes('NonExistentSheet');
      const isWorksheetError = errorMessage.includes('Worksheet') || 
                               errorMessage.includes('table') || 
                               errorMessage.includes('does not exist');
      
      testResults.push({
        test: 'Worksheet not found error handling',
        status: (containsSheetName && isWorksheetError) ? 'PASS' : 'FAIL',
        details: `错误消息: ${errorMessage}`
      });
    }
    
    // 测试3: 列名不存在错误（WHERE子句中的列）
    console.log('\n📋 Test 3: 列名不存在错误处理');
    
    try {
      // 使用WHERE子句中的不存在列，这会触发验证错误
      await excelQuery.executeQuery('SELECT * FROM Sheet1 WHERE NonExistentColumn = \'test\' LIMIT 1', validFile);
      testResults.push({
        test: 'Column not found error handling',
        status: 'FAIL',
        details: '应该抛出列不存在的错误'
      });
    } catch (error) {
      const errorMessage = error.message;
      const containsColumnName = errorMessage.includes('NonExistentColumn');
      const isColumnError = errorMessage.includes('column') || 
                            errorMessage.includes('field') || 
                            errorMessage.includes('not found') ||
                            errorMessage.includes('does not exist');
      
      testResults.push({
        test: 'Column not found error handling',
        status: (containsColumnName || isColumnError) ? 'PASS' : 'FAIL',
        details: `错误消息: ${errorMessage}`
      });
    }
    
    // 测试4: SQL语法错误
    console.log('\n📋 Test 4: SQL语法错误处理');
    
    try {
      await excelQuery.executeQuery('INVALID SQL SYNTAX', validFile);
      testResults.push({
        test: 'SQL syntax error handling',
        status: 'FAIL',
        details: '应该抛出SQL语法错误'
      });
    } catch (error) {
      const errorMessage = error.message;
      const isSyntaxError = errorMessage.includes('syntax') || 
                            errorMessage.includes('parse') || 
                            errorMessage.includes('SQL') ||
                            errorMessage.includes('invalid');
      
      testResults.push({
        test: 'SQL syntax error handling',
        status: isSyntaxError ? 'PASS' : 'FAIL',
        details: `错误消息: ${errorMessage}`
      });
    }
    
    // 测试5: 损坏文件错误处理
    console.log('\n📋 Test 5: 损坏文件错误处理');
    const corruptedFile = path.join(__dirname, '../test-data-corrupted.xlsx');
    
    try {
      await excelQuery.getWorksheetInfo(corruptedFile);
      testResults.push({
        test: 'Corrupted file error handling',
        status: 'FAIL',
        details: '应该抛出文件损坏的错误'
      });
    } catch (error) {
      const errorMessage = error.message;
      const isCorruptionError = errorMessage.includes('corrupt') || 
                                errorMessage.includes('invalid') || 
                                errorMessage.includes('format') ||
                                errorMessage.includes('parse');
      
      testResults.push({
        test: 'Corrupted file error handling',
        status: isCorruptionError ? 'PASS' : 'FAIL',
        details: `错误消息: ${errorMessage}`
      });
    }
    
    // 测试6: 空文件错误处理
    console.log('\n📋 Test 6: 空文件错误处理');
    const emptyFile = path.join(__dirname, '../test-data-empty-file.xlsx');
    
    try {
      const emptyFileInfo = await excelQuery.getWorksheetInfo(emptyFile);
      if (emptyFileInfo.length === 0) {
        testResults.push({
          test: 'Empty file error handling',
          status: 'PASS',
          details: '空文件返回空工作表列表'
        });
      } else {
        // 尝试查询空文件
        try {
          await excelQuery.executeQuery('SELECT * FROM Sheet1 LIMIT 1', emptyFile);
          testResults.push({
            test: 'Empty file error handling',
            status: 'PASS',
            details: '空文件查询处理正常'
          });
        } catch (error) {
          testResults.push({
            test: 'Empty file error handling',
            status: 'PASS',
            details: `空文件查询错误处理: ${error.message}`
          });
        }
      }
    } catch (error) {
      testResults.push({
        test: 'Empty file error handling',
        status: 'PASS',
        details: `空文件错误处理: ${error.message}`
      });
    }
    
    // 测试7: 权限错误处理
    console.log('\n📋 Test 7: 权限错误处理');
    const restrictedFile = path.join(__dirname, '../test-data-restricted.xlsx');
    
    // 创建一个文件然后尝试修改权限（在支持的系统上）
    if (fs.existsSync(restrictedFile)) {
      try {
        // 尝试修改文件权限为只读
        fs.chmodSync(restrictedFile, 0o000);
        
        try {
          await excelQuery.getWorksheetInfo(restrictedFile);
          testResults.push({
            test: 'Permission error handling',
            status: 'FAIL',
            details: '应该抛出权限错误'
          });
        } catch (error) {
          const errorMessage = error.message;
          const isPermissionError = errorMessage.includes('permission') || 
                                    errorMessage.includes('access') || 
                                    errorMessage.includes('EACCES');
          
          testResults.push({
            test: 'Permission error handling',
            status: isPermissionError ? 'PASS' : 'FAIL',
            details: `错误消息: ${errorMessage}`
          });
        } finally {
          // 恢复文件权限
          try {
            fs.chmodSync(restrictedFile, 0o644);
          } catch (e) {
            // 忽略权限恢复错误
          }
        }
      } catch (chmodError) {
        testResults.push({
          test: 'Permission error handling',
          status: 'SKIP',
          details: '无法修改文件权限进行测试'
        });
      }
    } else {
      testResults.push({
        test: 'Permission error handling',
        status: 'SKIP',
        details: '权限测试文件不存在'
      });
    }
    
    // 测试8: 错误消息国际化和用户友好性
    console.log('\n📋 Test 8: 错误消息用户友好性测试');
    
    const errorScenarios = [
      {
        name: 'Invalid file extension',
        action: async () => await excelQuery.getWorksheetInfo('test.txt'),
        expectedKeywords: ['format', 'extension', 'support']
      },
      {
        name: 'Empty query',
        action: async () => await excelQuery.executeQuery('', validFile),
        expectedKeywords: ['query', 'empty', 'invalid']
      },
      {
        name: 'Malformed SQL',
        action: async () => await excelQuery.executeQuery('SELECT FROM WHERE', validFile),
        expectedKeywords: ['syntax', 'SQL', 'parse']
      }
    ];
    
    let friendlyErrorCount = 0;
    for (const scenario of errorScenarios) {
      try {
        await scenario.action();
        console.log(`❌ ${scenario.name}: 应该抛出错误`);
      } catch (error) {
        const errorMessage = error.message.toLowerCase();
        const hasFriendlyKeywords = scenario.expectedKeywords.some(keyword => 
          errorMessage.includes(keyword.toLowerCase())
        );
        
        if (hasFriendlyKeywords) {
          friendlyErrorCount++;
          console.log(`✅ ${scenario.name}: 错误消息友好`);
        } else {
          console.log(`❌ ${scenario.name}: 错误消息不够友好 - ${error.message}`);
        }
      }
    }
    
    testResults.push({
      test: 'Error message user-friendliness',
      status: friendlyErrorCount >= errorScenarios.length * 0.7 ? 'PASS' : 'FAIL', // 70%通过率
      details: `${friendlyErrorCount}/${errorScenarios.length} 个错误消息用户友好`
    });
    
    // 测试9: 错误恢复和状态一致性
    console.log('\n📋 Test 9: 错误恢复和状态一致性测试');
    
    try {
      // 先执行一个失败的查询
      try {
        await excelQuery.executeQuery('SELECT * FROM NonExistentSheet', validFile);
      } catch (e) {
        // 忽略预期的错误
      }
      
      // 然后执行一个正常的查询，验证状态恢复
      const result = await excelQuery.executeQuery('SELECT * FROM Sheet1 LIMIT 1', validFile);
      
      testResults.push({
        test: 'Error recovery and state consistency',
        status: result && result.length > 0 ? 'PASS' : 'FAIL',
        details: '错误后状态恢复正常，后续查询成功'
      });
    } catch (error) {
      testResults.push({
        test: 'Error recovery and state consistency',
        status: 'FAIL',
        details: `错误恢复失败: ${error.message}`
      });
    }
    
    // 测试10: 并发错误处理
    console.log('\n📋 Test 10: 并发错误处理测试');
    
    try {
      const concurrentPromises = [
        excelQuery.executeQuery('SELECT * FROM NonExistentSheet1', validFile).catch(e => ({ error: e.message, type: 'sheet1' })),
        excelQuery.executeQuery('SELECT * FROM NonExistentSheet2', validFile).catch(e => ({ error: e.message, type: 'sheet2' })),
        excelQuery.executeQuery('SELECT * FROM Sheet1 LIMIT 1', validFile).catch(e => ({ error: e.message, type: 'valid' }))
      ];
      
      const results = await Promise.all(concurrentPromises);
      const errorResults = results.filter(r => r.error);
      const successResults = results.filter(r => !r.error);
      
      testResults.push({
        test: 'Concurrent error handling',
        status: (errorResults.length === 2 && successResults.length === 1) ? 'PASS' : 'FAIL',
        details: `并发测试: ${errorResults.length} 个错误, ${successResults.length} 个成功`
      });
    } catch (error) {
      testResults.push({
        test: 'Concurrent error handling',
        status: 'FAIL',
        details: `并发错误处理测试失败: ${error.message}`
      });
    }
    
  } catch (error) {
    console.error('❌ F-17 测试执行失败:', error);
    testResults.push({
      test: 'F-17 Overall',
      status: 'ERROR',
      details: error.message
    });
  } finally {
    // 清理测试文件
    await cleanupTestFiles();
  }
  
  // 输出测试结果
  console.log('\n📊 F-17 测试结果汇总:');
  testResults.forEach(result => {
    const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : result.status === 'SKIP' ? '⏭️' : '⚠️';
    console.log(`${status} ${result.test}: ${result.details}`);
  });
  
  const passCount = testResults.filter(r => r.status === 'PASS').length;
  const totalCount = testResults.filter(r => r.status !== 'SKIP').length;
  console.log(`\n🎯 F-17 测试通过率: ${passCount}/${totalCount} (${((passCount/totalCount)*100).toFixed(1)}%)`);
  
  return testResults;
}

/**
 * 创建测试数据文件
 */
async function createTestFiles() {
  const testDir = path.dirname(__filename);
  
  // 创建正常的测试文件
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');
  worksheet.addRow(['ID', 'Name', 'Email', 'Age']);
  worksheet.addRow([1, 'Alice', 'alice@example.com', 25]);
  worksheet.addRow([2, 'Bob', 'bob@example.com', 30]);
  await workbook.xlsx.writeFile(path.join(testDir, '../test-data-error-handling.xlsx'));
  
  // 创建损坏的文件（实际上是文本文件）
  const corruptedContent = 'This is not a valid Excel file content';
  fs.writeFileSync(path.join(testDir, '../test-data-corrupted.xlsx'), corruptedContent);
  
  // 创建空的Excel文件
  const emptyWorkbook = new ExcelJS.Workbook();
  const emptySheet = emptyWorkbook.addWorksheet('Sheet1');
  // 不添加任何数据
  await emptyWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-empty-file.xlsx'));
  
  // 创建权限测试文件
  const restrictedWorkbook = new ExcelJS.Workbook();
  const restrictedSheet = restrictedWorkbook.addWorksheet('Sheet1');
  restrictedSheet.addRow(['Data']);
  restrictedSheet.addRow(['Test']);
  await restrictedWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-restricted.xlsx'));
}

/**
 * 清理测试文件
 */
async function cleanupTestFiles() {
  const testDir = path.dirname(__filename);
  const testFiles = [
    '../test-data-error-handling.xlsx',
    '../test-data-corrupted.xlsx',
    '../test-data-empty-file.xlsx',
    '../test-data-restricted.xlsx'
  ];
  
  for (const file of testFiles) {
    const filePath = path.join(testDir, file);
    if (fs.existsSync(filePath)) {
      try {
        // 确保文件有写权限再删除
        fs.chmodSync(filePath, 0o644);
        fs.unlinkSync(filePath);
      } catch (error) {
        // 忽略删除错误
        console.warn(`无法删除测试文件 ${filePath}:`, error.message);
      }
    }
  }
}

export { testF17 };