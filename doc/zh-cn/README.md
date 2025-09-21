# MCP Excel 数据库服务器

一个模型上下文协议（MCP）服务器，支持使用 SQL 语法查询 Excel 文件。将您的 Excel 电子表格转换为可查询的数据库。

## 🚀 功能特性

- **SQL 查询支持**：使用标准 SQL 语法对 Excel 工作表执行 SELECT 查询
- **多工作表支持**：查询同一 Excel 文件中的不同工作表
- **高级 SQL 操作**：支持 WHERE 子句、ORDER BY、GROUP BY、聚合函数等
- **MCP 协议**：与兼容 MCP 的客户端无缝集成
- **简易安装**：使用单个 npx 命令即可安装和运行

## 📦 安装

### 快速使用

- TRAE/CURSOR/ClaudeCode MCP配置

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

### 使用 npx 快速启动

```bash
npx @zhangzichao2008/mcp-excel-db@latest
```

### 全局安装

```bash
npm install -g @zhangzichao2008/mcp-excel-db
mcp-excel-db
```

### 本地安装

```bash
npm install @zhangzichao2008/mcp-excel-db
```

## 🛠️ 使用方法

### 启动 MCP 服务器

服务器在 stdio 上运行，使用模型上下文协议进行通信：

```bash
npx @zhangzichao2008/mcp-excel-db@latest
```

### 可用工具

MCP 服务器提供以下工具：

#### 1. `load_excel_file`
加载 Excel 文件以供查询。

**参数：**
- `filePath` (string)：Excel 文件路径（.xlsx 或 .xls）

**示例：**
```json
{
  "filePath": "/path/to/your/spreadsheet.xlsx"
}
```

#### 2. `execute_sql_query`
对已加载的 Excel 文件执行 SQL 查询。

**参数：**
- `sql` (string)：SQL SELECT 语句

**示例：**
```json
{
  "sql": "SELECT * FROM Sheet1 WHERE age > 25 ORDER BY name"
}
```

#### 3. `get_worksheet_info`
获取已加载 Excel 文件中所有工作表的基本信息（轻量级操作）。

**返回：**
- 工作表名称列表

**注意：** 为了性能考虑，此方法不返回行数信息。如需获取具体行数，请使用 SQL 查询：`SELECT COUNT(*) FROM SheetName`

#### 4. `get_worksheet_columns`
获取指定工作表的列名。

**参数：**
- `worksheetName` (string)：工作表名称

## 📊 SQL 查询示例

### 基本 SELECT
```sql
SELECT * FROM Sheet1;
```

### 使用 WHERE 过滤
```sql
SELECT name, age, salary FROM employees WHERE age > 30;
```

### 排序
```sql
SELECT * FROM products ORDER BY price DESC;
```

### 聚合
```sql
SELECT department, COUNT(*) as employee_count, AVG(salary) as avg_salary 
FROM employees 
GROUP BY department;
```

### 复杂查询
```sql
SELECT category, SUM(quantity) as total_quantity 
FROM inventory 
WHERE status = 'active' 
GROUP BY category 
ORDER BY total_quantity DESC;
```

### IN 和 NOT IN 操作
```sql
-- 按多个值过滤
SELECT * FROM products WHERE category IN ('电子产品', '图书', '服装');

-- 排除多个值
SELECT * FROM employees WHERE department NOT IN ('人事部', '财务部');

-- 复合条件与 IN
SELECT name, price FROM products 
WHERE category IN ('A', 'B') AND price > 100;
```

### 表别名
```sql
SELECT a.name, a.price FROM Sheet1 AS a WHERE a.price < 10;
```

### JOIN 操作
```sql
-- 工作表间的 LEFT JOIN
SELECT a.name, a.price, b.supplier 
FROM Sheet1 AS a 
LEFT JOIN Sheet2 AS b ON a.id = b.sheet1_id;

-- 工作表间的 INNER JOIN
SELECT a.*, b.rating 
FROM products AS a 
INNER JOIN suppliers AS b ON a.supplier_id = b.id;

-- 工作表间的 CROSS JOIN（笛卡尔积）
SELECT a.name, b.category
FROM Sheet1 AS a
CROSS JOIN Sheet2 AS b;
```

### UNION 操作
```sql
-- UNION：合并结果并去除重复
SELECT name FROM employees_2023
UNION
SELECT name FROM employees_2024;

-- UNION ALL：合并结果保留重复
SELECT product_name FROM orders_q1
UNION ALL
SELECT product_name FROM orders_q2;

-- 多个 UNION 操作
SELECT customer_id, amount FROM orders_2023
UNION
SELECT customer_id, amount FROM orders_2024
UNION ALL
SELECT customer_id, amount FROM orders_2025;
```

### 字符串函数
```sql
-- 字符串处理函数
SELECT 
  LENGTH(name) as name_length,
  UPPER(category) as upper_category,
  LOWER(description) as lower_desc,
  TRIM(notes) as clean_notes,
  SUBSTR(name, 1, 3) as name_prefix,
  REPLACE(description, '旧', '新') as updated_desc
FROM products;
```

### 数学函数
```sql
-- 数学运算函数
SELECT 
  ABS(profit) as absolute_profit,
  ROUND(price, 2) as rounded_price,
  CEIL(rating) as ceiling_rating,
  FLOOR(discount) as floor_discount,
  RANDOM() as random_number
FROM products;
```

## 🔧 支持的 SQL 功能

### SELECT 操作
- 列选择（`SELECT col1, col2`）
- 通配符选择（`SELECT *`）
- 列别名（`SELECT col1 AS alias`）

### WHERE 子句
- 比较运算符（`=`、`>`、`<`、`>=`、`<=`、`!=`、`<>`）
- 模式匹配（`LIKE` 配合 `%` 通配符）
- 逻辑运算符（`AND`、`OR`、`NOT`）
- NULL 检查（`IS NULL`、`IS NOT NULL`）
- 列表成员检查（`IN`、`NOT IN`）- 检查值是否存在于值列表中

### 表别名
- 表别名（`FROM Sheet1 AS a`）
- 带别名的列引用（`a.column_name`）

### JOIN 操作
- `LEFT JOIN` - 工作表间的左外连接
- `INNER JOIN` - 工作表间的内连接
- `RIGHT JOIN` - 工作表间的右外连接
- `FULL OUTER JOIN` - 工作表间的全外连接
- `CROSS JOIN` - 工作表间的笛卡尔积
- 使用 `ON` 子句的连接条件

### 字符串函数
- `LENGTH(str)` - 获取字符串长度
- `UPPER(str)` - 转换为大写
- `LOWER(str)` - 转换为小写
- `TRIM(str)` - 去除首尾空格
- `LTRIM(str)` - 去除左侧空格
- `RTRIM(str)` - 去除右侧空格
- `SUBSTR(str, start, length)` - 提取子字符串（从1开始索引）
- `INSTR(str, substr)` - 查找子字符串位置（从1开始，未找到返回0）
- `REPLACE(str, from_str, to_str)` - 替换子字符串

### 数学函数
- `ABS(x)` - 绝对值
- `ROUND(x, d)` - 四舍五入到d位小数
- `CEIL(x)` / `CEILING(x)` - 向上取整
- `FLOOR(x)` - 向下取整
- `RANDOM()` - 生成随机整数

### 聚合函数
- `COUNT(*)` - 计算所有行数
- `COUNT(column)` - 计算非空值数量
- `SUM(column)` - 计算数值总和
- `MAX(column)` - 查找最大值
- `MIN(column)` - 查找最小值
- `AVG(column)` - 计算平均值

### 其他功能
- `ORDER BY` 配合 `ASC`/`DESC`
- `GROUP BY` 用于聚合
- `DISTINCT` 获取唯一值
- `LIMIT` 限制结果数量
- `UNION` 和 `UNION ALL` 用于合并查询结果

## 🚫 限制

- 仅支持 SELECT 查询（不支持 INSERT、UPDATE、DELETE）
- 不支持子查询
- 不支持 HAVING 子句
- 不支持 UNION 操作
- 比较运算符支持有限（支持 `=`、`!=`、`<`、`<=`，但不支持 `>`、`>=`、`IS NOT`）
- 每个查询都需要指定文件路径（不支持持久化文件加载）
- 对于大文件（>5MB），使用采样算法估算行数以提高性能

## 🏗️ 开发

### 从源码构建

```bash
git clone https://github.com/steven0lisa/mcp-excel-db.git
cd mcp-excel-db
npm install
npm run build
```

### 运行测试

本项目有两种类型的测试：

#### 单元测试（Jest）
运行核心功能的 Jest 单元测试：
```bash
npm test
```

#### 特性测试
运行所有 SQL 功能的综合特性测试：
```bash
npm run test:features
```

特性测试验证所有已实现的 SQL 功能，包括 WHERE 条件、JOIN 操作、字符串函数、数学函数等。每个特性在 `test/test-case/` 目录中都有对应的测试套件。

### 开发模式

```bash
npm run dev
```

## 📁 项目结构

```
mcp-excel-db/
├── src/                    # 源代码
│   ├── excel-sql-query.ts  # Excel SQL 查询引擎
│   └── mcp-server.ts       # MCP 服务器实现
├── test/                   # 测试文件
├── doc/                    # 文档
│   └── zh-cn/             # 中文文档
├── dist/                   # 编译输出
├── package.json
├── tsconfig.json
└── README.md
```

## 🤝 贡献

欢迎贡献！请随时提交 Pull Request。

1. Fork 仓库
2. 创建功能分支（`git checkout -b feature/AmazingFeature`）
3. 提交更改（`git commit -m 'Add some AmazingFeature'`）
4. 推送到分支（`git push origin feature/AmazingFeature`）
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 🔗 链接

- [GitHub 仓库](https://github.com/steven0lisa/mcp-excel-db)
- [npm 包](https://www.npmjs.com/package/@zhangzichao2008/mcp-excel-db)
- [模型上下文协议](https://modelcontextprotocol.io/)

## 📞 支持

如果您遇到任何问题或有疑问，请在 GitHub 上[提交 issue](https://github.com/steven0lisa/mcp-excel-db/issues)。

---

由 [张子超](https://github.com/steven0lisa) 用 ❤️ 制作