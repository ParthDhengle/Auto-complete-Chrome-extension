// options.js

document.addEventListener('DOMContentLoaded', () => {
    const apiModelSelect = document.getElementById('apiModel');
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('saveButton');
    const statusDiv = document.getElementById('status');

    // Function to save options to chrome.storage.sync
    function saveOptions() {
        const model = apiModelSelect.value;
        const key = apiKeyInput.value;

        chrome.storage.sync.set({
            apiModel: model,
            apiKey: key
        }, () => {
            // Update status to let user know options were saved.
            statusDiv.textContent = 'Settings saved successfully!';
            setTimeout(() => {
                statusDiv.textContent = '';
            }, 2000);
        });
    }

    // Function to restore saved options
    function restoreOptions() {
        chrome.storage.sync.get({
            apiModel: 'gemini-2.5-flash-preview-05-20', // Default value
            apiKey: '' // Default value
        }, (items) => {
            apiModelSelect.value = items.apiModel;
            apiKeyInput.value = items.apiKey;
        });
    }

    // Event listeners
    saveButton.addEventListener('click', saveOptions);
    document.addEventListener('DOMContentLoaded', restoreOptions());
});
