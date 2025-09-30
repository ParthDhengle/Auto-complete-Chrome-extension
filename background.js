// background.js

// Listens for the extension's installation to set default values.
chrome.runtime.onInstalled.addListener(() => {
  // Set default values for the API model and key in chrome.storage.sync
  chrome.storage.sync.set({
    apiModel: 'gemini-2.5-flash-preview-05-20', // Default AI model
    apiKey: '' // API key is empty by default
  });
  console.log('IntelliType extension installed and default settings saved.');
});

// Listens for messages from content scripts.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Check if the message is intended to fetch a completion.
  if (request.action === 'fetchCompletion') {
    // Retrieve the stored API model and key.
    chrome.storage.sync.get(['apiModel', 'apiKey'], async ({ apiModel, apiKey }) => {
      if (!apiKey) {
        // If the API key is not set, send back an error.
        console.log('API key is not set. Please configure it in the options.');
        sendResponse({
          error: 'API key not configured.'
        });
        return;
      }

      // For now, instead of making a real API call, we simulate it.
      // This is where you would integrate your actual LLM API call.
      console.log('--- Context Received in Background ---');
      console.log(request.context);
      console.log('------------------------------------');

      // Simulate a response based on the context.
      // In a real scenario, this text would come from the LLM.
      const simulatedResponse = "is a powerful tool for developers.";
      setTimeout(() => {
        sendResponse({
          completion: simulatedResponse
        });
      }, 500); // Simulate network delay
    });

    // Return true to indicate that the response will be sent asynchronously.
    return true;
  }
});
