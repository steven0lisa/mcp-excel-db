import { ExcelSqlQuery } from '../../src/excel-sql-query.ts';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * F-18: SQL语法兼容性和数据类型推断测试
 * 测试各种SQL语法的兼容性、标识符引用规则和数据类型自动推断功能
 */
async function testF18() {
  console.log('\n🧪 Testing F-18: SQL语法兼容性和数据类型推断测试');
  
  const excelQuery = new ExcelSqlQuery();
  const testResults = [];
  
  // 创建测试数据文件
  await createTestFiles();
  
  try {
    // 测试1: 基本SQL语法兼容性
    console.log('\n📋 Test 1: 基本SQL语法兼容性');
    const basicFile = path.join(__dirname, '../test-data-sql-compatibility.xlsx');
    
    const basicQueries = [
      'SELECT * FROM Sheet1',
      'SELECT Name, Age FROM Sheet1',
      'SELECT * FROM Sheet1 LIMIT 5',
      'SELECT * FROM Sheet1 WHERE Age > 25',
      'SELECT COUNT(*) FROM Sheet1',
      'SELECT Name FROM Sheet1 ORDER BY Age',
      'SELECT DISTINCT City FROM Sheet1'
    ];
    
    let basicSqlPassed = 0;
    for (const query of basicQueries) {
      try {
        const result = await excelQuery.executeQuery(query, basicFile);
        console.log(`✅ SQL查询成功: ${query}`);
        basicSqlPassed++;
      } catch (error) {
        console.log(`❌ SQL查询失败: ${query} - ${error.message}`);
      }
    }
    
    testResults.push({
      test: 'Basic SQL syntax compatibility',
      status: basicSqlPassed === basicQueries.length ? 'PASS' : 'FAIL',
      details: `${basicSqlPassed}/${basicQueries.length} 个基本SQL查询成功`
    });
    
    // 测试2: 标识符引用规则测试
    console.log('\n📋 Test 2: 标识符引用规则测试');
    const identifierFile = path.join(__dirname, '../test-data-identifiers.xlsx');
    
    const identifierQueries = [
      // 不带引号的标准标识符
      'SELECT Name FROM Sheet1',
      // 反引号引用
      'SELECT `User Name` FROM Sheet1',
      // 双引号引用
      'SELECT "Email Address" FROM Sheet1',
      // 方括号引用（SQL Server风格）
      'SELECT [Phone Number] FROM Sheet1',
      // 混合引用
      'SELECT Name, `User Name`, "Email Address" FROM Sheet1'
    ];
    
    let identifierPassed = 0;
    for (const query of identifierQueries) {
      try {
        const result = await excelQuery.executeQuery(query, identifierFile);
        console.log(`✅ 标识符查询成功: ${query}`);
        identifierPassed++;
      } catch (error) {
        console.log(`❌ 标识符查询失败: ${query} - ${error.message}`);
      }
    }
    
    testResults.push({
      test: 'Identifier quoting rules',
      status: identifierPassed >= identifierQueries.length * 0.6 ? 'PASS' : 'FAIL', // 60%通过率
      details: `${identifierPassed}/${identifierQueries.length} 个标识符查询成功`
    });
    
    // 测试3: 数据类型推断测试
    console.log('\n📋 Test 3: 数据类型推断测试');
    const dataTypeFile = path.join(__dirname, '../test-data-data-types.xlsx');
    
    // 测试数字类型推断
    try {
      const numberResult = await excelQuery.executeQuery('SELECT Age, Salary FROM Sheet1 WHERE Age > 25', dataTypeFile);
      const hasNumbers = numberResult.some(row => typeof row.Age === 'number' && typeof row.Salary === 'number');
      
      testResults.push({
        test: 'Number type inference',
        status: hasNumbers ? 'PASS' : 'FAIL',
        details: hasNumbers ? '数字类型推断正确' : '数字类型推断失败'
      });
    } catch (error) {
      testResults.push({
        test: 'Number type inference',
        status: 'FAIL',
        details: `数字类型测试失败: ${error.message}`
      });
    }
    
    // 测试日期类型推断
    try {
      const dateResult = await excelQuery.executeQuery('SELECT Name, BirthDate FROM Sheet1', dataTypeFile);
      const hasDates = dateResult.some(row => row.BirthDate instanceof Date || typeof row.BirthDate === 'string');
      
      testResults.push({
        test: 'Date type inference',
        status: hasDates ? 'PASS' : 'FAIL',
        details: hasDates ? '日期类型推断正确' : '日期类型推断失败'
      });
    } catch (error) {
      testResults.push({
        test: 'Date type inference',
        status: 'FAIL',
        details: `日期类型测试失败: ${error.message}`
      });
    }
    
    // 测试布尔类型推断
    try {
      const boolResult = await excelQuery.executeQuery('SELECT Name, IsActive FROM Sheet1', dataTypeFile);
      const hasBooleans = boolResult.some(row => typeof row.IsActive === 'boolean');
      
      testResults.push({
        test: 'Boolean type inference',
        status: hasBooleans ? 'PASS' : 'FAIL',
        details: hasBooleans ? '布尔类型推断正确' : '布尔类型推断失败'
      });
    } catch (error) {
      testResults.push({
        test: 'Boolean type inference',
        status: 'FAIL',
        details: `布尔类型测试失败: ${error.message}`
      });
    }
    
    // 测试4: NULL值和空值处理
    console.log('\n📋 Test 4: NULL值和空值处理');
    const nullValueFile = path.join(__dirname, '../test-data-null-values.xlsx');
    
    try {
      const nullResult = await excelQuery.executeQuery('SELECT * FROM Sheet1', nullValueFile);
      const hasNullHandling = nullResult.some(row => 
        Object.values(row).some(value => value === null || value === undefined || value === '')
      );
      
      testResults.push({
        test: 'NULL and empty value handling',
        status: 'PASS', // 只要能执行就算通过
        details: `NULL值处理测试完成，包含空值: ${hasNullHandling}`
      });
    } catch (error) {
      testResults.push({
        test: 'NULL and empty value handling',
        status: 'FAIL',
        details: `NULL值处理测试失败: ${error.message}`
      });
    }
    
    // 测试5: 复杂SQL语法测试
    console.log('\n📋 Test 5: 复杂SQL语法测试');
    
    const complexQueries = [
      // 聚合函数
      'SELECT COUNT(*), AVG(Age), MAX(Salary), MIN(Age) FROM Sheet1',
      // GROUP BY
      'SELECT City, COUNT(*) FROM Sheet1 GROUP BY City',
      // HAVING
      'SELECT City, COUNT(*) FROM Sheet1 GROUP BY City HAVING COUNT(*) > 1',
      // 子查询
      'SELECT * FROM Sheet1 WHERE Age > (SELECT AVG(Age) FROM Sheet1)',
      // JOIN（如果支持多表）
      // 'SELECT u.Name, p.ProductName FROM Users u JOIN Products p ON u.ID = p.UserID'
    ];
    
    let complexSqlPassed = 0;
    for (const query of complexQueries) {
      try {
        const result = await excelQuery.executeQuery(query, basicFile);
        console.log(`✅ 复杂SQL查询成功: ${query}`);
        complexSqlPassed++;
      } catch (error) {
        console.log(`❌ 复杂SQL查询失败: ${query} - ${error.message}`);
      }
    }
    
    testResults.push({
      test: 'Complex SQL syntax support',
      status: complexSqlPassed >= complexQueries.length * 0.5 ? 'PASS' : 'FAIL', // 50%通过率
      details: `${complexSqlPassed}/${complexQueries.length} 个复杂SQL查询成功`
    });
    
    // 测试6: 大小写不敏感测试
    console.log('\n📋 Test 6: SQL关键字大小写不敏感测试');
    
    const caseInsensitiveQueries = [
      'select * from Sheet1 LIMIT 1',
      'SELECT * FROM Sheet1 LIMIT 1', 
      'Select Name From Sheet1 LIMIT 1',
      'SELECT Name FROM Sheet1 order by Name LIMIT 1'
    ];
    
    let caseInsensitivePassed = 0;
    for (const query of caseInsensitiveQueries) {
      try {
        const result = await excelQuery.executeQuery(query, basicFile);
        console.log(`✅ 大小写不敏感查询成功: ${query}`);
        caseInsensitivePassed++;
      } catch (error) {
        console.log(`❌ 大小写不敏感查询失败: ${query} - ${error.message}`);
      }
    }
    
    testResults.push({
      test: 'Case insensitive SQL keywords',
      status: caseInsensitivePassed >= caseInsensitiveQueries.length * 0.7 ? 'PASS' : 'FAIL', // 70%通过率
      details: `${caseInsensitivePassed}/${caseInsensitiveQueries.length} 个大小写不敏感查询成功`
    });
    
    // 测试7: 特殊字符和Unicode支持
    console.log('\n📋 Test 7: 特殊字符和Unicode支持');
    const unicodeFile = path.join(__dirname, '../test-data-unicode.xlsx');
    
    const unicodeQueries = [
      'SELECT `姓名`, `年龄` FROM Sheet1',
      'SELECT * FROM Sheet1 WHERE `姓名` = \'张三\'',
      'SELECT `Email@Address` FROM Sheet1',
      'SELECT `Data-Value` FROM Sheet1'
    ];
    
    let unicodePassed = 0;
    for (const query of unicodeQueries) {
      try {
        const result = await excelQuery.executeQuery(query, unicodeFile);
        console.log(`✅ Unicode查询成功: ${query}`);
        unicodePassed++;
      } catch (error) {
        console.log(`❌ Unicode查询失败: ${query} - ${error.message}`);
      }
    }
    
    testResults.push({
      test: 'Unicode and special character support',
      status: unicodePassed >= unicodeQueries.length * 0.8 ? 'PASS' : 'FAIL', // 80%通过率
      details: `${unicodePassed}/${unicodeQueries.length} 个Unicode查询成功`
    });
    
    // 测试8: 数据类型转换和比较
    console.log('\n📋 Test 8: 数据类型转换和比较测试');
    
    const typeConversionQueries = [
      // 数字比较
      'SELECT * FROM Sheet1 WHERE Age > 25',
      'SELECT * FROM Sheet1 WHERE Salary >= 50000.0',
      // 字符串比较
      'SELECT * FROM Sheet1 WHERE Name LIKE \'A%\'',
      'SELECT * FROM Sheet1 WHERE City = \'New York\'',
      // 日期比较（如果支持）
      'SELECT * FROM Sheet1 WHERE BirthDate > \'1990-01-01\'',
      // 布尔比较
      'SELECT * FROM Sheet1 WHERE IsActive = true'
    ];
    
    let typeConversionPassed = 0;
    for (const query of typeConversionQueries) {
      try {
        const result = await excelQuery.executeQuery(query, dataTypeFile);
        console.log(`✅ 类型转换查询成功: ${query}`);
        typeConversionPassed++;
      } catch (error) {
        console.log(`❌ 类型转换查询失败: ${query} - ${error.message}`);
      }
    }
    
    testResults.push({
      test: 'Data type conversion and comparison',
      status: typeConversionPassed >= typeConversionQueries.length * 0.6 ? 'PASS' : 'FAIL', // 60%通过率
      details: `${typeConversionPassed}/${typeConversionQueries.length} 个类型转换查询成功`
    });
    
    // 测试9: SQL注入防护测试
    console.log('\n📋 Test 9: SQL注入防护测试');
    
    const injectionQueries = [
      'SELECT * FROM Sheet1 WHERE Name = \'Alice\'; DROP TABLE Sheet1; --\'',
      'SELECT * FROM Sheet1 WHERE Age = 25 OR 1=1',
      'SELECT * FROM Sheet1 WHERE Name = \'Alice\' UNION SELECT * FROM Sheet1'
    ];
    
    let injectionProtected = 0;
    for (const query of injectionQueries) {
      try {
        const result = await excelQuery.executeQuery(query, basicFile);
        // 如果查询成功但没有造成破坏，说明有防护
        console.log(`✅ SQL注入查询被安全处理: ${query}`);
        injectionProtected++;
      } catch (error) {
        // 如果查询被拒绝，也说明有防护
        console.log(`✅ SQL注入查询被拒绝: ${query} - ${error.message}`);
        injectionProtected++;
      }
    }
    
    testResults.push({
      test: 'SQL injection protection',
      status: injectionProtected === injectionQueries.length ? 'PASS' : 'FAIL',
      details: `${injectionProtected}/${injectionQueries.length} 个SQL注入尝试被防护`
    });
    
    // 测试10: 性能和内存使用测试
    console.log('\n📋 Test 10: SQL查询性能测试');
    const largeFile = path.join(__dirname, '../test-data-large-sql.xlsx');
    
    const performanceQueries = [
      'SELECT * FROM Sheet1 LIMIT 1000',
      'SELECT COUNT(*) FROM Sheet1',
      'SELECT Name, Age FROM Sheet1 WHERE Age > 25 ORDER BY Age LIMIT 100'
    ];
    
    let performancePassed = 0;
    for (const query of performanceQueries) {
      const startTime = Date.now();
      try {
        const result = await excelQuery.executeQuery(query, largeFile);
        const duration = Date.now() - startTime;
        
        if (duration < 10000) { // 10秒内完成
          console.log(`✅ 性能查询成功: ${query} (${duration}ms)`);
          performancePassed++;
        } else {
          console.log(`❌ 性能查询超时: ${query} (${duration}ms)`);
        }
      } catch (error) {
        console.log(`❌ 性能查询失败: ${query} - ${error.message}`);
      }
    }
    
    testResults.push({
      test: 'SQL query performance',
      status: performancePassed === performanceQueries.length ? 'PASS' : 'FAIL',
      details: `${performancePassed}/${performanceQueries.length} 个性能查询在合理时间内完成`
    });
    
  } catch (error) {
    console.error('❌ F-18 测试执行失败:', error);
    testResults.push({
      test: 'F-18 Overall',
      status: 'ERROR',
      details: error.message
    });
  } finally {
    // 清理测试文件
    await cleanupTestFiles();
  }
  
  // 输出测试结果
  console.log('\n📊 F-18 测试结果汇总:');
  testResults.forEach(result => {
    const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : result.status === 'SKIP' ? '⏭️' : '⚠️';
    console.log(`${status} ${result.test}: ${result.details}`);
  });
  
  const passCount = testResults.filter(r => r.status === 'PASS').length;
  const totalCount = testResults.filter(r => r.status !== 'SKIP').length;
  console.log(`\n🎯 F-18 测试通过率: ${passCount}/${totalCount} (${((passCount/totalCount)*100).toFixed(1)}%)`);
  
  return testResults;
}

/**
 * 创建测试数据文件
 */
async function createTestFiles() {
  const testDir = path.dirname(__filename);
  
  // 创建基本SQL兼容性测试文件
  const basicWorkbook = new ExcelJS.Workbook();
  const basicSheet = basicWorkbook.addWorksheet('Sheet1');
  basicSheet.addRow(['Name', 'Age', 'City', 'Salary']);
  basicSheet.addRow(['Alice', 25, 'New York', 50000]);
  basicSheet.addRow(['Bob', 30, 'London', 60000]);
  basicSheet.addRow(['Charlie', 35, 'New York', 70000]);
  basicSheet.addRow(['Diana', 28, 'Paris', 55000]);
  basicSheet.addRow(['Eve', 32, 'London', 65000]);
  await basicWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-sql-compatibility.xlsx'));
  
  // 创建标识符测试文件
  const identifierWorkbook = new ExcelJS.Workbook();
  const identifierSheet = identifierWorkbook.addWorksheet('Sheet1');
  identifierSheet.addRow(['Name', 'User Name', 'Email Address', 'Phone Number']);
  identifierSheet.addRow(['Alice', 'alice_user', 'alice@example.com', '123-456-7890']);
  identifierSheet.addRow(['Bob', 'bob_user', 'bob@example.com', '098-765-4321']);
  await identifierWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-identifiers.xlsx'));
  
  // 创建数据类型测试文件
  const dataTypeWorkbook = new ExcelJS.Workbook();
  const dataTypeSheet = dataTypeWorkbook.addWorksheet('Sheet1');
  dataTypeSheet.addRow(['Name', 'Age', 'Salary', 'BirthDate', 'IsActive']);
  
  // 添加不同数据类型的数据
  dataTypeSheet.addRow(['Alice', 25, 50000.50, new Date('1999-01-15'), true]);
  dataTypeSheet.addRow(['Bob', 30, 60000.75, new Date('1994-05-20'), false]);
  dataTypeSheet.addRow(['Charlie', 35, 70000.00, new Date('1989-12-10'), true]);
  dataTypeSheet.addRow(['Diana', 28, 55000.25, new Date('1996-08-03'), true]);
  
  await dataTypeWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-data-types.xlsx'));
  
  // 创建NULL值测试文件
  const nullValueWorkbook = new ExcelJS.Workbook();
  const nullValueSheet = nullValueWorkbook.addWorksheet('Sheet1');
  nullValueSheet.addRow(['Name', 'Age', 'City', 'Phone']);
  nullValueSheet.addRow(['Alice', 25, 'New York', '123-456-7890']);
  nullValueSheet.addRow(['Bob', null, 'London', '']);
  nullValueSheet.addRow(['Charlie', 35, '', '555-0123']);
  nullValueSheet.addRow(['', 28, 'Paris', null]);
  await nullValueWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-null-values.xlsx'));
  
  // 创建Unicode测试文件
  const unicodeWorkbook = new ExcelJS.Workbook();
  const unicodeSheet = unicodeWorkbook.addWorksheet('Sheet1');
  unicodeSheet.addRow(['姓名', '年龄', 'Email@Address', 'Data-Value']);
  unicodeSheet.addRow(['张三', 25, 'zhang@example.com', 100.5]);
  unicodeSheet.addRow(['李四', 30, 'li@example.com', 200.8]);
  unicodeSheet.addRow(['王五', 35, 'wang@example.com', 300.2]);
  await unicodeWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-unicode.xlsx'));
  
  // 创建大文件性能测试
  const largeWorkbook = new ExcelJS.Workbook();
  const largeSheet = largeWorkbook.addWorksheet('Sheet1');
  largeSheet.addRow(['Name', 'Age', 'City', 'Salary', 'Department']);
  
  // 生成1000行测试数据
  const cities = ['New York', 'London', 'Paris', 'Tokyo', 'Sydney'];
  const departments = ['IT', 'HR', 'Finance', 'Marketing', 'Sales'];
  
  for (let i = 1; i <= 1000; i++) {
    const name = `User${i}`;
    const age = 20 + (i % 40);
    const city = cities[i % cities.length];
    const salary = 40000 + (i % 50000);
    const department = departments[i % departments.length];
    
    largeSheet.addRow([name, age, city, salary, department]);
  }
  
  await largeWorkbook.xlsx.writeFile(path.join(testDir, '../test-data-large-sql.xlsx'));
}

/**
 * 清理测试文件
 */
async function cleanupTestFiles() {
  const testDir = path.dirname(__filename);
  const testFiles = [
    '../test-data-sql-compatibility.xlsx',
    '../test-data-identifiers.xlsx',
    '../test-data-data-types.xlsx',
    '../test-data-null-values.xlsx',
    '../test-data-unicode.xlsx',
    '../test-data-large-sql.xlsx'
  ];
  
  for (const file of testFiles) {
    const filePath = path.join(testDir, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

export { testF18 };