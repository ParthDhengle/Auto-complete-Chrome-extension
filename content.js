// content.js

let activeElement = null;
let ghostTextElement = null;
let suggestionPanel = null;
let debounceTimer;
let isExtensionConfigured = false;

// --- Utility Functions ---

/**
 * Check if extension is properly configured
 */
async function checkConfiguration() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "checkConfiguration" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("IntelliType: Error checking configuration", chrome.runtime.lastError);
        resolve(false);
      } else {
        resolve(response?.isConfigured || false);
      }
    });
  });
}

/**
 * Get the full current text from the active element
 */
function getCurrentText(element) {
  return element.isContentEditable ? element.innerText : element.value;
}

/**
 * Creates and styles the ghost text element that overlays the suggestion.
 */
function createGhostTextElement() {
  const ghost = document.createElement("span");
  ghost.id = "intellitype-ghost";
  ghost.setAttribute("aria-hidden", "true");
  document.body.appendChild(ghost);
  return ghost;
}

/**
 * Creates and shows the improvement suggestion panel
 */
function showSuggestionPanel(improvedText) {
  if (suggestionPanel) {
    hideSuggestionPanel();
  }

  suggestionPanel = document.createElement("div");
  suggestionPanel.id = "intellitype-suggestion-panel";
  suggestionPanel.innerHTML = `
    <div style="position: fixed; bottom: 0; left: 0; width: 100%; height: 300px; background: white; border-top: 1px solid #ccc; z-index: 10000; display: flex; flex-direction: column; box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);">
      <div style="padding: 10px; background: #f0f0f0; border-bottom: 1px solid #ccc; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
        <span>AI Improved Text (Press Tab to accept, Esc to dismiss, Ctrl+Shift+Enter to regenerate)</span>
        <button id="panel-close" style="background: #ff5630; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Close</button>
      </div>
      <div id="panel-content" style="flex: 1; padding: 10px; overflow: auto; white-space: pre-wrap; font-family: inherit; font-size: inherit; line-height: 1.5;">
        ${improvedText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}
      </div>
    </div>
  `;
  document.body.appendChild(suggestionPanel);

  // Handle close button
  const closeBtn = suggestionPanel.querySelector("#panel-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => hideSuggestionPanel());
  }
}

/**
 * Hides the suggestion panel
 */
function hideSuggestionPanel() {
  if (suggestionPanel) {
    suggestionPanel.remove();
    suggestionPanel = null;
  }
}

/**
 * Accepts the improved text and replaces the original
 */
function acceptImprovement() {
  if (!activeElement || !suggestionPanel) return;

  const contentDiv = suggestionPanel.querySelector("#panel-content");
  if (!contentDiv) return;
  let improvedText = contentDiv.innerHTML.replace(/<br>/g, '\n').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  // Strip any remaining HTML if needed
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = improvedText;
  improvedText = tempDiv.textContent || tempDiv.innerText || '';

  const wasContentEditable = activeElement.isContentEditable;

  // Replace the text
  if (wasContentEditable) {
    activeElement.innerText = improvedText;
    // Move cursor to end
    const sel = window.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(activeElement);
    range.collapse(false);
    sel.addRange(range);
  } else {
    activeElement.value = improvedText;
    activeElement.selectionStart = activeElement.selectionEnd = improvedText.length;
  }

  // Dispatch input event
  activeElement.dispatchEvent(new Event("input", { bubbles: true }));
  activeElement.focus();

  hideSuggestionPanel();
  hideGhostText();
}

/**
 * Get context around cursor position (up to 100 lines before and after)
 */
function getContext(element) {
  const text = element.isContentEditable ? element.innerText : element.value;

  // If text is small, return all
  if (text.length < 5000) {
    return text;
  }

  // For larger text, get context around cursor
  const cursorPos = element.selectionStart || text.length;
  const lines = text.split("\n");

  let charCount = 0;
  let startLine = 0;
  let endLine = lines.length;

  // Find cursor line
  for (let i = 0; i < lines.length; i++) {
    charCount += lines[i].length + 1; // +1 for newline
    if (charCount >= cursorPos) {
      // Get 100 lines before and after
      startLine = Math.max(0, i - 100);
      endLine = Math.min(lines.length, i + 100);
      break;
    }
  }

  return lines.slice(startLine, endLine).join("\n");
}

/**
 * Get the absolute caret position coordinates.
 */
function getCaretPosition(element) {
  const isContentEditable = element.isContentEditable;
  const rect = element.getBoundingClientRect();
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;

  if (isContentEditable) {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0).cloneRange();
      range.collapse(true);
      const rects = range.getClientRects();
      if (rects.length > 0) {
        const caretRect = rects[0];
        return {
          top: caretRect.top + scrollY,
          left: caretRect.left + scrollX,
          height: caretRect.height,
        };
      }
    }
    // Fallback
    return {
      top: rect.top + scrollY,
      left: rect.left + scrollX,
      height: parseFloat(window.getComputedStyle(element).lineHeight),
    };
  } else {
    // For input/textarea
    const text = element.value;
    const cursorPos = element.selectionStart;
    const prefix = text.substring(0, cursorPos);

    const mirror = document.createElement("div");
    const style = window.getComputedStyle(element);

    const props = [
      "boxSizing",
      "borderTopWidth",
      "borderBottomWidth",
      "borderLeftWidth",
      "borderRightWidth",
      "paddingTop",
      "paddingBottom",
      "paddingLeft",
      "paddingRight",
      "fontFamily",
      "fontSize",
      "fontStyle",
      "fontVariant",
      "fontWeight",
      "textAlign",
      "textTransform",
      "textIndent",
      "letterSpacing",
      "wordSpacing",
      "lineHeight",
      "whiteSpace",
      "wordWrap",
      "overflowWrap",
      "wordBreak",
      "tabSize",
      "-moz-tab-size",
      "direction",
    ];

    for (let prop of props) {
      mirror.style[prop] = style[prop];
    }

    mirror.style.position = "absolute";
    mirror.style.top = "-9999px";
    mirror.style.left = "-9999px";
    mirror.style.visibility = "hidden";
    mirror.style.width = element.clientWidth + "px";
    mirror.style.height = "auto";
    mirror.style.overflow = "hidden";

    const textNode = document.createTextNode(prefix);
    mirror.appendChild(textNode);

    // Add span for position
    const span = document.createElement("span");
    span.innerHTML = "&nbsp;"; // Non-empty to measure
    mirror.appendChild(span);

    document.body.appendChild(mirror);

    const coordinates = {
      top: span.offsetTop,
      left: span.offsetLeft,
      height: span.offsetHeight,
    };

    document.body.removeChild(mirror);

    return {
      top: rect.top + scrollY + coordinates.top,
      left: rect.left + scrollX + coordinates.left,
      height: coordinates.height,
    };
  }
}

/**
 * Positions the ghost text element to align perfectly with the text in the active input.
 */
function positionGhostText(targetElement, ghostElement, suggestion) {
  if (!targetElement || !ghostElement || !document.contains(targetElement) || !document.contains(ghostElement)) return;

  try {
    const computedStyle = window.getComputedStyle(targetElement);
    const caret = getCaretPosition(targetElement);
    if (!caret) return;

    const targetRect = targetElement.getBoundingClientRect();

    // Calculate remaining width to prevent horizontal overflow
    const remainingWidth = targetRect.left + targetRect.width - caret.left;

    // Set dynamic styles only; fixed styles (color, opacity, pointer-events) are in CSS
    ghostElement.style.position = "absolute";
    ghostElement.style.top = caret.top + "px";
    ghostElement.style.left = caret.left + "px";
    ghostElement.style.font = computedStyle.font;
    ghostElement.style.letterSpacing = computedStyle.letterSpacing;
    ghostElement.style.whiteSpace = computedStyle.whiteSpace;
    ghostElement.style.wordWrap = computedStyle.wordWrap;
    ghostElement.style.overflowWrap = computedStyle.overflowWrap || "break-word"; // Ensure long words break if needed
    ghostElement.style.maxWidth = remainingWidth + "px";
    ghostElement.style.display = "inline-block";
    ghostElement.textContent = suggestion;
  } catch (e) {
    console.error("Error positioning ghost text:", e);
    hideGhostText();
  }
}

/**
 * Hides the ghost text.
 */
function hideGhostText() {
  if (ghostTextElement) {
    try {
      ghostTextElement.style.display = "none";
      ghostTextElement.textContent = "";
    } catch (e) {
      console.error("Error hiding ghost text:", e);
    }
  }
}

/**
 * Accepts the current suggestion and inserts it into the active element.
 */
function acceptSuggestion() {
  if (!activeElement || !ghostTextElement || !ghostTextElement.textContent || !document.contains(activeElement)) {
    return;
  }

  const suggestion = ghostTextElement.textContent;

  try {
    if (activeElement.isContentEditable) {
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(suggestion));
        range.collapse(false);
      }
    } else {
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      const text = activeElement.value;
      activeElement.value = text.substring(0, start) + suggestion + text.substring(end);
      activeElement.selectionStart = activeElement.selectionEnd = start + suggestion.length;
    }

    hideGhostText();
    activeElement.dispatchEvent(new Event("input", { bubbles: true }));
  } catch (e) {
    console.error("Error accepting suggestion:", e);
  }
}

// --- Event Handlers ---

function handleFocusIn(e) {
  const el = e.target;
  // Support all text inputs, textareas, and contenteditable elements
  if (
    el.matches(
      'input[type="text"], input[type="email"], input[type="search"], input[type="url"], textarea, [contenteditable="true"]'
    ) ||
    (el.tagName === "INPUT" && !el.type) || // Default input type
    el.isContentEditable
  ) {
    activeElement = el;
    console.log("IntelliType: Active on", el.tagName, el.type || "contenteditable");
  } else {
    activeElement = null;
    hideGhostText();
    hideSuggestionPanel();
  }
}

/**
 * Main handler for keyboard input on the active element.
 */
async function handleInput(e) {
  if (!activeElement || !document.contains(activeElement)) return;
  if (!isExtensionConfigured) return;

  hideGhostText();
  clearTimeout(debounceTimer);

  const context = getContext(activeElement);

  if (context.trim().length === 0) {
    return;
  }

  debounceTimer = setTimeout(() => {
    if (!activeElement || !document.contains(activeElement)) return;

    console.log("IntelliType: Fetching completion for context length:", context.length);

    chrome.runtime.sendMessage(
      {
        action: "fetchCompletion",
        context: context,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("IntelliType Error:", chrome.runtime.lastError.message);
          return;
        }

        if (response && response.completion && activeElement && document.contains(activeElement)) {
          console.log("IntelliType: Received completion:", response.completion);
          positionGhostText(activeElement, ghostTextElement, response.completion);
        } else if (response && response.error) {
          console.warn("IntelliType:", response.error);
        }
      }
    );
  }, 500); // 500ms debounce
}

/**
 * Handles special key presses like Tab and Escape.
 */
function handleKeyDown(e) {
  if (!activeElement || !document.contains(activeElement)) return;

  // Handle improvement hotkey: Ctrl+Shift+Enter
  if (e.ctrlKey && e.shiftKey && e.key === "Enter") {
    e.preventDefault();
    const fullText = getCurrentText(activeElement);
    if (fullText.length > 10000) { // Approx 5k tokens (rough 4 chars/token)
      alert("Text too long! Limit is ~10k characters (~5k tokens).");
      return;
    }
    if (!isExtensionConfigured) {
      alert("Extension not configured. Please set up API keys in options.");
      return;
    }
    chrome.runtime.sendMessage(
      {
        action: "improveText",
        text: fullText,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("IntelliType Error:", chrome.runtime.lastError.message);
          return;
        }
        if (response && response.improved) {
          console.log("IntelliType: Received improved text:", response.improved);
          showSuggestionPanel(response.improved);
        } else if (response && response.error) {
          console.warn("IntelliType:", response.error);
          alert(response.error);
        }
      }
    );
    return;
  }

  // If panel is open, handle its keys first
  if (suggestionPanel && document.contains(suggestionPanel)) {
    if (e.key === "Tab") {
      e.preventDefault();
      acceptImprovement();
      return;
    } else if (e.key === "Escape") {
      e.preventDefault();
      hideSuggestionPanel();
      return;
    }
  }

  // Accept suggestion with Tab (for ghost text)
  if (e.key === "Tab" && ghostTextElement && ghostTextElement.textContent && document.contains(ghostTextElement)) {
    e.preventDefault();
    acceptSuggestion();
  }
  // Dismiss with Escape or arrow keys
  else if (e.key === "Escape" || ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    hideGhostText();
    hideSuggestionPanel();
  }
}

// --- Initialization ---

// Initialize extension
(async function init() {
  console.log("IntelliType: Initializing...");

  // Check if extension is configured
  isExtensionConfigured = await checkConfiguration();

  if (isExtensionConfigured) {
    console.log("IntelliType: Extension configured and active");
  } else {
    console.log("IntelliType: Extension not configured. Please set API key in options.");
  }

  // Create the ghost text element
  ghostTextElement = createGhostTextElement();

  // Add event listeners
  document.addEventListener("focusin", handleFocusIn, true);
  document.addEventListener(
    "input",
    (e) => {
      if (e.target === activeElement) {
        handleInput(e);
      }
    },
    true
  );
  document.addEventListener("keydown", handleKeyDown, true);

  console.log("IntelliType: Content script loaded successfully");
})();