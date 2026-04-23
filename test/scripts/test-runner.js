// Node.js Test Runner for Adyen Report Downloader
// Usage: node test-runner.js [test-type]

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const RESULTS_DIR = path.join(__dirname, '..', 'reports');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR);
}

// Test configuration
const TEST_CONFIG = {
    apiKey: 'test-api-key-runner',
    timeout: 30000, // 30 seconds
    retryAttempts: 3
};

// Helper functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const log = (message, type = 'info') => {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? 'ERROR' : type === 'success' ? 'SUCCESS' : 'INFO';
    console.log(`[${timestamp}] ${prefix}: ${message}`);
};

const saveResult = (filename, data) => {
    const filepath = path.join(RESULTS_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    log(`Saved result to ${filepath}`);
};

// Test cases
class TestRunner {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            tests: []
        };
    }

    async runTest(testName, testFunction) {
        log(`Starting test: ${testName}`);
        const startTime = Date.now();
        
        try {
            await testFunction();
            const duration = Date.now() - startTime;
            this.results.passed++;
            this.results.tests.push({
                name: testName,
                status: 'passed',
                duration,
                timestamp: new Date().toISOString()
            });
            log(`Test passed: ${testName} (${duration}ms)`, 'success');
        } catch (error) {
            const duration = Date.now() - startTime;
            this.results.failed++;
            this.results.tests.push({
                name: testName,
                status: 'failed',
                duration,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            log(`Test failed: ${testName} - ${error.message}`, 'error');
        }
    }

    async testHealthCheck() {
        const response = await axios.get(BASE_URL);
        if (!response.data.includes('Adyen Report Downloader')) {
            throw new Error('Health check failed - app not responding correctly');
        }
        saveResult('health_check.json', { status: 'healthy', response: response.data });
    }

    async testAccountStructureUpload() {
        const formData = new FormData();
        const sampleDataPath = path.join(__dirname, '..', 'data', 'sample_account_structure.json');
        const fileBuffer = fs.readFileSync(sampleDataPath);
        formData.append('file', new Blob([fileBuffer], { type: 'application/json' }), 'sample_account_structure.json');

        const response = await axios.post(`${BASE_URL}/api/upload-structure`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (!response.data.success) {
            throw new Error('Upload failed: ' + JSON.stringify(response.data));
        }

        saveResult('upload_response.json', response.data);
        return response.data.data; // Return account structure for other tests
    }

    async testSingleMonthDownload(accountStructure) {
        const payload = {
            apiKey: TEST_CONFIG.apiKey,
            targetMonths: ['202504'],
            selectedEntities: ['Europe - Retail'],
            accountStructure: {
                'Europe - Retail': ['MERCHANT-DE-BerlinStore']
            },
            reportTypes: ['monthly_finance'],
            outputDir: 'test-single-month'
        };

        const response = await axios.post(`${BASE_URL}/api/download`, payload);
        
        if (!response.data.success) {
            throw new Error('Download start failed: ' + JSON.stringify(response.data));
        }

        const downloadId = response.data.downloadId;
        saveResult('single_month_start.json', response.data);

        // Monitor progress
        await this.monitorDownload(downloadId, 'single_month');
        return downloadId;
    }

    async testMultiMonthDownload(accountStructure) {
        const payload = {
            apiKey: TEST_CONFIG.apiKey,
            targetMonths: ['202504', '202505', '202506'],
            selectedEntities: ['Europe - Retail', 'Asia - E-commerce'],
            accountStructure: {
                'Europe - Retail': ['MERCHANT-DE-BerlinStore', 'MERCHANT-DE-MunichStore'],
                'Asia - E-commerce': ['MERCHANT-SG-ECOM']
            },
            reportTypes: ['monthly_finance', 'invoice'],
            outputDir: 'test-multi-month'
        };

        const response = await axios.post(`${BASE_URL}/api/download`, payload);
        
        if (!response.data.success) {
            throw new Error('Multi-month download start failed: ' + JSON.stringify(response.data));
        }

        const downloadId = response.data.downloadId;
        saveResult('multi_month_start.json', response.data);

        // Monitor progress
        await this.monitorDownload(downloadId, 'multi_month');
        return downloadId;
    }

    async testAllReportTypes(accountStructure) {
        const payload = {
            apiKey: TEST_CONFIG.apiKey,
            targetMonths: ['202504'],
            selectedEntities: ['Europe - Retail'],
            accountStructure: {
                'Europe - Retail': ['MERCHANT-DE-BerlinStore']
            },
            reportTypes: ['monthly_finance', 'invoice', 'daily_payment_accounting', 'settlement_detail'],
            outputDir: 'test-all-reports'
        };

        const response = await axios.post(`${BASE_URL}/api/download`, payload);
        
        if (!response.data.success) {
            throw new Error('All reports download start failed: ' + JSON.stringify(response.data));
        }

        const downloadId = response.data.downloadId;
        saveResult('all_reports_start.json', response.data);

        // Monitor progress
        await this.monitorDownload(downloadId, 'all_reports');
        return downloadId;
    }

    async testErrorHandling() {
        const payload = {
            apiKey: 'invalid-api-key',
            targetMonths: ['202504'],
            selectedEntities: ['Europe - Retail'],
            accountStructure: {
                'Europe - Retail': ['MERCHANT-DE-BerlinStore']
            },
            reportTypes: ['monthly_finance'],
            outputDir: 'test-error-handling'
        };

        const response = await axios.post(`${BASE_URL}/api/download`, payload);
        
        if (!response.data.success) {
            throw new Error('Error handling test should have started download');
        }

        const downloadId = response.data.downloadId;
        saveResult('error_handling_start.json', response.data);

        // Wait for errors to occur
        await delay(5000);
        
        const status = await axios.get(`${BASE_URL}/api/download/${downloadId}/status`);
        saveResult('error_handling_status.json', status.data);

        if (status.data.errorFiles > 0) {
            log('Error handling test - errors detected as expected', 'success');
        } else {
            throw new Error('Expected errors not detected');
        }
    }

    async testEmptyStructure() {
        const payload = {
            apiKey: TEST_CONFIG.apiKey,
            targetMonths: ['202504'],
            selectedEntities: [],
            accountStructure: {},
            reportTypes: ['monthly_finance'],
            outputDir: 'test-empty-structure'
        };

        try {
            const response = await axios.post(`${BASE_URL}/api/download`, payload);
            // If we get here, validation failed
            throw new Error('Empty structure should have been rejected');
        } catch (error) {
            if (error.response && error.response.status >= 400) {
                log('Empty structure correctly rejected', 'success');
                saveResult('empty_structure_response.json', error.response.data);
            } else {
                throw error;
            }
        }
    }

    async testConcurrentDownloads(accountStructure) {
        const downloads = [];
        
        // Start 3 concurrent downloads
        for (let i = 1; i <= 3; i++) {
            const payload = {
                apiKey: `${TEST_CONFIG.apiKey}-concurrent-${i}`,
                targetMonths: ['202504'],
                selectedEntities: ['Europe - Retail'],
                accountStructure: {
                    'Europe - Retail': [`MERCHANT-DE-BerlinStore${i}`]
                },
                reportTypes: ['monthly_finance'],
                outputDir: `test-concurrent-${i}`
            };

            try {
                const response = await axios.post(`${BASE_URL}/api/download`, payload);
                if (response.data.success) {
                    downloads.push(response.data.downloadId);
                    log(`Concurrent download ${i} started: ${response.data.downloadId}`);
                }
            } catch (error) {
                log(`Concurrent download ${i} failed: ${error.message}`, 'error');
            }
        }

        // Check all downloads are trackable
        for (const downloadId of downloads) {
            try {
                const status = await axios.get(`${BASE_URL}/api/download/${downloadId}/status`);
                if (status.data.status) {
                    log(`Concurrent download trackable: ${downloadId}`, 'success');
                }
            } catch (error) {
                throw new Error(`Concurrent download not trackable: ${downloadId}`);
            }
        }

        saveResult('concurrent_downloads.json', { downloads, count: downloads.length });
    }

    async monitorDownload(downloadId, testName) {
        const maxAttempts = 30; // 30 attempts * 2 seconds = 1 minute max
        let attempts = 0;

        while (attempts < maxAttempts) {
            await delay(2000);
            attempts++;

            try {
                const status = await axios.get(`${BASE_URL}/api/download/${downloadId}/status`);
                saveResult(`${testName}_status_${attempts}.json`, status.data);

                if (status.data.status === 'completed') {
                    log(`Download completed: ${downloadId}`, 'success');
                    return status.data;
                } else if (status.data.status === 'error') {
                    log(`Download failed: ${downloadId}`, 'error');
                    return status.data;
                }

                log(`Progress check ${attempts}/${maxAttempts}: ${status.data.progress}% - ${status.data.message}`);
            } catch (error) {
                log(`Status check failed: ${error.message}`, 'error');
            }
        }

        throw new Error(`Download monitoring timeout for ${downloadId}`);
    }

    async testZIPDownload(downloadId) {
        try {
            const response = await axios.head(`${BASE_URL}/api/download/${downloadId}/zip`);
            
            if (response.headers['content-type'] !== 'application/zip') {
                throw new Error('Invalid content type for ZIP download');
            }

            saveResult('zip_download_headers.json', response.headers);
            log('ZIP download endpoint working', 'success');
        } catch (error) {
            throw new Error(`ZIP download test failed: ${error.message}`);
        }
    }

    async runAllTests() {
        log('=== Starting Comprehensive Test Suite ===');
        
        let accountStructure = null;
        let downloadIds = [];

        await this.runTest('Health Check', () => this.testHealthCheck());
        
        accountStructure = await this.runTest('Account Structure Upload', () => this.testAccountStructureUpload());
        
        const singleMonthId = await this.runTest('Single Month Download', () => this.testSingleMonthDownload(accountStructure));
        downloadIds.push(singleMonthId);
        
        const multiMonthId = await this.runTest('Multi-Month Download', () => this.testMultiMonthDownload(accountStructure));
        downloadIds.push(multiMonthId);
        
        const allReportsId = await this.runTest('All Report Types', () => this.testAllReportTypes(accountStructure));
        downloadIds.push(allReportsId);
        
        await this.runTest('Error Handling', () => this.testErrorHandling());
        await this.runTest('Empty Structure', () => this.testEmptyStructure());
        await this.runTest('Concurrent Downloads', () => this.testConcurrentDownloads(accountStructure));

        // Test ZIP download with a completed download
        if (downloadIds.length > 0) {
            await this.runTest('ZIP Download', () => this.testZIPDownload(downloadIds[0]));
        }

        // Print summary
        this.printSummary();
    }

    async runSpecificTest(testName) {
        const tests = {
            'health': () => this.testHealthCheck(),
            'upload': () => this.testAccountStructureUpload(),
            'single': async () => {
                const structure = await this.testAccountStructureUpload();
                await this.testSingleMonthDownload(structure);
            },
            'multi': async () => {
                const structure = await this.testAccountStructureUpload();
                await this.testMultiMonthDownload(structure);
            },
            'all': async () => {
                const structure = await this.testAccountStructureUpload();
                await this.testAllReportTypes(structure);
            },
            'error': () => this.testErrorHandling(),
            'empty': () => this.testEmptyStructure(),
            'concurrent': async () => {
                const structure = await this.testAccountStructureUpload();
                await this.testConcurrentDownloads(structure);
            },
            'zip': async () => {
                const structure = await this.testAccountStructureUpload();
                const id = await this.testSingleMonthDownload(structure);
                await this.testZIPDownload(id);
            }
        };

        if (tests[testName]) {
            await this.runTest(testName.charAt(0).toUpperCase() + testName.slice(1), tests[testName]);
            this.printSummary();
        } else {
            console.error(`Unknown test: ${testName}`);
            console.log('Available tests: health, upload, single, multi, all, error, empty, concurrent, zip');
        }
    }

    printSummary() {
        console.log('\n=== Test Summary ===');
        console.log(`Passed: ${this.results.passed}`);
        console.log(`Failed: ${this.results.failed}`);
        console.log(`Total: ${this.results.passed + this.results.failed}`);
        
        if (this.results.failed === 0) {
            log('All tests passed!', 'success');
        } else {
            log('Some tests failed!', 'error');
        }

        // Save summary
        saveResult('test_summary.json', this.results);
    }
}

// Main execution
async function main() {
    const runner = new TestRunner();
    const testType = process.argv[2];

    try {
        if (testType) {
            await runner.runSpecificTest(testType);
        } else {
            await runner.runAllTests();
        }
    } catch (error) {
        log(`Test suite failed: ${error.message}`, 'error');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = TestRunner;
