// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const statusDescription = document.getElementById('statusDescription');
    const optionsButton = document.getElementById('optionsButton');
    const reloadButton = document.getElementById('reloadButton');

    // Check extension configuration status
    function checkStatus() {
        chrome.storage.sync.get(['isConfigured', 'apiModel'], (items) => {
            if (items.isConfigured) {
                // Extension is configured and active
                statusDot.classList.add('active');
                statusDot.classList.remove('inactive');
                statusText.textContent = 'Active';
                statusDescription.textContent = `Extension is running with ${getModelDisplayName(items.apiModel)}. Start typing in any text field!`;
            } else {
                // Extension is not configured
                statusDot.classList.add('inactive');
                statusDot.classList.remove('active');
                statusText.textContent = 'Not Configured';
                statusDescription.textContent = 'Please configure your API key in settings to activate IntelliType.';
            }
        });
    }

    // Get user-friendly model name
    function getModelDisplayName(model) {
        const modelNames = {
            'gemini-2.5-flash-preview-05-20': 'Gemini 1.5 Flash',
            'openai-gpt-4': 'GPT-4',
            'openai-gpt-3.5': 'GPT-3.5',
            'anthropic-claude': 'Claude'
        };
        return modelNames[model] || model;
    }

    // Open options page
    optionsButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Reload extension (useful for debugging)
    reloadButton.addEventListener('click', () => {
        chrome.runtime.reload();
    });

    // Check status on popup load
    checkStatus();
});