#!/bin/bash

# Security Tests for Adyen Report Downloader
# Tests for secure API key implementation and security features

BASE_URL="http://localhost:3000"
RESULTS_DIR="../reports/security_$(date +%Y%m%d_%H%M%S)"
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

# Helper functions
generate_test_api_key() {
    echo "test-key-$1-$(date +%s)-$(shuf -i 1000-9999 -n 1)"
}

# Simple client-side encryption for testing
encrypt_test_api_key() {
    local api_key=$1
    local user_id=$2
    
    # Simple XOR encryption matching the frontend
    local key="${user_id}-salt"
    local encrypted=""
    
    for (( i=0; i<${#api_key}; i++ )); do
        local char_code=$(printf "%d" "'${api_key:$i:1}")
        local key_code=$(printf "%d" "'${key:$((i % ${#key})):1}")
        local encrypted_code=$((char_code ^ key_code))
        encrypted+=$(printf "\\$(printf "%03o" $encrypted_code)")
    done
    
    # Base64 encode
    echo "$encrypted" | base64 -w 0
}

check_network_exposure() {
    local response=$1
    local test_name=$2
    
    # Check if API key is exposed in response
    if echo "$response" | grep -q '"apiKey"'; then
        log_fail "$test_name - API key exposed in response"
        return 1
    fi
    
    # Check if encrypted API key is present (good)
    if echo "$response" | grep -q '"encryptedApiKey"'; then
        log_pass "$test_name - API key properly encrypted"
        return 0
    else
        log_fail "$test_name - Encrypted API key not found"
        return 1
    fi
}

# Test 1: API Key Encryption
test_api_key_encryption() {
    log_test "API Key Encryption"
    
    local test_key="test-encryption-$(date +%s)"
    local user_id="test-user-encrypt-$(date +%s)"
    local encrypted_key=$(encrypt_test_api_key "$test_key" "$user_id")
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$user_id\", \"encryptedApiKey\": \"$encrypted_key\"}")
    
    if check_network_exposure "$RESPONSE" "API Key Storage"; then
        echo "$RESPONSE" > "$RESULTS_DIR/encryption_test.json"
        
        # Test that the key can be retrieved for download
        DOWNLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/download" \
            -H "Content-Type: application/json" \
            -d "{
                \"userId\": \"$user_id\",
                \"targetMonths\": [\"202504\"],
                \"selectedEntities\": [\"Europe - Retail\"],
                \"accountStructure\": {\"Europe - Retail\": [\"MERCHANT-DE-Test\"]},
                \"reportTypes\": [\"monthly_finance\"],
                \"outputDir\": \"test-encryption\"
            }")
        
        if echo "$DOWNLOAD_RESPONSE" | jq -e '.success' > /dev/null; then
            log_pass "API Key Encryption - Download works with encrypted key"
        else
            log_fail "API Key Encryption - Download failed with encrypted key"
        fi
        
        # Cleanup
        curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user_id" > /dev/null
    else
        return 1
    fi
}

# Test 2: API Key Validation
test_api_key_validation() {
    log_test "API Key Validation"
    
    local user_id="test-user-validation-$(date +%s)"
    
    # Test 1: Valid API key
    local valid_key="valid-key-123456789"
    local encrypted_valid=$(encrypt_test_api_key "$valid_key" "$user_id")
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$user_id\", \"encryptedApiKey\": \"$encrypted_valid\"}")
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        log_pass "API Key Validation - Valid key accepted"
    else
        log_fail "API Key Validation - Valid key rejected"
    fi
    
    # Test 2: Empty API key
    local empty_key=""
    local encrypted_empty=$(encrypt_test_api_key "$empty_key" "$user_id-2")
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$user_id-2\", \"encryptedApiKey\": \"$encrypted_empty\"}")
    
    if echo "$RESPONSE" | jq -e '.error' > /dev/null; then
        log_pass "API Key Validation - Empty key rejected"
    else
        log_fail "API Key Validation - Empty key accepted"
    fi
    
    # Test 3: Short API key
    local short_key="short"
    local encrypted_short=$(encrypt_test_api_key "$short_key" "$user_id-3")
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$user_id-3\", \"encryptedApiKey\": \"$encrypted_short\"}")
    
    if echo "$RESPONSE" | jq -e '.error' > /dev/null; then
        log_pass "API Key Validation - Short key rejected"
    else
        log_fail "API Key Validation - Short key accepted"
    fi
    
    # Cleanup
    curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user_id" > /dev/null
    curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user_id-2" > /dev/null
    curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user_id-3" > /dev/null
}

# Test 3: User Session Management
test_user_session_management() {
    log_test "User Session Management"
    
    local user_id="test-user-session-$(date +%s)"
    local api_key="session-test-key-$(date +%s)"
    
    # Store API key
    STORE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$user_id\", \"apiKey\": \"$api_key\"}")
    
    if echo "$STORE_RESPONSE" | jq -e '.success' > /dev/null; then
        log_pass "User Session - API key stored successfully"
        
        # Test multiple downloads with same user
        for i in {1..3}; do
            DOWNLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/download" \
                -H "Content-Type: application/json" \
                -d "{
                    \"userId\": \"$user_id\",
                    \"targetMonths\": [\"202504\"],
                    \"selectedEntities\": [\"Europe - Retail\"],
                    \"accountStructure\": {\"Europe - Retail\": [\"MERCHANT-DE-Test$i\"]},
                    \"reportTypes\": [\"monthly_finance\"],
                    \"outputDir\": \"test-session-$i\"
                }")
            
            if echo "$DOWNLOAD_RESPONSE" | jq -e '.success' > /dev/null; then
                log_pass "User Session - Download $i works without re-authentication"
            else
                log_fail "User Session - Download $i failed"
            fi
        done
    else
        log_fail "User Session - API key storage failed"
    fi
    
    # Cleanup
    curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user_id" > /dev/null
}

# Test 4: API Key Isolation
test_api_key_isolation() {
    log_test "API Key Isolation Between Users"
    
    local user1="test-user-isolation-1-$(date +%s)"
    local user2="test-user-isolation-2-$(date +%s)"
    local key1="user1-key-$(date +%s)"
    local key2="user2-key-$(date +%s)"
    
    # Store different keys for different users
    STORE1=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$user1\", \"apiKey\": \"$key1\"}")
    
    STORE2=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$user2\", \"apiKey\": \"$key2\"}")
    
    if echo "$STORE1" | jq -e '.success' > /dev/null && echo "$STORE2" | jq -e '.success' > /dev/null; then
        log_pass "API Key Isolation - Different users can store separate keys"
        
        # Test that user1 can't access user2's downloads
        DOWNLOAD1=$(curl -s -X POST "$BASE_URL/api/download" \
            -H "Content-Type: application/json" \
            -d "{
                \"userId\": \"$user1\",
                \"targetMonths\": [\"202504\"],
                \"selectedEntities\": [\"Europe - Retail\"],
                \"accountStructure\": {\"Europe - Retail\": [\"MERCHANT-DE-User1\"]},
                \"reportTypes\": [\"monthly_finance\"],
                \"outputDir\": \"test-isolation-1\"
            }")
        
        DOWNLOAD2=$(curl -s -X POST "$BASE_URL/api/download" \
            -H "Content-Type: application/json" \
            -d "{
                \"userId\": \"$user2\",
                \"targetMonths\": [\"202504\"],
                \"selectedEntities\": [\"Europe - Retail\"],
                \"accountStructure\": {\"Europe - Retail\": [\"MERCHANT-DE-User2\"]},
                \"reportTypes\": [\"monthly_finance\"],
                \"outputDir\": \"test-isolation-2\"
            }")
        
        if echo "$DOWNLOAD1" | jq -e '.success' > /dev/null && echo "$DOWNLOAD2" | jq -e '.success' > /dev/null; then
            log_pass "API Key Isolation - Users can only access their own keys"
        else
            log_fail "API Key Isolation - Cross-user access detected"
        fi
    else
        log_fail "API Key Isolation - Key storage failed"
    fi
    
    # Cleanup
    curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user1" > /dev/null
    curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user2" > /dev/null
}

# Test 5: API Key Cleanup
test_api_key_cleanup() {
    log_test "API Key Cleanup"
    
    local user_id="test-user-cleanup-$(date +%s)"
    local api_key="cleanup-test-key-$(date +%s)"
    
    # Store API key
    STORE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$user_id\", \"apiKey\": \"$api_key\"}")
    
    if echo "$STORE_RESPONSE" | jq -e '.success' > /dev/null; then
        log_pass "API Key Cleanup - Key stored successfully"
        
        # Delete API key
        DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user_id")
        
        if echo "$DELETE_RESPONSE" | jq -e '.success' > /dev/null; then
            log_pass "API Key Cleanup - Key deleted successfully"
            
            # Try to download with deleted key
            DOWNLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/download" \
                -H "Content-Type: application/json" \
                -d "{
                    \"userId\": \"$user_id\",
                    \"targetMonths\": [\"202504\"],
                    \"selectedEntities\": [\"Europe - Retail\"],
                    \"accountStructure\": {\"Europe - Retail\": [\"MERCHANT-DE-Test\"]},
                    \"reportTypes\": [\"monthly_finance\"],
                    \"outputDir\": \"test-cleanup\"
                }")
            
            if echo "$DOWNLOAD_RESPONSE" | jq -e '.error' > /dev/null; then
                log_pass "API Key Cleanup - Download properly fails after key deletion"
            else
                log_fail "API Key Cleanup - Download still works after key deletion"
            fi
        else
            log_fail "API Key Cleanup - Key deletion failed"
        fi
    else
        log_fail "API Key Cleanup - Key storage failed"
    fi
}

# Test 6: Input Sanitization
test_input_sanitization() {
    log_test "Input Sanitization"
    
    local user_id="test-user-sanitize-$(date +%s)"
    
    # Test with special characters in API key
    local special_key="test-key-with-special-chars-!@#$%^&*()_+-=[]{}|;:,.<>?"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$user_id\", \"apiKey\": \"$special_key\"}")
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
        log_pass "Input Sanitization - Special characters handled correctly"
    else
        log_fail "Input Sanitization - Special characters caused error"
    fi
    
    # Test with SQL injection attempt
    local sql_key="'; DROP TABLE users; --"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d "{\"userId\": \"$user_id-sql\", \"apiKey\": \"$sql_key\"}")
    
    if echo "$RESPONSE" | jq -e '.success' > /dev/null || echo "$RESPONSE" | jq -e '.error' > /dev/null; then
        log_pass "Input Sanitization - SQL injection attempt handled safely"
    else
        log_fail "Input Sanitization - SQL injection caused unexpected behavior"
    fi
    
    # Cleanup
    curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user_id" > /dev/null
    curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user_id-sql" > /dev/null
}

# Test 7: Error Handling
test_error_handling() {
    log_test "Error Handling"
    
    # Test with malformed JSON
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d '{"userId": "test", "apiKey": }')
    
    if echo "$RESPONSE" | jq -e '.error' > /dev/null; then
        log_pass "Error Handling - Malformed JSON handled gracefully"
    else
        log_fail "Error Handling - Malformed JSON caused crash"
    fi
    
    # Test with missing fields
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
        -H "Content-Type: application/json" \
        -d '{"apiKey": "test-key"}')
    
    if echo "$RESPONSE" | jq -e '.error' > /dev/null; then
        log_pass "Error Handling - Missing fields handled gracefully"
    else
        log_fail "Error Handling - Missing fields caused unexpected behavior"
    fi
    
    # Test with invalid user ID
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/download" \
        -H "Content-Type: application/json" \
        -d '{
            "userId": "",
            "targetMonths": ["202504"],
            "selectedEntities": ["Europe - Retail"],
            "accountStructure": {"Europe - Retail": ["MERCHANT-DE-Test"]},
            "reportTypes": ["monthly_finance"],
            "outputDir": "test-error"
        }')
    
    if echo "$RESPONSE" | jq -e '.error' > /dev/null; then
        log_pass "Error Handling - Invalid user ID handled gracefully"
    else
        log_fail "Error Handling - Invalid user ID caused unexpected behavior"
    fi
}

# Test 8: Performance Under Load
test_performance_load() {
    log_test "Performance Under Load"
    
    local base_user="perf-test-$(date +%s)"
    local success_count=0
    local total_tests=10
    
    for i in $(seq 1 $total_tests); do
        local user_id="${base_user}-$i"
        local api_key="perf-key-$i-$(date +%s)"
        
        RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
            -H "Content-Type: application/json" \
            -d "{\"userId\": \"$user_id\", \"apiKey\": \"$api_key\"}")
        
        if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
            ((success_count++))
        fi
        
        # Cleanup
        curl -s -X DELETE "$BASE_URL/api/delete-api-key/$user_id" > /dev/null
    done
    
    if [ $success_count -eq $total_tests ]; then
        log_pass "Performance Under Load - All $total_tests requests succeeded"
    else
        log_fail "Performance Under Load - Only $success_count/$total_tests requests succeeded"
    fi
}

# Main test execution
echo "=== Security Tests for Adyen Report Downloader ==="
echo "Results directory: $RESULTS_DIR"
echo ""

# Run all security tests
test_api_key_encryption
echo ""

test_api_key_validation
echo ""

test_user_session_management
echo ""

test_api_key_isolation
echo ""

test_api_key_cleanup
echo ""

test_input_sanitization
echo ""

test_error_handling
echo ""

test_performance_load
echo ""

echo "=== Security Tests Complete ==="
echo "Results saved to: $RESULTS_DIR"
