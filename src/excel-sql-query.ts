import ExcelJS from 'exceljs';
import { Parser } from 'node-sql-parser';
import * as path from 'path';

/**
 * Excel SQL Query Tool Class
 * Supports simple SQL query operations on Excel files
 */
export class ExcelSqlQuery {
  private parser: any;

  constructor() {
    this.parser = new Parser();
  }

  /**
   * Preload worksheet data
   */
  private async preloadWorksheetData(workbook: ExcelJS.Workbook, filePath: string): Promise<Map<string, any[]>> {
    const worksheetData: Map<string, any[]> = new Map();
    const fs = require('fs');
    const stats = fs.statSync(filePath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    
    workbook.eachSheet((worksheet: any) => {
      const sheetData: any[] = [];
      const headers: string[] = [];
      
      try {
        // Get headers
        const headerRow = worksheet.getRow(1);
        const maxCols = headerRow.cellCount;
        
        for (let colNumber = 1; colNumber <= maxCols; colNumber++) {
          const cell = headerRow.getCell(colNumber);
          headers[colNumber - 1] = cell.value?.toString() || `Column${colNumber}`;
        }

        let maxRows: number;
        
        // For large files (>5MB), use sampling algorithm to estimate row count
        if (fileSizeInMB > 5) {
          maxRows = this.estimateRowCount(worksheet);
          console.log(`📊 Large file detected (${fileSizeInMB.toFixed(2)}MB), estimated rows by sampling: ${maxRows}`);
        } else {
          // Limit loaded rows to avoid memory overflow
          maxRows = Math.min(worksheet.rowCount, 10000); // Load maximum 10000 rows
        }

        // Get data rows
        for (let rowNumber = 2; rowNumber <= maxRows; rowNumber++) {
          const row = worksheet.getRow(rowNumber);
          const rowData: any = {};
          let hasData = false;
          
          // Iterate through all columns
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
          
          // Only add non-empty rows
          if (hasData) {
            sheetData.push(rowData);
          }
        }

        worksheetData.set(worksheet.name, sheetData);
        console.log(`📊 Worksheet "${worksheet.name}" data loaded successfully, total ${sheetData.length} rows (max ${maxRows} rows)`);
        console.log(`📋 Header info:`, headers);
        if (sheetData.length > 0) {
          console.log(`📄 First row data example:`, JSON.stringify(sheetData[0], null, 2));
        }
      } catch (error) {
        console.error(`❌ Error loading worksheet "${worksheet.name}":`, error);
        // Continue processing other worksheets
      }
    });
    
    return worksheetData;
  }

  /**
   * Sampling algorithm to estimate row count (for large files)
   */
  private estimateRowCount(worksheet: any): number {
    let currentRow = 2; // Start from row 2 (row 1 is header)
    let lastDataRow = 2;
    const jumpSize = 100;
    
    while (currentRow <= worksheet.rowCount) {
      const row = worksheet.getRow(currentRow);
      let hasData = false;
      
      // Check if current row has data
      for (let colNumber = 1; colNumber <= row.cellCount; colNumber++) {
        const cell = row.getCell(colNumber);
        if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
          hasData = true;
          break;
        }
      }
      
      if (hasData) {
        lastDataRow = currentRow;
        currentRow += jumpSize;
      } else {
        // No data, consider as termination
        break;
      }
    }
    
    return lastDataRow;
  }

  /**
   * Execute SQL query
   */
  async executeQuery(sql: string, filePath: string): Promise<any[]> {
    try {
      // Load Excel file
      const workbook = new ExcelJS.Workbook();
      const stream = require('fs').createReadStream(filePath);
      await workbook.xlsx.read(stream);
      
      // Preload all worksheet data into memory
      const worksheetData = await this.preloadWorksheetData(workbook, filePath);
      
      console.log(`✅ Excel file loaded successfully: ${path.basename(filePath)}`);
      
      // Parse SQL statement
      const ast = this.parser.astify(sql);
      
      // Validate SQL syntax support
      this.validateSqlSupport(ast);
      
      // Execute query
      return this.executeSelect(ast, worksheetData);
      
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`SQL query execution failed: ${error.message}`);
      }
      throw new Error(`SQL query execution failed: ${error}`);
    }
  }

  /**
   * Get worksheet information
   */
  async getWorksheetInfo(filePath: string): Promise<Array<{table_name: string, row_count: number}>> {
    try {
      // Load Excel file
      const workbook = new ExcelJS.Workbook();
      const stream = require('fs').createReadStream(filePath);
      await workbook.xlsx.read(stream);
      
      // Preload all worksheet data into memory
      const worksheetData = await this.preloadWorksheetData(workbook, filePath);
      
      console.log(`✅ Excel file loaded successfully: ${path.basename(filePath)}`);
      
      const tables: Array<{table_name: string, row_count: number}> = [];
      
      for (const [sheetName, data] of worksheetData) {
        tables.push({
          table_name: sheetName,
          row_count: data.length
        });
      }
      
      return tables;
      
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get worksheet information: ${error.message}`);
      }
      throw new Error(`Failed to get worksheet information: ${error}`);
    }
  }

  /**
   * Validate SQL syntax support
   */
  private validateSqlSupport(ast: any): void {
    if (!ast || ast.type !== 'select') {
      throw new Error('Unsupported SQL syntax: Only SELECT queries are supported');
    }

    if (ast.having) {
      throw new Error('Unsupported SQL syntax: HAVING clause is not supported');
    }

    if (ast.with && ast.with.length > 0) {
      throw new Error('Unsupported SQL syntax: WITH clause is not supported');
    }

    if (ast.union) {
      throw new Error('Unsupported SQL syntax: UNION operations are not supported');
    }

    // Check JOIN operations
    if (ast.from && ast.from.length > 1) {
      throw new Error('Unsupported SQL syntax: Multi-table JOIN operations are not supported');
    }

    // Check subqueries
    if (JSON.stringify(ast).includes('"type":"select"') && JSON.stringify(ast).match(/"type":"select"/g)!.length > 1) {
      throw new Error('Unsupported SQL syntax: Subqueries are not supported');
    }
  }

  /**
   * Execute SELECT query
   */
  private executeSelect(ast: any, worksheetData: Map<string, any[]>): any[] {
    // Get table name
    const tableName = ast.from[0].table;
    const sheetData = worksheetData.get(tableName);
    
    if (!sheetData) {
      throw new Error(`Worksheet "${tableName}" does not exist`);
    }

    let result = [...sheetData];

    // Apply WHERE conditions
    if (ast.where) {
      result = this.applyWhereCondition(result, ast.where);
    }

    // Apply GROUP BY
    if (ast.groupby && ast.groupby.length > 0) {
      result = this.applyGroupBy(result, ast.groupby, ast.columns);
    } else {
      // Apply ORDER BY
      if (ast.orderby && ast.orderby.length > 0) {
        result = this.applyOrderBy(result, ast.orderby);
      }

      // Apply SELECT field selection
      result = this.applySelectFields(result, ast.columns);

      // Apply DISTINCT
      if (ast.distinct === 'DISTINCT') {
        result = this.applyDistinct(result);
      }

      // Apply aggregate functions
      result = this.applyAggregateFunction(result, ast.columns);
    }

    return result;
  }

  /**
   * Apply WHERE conditions
   */
  private applyWhereCondition(data: any[], whereClause: any): any[] {
    return data.filter(row => this.evaluateCondition(row, whereClause));
  }

  /**
   * Evaluate condition expression
   */
  private evaluateCondition(row: any, condition: any): boolean {
    if (!condition) return true;

    switch (condition.type) {
      case 'binary_expr':
        const left = this.getValueFromExpression(row, condition.left);
        const right = this.getValueFromExpression(row, condition.right);
        
        switch (condition.operator) {
          case '=': return left == right;
          case '!=': return left != right;
          case '<>': return left != right;
          case '>': return left > right;
          case '>=': return left >= right;
          case '<': return left < right;
          case '<=': return left <= right;
          case 'LIKE': 
            const pattern = right.toString().replace(/%/g, '.*').replace(/_/g, '.');
            return new RegExp(pattern, 'i').test(left.toString());
          case 'AND': 
            return this.evaluateCondition(row, condition.left) && this.evaluateCondition(row, condition.right);
          case 'OR': 
            return this.evaluateCondition(row, condition.left) || this.evaluateCondition(row, condition.right);
          default:
            throw new Error(`Unsupported operator: ${condition.operator}`);
        }
      
      case 'unary_expr':
        if (condition.operator === 'NOT') {
          return !this.evaluateCondition(row, condition.expr);
        }
        throw new Error(`Unsupported unary operator: ${condition.operator}`);
      
      default:
        throw new Error(`Unsupported condition type: ${condition.type}`);
    }
  }

  /**
   * Get value from expression
   */
  private getValueFromExpression(row: any, expr: any): any {
    if (!expr) return null;

    switch (expr.type) {
      case 'column_ref':
        return row[expr.column];
      case 'number':
        return expr.value;
      case 'string':
        return expr.value;
      case 'single_quote_string':
        return expr.value;
      case 'null':
        return null;
      case 'bool':
        return expr.value;
      case 'binary_expr':
        const left = this.getValueFromExpression(row, expr.left);
        const right = this.getValueFromExpression(row, expr.right);
        
        switch (expr.operator) {
          case '+': return Number(left) + Number(right);
          case '-': return Number(left) - Number(right);
          case '*': return Number(left) * Number(right);
          case '/': return Number(left) / Number(right);
          case '%': return Number(left) % Number(right);
          default:
            throw new Error(`Unsupported arithmetic operator: ${expr.operator}`);
        }
      default:
        throw new Error(`Unsupported expression type: ${expr.type}`);
    }
  }

  /**
   * Apply GROUP BY
   */
  private applyGroupBy(data: any[], groupBy: any[], columns: any[]): any[] {
    // Group by grouping fields
    const groups = new Map<string, any[]>();
    
    for (const row of data) {
      const groupKey = groupBy.map(gb => row[gb.column]).join('|');
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(row);
    }

    // Apply aggregate functions to each group
    const result: any[] = [];
    for (const [groupKey, groupRows] of groups) {
      const groupResult: any = {};
      
      // Add grouping fields
      groupBy.forEach((gb, index) => {
        groupResult[gb.column] = groupKey.split('|')[index];
      });

      // Process aggregate functions
      for (const col of columns) {
        if (col.expr && col.expr.type === 'aggr_func') {
          const funcName = col.expr.name.toUpperCase();
          const columnName = col.expr.args?.value?.[0]?.column || col.expr.args?.value?.[0]?.value;
          
          switch (funcName) {
            case 'COUNT':
              if (columnName === '*') {
                groupResult[col.as || `COUNT(*)`] = groupRows.length;
              } else {
                const nonNullCount = groupRows.filter(row => 
                  row[columnName] !== null && row[columnName] !== undefined && row[columnName] !== ''
                ).length;
                groupResult[col.as || `COUNT(${columnName})`] = nonNullCount;
              }
              break;
              
            case 'SUM':
              if (!columnName) {
                throw new Error('SUM function requires column name specification');
              }
              const sumValues = groupRows
                .map(row => row[columnName])
                .filter(val => val !== null && val !== undefined && val !== '' && !isNaN(Number(val)))
                .map(val => Number(val));
              groupResult[col.as || `SUM(${columnName})`] = sumValues.reduce((sum, val) => sum + val, 0);
              break;

            case 'MAX':
              if (!columnName) {
                throw new Error('MAX function requires column name specification');
              }
              const maxValues = groupRows
                .map(row => row[columnName])
                .filter(val => val !== null && val !== undefined && val !== '' && !isNaN(Number(val)))
                .map(val => Number(val));
              if (maxValues.length === 0) {
                groupResult[col.as || `MAX(${columnName})`] = null;
              } else {
                groupResult[col.as || `MAX(${columnName})`] = Math.max(...maxValues);
              }
              break;

            case 'MIN':
              if (!columnName) {
                throw new Error('MIN function requires column name specification');
              }
              const minValues = groupRows
                .map(row => row[columnName])
                .filter(val => val !== null && val !== undefined && val !== '' && !isNaN(Number(val)))
                .map(val => Number(val));
              if (minValues.length === 0) {
                groupResult[col.as || `MIN(${columnName})`] = null;
              } else {
                groupResult[col.as || `MIN(${columnName})`] = Math.min(...minValues);
              }
              break;

            case 'AVG':
              if (!columnName) {
                throw new Error('AVG function requires column name specification');
              }
              const avgValues = groupRows
                .map(row => row[columnName])
                .filter(val => val !== null && val !== undefined && val !== '' && !isNaN(Number(val)))
                .map(val => Number(val));
              if (avgValues.length === 0) {
                groupResult[col.as || `AVG(${columnName})`] = null;
              } else {
                const sum = avgValues.reduce((sum, val) => sum + val, 0);
                groupResult[col.as || `AVG(${columnName})`] = sum / avgValues.length;
              }
              break;
              
            default:
              throw new Error(`Unsupported aggregate function: ${funcName}`);
          }
        } else if (col.expr && col.expr.type === 'column_ref') {
          // Non-aggregate columns, take value from first row
          groupResult[col.as || col.expr.column] = groupRows[0][col.expr.column];
        }
      }
      
      result.push(groupResult);
    }

    return result;
  }

  /**
   * Apply ORDER BY
   */
  private applyOrderBy(data: any[], orderBy: any[]): any[] {
    return data.sort((a, b) => {
      for (const order of orderBy) {
        const columnName = order.expr.column;
        const aVal = a[columnName];
        const bVal = b[columnName];
        
        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        else if (aVal > bVal) comparison = 1;
        
        if (comparison !== 0) {
          return order.type === 'DESC' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }

  /**
   * Apply SELECT field selection
   */
  private applySelectFields(data: any[], columns: any[]): any[] {
    if (columns.length === 1 && columns[0].expr.type === 'column_ref' && columns[0].expr.column === '*') {
      return data;
    }

    return data.map(row => {
      const newRow: any = {};
      for (const col of columns) {
        if (col.expr.type === 'column_ref') {
          const columnName = col.expr.column;
          const alias = col.as || columnName;
          newRow[alias] = row[columnName];
        } else if (col.expr.type === 'number' || col.expr.type === 'string') {
          const alias = col.as || col.expr.value;
          newRow[alias] = col.expr.value;
        }
      }
      return newRow;
    });
  }

  /**
   * Apply aggregate functions (non-GROUP BY case)
   */
  private applyAggregateFunction(data: any[], columns: any[]): any[] {
    const hasAggregateFunction = columns.some(col => col.expr && col.expr.type === 'aggr_func');
    
    if (!hasAggregateFunction) {
      return data;
    }

    const result: any = {};
    
    for (const col of columns) {
      if (col.expr && col.expr.type === 'aggr_func') {
        const funcName = col.expr.name.toUpperCase();
        const columnName = col.expr.args?.value?.[0]?.column || col.expr.args?.value?.[0]?.value;
        
        switch (funcName) {
          case 'COUNT':
            if (columnName === '*') {
              result[col.as || 'COUNT(*)'] = data.length;
            } else {
              const nonNullCount = data.filter(row => 
                row[columnName] !== null && row[columnName] !== undefined && row[columnName] !== ''
              ).length;
              result[col.as || `COUNT(${columnName})`] = nonNullCount;
            }
            break;
            
          case 'SUM':
            if (!columnName) {
              throw new Error('SUM function requires column name specification');
            }
            const sumValues = data
              .map(row => row[columnName])
              .filter(val => val !== null && val !== undefined && val !== '' && !isNaN(Number(val)))
              .map(val => Number(val));
            result[col.as || `SUM(${columnName})`] = sumValues.reduce((sum, val) => sum + val, 0);
            break;

          case 'MAX':
            if (!columnName) {
              throw new Error('MAX function requires column name specification');
            }
            const maxValues = data
              .map(row => row[columnName])
              .filter(val => val !== null && val !== undefined && val !== '' && !isNaN(Number(val)))
              .map(val => Number(val));
            if (maxValues.length === 0) {
              result[col.as || `MAX(${columnName})`] = null;
            } else {
              result[col.as || `MAX(${columnName})`] = Math.max(...maxValues);
            }
            break;

          case 'MIN':
            if (!columnName) {
              throw new Error('MIN function requires column name specification');
            }
            const minValues = data
              .map(row => row[columnName])
              .filter(val => val !== null && val !== undefined && val !== '' && !isNaN(Number(val)))
              .map(val => Number(val));
            if (minValues.length === 0) {
              result[col.as || `MIN(${columnName})`] = null;
            } else {
              result[col.as || `MIN(${columnName})`] = Math.min(...minValues);
            }
            break;

          case 'AVG':
            if (!columnName) {
              throw new Error('AVG function requires column name specification');
            }
            const avgValues = data
              .map(row => row[columnName])
              .filter(val => val !== null && val !== undefined && val !== '' && !isNaN(Number(val)))
              .map(val => Number(val));
            if (avgValues.length === 0) {
              result[col.as || `AVG(${columnName})`] = null;
            } else {
              const sum = avgValues.reduce((sum, val) => sum + val, 0);
              result[col.as || `AVG(${columnName})`] = sum / avgValues.length;
            }
            break;
            
          case 'DISTINCT':
            if (!columnName) {
              throw new Error('DISTINCT requires column name specification');
            }
            const distinctValues = [...new Set(data.map(row => row[columnName]))];
            result[col.as || `DISTINCT(${columnName})`] = distinctValues;
            break;
            
          default:
            throw new Error(`Unsupported aggregate function: ${funcName}`);
        }
      }
    }
    
    return [result];
  }

  /**
   * Apply DISTINCT
   */
  private applyDistinct(data: any[]): any[] {
    const seen = new Set<string>();
    return data.filter(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}