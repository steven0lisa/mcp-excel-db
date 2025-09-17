# 
<h3 align="center">MCP - Excel Database</h3>

<p align="center">
  Make your excel as a database to query with SQL.
  <br>
  <a href="doc/zh-cn/README.md">[<strong>中文</strong>]</a> 
  <br>
  
</p>

[![npm version](https://badge.fury.io/js/%40zhangzichao2008%2Fmcp-excel-db.svg)](https://badge.fury.io/js/%40zhangzichao2008%2Fmcp-excel-db)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[[[[![Tests](https://img.shields.io/badge/tests-4%20passed-brightgreen.svg)](https://github.com/steven0lisa/mcp-excel-db/actions)
[[[[![Coverage](https://img.shields.io/badge/coverage-24.47%-red.svg)](https://github.com/steven0lisa/mcp-excel-db/actions)


A Model Context Protocol (MCP) server that enables SQL querying of Excel files. Transform your Excel spreadsheets into queryable databases using familiar SQL syntax.

## 🚀 Features

- **SQL Query Support**: Execute SELECT queries on Excel worksheets using standard SQL syntax
- **Multiple Worksheet Support**: Query different worksheets within the same Excel file
- **Advanced SQL Operations**: Support for WHERE clauses, ORDER BY, GROUP BY, aggregation functions, and more
- **MCP Protocol**: Seamlessly integrates with MCP-compatible clients
- **Easy Installation**: Install and run with a single npx command

## 📦 Installation

### Quick Start with npx

```bash
npx @zhangzichao2008/mcp-excel-db@latest
```

### Global Installation

```bash
npm install -g @zhangzichao2008/mcp-excel-db
mcp-excel-db
```

### Local Installation

```bash
npm install @zhangzichao2008/mcp-excel-db
```

## 🛠️ Usage

### Using in MCP Client

- TRAE/CURSOR/ClaudeCode MCP configuration

```json
{
  "mcpServers": {
    "excel-db": {
      "command": "npx",
      "args": [
        "-y",
        "@zhangzichao2008/mcp-excel-db@latest"
      ]
    }
  }
}
```

### Starting the MCP Server

The server runs on stdio and communicates using the Model Context Protocol:

```bash
npx @zhangzichao2008/mcp-excel-db@latest
```

### Available Tools

The MCP server provides the following tools:

#### 1. `execute_sql_query`
Execute SQL queries on Excel files. Each query requires specifying the file path.

**Parameters:**
- `sql` (string): SQL SELECT statement
- `filePath` (string): Path to the Excel file (.xlsx or .xls)

**Example:**
```json
{
  "sql": "SELECT * FROM Sheet1 WHERE age > 25 ORDER BY name",
  "filePath": "/path/to/your/spreadsheet.xlsx"
}
```

**Special SQL Commands:**
- Use `DESCRIBE tablename` to get column information for a worksheet
- Example: `DESCRIBE Sheet1` returns column names and data types

#### 2. `get_worksheet_info`
Get information about all worksheets in an Excel file.

**Parameters:**
- `filePath` (string): Path to the Excel file (.xlsx or .xls)

**Returns:**
- Worksheet names
- Row counts for each worksheet

**Example:**
```json
{
  "filePath": "/path/to/your/spreadsheet.xlsx"
}
```

**Performance Optimization:**
For large Excel files (>5MB), the system uses a sampling algorithm to estimate row counts:
- Samples every 100 rows to detect data presence
- Continues sampling until no data is found
- Provides fast estimation for very large datasets

## 📊 SQL Query Examples

### Basic SELECT
```sql
SELECT * FROM Sheet1;
```

### Filtering with WHERE
```sql
SELECT name, age, salary FROM employees WHERE age > 30;
```

### Sorting
```sql
SELECT * FROM products ORDER BY price DESC;
```

### Aggregation
```sql
SELECT department, COUNT(*) as employee_count, AVG(salary) as avg_salary 
FROM employees 
GROUP BY department;
```

### Complex Queries
```sql
SELECT category, SUM(quantity) as total_quantity 
FROM inventory 
WHERE status = 'active' 
GROUP BY category 
ORDER BY total_quantity DESC;
```

### Getting Table Structure
```sql
DESCRIBE Sheet1;
```

**Note:** All SQL queries now require specifying the `filePath` parameter when using the MCP tools. The Excel file is loaded and processed for each query, ensuring you always work with the latest data.

## 🔧 Supported SQL Features

### SELECT Operations
- Column selection (`SELECT col1, col2`)
- Wildcard selection (`SELECT *`)
- Column aliases (`SELECT col1 AS alias`)

### WHERE Clauses
- Comparison operators (`=`, `>`, `<`, `>=`, `<=`, `!=`, `<>`)
- Pattern matching (`LIKE` with `%` wildcards)
- Logical operators (`AND`, `OR`, `NOT`)
- NULL checks (`IS NULL`, `IS NOT NULL`)

### Aggregation Functions
- `COUNT(*)` - Count all rows
- `COUNT(column)` - Count non-null values
- `SUM(column)` - Sum numeric values
- `MAX(column)` - Find maximum value
- `MIN(column)` - Find minimum value
- `AVG(column)` - Calculate average value

### Other Features
- `ORDER BY` with `ASC`/`DESC`
- `GROUP BY` for aggregation
- `DISTINCT` for unique values
- `LIMIT` for result limiting

## 🚫 Limitations

- Only SELECT queries are supported (no INSERT, UPDATE, DELETE)
- No JOIN operations between worksheets
- No subqueries
- No HAVING clauses
- No UNION operations
- Each query requires specifying the file path (no persistent file loading)
- For large files (>5MB), row counts are estimated using sampling for performance

## 🏗️ Development

### Building from Source

```bash
git clone https://github.com/steven0lisa/mcp-excel-db.git
cd mcp-excel-db
npm install
npm run build
```

### Running Tests

```bash
npm test
```

### Development Mode

```bash
npm run dev
```

## 📁 Project Structure

```
mcp-excel-db/
├── src/                    # Source code
│   ├── excel-sql-query.ts  # Excel SQL query engine
│   └── mcp-server.ts       # MCP server implementation
├── test/                   # Test files
├── doc/                    # Documentation
│   └── zh-cn/             # Chinese documentation
├── dist/                   # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [GitHub Repository](https://github.com/steven0lisa/mcp-excel-db)
- [npm Package](https://www.npmjs.com/package/@zhangzichao2008/mcp-excel-db)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## 📞 Support

If you encounter any issues or have questions, please [open an issue](https://github.com/steven0lisa/mcp-excel-db/issues) on GitHub.

---

Made with ❤️ by [Zhang Zichao](https://github.com/steven0lisa)
