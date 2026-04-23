# Test Suite for Adyen Report Downloader

This directory contains comprehensive test suites for the Adyen Report Downloader web application.

## Directory Structure

```
test/
|-- scripts/           # Test execution scripts
|   |-- test-api.sh            # Basic API testing
|   |-- comprehensive-tests.sh # Full coverage testing
|   |-- test-runner.js         # Node.js test runner
|   |-- test-automation.js     # Browser automation
|-- data/              # Test data and configurations
|   |-- sample_account_structure.json
|   |-- test-scenarios.json
|-- reports/           # Test results and outputs
|-- docs/              # Test documentation
```

## Quick Start

### 1. Basic API Test
```bash
cd test/scripts
./test-api.sh
```

### 2. Comprehensive Test Suite
```bash
cd test/scripts
./comprehensive-tests.sh
```

### 3. Node.js Test Runner
```bash
cd test/scripts
node test-runner.js
```

### 4. Browser Automation
```bash
cd test/scripts
node test-automation.js
```

## Test Coverage

### Core Functionality
- **Health Check**: Server status verification
- **Account Structure Upload**: JSON file upload testing
- **Single Month Download**: Basic download functionality
- **Multi-Month Download**: Multi-month processing
- **All Report Types**: Complete report type coverage
- **Progress Tracking**: Real-time progress monitoring
- **ZIP Generation**: File download verification

### Edge Cases
- **Error Handling**: Invalid API keys, network errors
- **Validation**: Empty structures, invalid inputs
- **Performance**: Large datasets (50+ accounts)
- **Concurrency**: Multiple simultaneous downloads
- **Timeout**: Long-running operations

### UI Testing
- **Form Validation**: Input field validation
- **User Workflow**: Complete user journey
- **File Upload**: Drag-and-drop functionality
- **Progress Display**: UI progress indicators

## Test Data

### Sample Account Structure
Located at `test/data/sample_account_structure.json`:
```json
{
  "Sample Group 1": ["MerchantAccount1", "MerchantAccount2"],
  "Sample Group 2": ["MerchantAccount3", "MerchantAccount4"]
}
```

### Test Scenarios
Located at `test/data/test-scenarios.json`:
- `single_month`: Single month download test
- `multi_month`: Multi-month download test
- `all_reports`: All report types test

## Test Results

Results are saved in `test/reports/`:
- JSON response files
- Error logs
- Performance metrics
- Test summaries

## Usage Examples

### Run Specific Test
```bash
# Test single month download
./comprehensive-tests.sh single

# Test multi-month functionality
./comprehensive-tests.sh multi

# Test error handling
./comprehensive-tests.sh invalid
```

### Node.js Testing
```bash
# Run all tests
node test-runner.js

# Run specific test
node test-runner.js health
node test-runner.js upload
node test-runner.js multi
```

### Debug Mode
```bash
# Enable detailed logging
DEBUG=true node test-runner.js

# Monitor specific download
curl http://localhost:3000/api/download/{id}/status | jq '.'
```

## Requirements

### System Requirements
- Node.js 14+
- curl
- jq (for shell scripts)
- Puppeteer (for browser automation)

### Installation
```bash
# Install Node.js dependencies
npm install

# Install Puppeteer for browser testing
npm install puppeteer

# Make shell scripts executable
chmod +x test/scripts/*.sh
```

## Configuration

### Environment Variables
- `BASE_URL`: Default http://localhost:3000
- `API_KEY`: Test API key
- `TIMEOUT`: Request timeout (default 30s)

### Test Configuration
Edit test scripts to modify:
- API endpoints
- Test data
- Timeout values
- Retry attempts

## Troubleshooting

### Common Issues

1. **Server Not Running**
   ```bash
   npm start
   ```

2. **Permission Denied**
   ```bash
   chmod +x test/scripts/*.sh
   ```

3. **Missing Dependencies**
   ```bash
   npm install
   ```

4. **Port Already in Use**
   ```bash
   lsof -ti:3000 | xargs kill
   ```

### Debug Tips

1. **Check Server Logs**: Monitor console output
2. **Verify Test Data**: Ensure JSON files are valid
3. **Network Issues**: Check firewall/proxy settings
4. **Browser Testing**: Use headful mode for debugging

## Contributing

### Adding New Tests

1. Create test function in appropriate script
2. Add to test runner configuration
3. Update documentation
4. Test with existing suite

### Test Naming Convention

- Use descriptive names
- Follow snake_case for shell scripts
- Use camelCase for JavaScript functions
- Include test purpose in comments

## Best Practices

1. **Isolation**: Tests should not depend on each other
2. **Cleanup**: Reset state between tests
3. **Logging**: Provide clear test output
4. **Error Handling**: Graceful failure handling
5. **Documentation**: Keep README updated

## Continuous Integration

### GitHub Actions Example
```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm start &
      - run: sleep 10
      - run: cd test/scripts && ./comprehensive-tests.sh
```

## Performance Testing

### Load Testing
```bash
# Concurrent downloads test
./comprehensive-tests.sh concurrent

# Large dataset test
./comprehensive-tests.sh large
```

### Metrics
- Response times
- Memory usage
- CPU utilization
- Network throughput

## Security Testing

### Input Validation
- SQL injection attempts
- XSS vulnerabilities
- File upload security
- API rate limiting

### Authentication
- Invalid API keys
- Session management
- Token validation
- Permission checks

## Reports

### Test Summary
After running tests, check `test/reports/test_summary.json` for:
- Pass/fail counts
- Execution times
- Error details
- Performance metrics

### Coverage Report
Generate coverage report:
```bash
npm run coverage
```

## Support

For issues with:
- **Test Framework**: Check this README
- **Application**: See main project README
- **Dependencies**: Check package.json
- **Environment**: Verify system requirements
