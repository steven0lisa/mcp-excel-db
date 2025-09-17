#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { ExcelSqlQuery } from './excel-sql-query.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * MCP Excel Database Server
 * Provides SQL query capabilities for Excel files
 */
export class ExcelMcpServer {
  private server: Server;
  private excelQuery: ExcelSqlQuery;
  private loadedFile: string | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'excel-db-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.excelQuery = new ExcelSqlQuery();
    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'load_excel_file',
            description: 'Load an Excel file for SQL querying',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'Path to the Excel file to load',
                },
              },
              required: ['filePath'],
            },
          },
          {
            name: 'execute_sql_query',
            description: 'Execute SQL query on the loaded Excel file',
            inputSchema: {
              type: 'object',
              properties: {
                sql: {
                  type: 'string',
                  description: 'SQL query to execute (SELECT statements only)',
                },
              },
              required: ['sql'],
            },
          },
          {
            name: 'get_worksheet_info',
            description: 'Get information about worksheets in the loaded Excel file',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_worksheet_columns',
            description: 'Get column names for a specific worksheet',
            inputSchema: {
              type: 'object',
              properties: {
                worksheetName: {
                  type: 'string',
                  description: 'Name of the worksheet',
                },
              },
              required: ['worksheetName'],
            },
          },
        ] as Tool[],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'load_excel_file':
            return await this.handleLoadExcelFile(args as { filePath: string });

          case 'execute_sql_query':
            return await this.handleExecuteSqlQuery(args as { sql: string });

          case 'get_worksheet_info':
            return await this.handleGetWorksheetInfo();

          case 'get_worksheet_columns':
            return await this.handleGetWorksheetColumns(args as { worksheetName: string });

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleLoadExcelFile(args: { filePath: string }) {
    const { filePath } = args;

    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Validate file extension
    const ext = path.extname(filePath).toLowerCase();
    if (!['.xlsx', '.xls'].includes(ext)) {
      throw new Error(`Unsupported file format: ${ext}. Only .xlsx and .xls files are supported.`);
    }

    await this.excelQuery.loadExcelFile(filePath);
    this.loadedFile = filePath;

    const worksheetNames = this.excelQuery.getWorksheetNames();
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Excel file loaded successfully: ${path.basename(filePath)}\n\nAvailable worksheets:\n${worksheetNames.map(name => `- ${name}`).join('\n')}`,
        },
      ],
    };
  }

  private async handleExecuteSqlQuery(args: { sql: string }) {
    if (!this.loadedFile) {
      throw new Error('No Excel file loaded. Please load a file first using load_excel_file.');
    }

    const { sql } = args;
    const results = await this.excelQuery.executeQuery(sql);

    // Format results as a table
    let output = `📊 Query Results (${results.length} rows):\n\n`;
    
    if (results.length === 0) {
      output += 'No results found.';
    } else {
      // Get column names from first result
      const columns = Object.keys(results[0]);
      
      // Create table header
      output += '| ' + columns.join(' | ') + ' |\n';
      output += '|' + columns.map(() => '---').join('|') + '|\n';
      
      // Add data rows (limit to first 100 rows for readability)
      const displayRows = results.slice(0, 100);
      for (const row of displayRows) {
        const values = columns.map(col => {
          const value = row[col];
          return value === null || value === undefined ? '' : String(value);
        });
        output += '| ' + values.join(' | ') + ' |\n';
      }
      
      if (results.length > 100) {
        output += `\n... and ${results.length - 100} more rows`;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }

  private async handleGetWorksheetInfo() {
    if (!this.loadedFile) {
      throw new Error('No Excel file loaded. Please load a file first using load_excel_file.');
    }

    const worksheetNames = this.excelQuery.getWorksheetNames();
    let output = `📋 Worksheet Information for: ${path.basename(this.loadedFile)}\n\n`;
    
    for (const name of worksheetNames) {
      const rowCount = this.excelQuery.getRowCount(name);
      const columns = this.excelQuery.getColumnNames(name);
      
      output += `**${name}**\n`;
      output += `- Rows: ${rowCount}\n`;
      output += `- Columns: ${columns.length}\n`;
      output += `- Column Names: ${columns.join(', ')}\n\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }

  private async handleGetWorksheetColumns(args: { worksheetName: string }) {
    if (!this.loadedFile) {
      throw new Error('No Excel file loaded. Please load a file first using load_excel_file.');
    }

    const { worksheetName } = args;
    const columns = this.excelQuery.getColumnNames(worksheetName);
    
    if (columns.length === 0) {
      throw new Error(`Worksheet "${worksheetName}" not found or has no columns.`);
    }

    const output = `📋 Columns in worksheet "${worksheetName}":\n\n${columns.map((col, index) => `${index + 1}. ${col}`).join('\n')}`;

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Excel MCP Server running on stdio');
  }
}

// Start the server
const server = new ExcelMcpServer();
server.run().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});