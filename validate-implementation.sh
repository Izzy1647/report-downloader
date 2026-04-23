#!/bin/bash

# Implementation Validation Script
# Run this after implementing any new feature

echo "=== Implementation Validation ==="
echo "Running tests to ensure nothing is broken..."

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "Starting server..."
    npm start &
    sleep 5
fi

# Run comprehensive validation
cd test
./validation.sh

# Get exit code
VALIDATION_RESULT=$?

# Return to project root
cd ..

if [ $VALIDATION_RESULT -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "SUCCESS: All tests passed! Implementation is ready."
    echo "=========================================="
else
    echo ""
    echo "=========================================="
    echo "FAILURE: Some tests failed. Please review and fix."
    echo "=========================================="
    echo "Check test/reports/validation_$(date +%Y%m%d_%H%M%S)/ for details"
fi

exit $VALIDATION_RESULT
