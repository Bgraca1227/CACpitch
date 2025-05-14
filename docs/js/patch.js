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

(function() {
    console.log('CAC UtiliTrack Patch Script Loaded');
    
    // Main patch function
    window.patchCACUtiliTrack = function() {
        console.log('Applying CAC UtiliTrack patches...');
        let patchesApplied = 0;
        
        // Fix user location marker heading display
        if (window.mapController) {
            // Ensure heading update method exists and works correctly
            if (!window.mapController.updateHeading || typeof window.mapController.updateHeading !== 'function') {
                console.log('Patching missing updateHeading method');
                
                window.mapController.updateHeading = function(heading) {
                    if (isNaN(heading)) return;
                    
                    // Store the current heading
                    this.currentHeading = heading;
                    
                    // Apply to the marker
                    if (this.userLocationMarker) {
                        const markerElement = this.userLocationMarker.getElement();
                        
                        if (markerElement) {
                            // Update both the SVG icon and the heading arrow
                            const iconElement = markerElement.querySelector('.location-marker-svg');
                            const headingElement = markerElement.querySelector('.location-heading');
                            
                            if (iconElement) {
                                // Rotate the SVG icon to match the heading
                                iconElement.style.transform = `rotate(${this.currentHeading}deg)`;
                            }
                            
                            if (headingElement) {
                                // Make sure the arrow is visible
                                headingElement.style.opacity = '1';
                                // Update arrow rotation
                                headingElement.style.transform = `translateX(-50%) rotate(${this.currentHeading}deg)`;
                            }
                            
                            // Add heading indicator class if not already there
                            markerElement.classList.add('with-heading');
                        }
                    }
                    
                    // Update the app state with current heading
                    if (this.appState) {
                        this.appState.heading = heading;
                    }
                };
                
                patchesApplied++;
            }
            
            // Ensure orientation handling is properly set up
            if (!window.mapController.handleOrientation || typeof window.mapController.handleOrientation !== 'function') {
                console.log('Patching missing handleOrientation method');
                
                window.mapController.handleOrientation = function(event) {
                    // Check if we have compass heading data
                    if (event.webkitCompassHeading !== undefined) {
                        // iOS uses webkitCompassHeading (degrees from north, clockwise)
                        const heading = event.webkitCompassHeading;
                        this.processHeading(heading, event.webkitCompassAccuracy || 0);
                    } else if (event.alpha !== null && event.alpha !== undefined) {
                        // For Android and other devices
                        // Alpha is a value from 0 to 360, representing the orientation
                        let heading;
                        
                        if (event.absolute === true) {
                            // If device provides absolute orientation (relative to Earth's coordinate system)
                            heading = 360 - event.alpha;
                        } else if (window.screen && window.screen.orientation) {
                            // If we have screen orientation API, try to correct the heading
                            const screenOrientation = window.screen.orientation.angle || 0;
                            heading = 360 - event.alpha;
                            
                            // Apply screen orientation correction
                            heading = (heading + screenOrientation) % 360;
                        } else {
                            // Fallback to basic alpha conversion
                            heading = 360 - event.alpha;
                        }
                        
                        this.processHeading(heading, 0);
                    }
                };
                
                patchesApplied++;
            }
            
            // Ensure processHeading function exists
            if (!window.mapController.processHeading || typeof window.mapController.processHeading !== 'function') {
                console.log('Patching missing processHeading method');
                
                window.mapController.processHeading = function(heading, uncertainty) {
                    if (isNaN(heading)) return;
                    
                    this.lastHeadingUpdate = new Date().getTime();
                    
                    // Filter heading if locationFilter is available, otherwise use directly
                    if (this.locationFilter && typeof this.locationFilter.addHeading === 'function') {
                        const filteredHeading = this.locationFilter.addHeading(heading);
                        this.updateHeading(filteredHeading);
                    } else {
                        this.updateHeading(heading);
                    }
                };
                
                patchesApplied++;
            }
            
            // Ensure motion handling is set up
            if (!window.mapController.handleMotion || typeof window.mapController.handleMotion !== 'function') {
                console.log('Patching missing handleMotion method');
                
                window.mapController.handleMotion = function(event) {
                    // Extract acceleration data
                    const acceleration = event.accelerationIncludingGravity;
                    
                    if (!acceleration || acceleration.x === null) return;
                    
                    // Store motion data for fusion with compass
                    this.lastMotion = {
                        x: acceleration.x,
                        y: acceleration.y,
                        z: acceleration.z,
                        timestamp: new Date().getTime()
                    };
                    
                    // If we're in excavation mode and haven't received heading updates,
                    // attempt to derive heading from motion
                    if (this.appState && this.appState.isExcavationMode && (!this.lastHeadingUpdate || 
                        (new Date().getTime() - this.lastHeadingUpdate > 2000))) {
                        
                        this.attemptMotionBasedHeading();
                    }
                };
                
                patchesApplied++;
            }
            
            // Ensure motion-based heading function exists
            if (!window.mapController.attemptMotionBasedHeading || typeof window.mapController.attemptMotionBasedHeading !== 'function') {
                console.log('Patching missing attemptMotionBasedHeading method');
                
                window.mapController.attemptMotionBasedHeading = function() {
                    // Need at least two motion samples
                    if (!this.lastMotion || !this.previousMotion) {
                        this.previousMotion = this.lastMotion;
                        return;
                    }
                    
                    // Check if we're moving (acceleration significant enough)
                    const accelMagnitude = Math.sqrt(
                        Math.pow(this.lastMotion.x, 2) + 
                        Math.pow(this.lastMotion.y, 2)
                    );
                    
                    if (accelMagnitude > 1.5) { // Threshold to determine movement
                        // Very simple heading approximation based on acceleration vector
                        const heading = Math.atan2(this.lastMotion.y, this.lastMotion.x) * 180 / Math.PI;
                        
                        // Normalize to 0-360 range
                        const normalizedHeading = (heading + 360) % 360;
                        
                        // Use this heading with low confidence
                        this.processHeading(normalizedHeading, 45); // Higher value = lower confidence
                    }
                    
                    this.previousMotion = this.lastMotion;
                };
                
                patchesApplied++;
            }
            
            // Fix location filter if it's missing or incomplete
            if (!window.mapController.locationFilter || 
                !window.mapController.locationFilter.addHeading || 
                !window.mapController.locationFilter.getFilteredHeading) {
                
                console.log('Patching locationFilter');
                
                // Create basic filter if missing
                if (!window.mapController.locationFilter) {
                    window.mapController.locationFilter = {};
                }
                
                // Add basic position filter
                if (!window.mapController.locationFilter.positions) {
                    window.mapController.locationFilter.positions = [];
                    window.mapController.locationFilter.maxPositions = 5;
                    window.mapController.locationFilter.accuracyThreshold = 20;
                }
                
                // Add heading filter
                if (!window.mapController.locationFilter.headings) {
                    window.mapController.locationFilter.headings = [];
                    window.mapController.locationFilter.maxHeadings = 8;
                }
                
                // Add missing functions
                if (!window.mapController.locationFilter.addHeading || typeof window.mapController.locationFilter.addHeading !== 'function') {
                    window.mapController.locationFilter.addHeading = function(heading) {
                        if (isNaN(heading)) return this.getFilteredHeading();
                        
                        this.headings.push(heading);
                        
                        if (this.headings.length > this.maxHeadings) {
                            this.headings.shift();
                        }
                        
                        return this.getFilteredHeading();
                    };
                }
                
                if (!window.mapController.locationFilter.getFilteredHeading || typeof window.mapController.locationFilter.getFilteredHeading !== 'function') {
                    window.mapController.locationFilter.getFilteredHeading = function() {
                        if (this.headings.length === 0) return 0;
                        
                        // Special handling for heading values that wrap around 0/360
                        // Convert headings to vectors, average them, then convert back to angle
                        let sumSin = 0;
                        let sumCos = 0;
                        
                        this.headings.forEach((heading) => {
                            // Convert heading to radians
                            const rad = heading * Math.PI / 180;
                            sumSin += Math.sin(rad);
                            sumCos += Math.cos(rad);
                        });
                        
                        // Convert average vector back to degrees
                        const avgRad = Math.atan2(sumSin, sumCos);
                        let avgHeading = avgRad * 180 / Math.PI;
                        
                        // Normalize to 0-360 range
                        if (avgHeading < 0) avgHeading += 360;
                        
                        return avgHeading;
                    };
                }
                
                // Add reset function if missing
                if (!window.mapController.locationFilter.reset || typeof window.mapController.locationFilter.reset !== 'function') {
                    window.mapController.locationFilter.reset = function() {
                        this.positions = [];
                        this.headings = [];
                    };
                }
                
                patchesApplied++;
            }
            
            // Ensure heading is properly oriented on the marker
            setTimeout(fixHeadingIndicator, 3000);
        }
        
        // Add CSS styles for location-marker if they're missing
        if (!document.querySelector('.user-location-marker')) {
            console.log('Adding missing location marker styles');
            
            const style = document.createElement('style');
            style.textContent = `
                .user-location-marker {
                    pointer-events: auto;
                    cursor: pointer;
                    z-index: 1000 !important;
                }
                
                .user-location-marker.with-heading .location-marker-container {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 24px;
                    height: 24px;
                }
                
                .user-location-marker .location-marker-svg {
                    width: 100%;
                    height: 100%;
                    filter: drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.5));
                    transition: transform 0.15s ease;
                    transform-origin: center;
                }
                
                .user-location-marker .location-accuracy-circle {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    background-color: rgba(33, 150, 243, 0.15);
                    transition: transform 0.3s ease, background-color 0.3s ease;
                    animation: accuracy-pulse 3s infinite ease-out;
                    top: 0;
                    left: 0;
                }
                
                .user-location-marker .location-center {
                    position: absolute;
                    width: 50%;
                    height: 50%;
                    left: 25%;
                    top: 25%;
                    border-radius: 50%;
                    background-color: rgb(33, 150, 243);
                    border: 2px solid white;
                    box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
                    z-index: 1;
                }
                
                .user-location-marker .location-heading {
                    position: absolute;
                    width: 0;
                    height: 0;
                    left: 50%;
                    top: -12px;
                    border-left: 8px solid transparent;
                    border-right: 8px solid transparent;
                    border-bottom: 16px solid rgb(33, 150, 243);
                    transform-origin: center bottom;
                    transform: translateX(-50%) rotate(0deg);
                    opacity: 0; 
                    transition: transform 0.15s ease, opacity 0.3s ease;
                    z-index: 2; 
                    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
                }
                
                .user-location-marker.with-heading .location-heading {
                    opacity: 1;
                }
                
                .user-location-marker .location-pulse {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    background-color: rgba(33, 150, 243, 0.4);
                    opacity: 0;
                    animation: location-pulse 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
                }
                
                .user-location-marker .location-pulse-inner {
                    position: absolute;
                    width: 80%;
                    height: 80%;
                    left: 10%;
                    top: 10%;
                    border-radius: 50%;
                    background-color: rgba(33, 150, 243, 0.6);
                    opacity: 0;
                    animation: location-pulse 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
                    animation-delay: 0.5s;
                }
                
                @keyframes accuracy-pulse {
                    0% {
                        transform: scale(0.95);
                        opacity: 0.6;
                    }
                    50% {
                        transform: scale(1.1);
                        opacity: 0.3;
                    }
                    100% {
                        transform: scale(0.95);
                        opacity: 0.6;
                    }
                }
                
                @keyframes location-pulse {
                    0% {
                        transform: scale(0.5);
                        opacity: 1;
                    }
                    100% {
                        transform: scale(1.5);
                        opacity: 0;
                    }
                }
            `;
            
            document.head.appendChild(style);
            patchesApplied++;
        }
        
        // Function to fix heading indicator with direct DOM manipulation
        function fixHeadingIndicator() {
            if (window.mapController && window.mapController.userLocationMarker) {
                try {
                    const markerEl = window.mapController.userLocationMarker.getElement();
                    if (markerEl) {
                        // Make sure the marker has the with-heading class
                        markerEl.classList.add('with-heading');
                        
                        // Fix or create the heading indicator
                        let headingEl = markerEl.querySelector('.location-heading');
                        if (!headingEl) {
                            // Create it if missing
                            console.log('Creating missing heading element');
                            headingEl = document.createElement('div');
                            headingEl.className = 'location-heading';
                            markerEl.appendChild(headingEl);
                        }
                        
                        // Apply critical styling directly to make sure it displays
                        headingEl.style.position = 'absolute';
                        headingEl.style.top = '-12px';
                        headingEl.style.left = '50%';
                        headingEl.style.width = '0';
                        headingEl.style.height = '0';
                        headingEl.style.borderLeft = '8px solid transparent';
                        headingEl.style.borderRight = '8px solid transparent';
                        headingEl.style.borderBottom = '16px solid rgb(33, 150, 243)';
                        headingEl.style.transformOrigin = 'center bottom';
                        headingEl.style.transform = `translateX(-50%) rotate(${window.mapController.currentHeading || 0}deg)`;
                        headingEl.style.opacity = '1';
                        headingEl.style.zIndex = '2';
                        headingEl.style.transition = 'transform 0.15s ease';
                        
                        console.log('Heading indicator fixed');
                    }
                } catch (e) {
                    console.error('Error fixing heading indicator:', e);
                }
            }
        }
        
        // Apply any additional patches as needed
        
        console.log(`CAC UtiliTrack patches applied: ${patchesApplied} fixes`);
        return patchesApplied;
    };
    
    // Run the patch function when the page is loaded
    document.addEventListener('DOMContentLoaded', function() {
        // Wait a bit for all components to initialize
        setTimeout(function() {
            window.patchCACUtiliTrack();
        }, 2000);
    });
    
    // Add backup recovery mechanism
    window.recoverCAC = function() {
        console.log('Running CAC UtiliTrack recovery...');
        
        // If patch function exists, run it first
        if (typeof window.patchCACUtiliTrack === 'function') {
            window.patchCACUtiliTrack();
        }
        
        // Additional recovery steps can be added here
        
        console.log('CAC UtiliTrack recovery complete');
    };
})(); 