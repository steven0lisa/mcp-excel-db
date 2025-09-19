import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createTestData() {
  const workbook = new ExcelJS.Workbook();
  
  // Create Sheet1 (products)
  const sheet1 = workbook.addWorksheet('Sheet1');
  sheet1.columns = [
    { header: 'id', key: 'id', width: 10 },
    { header: 'name', key: 'name', width: 15 },
    { header: 'category', key: 'category', width: 15 },
    { header: 'amount', key: 'amount', width: 10 },
    { header: 'price', key: 'price', width: 10 },
    { header: 'status', key: 'status', width: 10 },
    { header: 'description', key: 'description', width: 20 }
  ];
  
  const sheet1Data = [
    { id: 1, name: '苹果', category: '水果', amount: 10, price: 5.5, status: 'active', description: '新鲜苹果' },
    { id: 2, name: '香蕉', category: '水果', amount: 20, price: 3.2, status: 'active', description: null },
    { id: 3, name: '橙子', category: '水果', amount: 15, price: 4.8, status: null, description: '进口橙子' },
    { id: 4, name: '牛奶', category: '饮品', amount: 5, price: 12.5, status: 'active', description: '纯牛奶' },
    { id: 5, name: '咖啡', category: '饮品', amount: 8, price: 25, status: 'inactive', description: null }
  ];
  
  sheet1.addRows(sheet1Data);
  
  // Create Sheet2 (product details)
  const sheet2 = workbook.addWorksheet('Sheet2');
  sheet2.columns = [
    { header: 'id', key: 'id', width: 10 },
    { header: 'sheet1_id', key: 'sheet1_id', width: 15 },
    { header: 'supplier', key: 'supplier', width: 20 },
    { header: 'origin', key: 'origin', width: 15 },
    { header: 'rating', key: 'rating', width: 10 }
  ];
  
  const sheet2Data = [
    { id: 1, sheet1_id: 1, supplier: '果园A', origin: '山东', rating: 4.5 },
    { id: 2, sheet1_id: 2, supplier: '果园B', origin: '海南', rating: 4.2 },
    { id: 3, sheet1_id: 3, supplier: '果园C', origin: '广西', rating: 4.8 },
    { id: 4, sheet1_id: 4, supplier: '牧场A', origin: '内蒙古', rating: 4.7 },
    { id: 5, sheet1_id: 5, supplier: '咖啡厂', origin: '云南', rating: 4.3 }
  ];
  
  sheet2.addRows(sheet2Data);
  
  // Save the file
  const filePath = join(__dirname, 'test', 'test-data-with-join.xlsx');
  await workbook.xlsx.writeFile(filePath);
  
  console.log(`Test data with JOIN support created: ${filePath}`);
  console.log('Sheet1 (Products):', sheet1Data.length, 'rows');
  console.log('Sheet2 (Product Details):', sheet2Data.length, 'rows');
}

createTestData().catch(console.error);