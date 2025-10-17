import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';
import pkg from 'node-sql-parser';
const { Parser: NodeSqlParser } = pkg;

/**
 * Excel SQL Query Tool Class
 * Supports simple SQL query operations on Excel files
 */
export class ExcelSqlQuery {
  private parser: any;
  private disableStreamingAggregate: boolean = false;

  constructor(options?: { disableStreamingAggregate?: boolean }) {
    // 初始化SQL解析器
    this.parser = new NodeSqlParser();
    if (options && typeof options.disableStreamingAggregate === 'boolean') {
      this.disableStreamingAggregate = options.disableStreamingAggregate;
    }
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
   * Stream load worksheet data for large files using ExcelJS stream API
   */
  private async streamLoadWorksheetData(filePath: string): Promise<Map<string, any[]>> {
    const worksheetData: Map<string, any[]> = new Map();
    
    try {
      const workbookReader = new (ExcelJS as any).stream.xlsx.WorkbookReader(filePath);
      let worksheetIndex = 0;
      
      for await (const worksheetReader of workbookReader) {
        worksheetIndex++;
        const worksheetName = `Sheet${worksheetIndex}`;
        const sheetData: any[] = [];
        let headers: string[] = [];
        let rowCount = 0;
        const maxRows = 1000000; // Increase limit to 1,000,000 rows
        
        for await (const row of worksheetReader) {
          rowCount++;
          
          // First row contains headers
          if (rowCount === 1) {
            row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
              headers[colNumber - 1] = cell.value?.toString() || `Column${colNumber}`;
            });
            continue;
          }
          
          // Stop if we've reached the maximum row limit
          if (rowCount > maxRows) {
            console.log(`⚠️  Reached maximum row limit (${maxRows}) for worksheet "${worksheetName}"`);
            break;
          }
          
          // Process data rows
          const rowData: any = {};
          let hasData = false;
          
          row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
            const header = headers[colNumber - 1];
            if (header) {
              rowData[header] = cell.value;
              if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
                hasData = true;
              }
            }
          });
          
          // Only add non-empty rows
          if (hasData) {
            sheetData.push(rowData);
          }
        }
        
        worksheetData.set(worksheetName, sheetData);
        console.log(`📊 Worksheet "${worksheetName}" data loaded successfully, total ${sheetData.length} rows (processed ${rowCount - 1} rows)`);
        console.log(`📋 Header info:`, headers);
        if (sheetData.length > 0) {
          console.log(`📄 First row data example:`, JSON.stringify(sheetData[0], null, 2));
        }
      }
      
      return worksheetData;
    } catch (error: any) {
      if (error.message?.includes('Invalid string length') || 
          error.message?.includes('string too long') ||
          error.message?.includes('Maximum string size exceeded')) {
        throw new Error('文件过大，超出JavaScript字符串长度限制。请尝试使用较小的文件或将数据分割成多个文件。');
      }
      throw error;
    }
  }

  /**
   * Execute SQL query
   */
  /**
   * Execute SQL query on Excel file
   * Supports large files up to 200MB with optimized memory usage
   */
  async executeQuery(sql: string, filePath: string): Promise<any[]> {
    try {
      // Check file size first
      const stats = fs.statSync(filePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      
      console.log(`📊 File size: ${fileSizeInMB.toFixed(2)}MB`);
      
      // Warn for very large files but allow processing up to 200MB
      if (fileSizeInMB > 200) {
        throw new Error(`File too large (${fileSizeInMB.toFixed(2)}MB). Maximum supported size is 200MB for SQL query operations.`);
      }
      
      if (fileSizeInMB > 100) {
        console.log(`⚠️  Large file detected (${fileSizeInMB.toFixed(2)}MB). Processing may take longer and use more memory.`);
      }

      // Determine file extension
      const ext = path.extname(filePath).toLowerCase();

      // Parse SQL statement early so we can choose optimal execution path
      const ast = this.parser.astify(sql, { database: 'MySQL' });
      // Validate SQL syntax support
      this.validateSqlSupport(ast);

      // Fast path: streaming aggregate for single-table SUM/aggregate without GROUP BY
      // CSV: always safe to stream
      // Excel: only stream for large files (>50MB); for small files, use baseline in-memory path
      if (!this.disableStreamingAggregate && this.isStreamingAggregateCandidate(ast)) {
        if (ext === '.csv') {
          console.log('🚀 Using streaming aggregation fast path for CSV');
          return await this.executeStreamingAggregateCsv(ast, filePath);
        }
        // Excel streaming is more fragile across environments; guard with size threshold
        const isExcel = ['.xlsx', '.xlsm', '.xltx', '.xltm'].includes(ext);
        if (isExcel) {
          if (fileSizeInMB > 50) {
            console.log('🚀 Using streaming aggregation fast path for large Excel file (>50MB)');
            return await this.executeStreamingAggregateExcel(ast, filePath, fileSizeInMB);
          } else {
            console.log('🧠 Using baseline in-memory aggregation for small Excel file (<=50MB) to ensure stability');
            // Fall through to default path below (preload worksheet data, then execute normally)
          }
        }
      }

      // Default path: load worksheet data then execute
      let worksheetData: Map<string, any[]>;

      if (ext === '.csv') {
        // CSV files: single sheet named "Sheet" with streaming and memory limits
        console.log(`🧾 Detected CSV file. Loading as single worksheet "Sheet"...`);
        const maxRows = 1000000; // Allow up to 1,000,000 rows for CSV baseline path
        worksheetData = await this.loadCsvData(filePath, maxRows);
      } else {
        // Excel files
        // Use stream processing for large files (>50MB)
        if (fileSizeInMB > 50) {
          console.log(`🔄 Using stream processing for large file...`);
          worksheetData = await this.streamLoadWorksheetData(filePath);
        } else {
          console.log(`📖 Using standard processing for file...`);
          // Load Excel file with optimized settings for smaller files
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.readFile(filePath);
          worksheetData = await this.preloadWorksheetData(workbook, filePath);
        }
      }
      
      console.log(`✅ Excel/CSV file loaded successfully: ${path.basename(filePath)}`);
      
      // Execute query based on type
      if (ast.type === 'union' || (ast.set_op && ast.set_op.startsWith('union'))) {
        return this.executeUnion(ast, worksheetData);
      } else {
        return this.executeSelect(ast, worksheetData);
      }
      
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific error types
        if (error.message.includes('Invalid string length') || 
            error.message?.includes('string too long') ||
            error.message?.includes('Maximum string size exceeded')) {
          throw new Error('文件过大，超出JavaScript字符串长度限制。请尝试使用较小的文件或将数据分割成多个文件。');
        }
        if (error.message.includes('EMFILE') || error.message.includes('ENOMEM')) {
          throw new Error(`SQL query execution failed: Insufficient system resources. Try closing other applications or processing a smaller file.`);
        }
        if (error.message.includes('CSV')) {
          throw new Error(`SQL query execution failed: ${error.message}`);
        }
        throw new Error(`SQL query execution failed: ${error.message}`);
      }
      throw new Error(`SQL query execution failed: ${error}`);
    }
  }

  /**
   * Determine if the query can be executed via streaming aggregation fast path
   * Conditions:
   * - Single SELECT
   * - FROM single table without JOIN
   * - No GROUP BY
   * - DISTINCT not used
   * - All selected columns are aggregate functions or expressions composed ONLY of aggregate functions/constant values
   */
  private isStreamingAggregateCandidate(ast: any): boolean {
    try {
      if (!ast || ast.type !== 'select') return false;
      if (!ast.from || ast.from.length !== 1 || ast.from[0].join) return false;
      if (ast.groupby && ast.groupby.columns && ast.groupby.columns.length > 0) return false;
      if (ast.distinct === 'DISTINCT') return false;

      // ORDER BY and LIMIT can be ignored because result is a single row
      const columns = ast.columns || [];
      const onlyAggregates = columns.every((col: any) => this.isExprAggregatesOnly(col?.expr));
      return onlyAggregates;
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if an expression is composed ONLY of aggregate functions, constants, or nested expressions of the same
   * Column references are allowed only INSIDE aggregate function arguments.
   */
  private isExprAggregatesOnly(expr: any, insideAggr = false): boolean {
    if (!expr) return true;
    switch (expr.type) {
      case 'number':
      case 'string':
      case 'single_quote_string':
      case 'bool':
      case 'null':
      case 'star':
        return true;
      case 'double_quote_string':
        // treat as column_ref equivalent in our evaluator; allow only inside aggregate
        return insideAggr;
      case 'column_ref':
        // Column refs only allowed inside aggregate functions
        return insideAggr === true;
      case 'aggr_func':
        // Allow aggregates whose args can include column refs
        if (expr.args && expr.args.expr) {
          return this.isExprAggregatesOnly(expr.args.expr, true);
        }
        // Some parsers use args.value array
        if (expr.args && expr.args.value && expr.args.value.length > 0) {
          return this.isExprAggregatesOnly(expr.args.value[0], true);
        }
        return true;
      case 'binary_expr':
        return this.isExprAggregatesOnly(expr.left, insideAggr) && this.isExprAggregatesOnly(expr.right, insideAggr);
      case 'function':
        // Allow safe scalar wrapper functions (e.g., ROUND) provided their arguments are aggregate-only.
        // Extract function name
        {
          let funcName = '';
          const nm = expr.name;
          if (nm && nm.name && Array.isArray(nm.name) && nm.name.length > 0) {
            funcName = nm.name[0].value?.toUpperCase?.() || '';
          } else if (typeof nm === 'string') {
            funcName = nm.toUpperCase();
          }
          const allowed = new Set(['ROUND', 'ABS', 'CEIL', 'CEILING', 'FLOOR']);
          if (!allowed.has(funcName)) return false;
          const args = expr.args?.value || (expr.args?.expr ? [expr.args.expr] : []);
          return Array.isArray(args) && args.every((a: any) => this.isExprAggregatesOnly(a, insideAggr));
        }
      case 'cast':
        // CAST wraps an expression; allow if inner expr is aggregate-only
        return expr.expr ? this.isExprAggregatesOnly(expr.expr, insideAggr) : false;
      case 'expr_list':
        return Array.isArray(expr.value) ? expr.value.every((v: any) => this.isExprAggregatesOnly(v, insideAggr)) : false;
      case 'case':
        // Support both searched CASE (WHEN cond THEN ...) and simple CASE (CASE base_expr WHEN value THEN ...)
        if (Array.isArray(expr.args)) {
          // node-sql-parser may encode ELSE as an item with type "else" inside args
          const whenItems = expr.args.filter((w: any) => 'cond' in w || 'value' in w);
          const elseItems = expr.args.filter((w: any) => w && w.type === 'else' && 'result' in w);
          const hasCondShape = whenItems.length > 0 && whenItems.every((w: any) => 'cond' in w && 'result' in w);
          const hasValueShape = whenItems.length > 0 && whenItems.every((w: any) => 'value' in w && 'result' in w);
          if (hasCondShape) {
            const whensOk = whenItems.every((w: any) => this.isExprAggregatesOnly(w.cond, insideAggr) && this.isExprAggregatesOnly(w.result, insideAggr));
            // ELSE can be either expr.else or an else item in args
            const elseOkFromArgs = elseItems.length === 0 || elseItems.every((e: any) => this.isExprAggregatesOnly(e.result, insideAggr));
            const elseOk = expr.else ? this.isExprAggregatesOnly(expr.else, insideAggr) : true;
            return whensOk && elseOkFromArgs && elseOk;
          } else if (hasValueShape) {
            const baseOk = expr.expr ? this.isExprAggregatesOnly(expr.expr, insideAggr) : true;
            const whensOk = whenItems.every((w: any) => this.isExprAggregatesOnly(w.value, insideAggr) && this.isExprAggregatesOnly(w.result, insideAggr));
            const elseOkFromArgs = elseItems.length === 0 || elseItems.every((e: any) => this.isExprAggregatesOnly(e.result, insideAggr));
            const elseOk = expr.else ? this.isExprAggregatesOnly(expr.else, insideAggr) : true;
            return baseOk && whensOk && elseOkFromArgs && elseOk;
          }
        }
        return false;
      default:
        return false;
    }
  }

  /**
   * Collect all aggregate function expression nodes from the given expression
   */
  private collectAggregateExprs(expr: any, acc: Set<any>): void {
    if (!expr) return;
    switch (expr.type) {
      case 'aggr_func':
        acc.add(expr);
        // also traverse into args to catch nested aggregates (rare)
        if (expr.args?.expr) this.collectAggregateExprs(expr.args.expr, acc);
        if (expr.args?.value && Array.isArray(expr.args.value)) this.collectAggregateExprs(expr.args.value[0], acc);
        break;
      case 'binary_expr':
        this.collectAggregateExprs(expr.left, acc);
        this.collectAggregateExprs(expr.right, acc);
        break;
      case 'function':
        // traverse function arguments to find nested aggregates (e.g., ROUND(CAST(SUM(...) AS DOUBLE)))
        if (expr.args?.expr) this.collectAggregateExprs(expr.args.expr, acc);
        if (expr.args?.value && Array.isArray(expr.args.value)) {
          for (const v of expr.args.value) this.collectAggregateExprs(v, acc);
        }
        break;
      case 'cast':
        // CAST has inner expr that may contain aggregates
        if (expr.expr) this.collectAggregateExprs(expr.expr, acc);
        break;
      case 'expr_list':
        if (Array.isArray(expr.value)) expr.value.forEach((v: any) => this.collectAggregateExprs(v, acc));
        break;
      case 'case':
        if (Array.isArray(expr.args)) {
          // Searched CASE WHEN ... THEN ...
          expr.args.forEach((w: any) => {
            if ('cond' in w) this.collectAggregateExprs(w.cond, acc);
            if ('value' in w) this.collectAggregateExprs(w.value, acc);
            this.collectAggregateExprs(w.result, acc);
          });
        }
        if (expr.expr) this.collectAggregateExprs(expr.expr, acc); // base expr for simple CASE
        if (expr.else) this.collectAggregateExprs(expr.else, acc);
        break;
      default:
        // do nothing
        break;
    }
  }

  /**
   * Evaluate an expression after aggregation, replacing aggr_func nodes with their aggregated values.
   */
  private evaluateAggregatedExpression(expr: any, aggregatedMap: Map<any, number>): any {
    if (!expr) return null;
    switch (expr.type) {
      case 'number':
        return expr.value;
      case 'string':
      case 'single_quote_string':
        return expr.value;
      case 'bool':
        return expr.value;
      case 'null':
        return null;
      case 'aggr_func':
        // Lookup precomputed aggregate
        if (!aggregatedMap.has(expr)) {
          throw new Error('Missing aggregated value for expression');
        }
        return aggregatedMap.get(expr);
      case 'binary_expr':
        const left = this.evaluateAggregatedExpression(expr.left, aggregatedMap);
        const right = this.evaluateAggregatedExpression(expr.right, aggregatedMap);
        switch (expr.operator) {
          case '+': return Number(left) + Number(right);
          case '-': return Number(left) - Number(right);
          case '*': return Number(left) * Number(right);
          case '/': return Number(left) / Number(right);
          case '%': return Number(left) % Number(right);
          case '=': return left == right;
          case '!=': return left != right;
          case '<>': return left != right;
          case '>': return left > right;
          case '>=': return left >= right;
          case '<': return left < right;
          case '<=': return left <= right;
          case 'IS': return left === right;
          case 'IS NOT': return left !== right;
          case 'AND': return Boolean(left) && Boolean(right);
          case 'OR': return Boolean(left) || Boolean(right);
          default:
            throw new Error(`Unsupported operator in aggregated expression: ${expr.operator}`);
        }
      case 'function':
        // Evaluate safe scalar functions post-aggregation
        {
          let funcName = '';
          const nm = expr.name;
          if (nm && nm.name && Array.isArray(nm.name) && nm.name.length > 0) {
            funcName = nm.name[0].value?.toUpperCase?.() || '';
          } else if (typeof nm === 'string') {
            funcName = nm.toUpperCase();
          }
          const args = expr.args?.value || (expr.args?.expr ? [expr.args.expr] : []);
          const evalArgs = (Array.isArray(args) ? args : []).map((a: any) => this.evaluateAggregatedExpression(a, aggregatedMap));
          switch (funcName) {
            case 'ROUND': {
              const num = Number(evalArgs[0]);
              const digits = evalArgs.length >= 2 ? Number(evalArgs[1]) : 0;
              return Math.round(num * Math.pow(10, digits)) / Math.pow(10, digits);
            }
            case 'ABS':
              return Math.abs(Number(evalArgs[0]));
            case 'CEIL':
            case 'CEILING':
              return Math.ceil(Number(evalArgs[0]));
            case 'FLOOR':
              return Math.floor(Number(evalArgs[0]));
            default:
              throw new Error(`Unsupported function in aggregated evaluation: ${funcName}`);
          }
        }
      case 'cast':
        // CAST inner expression and convert to target type
        {
          const innerVal = this.evaluateAggregatedExpression(expr.expr, aggregatedMap);
          const target = Array.isArray(expr.target) && expr.target.length > 0 ? expr.target[0].dataType?.toUpperCase?.() : undefined;
          if (!target) return innerVal;
          const numTypes = new Set(['DOUBLE','FLOAT','REAL','NUMERIC','DECIMAL']);
          const intTypes = new Set(['INTEGER','INT','BIGINT','SMALLINT','TINYINT']);
          if (numTypes.has(target)) return Number(innerVal);
          if (intTypes.has(target)) return parseInt(String(innerVal), 10);
          if (target === 'BOOLEAN') return Boolean(innerVal);
          if (target === 'CHAR' || target === 'VARCHAR' || target === 'TEXT' || target === 'NVARCHAR') return String(innerVal);
          // For other types (DATE/TIMESTAMP), return as-is for now
          return innerVal;
        }
      case 'case':
        // Support searched CASE: WHEN cond THEN ... ELSE ... END
        if (Array.isArray(expr.args)) {
          // Node-sql-parser may encode ELSE as an item in args with type "else"
          let elseResultNode: any | undefined = undefined;
          const hasCondShape = expr.args.some((w: any) => 'cond' in w && 'result' in w);
          const hasValueShape = expr.args.some((w: any) => 'value' in w && 'result' in w);

          if (hasCondShape) {
            for (const w of expr.args) {
              if (w && 'cond' in w && 'result' in w) {
                const condVal = this.evaluateAggregatedExpression(w.cond, aggregatedMap);
                if (condVal) {
                  return this.evaluateAggregatedExpression(w.result, aggregatedMap);
                }
              } else if (w && w.type === 'else' && 'result' in w) {
                elseResultNode = w.result;
              }
            }
            if (elseResultNode) return this.evaluateAggregatedExpression(elseResultNode, aggregatedMap);
            if (expr.else) return this.evaluateAggregatedExpression(expr.else, aggregatedMap);
            return null;
          } else if (hasValueShape) {
            // Simple CASE: CASE base_expr WHEN value THEN result ... ELSE ... END
            const baseVal = expr.expr ? this.evaluateAggregatedExpression(expr.expr, aggregatedMap) : undefined;
            for (const w of expr.args) {
              if (w && 'value' in w && 'result' in w) {
                const whenVal = this.evaluateAggregatedExpression(w.value, aggregatedMap);
                if (baseVal === whenVal) {
                  return this.evaluateAggregatedExpression(w.result, aggregatedMap);
                }
              } else if (w && w.type === 'else' && 'result' in w) {
                elseResultNode = w.result;
              }
            }
            if (elseResultNode) return this.evaluateAggregatedExpression(elseResultNode, aggregatedMap);
            if (expr.else) return this.evaluateAggregatedExpression(expr.else, aggregatedMap);
            return null;
          }
        }
        return expr.else ? this.evaluateAggregatedExpression(expr.else, aggregatedMap) : null;
      default:
        // Unsupported in post-aggregation evaluation
        throw new Error(`Unsupported expression in aggregated evaluation: ${expr.type}`);
    }
  }

  /**
   * Streaming aggregation for CSV files
   */
  private async executeStreamingAggregateCsv(ast: any, filePath: string): Promise<any[]> {
    const fromClause = ast.from[0];
    const tableName = fromClause.table;
    const tableAlias = fromClause.as || tableName;
    const tableAliasMap = new Map<string, string>();
    tableAliasMap.set(tableAlias, tableName);

    // Prepare aggregate expressions set
    const aggSet: Set<any> = new Set();
    for (const col of ast.columns) {
      this.collectAggregateExprs(col.expr, aggSet);
    }

    // Initialize aggregate state
    const aggregatedMap: Map<any, number> = new Map();
    const counters: Map<any, { func: string, sum?: number, count?: number, max?: number, min?: number }>= new Map();
    for (const aggrExpr of aggSet) {
      const funcName = (aggrExpr.name?.toUpperCase?.() || aggrExpr.name?.name?.[0]?.value?.toUpperCase?.()) || 'SUM';
      const state: any = { func: funcName };
      if (funcName === 'SUM' || funcName === 'AVG') state.sum = 0;
      if (funcName === 'AVG' || funcName === 'COUNT') state.count = 0;
      if (funcName === 'MAX') state.max = Number.NEGATIVE_INFINITY;
      if (funcName === 'MIN') state.min = Number.POSITIVE_INFINITY;
      counters.set(aggrExpr, state);
    }

    // Read header first
    const headers = await this.readCsvHeader(filePath);
    const stream = fs.createReadStream(filePath);
    const parser = parse({
      columns: false, // we will map by headers manually
      skip_empty_lines: true,
      relax_quotes: true,
      trim: true,
      from_line: 2,
    });
    stream.pipe(parser);

    try {
      for await (const record of parser) {
        const row: any = {};
        let hasData = false;
        for (let i = 0; i < headers.length && i < record.length; i++) {
          const val = record[i];
          row[headers[i]] = val;
          if (val !== null && val !== undefined && val !== '') hasData = true;
        }
        if (!hasData) continue;

        // WHERE filter
        if (ast.where) {
          const passed = this.evaluateCondition(row, ast.where, tableAliasMap);
          if (!passed) continue;
        }

        // Update aggregate states
        for (const [aggrExpr, state] of counters.entries()) {
          const func = state.func;
          let argExpr: any = aggrExpr.args?.expr;
          if (!argExpr && aggrExpr.args?.value?.length > 0) argExpr = aggrExpr.args.value[0];

          if (func === 'COUNT') {
            // COUNT(*) or COUNT(expr not null)
            if (aggrExpr.args?.expr?.type === 'star') {
              state.count = (state.count || 0) + 1;
            } else {
              const v = this.getValueFromExpression(row, argExpr, tableAliasMap);
              if (v !== null && v !== undefined && v !== '') {
                state.count = (state.count || 0) + 1;
              }
            }
            aggregatedMap.set(aggrExpr, state.count || 0);
          } else if (func === 'SUM' || func === 'AVG') {
            const v = this.getValueFromExpression(row, argExpr, tableAliasMap);
            const num = Number(v);
            if (!isNaN(num)) {
              state.sum = (state.sum || 0) + num;
              state.count = (state.count || 0) + 1;
              aggregatedMap.set(aggrExpr, state.sum || 0);
            }
          } else if (func === 'MAX') {
            const v = this.getValueFromExpression(row, argExpr, tableAliasMap);
            const num = Number(v);
            if (!isNaN(num)) {
              state.max = Math.max(state.max ?? Number.NEGATIVE_INFINITY, num);
              aggregatedMap.set(aggrExpr, state.max ?? null);
            }
          } else if (func === 'MIN') {
            const v = this.getValueFromExpression(row, argExpr, tableAliasMap);
            const num = Number(v);
            if (!isNaN(num)) {
              state.min = Math.min(state.min ?? Number.POSITIVE_INFINITY, num);
              aggregatedMap.set(aggrExpr, state.min ?? null);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Streaming CSV aggregation error:', error);
      throw new Error(`CSV streaming aggregation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Compose final single-row result according to select columns
    const resultRow: any = {};
    for (const col of ast.columns) {
      // Determine alias: prefer explicit alias; for aggregates, use COUNT(*) for star; otherwise function name
      let alias: string = 'expr';
      if (col.as) {
        alias = col.as;
      } else if (col.expr?.type === 'aggr_func') {
        const funcName = (col.expr.name?.toUpperCase?.() || col.expr.name) as string;
        const isStar = !!(col.expr?.args?.expr?.type === 'star' || col.expr?.args?.value?.[0]?.type === 'star');
        if (funcName?.toUpperCase?.() === 'COUNT' && isStar) {
          alias = 'COUNT(*)';
        } else {
          alias = funcName;
        }
      }
      resultRow[alias] = this.evaluateAggregatedExpression(col.expr, aggregatedMap);
    }
    return [resultRow];
  }

  /**
   * Streaming aggregation for Excel files using WorkbookReader
   */
  private async executeStreamingAggregateExcel(ast: any, filePath: string, fileSizeInMB: number): Promise<any[]> {
    const fromClause = ast.from[0];
    const tableName = fromClause.table;
    const tableAlias = fromClause.as || tableName;
    const tableAliasMap = new Map<string, string>();
    tableAliasMap.set(tableAlias, tableName);

    // Prepare aggregate expressions set
    const aggSet: Set<any> = new Set();
    for (const col of ast.columns) {
      this.collectAggregateExprs(col.expr, aggSet);
    }

    // Initialize aggregate state
    const aggregatedMap: Map<any, number> = new Map();
    const counters: Map<any, { func: string, sum?: number, count?: number, max?: number, min?: number }>= new Map();
    for (const aggrExpr of aggSet) {
      const funcName = (aggrExpr.name?.toUpperCase?.() || aggrExpr.name?.name?.[0]?.value?.toUpperCase?.()) || 'SUM';
      const state: any = { func: funcName };
      if (funcName === 'SUM' || funcName === 'AVG') state.sum = 0;
      if (funcName === 'AVG' || funcName === 'COUNT') state.count = 0;
      if (funcName === 'MAX') state.max = Number.NEGATIVE_INFINITY;
      if (funcName === 'MIN') state.min = Number.POSITIVE_INFINITY;
      counters.set(aggrExpr, state);
    }

    // Stream target worksheet only
    // ExcelJS v4: the simplest and most reliable approach is to use WorkbookReader
    // without special options and iterate over worksheets and rows via async iterators.
    const workbookReader = new (ExcelJS as any).stream.xlsx.WorkbookReader(filePath);

    try {
      let worksheetIndex = 0;
      for await (const worksheetReader of workbookReader) {
        worksheetIndex++;
        // ExcelJS v4: Get worksheet name safely
        let wsName = '';
        if (worksheetReader && typeof worksheetReader === 'object') {
          wsName = (worksheetReader as any).name || 
                   (worksheetReader as any).sheetName || 
                   (worksheetReader as any).title || 
                   (worksheetReader as any).id || '';
        }
        // Support both real names and fallback to SheetN convention (based on index)
        const matchByName = wsName === tableName;
        const conventionalName = `Sheet${worksheetIndex}`;
        const matchByConventional = tableName === conventionalName;
        if (!matchByName && !matchByConventional) {
          continue;
        }

        let headers: string[] = [];
        let rowIndex = 0;
        const maxRows = 1000000; // Increase limit to 1,000,000 rows for streaming aggregation

        for await (const row of worksheetReader) {
          rowIndex++;
          if (rowIndex === 1) {
            row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
              headers[colNumber - 1] = cell.value?.toString() || `Column${colNumber}`;
            });
            continue;
          }
          if (rowIndex - 1 > maxRows) {
            console.log(`⚠️  Reached maximum row limit (${maxRows}) for worksheet "${tableName}" in streaming aggregation`);
            break;
          }
          const rowData: any = {};
          let hasData = false;
          row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
            const header = headers[colNumber - 1];
            if (header) {
              rowData[header] = cell.value;
              if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
                hasData = true;
              }
            }
          });
          if (!hasData) continue;

          // WHERE filter
          if (ast.where) {
            const passed = this.evaluateCondition(rowData, ast.where, tableAliasMap);
            if (!passed) continue;
          }

          // Update aggregate states
          for (const [aggrExpr, state] of counters.entries()) {
            const func = state.func;
            let argExpr: any = aggrExpr.args?.expr;
            if (!argExpr && aggrExpr.args?.value?.length > 0) argExpr = aggrExpr.args.value[0];

            if (func === 'COUNT') {
              if (aggrExpr.args?.expr?.type === 'star') {
                state.count = (state.count || 0) + 1;
              } else {
                const v = this.getValueFromExpression(rowData, argExpr, tableAliasMap);
                if (v !== null && v !== undefined && v !== '') {
                  state.count = (state.count || 0) + 1;
                }
              }
              aggregatedMap.set(aggrExpr, state.count || 0);
            } else if (func === 'SUM' || func === 'AVG') {
              const v = this.getValueFromExpression(rowData, argExpr, tableAliasMap);
              const num = Number(v);
              if (!isNaN(num)) {
                state.sum = (state.sum || 0) + num;
                state.count = (state.count || 0) + 1;
                aggregatedMap.set(aggrExpr, state.sum || 0);
              }
            } else if (func === 'MAX') {
              const v = this.getValueFromExpression(rowData, argExpr, tableAliasMap);
              const num = Number(v);
              if (!isNaN(num)) {
                state.max = Math.max(state.max ?? Number.NEGATIVE_INFINITY, num);
                aggregatedMap.set(aggrExpr, state.max ?? null);
              }
            } else if (func === 'MIN') {
              const v = this.getValueFromExpression(rowData, argExpr, tableAliasMap);
              const num = Number(v);
              if (!isNaN(num)) {
                state.min = Math.min(state.min ?? Number.POSITIVE_INFINITY, num);
                aggregatedMap.set(aggrExpr, state.min ?? null);
              }
            }
          }
        }

        // Finished target sheet; compose result
        const resultRow: any = {};
        for (const col of ast.columns) {
          // Determine alias: prefer explicit alias; for aggregates, use COUNT(*) for star; otherwise function name
          let alias: string = 'expr';
          if (col.as) {
            alias = col.as;
          } else if (col.expr?.type === 'aggr_func') {
            const funcName = (col.expr.name?.toUpperCase?.() || col.expr.name) as string;
            const isStar = !!(col.expr?.args?.expr?.type === 'star' || col.expr?.args?.value?.[0]?.type === 'star');
            if (funcName?.toUpperCase?.() === 'COUNT' && isStar) {
              alias = 'COUNT(*)';
            } else {
              alias = funcName;
            }
          }
          resultRow[alias] = this.evaluateAggregatedExpression(col.expr, aggregatedMap);
        }
        return [resultRow];
      }
    } catch (error: any) {
      if (error.message?.includes('Invalid string length') || 
          error.message?.includes('string too long') ||
          error.message?.includes('Maximum string size exceeded')) {
        throw new Error('文件过大，超出JavaScript字符串长度限制。请尝试使用较小的文件或将数据分割成多个文件。');
      }
      throw error;
    }

    throw new Error(`Worksheet "${tableName}" not found for streaming aggregation`);
  }

  /**
   * Get worksheet information (lightweight version - only returns worksheet names)
   * For row count information, use SQL query: SELECT COUNT(*) FROM SheetName
   * Supports large files up to 200MB with optimized memory usage
   */
  async getWorksheetInfo(filePath: string): Promise<Array<{table_name: string, rowCount?: number}>> {
    try {
      // Check file size first
      const stats = fs.statSync(filePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      
      console.log(`📊 File size: ${fileSizeInMB.toFixed(2)}MB`);

      // Determine file extension
      const ext = path.extname(filePath).toLowerCase();
      
      // Warn for very large files but allow processing up to 200MB
      if (fileSizeInMB > 200) {
        throw new Error(`File too large (${fileSizeInMB.toFixed(2)}MB). Maximum supported size is 200MB for worksheet info operations.`);
      }
      
      if (fileSizeInMB > 100) {
        console.log(`⚠️  Large file detected (${fileSizeInMB.toFixed(2)}MB). Using stream processing for better memory efficiency.`);
      }
      
      const tables: Array<{table_name: string, rowCount?: number}> = [];

      if (ext === '.csv') {
        console.log(`🧾 Detected CSV file. Reporting single worksheet "Sheet"...`);
        // 轻量化：仅返回工作表名称，不进行逐行统计
        tables.push({ table_name: 'Sheet' });
      } else {
        // Use Excel processing
        // Use stream reading for large files (>50MB) or when regular loading fails
      if (fileSizeInMB > 50) {
        console.log(`🔄 Using stream processing for large file...`);
        
        // Use ExcelJS stream reader for better memory efficiency
          const workbookReader = new (ExcelJS as any).stream.xlsx.WorkbookReader(filePath);
          
          try {
            let worksheetIndex = 0;
            // Process worksheets using async iteration
            for await (const worksheetReader of workbookReader) {
              worksheetIndex++;
              // ExcelJS v4: WorksheetReader doesn't have a direct name property
              // Use index-based naming as fallback, or try to get name from properties
              let worksheetName = `Sheet${worksheetIndex}`;
              
              // Try to get the actual worksheet name if available
              if (worksheetReader && typeof worksheetReader === 'object') {
                // Check various possible name properties
                const possibleName = (worksheetReader as any).name || 
                                   (worksheetReader as any).sheetName || 
                                   (worksheetReader as any).title;
                if (possibleName && typeof possibleName === 'string') {
                  worksheetName = possibleName;
                }
              }
              
              // 轻量化：仅返回工作表名称，不进行逐行统计，避免对大文件逐行解析带来的耗时
              tables.push({ table_name: worksheetName });
              console.log(`📋 Found worksheet: "${worksheetName}"`);
            }
          } catch (streamError) {
            console.log(`⚠️  Stream processing failed: ${streamError instanceof Error ? streamError.message : 'Unknown error'}, falling back to standard method...`);
            throw streamError; // Let it fall through to standard method
          }
          
        } else {
          // Use standard method for smaller files
          console.log(`📖 Using standard processing for file...`);
          
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.readFile(filePath);
          
          // Only get worksheet names without loading full data
          workbook.eachSheet((worksheet: any) => {
            // 轻量化：仅返回名称，不读取 rowCount，避免触发对所有行的解析
            tables.push({ table_name: worksheet.name });
          });
        }
      }
      
      console.log(`✅ Excel file processed successfully: ${path.basename(filePath)}`);
      console.log(`📋 Found ${tables.length} worksheet(s): ${tables.map(t => t.table_name).join(', ')}`);
      
      return tables;
      
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific error types
        if (error.message.includes('Invalid string length') || 
            error.message.includes('Cannot create a string longer than') ||
            error.message.includes('ERR_STRING_TOO_LONG')) {
          throw new Error(`Failed to get worksheet information: File too large or corrupted. The file exceeds JavaScript string length limits. Try with a smaller file or split the data into multiple files.`);
        }
        if (error.message.includes('EMFILE') || error.message.includes('ENOMEM')) {
          throw new Error(`Failed to get worksheet information: Insufficient system resources. Try closing other applications or processing a smaller file.`);
        }
        throw new Error(`Failed to get worksheet information: ${error.message}`);
      }
      throw new Error(`Failed to get worksheet information: ${error}`);
    }
  }

  /**
   * Get worksheet columns information (lightweight version - only reads first row)
   * Supports large files up to 200MB with optimized memory usage
   */
  async getWorksheetColumns(filePath: string, worksheetName?: string): Promise<Array<{table_name: string, columns: string[]}>> {
    try {
      // Check file size first
      const stats = fs.statSync(filePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      
      console.log(`📊 File size: ${fileSizeInMB.toFixed(2)}MB`);
      
      // Determine file extension
      const ext = path.extname(filePath).toLowerCase();
      
      // Warn for very large files but allow processing up to 200MB
      if (fileSizeInMB > 200) {
        throw new Error(`File too large (${fileSizeInMB.toFixed(2)}MB). Maximum supported size is 200MB for worksheet columns operations.`);
      }
      
      if (fileSizeInMB > 100) {
        console.log(`⚠️  Large file detected (${fileSizeInMB.toFixed(2)}MB). Processing may take longer and use more memory.`);
      }

      const result: Array<{table_name: string, columns: string[]}> = [];

      // Use stream reading for large files (>50MB) or when regular loading fails
      if (fileSizeInMB > 50) {
        console.log(`🔄 Using stream processing for large file...`);
        
        try {
          const workbookReader = new (ExcelJS as any).stream.xlsx.WorkbookReader(filePath);
          let worksheetIndex = 0;
          
          for await (const worksheetReader of workbookReader) {
            worksheetIndex++;
            const currentWorksheetName = `Sheet${worksheetIndex}`;
            
            // Skip if specific worksheet is requested and this is not it
            if (worksheetName && worksheetName !== currentWorksheetName) {
              continue;
            }

            // Only read the first row to get column information
            let firstRowProcessed = false;
            for await (const row of worksheetReader) {
              if (!firstRowProcessed) {
                const columns: string[] = [];
                row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
                  const columnName = cell.value ? String(cell.value).trim() : `Column${colNumber}`;
                  columns.push(columnName);
                });
                
                result.push({
                  table_name: currentWorksheetName,
                  columns: columns.length > 0 ? columns : ['Column1', 'Column2', 'Column3']
                });
                
                firstRowProcessed = true;
                break; // Only need the first row, break out of row loop
              }
            }
          }
          
          return result;
        } catch (error: any) {
          if (error.message?.includes('Invalid string length') || 
              error.message?.includes('string too long') ||
              error.message?.includes('Maximum string size exceeded')) {
            throw new Error('文件过大，超出JavaScript字符串长度限制。请尝试使用较小的文件或将数据分割成多个文件。');
          }
          throw error;
        }
      }

      // CSV handling
      if (ext === '.csv') {
        console.log(`🧾 Detected CSV file. Reading header as columns for single worksheet "Sheet"...`);
        if (worksheetName && worksheetName !== 'Sheet') {
          throw new Error(`Worksheet "${worksheetName}" does not exist (CSV has only one worksheet named "Sheet")`);
        }
        const columns = await this.readCsvHeader(filePath);
        result.push({ table_name: 'Sheet', columns: columns.length > 0 ? columns : ['Column1', 'Column2', 'Column3'] });
        return result;
      }

      // Use standard method for smaller Excel files
      console.log(`📖 Using standard processing for file...`);
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      console.log(`✅ Excel file loaded successfully: ${path.basename(filePath)}`);
      
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
        // Handle specific error types
        if (error.message.includes('Invalid string length') || 
            error.message.includes('Cannot create a string longer than') ||
            error.message.includes('ERR_STRING_TOO_LONG')) {
          throw new Error(`Failed to get worksheet columns: File too large or corrupted. The file exceeds JavaScript string length limits. Try with a smaller file or split the data into multiple files.`);
        }
        if (error.message.includes('EMFILE') || error.message.includes('ENOMEM')) {
          throw new Error(`Failed to get worksheet columns: Insufficient system resources. Try closing other applications or processing a smaller file.`);
        }
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
   * Load CSV data as a single worksheet named "Sheet" with streaming and memory limits
   */
  private async loadCsvData(filePath: string, maxRows: number): Promise<Map<string, any[]>> {
    const worksheetData: Map<string, any[]> = new Map();
    const sheetName = 'Sheet';
    const sheetRows: any[] = [];

    console.log(`🔄 Streaming CSV data (max ${maxRows} rows) ...`);

    const stream = fs.createReadStream(filePath);
    const parser = parse({
      columns: true, // use first row as headers
      skip_empty_lines: true,
      relax_quotes: true,
      trim: true,
      // Prevent extremely large records from exhausting memory
      max_record_size: 1024 * 1024, // 1MB per record
    });

    stream.pipe(parser);

    let rowCount = 0;
    let headersLogged = false;

    try {
      for await (const record of parser) {
        if (rowCount >= maxRows) {
          console.log(`⚠️  Reached maximum row limit (${maxRows}) for CSV worksheet "${sheetName}"`);
          break;
        }

        // Skip empty rows
        const hasData = Object.values(record).some(v => v !== null && v !== undefined && String(v).trim() !== '');
        if (!hasData) {
          continue;
        }

        sheetRows.push(record);
        rowCount++;

        if (!headersLogged) {
          const headers = Object.keys(record);
          console.log(`📋 CSV Header info:`, headers);
          headersLogged = true;
        }
      }
    } catch (error) {
      console.error(`❌ Error loading CSV:`, error);
      throw new Error(`CSV parsing error: ${error instanceof Error ? error.message : String(error)}`);
    }

    worksheetData.set(sheetName, sheetRows);
    console.log(`✅ CSV loaded into worksheet "${sheetName}": ${sheetRows.length} rows`);
    if (sheetRows.length > 0) {
      console.log(`📄 First row data example:`, JSON.stringify(sheetRows[0], null, 2));
    }

    return worksheetData;
  }

  /**
   * Read CSV header (first row) as columns
   */
  private async readCsvHeader(filePath: string): Promise<string[]> {
    const stream = fs.createReadStream(filePath);
    const parser = parse({
      columns: false,
      skip_empty_lines: true,
      relax_quotes: true,
      trim: true,
    });
    stream.pipe(parser);

    try {
      for await (const record of parser) {
        // First record is header row
        return record.map((c: any, idx: number) => {
          const val = c !== null && c !== undefined ? String(c).trim() : '';
          return val || `Column${idx + 1}`;
        });
      }
    } catch (error) {
      console.error(`❌ Error reading CSV header:`, error);
      throw new Error(`CSV header read error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // If file is empty, return default columns
    return ['Column1', 'Column2', 'Column3'];
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

    // JOIN operations are now supported

    // Check subqueries (but allow UNION queries)
    if (ast.set_op !== 'union' && ast.set_op !== 'union all' && ast.type !== 'union' && JSON.stringify(ast).includes('"type":"select"') && JSON.stringify(ast).match(/"type":"select"/g)!.length > 1) {
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

      // Validate field existence for single table queries
      this.validateFieldExistence(ast, tableName, result, tableAliasMap);
    } else {
      // JOIN operations
      const joinResult = this.executeJoin(ast.from, worksheetData);
      result = joinResult.data;
      tableAliasMap = joinResult.tableAliasMap;

      // Validate field existence for JOIN queries
      this.validateJoinFieldExistence(ast, tableAliasMap, worksheetData);
    }

    // Apply WHERE conditions
    if (ast.where) {
      result = this.applyWhereCondition(result, ast.where, tableAliasMap);
    }

    // Apply GROUP BY
    if (ast.groupby && ast.groupby.columns && ast.groupby.columns.length > 0) {
      result = this.applyGroupBy(result, ast.groupby.columns, ast.columns, tableAliasMap);
      
      // Apply ORDER BY after GROUP BY if present
      if (ast.orderby && ast.orderby.length > 0) {
        result = this.applyOrderBy(result, ast.orderby, tableAliasMap, ast.columns);
      }
    } else {
      // If the SELECT list is aggregate-only (no raw, non-aggregate expressions),
      // skip row-level SELECT evaluation and go straight to aggregation.
      const isAggregateOnlySelect = (ast.columns || []).every((col: any) => this.isExprAggregatesOnly(col?.expr));

      if (isAggregateOnlySelect) {
        // For aggregate-only queries, ORDER BY and DISTINCT are irrelevant because
        // the output is a single aggregated row. Compute aggregation directly.
        result = this.applyAggregateFunction(result, ast.columns, tableAliasMap);
      } else {
        // Regular path: SELECT fields -> ORDER BY -> DISTINCT
        result = this.applySelectFields(result, ast.columns, tableAliasMap);

        if (ast.orderby && ast.orderby.length > 0) {
          result = this.applyOrderBy(result, ast.orderby, tableAliasMap, ast.columns);
        }

        if (ast.distinct === 'DISTINCT') {
          result = this.applyDistinct(result);
        }

        // Aggregate functions will only be applied if appropriate inside applyAggregateFunction
        result = this.applyAggregateFunction(result, ast.columns, tableAliasMap);
      }
    }

    // Apply LIMIT
    if (ast.limit) {
      result = this.applyLimit(result, ast.limit);
    }

    return result;
  }

  /**
   * Execute UNION operations
   */
  private executeUnion(ast: any, worksheetData: Map<string, any[]>): any[] {
    // Collect all SELECT statements from the UNION chain
    const selectStatements: any[] = [];
    let currentAst = ast;

    while (currentAst) {
      selectStatements.push(currentAst);
      currentAst = currentAst._next;
    }

    if (selectStatements.length === 0) {
      throw new Error('UNION operation requires at least one SELECT statement');
    }

    let allResults: any[] = [];
    const firstSelectColumns = this.getSelectColumns(selectStatements[0]);

    // Execute each SELECT statement
    for (let i = 0; i < selectStatements.length; i++) {
      const selectAst = selectStatements[i];
      const currentColumns = this.getSelectColumns(selectAst);

      // Validate column count matches
      if (currentColumns.length !== firstSelectColumns.length) {
        throw new Error(`UNION: SELECT statement ${i + 1} returns ${currentColumns.length} columns, but first SELECT returns ${firstSelectColumns.length} columns`);
      }

      // Execute individual SELECT
      const selectResults = this.executeSelect(selectAst, worksheetData);

      // Normalize column names to match first SELECT
      const normalizedResults = selectResults.map(row => {
        const normalizedRow: any = {};
        const keys = Object.keys(row);

        for (let j = 0; j < firstSelectColumns.length; j++) {
          const sourceKey = keys[j];
          const targetKey = firstSelectColumns[j];
          if (sourceKey && targetKey) {
            normalizedRow[targetKey] = row[sourceKey];
          }
        }
        return normalizedRow;
      });

      allResults = allResults.concat(normalizedResults);
    }

    // Apply UNION or UNION ALL logic
    if (ast.set_op === 'union') { // UNION (deduplication)
      // Remove duplicates
      const seen = new Set<string>();
      const deduplicatedResults: any[] = [];

      for (const row of allResults) {
        const rowKey = JSON.stringify(row);
        if (!seen.has(rowKey)) {
          seen.add(rowKey);
          deduplicatedResults.push(row);
        }
      }
      return deduplicatedResults;
    } else { // UNION ALL (keep duplicates)
      return allResults;
    }
  }

  /**
   * Get column names from SELECT statement
   */
  private getSelectColumns(selectAst: any): string[] {
    const columns: string[] = [];

    for (const column of selectAst.columns) {
      if (column.expr && column.expr.column) {
        const colName = column.expr.column;
        const alias = column.as || colName;
        columns.push(alias);
      } else if (column.expr && column.expr.type === 'column_ref') {
        const colName = column.expr.column;
        const alias = column.as || colName;
        columns.push(alias);
      } else if (column.type === 'column_ref') {
        const colName = column.column;
        const alias = column.as || colName;
        columns.push(alias);
      } else {
        // Wildcard or other expressions
        columns.push('*');
      }
    }

    return columns;
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
    
    // Process JOIN operations - check all tables for join clauses
    for (let i = 1; i < fromClauses.length; i++) {
      const joinTable = fromClauses[i];
      const rightTableName = joinTable.table;
      const rightTableAlias = joinTable.as || rightTableName;
      const rightTableData = worksheetData.get(rightTableName);
      
      if (!rightTableData) {
        throw new Error(`Worksheet "${rightTableName}" does not exist`);
      }
      
      tableAliasMap.set(rightTableAlias, rightTableName);
      
      // Perform the join
      result = this.performJoin(result, rightTableData, joinTable, firstTableAlias, rightTableAlias, tableAliasMap);
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
    // Normalize join type to canonical tokens
    const rawJoin = (joinClause.join?.toUpperCase?.() || 'INNER').trim();
    let joinType: string = 'INNER';
    if (rawJoin.includes('CROSS')) {
      joinType = 'CROSS JOIN';
    } else if (rawJoin.includes('INNER')) {
      joinType = 'INNER';
    } else if (rawJoin.includes('LEFT')) {
      joinType = 'LEFT';
    } else if (rawJoin.includes('RIGHT')) {
      joinType = 'RIGHT';
    } else if (rawJoin.includes('FULL')) {
      // Support FULL JOIN / FULL OUTER JOIN
      joinType = 'FULL OUTER';
    } else {
      // Fallback to raw value
      joinType = rawJoin;
    }
    
    // Handle CROSS JOIN - return Cartesian product of both tables
    if (joinType === 'CROSS JOIN') {
      for (const leftRow of leftData) {
        for (const rightRow of rightData) {
          // Add table prefix to right table columns
          const prefixedRightRow: any = {};
          for (const [key, value] of Object.entries(rightRow)) {
            prefixedRightRow[`${rightAlias}.${key}`] = value;
            // Also keep original column name for backward compatibility
            prefixedRightRow[key] = value;
          }
          
          // Combine left and right rows (Cartesian product)
          const combinedRow = { ...leftRow, ...prefixedRightRow };
          result.push(combinedRow);
        }
      }
      return result;
    }
    
    // For INNER JOIN and LEFT JOIN, use the existing logic
    if (joinType === 'INNER' || joinType === 'LEFT') {
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
    } else if (joinType === 'RIGHT') {
      // For RIGHT JOIN, reverse the logic and include unmatched right rows
      for (const rightRow of rightData) {
        let hasMatch = false;
        
        for (const leftRow of leftData) {
          // Add table prefix to right table columns
          const prefixedRightRow: any = {};
          for (const [key, value] of Object.entries(rightRow)) {
            prefixedRightRow[`${rightAlias}.${key}`] = value;
            prefixedRightRow[key] = value;
          }
          
          // Evaluate JOIN condition
          const combinedRow = { ...leftRow, ...prefixedRightRow };
          
          if (this.evaluateCondition(combinedRow, joinClause.on, tableAliasMap)) {
            result.push(combinedRow);
            hasMatch = true;
          }
        }
        
        // For RIGHT JOIN, include unmatched right rows with null values for left table
        if (!hasMatch) {
          const nullLeftRow: any = {};
          // Add null values for all left table columns
          if (leftData.length > 0) {
            for (const key of Object.keys(leftData[0])) {
              nullLeftRow[`${leftAlias}.${key}`] = null;
              nullLeftRow[key] = null;
            }
          }
          
          // Add table prefix to right table columns
          const prefixedRightRow: any = {};
          for (const [key, value] of Object.entries(rightRow)) {
            prefixedRightRow[`${rightAlias}.${key}`] = value;
            prefixedRightRow[key] = value;
          }
          
          result.push({ ...nullLeftRow, ...prefixedRightRow });
        }
      }
    } else if (joinType === 'FULL OUTER') {
      // For FULL OUTER JOIN, we need to handle both matched and unmatched rows from both sides
      const matchedLeftRows = new Set<number>();
      const matchedRightRows = new Set<number>();
      
      // First, process all matches
      for (let leftIndex = 0; leftIndex < leftData.length; leftIndex++) {
        const leftRow = leftData[leftIndex];
        let hasMatch = false;
        
        for (let rightIndex = 0; rightIndex < rightData.length; rightIndex++) {
          const rightRow = rightData[rightIndex];
          
          // Add table prefix to right table columns
          const prefixedRightRow: any = {};
          for (const [key, value] of Object.entries(rightRow)) {
            prefixedRightRow[`${rightAlias}.${key}`] = value;
            prefixedRightRow[key] = value;
          }
          
          // Evaluate JOIN condition
          const combinedRow = { ...leftRow, ...prefixedRightRow };
          
          if (this.evaluateCondition(combinedRow, joinClause.on, tableAliasMap)) {
            result.push(combinedRow);
            hasMatch = true;
            matchedLeftRows.add(leftIndex);
            matchedRightRows.add(rightIndex);
          }
        }
        
        if (!hasMatch) {
          // Unmatched left row - include with null right columns
          const nullRightRow: any = {};
          if (rightData.length > 0) {
            for (const key of Object.keys(rightData[0])) {
              nullRightRow[`${rightAlias}.${key}`] = null;
              nullRightRow[key] = null;
            }
          }
          result.push({ ...leftRow, ...nullRightRow });
          matchedLeftRows.add(leftIndex);
        }
      }
      
      // Now add unmatched right rows
      for (let rightIndex = 0; rightIndex < rightData.length; rightIndex++) {
        if (!matchedRightRows.has(rightIndex)) {
          const rightRow = rightData[rightIndex];
          
          // Add null left columns
          const nullLeftRow: any = {};
          if (leftData.length > 0) {
            for (const key of Object.keys(leftData[0])) {
              nullLeftRow[`${leftAlias}.${key}`] = null;
              nullLeftRow[key] = null;
            }
          }
          
          // Add table prefix to right table columns
          const prefixedRightRow: any = {};
          for (const [key, value] of Object.entries(rightRow)) {
            prefixedRightRow[`${rightAlias}.${key}`] = value;
            prefixedRightRow[key] = value;
          }
          
          result.push({ ...nullLeftRow, ...prefixedRightRow });
        }
      }
    } else {
      throw new Error(`Unsupported JOIN type: ${rawJoin}`);
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
      case 'double_quote_string':
        // Handle double-quoted identifiers (ANSI SQL standard)
        // This should be treated as a column reference, not a string literal
        const quotedColumnName = expr.value;
        // Handle table alias in double-quoted identifier
        if (expr.table && tableAliasMap) {
          const tableAlias = expr.table;

          // Try prefixed column name first (for JOIN results)
          const prefixedColumnName = `${tableAlias}.${quotedColumnName}`;
          if (row.hasOwnProperty(prefixedColumnName)) {
            return row[prefixedColumnName];
          }

          // Fall back to original column name
          return row[quotedColumnName];
        }
        return row[quotedColumnName];
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
      case 'cast':
        // Row-level CAST support
        {
          const innerVal = this.getValueFromExpression(row, expr.expr, tableAliasMap);
          const target = Array.isArray(expr.target) && expr.target.length > 0 ? expr.target[0].dataType?.toUpperCase?.() : undefined;
          if (!target) return innerVal;
          const numTypes = new Set(['DOUBLE','FLOAT','REAL','NUMERIC','DECIMAL']);
          const intTypes = new Set(['INTEGER','INT','BIGINT','SMALLINT','TINYINT']);
          if (numTypes.has(target)) return Number(innerVal);
          if (intTypes.has(target)) return parseInt(String(innerVal), 10);
          if (target === 'BOOLEAN') return Boolean(innerVal);
          if (target === 'CHAR' || target === 'VARCHAR' || target === 'TEXT' || target === 'NVARCHAR') return String(innerVal);
          return innerVal;
        }
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
      case 'case':
        // Row-level CASE evaluation (for non-aggregate paths)
        if (Array.isArray(expr.args)) {
          let elseResultNode: any | undefined = undefined;
          const hasCondShape = expr.args.some((w: any) => 'cond' in w && 'result' in w);
          const hasValueShape = expr.args.some((w: any) => 'value' in w && 'result' in w);
          if (hasCondShape) {
            for (const w of expr.args) {
              if (w && 'cond' in w && 'result' in w) {
                const condVal = this.getValueFromExpression(row, w.cond, tableAliasMap);
                if (condVal) {
                  return this.getValueFromExpression(row, w.result, tableAliasMap);
                }
              } else if (w && w.type === 'else' && 'result' in w) {
                elseResultNode = w.result;
              }
            }
            return elseResultNode ? this.getValueFromExpression(row, elseResultNode, tableAliasMap) : (expr.else ? this.getValueFromExpression(row, expr.else, tableAliasMap) : null);
          } else if (hasValueShape) {
            const baseVal = expr.expr ? this.getValueFromExpression(row, expr.expr, tableAliasMap) : undefined;
            for (const w of expr.args) {
              if (w && 'value' in w && 'result' in w) {
                const whenVal = this.getValueFromExpression(row, w.value, tableAliasMap);
                if (baseVal === whenVal) {
                  return this.getValueFromExpression(row, w.result, tableAliasMap);
                }
              } else if (w && w.type === 'else' && 'result' in w) {
                elseResultNode = w.result;
              }
            }
            return elseResultNode ? this.getValueFromExpression(row, elseResultNode, tableAliasMap) : (expr.else ? this.getValueFromExpression(row, expr.else, tableAliasMap) : null);
          }
        }
        return expr.else ? this.getValueFromExpression(row, expr.else, tableAliasMap) : null;
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
        // Handle double_quote_string type in GROUP BY
        if (col.type === 'double_quote_string') {
          return this.getValueFromExpression(row, { type: 'double_quote_string', value: col.value || columnName }, tableAliasMap);
        }
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
  private applyOrderBy(data: any[], orderByColumns: any[], tableAliasMap?: Map<string, string>, selectColumns?: any[]): any[] {
    const isNumericLike = (v: any) => {
      if (v === null || v === undefined) return false;
      if (typeof v === 'number') return true;
      if (typeof v === 'string') {
        // Allow integers and decimals, optional leading/trailing spaces
        const s = v.trim();
        return s !== '' && /^-?\d+(\.\d+)?$/.test(s);
      }
      return false;
    };

    const coerceComparable = (aVal: any, bVal: any) => {
      // If both values are numeric-like, compare numerically
      if (isNumericLike(aVal) && isNumericLike(bVal)) {
        return [Number(aVal), Number(bVal)];
      }
      return [aVal, bVal];
    };

    // Build alias mapping from SELECT columns if provided
    const aliasMap = new Map<string, any>();
    if (selectColumns) {
      for (const col of selectColumns) {
        if (col.as) {
          aliasMap.set(col.as, col.expr);
        }
      }
    }

    return data.sort((a, b) => {
      for (const order of orderByColumns) {
        let expr = order.expr;
        
        // Check if ORDER BY references an alias
        if (expr.type === 'column_ref' && aliasMap.has(expr.column)) {
          expr = aliasMap.get(expr.column);
        }
        
        const rawA = this.getValueFromExpression(a, expr, tableAliasMap);
        const rawB = this.getValueFromExpression(b, expr, tableAliasMap);
        const [aVal, bVal] = coerceComparable(rawA, rawB);

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
            const val = this.getValueFromExpression(row, col.expr, tableAliasMap);
            newRow[alias] = (val === undefined) ? null : val;
          }
        } else if (col.expr.type === 'number' || col.expr.type === 'string') {
          const alias = col.as || col.expr.value;
          newRow[alias] = col.expr.value;
        } else {
          // Handle other expression types (functions, binary expressions, etc.)
          const alias = col.as || 'expr';
          const val = this.getValueFromExpression(row, col.expr, tableAliasMap);
          newRow[alias] = (val === undefined) ? null : val;
        }
      }
      return newRow;
    });
  }

  /**
   * Apply aggregate functions (non-GROUP BY case)
   */
  private applyAggregateFunction(data: any[], columns: any[], tableAliasMap?: Map<string, string>): any[] {
    // Only apply when SELECT list contains aggregates only (no raw column_ref etc.)
    const hasAggregateFunction = columns.some(col => col.expr && (col.expr.type === 'aggr_func' || this.isExprAggregatesOnly(col.expr)));
    const aggregatesOnly = columns.every(col => this.isExprAggregatesOnly(col.expr));

    // If there are no aggregate functions OR select contains non-aggregate expressions, keep original data
    if (!hasAggregateFunction || !aggregatesOnly) {
      return data;
    }

    // Collect all aggregate expressions from select list
    const aggSet: Set<any> = new Set();
    for (const col of columns) {
      this.collectAggregateExprs(col.expr, aggSet);
    }

    // Compute aggregates over the loaded data
    const aggregatedMap: Map<any, number> = new Map();
    const counters: Map<any, { func: string, sum?: number, count?: number, max?: number, min?: number }>= new Map();
    for (const aggrExpr of aggSet) {
      const funcName = (aggrExpr.name?.toUpperCase?.() || aggrExpr.name?.name?.[0]?.value?.toUpperCase?.()) || 'SUM';
      const state: any = { func: funcName };
      if (funcName === 'SUM' || funcName === 'AVG') state.sum = 0;
      if (funcName === 'AVG' || funcName === 'COUNT') state.count = 0;
      if (funcName === 'MAX') state.max = Number.NEGATIVE_INFINITY;
      if (funcName === 'MIN') state.min = Number.POSITIVE_INFINITY;
      counters.set(aggrExpr, state);
    }

    // Traverse data and update counters
    for (const row of data) {
      for (const [aggrExpr, state] of counters.entries()) {
        const func = state.func;
        let argExpr: any = aggrExpr.args?.expr;
        if (!argExpr && aggrExpr.args?.value?.length > 0) argExpr = aggrExpr.args.value[0];

        if (func === 'COUNT') {
          if (aggrExpr.args?.expr?.type === 'star') {
            state.count = (state.count || 0) + 1;
          } else {
            const val = this.getValueFromExpression(row, argExpr, tableAliasMap);
            if (val !== null && val !== undefined && val !== '') {
              state.count = (state.count || 0) + 1;
            }
          }
          aggregatedMap.set(aggrExpr, state.count || 0);
        } else if (func === 'SUM' || func === 'AVG') {
          const v = this.getValueFromExpression(row, argExpr, tableAliasMap);
          const num = Number(v);
          if (!isNaN(num)) {
            state.sum = (state.sum || 0) + num;
            if (func === 'AVG') state.count = (state.count || 0) + 1;
            aggregatedMap.set(aggrExpr, func === 'AVG' ? ((state.sum || 0) / (state.count || 1)) : (state.sum || 0));
          }
        } else if (func === 'MAX') {
          const v = this.getValueFromExpression(row, argExpr, tableAliasMap);
          const num = Number(v);
          if (!isNaN(num)) {
            state.max = Math.max(state.max ?? Number.NEGATIVE_INFINITY, num);
            aggregatedMap.set(aggrExpr, state.max ?? null);
          }
        } else if (func === 'MIN') {
          const v = this.getValueFromExpression(row, argExpr, tableAliasMap);
          const num = Number(v);
          if (!isNaN(num)) {
            state.min = Math.min(state.min ?? Number.POSITIVE_INFINITY, num);
            aggregatedMap.set(aggrExpr, state.min ?? null);
          }
        } else if (func === 'DISTINCT') {
          // For DISTINCT, collect values into a set and store set size
          const v = this.getValueFromExpression(row, argExpr, tableAliasMap);
          const key = aggrExpr;
          const existingSet: Set<any> = (aggregatedMap.get(key) as any) || new Set<any>();
          existingSet.add(v);
          aggregatedMap.set(key, existingSet as any);
        } else {
          throw new Error(`Unsupported aggregate function: ${func}`);
        }
      }
    }

    // For DISTINCT, convert Set to array
    for (const [aggrExpr, val] of aggregatedMap.entries()) {
      const funcName = (aggrExpr.name?.toUpperCase?.() || aggrExpr.name?.name?.[0]?.value?.toUpperCase?.()) || '';
      if (funcName === 'DISTINCT' && val && (val as any as Set<any>).size !== undefined) {
        const arr = Array.from(val as any as Set<any>);
        aggregatedMap.set(aggrExpr, arr as any);
      }
    }

    // Compose final single-row result according to select columns
    const resultRow: any = {};
    for (const col of columns) {
      // Determine alias: prefer explicit alias; for aggregates, use COUNT(*) for star; otherwise function name
      let alias: string = 'expr';
      if (col.as) {
        alias = col.as;
      } else if (col.expr?.type === 'aggr_func') {
        const funcName = (col.expr.name?.toUpperCase?.() || col.expr.name) as string;
        const isStar = !!(col.expr?.args?.expr?.type === 'star' || col.expr?.args?.value?.[0]?.type === 'star');
        if (funcName?.toUpperCase?.() === 'COUNT' && isStar) {
          alias = 'COUNT(*)';
        } else {
          alias = funcName;
        }
      }
      resultRow[alias] = this.evaluateAggregatedExpression(col.expr, aggregatedMap);
    }
    return [resultRow];
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

  /**
   * Validate field existence for single table queries
   */
  private validateFieldExistence(ast: any, tableName: string, data: any[], tableAliasMap: Map<string, string>): void {
    if (!data || data.length === 0) {
      return; // No data to validate against
    }

    const availableColumns = new Set(Object.keys(data[0]));
    const fieldsToValidate: Array<{field: string, context: string}> = [];
    // Build alias set from SELECT list so ORDER BY can reference them
    const selectAliases = new Set<string>();
    if (ast.columns) {
      for (const col of ast.columns) {
        if (col && col.as) {
          selectAliases.add(col.as);
        } else if (col && col.expr && col.expr.type === 'column_ref' && col.expr.column) {
          // A bare column may also be referenced as-is in ORDER BY; include for completeness
          selectAliases.add(col.expr.column);
        }
      }
    }

    // Collect fields from SELECT columns
    // Note: Do NOT validate fields from SELECT list.
    // Rationale: Per test requirements (F-12), selecting a non-existent column should yield nulls rather than throw.
    // We therefore intentionally skip adding SELECT fields to validation to allow flexible projection.

    // Collect fields from WHERE clause
    if (ast.where) {
      this.collectFieldsFromCondition(ast.where, tableName, fieldsToValidate);
    }

    // Collect fields from ORDER BY
    if (ast.orderby) {
      for (const order of ast.orderby) {
        this.collectFieldsFromExpression(order.expr, tableName, fieldsToValidate, 'ORDER BY');
      }
    }

    // Collect fields from GROUP BY
    if (ast.groupby && ast.groupby.columns) {
      for (const group of ast.groupby.columns) {
        this.collectFieldsFromExpression(group, tableName, fieldsToValidate, 'GROUP BY');
      }
    }

    // Validate all collected fields
    for (const {field, context} of fieldsToValidate) {
      // Allow ORDER BY to reference SELECT aliases
      if (context === 'ORDER BY' && selectAliases.has(field)) {
        continue;
      }
      if (field !== '*' && !field.includes('.') && !availableColumns.has(field)) {
        throw new Error(`Field "${field}" does not exist in table "${tableName}"`);
      }
    }
  }

  /**
   * Validate field existence for JOIN queries
   */
  private validateJoinFieldExistence(ast: any, tableAliasMap: Map<string, string>, worksheetData: Map<string, any[]>): void {
    const tableColumns = new Map<string, Set<string>>();

    // Build column sets for each table
    for (const [alias, tableName] of tableAliasMap) {
      const sheetData = worksheetData.get(tableName);
      if (sheetData && sheetData.length > 0) {
        tableColumns.set(alias, new Set(Object.keys(sheetData[0])));
      }
    }

    const fieldsToValidate: Array<{field: string, tableAlias: string, context: string}> = [];
    // Build alias set from SELECT list so ORDER BY can reference them
    const selectAliases = new Set<string>();
    if (ast.columns) {
      for (const col of ast.columns) {
        if (col && col.as) {
          selectAliases.add(col.as);
        } else if (col && col.expr && col.expr.type === 'column_ref' && col.expr.column) {
          selectAliases.add(col.expr.column);
        }
      }
    }

    // Collect fields from SELECT columns
    // Skip validating SELECT list fields (see rationale in single-table variant)

    // Collect fields from WHERE clause
    if (ast.where) {
      this.collectJoinFieldsFromCondition(ast.where, fieldsToValidate);
    }

    // Collect fields from ORDER BY
    if (ast.orderby) {
      for (const order of ast.orderby) {
        this.collectJoinFieldsFromExpression(order.expr, fieldsToValidate, 'ORDER BY');
      }
    }

    // Collect fields from GROUP BY
    if (ast.groupby && ast.groupby.columns) {
      for (const group of ast.groupby.columns) {
        this.collectJoinFieldsFromExpression(group, fieldsToValidate, 'GROUP BY');
      }
    }

    // Validate all collected fields
    for (const {field, tableAlias, context} of fieldsToValidate) {
      // Allow ORDER BY to reference SELECT aliases (no tableAlias)
      if (context === 'ORDER BY' && (!tableAlias || tableAlias === '') && selectAliases.has(field)) {
        continue;
      }
      if (field !== '*' && tableAlias && tableColumns.has(tableAlias)) {
        const columns = tableColumns.get(tableAlias)!;
        if (!columns.has(field)) {
          const tableName = tableAliasMap.get(tableAlias);
          throw new Error(`Field "${field}" does not exist in table "${tableName}"`);
        }
      }
    }
  }

  /**
   * Collect fields from expression for validation
   */
  private collectFieldsFromExpression(expr: any, tableName: string, fieldsToValidate: Array<{field: string, context: string}>, context: string): void {
    if (!expr) return;

    switch (expr.type) {
      case 'column_ref':
        if (expr.column && expr.column !== '*' && !expr.table) {
          fieldsToValidate.push({field: expr.column, context});
        }
        break;
      case 'double_quote_string':
        // Double-quoted identifiers are treated as column references
        if (expr.value && !expr.table) {
          fieldsToValidate.push({field: expr.value, context});
        }
        break;
      case 'function':
        // Collect fields from function arguments
        const args = expr.args?.value || (expr.args?.expr ? [expr.args.expr] : []);
        for (const arg of args) {
          this.collectFieldsFromExpression(arg, tableName, fieldsToValidate, context);
        }
        break;
      case 'binary_expr':
        // Collect fields from binary expressions
        this.collectFieldsFromExpression(expr.left, tableName, fieldsToValidate, context);
        this.collectFieldsFromExpression(expr.right, tableName, fieldsToValidate, context);
        break;
    }
  }

  /**
   * Collect fields from expression for JOIN validation
   */
  private collectJoinFieldsFromExpression(expr: any, fieldsToValidate: Array<{field: string, tableAlias: string, context: string}>, context: string): void {
    if (!expr) return;

    switch (expr.type) {
      case 'column_ref':
        if (expr.column && expr.column !== '*') {
          fieldsToValidate.push({field: expr.column, tableAlias: expr.table || '', context});
        }
        break;
      case 'double_quote_string':
        // Double-quoted identifiers are treated as column references
        if (expr.value) {
          fieldsToValidate.push({field: expr.value, tableAlias: expr.table || '', context});
        }
        break;
      case 'function':
        // Collect fields from function arguments
        const args = expr.args?.value || (expr.args?.expr ? [expr.args.expr] : []);
        for (const arg of args) {
          this.collectJoinFieldsFromExpression(arg, fieldsToValidate, context);
        }
        break;
      case 'binary_expr':
        // Collect fields from binary expressions
        this.collectJoinFieldsFromExpression(expr.left, fieldsToValidate, context);
        this.collectJoinFieldsFromExpression(expr.right, fieldsToValidate, context);
        break;
    }
  }

  /**
   * Collect fields from condition for validation
   */
  private collectFieldsFromCondition(condition: any, tableName: string, fieldsToValidate: Array<{field: string, context: string}>): void {
    if (!condition) return;

    switch (condition.type) {
      case 'binary_expr':
        this.collectFieldsFromExpression(condition.left, tableName, fieldsToValidate, 'WHERE');
        this.collectFieldsFromExpression(condition.right, tableName, fieldsToValidate, 'WHERE');
        break;
      case 'unary_expr':
        this.collectFieldsFromExpression(condition.expr, tableName, fieldsToValidate, 'WHERE');
        break;
      case 'function':
        this.collectFieldsFromExpression(condition, tableName, fieldsToValidate, 'WHERE');
        break;
    }
  }

  /**
   * Collect fields from condition for JOIN validation
   */
  private collectJoinFieldsFromCondition(condition: any, fieldsToValidate: Array<{field: string, tableAlias: string, context: string}>): void {
    if (!condition) return;

    switch (condition.type) {
      case 'binary_expr':
        this.collectJoinFieldsFromExpression(condition.left, fieldsToValidate, 'WHERE');
        this.collectJoinFieldsFromExpression(condition.right, fieldsToValidate, 'WHERE');
        break;
      case 'unary_expr':
        this.collectJoinFieldsFromExpression(condition.expr, fieldsToValidate, 'WHERE');
        break;
      case 'function':
        this.collectJoinFieldsFromExpression(condition, fieldsToValidate, 'WHERE');
        break;
    }
  }

  /**
   * Apply LIMIT clause
   */
  private applyLimit(data: any[], limitClause: any): any[] {
    if (!limitClause) {
      return data;
    }

    let limit: number;
    let offset: number = 0;

    // Handle different LIMIT clause structures based on node-sql-parser output
    if (limitClause.value && Array.isArray(limitClause.value)) {
      const values = limitClause.value;

      if (limitClause.seperator === '') {
        // Simple LIMIT n: { seperator: '', value: [{ type: 'number', value: 5 }] }
        if (values.length === 1 && values[0].type === 'number') {
          limit = values[0].value;
        } else {
          console.warn('⚠️  Unsupported simple LIMIT structure:', JSON.stringify(limitClause));
          return data;
        }
      } else if (limitClause.seperator === 'offset') {
        // LIMIT n OFFSET m: { seperator: 'offset', value: [{ type: 'number', value: 2 }, { type: 'number', value: 3 }] }
        // First value is limit, second is offset
        if (values.length === 2 && values[0].type === 'number' && values[1].type === 'number') {
          limit = values[0].value;
          offset = values[1].value;
        } else {
          console.warn('⚠️  Unsupported OFFSET LIMIT structure:', JSON.stringify(limitClause));
          return data;
        }
      } else if (limitClause.seperator === ',') {
        // MySQL style LIMIT offset, count: { seperator: ',', value: [{ type: 'number', value: 2 }, { type: 'number', value: 3 }] }
        // First value is offset, second is limit
        if (values.length === 2 && values[0].type === 'number' && values[1].type === 'number') {
          offset = values[0].value;
          limit = values[1].value;
        } else {
          console.warn('⚠️  Unsupported comma LIMIT structure:', JSON.stringify(limitClause));
          return data;
        }
      } else {
        console.warn('⚠️  Unknown LIMIT seperator:', limitClause.seperator);
        return data;
      }
    } else {
      console.warn('⚠️  Unsupported LIMIT clause structure:', JSON.stringify(limitClause));
      return data;
    }

    // Ensure limit and offset are non-negative integers
    limit = Math.max(0, Math.floor(limit));
    offset = Math.max(0, Math.floor(offset));

    // Apply limit and offset
    if (offset >= data.length) {
      // Offset is beyond data length, return empty array
      return [];
    }

    const endIndex = Math.min(data.length, offset + limit);
    return data.slice(offset, endIndex);
  }
}