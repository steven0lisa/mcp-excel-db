import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Unified Test Runner for Excel SQL Query Features
 * Runs all test cases from test/test-case directory
 */
async function runAllTests() {
  console.log('🚀 Starting Excel SQL Query Feature Tests\n');
  
  const testCaseDir = path.join(__dirname, 'test-case');
  const outputDir = path.join(__dirname, 'output');
  const allResults = [];
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;
  
  try {
    // Check if test-case directory exists
    if (!fs.existsSync(testCaseDir)) {
      console.log('❌ test-case directory not found!');
      return;
    }

    // Get all test case files
    const testFiles = fs.readdirSync(testCaseDir)
      .filter(file => file.startsWith('tc-f-') && file.endsWith('.js'))
      .sort();

    if (testFiles.length === 0) {
      console.log('⚠️  No test case files found in test-case directory');
      return;
    }

    console.log(`Found ${testFiles.length} test case files:\n`);

    // Run each test file
    for (const testFile of testFiles) {
      const testFilePath = path.join(testCaseDir, testFile);
      const featureNumber = testFile.match(/tc-f-(\d+)\.js/)?.[1];
      
      console.log(`📋 Running ${testFile} (Feature F-${featureNumber})`);
      console.log('=' .repeat(60));
      
      try {
        // Dynamically import the test module
        const testModule = await import(testFilePath);
        
        // Find the test function (should be named testF{number}...)
        const testFunctionName = Object.keys(testModule).find(key => 
          key.startsWith('testF') && typeof testModule[key] === 'function'
        );
        
        if (!testFunctionName) {
          console.log(`⚠️  No test function found in ${testFile}`);
          continue;
        }
        
        const testFunction = testModule[testFunctionName];
        const startTime = Date.now();
        
        // Run the test function
        const results = await testFunction();
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Process results
        if (Array.isArray(results)) {
          results.forEach(result => {
            totalTests++;
            if (result.status === 'PASS') {
              passedTests++;
            } else if (result.status === 'FAIL') {
              failedTests++;
            } else if (result.status === 'SKIP') {
              skippedTests++;
            }
          });
          
          allResults.push({
            feature: `F-${featureNumber}`,
            file: testFile,
            results: results,
            duration: duration
          });
        }
        
        console.log(`\n⏱️  Completed in ${duration}ms\n`);
        
      } catch (error) {
        console.log(`❌ Error running ${testFile}: ${error.message}\n`);
        failedTests++;
        totalTests++;
        
        allResults.push({
          feature: `F-${featureNumber}`,
          file: testFile,
          error: error.message,
          duration: 0
        });
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`\n📈 Overall Statistics:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   ⚠️  Skipped: ${skippedTests}`);
    
    const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;
    console.log(`   📊 Success Rate: ${successRate}%`);
    
    console.log(`\n🔍 Feature Test Results:`);
    allResults.forEach(result => {
      const { feature, file, results, error, duration } = result;
      
      if (error) {
        console.log(`   ${feature}: ❌ ERROR - ${error}`);
      } else if (results) {
        const featurePassed = results.filter(r => r.status === 'PASS').length;
        const featureFailed = results.filter(r => r.status === 'FAIL').length;
        const featureSkipped = results.filter(r => r.status === 'SKIP').length;
        const featureTotal = results.length;
        
        const status = featureFailed > 0 ? '❌' : featurePassed > 0 ? '✅' : '⚠️';
        console.log(`   ${feature}: ${status} ${featurePassed}/${featureTotal} passed (${duration}ms)`);
        
        // Show failed tests
        if (featureFailed > 0) {
          results.filter(r => r.status === 'FAIL').forEach(failedTest => {
            console.log(`     ❌ ${failedTest.test}: ${failedTest.error || 'Unknown error'}`);
          });
        }
        
        // Show skipped tests
        if (featureSkipped > 0) {
          results.filter(r => r.status === 'SKIP').forEach(skippedTest => {
            console.log(`     ⚠️  ${skippedTest.test}: ${skippedTest.reason || skippedTest.error || 'Skipped'}`);
          });
        }
      }
    });
    
    console.log('\n' + '='.repeat(80));
    
    if (failedTests === 0) {
      console.log('🎉 All tests completed successfully!');
    } else {
      console.log(`⚠️  ${failedTests} test(s) failed. Please check the results above.`);
    }
    
    console.log('\n📚 Feature Documentation: doc/feature/');
    console.log('🧪 Test Cases: test/test-case/');
    console.log('\nFor detailed feature information, check the corresponding F-{number}.md files.');

    // Write results to files for external inspection
    try {
      fs.mkdirSync(outputDir, { recursive: true });
      const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;
      const payload = {
        meta: {
          totalTests,
          passedTests,
          failedTests,
          skippedTests,
          successRate,
          timestamp: new Date().toISOString(),
        },
        features: allResults,
      };
      fs.writeFileSync(path.join(outputDir, 'last-results.json'), JSON.stringify(payload, null, 2), 'utf-8');

      // Also write a human-readable summary and list of failures
      const failures = [];
      for (const res of allResults) {
        if (res.results) {
          for (const r of res.results) {
            if (r.status === 'FAIL') {
              failures.push({ feature: res.feature, file: res.file, test: r.test, error: r.error || 'Unknown error' });
            }
          }
        } else if (res.error) {
          failures.push({ feature: res.feature, file: res.file, test: 'ModuleError', error: res.error });
        }
      }
      let summaryText = '';
      summaryText += `Total: ${totalTests}\nPassed: ${passedTests}\nFailed: ${failedTests}\nSkipped: ${skippedTests}\nSuccessRate: ${successRate}%\n`;
      if (failures.length > 0) {
        summaryText += '\nFailures:\n';
        for (const f of failures) {
          summaryText += `- ${f.feature} (${f.file}) :: ${f.test} -> ${f.error}\n`;
        }
      }
      fs.writeFileSync(path.join(outputDir, 'last-summary.txt'), summaryText, 'utf-8');
    } catch (writeErr) {
      console.warn('⚠️  Failed to write test outputs:', writeErr?.message || writeErr);
    }
    
  } catch (error) {
    console.log(`❌ Fatal error running tests: ${error.message}`);
    console.error(error.stack);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { runAllTests };