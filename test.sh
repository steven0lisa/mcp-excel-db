#!/bin/bash

# Test script that runs tests and updates README badges
# 测试脚本，运行测试并更新README徽章

echo "🧪 Running tests and updating badges..."

# Run tests with coverage
echo "📊 Running tests with coverage..."
npm run test:coverage > test_output.tmp 2>&1
TEST_EXIT_CODE=$?

# Check if tests actually failed (not just coverage threshold)
if [ $TEST_EXIT_CODE -ne 0 ]; then
    # Check if it's just coverage threshold failure
    if grep -q "Test Suites:.*passed" test_output.tmp && grep -q "Tests:.*passed" test_output.tmp; then
        echo "⚠️  Tests passed but coverage threshold not met"
        echo "📊 Continuing with badge update..."
    else
        echo "❌ Tests failed!"
        cat test_output.tmp
        rm -f test_output.tmp
        exit 1
    fi
fi

# Extract test results
PASSED_TESTS=$(grep -o "[0-9]* passed" test_output.tmp | tail -1 | grep -o "[0-9]*" || echo "0")
TOTAL_TESTS=$(grep -o "Tests:.*[0-9]* total" test_output.tmp | grep -o "[0-9]* total" | grep -o "[0-9]*" || echo "0")
COVERAGE=$(grep -o "[0-9]*\.[0-9]*%" test_output.tmp | head -1 || echo "0%")

echo "✅ Test Results:"
echo "   - Passed: $PASSED_TESTS"
echo "   - Total: $TOTAL_TESTS" 
echo "   - Coverage: $COVERAGE"

# Clean up temp file
rm -f test_output.tmp

# Update README badges
echo "🔄 Updating README badges..."

# Determine badge color based on test results
if [ "$PASSED_TESTS" = "$TOTAL_TESTS" ] && [ "$TOTAL_TESTS" != "0" ]; then
    TEST_COLOR="brightgreen"
    TEST_STATUS="$PASSED_TESTS%20passed"
else
    TEST_COLOR="red"
    TEST_STATUS="$PASSED_TESTS%2F$TOTAL_TESTS%20passed"
fi

# Determine coverage color
COVERAGE_NUM=$(echo $COVERAGE | sed 's/%//')
if (( $(echo "$COVERAGE_NUM >= 80" | bc -l) )); then
    COVERAGE_COLOR="brightgreen"
elif (( $(echo "$COVERAGE_NUM >= 60" | bc -l) )); then
    COVERAGE_COLOR="yellow"
elif (( $(echo "$COVERAGE_NUM >= 40" | bc -l) )); then
    COVERAGE_COLOR="orange"
else
    COVERAGE_COLOR="red"
fi

# Update README.md badges
sed -i.bak "s|.*!\[Tests\].*|[![Tests](https://img.shields.io/badge/tests-$TEST_STATUS-$TEST_COLOR.svg)](https://github.com/steven0lisa/mcp-excel-db/actions)|" README.md
sed -i.bak "s|.*!\[Coverage\].*|[![Coverage](https://img.shields.io/badge/coverage-$COVERAGE-$COVERAGE_COLOR.svg)](https://github.com/steven0lisa/mcp-excel-db/actions)|" README.md

# Remove backup file
rm -f README.md.bak

echo "✅ README badges updated successfully!"
echo "   - Tests: $PASSED_TESTS passed"
echo "   - Coverage: $COVERAGE"

# Show updated badges
echo ""
echo "📋 Updated badges in README.md:"
grep -A1 "Tests\|Coverage" README.md | grep "badge"

echo ""
echo "🎉 Test script completed successfully!"