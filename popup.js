document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggleOverlay');
    
    toggleButton.addEventListener('click', function() {
        // Send message to content script to toggle overlay
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'toggleOverlay'});
        });
        
        // Close popup
        window.close();
    });
});