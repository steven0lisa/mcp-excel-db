import { ExcelMcpServer } from '../src/mcp-server';
import * as fs from 'fs';
import * as path from 'path';

describe('ExcelMcpServer', () => {
  let server: ExcelMcpServer;
  const testExcelPath = path.join(__dirname, 'test-data.xlsx');

  beforeEach(() => {
    server = new ExcelMcpServer();
  });

  afterEach(() => {
    // Clean up test files if they exist
    if (fs.existsSync(testExcelPath)) {
      fs.unlinkSync(testExcelPath);
    }
  });

  describe('Tool Registration', () => {
    test('should register all required tools', () => {
      const tools = server.getTools();
      const toolNames = tools.map(tool => tool.name);
      
      expect(toolNames).toContain('load_excel_file');
      expect(toolNames).toContain('execute_sql_query');
      expect(toolNames).toContain('get_worksheet_info');
      expect(toolNames).toContain('get_worksheet_columns');
    });

    test('should have correct tool schemas', () => {
      const tools = server.getTools();
      const loadExcelTool = tools.find(tool => tool.name === 'load_excel_file');
      
      expect(loadExcelTool).toBeDefined();
      expect(loadExcelTool?.inputSchema.properties).toHaveProperty('filePath');
      expect(loadExcelTool?.inputSchema.properties.filePath.type).toBe('string');
    });
  });

  describe('Excel File Loading', () => {
    test('should handle non-existent file', async () => {
      const result = await server.handleToolCall('load_excel_file', {
        filePath: '/non/existent/file.xlsx'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error loading Excel file');
    });

    test('should handle invalid file format', async () => {
      // Create a dummy text file with .xlsx extension
      const invalidFile = path.join(__dirname, 'invalid.xlsx');
      fs.writeFileSync(invalidFile, 'This is not an Excel file');

      const result = await server.handleToolCall('load_excel_file', {
        filePath: invalidFile
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error loading Excel file');

      // Clean up
      fs.unlinkSync(invalidFile);
    });
  });

  describe('SQL Query Execution', () => {
    test('should handle query without loaded file', async () => {
      const result = await server.handleToolCall('execute_sql_query', {
        sql: 'SELECT * FROM Sheet1'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No Excel file loaded');
    });

    test('should handle invalid SQL syntax', async () => {
      // First load a dummy file (we'll mock this)
      server['excelQuery'] = {
        executeQuery: jest.fn().mockRejectedValue(new Error('Invalid SQL syntax'))
      } as any;

      const result = await server.handleToolCall('execute_sql_query', {
        sql: 'INVALID SQL QUERY'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error executing SQL query');
    });
  });

  describe('Worksheet Information', () => {
    test('should handle get_worksheet_info without loaded file', async () => {
      const result = await server.handleToolCall('get_worksheet_info', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No Excel file loaded');
    });

    test('should handle get_worksheet_columns without loaded file', async () => {
      const result = await server.handleToolCall('get_worksheet_columns', {
        worksheetName: 'Sheet1'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No Excel file loaded');
    });
  });

  describe('Unknown Tool Handling', () => {
    test('should handle unknown tool calls', async () => {
      const result = await server.handleToolCall('unknown_tool', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool');
    });
  });
});

// Mock jest functions if not available
if (typeof jest === 'undefined') {
  global.jest = {
    fn: () => ({
      mockRejectedValue: (value: any) => Promise.reject(value),
      mockResolvedValue: (value: any) => Promise.resolve(value)
    })
  } as any;
  
  global.describe = (name: string, fn: () => void) => {
    console.log(`Running test suite: ${name}`);
    fn();
  };
  
  global.test = global.it = (name: string, fn: () => void | Promise<void>) => {
    console.log(`Running test: ${name}`);
    try {
      const result = fn();
      if (result instanceof Promise) {
        return result.catch(err => {
          console.error(`Test failed: ${name}`, err);
          throw err;
        });
      }
    } catch (err) {
      console.error(`Test failed: ${name}`, err);
      throw err;
    }
  };
  
  global.beforeEach = (fn: () => void) => fn();
  global.afterEach = (fn: () => void) => fn();
  
  global.expect = (actual: any) => ({
    toBe: (expected: any) => {
      if (actual !== expected) {
        throw new Error(`Expected ${actual} to be ${expected}`);
      }
    },
    toContain: (expected: any) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected ${actual} to contain ${expected}`);
      }
    },
    toBeDefined: () => {
      if (actual === undefined) {
        throw new Error(`Expected ${actual} to be defined`);
      }
    },
    toHaveProperty: (prop: string) => {
      if (!(prop in actual)) {
        throw new Error(`Expected ${actual} to have property ${prop}`);
      }
    }
  });
}