#!/bin/bash

# Main test runner for Adyen Report Downloader
# Usage: ./run-tests.sh [test-type]

echo "=== Adyen Report Downloader Test Runner ==="

# Check if test directory exists
if [ ! -d "test" ]; then
    echo "Error: test directory not found"
    exit 1
fi

# Change to test directory
cd test

# Install test dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing test dependencies..."
    npm install
fi

# Setup test environment
echo "Setting up test environment..."
npm run setup

# Run tests based on argument
case "${1:-all}" in
    "api")
        echo "Running API tests..."
        npm run test:api
        ;;
    "comprehensive")
        echo "Running comprehensive tests..."
        npm run test:comprehensive
        ;;
    "automation")
        echo "Running UI automation tests..."
        npm run test:automation
        ;;
    "health")
        echo "Running health check..."
        npm run test:health
        ;;
    "upload")
        echo "Running upload tests..."
        npm run test:upload
        ;;
    "single")
        echo "Running single month tests..."
        npm run test:single
        ;;
    "multi")
        echo "Running multi-month tests..."
        npm run test:multi
        ;;
    "all")
        echo "Running all tests..."
        npm run test
        ;;
    "clean")
        echo "Cleaning test results..."
        npm run clean
        ;;
    *)
        echo "Usage: $0 [api|comprehensive|automation|health|upload|single|multi|all|clean]"
        echo ""
        echo "Available test types:"
        echo "  api          - Basic API endpoint tests"
        echo "  comprehensive - Full coverage test suite"
        echo "  automation   - Browser automation tests"
        echo "  health       - Server health check"
        echo "  upload       - Account structure upload tests"
        echo "  single       - Single month download tests"
        echo "  multi        - Multi-month download tests"
        echo "  all          - Run all tests (default)"
        echo "  clean        - Clean test results"
        exit 1
        ;;
esac

echo "Test execution completed!"
echo "Results saved in test/reports/"
