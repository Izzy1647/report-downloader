#!/bin/bash

# Comprehensive Test Suite for Adyen Report Downloader
# Usage: ./comprehensive-tests.sh [test-name]
# If no test name provided, runs all tests

BASE_URL="http://localhost:3000"
RESULTS_DIR="../reports"
mkdir -p "$RESULTS_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results tracking
PASSED=0
FAILED=0

# Helper functions
log_test() {
    echo -e "${YELLOW}TEST: $1${NC}"
}

log_pass() {
    echo -e "${GREEN}PASS: $1${NC}"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}FAIL: $1${NC}"
    ((FAILED++))
}

# Test 1: Health Check
test_health() {
    log_test "Health Check - Server Status"
    
    if curl -s "$BASE_URL" | grep -q "Adyen Report Downloader"; then
        log_pass "Server is running and responsive"
    else
        log_fail "Server is not responding"
        return 1
    fi
}

# Test 2: Account Structure Upload
test_upload_structure() {
    log_test "Account Structure Upload"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload-structure" \
        -F "file=@../data/sample_account_structure.json")
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        log_pass "Account structure uploaded successfully"
        echo "$RESPONSE" > "$RESULTS_DIR/upload_response.json"
    else
        log_fail "Account structure upload failed"
        echo "$RESPONSE" > "$RESULTS_DIR/upload_error.json"
        return 1
    fi
}

# Helper function to store API key
store_api_key() {
    local user_id=$1
    local api_key=$2
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$user_id\", \"apiKey\": \"$api_key\"}")
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        return 0
    else
        return 1
    fi
}

# Helper function to cleanup API key
cleanup_api_key() {
    local user_id=$1
    
    curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user_id" > /dev/null
}

# Test 3: Single Month Download
test_single_month() {
    log_test "Single Month Download"
    
    # Store API key first
    if ! store_api_key "test-user-single" "test-key-single-123456789012345678901234567890"; then
        log_fail "API key storage failed for single month test"
        return 1
    fi
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/download" \
        -H "Content-Type: application/json" \
        -d '{
            "userId": "test-user-single",
            "targetMonths": ["202504"],
            "selectedEntities": ["Europe - Retail"],
            "accountStructure": {
                "Europe - Retail": ["MERCHANT-DE-BerlinStore", "MERCHANT-DE-MunichStore"]
            },
            "reportTypes": ["monthly_finance"],
            "outputDir": "test-downloads"
        }')
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        DOWNLOAD_ID=$(echo "$RESPONSE" | jq -r '.downloadId')
        log_pass "Single month download started: $DOWNLOAD_ID"
        echo "$RESPONSE" > "$RESULTS_DIR/single_month_start.json"
        
        # Monitor progress briefly
        sleep 3
        STATUS=$(curl -s "$BASE_URL/api/download/$DOWNLOAD_ID/status")
        if echo "$STATUS" | jq -e '.status' > /dev/null; then
            log_pass "Single month download status accessible"
        else
            log_fail "Single month download status not accessible"
        fi
        
        # Cleanup API key
        cleanup_api_key "test-user-single"
    else
        log_fail "Single month download failed to start"
        echo "$RESPONSE" > "$RESULTS_DIR/single_month_error.json"
        cleanup_api_key "test-user-single"
        return 1
    fi
}

# Test 4: Multi-Month Download
test_multi_month() {
    log_test "Multi-Month Download (3 months)"
    
    # Store API key first
    if ! store_api_key "test-user-multi" "test-key-multi-123456789012345678901234567890"; then
        log_fail "API key storage failed for multi-month test"
        return 1
    fi
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/download" \
        -H "Content-Type: application/json" \
        -d '{
            "userId": "test-user-multi",
            "targetMonths": ["202504", "202505", "202506"],
            "selectedEntities": ["Europe - Retail"],
            "accountStructure": {
                "Europe - Retail": ["MERCHANT-DE-BerlinStore", "MERCHANT-DE-MunichStore"]
            },
            "reportTypes": ["monthly_finance"],
            "outputDir": "test-downloads"
        }')
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        DOWNLOAD_ID=$(echo "$RESPONSE" | jq -r '.downloadId')
        log_pass "Multi-month download started: $DOWNLOAD_ID"
        echo "$RESPONSE" > "$RESULTS_DIR/multi_month_start.json"
        
        # Monitor progress
        for i in {1..5}; do
            sleep 2
            STATUS=$(curl -s "$BASE_URL/api/download/$DOWNLOAD_ID/status")
            PROGRESS=$(echo "$STATUS" | jq -r '.progress // 0')
            echo "Progress check $i/5: ${PROGRESS}%"
        done
        
        # Cleanup API key
        cleanup_api_key "test-user-multi"
    else
        log_fail "Multi-month download failed to start"
        echo "$RESPONSE" > "$RESULTS_DIR/multi_month_error.json"
        cleanup_api_key "test-user-multi"
        return 1
    fi
}

# Test 5: All Report Types
test_all_reports() {
    log_test "All Report Types Download"
    
    # Store API key first
    if ! store_api_key "test-user-all" "test-key-all-123456789012345678901234567890"; then
        log_fail "API key storage failed for all reports test"
        return 1
    fi
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/download" \
        -H "Content-Type: application/json" \
        -d '{
            "userId": "test-user-all",
            "targetMonths": ["202504"],
            "selectedEntities": ["Europe - Retail"],
            "accountStructure": {
                "Europe - Retail": ["MERCHANT-DE-BerlinStore"]
            },
            "reportTypes": ["monthly_finance", "invoice", "daily_payment_accounting", "settlement_detail"],
            "outputDir": "test-all-reports"
        }')
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        DOWNLOAD_ID=$(echo "$RESPONSE" | jq -r '.downloadId')
        log_pass "All reports download started: $DOWNLOAD_ID"
        echo "$RESPONSE" > "$RESULTS_DIR/all_reports_start.json"
        
        # Cleanup API key
        cleanup_api_key "test-user-all"
    else
        log_fail "All reports download failed to start"
        echo "$RESPONSE" > "$RESULTS_DIR/all_reports_error.json"
        cleanup_api_key "test-user-all"
        return 1
    fi
}

# Test 6: Error Handling - Invalid API Key
test_invalid_api_key() {
    log_test "Error Handling - Invalid API Key"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/download" \
        -H "Content-Type: application/json" \
        -d '{
            "apiKey": "invalid-key",
            "targetMonths": ["202504"],
            "selectedEntities": ["Europe - Retail"],
            "accountStructure": {
                "Europe - Retail": ["MERCHANT-DE-BerlinStore"]
            },
            "reportTypes": ["monthly_finance"],
            "outputDir": "test-invalid"
        }')
    
    # Should still start download but fail during processing
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        DOWNLOAD_ID=$(echo "$RESPONSE" | jq -r '.downloadId')
        log_pass "Invalid API key test - download started (will fail during processing)"
        echo "$RESPONSE" > "$RESULTS_DIR/invalid_key_start.json"
        
        # Wait a bit then check for errors
        sleep 5
        STATUS=$(curl -s "$BASE_URL/api/download/$DOWNLOAD_ID/status")
        echo "$STATUS" > "$RESULTS_DIR/invalid_key_status.json"
        
        if echo "$STATUS" | jq -e '.errorFiles > 0' > /dev/null; then
            log_pass "Invalid API key test - errors detected as expected"
        else
            log_fail "Invalid API key test - no errors detected"
        fi
    else
        log_fail "Invalid API key test - download failed to start"
        return 1
    fi
}

# Test 7: Edge Case - Empty Account Structure
test_empty_structure() {
    log_test "Edge Case - Empty Account Structure"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/download" \
        -H "Content-Type: application/json" \
        -d '{
            "apiKey": "test-key-empty",
            "targetMonths": ["202504"],
            "selectedEntities": [],
            "accountStructure": {},
            "reportTypes": ["monthly_finance"],
            "outputDir": "test-empty"
        }')
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        log_fail "Empty structure test - download should have failed"
        return 1
    else
        log_pass "Empty structure test - correctly rejected"
        echo "$RESPONSE" > "$RESULTS_DIR/empty_structure_response.json"
    fi
}

# Test 8: Performance Test - Large Dataset
test_large_dataset() {
    log_test "Performance Test - Large Dataset"
    
    # Generate large account structure
    LARGE_STRUCTURE='{"Large Group": ['
    for i in {1..50}; do
        LARGE_STRUCTURE+='"MERCHANT-TEST'$i'"'
        if [ $i -lt 50 ]; then
            LARGE_STRUCTURE+=','
        fi
    done
    LARGE_STRUCTURE+=']}'
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/download" \
        -H "Content-Type: application/json" \
        -d "{
            \"apiKey\": \"test-key-large\",
            \"targetMonths\": [\"202504\"],
            \"selectedEntities\": [\"Large Group\"],
            \"accountStructure\": $LARGE_STRUCTURE,
            \"reportTypes\": [\"monthly_finance\"],
            \"outputDir\": \"test-large\"
        }")
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        DOWNLOAD_ID=$(echo "$RESPONSE" | jq -r '.downloadId')
        log_pass "Large dataset download started: $DOWNLOAD_ID"
        echo "$RESPONSE" > "$RESULTS_DIR/large_dataset_start.json"
        
        # Monitor initial progress
        sleep 3
        STATUS=$(curl -s "$BASE_URL/api/download/$DOWNLOAD_ID/status")
        echo "$STATUS" > "$RESULTS_DIR/large_dataset_status.json"
        
        if echo "$STATUS" | jq -e '.progress' > /dev/null; then
            log_pass "Large dataset progress tracking working"
        else
            log_fail "Large dataset progress tracking failed"
        fi
    else
        log_fail "Large dataset download failed to start"
        return 1
    fi
}

# Test 9: ZIP Download Test
test_zip_download() {
    log_test "ZIP Download Test"
    
    # First start a simple download
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/download" \
        -H "Content-Type: application/json" \
        -d '{
            "apiKey": "test-key-zip",
            "targetMonths": ["202504"],
            "selectedEntities": ["Europe - Retail"],
            "accountStructure": {
                "Europe - Retail": ["MERCHANT-DE-BerlinStore"]
            },
            "reportTypes": ["monthly_finance"],
            "outputDir": "test-zip"
        }')
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        DOWNLOAD_ID=$(echo "$RESPONSE" | jq -r '.downloadId')
        
        # Wait for completion or timeout
        for i in {1..30}; do
            sleep 2
            STATUS=$(curl -s "$BASE_URL/api/download/$DOWNLOAD_ID/status")
            DOWNLOAD_STATUS=$(echo "$STATUS" | jq -r '.status')
            
            if [ "$DOWNLOAD_STATUS" = "completed" ]; then
                log_pass "Download completed, testing ZIP download"
                
                # Test ZIP download
                ZIP_RESPONSE=$(curl -s -I "$BASE_URL/api/download/$DOWNLOAD_ID/zip")
                if echo "$ZIP_RESPONSE" | grep -q "Content-Type: application/zip"; then
                    log_pass "ZIP download endpoint working"
                    echo "$ZIP_RESPONSE" > "$RESULTS_DIR/zip_headers.txt"
                else
                    log_fail "ZIP download endpoint not working"
                fi
                return 0
            fi
        done
        
        log_fail "Download did not complete within timeout"
        return 1
    else
        log_fail "ZIP test download failed to start"
        return 1
    fi
}

# Test 10: Concurrent Downloads
test_concurrent_downloads() {
    log_test "Concurrent Downloads Test"
    
    # Start multiple downloads simultaneously
    DOWNLOAD_IDS=()
    for i in {1..3}; do
        RESPONSE=$(curl -s -X POST "$BASE_URL/api/download" \
            -H "Content-Type: application/json" \
            -d "{
                \"apiKey\": \"test-key-concurrent-$i\",
                \"targetMonths\": [\"202504\"],
                \"selectedEntities\": [\"Europe - Retail\"],
                \"accountStructure\": {
                    \"Europe - Retail\": [\"MERCHANT-DE-BerlinStore$i\"]
                },
                \"reportTypes\": [\"monthly_finance\"],
                \"outputDir\": \"test-concurrent-$i\"
            }")
        
        if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
            DOWNLOAD_ID=$(echo "$RESPONSE" | jq -r '.downloadId')
            DOWNLOAD_IDS+=("$DOWNLOAD_ID")
            log_pass "Concurrent download $i started: $DOWNLOAD_ID"
        else
            log_fail "Concurrent download $i failed to start"
        fi
    done
    
    # Check all downloads are trackable
    for DOWNLOAD_ID in "${DOWNLOAD_IDS[@]}"; do
        STATUS=$(curl -s "$BASE_URL/api/download/$DOWNLOAD_ID/status")
        if echo "$STATUS" | jq -e '.status' > /dev/null; then
            log_pass "Concurrent download trackable: $DOWNLOAD_ID"
        else
            log_fail "Concurrent download not trackable: $DOWNLOAD_ID"
        fi
    done
}

# Run tests
run_test() {
    local test_name=$1
    case $test_name in
        "health") test_health ;;
        "upload") test_upload_structure ;;
        "single") test_single_month ;;
        "multi") test_multi_month ;;
        "all") test_all_reports ;;
        "invalid") test_invalid_api_key ;;
        "empty") test_empty_structure ;;
        "large") test_large_dataset ;;
        "zip") test_zip_download ;;
        "concurrent") test_concurrent_downloads ;;
        *) 
            echo "Unknown test: $test_name"
            echo "Available tests: health, upload, single, multi, all, invalid, empty, large, zip, concurrent"
            return 1
            ;;
    esac
}

# Main execution
if [ $# -eq 0 ]; then
    echo "=== Running All Tests ==="
    
    # Run all tests
    test_health
    test_upload_structure
    test_single_month
    test_multi_month
    test_all_reports
    test_invalid_api_key
    test_empty_structure
    test_large_dataset
    test_zip_download
    test_concurrent_downloads
    
    echo -e "\n=== Test Summary ==="
    echo -e "Passed: ${GREEN}$PASSED${NC}"
    echo -e "Failed: ${RED}$FAILED${NC}"
    echo -e "Total: $((PASSED + FAILED))"
    
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed!${NC}"
        exit 1
    fi
else
    echo "=== Running Single Test: $1 ==="
    run_test "$1"
fi
