// --- State ---
let accountStructure = {};
let selectedEntities = new Set();
let isDownloading = false;
let currentDownloadId = null;
let currentUserId = null;
let apiKeyStored = false;

// --- DOM Elements ---
let apiKeyInput, toggleApiKeyBtn, apiKeyStatus, apiKeyStatusIndicator, apiKeyStatusText, startMonthInput, endMonthInput, monthSelectionSummary;
let outputDirInput, importStructureBtn, clearStructureBtn, addEntityBtn, selectAllBtn, deselectAllBtn;
let saveStructureBtn, accountContainer, entityCountEl, startDownloadBtn, cancelDownloadBtn;
let progressSection, progressText, progressBar, resultSummary, resultDetails, logContainer, fileInput;

// Modal elements
let modal, modalTitle, modalClose, modalCancel, modalAdd, groupNameInput, merchantAccountsTextarea;

// --- Secure API Key Management ---
function generateUserId() {
  // Generate a unique user ID based on browser fingerprint + timestamp
  const fingerprint = navigator.userAgent + navigator.language + screen.width + screen.height;
  const timestamp = Date.now();
  return btoa(fingerprint + timestamp).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
}

function initializeUserId() {
  // Check if user ID exists in localStorage
  let userId = localStorage.getItem('adyen_user_id');
  if (!userId) {
    userId = generateUserId();
    localStorage.setItem('adyen_user_id', userId);
  }
  currentUserId = userId;
}

function updateApiKeyStatus(stored, message = '') {
  if (!apiKeyStatus || !apiKeyStatusIndicator || !apiKeyStatusText) {
    return;
  }

  if (stored) {
    apiKeyStatus.className = 'api-key-status stored';
    apiKeyStatusText.textContent = message || 'API key stored securely';
  } else {
    apiKeyStatus.className = 'api-key-status error';
    apiKeyStatusText.textContent = message || 'API key not stored';
  }
  
  apiKeyStatus.style.display = 'flex';
}

// Client-side encryption for API key
async function encryptApiKey(apiKey) {
  // Simple XOR encryption for demo (in production, use proper crypto)
  const key = currentUserId + '-salt'; // Use user ID as part of key
  let encrypted = '';
  
  for (let i = 0; i < apiKey.length; i++) {
    encrypted += String.fromCharCode(
      apiKey.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  
  return btoa(encrypted); // Base64 encode for transmission
}

async function storeApiKey(apiKey) {
  if (!currentUserId) {
    showNotification('User session not initialized', 'error');
    return false;
  }

  try {
    // Encrypt API key before transmission
    const encryptedApiKey = await encryptApiKey(apiKey.trim());
    
    const response = await fetch('/api/store-api-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUserId,
        encryptedApiKey: encryptedApiKey
      })
    });

    const result = await response.json();
    
    if (result.success) {
      apiKeyStored = true;
      // Clear the API key input for security
      if (apiKeyInput) {
        apiKeyInput.value = '';
        apiKeyInput.placeholder = 'API key stored securely';
      }
      updateApiKeyStatus(true, 'API key stored securely');
      showNotification('API key stored securely', 'success');
      return true;
    } else {
      updateApiKeyStatus(false, result.error || 'Failed to store API key');
      showNotification(result.error || 'Failed to store API key', 'error');
      return false;
    }
  } catch (error) {
    console.error('Error storing API key:', error);
    updateApiKeyStatus(false, 'Failed to store API key');
    showNotification('Failed to store API key', 'error');
    return false;
  }
}

async function deleteStoredApiKey() {
  if (!currentUserId) {
    return false;
  }

  try {
    const response = await fetch(`/api/delete-api-key/${currentUserId}`, {
      method: 'DELETE'
    });

    const result = await response.json();
    
    if (result.success) {
      apiKeyStored = false;
      if (apiKeyInput) {
        apiKeyInput.value = '';
        apiKeyInput.placeholder = 'Enter your Adyen API key';
      }
      updateApiKeyStatus(false, 'API key deleted');
      showNotification('API key deleted', 'success');
      return true;
    } else {
      updateApiKeyStatus(false, result.error || 'Failed to delete API key');
      showNotification(result.error || 'Failed to delete API key', 'error');
      return false;
    }
  } catch (error) {
    console.error('Error deleting API key:', error);
    updateApiKeyStatus(false, 'Failed to delete API key');
    showNotification('Failed to delete API key', 'error');
    return false;
  }
}

// Initialize DOM elements
function initializeDOMElements() {
    apiKeyInput = document.getElementById("apiKey");
    toggleApiKeyBtn = document.getElementById("toggleApiKey");
    apiKeyStatus = document.getElementById("apiKeyStatus");
    apiKeyStatusIndicator = document.querySelector(".status-indicator");
    apiKeyStatusText = document.querySelector(".status-text");
    startMonthInput = document.getElementById("startMonth");
    endMonthInput = document.getElementById("endMonth");
    monthSelectionSummary = document.getElementById("monthSelectionSummary");
    outputDirInput = document.getElementById("outputDir");
    importStructureBtn = document.getElementById("importStructure");
    clearStructureBtn = document.getElementById("clearStructure");
    addEntityBtn = document.getElementById("addEntity");
    selectAllBtn = document.getElementById("selectAllEntities");
    deselectAllBtn = document.getElementById("deselectAllEntities");
    saveStructureBtn = document.getElementById("saveStructure");
    accountContainer = document.getElementById("accountStructureContainer");
    entityCountEl = document.querySelector(".entity-count");
    startDownloadBtn = document.getElementById("startDownload");
    cancelDownloadBtn = document.getElementById("cancelDownload");
    progressSection = document.getElementById("progressSection");
    progressText = document.getElementById("progressText");
    progressBar = document.getElementById("progressBar");
    resultSummary = document.getElementById("resultSummary");
    resultDetails = document.getElementById("resultDetails");
    logContainer = document.getElementById("logContainer");
    fileInput = document.getElementById("fileInput");
    
    // Modal elements
    modal = document.getElementById("modal");
    modalTitle = document.getElementById("modalTitle");
    modalClose = document.getElementById("modalClose");
    modalCancel = document.getElementById("modalCancel");
    modalAdd = document.getElementById("modalAdd");
    groupNameInput = document.getElementById("groupName");
    merchantAccountsTextarea = document.getElementById("merchantAccounts");
    
    console.log("importStructureBtn found:", importStructureBtn);
}

// --- Set default month to current month ---
function setDefaultMonth() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    if (startMonthInput && endMonthInput) {
        startMonthInput.value = `${yyyy}-${mm}`;
        endMonthInput.value = `${yyyy}-${mm}`;
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // API Key Toggle
    if (toggleApiKeyBtn) {
        toggleApiKeyBtn.addEventListener("click", () => {
            apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
        });
    }

    // Import Structure
    if (importStructureBtn) {
        importStructureBtn.addEventListener("click", () => {
            console.log("Import button clicked");
            console.log("fileInput element:", fileInput);
            if (fileInput) {
                fileInput.click();
            } else {
                console.error("fileInput element not found");
            }
        });
    }

    // File input change event
    if (fileInput) {
        fileInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            console.log("Importing file:", file.name, file.type, file.size);

            const formData = new FormData();
            formData.append("file", file);

            try {
                console.log("Sending request to /api/upload-structure");
                const response = await fetch("/api/upload-structure", {
                    method: "POST",
                    body: formData
                });

                console.log("Response status:", response.status);
                const result = await response.json();
                console.log("Response data:", result);

                if (result.success) {
                    accountStructure = result.data;
                    renderAccountStructure();
                    showNotification(`Account structure imported successfully! Loaded ${Object.keys(result.data).length} groups.`, "success");
                } else {
                    showNotification(`Import failed: ${result.error}`, "error");
                }
            } catch (error) {
                console.error("Import error:", error);
                showNotification(`Import failed: ${error.message}`, "error");
            }

            // Reset file input
            e.target.value = "";
        });
    }

    // Save Structure
    if (saveStructureBtn) {
        saveStructureBtn.addEventListener("click", async () => {
            try {
                const response = await fetch("/api/save-structure", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ data: accountStructure })
                });

                const result = await response.json();
                if (result.success) {
                    // Create download link
                    const blob = new Blob([result.data], { type: "application/json" });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = result.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    
                    showNotification("Account structure saved successfully", "success");
                } else {
                    showNotification(`Save failed: ${result.error}`, "error");
                }
            } catch (error) {
                showNotification(`Save failed: ${error.message}`, "error");
            }
        });
    }

    // Clear Structure
    if (clearStructureBtn) {
        clearStructureBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to clear all account structure data? This will remove all imported groups and merchant accounts.")) {
                accountStructure = {};
                selectedEntities.clear();
                renderAccountStructure();
                showNotification("Account structure cleared successfully", "success");
            }
        });
    }

    // Add Entity (Group)
    if (addEntityBtn) {
        addEntityBtn.addEventListener("click", () => {
            showModal("Add Group");
        });
    }

    // Select/Deselect All
    if (selectAllBtn) {
        selectAllBtn.addEventListener("click", () => {
            Object.keys(accountStructure).forEach(groupName => {
                selectedEntities.add(groupName);
            });
            renderAccountStructure();
        });
    }

    if (deselectAllBtn) {
        deselectAllBtn.addEventListener("click", () => {
            selectedEntities.clear();
            renderAccountStructure();
        });
    }

    // Start Download
    if (startDownloadBtn) {
        startDownloadBtn.addEventListener("click", () => {
            console.log("Start Download button clicked");
            console.log("startDownload function exists:", typeof startDownload);
            try {
                startDownload();
            } catch (error) {
                console.error("Error in startDownload:", error);
                showNotification("Download failed to start", "error");
            }
        });
    } else {
        console.error("startDownloadBtn not found");
    }

    // Cancel Download
    if (cancelDownloadBtn) {
        cancelDownloadBtn.addEventListener("click", () => {
            if (currentDownloadId) {
                fetch(`/api/download/${currentDownloadId}/cancel`, { method: "POST" })
                    .then(() => {
                        showNotification("Download cancelled", "info");
                        resetDownloadState();
                    })
                    .catch(error => {
                        console.error("Cancel error:", error);
                        showNotification("Failed to cancel download", "error");
                    });
            }
        });
    }

    // Modal Events
    if (modalClose) {
        modalClose.addEventListener("click", hideModal);
    }
    if (modalCancel) {
        modalCancel.addEventListener("click", hideModal);
    }
    if (modalAdd) {
        modalAdd.addEventListener("click", addGroup);
    }

    // Close modal on outside click
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                hideModal();
            }
        });
    }

    // Modal keyboard navigation
    if (groupNameInput) {
        groupNameInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                merchantAccountsTextarea.focus();
            }
        });
    }

    if (merchantAccountsTextarea) {
        merchantAccountsTextarea.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && e.ctrlKey) {
                addGroup();
            }
        });
    }
}

// --- Functions ---

function showModal(title = "Add Group") {
  modalTitle.textContent = title;
  modal.style.display = "flex";
  groupNameInput.value = "";
  merchantAccountsTextarea.value = "";
  groupNameInput.focus();
}

function hideModal() {
  modal.style.display = "none";
}

function addGroup() {
  const groupName = groupNameInput.value.trim();
  const merchantAccountsText = merchantAccountsTextarea.value.trim();

  if (!groupName) {
    alert("Please enter a group name");
    groupNameInput.focus();
    return;
  }

  const merchantAccounts = merchantAccountsText
    .split("\n")
    .map(ma => ma.trim())
    .filter(ma => ma.length > 0);

  if (merchantAccounts.length === 0) {
    alert("Please enter at least one merchant account");
    merchantAccountsTextarea.focus();
    return;
  }

  accountStructure[groupName] = merchantAccounts;
  selectedEntities.add(groupName);
  renderAccountStructure();
  hideModal();
}

function removeGroup(groupName) {
  if (confirm(`Remove group "${groupName}"?`)) {
    delete accountStructure[groupName];
    selectedEntities.delete(groupName);
    renderAccountStructure();
  }
}

function renderAccountStructure() {
  const groupNames = Object.keys(accountStructure);
  
  if (groupNames.length === 0) {
    accountContainer.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <p>No account structure loaded</p>
        <p>Import a JSON file or add groups manually to get started</p>
      </div>
    `;
    entityCountEl.textContent = "0 groups selected";
    return;
  }

  let html = "";
  groupNames.forEach(groupName => {
    const merchantAccounts = accountStructure[groupName];
    const isSelected = selectedEntities.has(groupName);
    
    html += `
      <div class="entity-card">
        <div class="entity-header">
          <input type="checkbox" 
                 id="entity-${groupName.replace(/[^a-zA-Z0-9]/g, '-')}" 
                 ${isSelected ? "checked" : ""} 
                 onchange="toggleEntity('${groupName}')">
          <label for="entity-${groupName.replace(/[^a-zA-Z0-9]/g, '-')}" class="entity-name">${groupName}</label>
          <span class="entity-toggle ${isSelected ? "expanded" : ""}">></span>
          <button type="button" class="remove-entity" onclick="removeGroup('${groupName}')">Remove</button>
        </div>
        <div class="entity-content ${isSelected ? "expanded" : ""}">
          <div class="merchant-list">
            ${merchantAccounts.map(ma => `<span class="merchant-tag">${ma}</span>`).join("")}
          </div>
        </div>
      </div>
    `;
  });

  accountContainer.innerHTML = html;
  entityCountEl.textContent = `${selectedEntities.size} of ${groupNames.length} groups selected`;

  // Add click handlers for entity headers
  document.querySelectorAll(".entity-header").forEach(header => {
    header.addEventListener("click", (e) => {
      if (e.target.type !== "checkbox" && !e.target.classList.contains("remove-entity")) {
        const card = header.closest(".entity-card");
        const content = card.querySelector(".entity-content");
        const toggle = card.querySelector(".entity-toggle");
        
        content.classList.toggle("expanded");
        toggle.classList.toggle("expanded");
      }
    });
  });
}

function toggleEntity(groupName) {
  if (selectedEntities.has(groupName)) {
    selectedEntities.delete(groupName);
  } else {
    selectedEntities.add(groupName);
  }
  renderAccountStructure();
}

function getSelectedReportTypes() {
  const reportTypes = [];
  if (document.getElementById("monthly_finance").checked) reportTypes.push("monthly_finance");
  if (document.getElementById("invoice").checked) reportTypes.push("invoice");
  if (document.getElementById("daily_payment_accounting").checked) reportTypes.push("daily_payment_accounting");
  if (document.getElementById("settlement_detail").checked) reportTypes.push("settlement_detail");
  return reportTypes;
}


async function startDownload() {
  console.log("=== START DOWNLOAD FUNCTION CALLED ===");
  
  // Check if required elements exist
  if (!apiKeyInput) {
    console.error("apiKeyInput is null");
    showNotification("API key input not found", "error");
    return;
  }
  
  if (!startMonthInput || !endMonthInput) {
    console.error("Month inputs are null");
    showNotification("Month inputs not found", "error");
    return;
  }
  
  // Validation
  const apiKey = apiKeyInput.value.trim();
  const targetMonths = getSelectedMonths();
  const outputDir = outputDirInput ? outputDirInput.value.trim() : "downloads";
  const reportTypes = getSelectedReportTypes();

  console.log("Validation check:", {
    apiKey: apiKey ? "present" : "missing",
    apiKeyStored: apiKeyStored,
    targetMonthsLength: targetMonths.length,
    reportTypesLength: reportTypes.length,
    selectedEntitiesSize: selectedEntities.size
  });

  // Check if API key is provided or already stored
  if (!apiKey && !apiKeyStored) {
    console.log("API key validation failed - no key provided or stored");
    showNotification("Please enter your API key", "error");
    apiKeyInput.focus();
    return;
  }

  // If API key is provided, always store it (to override any existing key)
  if (apiKey) {
    console.log("Storing new API key (overriding existing if present)...");
    const stored = await storeApiKey(apiKey);
    if (!stored) {
      return; // Storage failed, error already shown
    }
    // Clear the input field after successful storage
    apiKeyInput.value = '';
    console.log("API key input cleared after storage");
  }

  if (targetMonths.length === 0) {
    console.log("Target months validation failed");
    showNotification("Please select a valid date range", "error");
    startMonthInput.focus();
    return;
  }

  if (targetMonths.length > 12) {
    console.log("Too many months selected");
    showNotification("Maximum 12 months allowed", "error");
    startMonthInput.focus();
    return;
  }

  if (selectedEntities.size === 0) {
    showNotification("Please select at least one group", "error");
    return;
  }

  if (reportTypes.length === 0) {
    showNotification("Please select at least one report type", "error");
    return;
  }

  console.log("Starting download with:", {
    targetMonths,
    selectedEntities: Array.from(selectedEntities),
    reportTypes,
    accountStructureKeys: Object.keys(accountStructure)
  });

  // Start download
  isDownloading = true;
  startDownloadBtn.style.display = "none";
  cancelDownloadBtn.style.display = "inline-flex";
  progressSection.style.display = "block";
  resultSummary.style.display = "none";
  logContainer.innerHTML = "";

  try {
    const response = await fetch("/api/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: currentUserId,
        targetMonths,
        selectedEntities: Array.from(selectedEntities),
        accountStructure,
        reportTypes,
        outputDir
      })
    });

    const result = await response.json();
    console.log("Download started:", result);
    
    if (result.success) {
      currentDownloadId = result.downloadId;
      showNotification("Download started successfully", "success");
      startProgressTracking();
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error("Download start error:", error);
    showNotification(`Download failed: ${error.message}`, "error");
    resetDownloadState();
  }
}

async function cancelDownload() {
  if (!currentDownloadId) return;

  try {
    const response = await fetch(`/api/download/${currentDownloadId}/cancel`, {
      method: "POST"
    });

    const result = await response.json();
    if (result.success) {
      addLogEntry("Download cancelled", "info");
      resetDownloadState();
    }
  } catch (error) {
    addLogEntry(`Cancel failed: ${error.message}`, "error");
  }
}

function startProgressTracking() {
  if (!currentDownloadId) return;

  const trackProgress = async () => {
    try {
      const response = await fetch(`/api/download/${currentDownloadId}/status`);
      const status = await response.json();

      // Update progress
      const progress = status.progress || 0;
      const message = status.message || "Processing...";
      
      progressBar.style.width = `${progress}%`;
      progressPercent.textContent = `${Math.round(progress)}%`;
      progressText.textContent = message;

      // Add log entry
      if (status.status === "completed") {
        addLogEntry("Download completed successfully", "success");
        console.log("Download completed, status:", status);
        console.log("Status summary:", status.summary);
        showResults(status.summary);
        // Don't reset state here - let user download ZIP first
      } else if (status.status === "error") {
        addLogEntry(`Download failed: ${status.error}`, "error");
        resetDownloadState();
      } else if (status.status === "cancelled") {
        addLogEntry("Download cancelled", "info");
        resetDownloadState();
      } else {
        // Continue tracking
        setTimeout(trackProgress, 1000);
      }
    } catch (error) {
      addLogEntry(`Progress tracking failed: ${error.message}`, "error");
      resetDownloadState();
    }
  };

  trackProgress();
}

function showResults(summary) {
  console.log("=== SHOW RESULTS CALLED ===");
  console.log("summary:", summary);
  
  // Store the download ID before resetting state
  const downloadId = currentDownloadId;
  
  // Check if summary is defined
  if (!summary) {
    console.error("Summary is undefined in showResults");
    addLogEntry("Download completed but summary data is missing", "warning");
    return;
  }
  
  // Provide default values if properties are missing
  const downloadedFiles = summary.downloadedFiles || 0;
  const skippedFiles = summary.skippedFiles || 0;
  const errorFiles = summary.errorFiles || 0;
  const totalFiles = summary.totalFiles || 0;
  
  console.log("Result data:", { downloadedFiles, skippedFiles, errorFiles, totalFiles });
  
  resultSummary.style.display = "block";
  resultDetails.innerHTML = `
    <div class="result-stat">
      <div class="result-stat-value">${downloadedFiles}</div>
      <div class="result-stat-label">Files Downloaded</div>
    </div>
    <div class="result-stat">
      <div class="result-stat-value">${skippedFiles}</div>
      <div class="result-stat-label">Files Skipped</div>
    </div>
    <div class="result-stat">
      <div class="result-stat-value">${errorFiles}</div>
      <div class="result-stat-label">Errors</div>
    </div>
    <div class="result-stat">
      <div class="result-stat-value">${totalFiles}</div>
      <div class="result-stat-label">Total Files</div>
    </div>
    <div class="result-stat">
      <button type="button" id="downloadZipBtn" class="btn-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download ZIP File
      </button>
    </div>
    <div class="result-stat">
      <button type="button" id="newDownloadBtn" class="btn-secondary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        Start New Download
      </button>
    </div>
  `;

  // Add download button handler with stored download ID
  const downloadZipBtn = document.getElementById("downloadZipBtn");
  if (downloadZipBtn) {
    downloadZipBtn.addEventListener("click", () => {
      if (downloadId) {
        window.location.href = `/api/download/${downloadId}/zip`;
        showNotification("ZIP download started", "success");
      } else {
        showNotification("Download ID not found. Please start a new download.", "error");
      }
    });
  }

  // Add new download button handler
  const newDownloadBtn = document.getElementById("newDownloadBtn");
  if (newDownloadBtn) {
    newDownloadBtn.addEventListener("click", () => {
      resetDownloadState();
      progressSection.style.display = "none";
      resultSummary.style.display = "none";
      showNotification("Ready for new download", "info");
    });
  }

  if (summary.errors && summary.errors.length > 0) {
    const errorsHtml = summary.errors.map(err => 
      `<div class="log-entry error">${err.merchantAccount}: ${err.error}</div>`
    ).join("");
    logContainer.innerHTML += errorsHtml;
  }
}

function resetDownloadState() {
  isDownloading = false;
  currentDownloadId = null;
  startDownloadBtn.style.display = "inline-flex";
  cancelDownloadBtn.style.display = "none";
}

function addLogEntry(message, type = "info") {
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

// --- Month Range Functions ---
function generateMonthRange(startMonth, endMonth) {
  const months = [];
  const start = new Date(startMonth + '-01');
  const end = new Date(endMonth + '-01');
  
  // Validate date range
  if (start > end) {
    return [];
  }
  
  // Limit to 12 months maximum
  const maxEnd = new Date(start);
  maxEnd.setMonth(maxEnd.getMonth() + 11); // Add 11 months to get 12 total
  
  const actualEnd = end > maxEnd ? maxEnd : end;
  
  while (start <= actualEnd) {
    months.push(start.toISOString().slice(0, 7).replace('-', ''));
    start.setMonth(start.getMonth() + 1);
  }
  
  return months;
}

function updateMonthSelectionSummary() {
  const startMonth = startMonthInput.value;
  const endMonth = endMonthInput.value;
  const summaryText = monthSelectionSummary.querySelector('.summary-text');
  
  if (!startMonth || !endMonth) {
    summaryText.textContent = "Select months to download";
    summaryText.classList.remove('active');
    return;
  }
  
  const months = generateMonthRange(startMonth, endMonth);
  
  if (months.length === 0) {
    summaryText.textContent = "Invalid date range";
    summaryText.classList.remove('active');
  } else if (months.length === 1) {
    summaryText.textContent = `Downloading: ${formatMonthDisplay(months[0])}`;
    summaryText.classList.add('active');
  } else {
    summaryText.textContent = `Downloading: ${months.length} months (${formatMonthDisplay(months[0])} - ${formatMonthDisplay(months[months.length - 1])})`;
    summaryText.classList.add('active');
  }
}

function formatMonthDisplay(yyyymm) {
  const year = yyyymm.substring(0, 4);
  const month = yyyymm.substring(4, 6);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

function getSelectedMonths() {
  const startMonth = startMonthInput.value;
  const endMonth = endMonthInput.value;
  
  if (!startMonth || !endMonth) {
    return [];
  }
  
  return generateMonthRange(startMonth, endMonth);
}

function showNotification(message, type = "info") {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // Style the notification
  Object.assign(notification.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    padding: "12px 20px",
    borderRadius: "8px",
    color: "white",
    fontWeight: "500",
    zIndex: "10000",
    maxWidth: "300px",
    wordWrap: "break-word",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    transform: "translateX(100%)",
    transition: "transform 0.3s ease"
  });
  
  // Set background color based on type
  switch (type) {
    case "success":
      notification.style.backgroundColor = "#059669";
      break;
    case "error":
      notification.style.backgroundColor = "#dc2626";
      break;
    default:
      notification.style.backgroundColor = "#4f46e5";
  }
  
  // Add to page
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.transform = "translateX(0)";
  }, 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.transform = "translateX(100%)";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    initializeUserId();
    initializeDOMElements();
    setDefaultMonth();
    setupEventListeners();
    renderAccountStructure();
    updateMonthSelectionSummary();
    
    // Month input event listeners
    if (startMonthInput && endMonthInput) {
        startMonthInput.addEventListener("change", updateMonthSelectionSummary);
        endMonthInput.addEventListener("change", updateMonthSelectionSummary);
    }
});

// --- Initialize ---
renderAccountStructure();
