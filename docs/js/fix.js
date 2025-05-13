/**
 * CAC UtiliTrack Core Fix Script
 * 
 * This script contains essential fixes for critical functionality.
 * It's designed to run early in the initialization process to
 * ensure core components are working properly.
 */

(function() {
    // Track if fixes have been applied
    let fixesApplied = false;
    
    /**
     * Apply essential fixes to ensure application works
     */
    function applyEssentialFixes() {
        if (fixesApplied) return;
        
        console.log('Applying essential fixes...');
        
        // 1. Ensure critical styles are applied
        ensureCriticalStyles();
        
        // 2. Patch Leaflet if needed
        patchLeaflet();
        
        // 3. Add error handler for geolocation
        patchGeolocation();
        
        // 4. Enable graceful handling of JSON parse errors
        patchJSONParsing();
        
        fixesApplied = true;
        console.log('Essential fixes applied');
    }
    
    /**
     * Ensure critical CSS styles are present
     */
    function ensureCriticalStyles() {
        // Check if critical styles exist
        let criticalStylesExist = false;
        
        try {
            // Look for styles in all stylesheets
            for (let i = 0; i < document.styleSheets.length; i++) {
                try {
                    const sheet = document.styleSheets[i];
                    const rules = sheet.cssRules || sheet.rules;
                    
                    if (!rules) continue;
                    
                    for (let j = 0; j < rules.length; j++) {
                        if (rules[j].selectorText === '.user-location-marker .location-heading') {
                            criticalStylesExist = true;
                            break;
                        }
                    }
                    
                    if (criticalStylesExist) break;
                } catch (e) {
                    // Ignore cross-origin stylesheet errors
                }
            }
        } catch (e) {
            console.warn('Error checking for critical styles:', e);
        }
        
        // If critical styles don't exist, add them
        if (!criticalStylesExist) {
            console.log('Adding critical styles');
            
            const style = document.createElement('style');
            style.textContent = `
                /* Essential Styles */
                .user-location-marker {
                    z-index: 1000;
                }
                
                .user-location-marker .location-heading {
                    position: absolute;
                    top: -24px;
                    left: 50%;
                    width: 0;
                    height: 0;
                    border-left: 12px solid transparent;
                    border-right: 12px solid transparent;
                    border-bottom: 24px solid #2196F3;
                    transform-origin: bottom center;
                    transform: translateX(-50%) rotate(0deg);
                    z-index: 1001;
                    display: block;
                    visibility: visible;
                    opacity: 1;
                }
                
                #exit-excavation-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    width: 100%;
                    height: 100%;
                    display: none;
                    justify-content: center;
                    align-items: center;
                    background-color: rgba(0,0,0,0.5);
                    z-index: 1001;
                }
                
                #exit-excavation-modal.visible {
                    display: flex;
                }
            `;
            
            document.head.appendChild(style);
        }
    }
    
    /**
     * Patch Leaflet library if needed
     */
    function patchLeaflet() {
        // Make sure Leaflet exists
        if (!window.L) return;
        
        // Patch Leaflet's Marker to better handle dynamic content
        if (window.L.Marker) {
            try {
                // Save original methods
                const originalOnAdd = window.L.Marker.prototype.onAdd;
                
                // Override onAdd to ensure markers are properly initialized
                window.L.Marker.prototype.onAdd = function(map) {
                    // Call original method
                    const result = originalOnAdd.call(this, map);
                    
                    // Ensure icon is properly updated
                    if (this._icon) {
                        // Dispatch a custom event that our code can listen for
                        const event = new CustomEvent('markeradded', { detail: { marker: this } });
                        this._icon.dispatchEvent(event);
                    }
                    
                    return result;
                };
                
                console.log('Leaflet Marker patched');
            } catch (e) {
                console.warn('Error patching Leaflet Marker:', e);
            }
        }
    }
    
    /**
     * Patch Geolocation API with better error handling
     */
    function patchGeolocation() {
        if (!navigator.geolocation) return;
        
        // Save original methods
        const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
        const originalWatchPosition = navigator.geolocation.watchPosition;
        
        // Override getCurrentPosition to handle errors better
        navigator.geolocation.getCurrentPosition = function(success, error, options) {
            // Create enhanced error handler
            const enhancedError = function(err) {
                // Log the error
                console.warn('Geolocation error:', err);
                
                // Try to suggest solutions based on error type
                let message = '';
                
                switch (err.code) {
                    case 1: // PERMISSION_DENIED
                        message = 'Location access denied. Please enable location permissions.';
                        break;
                    case 2: // POSITION_UNAVAILABLE
                        message = 'Unable to determine your location. Check device sensors.';
                        break;
                    case 3: // TIMEOUT
                        message = 'Location request timed out. Try again in an area with better GPS signal.';
                        break;
                    default:
                        message = 'Unknown geolocation error.';
                }
                
                // Show message in UI if available
                if (window.uiController && typeof window.uiController.showToast === 'function') {
                    window.uiController.showToast(message, 'error');
                }
                
                // Call original error handler if provided
                if (typeof error === 'function') {
                    error(err);
                }
            };
            
            // Call original method with enhanced error handler
            return originalGetCurrentPosition.call(navigator.geolocation, success, enhancedError, options);
        };
        
        // Similarly patch watchPosition
        navigator.geolocation.watchPosition = function(success, error, options) {
            // Create enhanced error handler
            const enhancedError = function(err) {
                console.warn('Geolocation watch error:', err);
                
                // Only show UI error for first occurrence
                if (!navigator.geolocation._hasShownWatchError) {
                    navigator.geolocation._hasShownWatchError = true;
                    
                    // Show message in UI if available
                    if (window.uiController && typeof window.uiController.showToast === 'function') {
                        window.uiController.showToast('Location tracking error. Your position may not update accurately.', 'warning');
                    }
                    
                    // Reset error flag after some time
                    setTimeout(() => {
                        navigator.geolocation._hasShownWatchError = false;
                    }, 60000); // 1 minute
                }
                
                // Call original error handler if provided
                if (typeof error === 'function') {
                    error(err);
                }
            };
            
            // Call original method with enhanced error handler
            return originalWatchPosition.call(navigator.geolocation, success, enhancedError, options);
        };
        
        console.log('Geolocation API patched');
    }
    
    /**
     * Patch JSON parsing to handle errors gracefully
     */
    function patchJSONParsing() {
        // Save original parse method
        const originalParse = JSON.parse;
        
        // Override parse to handle errors
        JSON.parse = function(text, reviver) {
            try {
                return originalParse(text, reviver);
            } catch (e) {
                console.warn('JSON parse error:', e);
                
                // Show error in UI if available
                if (window.uiController && typeof window.uiController.showToast === 'function') {
                    window.uiController.showToast('Error parsing data', 'error');
                }
                
                // Return empty object or array as fallback
                return text.trim().startsWith('[') ? [] : {};
            }
        };
        
        console.log('JSON parsing patched');
    }
    
    // Create global recovery function that can be called from other scripts
    window.applyCoreFixes = applyEssentialFixes;
    
    // Apply fixes when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyEssentialFixes);
    } else {
        // DOM already loaded, apply fixes now
        applyEssentialFixes();
    }
})(); 