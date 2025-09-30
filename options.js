// options.js

document.addEventListener('DOMContentLoaded', () => {
    const apiModelSelect = document.getElementById('apiModel');
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('saveButton');
    const statusDiv = document.getElementById('status');

    // Function to show status message
    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = '';
        
        if (type === 'success') {
            statusDiv.classList.add('status-success');
        } else if (type === 'error') {
            statusDiv.classList.add('status-error');
        } else if (type === 'loading') {
            statusDiv.classList.add('status-loading');
        }
        
        statusDiv.style.opacity = '1';
    }

    // Function to hide status after delay
    function hideStatusAfterDelay(delay = 3000) {
        setTimeout(() => {
            statusDiv.style.opacity = '0';
        }, delay);
    }

    // Function to save options to chrome.storage.sync
    async function saveOptions() {
        const model = apiModelSelect.value;
        const key = apiKeyInput.value.trim();

        if (!key) {
            showStatus('Please enter an API key', 'error');
            hideStatusAfterDelay();
            return;
        }

        // Disable button and show loading
        saveButton.disabled = true;
        showStatus('Testing API key...', 'loading');

        try {
            // Test the API key
            const testResult = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: 'testApiKey',
                    apiKey: key,
                    apiModel: model
                }, resolve);
            });

            if (testResult.valid) {
                // Save the settings
                chrome.storage.sync.set({
                    apiModel: model,
                    apiKey: key,
                    isConfigured: true
                }, () => {
                    showStatus('✓ Settings saved successfully! Extension is now active.', 'success');
                    hideStatusAfterDelay(4000);
                    saveButton.disabled = false;
                });
            } else {
                showStatus('✗ ' + (testResult.message || 'API key validation failed'), 'error');
                hideStatusAfterDelay(5000);
                saveButton.disabled = false;
            }
        } catch (error) {
            showStatus('✗ Error testing API key: ' + error.message, 'error');
            hideStatusAfterDelay(5000);
            saveButton.disabled = false;
        }
    }

    // Function to restore saved options
    function restoreOptions() {
        chrome.storage.sync.get({
            apiModel: 'gemini-2.5-flash-preview-05-20',
            apiKey: '',
            isConfigured: false
        }, (items) => {
            apiModelSelect.value = items.apiModel;
            apiKeyInput.value = items.apiKey;
            
            if (items.isConfigured) {
                showStatus('Extension is configured and active', 'success');
                hideStatusAfterDelay(3000);
            } else {
                showStatus('Please configure your API key to get started', 'loading');
            }
        });
    }

    // Event listeners
    saveButton.addEventListener('click', saveOptions);
    
    // Allow Enter key to save
    apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveOptions();
        }
    });

    // Restore options on load
    restoreOptions();
});