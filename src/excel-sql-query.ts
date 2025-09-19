import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import pkg from 'node-sql-parser';
const { Parser: NodeSqlParser } = pkg;

/**
 * Excel SQL Query Tool Class
 * Supports simple SQL query operations on Excel files
 */
export class ExcelSqlQuery {
  private parser: any;

  constructor() {
    this.parser = new NodeSqlParser();
  }

  /**
   * Preload worksheet data
   */
  private async preloadWorksheetData(workbook: ExcelJS.Workbook, filePath: string): Promise<Map<string, any[]>> {
    const worksheetData: Map<string, any[]> = new Map();
    // fs is already imported at the top
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
      const stream = fs.createReadStream(filePath);
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
   * Get worksheet information (lightweight version - only returns worksheet names)
   * For row count information, use SQL query: SELECT COUNT(*) FROM SheetName
   */
  async getWorksheetInfo(filePath: string): Promise<Array<{table_name: string}>> {
    try {
      // Load Excel file
      const workbook = new ExcelJS.Workbook();
      const stream = fs.createReadStream(filePath);
      await workbook.xlsx.read(stream);
      
      console.log(`✅ Excel file loaded successfully: ${path.basename(filePath)}`);
      
      const tables: Array<{table_name: string}> = [];
      
      // Only get worksheet names without loading data
      workbook.eachSheet((worksheet: any) => {
        tables.push({
          table_name: worksheet.name
        });
      });
      
      return tables;
      
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get worksheet information: ${error.message}`);
      }
      throw new Error(`Failed to get worksheet information: ${error}`);
    }
  }

  /**
   * Get worksheet columns information (lightweight version - only reads first row)
   */
  async getWorksheetColumns(filePath: string, worksheetName?: string): Promise<Array<{table_name: string, columns: string[]}>> {
    try {
      // Load Excel file
      const workbook = new ExcelJS.Workbook();
      const stream = fs.createReadStream(filePath);
      await workbook.xlsx.read(stream);
      
      console.log(`✅ Excel file loaded successfully: ${path.basename(filePath)}`);
      
      const result: Array<{table_name: string, columns: string[]}> = [];
      
      // If specific worksheet is requested
      if (worksheetName) {
        const worksheet = workbook.getWorksheet(worksheetName);
        if (!worksheet) {
          throw new Error(`Worksheet "${worksheetName}" does not exist`);
        }
        
        const columns = this.extractColumnsFromWorksheet(worksheet);
        result.push({
          table_name: worksheetName,
          columns: columns
        });
      } else {
        // Get columns for all worksheets
        workbook.eachSheet((worksheet: any) => {
          const columns = this.extractColumnsFromWorksheet(worksheet);
          result.push({
            table_name: worksheet.name,
            columns: columns
          });
        });
      }
      
      return result;
      
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get worksheet columns: ${error.message}`);
      }
      throw new Error(`Failed to get worksheet columns: ${error}`);
    }
  }

  /**
   * Extract column names from worksheet (only reads first row)
   */
  private extractColumnsFromWorksheet(worksheet: any): string[] {
    const columns: string[] = [];
    
    try {
      // Get headers from first row only
      const headerRow = worksheet.getRow(1);
      const maxCols = headerRow.cellCount;
      
      for (let colNumber = 1; colNumber <= maxCols; colNumber++) {
        const cell = headerRow.getCell(colNumber);
        const columnName = cell.value?.toString() || `Column${colNumber}`;
        columns.push(columnName);
      }
      
      console.log(`📋 Worksheet "${worksheet.name}" columns:`, columns);
    } catch (error) {
      console.error(`❌ Error extracting columns from worksheet "${worksheet.name}":`, error);
    }
    
    return columns;
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

    // JOIN operations are now supported

    // Check subqueries
    if (JSON.stringify(ast).includes('"type":"select"') && JSON.stringify(ast).match(/"type":"select"/g)!.length > 1) {
      throw new Error('Unsupported SQL syntax: Subqueries are not supported');
    }
  }

  /**
   * Execute SELECT query
   */
  private executeSelect(ast: any, worksheetData: Map<string, any[]>): any[] {
    // Handle JOIN operations or single table
    let result: any[];
    let tableAliasMap: Map<string, string>;
    
    if (ast.from.length === 1 && !ast.from[0].join) {
      // Single table query
      const fromClause = ast.from[0];
      const tableName = fromClause.table;
      const tableAlias = fromClause.as || tableName;
      const sheetData = worksheetData.get(tableName);
      
      if (!sheetData) {
        throw new Error(`Worksheet "${tableName}" does not exist`);
      }

      result = [...sheetData];
      
      // Create table alias mapping for column resolution
      tableAliasMap = new Map<string, string>();
      tableAliasMap.set(tableAlias, tableName);
    } else {
      // JOIN operations
      const joinResult = this.executeJoin(ast.from, worksheetData);
      result = joinResult.data;
      tableAliasMap = joinResult.tableAliasMap;
    }

    // Apply WHERE conditions
    if (ast.where) {
      result = this.applyWhereCondition(result, ast.where, tableAliasMap);
    }

    // Apply GROUP BY
    if (ast.groupby && ast.groupby.length > 0) {
      result = this.applyGroupBy(result, ast.groupby, ast.columns, tableAliasMap);
    } else {
      // Apply ORDER BY
      if (ast.orderby && ast.orderby.length > 0) {
        result = this.applyOrderBy(result, ast.orderby, tableAliasMap);
      }

      // Apply SELECT field selection
      result = this.applySelectFields(result, ast.columns, tableAliasMap);

      // Apply DISTINCT
      if (ast.distinct === 'DISTINCT') {
        result = this.applyDistinct(result);
      }

      // Apply aggregate functions
      result = this.applyAggregateFunction(result, ast.columns, tableAliasMap);
    }

    return result;
  }

  /**
   * Execute JOIN operations
   */
  private executeJoin(fromClauses: any[], worksheetData: Map<string, any[]>): { data: any[], tableAliasMap: Map<string, string> } {
    const tableAliasMap = new Map<string, string>();
    let result: any[] = [];
    
    // Start with the first table
    const firstTable = fromClauses[0];
    const firstTableName = firstTable.table;
    const firstTableAlias = firstTable.as || firstTableName;
    const firstTableData = worksheetData.get(firstTableName);
    
    if (!firstTableData) {
      throw new Error(`Worksheet "${firstTableName}" does not exist`);
    }
    
    tableAliasMap.set(firstTableAlias, firstTableName);
    
    // Add table prefix to all columns in the first table
    result = firstTableData.map(row => {
      const prefixedRow: any = {};
      for (const [key, value] of Object.entries(row)) {
        prefixedRow[`${firstTableAlias}.${key}`] = value;
        // Also keep original column name for backward compatibility
        prefixedRow[key] = value;
      }
      return prefixedRow;
    });
    
    // Process JOIN operations
    if (firstTable.join) {
      for (const joinClause of firstTable.join) {
        const rightTableName = joinClause.table;
        const rightTableAlias = joinClause.as || rightTableName;
        const rightTableData = worksheetData.get(rightTableName);
        
        if (!rightTableData) {
          throw new Error(`Worksheet "${rightTableName}" does not exist`);
        }
        
        tableAliasMap.set(rightTableAlias, rightTableName);
        
        // Perform the join
        result = this.performJoin(result, rightTableData, joinClause, firstTableAlias, rightTableAlias, tableAliasMap);
      }
    }
    
    return { data: result, tableAliasMap };
  }

  /**
   * Perform specific JOIN operation
   */
  private performJoin(
    leftData: any[], 
    rightData: any[], 
    joinClause: any, 
    leftAlias: string, 
    rightAlias: string,
    tableAliasMap: Map<string, string>
  ): any[] {
    const result: any[] = [];
    const joinType = joinClause.join?.toUpperCase() || 'INNER';
    
    for (const leftRow of leftData) {
      let hasMatch = false;
      
      for (const rightRow of rightData) {
        // Add table prefix to right table columns
        const prefixedRightRow: any = {};
        for (const [key, value] of Object.entries(rightRow)) {
          prefixedRightRow[`${rightAlias}.${key}`] = value;
          // Also keep original column name for backward compatibility
          prefixedRightRow[key] = value;
        }
        
        // Evaluate JOIN condition
        const combinedRow = { ...leftRow, ...prefixedRightRow };
        
        if (this.evaluateCondition(combinedRow, joinClause.on, tableAliasMap)) {
          result.push(combinedRow);
          hasMatch = true;
        }
      }
      
      // For LEFT JOIN, include unmatched left rows with null values for right table
      if (!hasMatch && joinType === 'LEFT') {
        const nullRightRow: any = {};
        // Add null values for all right table columns
        if (rightData.length > 0) {
          for (const key of Object.keys(rightData[0])) {
            nullRightRow[`${rightAlias}.${key}`] = null;
            nullRightRow[key] = null;
          }
        }
        result.push({ ...leftRow, ...nullRightRow });
      }
    }
    
    return result;
  }

  /**
   * Apply WHERE conditions
   */
  private applyWhereCondition(data: any[], whereClause: any, tableAliasMap?: Map<string, string>): any[] {
    return data.filter(row => this.evaluateCondition(row, whereClause, tableAliasMap));
  }

  /**
   * Evaluate condition expression
   */
  private evaluateCondition(row: any, condition: any, tableAliasMap?: Map<string, string>): boolean {
    if (!condition) return true;

    switch (condition.type) {
      case 'binary_expr':
        const left = this.getValueFromExpression(row, condition.left, tableAliasMap);
        const right = this.getValueFromExpression(row, condition.right, tableAliasMap);
        
        switch (condition.operator) {
          case '=': return left == right;
          case '!=': return left != right;
          case '<>': return left != right;
          case '>': return left > right;
          case '>=': return left >= right;
          case '<': return left < right;
          case '<=': return left <= right;
          case 'IS': return left === right;
          case 'IS NOT': return left !== right;
          case 'LIKE': 
            const pattern = right.toString().replace(/%/g, '.*').replace(/_/g, '.');
            return new RegExp(pattern, 'i').test(left.toString());
          case 'AND': 
            return this.evaluateCondition(row, condition.left, tableAliasMap) && this.evaluateCondition(row, condition.right, tableAliasMap);
          case 'OR': 
            return this.evaluateCondition(row, condition.left, tableAliasMap) || this.evaluateCondition(row, condition.right, tableAliasMap);
          case 'IN':
            // Handle IN operator: column IN (value1, value2, ...)
            if (!condition.right || condition.right.type !== 'expr_list') {
              throw new Error('IN operator requires a list of values');
            }
            const inValues = condition.right.value.map((expr: any) => this.getValueFromExpression(row, expr, tableAliasMap));
            return inValues.includes(left);
          case 'NOT IN':
            // Handle NOT IN operator: column NOT IN (value1, value2, ...)
            if (!condition.right || condition.right.type !== 'expr_list') {
              throw new Error('NOT IN operator requires a list of values');
            }
            const notInValues = condition.right.value.map((expr: any) => this.getValueFromExpression(row, expr, tableAliasMap));
            return !notInValues.includes(left);
          default:
            throw new Error(`Unsupported operator: ${condition.operator}`);
        }
      
      case 'unary_expr':
        if (condition.operator === 'NOT') {
          return !this.evaluateCondition(row, condition.expr);
        }
        throw new Error(`Unsupported unary operator: ${condition.operator}`);
      
      case 'function':
        // Handle function calls in conditions (e.g., LENGTH(column) > 0)
        return this.evaluateFunction(row, condition, tableAliasMap);
      
      default:
        throw new Error(`Unsupported condition type: ${condition.type}`);
    }
  }

  /**
   * Evaluate function calls
   */
  private evaluateFunction(row: any, expr: any, tableAliasMap?: Map<string, string>): any {
    // Extract function name from the complex structure
    let funcName = '';
    if (expr.name && expr.name.name && Array.isArray(expr.name.name) && expr.name.name.length > 0) {
      funcName = expr.name.name[0].value.toUpperCase();
    } else if (typeof expr.name === 'string') {
      funcName = expr.name.toUpperCase();
    } else {
      throw new Error(`Invalid function name structure: ${JSON.stringify(expr.name)}`);
    }
    
    // Note: Aggregate functions are handled separately in SELECT processing
    // This function handles scalar functions only
    
    // Handle both old and new AST structures
    const args = expr.args?.value || (expr.args?.expr ? [expr.args.expr] : []);
    
    // Get argument values
    const argValues = args.map((arg: any) => this.getValueFromExpression(row, arg, tableAliasMap));
    
    switch (funcName) {
      // String functions
      case 'LENGTH':
        if (argValues.length !== 1) throw new Error('LENGTH function requires exactly 1 argument');
        return String(argValues[0] || '').length;
        
      case 'LOWER':
        if (argValues.length !== 1) throw new Error('LOWER function requires exactly 1 argument');
        return String(argValues[0] || '').toLowerCase();
        
      case 'UPPER':
        if (args.length !== 1) throw new Error('UPPER function requires exactly 1 argument');
        const upperValue = this.getValueFromExpression(row, args[0], tableAliasMap);
        return String(upperValue).toUpperCase();
      
      case 'TRIM':
        if (args.length !== 1) throw new Error('TRIM function requires exactly 1 argument');
        const trimValue = this.getValueFromExpression(row, args[0], tableAliasMap);
        return String(trimValue).trim();
      
      case 'LTRIM':
        if (args.length !== 1) throw new Error('LTRIM function requires exactly 1 argument');
        const ltrimValue = this.getValueFromExpression(row, args[0], tableAliasMap);
        return String(ltrimValue).replace(/^\s+/, '');
      
      case 'RTRIM':
        if (args.length !== 1) throw new Error('RTRIM function requires exactly 1 argument');
        const rtrimValue = this.getValueFromExpression(row, args[0], tableAliasMap);
        return String(rtrimValue).replace(/\s+$/, '');
      
      case 'SUBSTR':
      case 'SUBSTRING':
        if (args.length < 2 || args.length > 3) throw new Error('SUBSTR function requires 2 or 3 arguments');
        const substrStr = String(this.getValueFromExpression(row, args[0], tableAliasMap));
        const startPos = Number(this.getValueFromExpression(row, args[1], tableAliasMap)) - 1; // Convert to 0-based index
        if (args.length === 3) {
          const length = Number(this.getValueFromExpression(row, args[2], tableAliasMap));
          return substrStr.substr(Math.max(0, startPos), length);
        } else {
          return substrStr.substr(Math.max(0, startPos));
        }
      
      case 'INSTR':
        if (args.length !== 2) throw new Error('INSTR function requires exactly 2 arguments');
        const instrStr = String(this.getValueFromExpression(row, args[0], tableAliasMap));
        const searchStr = String(this.getValueFromExpression(row, args[1], tableAliasMap));
        const pos = instrStr.indexOf(searchStr);
        return pos === -1 ? 0 : pos + 1; // Return 1-based index, 0 if not found
      
      case 'REPLACE':
        if (args.length !== 3) throw new Error('REPLACE function requires exactly 3 arguments');
        const replaceStr = String(this.getValueFromExpression(row, args[0], tableAliasMap));
        const fromStr = String(this.getValueFromExpression(row, args[1], tableAliasMap));
        const toStr = String(this.getValueFromExpression(row, args[2], tableAliasMap));
        return replaceStr.replace(new RegExp(fromStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), toStr);
        
      // Math functions
      case 'ABS':
        if (argValues.length !== 1) throw new Error('ABS function requires exactly 1 argument');
        return Math.abs(Number(argValues[0]));
        
      case 'ROUND':
        if (argValues.length < 1 || argValues.length > 2) {
          throw new Error('ROUND function requires 1 or 2 arguments');
        }
        const num = Number(argValues[0]);
        const digits = argValues.length === 2 ? Number(argValues[1]) : 0;
        return Math.round(num * Math.pow(10, digits)) / Math.pow(10, digits);
        
      case 'CEIL':
      case 'CEILING':
        if (argValues.length !== 1) throw new Error('CEIL function requires exactly 1 argument');
        return Math.ceil(Number(argValues[0]));
        
      case 'FLOOR':
        if (argValues.length !== 1) throw new Error('FLOOR function requires exactly 1 argument');
        return Math.floor(Number(argValues[0]));
        
      case 'RANDOM':
        if (argValues.length !== 0) throw new Error('RANDOM function requires no arguments');
        // Return random integer in SQLite range
        const min = -9223372036854775808;
        const max = 9223372036854775807;
        return Math.floor(Math.random() * (max - min + 1)) + min;
        
      // Aggregate functions - these should normally be handled at query level
      // but we provide basic support for single-row contexts
      case 'COUNT':
        if (args.length === 0 || (args.length === 1 && args[0].type === 'star')) {
          return 1; // COUNT(*) for single row
        } else {
          const value = this.getValueFromExpression(row, args[0], tableAliasMap);
          return (value !== null && value !== undefined && value !== '') ? 1 : 0;
        }
        
      case 'SUM':
      case 'MAX':
      case 'MIN':
      case 'AVG':
        if (argValues.length !== 1) throw new Error(`${funcName} function requires exactly 1 argument`);
        return Number(argValues[0]) || 0;
        
      // Logical functions
      case 'NOT':
        if (argValues.length !== 1) throw new Error('NOT function requires exactly 1 argument');
        return !argValues[0];
        
      default:
        throw new Error(`Unsupported function: ${funcName}`);
    }
  }

  /**
   * Get value from expression
   */
  private getValueFromExpression(row: any, expr: any, tableAliasMap?: Map<string, string>): any {
    if (!expr) return null;

    switch (expr.type) {
      case 'column_ref':
        // Handle table alias in column reference
        if (expr.table && tableAliasMap) {
          // If column has table prefix, resolve alias
          const tableAlias = expr.table;
          const columnName = expr.column;
          
          // Try prefixed column name first (for JOIN results)
          const prefixedColumnName = `${tableAlias}.${columnName}`;
          if (row.hasOwnProperty(prefixedColumnName)) {
            return row[prefixedColumnName];
          }
          
          // Fall back to original column name
          return row[columnName];
        }
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
        const left = this.getValueFromExpression(row, expr.left, tableAliasMap);
        const right = this.getValueFromExpression(row, expr.right, tableAliasMap);
        
        switch (expr.operator) {
          // Arithmetic operators
          case '+': return Number(left) + Number(right);
          case '-': return Number(left) - Number(right);
          case '*': return Number(left) * Number(right);
          case '/': return Number(left) / Number(right);
          case '%': return Number(left) % Number(right);
          
          // Comparison operators (return boolean values)
          case '=': return left == right;
          case '!=': return left != right;
          case '<>': return left != right;
          case '>': return left > right;
          case '>=': return left >= right;
          case '<': return left < right;
          case '<=': return left <= right;
          case 'IS': return left === right;
          case 'IS NOT': return left !== right;
          case 'LIKE': 
            const pattern = right.toString().replace(/%/g, '.*').replace(/_/g, '.');
            return new RegExp(pattern, 'i').test(left.toString());
          case 'AND': 
            return left && right;
          case 'OR': 
            return left || right;
          case 'IN':
            if (expr.right.type !== 'expr_list') {
              throw new Error('IN operator requires a list of values');
            }
            const inValues = this.getValueFromExpression(row, expr.right, tableAliasMap);
            return inValues.includes(left);
          case 'NOT IN':
            if (expr.right.type !== 'expr_list') {
              throw new Error('NOT IN operator requires a list of values');
            }
            const notInValues = this.getValueFromExpression(row, expr.right, tableAliasMap);
            return !notInValues.includes(left);
            
          default:
            throw new Error(`Unsupported operator: ${expr.operator}`);
        }
      case 'function':
        return this.evaluateFunction(row, expr, tableAliasMap);
      case 'aggr_func':
        // Aggregate functions should be handled at a higher level
        // This is a fallback for cases where they appear in expressions
        return this.evaluateFunction(row, expr, tableAliasMap);
      case 'star':
        // Star (*) is typically used in COUNT(*) and should be handled at aggregate level
        // For expression evaluation, return a placeholder
        return '*';
      case 'expr_list':
        // Handle expression lists (used in IN clauses)
        return expr.value.map((item: any) => this.getValueFromExpression(row, item, tableAliasMap));
      default:
        throw new Error(`Unsupported expression type: ${expr.type}`);
    }
  }

  /**
   * Apply GROUP BY
   */
  private applyGroupBy(data: any[], groupByColumns: any[], selectColumns: any[], tableAliasMap?: Map<string, string>): any[] {
    // Group by grouping fields
    const groups = new Map<string, any[]>();
    
    for (const row of data) {
      const groupKey = groupByColumns.map(col => {
        const columnName = col.column || col;
        return this.getValueFromExpression(row, col.type === 'column_ref' ? col : { type: 'column_ref', column: columnName }, tableAliasMap);
      }).join('|');
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
      groupByColumns.forEach((gb, index) => {
        const columnName = gb.column || gb;
        groupResult[columnName] = groupKey.split('|')[index];
      });

      // Process aggregate functions
      for (const col of selectColumns) {
        if (col.expr && col.expr.type === 'aggr_func') {
          const funcName = col.expr.name.toUpperCase();
          const columnName = col.expr.args?.value?.[0]?.column || col.expr.args?.value?.[0]?.value;
          
          switch (funcName) {
            case 'COUNT':
              if (col.expr.args?.expr?.type === 'star') {
                groupResult[col.as || `COUNT(*)`] = groupRows.length;
              } else {
                const countArg = col.expr.args?.expr;
                if (!countArg) {
                  throw new Error('COUNT function requires exactly 1 argument');
                }
                const nonNullCount = groupRows.filter(row => {
                  const val = this.getValueFromExpression(row, countArg, tableAliasMap);
                  return val !== null && val !== undefined && val !== '';
                }).length;
                groupResult[col.as || `COUNT`] = nonNullCount;
              }
              break;
              
            case 'SUM':
              const sumArg = col.expr.args?.expr;
              if (!sumArg) {
                throw new Error('SUM function requires exactly 1 argument');
              }
              const sumValues = groupRows
                .map(row => {
                  const val = this.getValueFromExpression(row, sumArg, tableAliasMap);
                  return Number(val);
                })
                .filter(val => !isNaN(val));
              groupResult[col.as || `SUM`] = sumValues.reduce((sum, val) => sum + val, 0);
              break;

            case 'MAX':
              const maxArg = col.expr.args?.expr;
              if (!maxArg) {
                throw new Error('MAX function requires exactly 1 argument');
              }
              const maxValues = groupRows
                .map(row => {
                  const val = this.getValueFromExpression(row, maxArg, tableAliasMap);
                  return Number(val);
                })
                .filter(val => !isNaN(val));
              if (maxValues.length === 0) {
                groupResult[col.as || `MAX`] = null;
              } else {
                groupResult[col.as || `MAX`] = Math.max(...maxValues);
              }
              break;

            case 'MIN':
              const minArg = col.expr.args?.expr;
              if (!minArg) {
                throw new Error('MIN function requires exactly 1 argument');
              }
              const minValues = groupRows
                .map(row => {
                  const val = this.getValueFromExpression(row, minArg, tableAliasMap);
                  return Number(val);
                })
                .filter(val => !isNaN(val));
              if (minValues.length === 0) {
                groupResult[col.as || `MIN`] = null;
              } else {
                groupResult[col.as || `MIN`] = Math.min(...minValues);
              }
              break;

            case 'AVG':
              const avgArg = col.expr.args?.expr;
              if (!avgArg) {
                throw new Error('AVG function requires exactly 1 argument');
              }
              const avgValues = groupRows
                .map(row => {
                  const val = this.getValueFromExpression(row, avgArg, tableAliasMap);
                  return Number(val);
                })
                .filter(val => !isNaN(val));
              if (avgValues.length === 0) {
                groupResult[col.as || `AVG`] = null;
              } else {
                const sum = avgValues.reduce((sum, val) => sum + val, 0);
                groupResult[col.as || `AVG`] = sum / avgValues.length;
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
  private applyOrderBy(data: any[], orderByColumns: any[], tableAliasMap?: Map<string, string>): any[] {
    return data.sort((a, b) => {
      for (const order of orderByColumns) {
        const aVal = this.getValueFromExpression(a, order.expr, tableAliasMap);
        const bVal = this.getValueFromExpression(b, order.expr, tableAliasMap);
        
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
  private applySelectFields(data: any[], columns: any[], tableAliasMap?: Map<string, string>): any[] {
    if (columns.length === 1 && columns[0].expr.type === 'column_ref' && columns[0].expr.column === '*') {
      return data;
    }

    return data.map(row => {
      const newRow: any = {};
      for (const col of columns) {
        if (col.expr.type === 'column_ref') {
          const columnName = col.expr.column;
          const tableName = col.expr.table;
          
          // Handle table.* wildcard selection
          if (columnName === '*' && tableName) {
            // Add all columns from the specified table
            for (const key in row) {
              if (key.startsWith(tableName + '.')) {
                const actualColumnName = key.substring(tableName.length + 1);
                newRow[actualColumnName] = row[key];
              }
            }
          } else {
            const alias = col.as || columnName;
            newRow[alias] = this.getValueFromExpression(row, col.expr, tableAliasMap);
          }
        } else if (col.expr.type === 'number' || col.expr.type === 'string') {
          const alias = col.as || col.expr.value;
          newRow[alias] = col.expr.value;
        } else {
          // Handle other expression types (functions, binary expressions, etc.)
          const alias = col.as || 'expr';
          newRow[alias] = this.getValueFromExpression(row, col.expr, tableAliasMap);
        }
      }
      return newRow;
    });
  }

  /**
   * Apply aggregate functions (non-GROUP BY case)
   */
  private applyAggregateFunction(data: any[], columns: any[], tableAliasMap?: Map<string, string>): any[] {
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
            if (col.expr.args?.expr?.type === 'star') {
              result[col.as || 'COUNT(*)'] = data.length;
            } else {
              const countArg = col.expr.args?.expr;
              if (!countArg) {
                throw new Error('COUNT function requires exactly 1 argument');
              }
              const nonNullCount = data.filter(row => {
                const val = this.getValueFromExpression(row, countArg, tableAliasMap);
                return val !== null && val !== undefined && val !== '';
              }).length;
              result[col.as || `COUNT`] = nonNullCount;
            }
            break;
            
          case 'SUM':
              const sumArg = col.expr.args?.expr;
              if (!sumArg) {
                throw new Error('SUM function requires exactly 1 argument');
              }
              const sumValues = data
                .map(row => {
                  const val = this.getValueFromExpression(row, sumArg, tableAliasMap);
                  return Number(val);
                })
                .filter(val => !isNaN(val));
              result[col.as || `SUM`] = sumValues.reduce((sum, val) => sum + val, 0);
              break;

            case 'MAX':
              const maxArg = col.expr.args?.expr;
              if (!maxArg) {
                throw new Error('MAX function requires exactly 1 argument');
              }
              const maxValues = data
                .map(row => {
                  const val = this.getValueFromExpression(row, maxArg, tableAliasMap);
                  return Number(val);
                })
                .filter(val => !isNaN(val));
              if (maxValues.length === 0) {
                result[col.as || `MAX`] = null;
              } else {
                result[col.as || `MAX`] = Math.max(...maxValues);
              }
              break;

            case 'MIN':
              const minArg = col.expr.args?.expr;
              if (!minArg) {
                throw new Error('MIN function requires exactly 1 argument');
              }
              const minValues = data
                .map(row => {
                  const val = this.getValueFromExpression(row, minArg, tableAliasMap);
                  return Number(val);
                })
                .filter(val => !isNaN(val));
              if (minValues.length === 0) {
                result[col.as || `MIN`] = null;
              } else {
                result[col.as || `MIN`] = Math.min(...minValues);
              }
              break;

            case 'AVG':
              const avgArg = col.expr.args?.expr;
              if (!avgArg) {
                throw new Error('AVG function requires exactly 1 argument');
              }
              const avgValues = data
                .map(row => {
                  const val = this.getValueFromExpression(row, avgArg, tableAliasMap);
                  return Number(val);
                })
                .filter(val => !isNaN(val));
              if (avgValues.length === 0) {
                result[col.as || `AVG`] = null;
              } else {
                const sum = avgValues.reduce((sum, val) => sum + val, 0);
                result[col.as || `AVG`] = sum / avgValues.length;
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