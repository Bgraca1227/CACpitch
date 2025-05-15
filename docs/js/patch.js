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

// Store reference to patch application for debugging
let patchAlreadyApplied = false;

// Main patch function to fix runtime connection issues
window.patchCACUtiliTrack = function() {
    // Avoid applying the patch multiple times
    if (patchAlreadyApplied) {
        console.log('Patch already applied, skipping');
        return 'Patch already applied';
    }
    
    console.log('Applying CAC UtiliTrack patch...');
    
    try {
        // Fix measurement feature if it's not working
        fixMeasurementFunctionality();
        
        // Fix excavation mode if it's not working
        fixExcavationModeFunctionality();
        
        // Fix cross-references between controllers if needed
        fixControllerReferences();
        
        // Mark patch as applied
        patchAlreadyApplied = true;
        
        console.log('Patch applied successfully!');
        return 'Patch applied successfully';
    } catch (e) {
        console.error('Error applying patch:', e);
        return 'Error applying patch: ' + e.message;
    }
};

// Fix measurement functionality
function fixMeasurementFunctionality() {
    // Only apply if we have the necessary components
    if (!window.mapController || !window.eventHandlers || !window.appState) {
        console.log('Cannot fix measurement: controllers not initialized');
        return;
    }
    
    // Ensure measurement toolbar buttons are connected
    document.querySelectorAll('#measurement-toolbar .measurement-button').forEach(btn => {
        // Remove existing listeners to avoid duplicates
        const clone = btn.cloneNode(true);
        btn.parentNode.replaceChild(clone, btn);
        
        // Add new listener
        clone.addEventListener('click', () => {
            const tool = clone.getAttribute('data-tool');
            console.log('Measurement tool selected:', tool);
            
            // Set all buttons inactive
            document.querySelectorAll('#measurement-toolbar .measurement-button').forEach(b => {
                b.classList.remove('active');
            });
            
            // Set this button active
            clone.classList.add('active');
            
            // Handle the tool action
            handleMeasurementToolAction(tool);
        });
    });
    
    // Define a direct handler for measurement tool actions
    function handleMeasurementToolAction(tool) {
        if (tool === 'measure-distance') {
            window.appState.measurePoints = [];
            window.uiController.showStatusBar('Click on the map to start measuring');
        } else if (tool === 'add-note') {
            window.uiController.showStatusBar('Click on the map to add a note');
        } else if (tool === 'clear-measurements') {
            window.mapController.clearMeasurements();
            window.uiController.showToast('Measurements cleared', 'info');
        } else if (tool === 'exit-measure') {
            // Exit measurement mode
            window.appState.isMeasuring = false;
            window.uiController.hideMeasurementToolbar();
            window.uiController.hideStatusBar();
            window.uiController.showToast('Measurement mode ended', 'info');
            document.body.style.cursor = '';
        }
    }
    
    // Make sure measurement button works
    const measureBtn = document.getElementById('measure-btn');
    if (measureBtn) {
        // Remove existing listeners to avoid duplicates
        const clone = measureBtn.cloneNode(true);
        measureBtn.parentNode.replaceChild(clone, measureBtn);
        
        // Add direct handler
        clone.addEventListener('click', () => {
            console.log('Measure button clicked');
            if (window.appState.isMeasuring) {
                // Turn off measurement mode
                window.appState.isMeasuring = false;
                window.uiController.hideMeasurementToolbar();
                window.uiController.hideStatusBar();
                clone.classList.remove('active');
                document.body.style.cursor = '';
                window.uiController.showToast('Measurement mode ended', 'info');
            } else {
                // Turn on measurement mode
                window.appState.isMeasuring = true;
                window.uiController.showMeasurementToolbar();
                window.uiController.showStatusBar('Click on the map to start measuring');
                clone.classList.add('active');
                document.body.style.cursor = 'crosshair';
                window.uiController.showToast('Measurement mode started', 'info');
            }
        });
    }
    
    console.log('Measurement functionality fixed');
}

// Fix excavation mode functionality
function fixExcavationModeFunctionality() {
    // Only apply if we have the necessary components
    if (!window.mapController || !window.eventHandlers || !window.appState) {
        console.log('Cannot fix excavation mode: controllers not initialized');
        return;
    }
    
    // Ensure excavation mode button is connected
    const excavationBtn = document.querySelector('.mode-button[data-mode="excavation"]');
    if (excavationBtn) {
        // Remove existing listeners to avoid duplicates
        const clone = excavationBtn.cloneNode(true);
        excavationBtn.parentNode.replaceChild(clone, excavationBtn);
        
        // Add direct handler
        clone.addEventListener('click', () => {
            console.log('Excavation mode button clicked');
            
            // Show confirmation dialog
            const modal = document.getElementById('exit-excavation-modal');
            const messageEl = modal.querySelector('.exit-confirmation-message');
            
            // Change message for entering excavation mode
            messageEl.textContent = 'Excavation mode provides real-time safety alerts for nearby utilities. Do you want to continue?';
            
            // Change button text
            const confirmBtn = modal.querySelector('#confirm-exit-excavation');
            confirmBtn.textContent = 'Enter Excavation Mode';
            
            // Show the modal
            modal.classList.add('visible');
            
            // Listen for confirm button
            const confirmHandler = function() {
                // Enter excavation mode
                window.appState.mode = 'excavation';
                window.appState.isExcavationMode = true;
                
                // Update UI
                document.querySelectorAll('#mode-toggle .mode-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                clone.classList.add('active');
                
                // Enable excavation mode in map controller
                window.mapController.enableExcavationMode();
                
                // Hide modal
                modal.classList.remove('visible');
                
                // Show confirmation toast
                window.uiController.showToast('Excavation mode activated. Click on map to set dig location.', 'warning');
                
                // Remove listener
                confirmBtn.removeEventListener('click', confirmHandler);
            };
            
            // Listen for cancel button
            const cancelHandler = function() {
                modal.classList.remove('visible');
                // Remove listeners
                cancelBtn.removeEventListener('click', cancelHandler);
                confirmBtn.removeEventListener('click', confirmHandler);
            };
            
            const cancelBtn = modal.querySelector('#cancel-exit-excavation');
            
            // Remove any existing listeners before adding new ones
            confirmBtn.replaceWith(confirmBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            
            // Re-select buttons after cloning
            const newConfirmBtn = modal.querySelector('#confirm-exit-excavation');
            const newCancelBtn = modal.querySelector('#cancel-exit-excavation');
            
            // Add listeners
            newConfirmBtn.addEventListener('click', confirmHandler);
            newCancelBtn.addEventListener('click', cancelHandler);
        });
    }
    
    // Fix exit excavation button
    const exitExcavationBtn = document.getElementById('exit-excavation-btn');
    if (exitExcavationBtn) {
        // Remove existing listeners to avoid duplicates
        const clone = exitExcavationBtn.cloneNode(true);
        exitExcavationBtn.parentNode.replaceChild(clone, exitExcavationBtn);
        
        // Add direct handler
        clone.addEventListener('click', () => {
            console.log('Exit excavation button clicked');
            
            // Show confirmation dialog
            const modal = document.getElementById('exit-excavation-modal');
            const messageEl = modal.querySelector('.exit-confirmation-message');
            
            // Change message for exiting excavation mode
            messageEl.textContent = 'Are you sure you want to exit excavation mode? This will disable real-time proximity alerts.';
            
            // Change button text
            const confirmBtn = modal.querySelector('#confirm-exit-excavation');
            confirmBtn.textContent = 'Exit Mode';
            
            // Show the modal
            modal.classList.add('visible');
            
            // Listen for confirm button
            const confirmHandler = function() {
                // Exit excavation mode
                window.appState.mode = 'discovery';
                window.appState.isExcavationMode = false;
                
                // Update UI
                document.querySelectorAll('#mode-toggle .mode-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                document.querySelector('#mode-toggle .mode-button[data-mode="discovery"]').classList.add('active');
                
                // Disable excavation mode in map controller
                window.mapController.disableExcavationMode();
                
                // Hide modal
                modal.classList.remove('visible');
                
                // Show confirmation toast
                window.uiController.showToast('Excavation mode deactivated', 'info');
                
                // Remove listener
                confirmBtn.removeEventListener('click', confirmHandler);
            };
            
            // Listen for cancel button
            const cancelHandler = function() {
                modal.classList.remove('visible');
                // Remove listeners
                cancelBtn.removeEventListener('click', cancelHandler);
                confirmBtn.removeEventListener('click', confirmHandler);
            };
            
            const cancelBtn = modal.querySelector('#cancel-exit-excavation');
            
            // Remove any existing listeners before adding new ones
            confirmBtn.replaceWith(confirmBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            
            // Re-select buttons after cloning
            const newConfirmBtn = modal.querySelector('#confirm-exit-excavation');
            const newCancelBtn = modal.querySelector('#cancel-exit-excavation');
            
            // Add listeners
            newConfirmBtn.addEventListener('click', confirmHandler);
            newCancelBtn.addEventListener('click', cancelHandler);
        });
    }
    
    console.log('Excavation mode functionality fixed');
}

// Fix controller references if needed
function fixControllerReferences() {
    // Check if necessary controller references exist
    if (window.appState && window.dataStore && window.mapController && window.uiController && window.eventHandlers) {
        // Ensure each controller has references to the others
        if (!window.mapController.eventHandlers) window.mapController.eventHandlers = window.eventHandlers;
        if (!window.mapController.uiController) window.mapController.uiController = window.uiController;
        if (!window.mapController.appState) window.mapController.appState = window.appState;
        if (!window.mapController.dataStore) window.mapController.dataStore = window.dataStore;
        
        if (!window.uiController.eventHandlers) window.uiController.eventHandlers = window.eventHandlers;
        if (!window.uiController.mapController) window.uiController.mapController = window.mapController;
        if (!window.uiController.appState) window.uiController.appState = window.appState;
        if (!window.uiController.dataStore) window.uiController.dataStore = window.dataStore;
        
        if (!window.eventHandlers.mapController) window.eventHandlers.mapController = window.mapController;
        if (!window.eventHandlers.uiController) window.eventHandlers.uiController = window.uiController;
        if (!window.eventHandlers.appState) window.eventHandlers.appState = window.appState;
        if (!window.eventHandlers.dataStore) window.eventHandlers.dataStore = window.dataStore;
        
        if (!window.dataStore.mapController) window.dataStore.mapController = window.mapController;
        
        console.log('Controller references fixed');
    } else {
        console.warn('Cannot fix controller references: one or more controllers missing');
    }
}

// Automatically apply the patch after a short delay to ensure all components are loaded
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        if (!patchAlreadyApplied) {
            console.log('Auto-applying CAC UtiliTrack patch...');
            window.patchCACUtiliTrack();
        }
    }, 1500);  // Wait 1.5 seconds after DOM is loaded
});

console.log('=== CAC UtiliTrack Patch Script Ready ===');

function fixComponentReferences() {
    console.log('Fixing component references...');
    
    // Ensure all cross-references are set correctly
    if (window.mapController && window.uiController && window.appState && window.dataStore) {
        window.mapController.uiController = window.uiController;
        window.mapController.appState = window.appState;
        window.mapController.dataStore = window.dataStore;
        
        window.uiController.mapController = window.mapController;
        window.uiController.appState = window.appState;
        window.uiController.dataStore = window.dataStore;
        
        if (window.eventHandlers) {
            window.eventHandlers.mapController = window.mapController;
            window.eventHandlers.uiController = window.uiController;
            window.eventHandlers.appState = window.appState;
            window.eventHandlers.dataStore = window.dataStore;
            
            window.mapController.eventHandlers = window.eventHandlers;
            window.uiController.eventHandlers = window.eventHandlers;
        }
        
        // Ensure mapController has necessary methods
        if (!window.mapController.updateHeading || typeof window.mapController.updateHeading !== 'function') {
            window.mapController.updateHeading = function(heading) {
                if (isNaN(heading)) return;
                
                // Store current heading
                this.currentHeading = heading;
                
                // Update marker if it exists
                if (this.userLocationMarker) {
                    const markerElement = this.userLocationMarker.getElement();
                    if (markerElement) {
                        const headingElement = markerElement.querySelector('.location-heading');
                        if (headingElement) {
                            headingElement.style.transform = `translateX(-50%) rotate(${heading}deg)`;
                            headingElement.style.opacity = '1';
                        }
                    }
                }
            };
        }
        
        // Ensure locationFilter exists
        if (!window.mapController.locationFilter) {
            console.log('Creating missing locationFilter');
            window.mapController.locationFilter = {
                positions: [],
                maxPositions: 5,
                accuracyThreshold: 20,
                headings: [],
                maxHeadings: 8,
                
                addPosition: function(position) {
                    // Add simple speed-based outlier detection
                    if (this.positions.length > 0) {
                        const lastPos = this.positions[this.positions.length - 1];
                        const timeDelta = (position.timestamp - lastPos.timestamp) / 1000;
                        if (timeDelta > 0) {
                            // Simple distance calculation
                            const distDelta = this.calculateDistance(
                                {lat: lastPos.coords.latitude, lng: lastPos.coords.longitude},
                                {lat: position.coords.latitude, lng: position.coords.longitude}
                            );
                            const speed = distDelta / timeDelta; // meters per second
                            // Reject positions with unrealistic speed
                            if (speed > 30 && this.positions.length > 2) {
                                console.warn('Position rejected: unrealistic speed');
                                return this.getFilteredPosition();
                            }
                        }
                    }
                    
                    // Only add positions with good accuracy
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
                
                calculateDistance: function(p1, p2) {
                    if (!p1 || !p2) return 0;
                    
                    // Simple distance calculation
                    const R = 6371e3; // Earth's radius in meters
                    const φ1 = p1.lat * Math.PI / 180;
                    const φ2 = p2.lat * Math.PI / 180;
                    const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
                    const Δλ = (p2.lng - p1.lng) * Math.PI / 180;

                    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                            Math.cos(φ1) * Math.cos(φ2) *
                            Math.sin(Δλ/2) * Math.sin(Δλ/2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    return R * c; // Distance in meters
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
        
        console.log('Component references fixed successfully');
        return true;
    } else {
        console.warn('Cannot fix component references: some components are missing');
        return false;
    }
} 