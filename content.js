// content.js

let activeElement = null;
let ghostTextElement = null;
let debounceTimer;
let isExtensionConfigured = false;

// --- Utility Functions ---

/**
 * Check if extension is properly configured
 */
async function checkConfiguration() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'checkConfiguration' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('IntelliType: Error checking configuration', chrome.runtime.lastError);
                resolve(false);
            } else {
                resolve(response?.isConfigured || false);
            }
        });
    });
}

/**
 * Creates and styles the ghost text element that overlays the suggestion.
 */
function createGhostTextElement() {
    const ghost = document.createElement('span');
    ghost.id = 'intellitype-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ghost);
    return ghost;
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
    const lines = text.split('\n');
    
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
    
    return lines.slice(startLine, endLine).join('\n');
}

/**
 * Positions the ghost text element to align perfectly with the text in the active input.
 */
function positionGhostText(targetElement, ghostElement, suggestion) {
    if (!targetElement || !ghostElement) return;

    const targetRect = targetElement.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(targetElement);
    const text = targetElement.value || targetElement.innerText;

    // Create a hidden div to measure text width
    const measurer = document.createElement('div');
    measurer.style.position = 'absolute';
    measurer.style.visibility = 'hidden';
    measurer.style.height = 'auto';
    measurer.style.width = 'auto';
    measurer.style.whiteSpace = 'pre';
    measurer.style.font = computedStyle.font;
    measurer.style.letterSpacing = computedStyle.letterSpacing;
    measurer.style.padding = computedStyle.padding;
    measurer.style.border = computedStyle.border;
    measurer.textContent = text;
    document.body.appendChild(measurer);
    const textWidth = measurer.getBoundingClientRect().width;
    document.body.removeChild(measurer);

    // Position the ghost text
    ghostElement.style.position = 'absolute';
    ghostElement.style.top = `${targetRect.top + window.scrollY + parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.borderTopWidth)}px`;
    ghostElement.style.left = `${targetRect.left + window.scrollX + parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.borderLeftWidth) + textWidth}px`;
    ghostElement.style.font = computedStyle.font;
    ghostElement.style.color = 'grey';
    ghostElement.style.opacity = '0.6';
    ghostElement.style.pointerEvents = 'none';
    ghostElement.textContent = suggestion;
    ghostElement.style.display = 'inline-block';
}

/**
 * Hides the ghost text.
 */
function hideGhostText() {
    if (ghostTextElement) {
        ghostTextElement.style.display = 'none';
        ghostTextElement.textContent = '';
    }
}

/**
 * Accepts the current suggestion and inserts it into the active element.
 */
function acceptSuggestion() {
    if (!activeElement || !ghostTextElement || !ghostTextElement.textContent) {
        return;
    }

    const suggestion = ghostTextElement.textContent;

    if (activeElement.isContentEditable) {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(suggestion));
            range.collapse(false);
        }
    } else {
        activeElement.value += suggestion;
    }

    hideGhostText();
    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
}

// --- Event Handlers ---

function handleFocusIn(e) {
    const el = e.target;
    // Support all text inputs, textareas, and contenteditable elements
    if (el.matches('input[type="text"], input[type="email"], input[type="search"], input[type="url"], textarea, [contenteditable="true"]') ||
        (el.tagName === 'INPUT' && !el.type) || // Default input type
        el.isContentEditable) {
        activeElement = el;
        console.log('IntelliType: Active on', el.tagName, el.type || 'contenteditable');
    } else {
        activeElement = null;
        hideGhostText();
    }
}

/**
 * Main handler for keyboard input on the active element.
 */
async function handleInput(e) {
    if (!activeElement) return;
    if (!isExtensionConfigured) return;

    hideGhostText();
    clearTimeout(debounceTimer);

    const context = getContext(activeElement);
    
    // Trigger on space or after punctuation
    if (context.trim().length === 0) {
        return;
    }

    // Check if last character is space or punctuation
    const lastChar = context.slice(-1);
    if (![' ', '.', ',', '!', '?', '\n'].includes(lastChar)) {
        return;
    }

    debounceTimer = setTimeout(() => {
        console.log('IntelliType: Fetching completion for context length:', context.length);
        
        chrome.runtime.sendMessage({
            action: 'fetchCompletion',
            context: context
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('IntelliType Error:', chrome.runtime.lastError.message);
                return;
            }
            
            if (response && response.completion) {
                console.log('IntelliType: Received completion:', response.completion);
                positionGhostText(activeElement, ghostTextElement, response.completion);
            } else if (response && response.error) {
                console.warn('IntelliType:', response.error);
            }
        });
    }, 500); // 500ms debounce
}

/**
 * Handles special key presses like Tab and Escape.
 */
function handleKeyDown(e) {
    if (!activeElement) return;

    // Accept suggestion with Tab
    if (e.key === 'Tab' && ghostTextElement && ghostTextElement.textContent) {
        e.preventDefault();
        acceptSuggestion();
    }
    // Dismiss with Escape or arrow keys
    else if (e.key === 'Escape' || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        hideGhostText();
    }
}

// --- Initialization ---

// Initialize extension
(async function init() {
    console.log('IntelliType: Initializing...');
    
    // Check if extension is configured
    isExtensionConfigured = await checkConfiguration();
    
    if (isExtensionConfigured) {
        console.log('IntelliType: Extension configured and active');
    } else {
        console.log('IntelliType: Extension not configured. Please set API key in options.');
    }
    
    // Create the ghost text element
    ghostTextElement = createGhostTextElement();

    // Add event listeners
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('input', (e) => {
        if (e.target === activeElement) {
            handleInput(e);
        }
    }, true);
    document.addEventListener('keydown', handleKeyDown, true);
    
    console.log('IntelliType: Content script loaded successfully');
})();