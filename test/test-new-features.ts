import { ExcelSqlQuery } from './excel-sql-query.js';
import * as path from 'path';

async function testNewFeatures() {
  const excelQuery = new ExcelSqlQuery();
  
  try {
    // 加载测试Excel文件
    const testFilePath = path.join(process.cwd(), 'test-data.xlsx');
    await excelQuery.loadExcelFile(testFilePath);
    
    console.log('=== 新功能测试开始 ===\n');
    
    // 测试1: SUM函数与GROUP BY
    console.log('测试1: SELECT SUM(amount) FROM Sheet1 GROUP BY category');
    try {
      const result1 = await excelQuery.executeQuery('SELECT SUM(amount) FROM Sheet1 GROUP BY category');
      console.log('结果:', JSON.stringify(result1, null, 2));
      console.log('✅ SUM + GROUP BY 测试通过\n');
    } catch (error) {
      console.error('❌ SUM + GROUP BY 测试失败:', error.message);
    }
    
    // 测试2: 带列名的GROUP BY和SUM
    console.log('测试2: SELECT category, SUM(amount) as total FROM Sheet1 GROUP BY category');
    try {
      const result2 = await excelQuery.executeQuery('SELECT category, SUM(amount) as total FROM Sheet1 GROUP BY category');
      console.log('结果:', JSON.stringify(result2, null, 2));
      console.log('✅ 带列名的 GROUP BY + SUM 测试通过\n');
    } catch (error) {
      console.error('❌ 带列名的 GROUP BY + SUM 测试失败:', error.message);
    }
    
    // 测试3: IS NULL条件查询
    console.log('测试3: SELECT * FROM Sheet1 WHERE description IS NULL LIMIT 5');
    try {
      const result3 = await excelQuery.executeQuery('SELECT * FROM Sheet1 WHERE description IS NULL LIMIT 5');
      console.log('结果:', JSON.stringify(result3, null, 2));
      console.log('✅ IS NULL 测试通过\n');
    } catch (error) {
      console.error('❌ IS NULL 测试失败:', error.message);
    }
    
    // 测试4: IS NOT NULL条件查询
    console.log('测试4: SELECT * FROM Sheet1 WHERE description IS NOT NULL LIMIT 5');
    try {
      const result4 = await excelQuery.executeQuery('SELECT * FROM Sheet1 WHERE description IS NOT NULL LIMIT 5');
      console.log('结果:', JSON.stringify(result4, null, 2));
      console.log('✅ IS NOT NULL 测试通过\n');
    } catch (error) {
      console.error('❌ IS NOT NULL 测试失败:', error.message);
    }
    
    // 测试5: 复合条件查询 (IS NULL AND IS NOT NULL)
    console.log('测试5: SELECT * FROM Sheet1 WHERE description IS NULL AND category IS NOT NULL LIMIT 10');
    try {
      const result5 = await excelQuery.executeQuery('SELECT * FROM Sheet1 WHERE description IS NULL AND category IS NOT NULL LIMIT 10');
      console.log('结果:', JSON.stringify(result5, null, 2));
      console.log('✅ 复合条件 (IS NULL AND IS NOT NULL) 测试通过\n');
    } catch (error) {
      console.error('❌ 复合条件 (IS NULL AND IS NOT NULL) 测试失败:', error.message);
    }
    
    // 测试6: 多列GROUP BY
    console.log('测试6: SELECT category, status, COUNT(*) as count FROM Sheet1 GROUP BY category, status');
    try {
      const result6 = await excelQuery.executeQuery('SELECT category, status, COUNT(*) as count FROM Sheet1 GROUP BY category, status');
      console.log('结果:', JSON.stringify(result6, null, 2));
      console.log('✅ 多列 GROUP BY 测试通过\n');
    } catch (error) {
      console.error('❌ 多列 GROUP BY 测试失败:', error.message);
    }
    
    // 测试7: GROUP BY + WHERE条件
    console.log('测试7: SELECT category, SUM(amount) as total FROM Sheet1 WHERE amount > 100 GROUP BY category');
    try {
      const result7 = await excelQuery.executeQuery('SELECT category, SUM(amount) as total FROM Sheet1 WHERE amount > 100 GROUP BY category');
      console.log('结果:', JSON.stringify(result7, null, 2));
      console.log('✅ GROUP BY + WHERE 条件测试通过\n');
    } catch (error) {
      console.error('❌ GROUP BY + WHERE 条件测试失败:', error.message);
    }
    
    // 测试8: 复杂的NULL条件查询
    console.log('测试8: SELECT * FROM Sheet1 WHERE (description IS NULL OR status IS NULL) AND amount IS NOT NULL LIMIT 5');
    try {
      const result8 = await excelQuery.executeQuery('SELECT * FROM Sheet1 WHERE (description IS NULL OR status IS NULL) AND amount IS NOT NULL LIMIT 5');
      console.log('结果:', JSON.stringify(result8, null, 2));
      console.log('✅ 复杂NULL条件查询测试通过\n');
    } catch (error) {
      console.error('❌ 复杂NULL条件查询测试失败:', error.message);
    }
    
    console.log('=== 所有新功能测试完成 ===');
    
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

// 运行测试
testNewFeatures().catch(console.error);