// content.js

let activeElement = null;
let ghostTextElement = null;
let debounceTimer;

// --- Utility Functions ---

/**
 * Creates and styles the ghost text element that overlays the suggestion.
 * @returns {HTMLSpanElement} The created ghost text element.
 */
function createGhostTextElement() {
    const ghost = document.createElement('span');
    ghost.id = 'intellitype-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ghost);
    return ghost;
}

/**
 * Positions the ghost text element to align perfectly with the text in the active input.
 * @param {HTMLElement} targetElement - The active input/textarea/contenteditable.
 * @param {HTMLSpanElement} ghostElement - The ghost text span.
 * @param {string} suggestion - The suggestion text to display.
 */
function positionGhostText(targetElement, ghostElement, suggestion) {
    if (!targetElement || !ghostElement) return;

    const targetRect = targetElement.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(targetElement);
    const text = targetElement.value || targetElement.innerText;

    // --- Create a hidden div to measure text width ---
    const measurer = document.createElement('div');
    measurer.style.position = 'absolute';
    measurer.style.visibility = 'hidden';
    measurer.style.height = 'auto';
    measurer.style.width = 'auto';
    measurer.style.whiteSpace = 'pre'; // Preserve spaces and line breaks
    measurer.style.font = computedStyle.font;
    measurer.style.letterSpacing = computedStyle.letterSpacing;
    measurer.style.padding = computedStyle.padding;
    measurer.style.border = computedStyle.border;
    measurer.textContent = text.endsWith(' ') ? text.slice(0, -1) + ' ' : text; // Handle trailing space
    document.body.appendChild(measurer);
    const textWidth = measurer.getBoundingClientRect().width;
    document.body.removeChild(measurer);

    // --- Position the ghost text ---
    ghostElement.style.position = 'absolute';
    ghostElement.style.top = `${targetRect.top + window.scrollY + parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.borderTopWidth)}px`;
    ghostElement.style.left = `${targetRect.left + window.scrollX + parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.borderLeftWidth) + textWidth}px`;
    ghostElement.style.font = computedStyle.font;
    ghostElement.style.color = 'grey';
    ghostElement.style.opacity = '0.6';
    ghostElement.style.pointerEvents = 'none'; // Make it non-interactive
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
        // For contenteditable divs
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(suggestion));
            range.collapse(false); // Move cursor to the end
        }
    } else {
        // For input and textarea
        activeElement.value += suggestion;
    }

    hideGhostText();
    activeElement.dispatchEvent(new Event('input', { bubbles: true })); // Trigger input event
}


// --- Event Handlers ---

/**
 * Handles the 'focusin' event to track the currently active editable element.
 * @param {FocusEvent} e - The focus event.
 */
function handleFocusIn(e) {
    const el = e.target;
    if (el.matches('input[type="text"], input[type="email"], input[type="search"], textarea, [contenteditable="true"]')) {
        activeElement = el;
        // console.log('IntelliType is active on:', activeElement);
    } else {
        activeElement = null;
        hideGhostText();
    }
}

/**
 * Main handler for keyboard input on the active element.
 * @param {InputEvent} e - The input event.
 */
async function handleInput(e) {
    if (!activeElement) return;

    hideGhostText(); // Hide old suggestion on new input
    clearTimeout(debounceTimer);

    const context = activeElement.isContentEditable ? activeElement.innerText : activeElement.value;
    if (context.trim().length === 0 || !context.endsWith(' ')) {
        return; // Only trigger after a space for now
    }

    debounceTimer = setTimeout(() => {
        // console.log('Debounce triggered. Fetching completion.');
        chrome.runtime.sendMessage({
            action: 'fetchCompletion',
            context: context
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('IntelliType Error:', chrome.runtime.lastError.message);
                return;
            }
            if (response && response.completion) {
                positionGhostText(activeElement, ghostTextElement, response.completion);
            } else if (response && response.error) {
                console.warn('IntelliType:', response.error);
            }
        });
    }, 500); // 500ms debounce delay
}

/**
 * Handles special key presses like Tab and Escape.
 * @param {KeyboardEvent} e - The keydown event.
 */
function handleKeyDown(e) {
    if (!activeElement) return;

    // Accept suggestion with Tab
    if (e.key === 'Tab' && ghostTextElement && ghostTextElement.textContent) {
        e.preventDefault(); // Prevent default Tab behavior (like changing focus)
        acceptSuggestion();
    }
    // Dismiss with Escape or other keys
    else if (e.key === 'Escape' || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        hideGhostText();
    }
}

// --- Initialization ---

// Create the ghost text element on script load.
ghostTextElement = createGhostTextElement();

// Add event listeners to the document.
document.addEventListener('focusin', handleFocusIn, true);
document.addEventListener('input', (e) => {
    if (e.target === activeElement) {
        handleInput(e);
    }
}, true);
document.addEventListener('keydown', handleKeyDown, true);
