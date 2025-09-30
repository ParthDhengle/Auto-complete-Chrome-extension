// options.js

document.addEventListener("DOMContentLoaded", () => {
  const configsDiv = document.getElementById("configs");
  const addFallbackButton = document.getElementById("addFallback");
  const saveButton = document.getElementById("saveButton");
  const helpButton = document.getElementById("helpButton");
  const statusDiv = document.getElementById("status");

  const localProviders = ["ollama", "lmstudio"];
  const defaultModels = {
    'google-gemini': "gemini-1.5-flash",
    openai: "gpt-3.5-turbo",
    anthropic: "claude-3-5-sonnet-20240620",
    groq: "llama-3.1-8b-instant",
    deepseek: "deepseek-chat",
    openrouter: "meta-llama/llama-3.3-8b-instruct:free",
    ollama: "llama3",
    lmstudio: "gpt2", // example
  };
  const defaultUrls = {
    ollama: "http://localhost:11434",
    lmstudio: "http://localhost:1234",
  };

  // Function to create a config form group
  function createConfig(index, saved = {}) {
    const configDiv = document.createElement("div");
    configDiv.className = "config";
    configDiv.dataset.index = index;

    configDiv.innerHTML = `
      <div class="form-group">
        <label for="provider-${index}">AI Provider</label>
        <select id="provider-${index}">
          <option value="google-gemini">Google Gemini</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="groq">Groq</option>
          <option value="deepseek">Deepseek</option>
          <option value="openrouter">OpenRouter</option>
          <option value="ollama">Ollama (Local)</option>
          <option value="lmstudio">LM Studio (Local)</option>
        </select>
      </div>
      <div class="form-group">
        <label for="model-${index}">Model</label>
        <input type="text" id="model-${index}" placeholder="e.g. gemini-1.5-flash">
      </div>
      <div class="form-group">
        <label id="valueLabel-${index}" for="value-${index}">API Key</label>
        <input type="password" id="value-${index}" placeholder="Enter your API key or base URL">
        <div class="help-text">Stored locally and never shared</div>
      </div>
      ${index > 0 ? '<button class="remove-config" style="background: #ff5630; color: white; width: 100%; margin-top: 10px;">Remove</button>' : ""}
    `;

    const providerSelect = configDiv.querySelector(`#provider-${index}`);
    const modelInput = configDiv.querySelector(`#model-${index}`);
    const valueInput = configDiv.querySelector(`#value-${index}`);
    const valueLabel = configDiv.querySelector(`#valueLabel-${index}`);

    providerSelect.value = saved.provider || "google-gemini";
    modelInput.value = saved.model || defaultModels[providerSelect.value];
    valueInput.value = saved.value || "";

    updateInputType(providerSelect.value, valueLabel, valueInput, modelInput);

    providerSelect.addEventListener("change", (e) => {
      const prov = e.target.value;
      modelInput.value = defaultModels[prov];
      updateInputType(prov, valueLabel, valueInput, modelInput);
    });

    if (index > 0) {
      configDiv.querySelector(".remove-config").addEventListener("click", () => {
        configDiv.remove();
      });
    }

    return configDiv;
  }

  function updateInputType(provider, label, input, modelInput) {
    if (localProviders.includes(provider)) {
      label.textContent = "Base URL";
      input.type = "text";
      input.value = defaultUrls[provider];
      input.placeholder = "e.g. http://localhost:11434";
    } else {
      label.textContent = "API Key";
      input.type = "password";
      input.placeholder = "Enter your API key";
    }
  }

  // Show status
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = "";
    if (type) statusDiv.classList.add(`status-${type}`);
    statusDiv.style.opacity = "1";
  }

  // Hide status after delay
  function hideStatusAfterDelay(delay = 3000) {
    setTimeout(() => {
      statusDiv.style.opacity = "0";
    }, delay);
  }

  // Save and test
  async function saveOptions() {
    const configElements = configsDiv.querySelectorAll(".config");
    const configs = [];

    for (const el of configElements) {
      const index = el.dataset.index;
      const provider = document.getElementById(`provider-${index}`).value;
      const model = document.getElementById(`model-${index}`).value.trim();
      const value = document.getElementById(`value-${index}`).value.trim();

      if (!model || !value) {
        showStatus("Please fill all fields for each config", "error");
        hideStatusAfterDelay();
        return;
      }

      configs.push({ provider, model, value });
    }

    if (!configs.length) {
      showStatus("Add at least one provider", "error");
      hideStatusAfterDelay();
      return;
    }

    saveButton.disabled = true;
    showStatus("Testing configurations...", "loading");

    let allValid = true;
    for (const config of configs) {
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "testApiKey", config }, resolve);
      });
      if (!result.valid) {
        showStatus(`Invalid config for ${config.provider}: ${result.message}`, "error");
        hideStatusAfterDelay(5000);
        allValid = false;
        break;
      }
    }

    if (allValid) {
      chrome.storage.sync.set(
        {
          apiConfigs: configs,
          isConfigured: true,
        },
        () => {
          showStatus("✓ Configurations saved and tested successfully!", "success");
          hideStatusAfterDelay(4000);
        }
      );
    }

    saveButton.disabled = false;
  }

  // Restore options
  function restoreOptions() {
    chrome.storage.sync.get({ apiConfigs: [], isConfigured: false }, (items) => {
      if (items.apiConfigs.length === 0) {
        configsDiv.appendChild(createConfig(0));
      } else {
        items.apiConfigs.forEach((config, index) => {
          configsDiv.appendChild(createConfig(index, config));
        });
      }

      if (items.isConfigured) {
        showStatus("Extension is configured", "success");
        hideStatusAfterDelay(3000);
      } else {
        showStatus("Configure providers to start", "loading");
      }
    });
  }

  // Add fallback
  addFallbackButton.addEventListener("click", () => {
    const index = configsDiv.querySelectorAll(".config").length;
    configsDiv.appendChild(createConfig(index));
  });

  // Help button
  helpButton.addEventListener("click", () => {
    chrome.tabs.create({ url: "providers.html" });
  });

  // Save
  saveButton.addEventListener("click", saveOptions);

  restoreOptions();
});