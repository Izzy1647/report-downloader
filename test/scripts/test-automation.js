// Automated testing with Puppeteer
// Run with: node test-automation.js

const puppeteer = require('puppeteer');

async function testDownload() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    try {
        // Navigate to app
        await page.goto('http://localhost:3000');

        // Fill API Key
        await page.type('#apiKey', 'test-api-key');

        // Set date range
        await page.type('#startMonth', '2025-04');
        await page.type('#endMonth', '2025-05');

        // Upload account structure
        const fileInput = await page.$('#fileInput');
        await fileInput.uploadFile('../data/sample_account_structure.json');

        // Wait for upload to complete
        await page.waitForTimeout(2000);

        // Select first group
        await page.click('.entity-checkbox');

        // Start download
        await page.click('#startDownload');

        // Monitor progress
        await page.waitForSelector('#resultSummary', { timeout: 60000 });

        console.log('Download completed successfully!');

        // Get results
        const results = await page.$eval('#resultDetails', el => el.textContent);
        console.log('Results:', results);

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await browser.close();
    }
}

testDownload();
