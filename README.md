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
[![Tests](https://img.shields.io/badge/Tests-14%2F98%20failed-red?style=flat-square&logo=jest)](https://github.com/steven0lisa/mcp-excel-db/actions)
[![Coverage](https://img.shields.io/badge/Coverage-15.5%25-red?style=flat-square&logo=codecov)](https://github.com/steven0lisa/mcp-excel-db/actions)


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
Get basic information about all worksheets in an Excel file (lightweight operation).

**Parameters:**
- `filePath` (string): Path to the Excel file (.xlsx or .xls)

**Returns:**
- List of worksheet names

**Example:**
```json
{
  "filePath": "/path/to/your/spreadsheet.xlsx"
}
```

**Note:** For performance reasons, this method does not return row count information. To get the specific row count, use SQL query: `SELECT COUNT(*) FROM SheetName`

#### 3. `get_worksheet_columns`
Get column information for worksheets in an Excel file (lightweight operation).

**Parameters:**
- `filePath` (string): Path to the Excel file (.xlsx or .xls)
- `worksheetName` (string, optional): Specific worksheet name to get columns for

**Returns:**
- Worksheet names and their column lists

**Example:**
```json
{
  "filePath": "/path/to/your/spreadsheet.xlsx",
  "worksheetName": "Sheet1"
}
```

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

### IN and NOT IN Operations
```sql
-- Filter by multiple values
SELECT * FROM products WHERE category IN ('Electronics', 'Books', 'Clothing');

-- Exclude multiple values
SELECT * FROM employees WHERE department NOT IN ('HR', 'Finance');

-- Complex conditions with IN
SELECT name, price FROM products 
WHERE category IN ('A', 'B') AND price > 100;
```

### Table Aliases
```sql
SELECT a.name, a.price FROM Sheet1 AS a WHERE a.price > 10;
```

### JOIN Operations
```sql
-- LEFT JOIN between worksheets
SELECT a.name, a.price, b.supplier 
FROM Sheet1 AS a 
LEFT JOIN Sheet2 AS b ON a.id = b.sheet1_id;

-- INNER JOIN between worksheets
SELECT a.*, b.rating 
FROM products AS a 
INNER JOIN suppliers AS b ON a.supplier_id = b.id;

-- CROSS JOIN between worksheets (Cartesian product)
SELECT a.name, b.category
FROM Sheet1 AS a
CROSS JOIN Sheet2 AS b;
```

### UNION Operations
```sql
-- UNION: Combine results and remove duplicates
SELECT name FROM employees_2023
UNION
SELECT name FROM employees_2024;

-- UNION ALL: Combine results keeping duplicates
SELECT product_name FROM orders_q1
UNION ALL
SELECT product_name FROM orders_q2;

-- Multiple UNION operations
SELECT customer_id, amount FROM orders_2023
UNION
SELECT customer_id, amount FROM orders_2024
UNION ALL
SELECT customer_id, amount FROM orders_2025;
```

### String Functions
```sql
-- String manipulation functions
SELECT 
  LENGTH(name) as name_length,
  UPPER(category) as upper_category,
  LOWER(description) as lower_desc,
  TRIM(notes) as clean_notes,
  SUBSTR(name, 1, 3) as name_prefix,
  REPLACE(description, 'old', 'new') as updated_desc
FROM products;
```

### Math Functions
```sql
-- Mathematical operations
SELECT 
  ABS(profit) as absolute_profit,
  ROUND(price, 2) as rounded_price,
  CEIL(rating) as ceiling_rating,
  FLOOR(discount) as floor_discount,
  RANDOM() as random_number
FROM products;
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
- List membership (`IN`, `NOT IN`) - Check if value exists in a list of values

### Table Aliases
- Table aliases (`FROM Sheet1 AS a`)
- Column references with aliases (`a.column_name`)

### JOIN Operations
- `LEFT JOIN` - Left outer join between worksheets
- `INNER JOIN` - Inner join between worksheets
- `RIGHT JOIN` - Right outer join between worksheets
- `FULL OUTER JOIN` - Full outer join between worksheets
- `CROSS JOIN` - Cartesian product between worksheets
- Join conditions with `ON` clause

### String Functions
- `LENGTH(str)` - Get string length
- `UPPER(str)` - Convert to uppercase
- `LOWER(str)` - Convert to lowercase
- `TRIM(str)` - Remove leading and trailing spaces
- `LTRIM(str)` - Remove leading spaces
- `RTRIM(str)` - Remove trailing spaces
- `SUBSTR(str, start, length)` - Extract substring (1-based indexing)
- `INSTR(str, substr)` - Find substring position (1-based, returns 0 if not found)
- `REPLACE(str, from_str, to_str)` - Replace substring

### Math Functions
- `ABS(x)` - Absolute value
- `ROUND(x, d)` - Round to d decimal places
- `CEIL(x)` / `CEILING(x)` - Round up to nearest integer
- `FLOOR(x)` - Round down to nearest integer
- `RANDOM()` - Generate random integer

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
- `UNION` and `UNION ALL` for combining query results

## 🚫 Limitations

- Only SELECT queries are supported (no INSERT, UPDATE, DELETE)
- No subqueries
- No HAVING clauses
- No UNION operations
- Limited comparison operators (supports `=`, `!=`, `<`, `<=`, but not `>`, `>=`, `IS NOT`)
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

This project has two types of tests:

#### Unit Tests (Jest)
Run Jest unit tests for core functionality:
```bash
npm test
```

#### Feature Tests
Run comprehensive feature tests for all SQL functionality:
```bash
npm run test:features
```

The feature tests validate all implemented SQL features including WHERE conditions, JOIN operations, string functions, math functions, and more. Each feature has its own test suite in the `test/test-case/` directory.

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
