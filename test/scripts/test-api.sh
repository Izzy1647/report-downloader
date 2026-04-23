#!/bin/bash

# Adyen Report Downloader API Test Script
# Usage: ./test-api.sh

BASE_URL="http://localhost:3000"
API_KEY="test-api-key-here-123456789012345678901234567890"

echo "=== Adyen Report Downloader API Test ==="

# Test 1: Upload Account Structure
echo "1. Testing account structure upload..."
curl -X POST "$BASE_URL/api/upload-structure" \
  -F "file=@../data/sample_account_structure.json" \
  | jq '.'

echo -e "\n"

# Test 2: Start Download
echo "2. Testing API key storage..."
# First store the API key securely
STORE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/store-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-12345",
    "apiKey": "'$API_KEY'"
  }')

echo "$STORE_RESPONSE" | jq '.'

# Check if API key was stored successfully
STORE_SUCCESS=$(echo "$STORE_RESPONSE" | jq -r '.success')
if [ "$STORE_SUCCESS" != "true" ]; then
    echo "FAIL: API key storage failed"
    exit 1
fi

echo "3. Testing download start with secure API key..."
DOWNLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/download" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-12345",
    "targetMonths": ["202504", "202505"],
    "selectedEntities": ["Europe - Retail", "Asia - E-commerce"],
    "accountStructure": {
      "Europe - Retail": ["MERCHANT-DE-BerlinStore", "MERCHANT-DE-MunichStore"],
      "Asia - E-commerce": ["MERCHANT-SG-ECOM"]
    },
    "reportTypes": ["monthly_finance"],
    "outputDir": "test-downloads"
  }')

echo "$DOWNLOAD_RESPONSE" | jq '.'

# Extract download ID
DOWNLOAD_ID=$(echo "$DOWNLOAD_RESPONSE" | jq -r '.downloadId')
echo "Download ID: $DOWNLOAD_ID"

echo -e "\n"

# Test 4: Check Progress
echo "4. Testing progress tracking..."
if [ "$DOWNLOAD_ID" != "null" ] && [ "$DOWNLOAD_ID" != "" ]; then
    for i in {1..10}; do
        echo "Check $i/10:"
        curl -s "$BASE_URL/api/download/$DOWNLOAD_ID/status" | jq '.status, .progress, .message'
        sleep 2
    done
else
    echo "Failed to get download ID"
fi

echo -e "\n"

# Test 5: Cleanup API key
echo "5. Testing API key cleanup..."
CLEANUP_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/delete-api-key/test-user-12345")
echo "$CLEANUP_RESPONSE" | jq '.'

echo -e "\n"

echo "=== Test Complete ==="
