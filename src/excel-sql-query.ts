import ExcelJS from 'exceljs';
import { createRequire } from 'module';
import * as path from 'path';

const require = createRequire(import.meta.url);
const NodeSqlParser = require('node-sql-parser');

/**
 * Excel SQL查询工具类
 * 支持对Excel文件进行简单的SQL查询操作
 */
export class ExcelSqlQuery {
  private workbook: ExcelJS.Workbook | null = null;
  private parser: any;
  private worksheetData: Map<string, any[]> = new Map();

  constructor() {
    this.parser = new NodeSqlParser.Parser();
  }

  /**
   * 加载Excel文件
   */
  async loadExcelFile(filePath: string): Promise<void> {
    try {
      this.workbook = new ExcelJS.Workbook();
      
      // 使用流式读取，避免内存问题
      const stream = require('fs').createReadStream(filePath);
      await this.workbook.xlsx.read(stream);
      
      // 预加载所有工作表数据到内存中
      await this.preloadWorksheetData();
      
      console.log(`✅ Excel文件加载成功: ${path.basename(filePath)}`);
    } catch (error) {
      console.error('Excel文件加载详细错误:', error);
      throw new Error(`加载Excel文件失败: ${error}`);
    }
  }

  /**
   * 预加载所有工作表数据
   */
  private async preloadWorksheetData(): Promise<void> {
    if (!this.workbook) {
      throw new Error('Excel文件未加载');
    }

    this.workbook.eachSheet((worksheet) => {
      const sheetData: any[] = [];
      const headers: string[] = [];
      
      try {
        // 获取表头
        const headerRow = worksheet.getRow(1);
        const maxCols = headerRow.cellCount;
        
        for (let colNumber = 1; colNumber <= maxCols; colNumber++) {
          const cell = headerRow.getCell(colNumber);
          headers[colNumber - 1] = cell.value?.toString() || `Column${colNumber}`;
        }

        // 限制加载的行数，避免内存溢出
        const maxRows = Math.min(worksheet.rowCount, 10000); // 最多加载10000行
        
        // 获取数据行
        for (let rowNumber = 2; rowNumber <= maxRows; rowNumber++) {
          const row = worksheet.getRow(rowNumber);
          const rowData: any = {};
          let hasData = false;
          
          // 遍历所有列
          for (let colNumber = 1; colNumber <= maxCols; colNumber++) {
            const cell = row.getCell(colNumber);
            const header = headers[colNumber - 1];
            if (header) {
              rowData[header] = cell.value;
              if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
                hasData = true;
              }
            }
          }
          
          // 只添加非空行
          if (hasData) {
            sheetData.push(rowData);
          }
        }

        this.worksheetData.set(worksheet.name, sheetData);
        console.log(`📊 工作表 "${worksheet.name}" 数据加载完成，共 ${sheetData.length} 行 (最大 ${maxRows} 行)`);
        console.log(`📋 表头信息:`, headers);
        if (sheetData.length > 0) {
          console.log(`📄 第一行数据示例:`, JSON.stringify(sheetData[0], null, 2));
        }
      } catch (error) {
        console.error(`❌ 加载工作表 "${worksheet.name}" 时出错:`, error);
        // 继续处理其他工作表
      }
    });
  }

  /**
   * 执行SQL查询
   */
  async executeQuery(sql: string): Promise<any[]> {
    try {
      // 解析SQL语句
      const ast = this.parser.astify(sql);
      
      // 验证SQL语法支持
      this.validateSqlSupport(ast);
      
      // 执行查询
      return this.executeSelect(ast);
      
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`SQL查询执行失败: ${error.message}`);
      }
      throw new Error(`SQL查询执行失败: ${error}`);
    }
  }

  /**
   * 验证SQL语法支持
   */
  private validateSqlSupport(ast: any): void {
    if (!ast || ast.type !== 'select') {
      throw new Error('不支持的SQL语法：仅支持SELECT查询');
    }

    if (ast.having) {
      throw new Error('不支持的SQL语法：不支持HAVING子句');
    }

    if (ast.with && ast.with.length > 0) {
      throw new Error('不支持的SQL语法：不支持WITH子句');
    }

    if (ast.union) {
      throw new Error('不支持的SQL语法：不支持UNION操作');
    }

    // 检查JOIN操作
    if (ast.from && ast.from.length > 1) {
      throw new Error('不支持的SQL语法：不支持多表JOIN操作');
    }

    // 检查子查询
    if (ast.from && ast.from[0] && ast.from[0].expr && ast.from[0].expr.type === 'select') {
      throw new Error('不支持的SQL语法：不支持子查询');
    }
  }

  /**
   * 执行SELECT查询
   */
  private executeSelect(ast: any): any[] {
    // 获取表名
    const tableName = ast.from[0].table;
    const sheetData = this.worksheetData.get(tableName);
    
    if (!sheetData) {
      throw new Error(`工作表 "${tableName}" 不存在`);
    }

    let result = [...sheetData];

    // 应用WHERE条件
    if (ast.where) {
      result = this.applyWhereCondition(result, ast.where);
    }

    // 应用GROUP BY
    if (ast.groupby && ast.groupby.length > 0) {
      result = this.applyGroupBy(result, ast.groupby, ast.columns);
    } else {
      // 应用ORDER BY
      if (ast.orderby && ast.orderby.length > 0) {
        result = this.applyOrderBy(result, ast.orderby);
      }

      // 应用SELECT字段选择
      result = this.applySelectFields(result, ast.columns);

      // 应用DISTINCT
      if (ast.distinct === 'DISTINCT') {
        result = this.applyDistinct(result);
      }
    }

    // 应用LIMIT
    if (ast.limit) {
      const limitValue = ast.limit.value[0].value;
      result = result.slice(0, limitValue);
    }

    return result;
  }

  /**
   * 应用WHERE条件过滤
   */
  private applyWhereCondition(data: any[], whereClause: any): any[] {
    return data.filter(row => this.evaluateCondition(row, whereClause));
  }

  /**
   * 评估条件表达式
   */
  private evaluateCondition(row: any, condition: any): boolean {
    if (!condition) return true;

    switch (condition.type) {
      case 'binary_expr':
        const left = this.getValueFromExpression(row, condition.left);
        const right = this.getValueFromExpression(row, condition.right);
        
        switch (condition.operator) {
          case '=': return left == right;
          case '>': return left > right;
          case '<': return left < right;
          case '>=': return left >= right;
          case '<=': return left <= right;
          case '!=': 
          case '<>': return left != right;
          case 'LIKE': 
            const pattern = right.toString().replace(/%/g, '.*');
            return new RegExp(pattern, 'i').test(left?.toString() || '');
          case 'AND':
            return this.evaluateCondition(row, condition.left) && this.evaluateCondition(row, condition.right);
          case 'OR':
            return this.evaluateCondition(row, condition.left) || this.evaluateCondition(row, condition.right);
          case 'IS':
            if (condition.right && condition.right.type === 'null') {
              return left === null || left === undefined;
            }
            return left === right;
          case 'IS NOT':
            if (condition.right && condition.right.type === 'null') {
              return left !== null && left !== undefined;
            }
            return left !== right;
          default:
            throw new Error(`不支持的操作符: ${condition.operator}`);
        }
      case 'unary_expr':
        if (condition.operator === 'NOT') {
          return !this.evaluateCondition(row, condition.expr);
        }
        throw new Error(`不支持的一元操作符: ${condition.operator}`);
      default:
        throw new Error(`不支持的条件类型: ${condition.type}`);
    }
  }

  /**
   * 从表达式获取值
   */
  private getValueFromExpression(row: any, expr: any): any {
    if (!expr) {
      return null;
    }
    
    if (expr.type === 'column_ref') {
      return row[expr.column];
    }
    
    if (expr.type === 'single_quote_string' || expr.type === 'string') {
      return expr.value;
    }
    
    if (expr.type === 'double_quote_string') {
      // 双引号字符串可能是列名或字符串值
      // 先检查是否是列名
      if (row.hasOwnProperty(expr.value)) {
        return row[expr.value];
      }
      // 否则作为字符串值
      return expr.value;
    }
    
    if (expr.type === 'number') {
      return expr.value;
    }
    
    if (expr.type === 'null') {
      return null;
    }
    
    if (expr.type === 'binary_expr') {
      // 处理二元表达式，如 IS NULL, IS NOT NULL 等
      return this.evaluateCondition(row, expr);
    }

    throw new Error(`不支持的表达式类型: ${expr.type}`);
  }

  /**
   * 应用GROUP BY分组
   */
  private applyGroupBy(data: any[], groupBy: any[], columns: any[]): any[] {
    // 获取分组字段
    const groupFields = groupBy.map(g => g.column);
    
    // 按分组字段进行分组
    const groups = new Map<string, any[]>();
    
    data.forEach(row => {
      const groupKey = groupFields.map(field => row[field]).join('|');
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(row);
    });
    
    // 对每个分组应用聚合函数
    const result: any[] = [];
    
    groups.forEach((groupData, groupKey) => {
      const groupResult: any = {};
      
      // 添加分组字段到结果
      const groupValues = groupKey.split('|');
      groupFields.forEach((field, index) => {
        groupResult[field] = groupValues[index];
      });
      
      // 处理SELECT列
      columns.forEach(col => {
        if (col.expr.type === 'aggr_func') {
          const funcName = col.expr.name.toLowerCase();
          const alias = col.as || `${funcName}(${col.expr.args?.type === 'star' ? '*' : col.expr.args?.expr?.column || ''})`;
          
          switch (funcName) {
            case 'count':
              if (col.expr.args?.type === 'star') {
                groupResult[alias] = groupData.length;
              } else if (col.expr.args?.expr?.column) {
                const field = col.expr.args.expr.column;
                groupResult[alias] = groupData.filter(row => 
                  row[field] !== null && row[field] !== undefined && row[field] !== ''
                ).length;
              } else {
                groupResult[alias] = groupData.length;
              }
              break;
            case 'sum':
              if (col.expr.args?.expr?.column) {
                const field = col.expr.args.expr.column;
                groupResult[alias] = groupData.reduce((sum, row) => {
                  const value = row[field];
                  if (value !== null && value !== undefined && !isNaN(Number(value))) {
                    return sum + Number(value);
                  }
                  return sum;
                }, 0);
              } else {
                throw new Error('SUM函数需要指定列名');
              }
              break;
            default:
              throw new Error(`不支持的聚合函数: ${funcName}`);
          }
        } else if (col.expr.type === 'column_ref') {
          // 非聚合列必须在GROUP BY中
          const columnName = col.expr.column;
          if (!groupFields.includes(columnName)) {
            throw new Error(`列 "${columnName}" 必须出现在GROUP BY子句中或者是聚合函数`);
          }
          groupResult[col.as || columnName] = groupData[0][columnName];
        }
      });
      
      result.push(groupResult);
    });
    
    return result;
  }

  /**
   * 应用ORDER BY排序
   */
  private applyOrderBy(data: any[], orderBy: any[]): any[] {
    return data.sort((a, b) => {
      for (const order of orderBy) {
        const field = order.expr.column;
        const direction = order.type === 'DESC' ? -1 : 1;
        
        const aVal = a[field];
        const bVal = b[field];
        
        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
      }
      return 0;
    });
  }

  /**
   * 应用字段选择
   */
  private applySelectFields(data: any[], columns: any[]): any[] {
    if (columns.length === 1 && columns[0].expr.column === '*') {
      return data;
    }

    // 检查是否有聚合函数
    if (columns.some(col => col.expr.type === 'aggr_func')) {
      return this.applyAggregateFunction(data, columns);
    }

    return data.map(row => {
      const newRow: any = {};
      columns.forEach(col => {
        if (col.expr.type === 'column_ref') {
          // 处理普通列引用
          const fieldName = col.expr.column;
          const alias = col.as || fieldName;
          newRow[alias] = row[fieldName];
        } else if (col.expr.type === 'double_quote_string') {
          // 处理双引号字符串类型的字段名
          const fieldName = col.expr.value;
          const alias = col.as || fieldName;
          newRow[alias] = row[fieldName];
        }
      });
      return newRow;
    });
  }

  /**
   * 应用聚合函数
   */
  private applyAggregateFunction(data: any[], columns: any[]): any[] {
    const result: any = {};
    
    columns.forEach(col => {
      if (col.expr.type === 'aggr_func') {
        const funcName = col.expr.name.toLowerCase();
        const alias = col.as || `${funcName}(${col.expr.args?.type === 'star' ? '*' : col.expr.args?.expr?.column || ''})`;
        
        switch (funcName) {
          case 'count':
            if (col.expr.args?.type === 'star') {
              result[alias] = data.length;
            } else if (col.expr.args?.expr?.column) {
              const field = col.expr.args.expr.column;
              result[alias] = data.filter(row => 
                row[field] !== null && row[field] !== undefined && row[field] !== ''
              ).length;
            } else {
              result[alias] = data.length;
            }
            break;
          case 'sum':
            if (col.expr.args?.expr?.column) {
              const field = col.expr.args.expr.column;
              result[alias] = data.reduce((sum, row) => {
                const value = row[field];
                if (value !== null && value !== undefined && !isNaN(Number(value))) {
                  return sum + Number(value);
                }
                return sum;
              }, 0);
            } else {
              throw new Error('SUM函数需要指定列名');
            }
            break;
          case 'distinct':
            // DISTINCT作为函数处理
            if (col.expr.args && col.expr.args.expr && col.expr.args.expr.column) {
              const field = col.expr.args.expr.column;
              const distinctValues = [...new Set(data.map(row => row[field]))];
              return distinctValues.map(value => ({ [field]: value }));
            }
            break;
          default:
            throw new Error(`不支持的聚合函数: ${funcName}`);
        }
      }
    });
    
    return [result];
  }

  /**
   * 应用DISTINCT去重
   */
  private applyDistinct(data: any[]): any[] {
    const seen = new Set();
    return data.filter(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * 获取工作表列表
   */
  getWorksheetNames(): string[] {
    return Array.from(this.worksheetData.keys());
  }

  /**
   * 获取指定工作表的列名
   */
  getColumnNames(sheetName: string): string[] {
    const data = this.worksheetData.get(sheetName);
    if (!data || data.length === 0) {
      return [];
    }
    return Object.keys(data[0]);
  }

  /**
   * 获取指定工作表的行数
   */
  getRowCount(sheetName: string): number {
    const data = this.worksheetData.get(sheetName);
    return data ? data.length : 0;
  }
}