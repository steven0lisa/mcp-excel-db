import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSingleTest() {
  console.log('🚀 Running single test case F-2\n');
  
  const testCaseDir = path.join(__dirname, 'test', 'test-case');
  const testFile = 'tc-f-2.js';
  const testFilePath = path.join(testCaseDir, testFile);
  
  console.log(`📋 Running ${testFile}`);
  console.log('=' .repeat(60));
  
  try {
    // Dynamically import the test module
    console.log('Importing module from:', testFilePath);
    const testModule = await import(testFilePath);
    console.log('Module imported successfully');
    
    // Find the test function
    const testFunctionName = Object.keys(testModule).find(key => 
      key.startsWith('testF') && typeof testModule[key] === 'function'
    );
    
    if (!testFunctionName) {
      console.log(`⚠️  No test function found in ${testFile}`);
      return;
    }
    
    console.log('Found test function:', testFunctionName);
    const testFunction = testModule[testFunctionName];
    const startTime = Date.now();
    
    // Run the test function
    console.log('Running test function...');
    const results = await testFunction();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('Test completed successfully');
    console.log('Results:', results);
    console.log(`Duration: ${duration}ms`);
    
  } catch (error) {
    console.log(`❌ Error running ${testFile}: ${error.message}`);
    console.log('Stack:', error.stack);
  }
}

runSingleTest().catch(error => {
  console.error('Runner error:', error);
  process.exit(1);
});
