# MCP Excel Database Server

A Model Context Protocol (MCP) server that enables SQL queries on Excel files. Transform your Excel spreadsheets into queryable databases.

## 🚀 Features

- **SQL Query Support**: Execute SELECT queries on Excel worksheets using standard SQL syntax
- **Multi-worksheet Support**: Query different worksheets within the same Excel file
- **Advanced SQL Operations**: Support for WHERE clauses, ORDER BY, GROUP BY, aggregate functions, and more
- **MCP Protocol**: Seamless integration with MCP-compatible clients
- **Easy Installation**: Install and run with a single npx command

## 📦 Installation

### Quick Start

- TRAE/CURSOR/ClaudeCode MCP Configuration

```json
{
  "mcpServers": {
    "excel-db": {
      "command": "npx",
      "args": ["@zhangzichao2008/mcp-excel-db"],
      "env": {}
    }
  }
}
```

### Quick Start with npx

```bash
npx @zhangzichao2008/mcp-excel-db
```

### Global Installation

```bash
npm install -g @zhangzichao2008/mcp-excel-db
mcp-excel-db
```

### Local Installation

```bash
npm install @zhangzichao2008/mcp-excel-db
npx mcp-excel-db
```

## 🛠️ Usage

### Starting the MCP Server

The server runs on stdio using the Model Context Protocol for communication:

```bash
mcp-excel-db
```

### Available Tools

The MCP server provides the following tools:

#### `db_load_excel_file`
Load an Excel file for querying.

**Parameters:**
- `filePath` (string): Path to the Excel file (.xlsx or .xls)

**Example:**
```json
{
  "filePath": "/path/to/your/data.xlsx"
}
```

#### `db_execute_sql_query`
Execute SQL queries on the loaded Excel file.

**Parameters:**
- `sql` (string): SQL SELECT statement

**Example:**
```json
{
  "sql": "SELECT * FROM Sheet1 WHERE age > 25"
}
```

#### `db_get_worksheet_info`
Get information about all worksheets in the loaded Excel file.

**Returns:**
- Worksheet names
- Row counts
- Column information

#### `db_get_worksheet_columns`
Get column names for a specific worksheet.

**Parameters:**
- `worksheetName` (string): Name of the worksheet

## 📊 SQL Query Examples

### Basic SELECT

```sql
SELECT * FROM Sheet1;
SELECT name, age, city FROM Sheet1;
```

### Filtering with WHERE

```sql
SELECT * FROM Sheet1 WHERE age > 25;
SELECT name FROM Sheet1 WHERE city = 'New York';
```

### Sorting

```sql
SELECT * FROM Sheet1 ORDER BY age DESC;
SELECT name, age FROM Sheet1 ORDER BY age ASC, name DESC;
```

### Aggregation

```sql
SELECT COUNT(*) FROM Sheet1;
SELECT AVG(age) FROM Sheet1;
SELECT city, COUNT(*) as count FROM Sheet1 GROUP BY city;
```

### Complex Queries

```sql
SELECT city, AVG(age) as avg_age, COUNT(*) as population 
FROM Sheet1 
WHERE age >= 18 
GROUP BY city 
ORDER BY avg_age DESC;
```

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

### Aggregate Functions
- `COUNT(*)` - Count all rows
- `COUNT(column)` - Count non-null values
- `SUM(column)` - Sum numeric values
- `MAX(column)` - Find maximum value
- `MIN(column)` - Find minimum value
- `AVG(column)` - Calculate average

### Other Features
- `ORDER BY` with `ASC`/`DESC`
- `GROUP BY` for aggregation
- `DISTINCT` for unique values
- `LIMIT` to restrict results

## 🚫 Limitations

- Only SELECT queries are supported (no INSERT, UPDATE, DELETE)
- No JOIN operations between worksheets
- No subqueries
- No HAVING clauses
- No UNION operations
- Maximum 10,000 rows per worksheet for performance considerations

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
│   └── en/                 # English documentation
├── dist/                   # Compiled output
└── package.json
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

If you encounter any issues or have questions, please [submit an issue](https://github.com/steven0lisa/mcp-excel-db/issues) on GitHub.

---

Made with ❤️ by [Zhang Zichao](https://github.com/steven0lisa)