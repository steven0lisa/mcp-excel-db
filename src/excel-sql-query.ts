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
   * Stream load worksheet data for large files using ExcelJS stream API
   */
  private async streamLoadWorksheetData(filePath: string): Promise<Map<string, any[]>> {
    const worksheetData: Map<string, any[]> = new Map();
    
    try {
      const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {});
      let worksheetIndex = 0;
      
      for await (const worksheetReader of workbookReader) {
        worksheetIndex++;
        const worksheetName = `Sheet${worksheetIndex}`;
        const sheetData: any[] = [];
        let headers: string[] = [];
        let rowCount = 0;
        const maxRows = 100000; // Limit rows to prevent memory overflow
        
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

      let worksheetData: Map<string, any[]>;

      if (ext === '.csv') {
        // CSV files: single sheet named "Sheet" with streaming and memory limits
        console.log(`🧾 Detected CSV file. Loading as single worksheet "Sheet"...`);
        const maxRows = fileSizeInMB > 50 ? 100000 : 10000;
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
      
      console.log(`✅ Excel file loaded successfully: ${path.basename(filePath)}`);
      
      // Parse SQL statement
      const ast = this.parser.astify(sql);
      
      // Validate SQL syntax support
      this.validateSqlSupport(ast);

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
        const maxCount = 100000;
        let rowCount = 0;
        const stream = fs.createReadStream(filePath);
        const parser = parse({
          columns: false,
          relax_quotes: true,
          skip_empty_lines: true,
          trim: true,
        });
        stream.pipe(parser);
        try {
          for await (const record of parser) {
            // Skip header row
            if (rowCount === 0) {
              rowCount++; // header
              continue;
            }
            rowCount++;
            if (rowCount > maxCount) {
              rowCount = -1; // too many to count cheaply
              break;
            }
          }
        } catch (e) {
          console.warn(`⚠️  CSV row counting encountered an error: ${e instanceof Error ? e.message : String(e)}`);
        }
        tables.push({
          table_name: 'Sheet',
          rowCount: rowCount > 0 ? rowCount - 1 : undefined,
        });
      } else {
        // Use Excel processing
        // Use stream reading for large files (>50MB) or when regular loading fails
        if (fileSizeInMB > 50) {
          console.log(`🔄 Using stream processing for large file...`);
          
          // Use ExcelJS stream reader for better memory efficiency
          const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
            sharedStrings: 'cache', // Cache shared strings for better performance
            hyperlinks: 'ignore',   // Ignore hyperlinks to save memory
            worksheets: 'emit'      // Emit worksheet events
          });
          
          try {
            let worksheetIndex = 0;
            // Process worksheets using async iteration
            for await (const worksheetReader of workbookReader) {
              worksheetIndex++;
              // WorksheetReader doesn't have a direct name property, use index-based naming
              const worksheetName = `Sheet${worksheetIndex}`;
              let rowCount = 0;
              
              // Count rows by iterating through them (lightweight)
              for await (const row of worksheetReader) {
                rowCount++;
                // For very large files, limit row counting to avoid excessive processing
                if (rowCount > 100000) {
                  rowCount = -1; // Indicate "too many rows to count"
                  break;
                }
              }
              
              tables.push({
                table_name: worksheetName,
                rowCount: rowCount > 0 ? rowCount - 1 : undefined // Subtract header row
              });
              
              console.log(`📋 Found worksheet: "${worksheetName}" ${rowCount > 0 ? `(~${rowCount - 1} rows)` : '(large dataset)'}`);
            }
          } catch (streamError) {
            console.log(`⚠️  Stream processing failed, falling back to standard method...`);
            throw streamError; // Let it fall through to standard method
          }
          
        } else {
          // Use standard method for smaller files
          console.log(`📖 Using standard processing for file...`);
          
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.readFile(filePath);
          
          // Only get worksheet names without loading full data
          workbook.eachSheet((worksheet: any) => {
            tables.push({
              table_name: worksheet.name,
              rowCount: worksheet.rowCount > 0 ? worksheet.rowCount - 1 : 0 // Subtract header row
            });
          });
        }
      }
      
      console.log(`✅ Excel file processed successfully: ${path.basename(filePath)}`);
      console.log(`📋 Found ${tables.length} worksheet(s): ${tables.map(t => `${t.table_name}${t.rowCount !== undefined ? ` (${t.rowCount} rows)` : ''}`).join(', ')}`);
      
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
          const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {});
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
    const joinType = joinClause.join?.toUpperCase() || 'INNER';
    
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
      throw new Error(`Unsupported JOIN type: ${joinType}`);
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
  private applyOrderBy(data: any[], orderByColumns: any[], tableAliasMap?: Map<string, string>): any[] {
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

    return data.sort((a, b) => {
      for (const order of orderByColumns) {
        const rawA = this.getValueFromExpression(a, order.expr, tableAliasMap);
        const rawB = this.getValueFromExpression(b, order.expr, tableAliasMap);
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

  /**
   * Validate field existence for single table queries
   */
  private validateFieldExistence(ast: any, tableName: string, data: any[], tableAliasMap: Map<string, string>): void {
    if (!data || data.length === 0) {
      return; // No data to validate against
    }

    const availableColumns = new Set(Object.keys(data[0]));
    const fieldsToValidate: Array<{field: string, context: string}> = [];

    // Collect fields from SELECT columns
    if (ast.columns) {
      for (const col of ast.columns) {
        this.collectFieldsFromExpression(col.expr, tableName, fieldsToValidate, 'SELECT');
      }
    }

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

    // Collect fields from SELECT columns
    if (ast.columns) {
      for (const col of ast.columns) {
        this.collectJoinFieldsFromExpression(col.expr, fieldsToValidate, 'SELECT');
      }
    }

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