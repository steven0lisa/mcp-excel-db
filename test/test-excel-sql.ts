import { ExcelSqlQuery } from './excel-sql-query';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 测试Excel SQL查询功能
 */
async function testExcelSqlQuery() {
  const sqlQuery = new ExcelSqlQuery();
  
  try {
    // 加载Excel文件
  const excelPath = path.join(__dirname, 'simple-test.xlsx');
  console.log('🔄 正在加载Excel文件...');
  await sqlQuery.loadExcelFile(excelPath);
    
    // 获取工作表信息
    const worksheets = sqlQuery.getWorksheetNames();
    console.log(`📋 可用工作表: ${worksheets.join(', ')}`);
    
    if (worksheets.length === 0) {
      console.log('❌ 没有找到工作表');
      return;
    }
    
    const sheetName = worksheets[0];
    const columns = sqlQuery.getColumnNames(sheetName);
    const rowCount = sqlQuery.getRowCount(sheetName);
    
    console.log(`📊 工作表 "${sheetName}" 信息:`);
    console.log(`   - 列数: ${columns.length}`);
    console.log(`   - 行数: ${rowCount}`);
    console.log(`   - 列名: ${columns.join(', ')}`);
    
    console.log('\n🧪 开始测试SQL查询...\n');
    
    // 测试用例1: SELECT * 查询
    console.log('测试1: SELECT * 查询');
    try {
      const result1 = await sqlQuery.executeQuery(`SELECT * FROM ${sheetName} LIMIT 5`);
      console.log(`✅ 查询成功，返回 ${result1.length} 行数据`);
      if (result1.length > 0) {
        console.log('   示例数据:', JSON.stringify(result1[0], null, 2));
      }
      console.log('   所有数据:', JSON.stringify(result1, null, 2));
    } catch (error) {
      console.log(`❌ 查询失败: ${error}`);
    }
    
    // 测试用例2: 指定列查询
    console.log('\n测试2: 指定列查询');
    if (columns.length >= 2) {
      const col1 = columns[0];
      const col2 = columns[1];
      try {
        const result2 = await sqlQuery.executeQuery(`SELECT "${col1}", "${col2}" FROM ${sheetName} LIMIT 3`);
        console.log(`✅ 查询成功，返回 ${result2.length} 行数据`);
        if (result2.length > 0) {
          console.log('   示例数据:', JSON.stringify(result2[0], null, 2));
        }
        console.log('   所有数据:', JSON.stringify(result2, null, 2));
      } catch (error) {
        console.log(`❌ 查询失败: ${error}`);
      }
    }
    
    // 测试用例3: DISTINCT查询
    console.log('\n测试3: DISTINCT查询');
    if (columns.length > 0) {
      const col = columns[0];
      try {
        const result3 = await sqlQuery.executeQuery(`SELECT DISTINCT "${col}" FROM ${sheetName}`);
        console.log(`✅ 查询成功，返回 ${result3.length} 个不重复值`);
        console.log('   所有值:', JSON.stringify(result3, null, 2));
      } catch (error) {
        console.log(`❌ 查询失败: ${error}`);
      }
    }
    
    // 测试用例4: COUNT查询
    console.log('\n测试4: COUNT查询');
    try {
      const result4 = await sqlQuery.executeQuery(`SELECT COUNT(*) FROM ${sheetName}`);
      console.log(`✅ 查询成功，结果:`, JSON.stringify(result4, null, 2));
    } catch (error) {
      console.log(`❌ 查询失败: ${error}`);
    }
    
    // 测试用例5: WHERE条件查询
    console.log('\n测试5: WHERE条件查询');
    if (columns.length > 0) {
      const col = columns[0];
      try {
        const result5 = await sqlQuery.executeQuery(`SELECT COUNT(*) FROM ${sheetName} WHERE "${col}" IS NOT NULL`);
        console.log(`✅ 查询成功，非空行数: ${result5[0]['count(*)']} 行`);
      } catch (error) {
        console.log(`❌ 查询失败: ${error}`);
      }
    }
    
    // 测试用例6: ORDER BY查询
    console.log('\n测试6: ORDER BY查询');
    if (columns.length > 0) {
      const col = columns[0];
      try {
        const result6 = await sqlQuery.executeQuery(`SELECT * FROM ${sheetName} ORDER BY "${col}" LIMIT 3`);
        console.log(`✅ 查询成功，返回 ${result6.length} 行排序数据`);
      } catch (error) {
        console.log(`❌ 查询失败: ${error}`);
      }
    }
    
    // 测试不支持的语法
    console.log('\n🚫 测试不支持的语法...\n');
    
    const unsupportedQueries = [
      `SELECT * FROM ${sheetName} GROUP BY "${columns[0] || 'col1'}"`,
      `SELECT * FROM ${sheetName} HAVING COUNT(*) > 1`,
      `SELECT * FROM ${sheetName} a JOIN ${sheetName} b ON a.id = b.id`,
      `UPDATE ${sheetName} SET col1 = 'value'`,
      `INSERT INTO ${sheetName} VALUES (1, 2, 3)`
    ];
    
    for (let i = 0; i < unsupportedQueries.length; i++) {
      console.log(`不支持语法测试${i + 1}: ${unsupportedQueries[i]}`);
      try {
        await sqlQuery.executeQuery(unsupportedQueries[i]);
        console.log('❌ 应该抛出异常但没有');
      } catch (error) {
        console.log(`✅ 正确抛出异常: ${error}`);
      }
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testExcelSqlQuery().catch(console.error);

export { testExcelSqlQuery };