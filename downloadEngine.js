const axios = require("axios");
const path = require("path");
const JSZip = require("jszip");

const BASE_REPORT_URL = "https://ca-live.adyen.com/reports/download/MerchantAccount/";
const FILENAME_REGEX = /<a\s+[^>]*>([^<]+)<\/a>/g;

/**
 * Parses the HTML content of the reports listing page and extracts all available filenames.
 */
function extractFilenamesFromHtml(htmlString) {
  const filenames = [];
  let match;
  while ((match = FILENAME_REGEX.exec(htmlString)) !== null) {
    if (match[1] && match[1].trim() !== "") {
      filenames.push(match[1].trim());
    }
  }
  FILENAME_REGEX.lastIndex = 0;
  return filenames;
}

/**
 * Determines the report type and the subdirectory to save the report based on its filename.
 */
function getReportTypeAndDirectory(filename) {
  const lowerFilename = filename.toLowerCase();

  // 1. Monthly Finance Report
  if (lowerFilename.includes("monthly_finance_report")) {
    return { type: "monthly_finance", dir: "monthly_finance_reports" };
  }

  // 2. Daily Payment Accounting Report
  if (lowerFilename.includes("payments_accounting_report") && lowerFilename.endsWith(".csv")) {
    return {
      type: "daily_payment_accounting",
      dir: "daily_payment_accounting",
    };
  }

  // 3. Invoice Overview
  if (lowerFilename.includes("invoice") || lowerFilename.endsWith(".pdf")) {
    return { type: "invoice", dir: "invoices_overview" };
  }

  // 4. Settlement Detail Report
  if (lowerFilename.includes("settlement_detail_report") && lowerFilename.endsWith(".csv")) {
    return { type: "settlement_detail", dir: "settlement_detail_reports" };
  }

  // Default fallback
  return { type: "unknown", dir: "other_reports" };
}

/**
 * Checks if a filename corresponds to the target month for different report types.
 */
function isFilenameForTargetMonth(filename, targetMonth) {
  const lowerFilename = filename.toLowerCase();
  
  // Monthly Finance and Daily Payment Accounting: format YYYY_MM
  const monthlyFinanceRegex = /(\d{4})_(\d{2})/;
  const monthlyMatch = lowerFilename.match(monthlyFinanceRegex);
  if (monthlyMatch) {
    const fileYear = monthlyMatch[1];
    const fileMonth = monthlyMatch[2];
    return `${fileYear}${fileMonth}` === targetMonth;
  }
  
  // Invoice Overview: format invoice-XXYYYYMM...
  const invoiceRegex = /invoice-[a-z]{2}(\d{6})/;
  const invoiceMatch = lowerFilename.match(invoiceRegex);
  if (invoiceMatch) {
    return invoiceMatch[1] === targetMonth;
  }
  
  // Settlement Detail: format YYYYMMDD suffix or no date
  const settlementRegex = /(\d{6})\.csv$/;
  const settlementMatch = lowerFilename.match(settlementRegex);
  if (settlementMatch) {
    // Check if the 6 digits before .csv match target month
    const datePart = settlementMatch[1];
    return datePart.startsWith(targetMonth.substring(2)); // Compare MMDD part
  }
  
  // For settlement detail reports without date, always include
  if (lowerFilename.includes("settlement_detail_report") && !settlementMatch) {
    return true;
  }
  
  return false;
}

/**
 * Creates folder structure in ZIP archive.
 */
function ensureFolderInZip(zip, folderPath) {
  const parts = folderPath.split('/');
  let currentPath = '';
  
  for (const part of parts) {
    if (part) {
      currentPath += (currentPath ? '/' : '') + part;
      if (!zip.folder(currentPath)) {
        zip.folder(currentPath);
      }
    }
  }
}

/**
 * Formats month display from YYYYMM to "Month YYYY".
 */
function formatMonthDisplay(yyyymm) {
  const year = yyyymm.substring(0, 4);
  const month = yyyymm.substring(4, 6);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

/**
 * Main download engine that orchestrates the report downloading process for web app.
 */
async function runDownload({
  apiKey,
  targetMonths,
  selectedEntities,
  accountStructure,
  reportTypes,
  outputDir,
  abortController,
  onProgress,
  onComplete,
  onError
}) {
  try {
    console.log('=== DOWNLOAD ENGINE STARTED ===');
    console.log('Parameters:', {
      targetMonths,
      selectedEntities,
      reportTypes,
      accountStructureKeys: Object.keys(accountStructure),
      apiKeyLength: apiKey ? apiKey.length : 0
    });

    const zip = new JSZip();
    let totalFiles = 0;
    let downloadedFiles = 0;
    let skippedFiles = 0;
    let errorFiles = 0;
    const errors = [];

    // Ensure selectedEntities is an array
    const selectedGroups = Array.isArray(selectedEntities) ? selectedEntities : Array.from(selectedEntities);
    
    console.log(`Selected groups: ${selectedGroups.length}`, selectedGroups);

    // Calculate total operations for progress tracking (months × groups × accounts)
    let totalOperations = 0;
    let operationsPerMonth = [];
    
    for (let monthIndex = 0; monthIndex < targetMonths.length; monthIndex++) {
      let monthOperations = 0;
      for (const groupName of selectedGroups) {
        const merchantAccounts = accountStructure[groupName] || [];
        monthOperations += merchantAccounts.length;
      }
      operationsPerMonth.push(monthOperations);
      totalOperations += monthOperations;
    }

    console.log(`Total operations to process: ${totalOperations}`);
    console.log(`Operations per month:`, operationsPerMonth);

    onProgress(0, `Starting download for ${targetMonths.length} months and ${selectedGroups.length} groups...`);

    let completedOperations = 0;

    // Process each month
    for (let monthIndex = 0; monthIndex < targetMonths.length; monthIndex++) {
      const targetMonth = targetMonths[monthIndex];
      
      console.log(`Processing month ${monthIndex + 1}/${targetMonths.length}: ${targetMonth}`);
      
      // Process each selected group
      for (let groupIndex = 0; groupIndex < selectedGroups.length; groupIndex++) {
        const groupName = selectedGroups[groupIndex];
        const merchantAccounts = accountStructure[groupName] || [];

        console.log(`Processing group ${groupIndex + 1}/${selectedGroups.length}: ${groupName} with ${merchantAccounts.length} accounts`);

        // Calculate progress for this group (before processing accounts)
        const groupProgress = (completedOperations / totalOperations) * 100;
        
        onProgress(
          Math.round(groupProgress),
          `Processing ${formatMonthDisplay(targetMonth)} - ${groupName} (${merchantAccounts.length} accounts)`
        );

        // Process each merchant account in the group
        for (let maIndex = 0; maIndex < merchantAccounts.length; maIndex++) {
          const merchantAccount = merchantAccounts[maIndex];
          
          const operationProgress = (completedOperations / totalOperations) * 100;
          
          console.log(`Processing merchant account ${maIndex + 1}/${merchantAccounts.length}: ${merchantAccount} (${Math.round(operationProgress)}% complete)`);
          
          completedOperations++;
          
          // Check if download was cancelled
          if (abortController.signal.aborted) {
            throw new Error('Download cancelled by user');
          }

          try {
            const reportUrl = `${BASE_REPORT_URL}${merchantAccount}/`;
            console.log(`Fetching reports from: ${reportUrl}`);
            
            const fetchProgress = (completedOperations / totalOperations) * 100;
            onProgress(
              Math.round(fetchProgress * 0.8), // Use 80% of progress for fetching
              `Fetching reports for ${merchantAccount} (${formatMonthDisplay(targetMonth)})...`
            );

            // Fetch the reports listing page
            const response = await axios.get(reportUrl, {
              headers: {
                'X-API-Key': apiKey,
                'User-Agent': 'Adyen-Report-Downloader/1.0'
              },
              signal: abortController.signal,
              timeout: 30000
            });

            console.log(`Response status: ${response.status}, data length: ${response.data.length}`);

            const filenames = extractFilenamesFromHtml(response.data);
            console.log(`Found ${filenames.length} files for ${merchantAccount}:`, filenames.slice(0, 5)); // Show first 5
            
            const baseFolder = `reports_${targetMonths[0]}_${targetMonths[targetMonths.length - 1]}/${targetMonth}/${groupName}/${merchantAccount}`;

            // Filter reports by type and month
            const filteredReports = filenames.filter(filename => {
              const { type } = getReportTypeAndDirectory(filename);
              return reportTypes.includes(type) && isFilenameForTargetMonth(filename, targetMonth);
            });

            console.log(`Filtered to ${filteredReports.length} files matching criteria:`, filteredReports.slice(0, 3));

          if (filteredReports.length === 0) {
            console.log(`No matching files for ${merchantAccount}, skipping...`);
            skippedFiles++;
            continue;
          }

          // Download each filtered report and add to ZIP
          for (const filename of filteredReports) {
            if (abortController.signal.aborted) {
              throw new Error('Download cancelled by user');
            }

            try {
              const { dir } = getReportTypeAndDirectory(filename);
              const filePath = `${baseFolder}/${dir}/${filename}`;
              const fileUrl = `${reportUrl}${encodeURIComponent(filename)}`;

              console.log(`Downloading file: ${filename} from ${fileUrl}`);

              const fileResponse = await axios.get(fileUrl, {
                headers: {
                  'X-API-Key': apiKey,
                  'User-Agent': 'Adyen-Report-Downloader/1.0'
                },
                signal: abortController.signal,
                timeout: 60000,
                responseType: 'arraybuffer'
              });

              console.log(`Downloaded ${filename}, size: ${fileResponse.data.length} bytes`);

              // Add file to ZIP
              zip.file(filePath, fileResponse.data);
              downloadedFiles++;
              console.log(`Added ${filename} to ZIP, total downloaded: ${downloadedFiles}`);

            } catch (fileError) {
              console.error(`Failed to download ${filename}:`, fileError.message);
              errorFiles++;
              errors.push({
                merchantAccount,
                filename,
                error: fileError.message
              });
            }
          }

        } catch (maError) {
          errorFiles++;
          errors.push({
            merchantAccount,
            error: maError.message
          });
        }
      }
    }
    }

    // Generate ZIP buffer
    console.log('=== GENERATING ZIP ===');
    console.log(`Final stats: ${downloadedFiles} downloaded, ${skippedFiles} skipped, ${errorFiles} errors`);
    
    onProgress(90, 'Creating ZIP file...');
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    console.log(`ZIP generated successfully, size: ${zipBuffer.length} bytes`);

    // Complete
    const summary = {
      totalFiles,
      downloadedFiles,
      skippedFiles,
      errorFiles,
      errors: errors.slice(0, 10), // Limit errors to prevent huge responses
      outputDir: `reports_${targetMonths[0]}_${targetMonths[targetMonths.length - 1]}`,
      completedAt: new Date().toISOString(),
      zipBuffer: zipBuffer,
      zipFilename: `adyen_reports_${targetMonths[0]}_${targetMonths[targetMonths.length - 1]}.zip`
    };

    console.log('=== DOWNLOAD COMPLETED ===');
    console.log('Summary:', summary);

    onComplete(summary);

  } catch (error) {
    console.error('=== DOWNLOAD FAILED ===');
    console.error('Error:', error);
    onError(error);
  }
}

module.exports = { runDownload };
