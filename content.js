// Content script for overlay notes extension
let overlay = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

function updateBulletDisplay() {
    if (!overlay) return;
    
    const textarea = overlay.querySelector('.notes-textarea');
    const bulletOverlay = overlay.querySelector('.bullet-overlay');
    
    if (!textarea || !bulletOverlay) return;
    
    const text = textarea.value;
    const lines = text.split('\n');
    
    // Create display text with visual bullets
    const displayLines = lines.map(line => {
        const match = line.match(/^(\s*)\*(.*)$/);
        if (match) {
            const [, indent, content] = match;
            const indentLevel = Math.floor(indent.length / 4);
            
            // Different bullet symbols based on indentation level
            let bullet;
            switch (indentLevel % 4) {
                case 0: bullet = '●'; break;  // Solid circle
                case 1: bullet = '○'; break;  // Empty circle  
                case 2: bullet = '■'; break;  // Solid square
                case 3: bullet = '□'; break;  // Empty square
            }
            
            return indent + bullet + content;
        }
        return line;
    });
    
    bulletOverlay.textContent = displayLines.join('\n');
    
    // Sync scroll position
    bulletOverlay.scrollTop = textarea.scrollTop;
};

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
            <div class="bullet-overlay"></div>
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
    textarea.addEventListener('input', () => {
        saveNotes();
        updateBulletDisplay();
    });
    
    // List formatting functionality
    textarea.addEventListener('keydown', handleListFormatting);
    
    // Update bullet display on scroll
    textarea.addEventListener('scroll', updateBulletDisplay);
    
    // Initial bullet display update
    updateBulletDisplay();
    
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
            updateBulletDisplay();
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

function handleListFormatting(e) {
    const textarea = e.target;
    
    if (e.key === 'Tab') {
        e.preventDefault();
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        
        // Find the start of the current line
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const currentLine = value.substring(lineStart, start);
        
        // Check if current line starts with '*' (with optional whitespace)
        const asteriskMatch = currentLine.match(/^(\s*)\*(.*)$/);
        
        if (asteriskMatch) {
            const [, currentIndent, restOfLine] = asteriskMatch;
            
            if (e.shiftKey) {
                // Shift+Tab: Decrease indentation
                if (currentIndent.length >= 4) {
                    const newIndent = currentIndent.substring(4);
                    const newLine = newIndent + '*' + restOfLine;
                    const newValue = value.substring(0, lineStart) + newLine + value.substring(start);
                    
                    // Calculate new cursor position (4 spaces to the left)
                    const cursorOffset = start - lineStart;
                    const newCursorPosition = lineStart + Math.max(0, cursorOffset - 4);
                    
                    textarea.value = newValue;
                    textarea.selectionStart = textarea.selectionEnd = newCursorPosition;
                }
            } else {
                // Tab: Increase indentation
                const newIndent = currentIndent + '    '; // 4 spaces
                const newLine = newIndent + '*' + restOfLine;
                const newValue = value.substring(0, lineStart) + newLine + value.substring(start);
                
                textarea.value = newValue;
                textarea.selectionStart = textarea.selectionEnd = lineStart + newLine.length;
            }
        } else {
            // Normal tab behavior for non-asterisk lines
            const newValue = value.substring(0, start) + '    ' + value.substring(end);
            textarea.value = newValue;
            textarea.selectionStart = textarea.selectionEnd = start + 4;
        }
        
        // Save the changes
        saveNotes();
        
        // Update bullet display
        setTimeout(updateBulletDisplay, 0);
    }
    
    // Backspace: Smart indent deletion
    if (e.key === 'Backspace') {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        
        // Only handle single cursor position (not selections)
        if (start === end && start > 0) {
            // Find the start of the current line
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const beforeCursor = value.substring(lineStart, start);
            
            // Check if cursor is right after 4 spaces (a tab indent)
            if (beforeCursor.endsWith('    ') && beforeCursor.length >= 4) {
                // Check if the 4 spaces are at the beginning of indentation
                const beforeSpaces = beforeCursor.substring(0, beforeCursor.length - 4);
                if (beforeSpaces.match(/^\s*$/)) { // Only whitespace before the 4 spaces
                    e.preventDefault();
                    
                    // Remove all 4 spaces at once
                    const newValue = value.substring(0, start - 4) + value.substring(start);
                    textarea.value = newValue;
                    textarea.selectionStart = textarea.selectionEnd = start - 4;
                    
                    saveNotes();
                    
                    // Update bullet display
                    setTimeout(updateBulletDisplay, 0);
                }
            }
        }
    }
    
    // Enter key: Auto-continue list items
    if (e.key === 'Enter') {
        const start = textarea.selectionStart;
        const value = textarea.value;
        
        // Find the start of the current line
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const currentLine = value.substring(lineStart, start);
        
        // Check if current line is a list item
        const listMatch = currentLine.match(/^(\s*)\*\s*(.*)$/);
        
        if (listMatch) {
            const [, indent, content] = listMatch;
            
            // If the line is empty (just * with whitespace), remove the bullet
            if (content.trim() === '') {
                e.preventDefault();
                const newValue = value.substring(0, lineStart) + indent + value.substring(start);
                textarea.value = newValue;
                textarea.selectionStart = textarea.selectionEnd = lineStart + indent.length;
            } else {
                // Continue the list with the same indentation
                e.preventDefault();
                const newListItem = '\n' + indent + '* ';
                const newValue = value.substring(0, start) + newListItem + value.substring(start);
                textarea.value = newValue;
                textarea.selectionStart = textarea.selectionEnd = start + newListItem.length;
                
                // Update bullet display
                setTimeout(updateBulletDisplay, 0);
            }
            
            // Save the changes
            saveNotes();
        }
    }
}
window.addEventListener('beforeunload', () => {
    if (overlay) {
        saveNotes();
        savePosition();
    }
});