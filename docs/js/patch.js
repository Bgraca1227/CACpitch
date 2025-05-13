/**
 * CAC UtiliTrack Patch Script
 * 
 * This script is designed to run after the main application loads
 * and fix any missing connections or references between components.
 */

console.log('=== Running CAC UtiliTrack Patch Script ===');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, preparing patch functions...');
    
    // Delay patch execution to ensure the main app has had a chance to initialize
    setTimeout(function() {
        patchComponents();
    }, 2000);

    // Set up periodic patch checks to fix components that may break during runtime
    setInterval(function() {
        checkComponentHealth();
    }, 5000);
});

// Main patching function to fix component connections
function patchComponents() {
    console.log('Applying component connection patches...');
    
    // Only run patches if we have the main components
    if (!window.appState || !window.mapController || !window.uiController || !window.eventHandlers) {
        console.warn('Components not initialized, cannot apply patches');
        return;
    }
    
    try {
        // Fix bidirectional references between components
        // This is critical for components to communicate with each other
        window.mapController.uiController = window.uiController;
        window.mapController.eventHandlers = window.eventHandlers;
        window.mapController.appState = window.appState;
        window.mapController.dataStore = window.dataStore;
        
        window.uiController.mapController = window.mapController;
        window.uiController.eventHandlers = window.eventHandlers;
        window.uiController.appState = window.appState;
        window.uiController.dataStore = window.dataStore;
        
        window.eventHandlers.mapController = window.mapController;
        window.eventHandlers.uiController = window.uiController;
        window.eventHandlers.appState = window.appState;
        window.eventHandlers.dataStore = window.dataStore;
        
        // Add missing methods to map controller if not defined
        patchMapControllerMethods();
        
        // Ensure UI elements have event listeners
        patchUIEventListeners();
        
        // Initialize map properly if it doesn't exist
        if (!window.mapController.map) {
            console.warn('Map not initialized, attempting to create it...');
            window.mapController.initMap();
        }
        
        console.log('✅ Component connection patches applied successfully');
    } catch (error) {
        console.error('Error applying component patches:', error);
    }
}

// Fix any missing methods in MapController
function patchMapControllerMethods() {
    // Fix missing locationFilter if not defined
    if (!window.mapController.locationFilter) {
        console.log('Adding missing locationFilter to MapController');
        window.mapController.locationFilter = {
            positions: [],
            maxPositions: 5,
            accuracyThreshold: 20,
            headings: [],
            maxHeadings: 8,
            
            addPosition: function(position) {
                if (position.coords.accuracy <= this.accuracyThreshold) {
                    this.positions.push(position);
                    if (this.positions.length > this.maxPositions) {
                        this.positions.shift();
                    }
                }
                return this.getFilteredPosition();
            },
            
            getFilteredPosition: function() {
                if (this.positions.length === 0) return null;
                
                let totalWeight = 0;
                let weightedLat = 0;
                let weightedLng = 0;
                
                this.positions.forEach((pos, index) => {
                    const recencyWeight = (index + 1) / this.positions.length;
                    const accuracyWeight = 1 / Math.max(1, pos.coords.accuracy);
                    const weight = recencyWeight * accuracyWeight;
                    
                    weightedLat += pos.coords.latitude * weight;
                    weightedLng += pos.coords.longitude * weight;
                    totalWeight += weight;
                });
                
                return {
                    latitude: weightedLat / totalWeight,
                    longitude: weightedLng / totalWeight
                };
            },
            
            addHeading: function(heading) {
                if (isNaN(heading)) return this.getFilteredHeading();
                
                this.headings.push(heading);
                if (this.headings.length > this.maxHeadings) {
                    this.headings.shift();
                }
                
                return this.getFilteredHeading();
            },
            
            getFilteredHeading: function() {
                if (this.headings.length === 0) return 0;
                
                let sumSin = 0;
                let sumCos = 0;
                
                this.headings.forEach((heading) => {
                    const rad = heading * Math.PI / 180;
                    sumSin += Math.sin(rad);
                    sumCos += Math.cos(rad);
                });
                
                const avgRad = Math.atan2(sumSin, sumCos);
                let avgHeading = avgRad * 180 / Math.PI;
                
                if (avgHeading < 0) avgHeading += 360;
                
                return avgHeading;
            },
            
            reset: function() {
                this.positions = [];
                this.headings = [];
            }
        };
    }
    
    // Fix critical methods if missing
    const criticalMethods = [
        'findNearbyMains',
        'showTempLine',
        'addConnectorMarker',
        'startHighAccuracyLocationTracking',
        'updateHeading',
        'findClosestPointOnLine'
    ];
    
    criticalMethods.forEach(methodName => {
        if (typeof window.mapController[methodName] !== 'function') {
            console.warn(`Missing critical method in MapController: ${methodName}`);
            
            // Add minimal implementation for critical methods
            if (methodName === 'findNearbyMains') {
                window.mapController.findNearbyMains = function(latlng, utilityType, maxDistance = 20) {
                    return null; // Minimal implementation
                };
            }
            
            if (methodName === 'showTempLine') {
                window.mapController.showTempLine = function(points) {
                    // Remove existing temp line
                    if (window.appState.tempLine) {
                        window.mapController.map.removeLayer(window.appState.tempLine);
                        window.appState.tempLine = null;
                    }
                    
                    // Basic implementation to show a line
                    if (points && points.length >= 2) {
                        window.appState.tempLine = L.polyline(points, {
                            color: '#2962ff',
                            weight: 4,
                            opacity: 0.8
                        }).addTo(window.mapController.map);
                    }
                };
            }
        }
    });
}

// Fix missing UI event listeners
function patchUIEventListeners() {
    console.log('Checking UI event listeners...');
    
    // Critical buttons that need event listeners
    const criticalButtons = [
        { id: 'add-utility-btn', handler: () => window.eventHandlers.startUtilityDrawing() },
        { id: 'confirm-drawing-btn', handler: () => window.eventHandlers.finishUtilityDrawing() },
        { id: 'confirm-connection-btn', handler: () => window.eventHandlers.finishUtilityDrawing() }
    ];
    
    // Apply event listeners if missing
    criticalButtons.forEach(button => {
        const element = document.getElementById(button.id);
        if (element && !element._hasEventListener) {
            console.log(`Adding missing event listener to ${button.id}`);
            element.addEventListener('click', button.handler);
            element._hasEventListener = true;
        }
    });
    
    // Add event listeners to utility type buttons
    document.querySelectorAll('#utility-toolbar .utility-button').forEach(btn => {
        if (!btn._hasEventListener) {
            btn.addEventListener('click', function() {
                const utilityType = this.getAttribute('data-utility');
                if (window.eventHandlers && typeof window.eventHandlers.setUtilityType === 'function') {
                    window.eventHandlers.setUtilityType(utilityType);
                } else if (window.appState) {
                    window.appState.activeUtilityType = utilityType;
                    // Update UI manually
                    document.querySelectorAll('#utility-toolbar .utility-button').forEach(b => {
                        b.classList.remove('active');
                    });
                    this.classList.add('active');
                }
            });
            btn._hasEventListener = true;
        }
    });
    
    // Add event listeners to mode toggle buttons
    document.querySelectorAll('#mode-toggle .mode-button').forEach(btn => {
        if (!btn._hasEventListener) {
            btn.addEventListener('click', function() {
                const mode = this.getAttribute('data-mode');
                if (window.eventHandlers && typeof window.eventHandlers.setMode === 'function') {
                    window.eventHandlers.setMode(mode);
                } else if (window.appState) {
                    window.appState.mode = mode;
                    // Update UI manually
                    document.querySelectorAll('#mode-toggle .mode-button').forEach(b => {
                        b.classList.remove('active');
                    });
                    this.classList.add('active');
                }
            });
            btn._hasEventListener = true;
        }
    });
}

// Apply critical inline style overrides to keep UI identical to original prototype
function forceElementPositions() {
    // Utility toolbar
    const utilityToolbar = document.getElementById('utility-toolbar');
    if (utilityToolbar) {
        Object.assign(utilityToolbar.style, {
            position: 'absolute',
            top: '5px',
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '70%',
            padding: '4px',
            zIndex: '2000'
        });
        // Resize buttons
        utilityToolbar.querySelectorAll('.utility-button').forEach(btn => {
            btn.style.minWidth = '38px';
            btn.style.padding = '2px 6px';
            const icon = btn.querySelector('i');
            if (icon) icon.style.fontSize = '0.85rem';
            const label = btn.querySelector('.utility-label');
            if (label) label.style.fontSize = '0.5rem';
        });
    }

    // Action floating buttons
    const actionButtons = document.getElementById('action-buttons');
    if (actionButtons) {
        Object.assign(actionButtons.style, {
            position: 'absolute',
            right: '15px',
            bottom: '150px',
            zIndex: '2000'
        });
    }

    // Line-type selector
    const lineSelector = document.getElementById('line-type-selector');
    if (lineSelector) {
        lineSelector.style.top = 'calc(var(--space-lg) + 120px)';
    }

    // Mode toggle
    const modeToggle = document.getElementById('mode-toggle');
    if (modeToggle) {
        Object.assign(modeToggle.style, {
            position: 'absolute',
            left: '50%',
            bottom: '80px',
            transform: 'translateX(-50%)',
            zIndex: '2000'
        });
    }
}

// Run once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(forceElementPositions, 400);
    // Maintain every second just like original prototype
    setInterval(forceElementPositions, 1000);
});

// Perform periodic health checks on components
function checkComponentHealth() {
    // Skip health check if components aren't initialized yet
    if (!window.appState || !window.mapController || !window.uiController) return;
    
    // Check map initialization
    if (!window.mapController.map) {
        console.warn('Map instance missing during health check, trying to reinitialize');
        try {
            window.mapController.initMap();
        } catch (e) {
            console.error('Failed to reinitialize map:', e);
        }
    }
    
    // Check for utility layers
    if (!window.mapController.utilityLayers || 
        !window.mapController.utilityLayers.water) {
        console.warn('Utility layers missing during health check, trying to recreate');
        try {
            window.mapController.utilityLayers = {
                water: L.layerGroup().addTo(window.mapController.map),
                gas: L.layerGroup().addTo(window.mapController.map),
                electric: L.layerGroup().addTo(window.mapController.map),
                sewer: L.layerGroup().addTo(window.mapController.map),
                telecom: L.layerGroup().addTo(window.mapController.map)
            };
        } catch (e) {
            console.error('Failed to recreate utility layers:', e);
        }
    }
    
    // Check if component connections are maintained
    if (window.mapController.uiController !== window.uiController) {
        console.warn('Component connections broken, reapplying patches');
        patchComponents();
    }
}

// Global error handler that attempts to recover
window.addEventListener('error', function(event) {
    console.error('Runtime error detected:', event.message);
    
    // Don't try to patch if the error is in the patch itself
    if (event.filename && event.filename.includes('patch.js')) {
        console.warn('Error occurred in patch script, skipping recovery');
        return;
    }
    
    // Try to fix component connections when errors occur
    if (window.appState && window.mapController && window.uiController) {
        console.log('Attempting to recover from runtime error...');
        patchComponents();
    }
});

// Export a global patching function for manual use
window.patchCACUtiliTrack = function() {
    console.log('Manual patching triggered');
    patchComponents();
    return 'Patching attempted, check console for details';
};

console.log('=== CAC UtiliTrack Patch Script Ready ==='); 