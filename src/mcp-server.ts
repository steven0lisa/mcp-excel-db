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
 * MCP Server for Excel SQL querying
 */
export class ExcelMcpServer {
  private server: Server;
  private excelQuery: ExcelSqlQuery;

  constructor() {
    this.server = new Server(
      {
        name: 'excel-sql-query',
        version: '1.0.1',
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
            name: 'execute_sql_query',
            description: 'Execute SQL query on an Excel file',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'Path to the Excel file',
                },
                sql: {
                  type: 'string',
                  description: 'SQL query to execute (SELECT statements only)',
                },
              },
              required: ['filePath', 'sql'],
            },
          },
          {
            name: 'get_worksheet_info',
            description: 'Get information about worksheets in an Excel file',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'Path to the Excel file',
                },
              },
              required: ['filePath'],
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
          case 'execute_sql_query':
            return await this.handleExecuteSqlQuery(args as { filePath: string; sql: string });

          case 'get_worksheet_info':
            return await this.handleGetWorksheetInfo(args as { filePath: string });

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

  private async handleExecuteSqlQuery(args: { filePath: string; sql: string }) {
    const { filePath, sql } = args;

    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Validate file extension
    const ext = path.extname(filePath).toLowerCase();
    if (!['.xlsx', '.xls'].includes(ext)) {
      throw new Error(`Unsupported file format: ${ext}. Only .xlsx and .xls files are supported.`);
    }

    const results = await this.excelQuery.executeQuery(sql, filePath);

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
        const values = columns.map((col: string) => {
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

  private async handleGetWorksheetInfo(args: { filePath: string }) {
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

    const worksheetInfo = await this.excelQuery.getWorksheetInfo(filePath);
    let output = `📋 Worksheet Information for: ${path.basename(filePath)}\n\n`;
    
    for (const info of worksheetInfo) {
      output += `**${info.table_name}**\n`;
      output += `- Rows: ${info.row_count}\n\n`;
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