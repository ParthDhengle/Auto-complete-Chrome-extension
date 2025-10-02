// background.js

// Listens for the extension's installation to set default values and open options
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Set default values
    chrome.storage.sync.set(
      {
        apiConfigs: [],
        isConfigured: false,
      },
      () => {
        console.log("IntelliType extension installed.");
        // Open options page on first install
        chrome.runtime.openOptionsPage();
      }
    );
  }
});


// Provider configurations
const providers = {
  "google-gemini": {
    getUrl: (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    getHeaders: (key) => ({ "Content-Type": "application/json" }),
    getBody: (prompt, model, maxTokens = 100) =>
      JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    getParams: (key) => `?key=${key}`,
    parseResponse: (json) => json.candidates[0].content.parts[0].text.trim(),
    testPrompt: "Hello",
    hasUsageApi: false,
  },
  openai: {
    getUrl: () => "https://api.openai.com/v1/chat/completions",
    getHeaders: (key) => ({ "Content-Type": "application/json", Authorization: `Bearer ${key}` }),
    getBody: (prompt, model, maxTokens = 100) =>
      JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
      }),
    parseResponse: (json) => json.choices[0].message.content.trim(),
    testPrompt: "Hello",
    hasUsageApi: false,
  },
  anthropic: {
    getUrl: () => "https://api.anthropic.com/v1/messages",
    getHeaders: (key) => ({
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    }),
    getBody: (prompt, model, maxTokens = 100) =>
      JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
      }),
    parseResponse: (json) => json.content[0].text.trim(),
    testPrompt: "Hello",
    hasUsageApi: false,
  },
  groq: {
    getUrl: () => "https://api.groq.com/openai/v1/chat/completions",
    getHeaders: (key) => ({ "Content-Type": "application/json", Authorization: `Bearer ${key}` }),
    getBody: (prompt, model, maxTokens = 100) =>
      JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
      }),
    parseResponse: (json) => json.choices[0].message.content.trim(),
    testPrompt: "test",
    hasUsageApi: true,
    getUsage: async (config) => {
      const url = providers["groq"].getUrl();
      const body = providers["groq"].getBody("test", config.model);
      const headers = providers["groq"].getHeaders(config.value);
      const res = await fetch(url, { method: "POST", headers, body });
      if (!res.ok) return "N/A";
      const limitRequests = res.headers.get("x-ratelimit-limit-requests");
      const remainingRequests = res.headers.get("x-ratelimit-remaining-requests");
      if (limitRequests && remainingRequests) {
        return `${Math.round((remainingRequests / limitRequests) * 100)}% remaining`;
      }
      return "N/A";
    },
  },
  deepseek: {
    getUrl: () => "https://api.deepseek.com/v1/chat/completions",
    getHeaders: (key) => ({ "Content-Type": "application/json", Authorization: `Bearer ${key}` }),
    getBody: (prompt, model, maxTokens = 100) =>
      JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
      }),
    parseResponse: (json) => json.choices[0].message.content.trim(),
    testPrompt: "Hello",
    hasUsageApi: false,
  },
  openrouter: {
    getUrl: () => "https://openrouter.ai/api/v1/chat/completions",
    getHeaders: (key) => ({ "Content-Type": "application/json", Authorization: `Bearer ${key}` }),
    getBody: (prompt, model, maxTokens = 100) =>
      JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
      }),
    parseResponse: (json) => json.choices[0].message.content.trim(),
    testPrompt: "Hello",
    hasUsageApi: true,
    getUsage: async (config) => {
      const url = "https://openrouter.ai/api/v1/key";
      const headers = { Authorization: `Bearer ${config.value}` };
      const res = await fetch(url, { method: "GET", headers });
      if (!res.ok) return "N/A";
      const json = await res.json();
      const { usage, limit, is_free_tier } = json.data;
      if (limit !== null) {
        return `${Math.round(((limit - usage) / limit) * 100)}% remaining`;
      } else if (is_free_tier) {
        return "Free Tier";
      } else {
        return "Unlimited";
      }
    },
  },
  ollama: {
    getUrl: (baseUrl) => `${baseUrl}/v1/chat/completions`,
    getHeaders: () => ({ "Content-Type": "application/json" }),
    getBody: (prompt, model, maxTokens = 100) =>
      JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
      }),
    parseResponse: (json) => json.choices[0].message.content.trim(),
    testPrompt: "Hello",
    hasUsageApi: false,
  },
  lmstudio: {
    getUrl: (baseUrl) => `${baseUrl}/v1/chat/completions`,
    getHeaders: () => ({ "Content-Type": "application/json" }),
    getBody: (prompt, model, maxTokens = 100) =>
      JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
      }),
    parseResponse: (json) => json.choices[0].message.content.trim(),
    testPrompt: "Hello",
    hasUsageApi: false,
  },
};

// Test API key validity
async function testApiKey(config) {
  try {
    const providerConfig = providers[config.provider];
    if (!providerConfig) {
      return { valid: false, message: 'Unsupported provider' };
    }

    let url = providerConfig.getUrl(config.model || config.value); // Use model where needed; value is key or baseUrl
    if (config.provider === 'google-gemini') {
      url += providerConfig.getParams(config.value);
    }
    const headers = providerConfig.getHeaders(config.value);
    const body = providerConfig.getBody(providerConfig.testPrompt, config.model, 10);
    const res = await fetch(url, { method: 'POST', headers, body });

    if (res.ok) {
      return { valid: true, message: 'API key is valid' };
    } else {
      const errorText = await res.text();
      return { valid: false, message: `API test failed: ${res.status} - ${errorText}` };
    }
  } catch (error) {
    return { valid: false, message: 'API test failed: ' + error.message };
  }
}

// Fetch completion using fallbacks
async function fetchCompletion(context) {
  // Updated prompt: More specific for autocomplete, emphasizes brevity for budget (reduces token usage/costs)
  const prompt = `You are an autocomplete assistant. Given the following text, provide ONLY the next 1-2 natural phrases or sentences to complete it concisely. Do not add explanations or extra text. Text to complete: "${context}"`;

  const { apiConfigs, isConfigured } = await chrome.storage.sync.get(["apiConfigs", "isConfigured"]);

  if (!isConfigured || !apiConfigs.length) {
    return { error: "No API configured. Please set up in options." };
  }

  for (const config of apiConfigs) {
    try {
      const providerConfig = providers[config.provider];
      let url = providerConfig.getUrl(config.model || config.value); // Handle model or baseUrl
      if (config.provider === "google-gemini") {
        url += providerConfig.getParams(config.value);
      }
      const headers = providerConfig.getHeaders(config.value);
      const body = providerConfig.getBody(prompt, config.model, 50);
      const res = await fetch(url, { method: "POST", headers, body });

      if (res.ok) {
        const json = await res.json();
        const completion = providerConfig.parseResponse(json);
        console.log(`Completion from ${config.provider}: ${completion}`); // Added logging for debugging
        return { completion };
      } else {
        // Broader fallback: Trigger on any error, but log details
        console.log(`Fallback triggered for ${config.provider}: ${res.status} - ${await res.text()}`);
        continue; // Try next config
      }
    } catch (error) {
      console.error(`Error with ${config.provider}: ${error.message}`);
      continue;
    }
  }

  return { error: "All APIs failed. Check configurations." };
}

// Improve full text using fallbacks
async function improveText(fullText) {
  const prompt = `Improve this text for better clarity, grammar, flow, and overall quality (like refining an email or document). Keep the original meaning and length similar: ${fullText}`;
  const { apiConfigs, isConfigured } = await chrome.storage.sync.get(["apiConfigs", "isConfigured"]);

  if (!isConfigured || !apiConfigs.length) {
    return { error: "No API configured. Please set up in options." };
  }

  for (const config of apiConfigs) {
    try {
      const providerConfig = providers[config.provider];
      let url = providerConfig.getUrl(config.model || config.value);
      if (config.provider === "google-gemini") {
        url += providerConfig.getParams(config.value);
      }
      const headers = providerConfig.getHeaders(config.value);
      const body = providerConfig.getBody(prompt, config.model, 1000);
      const res = await fetch(url, { method: "POST", headers, body });

      if (res.ok) {
        const json = await res.json();
        const improved = providerConfig.parseResponse(json);
        console.log(`Improved text from ${config.provider}: ${improved.substring(0, 100)}...`);
        return { improved };
      } else {
        console.log(`Fallback triggered for ${config.provider} in improve: ${res.status} - ${await res.text()}`);
        continue;
      }
    } catch (error) {
      console.error(`Error with ${config.provider} in improve: ${error.message}`);
      continue;
    }
  }

  return { error: "All APIs failed. Check configurations." };
}

// Get usage for current primary config
async function getUsage() {
  const { apiConfigs } = await chrome.storage.sync.get("apiConfigs");
  if (!apiConfigs || !apiConfigs.length) return "Not configured";

  const primary = apiConfigs[0];
  const providerConfig = providers[primary.provider];

  if (!providerConfig.hasUsageApi) {
    return primary.provider === "deepseek" || primary.provider === "ollama" || primary.provider === "lmstudio"
      ? "Unlimited"
      : "N/A";
  }

  return await providerConfig.getUsage(primary);
}

// Listens for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "testApiKey") {
    testApiKey(request.config).then(sendResponse);
    return true;
  }

  if (request.action === "fetchCompletion") {
    console.log("--- Context Received ---");
    console.log("Context length:", request.context.length);
    console.log("Context preview:", request.context.substring(0, 100) + "...");
    console.log("Full context:", request.context); // Added for debugging
    fetchCompletion(request.context).then(sendResponse);
    return true;
  }

  if (request.action === "improveText") {
    console.log("--- Improve Text Received ---");
    console.log("Text length:", request.text.length);
    improveText(request.text).then(sendResponse);
    return true;
  }

  if (request.action === "checkConfiguration") {
    chrome.storage.sync.get("isConfigured", ({ isConfigured }) => {
      sendResponse({ isConfigured: isConfigured || false });
    });
    return true;
  }

  if (request.action === "getUsage") {
    getUsage().then((usage) => sendResponse({ usage }));
    return true;
  }
  if (request.action === "updateIcon") {
    const theme = request.theme;
    chrome.action.setIcon({
      path: theme === "dark"
        ? {
            16: "icons/NOVA_icon_white(dark)16.png",
            32: "icons/NOVA_icon_white(dark)32.png",
            48: "icons/NOVA_icon_white(dark)48.png",
            128: "icons/NOVA_icon_white(dark)128.png"
          }
        : {
            16: "icons/NOVA_icon_black(dark)16.png",
            32: "icons/NOVA_icon_black(dark)32.png",
            48: "icons/NOVA_icon_black(dark)48.png",
            128: "icons/NOVA_icon_black(dark)128.png"
          }
    });
  }
});