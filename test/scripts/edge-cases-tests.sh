#!/bin/bash

# Edge Cases and Integration Tests for Adyen Report Downloader
# Tests for unusual scenarios and integration points

BASE_URL="http://localhost:3000"
RESULTS_DIR="../reports/edge-cases_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log_test() {
    echo -e "${YELLOW}TEST: $1${NC}"
}

log_pass() {
    echo -e "${GREEN}PASS: $1${NC}"
}

log_fail() {
    echo -e "${RED}FAIL: $1${NC}"
}

# Test 1: Extremely Long API Key
test_extremely_long_api_key() {
    log_test "Extremely Long API Key"
    
    local user_id="test-long-key-$(date +%s)"
    local long_key="test-key-$(printf 'a%.0s' {1..1000})"  # 1000+ character key
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$user_id\", \"apiKey\": \"$long_key\"}")
    
    if echo "$RESPONSE" | jq -e '.error' > /dev/null; then
        log_pass "Extremely Long API Key - Properly rejected"
    else
        log_fail "Extremely Long API Key - Should be rejected"
    fi
    
    # Cleanup
    curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user_id" > /dev/null
}

# Test 2: Unicode Characters in API Key
test_unicode_api_key() {
    log_test "Unicode Characters in API Key"
    
    local user_id="test-unicode-$(date +%s)"
    local unicode_key="test-key-ñáéíóú-emoji-ð-$(date +%s)"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$user_id\", \"apiKey\": \"$unicode_key\"}")
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        log_pass "Unicode Characters - Handled correctly"
        
        # Test download with unicode key
        DOWNLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/download" \
            -H "Content-Type: application/json" \
            -d "{
                \"userId\": \"$user_id\",
                \"targetMonths\": [\"202504\"],
                \"selectedEntities\": [\"Europe - Retail\"],
                \"accountStructure\": {\"Europe - Retail\": [\"MERCHANT-DE-Unicode\"]},
                \"reportTypes\": [\"monthly_finance\"],
                \"outputDir\": \"test-unicode\"
            }")
        
        if echo "$DOWNLOAD_RESPONSE" | jq -e '.success' > /dev/null; then
            log_pass "Unicode Characters - Download works correctly"
        else
            log_fail "Unicode Characters - Download failed"
        fi
    else
        log_fail "Unicode Characters - Not handled correctly"
    fi
    
    # Cleanup
    curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user_id" > /dev/null
}

# Test 3: Concurrent API Key Operations
test_concurrent_operations() {
    log_test "Concurrent API Key Operations"
    
    local base_user="concurrent-test-$(date +%s)"
    local success_count=0
    local total_operations=5
    
    # Start multiple concurrent operations
    for i in $(seq 1 $total_operations); do
        (
            local user_id="${base_user}-$i"
            local api_key="concurrent-key-$i-$(date +%s)"
            
            RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
                -H "Content-Type: application/json" \
                -d "{\"userId\": \"$user_id\", \"apiKey\": \"$api_key\"}")
            
            if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
                echo "SUCCESS:$i" >> "$RESULTS_DIR/concurrent_results.txt"
            else
                echo "FAIL:$i" >> "$RESULTS_DIR/concurrent_results.txt"
            fi
            
            # Cleanup
            curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user_id" > /dev/null
        ) &
    done
    
    # Wait for all background processes to complete
    wait
    
    # Count successful operations
    success_count=$(grep -c "SUCCESS" "$RESULTS_DIR/concurrent_results.txt" 2>/dev/null || echo "0")
    
    if [ $success_count -eq $total_operations ]; then
        log_pass "Concurrent Operations - All $total_operations operations succeeded"
    else
        log_fail "Concurrent Operations - Only $success_count/$total_operations operations succeeded"
    fi
}

# Test 4: Memory Leak Detection
test_memory_leak() {
    log_test "Memory Leak Detection"
    
    local base_user="memory-test-$(date +%s)"
    local iterations=20
    
    # Store and delete many keys to test memory cleanup
    for i in $(seq 1 $iterations); do
        local user_id="${base_user}-$i"
        local api_key="memory-test-key-$i-$(date +%s)"
        
        # Store key
        curl -s -X POST "$BASE_URL/api/store-api-key" \
            -H "Content-Type: application/json" \
            -d "{\"userId\": \"$user_id\", \"apiKey\": \"$api_key\"}" > /dev/null
        
        # Immediately delete key
        curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user_id" > /dev/null
    done
    
    # Check if server is still responsive
    HEALTH_RESPONSE=$(curl -s "$BASE_URL")
    if echo "$HEALTH_RESPONSE" | grep -q "Adyen Report Downloader"; then
        log_pass "Memory Leak Detection - Server still responsive after $iterations operations"
    else
        log_fail "Memory Leak Detection - Server became unresponsive"
    fi
}

# Test 5: Invalid User ID Formats
test_invalid_user_id_formats() {
    log_test "Invalid User ID Formats"
    
    local invalid_ids=(
        ""                    # Empty
        " "                   # Space only
        "user with spaces"    # Spaces
        "user@domain.com"     # Email format
        "user#123"            # Special characters
        "../../../etc/passwd"  # Path traversal attempt
        "$(printf 'a%.0s' {1..1000})"  # Very long
    )
    
    local failed_count=0
    
    for invalid_id in "${invalid_ids[@]}"; do
        RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
            -H "Content-Type: application/json" \
            -d "{\"userId\": \"$invalid_id\", \"apiKey\": \"test-key-$(date +%s)\"}")
        
        # Should either succeed (if system is permissive) or fail gracefully
        if echo "$RESPONSE" | jq -e '.success' > /dev/null || echo "$RESPONSE" | jq -e '.error' > /dev/null; then
            # Either success or graceful failure is acceptable
            continue
        else
            ((failed_count++))
        fi
        
        # Cleanup if successful
        if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
            curl -s -X DELETE "$BASE_URL/api/delete-api-key/$invalid_id" > /dev/null
        fi
    done
    
    if [ $failed_count -eq 0 ]; then
        log_pass "Invalid User ID Formats - All handled gracefully"
    else
        log_fail "Invalid User ID Formats - $failed_count cases caused issues"
    fi
}

# Test 6: Network Timeout Scenarios
test_network_timeouts() {
    log_test "Network Timeout Scenarios"
    
    local user_id="timeout-test-$(date +%s)"
    local api_key="timeout-test-key-$(date +%s)"
    
    # Test with very short timeout (simulated by immediate disconnect)
    RESPONSE=$(timeout 0.1s curl -s -X POST "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$user_id\", \"apiKey\": \"$api_key\"}" 2>/dev/null || echo '{"error":"timeout"}')
    
    # Should handle timeout gracefully
    if echo "$RESPONSE" | jq -e '.error' > /dev/null || [ "$RESPONSE" = '{"error":"timeout"}' ]; then
        log_pass "Network Timeout Scenarios - Timeout handled gracefully"
    else
        log_fail "Network Timeout Scenarios - Timeout not handled properly"
    fi
    
    # Cleanup if successful
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user_id" > /dev/null
    fi
}

# Test 7: Large Account Structure Upload
test_large_account_structure() {
    log_test "Large Account Structure Upload"
    
    # Create a large account structure
    local large_structure='{"Large Group": ['
    for i in {1..100}; do
        large_structure+='"MERCHANT-LARGE-'$i'"'
        if [ $i -lt 100 ]; then
            large_structure+=','
        fi
    done
    large_structure+=']}'
    
    # Save to temporary file
    local temp_file="$RESULTS_DIR/large_structure.json"
    echo "$large_structure" > "$temp_file"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload-structure" \
        -F "file=@$temp_file")
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        log_pass "Large Account Structure Upload - Handled correctly"
    else
        log_fail "Large Account Structure Upload - Failed"
    fi
    
    # Cleanup
    rm -f "$temp_file"
}

# Test 8: Rapid Successive Operations
test_rapid_successive_operations() {
    log_test "Rapid Successive Operations"
    
    local user_id="rapid-test-$(date +%s)"
    local api_key="rapid-test-key-$(date +%s)"
    local operations=10
    local success_count=0
    
    # Store key once
    STORE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$user_id\", \"apiKey\": \"$api_key\"}")
    
    if echo "$STORE_RESPONSE" | jq -e '.success' > /dev/null; then
        # Rapid successive downloads
        for i in $(seq 1 $operations); do
            DOWNLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/download" \
                -H "Content-Type: application/json" \
                -d "{
                    \"userId\": \"$user_id\",
                    \"targetMonths\": [\"202504\"],
                    \"selectedEntities\": [\"Europe - Retail\"],
                    \"accountStructure\": {\"Europe - Retail\": [\"MERCHANT-DE-Rapid$i\"]},
                    \"reportTypes\": [\"monthly_finance\"],
                    \"outputDir\": \"test-rapid-$i\"
                }")
            
            if echo "$DOWNLOAD_RESPONSE" | jq -e '.success' > /dev/null; then
                ((success_count++))
            fi
        done
        
        if [ $success_count -eq $operations ]; then
            log_pass "Rapid Successive Operations - All $operations operations succeeded"
        else
            log_fail "Rapid Successive Operations - Only $success_count/$operations operations succeeded"
        fi
    else
        log_fail "Rapid Successive Operations - Key storage failed"
    fi
    
    # Cleanup
    curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user_id" > /dev/null
}

# Test 9: Malformed JSON Requests
test_malformed_json() {
    log_test "Malformed JSON Requests"
    
    local malformed_requests=(
        '{"userId": "test", "apiKey":}'                    # Missing value
        '{"userId": "test", "apiKey": "key",}'             # Trailing comma
        '{"userId": "test", apiKey: "key"}'                # Missing quotes
        '{userId: "test", "apiKey": "key"}'                # Missing quotes around keys
        '{"userId": "test", "apiKey": "key"'               # Missing closing brace
        'not a json at all'                               # Not JSON
    )
    
    local handled_count=0
    
    for malformed in "${malformed_requests[@]}"; do
        RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
            -H "Content-Type: application/json" \
            -d "$malformed")
        
        if echo "$RESPONSE" | jq -e '.error' > /dev/null; then
            ((handled_count++))
        fi
    done
    
    if [ $handled_count -eq ${#malformed_requests[@]} ]; then
        log_pass "Malformed JSON Requests - All ${#malformed_requests[@]} handled gracefully"
    else
        log_fail "Malformed JSON Requests - Only $handled_count/${#malformed_requests[@]} handled gracefully"
    fi
}

# Test 10: HTTP Method Testing
test_http_methods() {
    log_test "HTTP Method Testing"
    
    local user_id="method-test-$(date +%s)"
    local api_key="method-test-key-$(date +%s)"
    
    # Test GET method (should fail)
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/store-api-key?userId=$user_id&apiKey=$api_key")
    
    if echo "$RESPONSE" | jq -e '.error' > /dev/null || [ "$RESPONSE" = "Cannot GET /api/store-api-key" ]; then
        log_pass "HTTP Method Testing - GET method properly rejected"
    else
        log_fail "HTTP Method Testing - GET method not rejected"
    fi
    
    # Test PUT method (should fail)
    RESPONSE=$(curl -s -X PUT "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$user_id\", \"apiKey\": \"$api_key\"}")
    
    if echo "$RESPONSE" | jq -e '.error' > /dev/null || [ "$RESPONSE" = "Cannot PUT /api/store-api-key" ]; then
        log_pass "HTTP Method Testing - PUT method properly rejected"
    else
        log_fail "HTTP Method Testing - PUT method not rejected"
    fi
    
    # Test PATCH method (should fail)
    RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$user_id\", \"apiKey\": \"$api_key\"}")
    
    if echo "$RESPONSE" | jq -e '.error' > /dev/null || [ "$RESPONSE" = "Cannot PATCH /api/store-api-key" ]; then
        log_pass "HTTP Method Testing - PATCH method properly rejected"
    else
        log_fail "HTTP Method Testing - PATCH method not rejected"
    fi
}

# Main test execution
echo "=== Edge Cases and Integration Tests ==="
echo "Results directory: $RESULTS_DIR"
echo ""

# Run all edge case tests
test_extremely_long_api_key
echo ""

test_unicode_api_key
echo ""

test_concurrent_operations
echo ""

test_memory_leak
echo ""

test_invalid_user_id_formats
echo ""

test_network_timeouts
echo ""

test_large_account_structure
echo ""

test_rapid_successive_operations
echo ""

test_malformed_json
echo ""

test_http_methods
echo ""

echo "=== Edge Cases and Integration Tests Complete ==="
echo "Results saved to: $RESULTS_DIR"
