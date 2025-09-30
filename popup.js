// popup.js
document.getElementById('optionsButton').addEventListener('click', () => {
    // Opens the options page in a new tab when the button is clicked.
    chrome.runtime.openOptionsPage();
});
