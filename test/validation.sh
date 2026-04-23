#!/bin/bash

# Automated Test Validation for Feature Updates
# This script runs after each implementation to ensure nothing breaks

echo "=== Automated Test Validation ==="
echo "Running comprehensive test suite to validate implementation..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
CRITICAL_FAILURES=0

# Results directory
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
VALIDATION_DIR="../reports/validation_$TIMESTAMP"
mkdir -p "$VALIDATION_DIR"

# Log file
LOG_FILE="$VALIDATION_DIR/validation.log"
echo "Validation started at $(date)" > "$LOG_FILE"

# Helper functions
log_test() {
    echo -e "${BLUE}TEST: $1${NC}"
    echo "[$(date)] TEST: $1" >> "$LOG_FILE"
    ((TOTAL_TESTS++))
}

log_pass() {
    echo -e "${GREEN}PASS: $1${NC}"
    echo "[$(date)] PASS: $1" >> "$LOG_FILE"
    ((PASSED_TESTS++))
}

log_fail() {
    echo -e "${RED}FAIL: $1${NC}"
    echo "[$(date)] FAIL: $1" >> "$LOG_FILE"
    ((FAILED_TESTS++))
}

log_critical() {
    echo -e "${RED}CRITICAL: $1${NC}"
    echo "[$(date)] CRITICAL: $1" >> "$LOG_FILE"
    ((CRITICAL_FAILURES++))
    ((FAILED_TESTS++))
}

# Test 1: Server Health Check
test_server_health() {
    log_test "Server Health Check"
    
    if curl -s http://localhost:3000 | grep -q "Adyen Report Downloader"; then
        log_pass "Server is running and responsive"
        return 0
    else
        log_critical "Server is not responding"
        return 1
    fi
}

# Test 2: Basic API Functionality
test_basic_api() {
    log_test "Basic API Functionality"
    
    # Test upload
    UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:3000/api/upload-structure \
        -F "file=@data/sample_account_structure.json")
    
    if echo "$UPLOAD_RESPONSE" | jq -e '.success' > /dev/null; then
        log_pass "Account structure upload works"
        echo "$UPLOAD_RESPONSE" > "$VALIDATION_DIR/upload_test.json"
    else
        log_fail "Account structure upload failed"
        echo "$UPLOAD_RESPONSE" > "$VALIDATION_DIR/upload_error.json"
        return 1
    fi
    
    # Store API key first
    STORE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/store-api-key \
        -H "Content-Type: application/json" \
        -d '{
            "userId": "validation-user",
            "apiKey": "test-key-validation-123456789012345678901234567890"
        }')
    
    if ! echo "$STORE_RESPONSE" | jq -e '.success' > /dev/null; then
        log_fail "API key storage failed in validation"
        echo "$STORE_RESPONSE" > "$VALIDATION_DIR/store_error.json"
        return 1
    fi
    
    # Test download start
    DOWNLOAD_RESPONSE=$(curl -s -X POST http://localhost:3000/api/download \
        -H "Content-Type: application/json" \
        -d '{
            "userId": "validation-user",
            "targetMonths": ["202504"],
            "selectedEntities": ["Europe - Retail"],
            "accountStructure": {"Europe - Retail": ["MERCHANT-DE-BerlinStore"]},
            "reportTypes": ["monthly_finance"],
            "outputDir": "validation-test"
        }')
    
    if echo "$DOWNLOAD_RESPONSE" | jq -e '.success' > /dev/null; then
        DOWNLOAD_ID=$(echo "$DOWNLOAD_RESPONSE" | jq -r '.downloadId')
        log_pass "Download initiation works: $DOWNLOAD_ID"
        echo "$DOWNLOAD_RESPONSE" > "$VALIDATION_DIR/download_start.json"
        
        # Test progress tracking
        sleep 2
        STATUS_RESPONSE=$(curl -s "http://localhost:3000/api/download/$DOWNLOAD_ID/status")
        
        if echo "$STATUS_RESPONSE" | jq -e '.status' > /dev/null; then
            log_pass "Progress tracking works"
            echo "$STATUS_RESPONSE" > "$VALIDATION_DIR/progress_status.json"
        else
            log_fail "Progress tracking failed"
            echo "$STATUS_RESPONSE" > "$VALIDATION_DIR/progress_error.json"
            # Cleanup API key
            curl -s -X DELETE "http://localhost:3000/api/delete-api-key/validation-user" > /dev/null
            return 1
        fi
        
        # Cleanup API key
        curl -s -X DELETE "http://localhost:3000/api/delete-api-key/validation-user" > /dev/null
    else
        log_fail "Download initiation failed"
        echo "$DOWNLOAD_RESPONSE" > "$VALIDATION_DIR/download_error.json"
        # Cleanup API key
        curl -s -X DELETE "http://localhost:3000/api/delete-api-key/validation-user" > /dev/null
        return 1
    fi
}

# Test 3: Multi-Month Functionality
test_multi_month() {
    log_test "Multi-Month Functionality"
    
    RESPONSE=$(curl -s -X POST http://localhost:3000/api/download \
        -H "Content-Type: application/json" \
        -d '{
            "apiKey": "test-key-multi-month",
            "targetMonths": ["202504", "202505"],
            "selectedEntities": ["Europe - Retail"],
            "accountStructure": {"Europe - Retail": ["MERCHANT-DE-BerlinStore"]},
            "reportTypes": ["monthly_finance"],
            "outputDir": "multi-month-test"
        }')
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        DOWNLOAD_ID=$(echo "$RESPONSE" | jq -r '.downloadId')
        log_pass "Multi-month download started: $DOWNLOAD_ID"
        echo "$RESPONSE" > "$VALIDATION_DIR/multi_month_start.json"
        
        # Monitor progress for a few seconds
        for i in {1..3}; do
            sleep 2
            STATUS=$(curl -s "http://localhost:3000/api/download/$DOWNLOAD_ID/status")
            PROGRESS=$(echo "$STATUS" | jq -r '.progress // 0')
            echo "Multi-month progress check $i: ${PROGRESS}%" >> "$LOG_FILE"
        done
        
        log_pass "Multi-month progress tracking works"
    else
        log_fail "Multi-month download failed to start"
        echo "$RESPONSE" > "$VALIDATION_DIR/multi_month_error.json"
        return 1
    fi
}

# Test 4: Error Handling
test_error_handling() {
    log_test "Error Handling"
    
    RESPONSE=$(curl -s -X POST http://localhost:3000/api/download \
        -H "Content-Type: application/json" \
        -d '{
            "apiKey": "invalid-key-test",
            "targetMonths": ["202504"],
            "selectedEntities": ["Europe - Retail"],
            "accountStructure": {"Europe - Retail": ["MERCHANT-DE-BerlinStore"]},
            "reportTypes": ["monthly_finance"],
            "outputDir": "error-test"
        }')
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        DOWNLOAD_ID=$(echo "$RESPONSE" | jq -r '.downloadId')
        log_pass "Error handling test - download started with invalid key"
        
        # Wait for errors to occur
        sleep 5
        STATUS=$(curl -s "http://localhost:3000/api/download/$DOWNLOAD_ID/status")
        echo "$STATUS" > "$VALIDATION_DIR/error_handling_status.json"
        
        # Should have some errors due to invalid API key
        ERROR_COUNT=$(echo "$STATUS" | jq -r '.errorFiles // 0')
        if [ "$ERROR_COUNT" -gt 0 ]; then
            log_pass "Error handling works - $ERROR_COUNT errors detected"
        else
            log_fail "Error handling failed - no errors detected with invalid key"
            return 1
        fi
    else
        log_fail "Error handling test - download failed to start"
        return 1
    fi
}

# Test 5: Validation Logic
test_validation_logic() {
    log_test "Validation Logic"
    
    # Test empty structure
    RESPONSE=$(curl -s -X POST http://localhost:3000/api/download \
        -H "Content-Type: application/json" \
        -d '{
            "apiKey": "test-key-validation",
            "targetMonths": ["202504"],
            "selectedEntities": [],
            "accountStructure": {},
            "reportTypes": ["monthly_finance"],
            "outputDir": "validation-test"
        }')
    
    # Should fail validation
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        log_fail "Validation failed - empty structure was accepted"
        echo "$RESPONSE" > "$VALIDATION_DIR/validation_error.json"
        return 1
    else
        log_pass "Validation works - empty structure correctly rejected"
        echo "$RESPONSE" > "$VALIDATION_DIR/validation_success.json"
    fi
}

# Test 6: File Operations
test_file_operations() {
    log_test "File Operations"
    
    # Test account structure save
    RESPONSE=$(curl -s -X POST http://localhost:3000/api/save-structure \
        -H "Content-Type: application/json" \
        -d '{"data": {"Test Group": ["TestAccount"]}}')
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        log_pass "Account structure save works"
        echo "$RESPONSE" > "$VALIDATION_DIR/save_structure.json"
    else
        log_fail "Account structure save failed"
        echo "$RESPONSE" > "$VALIDATION_DIR/save_error.json"
        return 1
    fi
}

# Test 7: ZIP Generation
test_zip_generation() {
    log_test "ZIP Generation"
    
    # Start a simple download
    RESPONSE=$(curl -s -X POST http://localhost:3000/api/download \
        -H "Content-Type: application/json" \
        -d '{
            "apiKey": "test-key-zip",
            "targetMonths": ["202504"],
            "selectedEntities": ["Europe - Retail"],
            "accountStructure": {"Europe - Retail": ["MERCHANT-DE-BerlinStore"]},
            "reportTypes": ["monthly_finance"],
            "outputDir": "zip-test"
        }')
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        DOWNLOAD_ID=$(echo "$RESPONSE" | jq -r '.downloadId')
        
        # Wait for completion
        for i in {1..15}; do
            sleep 2
            STATUS=$(curl -s "http://localhost:3000/api/download/$DOWNLOAD_ID/status")
            DOWNLOAD_STATUS=$(echo "$STATUS" | jq -r '.status')
            
            if [ "$DOWNLOAD_STATUS" = "completed" ]; then
                break
            fi
        done
        
        # Test ZIP download
        ZIP_RESPONSE=$(curl -s -I "http://localhost:3000/api/download/$DOWNLOAD_ID/zip")
        
        if echo "$ZIP_RESPONSE" | grep -q "Content-Type: application/zip"; then
            log_pass "ZIP generation works"
            echo "$ZIP_RESPONSE" > "$VALIDATION_DIR/zip_headers.txt"
        else
            log_fail "ZIP generation failed"
            echo "$ZIP_RESPONSE" > "$VALIDATION_DIR/zip_error.txt"
            return 1
        fi
    else
        log_fail "ZIP test download failed to start"
        return 1
    fi
}

# Run all tests
run_validation() {
    echo "Starting comprehensive validation..."
    
    # Critical tests first
    test_server_health || return 1
    test_basic_api || return 1
    
    # Core functionality tests
    test_multi_month
    test_error_handling
    test_validation_logic
    test_file_operations
    test_zip_generation
    
    # Generate summary
    echo -e "\n${BLUE}=== Validation Summary ===${NC}"
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    echo -e "Critical: ${RED}$CRITICAL_FAILURES${NC}"
    
    # Save summary
    cat > "$VALIDATION_DIR/summary.json" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "totalTests": $TOTAL_TESTS,
  "passedTests": $PASSED_TESTS,
  "failedTests": $FAILED_TESTS,
  "criticalFailures": $CRITICAL_FAILURES,
  "successRate": $(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc),
  "status": "$([ $CRITICAL_FAILURES -eq 0 ] && echo "PASS" || echo "FAIL")"
}
EOF
    
    echo "Validation results saved to: $VALIDATION_DIR"
    echo "Log file: $LOG_FILE"
    
    # Return status
    if [ $CRITICAL_FAILURES -eq 0 ]; then
        echo -e "${GREEN}Validation PASSED - No critical failures${NC}"
        return 0
    else
        echo -e "${RED}Validation FAILED - $CRITICAL_FAILURES critical failures${NC}"
        return 1
    fi
}

# Main execution
if [ "$1" = "--quick" ]; then
    echo "Running quick validation..."
    test_server_health && test_basic_api
else
    run_validation
fi
