# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Excel DB is a TypeScript/Node.js project that implements a Model Context Protocol (MCP) server for querying Excel files using SQL syntax. Published as `@zhangzichao2008/mcp-excel-db` on npm.

## Development Commands

```bash
# Build and development
npm run build          # Compile TypeScript to dist/
npm run dev            # Run development server with ts-node
npm run start          # Run compiled server
npm run clean          # Remove dist directory

# Testing
npm test               # Run Jest unit tests
npm run test:features  # Run comprehensive feature tests (node test/test.js)
npm run test:watch     # Run Jest in watch mode
npm run test:coverage  # Run tests with coverage report
```

## Architecture

### Core Components
- `src/mcp-server.ts`: MCP server implementation providing SQL query tools
- `src/excel-sql-query.ts`: Core SQL query engine (45KB) - transforms Excel data and executes SQL

### Key Dependencies
- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `exceljs`: Excel file parsing
- `node-sql-parser`: SQL parsing and validation

## Language Standards & Project Rules

### 语言规范
- 代码、注释、主要文档：英文
- `doc/zh-cn` 目录：中文
- 问答沟通：中文

### 功能变更要求
- 同步更新 README.md 和 `doc/zh-cn` 文档
- 增加对应测试用例

### 特性管理规范

#### 特性编号规则
- 所有SQL功能特性采用F(Feature)编号系统，如F-1、F-2等
- 特性编号按实现顺序递增，不可重复使用
- 每个特性必须有完整的文档和测试用例

#### 文档管理
- 特性文档统一存放在 `doc/feature/` 目录
- 文档命名格式：`F-{编号}.md`，如 `F-1.md`
- 文档内容必须包括：特性描述、语法支持、使用示例、实现细节、测试用例位置

#### 测试用例管理
- 测试用例统一存放在 `test/test-case/` 目录
- 测试文件命名格式：`tc-f-{编号}.js`，如 `tc-f-1.js`
- 每个特性必须有完整的测试覆盖：基本功能、边界条件、错误处理、集成测试

#### 新特性开发流程
1. 分配特性编号（查看现有最大编号+1）
2. 在 `doc/feature/` 创建特性文档
3. 在 `test/test-case/` 创建测试用例
4. 实现特性功能
5. 运行 `node test/test.js` 验证所有测试通过
6. 更新相关文档（README.md等）

## SQL Features Implementation

The project supports comprehensive SQL operations on Excel data:
- Basic SELECT with WHERE clauses
- JOIN operations (LEFT, INNER, RIGHT, FULL OUTER, CROSS)
- Aggregation functions (COUNT, SUM, AVG, MAX, MIN)
- String functions (LENGTH, UPPER, LOWER, TRIM, SUBSTR, INSTR, REPLACE)
- Math functions (ABS, ROUND, CEIL, FLOOR, RANDOM)

## Testing Strategy

- **Feature Tests**: Custom test runner (`node test/test.js`) for comprehensive feature validation
- **Unit Tests**: Jest tests in `test/test-new-features.ts`
- **Test Data**: Excel files in `test/` directory for consistent testing

## Release Process

GitHub Actions automates releases on version tags (`v*`):
1. Build and test validation
2. Changelog generation
3. Release creation with comprehensive notes