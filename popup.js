// popup.js

document.addEventListener("DOMContentLoaded", () => {
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const statusDescription = document.getElementById("statusDescription");
  const usageText = document.getElementById("usageText");
  const optionsButton = document.getElementById("optionsButton");
  const reloadButton = document.getElementById("reloadButton");

  // Check extension configuration status
  function checkStatus() {
    chrome.storage.sync.get(["isConfigured", "apiConfigs"], (items) => {
      if (items.isConfigured && items.apiConfigs?.length > 0) {
        // Active
        statusDot.classList.add("active");
        statusDot.classList.remove("inactive");
        statusText.textContent = "Active";
        const primary = items.apiConfigs[0];
        statusDescription.textContent = `Using ${primary.provider} (${primary.model}). Start typing!`;

        // Get usage
        chrome.runtime.sendMessage({ action: "getUsage" }, (response) => {
          usageText.textContent = `Usage: ${response.usage || "N/A"}`;
        });
      } else {
        // Not configured
        statusDot.classList.add("inactive");
        statusDot.classList.remove("active");
        statusText.textContent = "Not Configured";
        statusDescription.textContent = "Configure API providers in settings.";
        usageText.textContent = "";
      }
    });
  }

  // Open options
  optionsButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Reload
  reloadButton.addEventListener("click", () => {
    chrome.runtime.reload();
  });

  checkStatus();
});