/**
 * CAC UtiliTrack - Patch Script
 * 
 * This script addresses specific component-level issues:
 * - Fixes measurement functionality
 * - Ensures proper event handling
 * - Corrects UI visibility and interaction problems
 * - Patches DOM-specific issues
 */

// Create a global patch function 
window.patchCACUtiliTrack = function() {
    console.log('Applying CAC UtiliTrack patches...');
    
    // Execute each patch function
    let result = {
        measurement: patchMeasurementFunctionality(),
        events: patchEventHandling(),
        ui: patchUIComponents(),
        map: patchMapFunctionality(),
        data: patchDataHandling()
    };
    
    // Perform final connection check
    const connectionStatus = checkComponentConnections();
    
    // Log patch summary
    console.log('Patch summary:', result);
    
    return result;
};

/**
 * Patch measurement functionality
 */
function patchMeasurementFunctionality() {
    if (!window.mapController) return 'No mapController to patch';
    
    try {
        // Fix missing measurement functions
        if (!window.mapController.startMeasurement || typeof window.mapController.startMeasurement !== 'function') {
            console.log('Patching measurement start functionality');
            window.mapController.startMeasurement = function() {
                if (!this.appState) return;
                
                this.appState.isMeasuring = true;
                
                // Show measurement toolbar
                if (this.uiController) {
                    if (typeof this.uiController.showMeasurementToolbar === 'function') {
                        this.uiController.showMeasurementToolbar();
                    } else {
                        const toolbar = document.getElementById('measurement-toolbar');
                        if (toolbar) toolbar.classList.add('visible');
                    }
                    
                    if (typeof this.uiController.showStatusBar === 'function') {
                        this.uiController.showStatusBar('Click on the map to start measuring');
                    }
                }
                
                // Set cursor
                document.body.style.cursor = 'crosshair';
                
                // Initialize measure points array if not exists
                if (!this.appState.measurePoints) {
                    this.appState.measurePoints = [];
                }
                
                // Create measurement layer if not exists
                if (!this.measurementLayer && this.map) {
                    this.measurementLayer = L.layerGroup().addTo(this.map);
                }
                
                console.log('Measurement mode started');
            };
        }
        
        // Fix missing measurement end functionality
        if (!window.mapController.endMeasurement || typeof window.mapController.endMeasurement !== 'function') {
            console.log('Patching measurement end functionality');
            window.mapController.endMeasurement = function() {
                if (!this.appState) return;
                
                this.appState.isMeasuring = false;
                
                // Clear temporary measurement objects
                if (this.appState.measureLine && this.map) {
                    this.map.removeLayer(this.appState.measureLine);
                    this.appState.measureLine = null;
                }
                
                if (this.appState.measureStart && this.measurementLayer) {
                    this.measurementLayer.removeLayer(this.appState.measureStart);
                    this.appState.measureStart = null;
                }
                
                if (this.appState.measureEnd && this.measurementLayer) {
                    this.measurementLayer.removeLayer(this.appState.measureEnd);
                    this.appState.measureEnd = null;
                }
                
                // Reset the points array
                this.appState.measurePoints = [];
                
                // Reset cursor style
                document.body.style.cursor = '';
                
                // Hide measurement UI
                if (this.uiController) {
                    if (typeof this.uiController.hideMeasurementToolbar === 'function') {
                        this.uiController.hideMeasurementToolbar();
                    } else {
                        const toolbar = document.getElementById('measurement-toolbar');
                        if (toolbar) toolbar.classList.remove('visible');
                    }
                    
                    if (typeof this.uiController.hideStatusBar === 'function') {
                        this.uiController.hideStatusBar();
                    }
                }
                
                console.log('Measurement mode ended');
            };
        }
        
        // Fix measurement point handling
        if (!window.mapController.handleMeasurementClick || typeof window.mapController.handleMeasurementClick !== 'function') {
            console.log('Patching measurement click handling');
            window.mapController.handleMeasurementClick = function(e) {
                if (!this.appState || !this.appState.isMeasuring) return;
                
                // Get click coordinates
                const latlng = e.latlng;
                
                // Add point to measurement
                this.addMeasurementPoint(latlng);
            };
        }
        
        // Fix measurement point addition
        if (!window.mapController.addMeasurementPoint || typeof window.mapController.addMeasurementPoint !== 'function') {
            console.log('Patching measurement point addition');
            window.mapController.addMeasurementPoint = function(latlng) {
                if (!this.appState) return;
                
                // Initialize if needed
                if (!this.appState.measurePoints) {
                    this.appState.measurePoints = [];
                }
                
                // Add to points array
                this.appState.measurePoints.push(latlng);
                
                // Update UI status
                const count = this.appState.measurePoints.length;
                
                if (this.uiController && typeof this.uiController.showStatusBar === 'function') {
                    this.uiController.showStatusBar(`Point ${count} added. Click again to measure distance.`);
                }
                
                // If we have two points, complete the measurement
                if (count === 2) {
                    // Create a permanent measurement line
                    this.addMeasurementLine(this.appState.measurePoints);
                    
                    // Reset for next measurement
                    this.appState.measurePoints = [];
                    
                    // Remove temporary line
                    if (this.appState.measureLine && this.map) {
                        this.map.removeLayer(this.appState.measureLine);
                        this.appState.measureLine = null;
                    }
                    
                    if (this.uiController && typeof this.uiController.showStatusBar === 'function') {
                        this.uiController.showStatusBar('Measurement added. Click to start a new measurement.');
                    }
                } else if (count === 1) {
                    // Create a marker for the first point if measurement layer exists
                    if (this.measurementLayer) {
                        this.appState.measureStart = L.marker(latlng, {
                            icon: L.divIcon({
                                className: 'measure-point-marker',
                                html: '<i class="fas fa-map-pin"></i>',
                                iconSize: [20, 20],
                                iconAnchor: [10, 20]
                            })
                        }).addTo(this.measurementLayer);
                    }
                }
                
                // Show user feedback by updating cursor
                document.body.style.cursor = 'crosshair';
            };
        }
        
        // Fix measurement line addition
        if (!window.mapController.addMeasurementLine || typeof window.mapController.addMeasurementLine !== 'function') {
            console.log('Patching measurement line addition');
            window.mapController.addMeasurementLine = function(points) {
                if (!points || points.length < 2 || !this.map) return null;
                
                try {
                    // Ensure measurement layer exists
                    if (!this.measurementLayer) {
                        this.measurementLayer = L.layerGroup().addTo(this.map);
                    }
                    
                    // Calculate distance between points - first try built-in function
                    let distance;
                    try {
                        distance = this.map.distance(points[0], points[1]);
                    } catch (err) {
                        // Fallback to manual calculation using Haversine formula
                        const lat1 = points[0].lat;
                        const lon1 = points[0].lng;
                        const lat2 = points[1].lat;
                        const lon2 = points[1].lng;
                        
                        const R = 6371e3; // Earth radius in meters
                        const φ1 = lat1 * Math.PI / 180;
                        const φ2 = lat2 * Math.PI / 180;
                        const Δφ = (lat2 - lat1) * Math.PI / 180;
                        const Δλ = (lon2 - lon1) * Math.PI / 180;
                        
                        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                                Math.cos(φ1) * Math.cos(φ2) *
                                Math.sin(Δλ/2) * Math.sin(Δλ/2);
                                
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                        distance = R * c;
                    }
                    
                    // Format distance for display
                    const formatDistance = function(meters) {
                        if (meters < 1) {
                            return `${(meters * 100).toFixed(0)} cm`;
                        } else if (meters < 1000) {
                            return `${meters.toFixed(1)} m`;
                        } else {
                            return `${(meters / 1000).toFixed(2)} km`;
                        }
                    };
                    
                    // Format distance in feet
                    const formatDistanceFeet = function(meters) {
                        const feet = meters * 3.28084;
                        
                        if (feet < 10) {
                            return `${feet.toFixed(1)} ft`;
                        } else if (feet < 5280) {
                            return `${Math.round(feet)} ft`;
                        } else {
                            const miles = feet / 5280;
                            return `${miles.toFixed(2)} mi`;
                        }
                    };
                    
                    // Create line
                    const line = L.polyline(points, {
                        color: '#2196F3',
                        weight: 3,
                        opacity: 0.8
                    });
                    
                    // Add distance label at midpoint
                    const midpoint = [(points[0].lat + points[1].lat) / 2, (points[0].lng + points[1].lng) / 2];
                    
                    const metricDistance = formatDistance(distance);
                    const imperialDistance = formatDistanceFeet(distance);
                    
                    const distanceLabel = L.marker(midpoint, {
                        icon: L.divIcon({
                            className: 'distance-label',
                            html: `<div class="distance-marker">
                                    <span>${metricDistance}</span>
                                    <span>(${imperialDistance})</span>
                                  </div>`,
                            iconSize: [100, 40],
                            iconAnchor: [50, 20]
                        })
                    });
                    
                    // Create markers for start and end points
                    const startMarker = L.marker(points[0], {
                        icon: L.divIcon({
                            className: 'measure-point-marker start',
                            html: '<i class="fas fa-map-pin"></i>',
                            iconSize: [20, 20],
                            iconAnchor: [10, 20]
                        })
                    });
                    
                    const endMarker = L.marker(points[1], {
                        icon: L.divIcon({
                            className: 'measure-point-marker end',
                            html: '<i class="fas fa-flag"></i>',
                            iconSize: [20, 20],
                            iconAnchor: [10, 20]
                        })
                    });
                    
                    // Add everything to the measurement layer
                    this.measurementLayer.addLayer(line);
                    this.measurementLayer.addLayer(distanceLabel);
                    this.measurementLayer.addLayer(startMarker);
                    this.measurementLayer.addLayer(endMarker);
                    
                    // Store the measurement if dataStore is available
                    if (this.dataStore) {
                        if (!this.dataStore.measurements) {
                            this.dataStore.measurements = [];
                        }
                        
                        const generateId = this.dataStore.generateId || function(prefix) {
                            return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
                        };
                        
                        this.dataStore.measurements.push({
                            id: generateId('measure'),
                            points: points.map(p => [p.lat, p.lng]),
                            distance: distance,
                            createdAt: new Date().toISOString()
                        });
                        
                        // Save to storage
                        if (typeof this.dataStore.debouncedSave === 'function') {
                            this.dataStore.debouncedSave();
                        }
                    }
                    
                    // Show toast if UIController is available
                    if (this.uiController && typeof this.uiController.showToast === 'function') {
                        this.uiController.showToast(`Distance: ${metricDistance} (${imperialDistance})`, 'success');
                    }
                    
                    return {
                        line,
                        distanceLabel,
                        startMarker,
                        endMarker,
                        distance
                    };
                } catch (e) {
                    console.error('Error adding measurement line:', e);
                    
                    if (this.uiController && typeof this.uiController.showToast === 'function') {
                        this.uiController.showToast('Error creating measurement', 'error');
                    }
                    
                    return null;
                }
            };
        }
        
        // Fix measurement clearing
        if (!window.mapController.clearMeasurements || typeof window.mapController.clearMeasurements !== 'function') {
            console.log('Patching measurement clearing functionality');
            window.mapController.clearMeasurements = function() {
                // Clear the measurement layer
                if (this.measurementLayer) {
                    this.measurementLayer.clearLayers();
                }
                
                // Reset measurement state
                if (this.appState) {
                    this.appState.isMeasuring = false;
                    this.appState.measurePoints = [];
                    this.appState.measureStart = null;
                    this.appState.measureEnd = null;
                    this.appState.measureLine = null;
                }
                
                // Update UI if needed
                if (this.uiController) {
                    if (typeof this.uiController.hideStatusBar === 'function') {
                        this.uiController.hideStatusBar();
                    }
                    
                    if (typeof this.uiController.updateMeasurementTotal === 'function') {
                        this.uiController.updateMeasurementTotal(0);
                    }
                    
                    if (typeof this.uiController.showToast === 'function') {
                        this.uiController.showToast('All measurements cleared', 'info');
                    }
                }
                
                // Reset cursor
                document.body.style.cursor = '';
            };
        }
        
        return 'Measurement functionality patched successfully';
    } catch (e) {
        console.error('Error patching measurement functionality:', e);
        return 'Error patching measurement: ' + e.message;
    }
}

/**
 * Patch event handling
 */
function patchEventHandling() {
    if (!window.eventHandlers) return 'No eventHandlers to patch';
    
    try {
        // Fix missing setupEventListeners function
        if (!window.eventHandlers.setupEventListeners || typeof window.eventHandlers.setupEventListeners !== 'function') {
            console.log('Patching event handlers setup');
            window.eventHandlers.setupEventListeners = function() {
                if (this._listenersInitialized) {
                    console.warn('Event listeners already initialized, skipping setup');
                    return;
                }
                
                console.log('Setting up event listeners...');
                
                try {
                    // Basic critical listeners
                    
                    // Mode toggle buttons
                    document.querySelectorAll('#mode-toggle .mode-button').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const mode = btn.getAttribute('data-mode');
                            if (this.setMode && typeof this.setMode === 'function') {
                                this.setMode(mode);
                            } else if (this.appState && typeof this.appState.setMode === 'function') {
                                this.appState.setMode(mode);
                                
                                // Update UI
                                document.querySelectorAll('#mode-toggle .mode-button').forEach(b => {
                                    b.classList.toggle('active', b.getAttribute('data-mode') === mode);
                                });
                            }
                        });
                    });
                    
                    // Utility type buttons
                    document.querySelectorAll('#utility-toolbar .utility-button').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const utilityType = btn.getAttribute('data-utility');
                            if (this.setUtilityType && typeof this.setUtilityType === 'function') {
                                this.setUtilityType(utilityType);
                            } else if (this.appState && typeof this.appState.setUtilityType === 'function') {
                                this.appState.setUtilityType(utilityType);
                                
                                // Update UI
                                document.querySelectorAll('#utility-toolbar .utility-button').forEach(b => {
                                    b.classList.toggle('active', b.getAttribute('data-utility') === utilityType);
                                });
                            }
                        });
                    });
                    
                    // Measure button
                    const measureBtn = document.getElementById('measure-btn');
                    if (measureBtn) {
                        measureBtn.addEventListener('click', (e) => {
                            if (this.toggleMeasurementMode && typeof this.toggleMeasurementMode === 'function') {
                                this.toggleMeasurementMode();
                            } else if (this.mapController) {
                                if (this.appState && this.appState.isMeasuring) {
                                    // Turn off measurement mode
                                    this.appState.isMeasuring = false;
                                    
                                    if (typeof this.mapController.endMeasurement === 'function') {
                                        this.mapController.endMeasurement();
                                    }
                                    
                                    // Update UI
                                    measureBtn.classList.remove('active');
                                } else {
                                    // Turn on measurement mode
                                    if (typeof this.mapController.startMeasurement === 'function') {
                                        this.mapController.startMeasurement();
                                    }
                                    
                                    // Update UI
                                    measureBtn.classList.add('active');
                                }
                            }
                        });
                    }
                    
                    // Add utility button
                    const addUtilityBtn = document.getElementById('add-utility-btn');
                    if (addUtilityBtn) {
                        addUtilityBtn.addEventListener('click', (e) => {
                            if (this.startUtilityDrawing && typeof this.startUtilityDrawing === 'function') {
                                this.startUtilityDrawing();
                            } else if (this.appState && this.mapController) {
                                // Basic implementation
                                this.appState.isDrawing = true;
                                this.mapController.drawingMode = true;
                                
                                // Update UI
                                document.body.style.cursor = 'crosshair';
                                
                                const confirmBtn = document.getElementById('confirm-drawing-btn');
                                if (confirmBtn) confirmBtn.classList.add('visible');
                                
                                if (this.uiController && typeof this.uiController.showStatusBar === 'function') {
                                    this.uiController.showStatusBar('Click on the map to draw utility line');
                                }
                                
                                if (this.uiController && typeof this.uiController.showToast === 'function') {
                                    this.uiController.showToast(`Drawing ${this.appState.activeUtilityType} ${this.appState.activeLineType} line`, 'info');
                                }
                            }
                        });
                    }
                    
                    // Finish drawing button
                    const confirmDrawingBtn = document.getElementById('confirm-drawing-btn');
                    if (confirmDrawingBtn) {
                        confirmDrawingBtn.addEventListener('click', (e) => {
                            if (this.finishUtilityDrawing && typeof this.finishUtilityDrawing === 'function') {
                                this.finishUtilityDrawing();
                            } else if (this.appState && this.mapController) {
                                // Basic implementation
                                if (!this.appState.isDrawing) return;
                                
                                // Get the drawn points from the map controller
                                let points = null;
                                if (typeof this.mapController.finishDrawing === 'function') {
                                    points = this.mapController.finishDrawing();
                                }
                                
                                if (!points || points.length < 2) {
                                    if (this.uiController && typeof this.uiController.showToast === 'function') {
                                        this.uiController.showToast('Not enough points to create a utility line', 'error');
                                    }
                                    
                                    // Reset drawing state
                                    this.appState.isDrawing = false;
                                    this.mapController.drawingMode = false;
                                    if (typeof this.mapController.clearDrawing === 'function') {
                                        this.mapController.clearDrawing();
                                    }
                                    
                                    // Update UI
                                    document.body.style.cursor = '';
                                    confirmDrawingBtn.classList.remove('visible');
                                    
                                    if (this.uiController && typeof this.uiController.hideStatusBar === 'function') {
                                        this.uiController.hideStatusBar();
                                    }
                                    
                                    return;
                                }
                                
                                // Show utility form to collect details
                                if (this.uiController && typeof this.uiController.showAddUtilityModal === 'function') {
                                    this.uiController.showAddUtilityModal();
                                }
                                
                                // Store temp points for later use
                                this.appState.drawingPoints = points;
                                
                                // Reset drawing state
                                this.appState.isDrawing = false;
                                this.mapController.drawingMode = false;
                                
                                // Update UI
                                document.body.style.cursor = '';
                                confirmDrawingBtn.classList.remove('visible');
                                
                                if (this.uiController && typeof this.uiController.hideStatusBar === 'function') {
                                    this.uiController.hideStatusBar();
                                }
                            }
                        });
                    }
                    
                    // Map controls
                    const zoomInBtn = document.getElementById('zoom-in-btn');
                    if (zoomInBtn && this.mapController && this.mapController.map) {
                        zoomInBtn.addEventListener('click', (e) => {
                            this.mapController.map.zoomIn();
                        });
                    }
                    
                    const zoomOutBtn = document.getElementById('zoom-out-btn');
                    if (zoomOutBtn && this.mapController && this.mapController.map) {
                        zoomOutBtn.addEventListener('click', (e) => {
                            this.mapController.map.zoomOut();
                        });
                    }
                    
                    const locateBtn = document.getElementById('locate-btn');
                    if (locateBtn && this.mapController && typeof this.mapController.locateUser === 'function') {
                        locateBtn.addEventListener('click', (e) => {
                            this.mapController.locateUser();
                        });
                    }
                    
                    this._listenersInitialized = true;
                    console.log('Critical event listeners setup complete');
                } catch (e) {
                    console.error('Error setting up event listeners:', e);
                }
            };
        }
        
        // Check if event handlers are properly initialized and initialize if not
        if (!window.eventHandlers._listenersInitialized) {
            console.log('Initializing event handlers');
            window.eventHandlers.setupEventListeners();
        }
        
        return 'Event handling patched successfully';
    } catch (e) {
        console.error('Error patching event handling:', e);
        return 'Error patching event handling: ' + e.message;
    }
}

/**
 * Patch UI components
 */
function patchUIComponents() {
    if (!window.uiController) return 'No uiController to patch';
    
    try {
        // Fix missing toast functionality
        if (!window.uiController.showToast || typeof window.uiController.showToast !== 'function') {
            console.log('Patching toast notifications');
            window.uiController.showToast = function(message, type = 'info') {
                const container = document.getElementById('notification-container');
                if (!container) return;
                
                // Create toast element
                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                
                // Set icon based on type
                let icon;
                switch (type) {
                    case 'success': icon = 'fa-check-circle'; break;
                    case 'error': icon = 'fa-exclamation-circle'; break;
                    case 'warning': icon = 'fa-exclamation-triangle'; break;
                    default: icon = 'fa-info-circle';
                }
                
                toast.innerHTML = `
                    <div class="toast-icon">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="toast-message">${message}</div>
                `;
                
                // Add to container
                container.appendChild(toast);
                
                // Trigger animation
                setTimeout(() => {
                    toast.classList.add('visible');
                }, 10);
                
                // Auto remove after delay
                setTimeout(() => {
                    toast.classList.remove('visible');
                    
                    // Remove from DOM after animation
                    setTimeout(() => {
                        if (container.contains(toast)) {
                            container.removeChild(toast);
                        }
                    }, 300);
                }, 3000);
            };
        }
        
        // Fix status bar functionality
        if (!window.uiController.showStatusBar || typeof window.uiController.showStatusBar !== 'function') {
            console.log('Patching status bar functionality');
            window.uiController.showStatusBar = function(text) {
                const statusBar = document.getElementById('status-bar');
                const statusText = document.getElementById('status-text');
                
                if (!statusBar || !statusText) return;
                
                statusText.innerHTML = text;
                statusBar.classList.add('visible');
            };
            
            window.uiController.hideStatusBar = function() {
                const statusBar = document.getElementById('status-bar');
                if (!statusBar) return;
                
                statusBar.classList.remove('visible');
            };
        }
        
        // Fix modal handling
        if (!window.uiController.showAddUtilityModal || typeof window.uiController.showAddUtilityModal !== 'function') {
            console.log('Patching modal handling');
            
            // Generic show modal function
            window.uiController.showModal = function(modalId) {
                const modal = document.getElementById(modalId);
                if (!modal) return;
                
                modal.classList.add('visible');
            };
            
            // Generic hide modal function
            window.uiController.hideModal = function(modalId) {
                const modal = document.getElementById(modalId);
                if (!modal) return;
                
                modal.classList.remove('visible');
            };
            
            // Specific modal functions
            window.uiController.showAddUtilityModal = function() {
                this.showModal('add-utility-modal');
            };
            
            window.uiController.hideAddUtilityModal = function() {
                this.hideModal('add-utility-modal');
            };
            
            window.uiController.showAddStructureModal = function() {
                this.showModal('add-structure-modal');
            };
            
            window.uiController.hideAddStructureModal = function() {
                this.hideModal('add-structure-modal');
            };
        }
        
        // Fix measurement toolbar functionality
        if (!window.uiController.showMeasurementToolbar || typeof window.uiController.showMeasurementToolbar !== 'function') {
            console.log('Patching measurement toolbar functionality');
            window.uiController.showMeasurementToolbar = function() {
                const toolbar = document.getElementById('measurement-toolbar');
                if (!toolbar) return;
                
                toolbar.classList.add('visible');
            };
            
            window.uiController.hideMeasurementToolbar = function() {
                const toolbar = document.getElementById('measurement-toolbar');
                if (!toolbar) return;
                
                toolbar.classList.remove('visible');
            };
        }
        
        return 'UI components patched successfully';
    } catch (e) {
        console.error('Error patching UI components:', e);
        return 'Error patching UI components: ' + e.message;
    }
}

/**
 * Patch map functionality
 */
function patchMapFunctionality() {
    if (!window.mapController) return 'No mapController to patch';
    
    try {
        // Fix missing excavation mode functionality
        if (!window.mapController.enableExcavationMode || typeof window.mapController.enableExcavationMode !== 'function') {
            console.log('Patching excavation mode functionality');
            
            window.mapController.enableExcavationMode = function() {
                if (!this.appState) return;
                
                this.appState.isExcavationMode = true;
                
                // Show indicators in UI
                const excavationIndicator = document.getElementById('excavation-indicator');
                const exitExcavationBtn = document.getElementById('exit-excavation-btn');
                
                if (excavationIndicator) excavationIndicator.classList.add('visible');
                if (exitExcavationBtn) exitExcavationBtn.classList.add('visible');
                
                // Change map display
                const mapEl = document.getElementById('map');
                if (mapEl) mapEl.classList.add('excavation-mode');
                
                // Start high accuracy location tracking if available
                if (typeof this.startHighAccuracyLocationTracking === 'function') {
                    this.startHighAccuracyLocationTracking();
                }
                
                // Zoom in for better accuracy if map is available
                if (this.map) {
                    this.map.setZoom(21);
                    
                    // Add click handler for excavation site selection
                    this.excavationClickHandler = (e) => {
                        if (typeof this.setExcavationSite === 'function') {
                            this.setExcavationSite(e.latlng);
                        } else {
                            // Basic implementation
                            if (this.excavationCircle) {
                                this.map.removeLayer(this.excavationCircle);
                            }
                            
                            // Create a circle to represent the excavation area
                            this.excavationCircle = L.circle(e.latlng, {
                                color: '#f44336',
                                fillColor: '#f44336',
                                fillOpacity: 0.2,
                                weight: 3,
                                radius: 5 // 5-meter radius excavation area
                            }).addTo(this.map);
                            
                            // Store excavation site
                            this.appState.excavationSite = e.latlng;
                            
                            if (this.uiController && typeof this.uiController.showToast === 'function') {
                                this.uiController.showToast('Excavation site set', 'warning');
                            }
                        }
                        
                        // Remove the click handler after one use
                        this.map.off('click', this.excavationClickHandler);
                    };
                    
                    this.map.on('click', this.excavationClickHandler);
                    
                    // Center on user location if available
                    if (this.userLocationMarker) {
                        this.map.setView(this.userLocationMarker.getLatLng());
                    }
                }
            };
            
            window.mapController.disableExcavationMode = function() {
                if (!this.appState) return;
                
                this.appState.isExcavationMode = false;
                
                // Hide indicators in UI
                const excavationIndicator = document.getElementById('excavation-indicator');
                const exitExcavationBtn = document.getElementById('exit-excavation-btn');
                
                if (excavationIndicator) excavationIndicator.classList.remove('visible');
                if (exitExcavationBtn) exitExcavationBtn.classList.remove('visible');
                
                // Restore map display
                const mapEl = document.getElementById('map');
                if (mapEl) mapEl.classList.remove('excavation-mode');
                
                // Stop high accuracy tracking if available
                if (typeof this.stopHighAccuracyLocationTracking === 'function') {
                    this.stopHighAccuracyLocationTracking();
                }
                
                // Remove excavation site circle if exists
                if (this.excavationCircle && this.map) {
                    this.map.removeLayer(this.excavationCircle);
                    this.excavationCircle = null;
                }
                
                // Remove click handler if it's still active
                if (this.excavationClickHandler && this.map) {
                    this.map.off('click', this.excavationClickHandler);
                    this.excavationClickHandler = null;
                }
            };
        }
        
        // Fix draw functionality if missing
        if (!window.mapController.clearDrawing || typeof window.mapController.clearDrawing !== 'function') {
            console.log('Patching drawing functionality');
            
            window.mapController.clearDrawing = function() {
                if (this.currentLine && this.map) {
                    this.map.removeLayer(this.currentLine);
                    this.currentLine = null;
                }
                
                if (this.currentMarker && this.map) {
                    this.map.removeLayer(this.currentMarker);
                    this.currentMarker = null;
                }
                
                this.drawingMode = false;
                if (this.appState) this.appState.isDrawing = false;
                
                // Reset cursor
                document.body.style.cursor = '';
                
                // Hide UI elements
                const confirmBtn = document.getElementById('confirm-drawing-btn');
                if (confirmBtn) confirmBtn.classList.remove('visible');
            };
        }
        
        return 'Map functionality patched successfully';
    } catch (e) {
        console.error('Error patching map functionality:', e);
        return 'Error patching map functionality: ' + e.message;
    }
}

/**
 * Patch data handling
 */
function patchDataHandling() {
    if (!window.dataStore) return 'No dataStore to patch';
    
    try {
        // Fix any missing data handling functionality
        if (!window.dataStore.debouncedSave || typeof window.dataStore.debouncedSave !== 'function') {
            console.log('Patching data store save functionality');
            
            window.dataStore.debouncedSave = function() {
                const now = Date.now();
                
                // Create lastSaveTime if not exists
                if (!this.lastSaveTime) this.lastSaveTime = 0;
                
                // Create saveDebounceTime if not exists
                if (!this.saveDebounceTime) this.saveDebounceTime = 500;
                
                // If it's been less than the debounce time since the last save, delay it
                if (now - this.lastSaveTime < this.saveDebounceTime) {
                    // Clear any pending save
                    if (this.pendingSave) {
                        clearTimeout(this.pendingSave);
                    }
                    
                    // Schedule a new save
                    this.pendingSave = setTimeout(() => {
                        if (typeof this.saveData === 'function') {
                            this.saveData();
                        }
                        this.pendingSave = null;
                    }, this.saveDebounceTime);
                } else {
                    // Save immediately
                    if (typeof this.saveData === 'function') {
                        this.saveData();
                    }
                    this.lastSaveTime = now;
                }
            };
        }
        
        return 'Data handling patched successfully';
    } catch (e) {
        console.error('Error patching data handling:', e);
        return 'Error patching data handling: ' + e.message;
    }
}

/**
 * Check component connections
 */
function checkComponentConnections() {
    try {
        const checks = {
            appState: !!window.appState,
            dataStore: !!window.dataStore,
            mapController: !!window.mapController,
            uiController: !!window.uiController,
            eventHandlers: !!window.eventHandlers,
            mapInitialized: !!(window.mapController && window.mapController.map),
            leaflet: !!window.L
        };
        
        console.log('Component status check:', checks);
        
        // Fix critical missing connections
        if (window.appState && window.dataStore && window.mapController && window.uiController) {
            // Connect controllers to each other
            window.mapController.appState = window.appState;
            window.mapController.dataStore = window.dataStore;
            window.mapController.uiController = window.uiController;
            
            window.uiController.appState = window.appState;
            window.uiController.dataStore = window.dataStore;
            window.uiController.mapController = window.mapController;
            
            if (window.eventHandlers) {
                window.mapController.eventHandlers = window.eventHandlers;
                window.uiController.eventHandlers = window.eventHandlers;
                
                window.eventHandlers.appState = window.appState;
                window.eventHandlers.dataStore = window.dataStore;
                window.eventHandlers.mapController = window.mapController;
                window.eventHandlers.uiController = window.uiController;
            }
            
            // Connect data store to controllers
            window.dataStore.mapController = window.mapController;
            window.dataStore.uiController = window.uiController;
            
            console.log('Critical connections established');
        }
        
        return checks;
    } catch (e) {
        console.error('Error checking component connections:', e);
        return { error: e.message };
    }
}

// Initialize function to be auto-run
document.addEventListener('DOMContentLoaded', function() {
    // Wait for a short delay to let normal initialization happen first
    setTimeout(function() {
        // Only run patch if we detect issues
        const shouldPatch = !window.mapController || 
                           !window.mapController.map || 
                           !window.mapController.startMeasurement ||
                           !window.uiController || 
                           !window.uiController.showToast ||
                           !window.dataStore ||
                           !window.appState;
                           
        if (shouldPatch) {
            console.log('Detected issues, running patch script...');
            window.patchCACUtiliTrack();
        }
    }, 2000);
});

// Export the patch function for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { patchCACUtiliTrack: window.patchCACUtiliTrack };
} 