// Content script for overlay notes extension
let overlay = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleOverlay') {
        toggleOverlay();
    }
});

// Keyboard shortcut listener
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        toggleOverlay();
    }
});

function toggleOverlay() {
    if (overlay) {
        removeOverlay();
    } else {
        createOverlay();
    }
}

function createOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'notes-overlay';
    overlay.innerHTML = `
        <div class="notes-header">
            <span class="notes-title">Notes</span>
            <div class="notes-controls">
                <input type="range" class="opacity-slider" min="0.3" max="1" step="0.1" value="0.9">
                <button class="close-btn">&times;</button>
            </div>
        </div>
        <div class="notes-content">
            <textarea class="notes-textarea" placeholder="Start typing your notes here..."></textarea>
        </div>
    `;

    document.body.appendChild(overlay);

    // Load saved notes and position
    loadNotes();
    
    // Set up event listeners
    setupEventListeners();
}

function removeOverlay() {
    if (overlay) {
        saveNotes();
        overlay.remove();
        overlay = null;
    }
}

function setupEventListeners() {
    const header = overlay.querySelector('.notes-header');
    const closeBtn = overlay.querySelector('.close-btn');
    const opacitySlider = overlay.querySelector('.opacity-slider');
    const textarea = overlay.querySelector('.notes-textarea');

    // Close button
    closeBtn.addEventListener('click', removeOverlay);

    // Opacity slider
    opacitySlider.addEventListener('input', (e) => {
        const opacity = parseFloat(e.target.value);
        
        // Update main overlay background
        overlay.style.background = `rgba(45, 45, 45, ${opacity})`;
        
        // Update border opacity
        overlay.style.borderColor = `rgba(102, 102, 102, ${Math.min(opacity + 0.2, 1)})`;
        
        // Update header background
        const header = overlay.querySelector('.notes-header');
        header.style.background = `rgba(51, 51, 51, ${Math.min(opacity + 0.05, 1)})`;
        
        // Update header border
        header.style.borderBottomColor = `rgba(85, 85, 85, ${Math.min(opacity + 0.1, 1)})`;
        
        // Update shadow opacity
        overlay.style.boxShadow = `0 8px 32px rgba(0, 0, 0, ${opacity * 0.3})`;
        
        saveSettings({ opacity });
    });

    // Dragging functionality
    header.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);

    // Auto-save notes
    textarea.addEventListener('input', saveNotes);
    
    // Load saved opacity
    loadSettings();
}

function startDrag(e) {
    if (e.target.classList.contains('opacity-slider') || e.target.classList.contains('close-btn')) {
        return;
    }
    
    isDragging = true;
    const rect = overlay.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    overlay.style.transition = 'none';
    document.body.style.cursor = 'grabbing';
}

function drag(e) {
    if (!isDragging || !overlay) return;
    
    e.preventDefault();
    
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Keep overlay within viewport
    const maxX = window.innerWidth - overlay.offsetWidth;
    const maxY = window.innerHeight - overlay.offsetHeight;
    
    const clampedX = Math.max(0, Math.min(newX, maxX));
    const clampedY = Math.max(0, Math.min(newY, maxY));
    
    overlay.style.left = clampedX + 'px';
    overlay.style.top = clampedY + 'px';
    overlay.style.right = 'auto';
    overlay.style.bottom = 'auto';
}

function stopDrag() {
    if (!isDragging) return;
    
    isDragging = false;
    document.body.style.cursor = '';
    
    if (overlay) {
        overlay.style.transition = '';
        savePosition();
    }
}

function saveNotes() {
    if (!overlay) return;
    
    const textarea = overlay.querySelector('.notes-textarea');
    const notes = textarea.value;
    
    chrome.storage.local.set({ notes });
}

function loadNotes() {
    chrome.storage.local.get(['notes'], (result) => {
        if (result.notes && overlay) {
            const textarea = overlay.querySelector('.notes-textarea');
            textarea.value = result.notes;
        }
    });
}

function savePosition() {
    const rect = overlay.getBoundingClientRect();
    const position = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
    };
    
    chrome.storage.local.set({ position });
}

function loadPosition() {
    chrome.storage.local.get(['position'], (result) => {
        if (result.position && overlay) {
            const pos = result.position;
            overlay.style.top = pos.top + 'px';
            overlay.style.left = pos.left + 'px';
            overlay.style.width = pos.width + 'px';
            overlay.style.height = pos.height + 'px';
            overlay.style.right = 'auto';
            overlay.style.bottom = 'auto';
        }
    });
}

function saveSettings(settings) {
    chrome.storage.local.set({ settings });
}

function loadSettings() {
    chrome.storage.local.get(['settings'], (result) => {
        if (result.settings && overlay) {
            const settings = result.settings;
            if (settings.opacity) {
                const opacity = parseFloat(settings.opacity);
                
                // Apply all opacity-related styles
                overlay.style.background = `rgba(45, 45, 45, ${opacity})`;
                overlay.style.borderColor = `rgba(102, 102, 102, ${Math.min(opacity + 0.2, 1)})`;
                overlay.style.boxShadow = `0 8px 32px rgba(0, 0, 0, ${opacity * 0.3})`;
                
                const header = overlay.querySelector('.notes-header');
                header.style.background = `rgba(51, 51, 51, ${Math.min(opacity + 0.05, 1)})`;
                header.style.borderBottomColor = `rgba(85, 85, 85, ${Math.min(opacity + 0.1, 1)})`;
                
                const slider = overlay.querySelector('.opacity-slider');
                slider.value = opacity;
            }
        }
    });
    
    // Load position after settings
    loadPosition();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (overlay) {
        saveNotes();
        savePosition();
    }
});