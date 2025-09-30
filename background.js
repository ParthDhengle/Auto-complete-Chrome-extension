// background.js

// Listens for the extension's installation to set default values and open options
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default values for the API model and key in chrome.storage.sync
    chrome.storage.sync.set({
      apiModel: 'gemini-2.5-flash-preview-05-20',
      apiKey: '',
      isConfigured: false
    }, () => {
      console.log('IntelliType extension installed.');
      // Open options page on first install
      chrome.runtime.openOptionsPage();
    });
  }
});

// Test API key validity
async function testApiKey(apiKey, apiModel) {
  try {
    // This is a placeholder for actual API validation
    // Replace with actual API endpoint based on the model
    console.log('Testing API key for model:', apiModel);
    
    // For now, simulate API test (replace with real API call later)
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate: if API key has minimum length, consider it valid
        const isValid = apiKey && apiKey.length > 10;
        resolve({
          valid: isValid,
          message: isValid ? 'API key is valid' : 'Invalid API key format'
        });
      }, 1000);
    });
  } catch (error) {
    return {
      valid: false,
      message: 'API test failed: ' + error.message
    };
  }
}

// Listens for messages from content scripts and options page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // Test API key validity
  if (request.action === 'testApiKey') {
    testApiKey(request.apiKey, request.apiModel).then(result => {
      sendResponse(result);
    });
    return true; // Async response
  }
  
  // Fetch completion
  if (request.action === 'fetchCompletion') {
    chrome.storage.sync.get(['apiModel', 'apiKey', 'isConfigured'], async ({ apiModel, apiKey, isConfigured }) => {
      if (!isConfigured || !apiKey) {
        console.log('API key is not configured. Please configure it in the options.');
        sendResponse({
          error: 'API key not configured. Please set up the extension in options.'
        });
        return;
      }

      console.log('--- Context Received in Background ---');
      console.log('Context length:', request.context.length);
      console.log('Context preview:', request.context.substring(0, 100) + '...');
      console.log('------------------------------------');

      // MOCK RESPONSE - Replace this with actual LLM API call
      const mockCompletions = [
        "and helps streamline your workflow efficiently.",
        "to enhance productivity across multiple platforms.",
        "that integrates seamlessly with your existing tools.",
        "providing intelligent suggestions in real-time.",
        "designed to make coding faster and easier."
      ];
      
      const simulatedResponse = mockCompletions[Math.floor(Math.random() * mockCompletions.length)];
      
      // Simulate network delay
      setTimeout(() => {
        sendResponse({
          completion: simulatedResponse
        });
      }, 300);
    });

    return true; // Async response
  }
  
  // Check if extension is configured
  if (request.action === 'checkConfiguration') {
    chrome.storage.sync.get(['isConfigured'], ({ isConfigured }) => {
      sendResponse({ isConfigured: isConfigured || false });
    });
    return true;
  }
});