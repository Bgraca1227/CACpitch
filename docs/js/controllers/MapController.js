/**
 * Position filter for smoothing location data
 */
class PositionFilter {
    constructor() {
        this.positions = [];
        this.maxPositions = 5;  // Number of positions to keep for filtering
        this.accuracyThreshold = 20; // Meters - reject positions worse than this
        this.headings = [];
        this.maxHeadings = 8;   // Heading samples to keep
    }
    
    addPosition(position) {
        // Only add positions with good accuracy
        if (position.coords.accuracy <= this.accuracyThreshold) {
            this.positions.push(position);
            
            // Keep only the most recent positions
            if (this.positions.length > this.maxPositions) {
                this.positions.shift();
            }
        }
        
        return this.getFilteredPosition();
    }
    
    getFilteredPosition() {
        if (this.positions.length === 0) return null;
        
        // Weight positions by recency and accuracy
        let totalWeight = 0;
        let weightedLat = 0;
        let weightedLng = 0;
        
        this.positions.forEach((pos, index) => {
            // More recent positions get higher weight
            const recencyWeight = (index + 1) / this.positions.length;
            // More accurate positions get higher weight
            const accuracyWeight = 1 / Math.max(1, pos.coords.accuracy);
            const weight = recencyWeight * accuracyWeight;
            
            weightedLat += pos.coords.latitude * weight;
            weightedLng += pos.coords.longitude * weight;
            totalWeight += weight;
        });
        
        // Return weighted average position
        return {
            latitude: weightedLat / totalWeight,
            longitude: weightedLng / totalWeight
        };
    }
    
    addHeading(heading) {
        if (isNaN(heading)) return this.getFilteredHeading();
        
        this.headings.push(heading);
        
        if (this.headings.length > this.maxHeadings) {
            this.headings.shift();
        }
        
        return this.getFilteredHeading();
    }
    
    getFilteredHeading() {
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
    }
    
    reset() {
        this.positions = [];
        this.headings = [];
    }
}

/**
 * CAC UtiliTrack - Map Controller
 * 
 * Responsible for:
 * - Initializing and managing the Leaflet map
 * - Managing map layers and utilities
 * - Handling utility drawing and positioning
 * - Managing measurement tools
 * - Handling excavation mode functionality
 */

// Import Leaflet as a global (already loaded via CDN)
const L = window.L;

export class MapController {
    constructor(appState, dataStore) {
        this.appState = appState;
        this.dataStore = dataStore;
        this.map = null;
        this.baseLayers = {}; // Added for different map types
        this.utilityLayers = {
            water: L.layerGroup(),
            gas: L.layerGroup(),
            electric: L.layerGroup(),
            sewer: L.layerGroup(),
            telecom: L.layerGroup()
        };
        this.structureLayers = {
            water: L.layerGroup(),
            gas: L.layerGroup(),
            electric: L.layerGroup(),
            sewer: L.layerGroup(),
            telecom: L.layerGroup()
        };
        this.basemaps = {};
        this.currentMarker = null;
        this.currentLine = null;
        this.drawingMode = false;
        this.measurementLayer = L.layerGroup();
        this.annotationLayer = L.layerGroup();
        this.excavationCircle = null;
        this.proximityThreshold = 10; // meters
        this.userLocationMarker = null;
        this.watchPositionId = null;
        this.currentHeading = 0;
        this.connectionPointMarker = null;
        this.drawingPoints = [];
        this.uiController = null; // Will be set by main.js
        this.eventHandlers = null; // Will be set by main.js
        this.accuracyCircle = null;
        
        // Position filtering system - critical for accurate mapping
        this.locationFilter = new PositionFilter();
    }

    /**
     * Initialize the map with default settings
     */
    initMap() {
        // Create map instance with default settings
        this.map = L.map('map', {
            center: [38.897957, -77.036560], // Default center (Washington DC)
            zoom: 18,                       // Default zoom
            zoomControl: false,             // Disable default zoom control to use custom
            attributionControl: true,
            maxZoom: 22                     // High zoom for detailed mapping
        });
        
        // Create base map layer - we'll use OpenStreetMap as default
        this.streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 22
        }).addTo(this.map);
        
        // Add utility layers to map
        for (const type in this.utilityLayers) {
            this.utilityLayers[type].addTo(this.map);
            this.structureLayers[type].addTo(this.map);
        }
        
        // Add measurement layer to map
        this.measurementLayer.addTo(this.map);
        
        // Store initial map center and zoom
        this.appState.lastMapCenter = this.map.getCenter();
        this.appState.lastMapZoom = this.map.getZoom();
        
        // Set up map controls
        this.setupMapControls();
        
        // Set up map event handlers
        this.setupMapEvents();
        
        console.log('Map initialized successfully');
    }

    /**
     * Set up basic map controls
     */
    setupMapControls() {
        // Zoom control handlers
        document.getElementById('zoom-in-btn').addEventListener('click', () => {
            this.map.zoomIn();
        });

        document.getElementById('zoom-out-btn').addEventListener('click', () => {
            this.map.zoomOut();
        });

        // Locate user
        document.getElementById('locate-btn').addEventListener('click', () => {
            this.locateUser();
        });

        // Re-center map
        document.getElementById('recenter-btn').addEventListener('click', () => {
            if (this.appState.lastMapCenter) {
                this.map.setView(this.appState.lastMapCenter, this.appState.lastMapZoom || 18);
            }
        });
        
        // Layers button
        document.getElementById('layers-btn').addEventListener('click', () => {
            if (this.uiController) {
                this.uiController.toggleLayersPanel();
            }
        });
        
        // Measure button
        document.getElementById('measure-btn').addEventListener('click', () => {
            if (this.eventHandlers) {
                this.eventHandlers.toggleMeasurementMode();
            }
        });
        
        // Add map view controls to layers panel
        this.setupMapViewControls();
    }
    
    /**
     * Set up controls for changing map views/base layers
     */
    setupMapViewControls() {
        // Create map view controls in the layers panel
        const layersPanel = document.getElementById('layers-panel');
        if (!layersPanel) return;
        
        // Add map views section if it doesn't exist
        if (!document.getElementById('map-views-section')) {
            const panelBody = layersPanel.querySelector('.panel-body');
            if (!panelBody) return;
            
            const mapViewsSection = document.createElement('div');
            mapViewsSection.id = 'map-views-section';
            mapViewsSection.style.marginBottom = '20px';
            
            mapViewsSection.innerHTML = `
                <div style="font-weight: 500; margin-bottom: 10px;">Map Views</div>
                <div class="form-group">
                    <div class="radio-item">
                        <input type="radio" id="view-streets" name="map-view" value="streets" checked>
                        <label for="view-streets">Streets</label>
                    </div>
                </div>
                <div class="form-group">
                    <div class="radio-item">
                        <input type="radio" id="view-satellite" name="map-view" value="satellite">
                        <label for="view-satellite">Satellite</label>
                    </div>
                </div>
                <div class="form-group">
                    <div class="radio-item">
                        <input type="radio" id="view-hybrid" name="map-view" value="hybrid">
                        <label for="view-hybrid">Hybrid</label>
                    </div>
                </div>
            `;
            
            // Insert before the last section
            panelBody.insertBefore(mapViewsSection, panelBody.lastElementChild);
            
            // Add event listeners for the radio buttons
            document.getElementById('view-streets').addEventListener('click', () => {
                this.setMapView('streets');
            });
            
            document.getElementById('view-satellite').addEventListener('click', () => {
                this.setMapView('satellite');
            });
            
            document.getElementById('view-hybrid').addEventListener('click', () => {
                this.setMapView('hybrid');
            });
        }
    }
    
    /**
     * Set the map view (streets, satellite, hybrid)
     * @param {string} view The map view to set
     */
    setMapView(view) {
        // Remove all existing tile layers
        if (this.streetLayer) this.map.removeLayer(this.streetLayer);
        if (this.satelliteLayer) this.map.removeLayer(this.satelliteLayer);
        if (this.hybridLayer) this.map.removeLayer(this.hybridLayer);
        
        // Add the selected layer
        switch (view) {
            case 'streets':
                if (!this.streetLayer) {
                    this.streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                        maxZoom: 22
                    });
                }
                this.streetLayer.addTo(this.map);
                break;
                
            case 'satellite':
                if (!this.satelliteLayer) {
                    this.satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                        maxZoom: 22
                    });
                }
                this.satelliteLayer.addTo(this.map);
                break;
                
            case 'hybrid':
                if (!this.satelliteLayer) {
                    this.satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                        maxZoom: 22
                    });
                }
                
                if (!this.hybridLayer) {
                    this.hybridLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                        maxZoom: 22,
                        opacity: 0.5
                    });
                }
                
                this.satelliteLayer.addTo(this.map);
                this.hybridLayer.addTo(this.map);
                break;
        }
        
        // Update the radio buttons to reflect current selection
        document.querySelectorAll('input[name="map-view"]').forEach(input => {
            input.checked = input.value === view;
        });
        
        // Store the current view preference
        this.appState.mapView = view;
        
        // Show a notification
        if (this.uiController) {
            this.uiController.showToast(`Switched to ${view} view`, 'info');
        }
    }

    /**
     * Set up map event listeners
     */
    setupMapEvents() {
        // Track map movement
        this.map.on('moveend', () => {
            this.appState.lastMapCenter = this.map.getCenter();
            this.appState.lastMapZoom = this.map.getZoom();
            
            // Check zoom level for warning
            this.checkZoomLevel();
        });

        // Map click for adding utilities in mapping mode
        this.map.on('click', (e) => {
            if (this.appState.mode === 'mapping' && this.drawingMode) {
                this.handleMapClick(e);
            } else if (this.appState.isMeasuring) {
                this.handleMeasurementClick(e);
            }
        });
    }

    /**
     * Check if current zoom level is sufficient for utility mapping
     */
    checkZoomLevel() {
        const zoomWarning = document.getElementById('zoom-warning');
        if (this.map.getZoom() < 17) {
            zoomWarning.classList.add('visible');
        } else {
            zoomWarning.classList.remove('visible');
        }
    }

    /**
     * Use browser geolocation to locate the user
     */
    locateUser() {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLocation = [position.coords.latitude, position.coords.longitude];
                    this.map.setView(userLocation, 19);
                    
                    // Add a temporary marker showing user location
                    L.marker(userLocation, {
                        icon: L.divIcon({
                            className: 'user-location-marker',
                            html: '<i class="fas fa-crosshairs"></i>',
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                        })
                    }).addTo(this.map)
                    .bindPopup("Your location")
                    .openPopup();

                    // Store the location
                    this.appState.userLocation = userLocation;
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    // Should show an error notification via UIController
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            console.error('Geolocation not supported');
            // Should show an error notification via UIController
        }
    }

    /**
     * Load utilities from the data store
     */
    loadUtilities() {
        // Clear existing layers
        Object.values(this.utilityLayers).forEach(layer => layer.clearLayers());
        Object.values(this.structureLayers).forEach(layer => layer.clearLayers());

        // Get utilities from the data store
        const utilities = this.dataStore.getUtilities();
        utilities.forEach(utility => {
            this.renderUtility(utility);
        });

        // Get structures from the data store
        const structures = this.dataStore.getStructures();
        structures.forEach(structure => {
            this.renderStructure(structure);
        });
    }

    /**
     * Render a utility on the map
     * @param {Object} utility The utility to render
     */
    renderUtility(utility) {
        if (!utility || !utility.coordinates || utility.coordinates.length < 2) {
            console.error('Invalid utility data:', utility);
            return;
        }

        // Create a polyline for the utility
        const line = L.polyline(utility.coordinates, {
            color: this.getUtilityColor(utility.type),
            weight: utility.lineType === 'main' ? 5 : 3,
            opacity: 0.8,
            dashArray: utility.lineType === 'service' ? '5, 5' : null
        });

        // Add data to the line
        line.utilityId = utility.id;
        line.utilityData = utility;

        // Add popup
        line.bindPopup(this.createUtilityPopupContent(utility));

        // Add to the appropriate layer
        if (this.utilityLayers[utility.type]) {
            line.addTo(this.utilityLayers[utility.type]);
        }

        return line;
    }

    /**
     * Render a structure on the map
     * @param {Object} structure The structure to render
     */
    renderStructure(structure) {
        if (!structure || !structure.coordinates) {
            console.error('Invalid structure data:', structure);
            return;
        }

        // Create a marker for the structure
        const marker = L.marker(structure.coordinates, {
            icon: L.divIcon({
                className: `structure-marker ${structure.type} ${structure.utilityType}`,
                html: this.getStructureIconHtml(structure),
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        });

        // Add data to the marker
        marker.structureId = structure.id;
        marker.structureData = structure;

        // Add popup
        marker.bindPopup(this.createStructurePopupContent(structure));

        // Add to the appropriate layer
        if (this.structureLayers[structure.utilityType]) {
            marker.addTo(this.structureLayers[structure.utilityType]);
        }

        return marker;
    }

    /**
     * Get the appropriate color for a utility type
     * @param {string} utilityType The type of utility
     * @returns {string} Color value
     */
    getUtilityColor(utilityType) {
        const colors = {
            water: '#29b6f6',     // Blue
            gas: '#ffb300',       // Amber
            electric: '#ffee58',  // Yellow
            sewer: '#8d6e63',     // Brown
            telecom: '#ab47bc'    // Purple
        };
        return colors[utilityType] || '#888888';
    }

    /**
     * Get the HTML for a structure icon
     * @param {Object} structure The structure data
     * @returns {string} HTML string
     */
    getStructureIconHtml(structure) {
        const iconMap = {
            valve: '<i class="fas fa-tint-slash"></i>',
            meter: '<i class="fas fa-tachometer-alt"></i>',
            hydrant: '<i class="fas fa-fire-extinguisher"></i>',
            regulator: '<i class="fas fa-compress-alt"></i>',
            transformer: '<i class="fas fa-car-battery"></i>',
            junction: '<i class="fas fa-box"></i>',
            manhole: '<i class="fas fa-circle"></i>',
            catchbasin: '<i class="fas fa-water"></i>',
            handhole: '<i class="fas fa-box-open"></i>'
        };
        return iconMap[structure.structureType] || '<i class="fas fa-question"></i>';
    }

    /**
     * Create HTML content for utility popups
     * @param {Object} utility The utility data
     * @returns {string} HTML content
     */
    createUtilityPopupContent(utility) {
        return `
            <div class="map-popup utility-popup ${utility.type}">
                <div class="popup-header">
                    <i class="fas ${this.getUtilityIcon(utility.type)}"></i>
                    <h3>${this.getUtilityTitle(utility)}</h3>
                </div>
                <div class="popup-content">
                    <p><strong>Size:</strong> ${utility.size} inches</p>
                    <p><strong>Depth:</strong> ${utility.depth} feet</p>
                    <p><strong>Material:</strong> ${utility.material}</p>
                    <p><strong>Condition:</strong> ${utility.condition}</p>
                </div>
                <div class="popup-footer">
                    <button class="btn btn-sm btn-primary view-details-btn" data-id="${utility.id}" data-type="utility">
                        View Details
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Create HTML content for structure popups
     * @param {Object} structure The structure data
     * @returns {string} HTML content
     */
    createStructurePopupContent(structure) {
        return `
            <div class="map-popup structure-popup ${structure.utilityType}">
                <div class="popup-header">
                    <i class="fas ${this.getStructureIcon(structure.structureType)}"></i>
                    <h3>${this.getStructureTitle(structure)}</h3>
                </div>
                <div class="popup-content">
                    <p><strong>Size:</strong> ${structure.size} inches</p>
                    <p><strong>Depth:</strong> ${structure.depth} feet</p>
                    <p><strong>Material:</strong> ${structure.material}</p>
                    <p><strong>Condition:</strong> ${structure.condition}</p>
                </div>
                <div class="popup-footer">
                    <button class="btn btn-sm btn-primary view-details-btn" data-id="${structure.id}" data-type="structure">
                        View Details
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Get the Font Awesome icon class for a utility type
     * @param {string} utilityType The type of utility
     * @returns {string} Icon class
     */
    getUtilityIcon(utilityType) {
        const icons = {
            water: 'fa-tint',
            gas: 'fa-fire',
            electric: 'fa-bolt',
            sewer: 'fa-toilet',
            telecom: 'fa-phone'
        };
        return icons[utilityType] || 'fa-question-circle';
    }

    /**
     * Get the Font Awesome icon class for a structure type
     * @param {string} structureType The type of structure
     * @returns {string} Icon class
     */
    getStructureIcon(structureType) {
        const icons = {
            valve: 'fa-tint-slash',
            meter: 'fa-tachometer-alt',
            hydrant: 'fa-fire-extinguisher',
            regulator: 'fa-compress-alt',
            transformer: 'fa-car-battery',
            junction: 'fa-box',
            manhole: 'fa-circle',
            catchbasin: 'fa-water',
            handhole: 'fa-box-open'
        };
        return icons[structureType] || 'fa-question-circle';
    }

    /**
     * Get a human-readable title for a utility
     * @param {Object} utility The utility data
     * @returns {string} Title
     */
    getUtilityTitle(utility) {
        const typeNames = {
            water: 'Water',
            gas: 'Gas',
            electric: 'Electric',
            sewer: 'Sewer',
            telecom: 'Telecom'
        };
        const lineTypeNames = {
            main: 'Main',
            service: 'Service Line'
        };
        return `${typeNames[utility.type] || 'Unknown'} ${lineTypeNames[utility.lineType] || ''}`;
    }

    /**
     * Get a human-readable title for a structure
     * @param {Object} structure The structure data
     * @returns {string} Title
     */
    getStructureTitle(structure) {
        const structureTypeNames = {
            valve: 'Valve',
            meter: 'Meter',
            hydrant: 'Hydrant',
            regulator: 'Regulator',
            transformer: 'Transformer',
            junction: 'Junction Box',
            manhole: 'Manhole',
            catchbasin: 'Catch Basin',
            handhole: 'Handhole'
        };
        return structureTypeNames[structure.structureType] || 'Unknown Structure';
    }

    /**
     * Handle map clicks in mapping mode
     * @param {Object} e Map click event
     */
    handleMapClick(e) {
        const latlng = e.latlng;
        
        // If this is the first point, create a new line
        if (!this.currentLine) {
            this.startNewLine(latlng);
        } else {
            // Add a point to the existing line
            this.addPointToLine(latlng);
        }
    }

    /**
     * Start a new utility line
     * @param {L.LatLng} latlng The starting point
     */
    startNewLine(latlng) {
        // Create a marker for the first point
        this.currentMarker = L.marker(latlng, {
            icon: L.divIcon({
                className: `utility-marker ${this.appState.selectedUtility}`,
                html: `<i class="fas ${this.getUtilityIcon(this.appState.selectedUtility)}"></i>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(this.map);

        // Create a new line with just the starting point
        this.currentLine = L.polyline([latlng], {
            color: this.getUtilityColor(this.appState.selectedUtility),
            weight: this.appState.lineType === 'main' ? 5 : 3,
            opacity: 0.8,
            dashArray: this.appState.lineType === 'service' ? '5, 5' : null
        }).addTo(this.map);

        // Show the finish drawing button
        document.getElementById('confirm-drawing-btn').classList.add('visible');
    }

    /**
     * Add a point to the current line
     * @param {L.LatLng} latlng The new point
     */
    addPointToLine(latlng) {
        // Get current line points
        const currentPoints = this.currentLine.getLatLngs();
        
        // Add the new point
        currentPoints.push(latlng);
        
        // Update the line
        this.currentLine.setLatLngs(currentPoints);
    }

    /**
     * Finish the current drawing and return the points
     * @returns {Array|null} The points of the drawing or null if no valid drawing
     */
    finishDrawing() {
        if (this.drawingMode && this.currentLine) {
            // Get the points from the current line
            const points = this.currentLine.getLatLngs();
            
            // Need at least 2 points for a valid line
            if (points.length < 2) {
                return null;
            }
            
            // Reset drawing state
            this.drawingMode = false;
            
            // Clean up the temporary drawing
            this.clearDrawing();
            
            // Return the points for further processing
            return points;
        }
        
        return null;
    }

    /**
     * Clear the current drawing
     */
    clearDrawing() {
        if (this.currentLine) {
            this.map.removeLayer(this.currentLine);
            this.currentLine = null;
        }
        
        if (this.currentMarker) {
            this.map.removeLayer(this.currentMarker);
            this.currentMarker = null;
        }
        
        this.drawingMode = false;
        this.appState.isDrawing = false;
        
        // Reset cursor
        document.body.style.cursor = '';
    }

    /**
     * Handle measurement clicks on map
     */
    handleMeasurementClick(e) {
        if (!this.appState.isMeasuring) return;
        
        // Get click coordinates
        const latlng = e.latlng;
        
        // Add point to measurement
        this.addMeasurementPoint(latlng);
    }
    
    /**
     * Add a point to the current measurement
     * @param {L.LatLng} latlng The point to add
     */
    addMeasurementPoint(latlng) {
        // Add to points array
        this.appState.measurePoints.push(latlng);
        
        // Update UI status
        const count = this.appState.measurePoints.length;
        this.uiController.showStatusBar(`Point ${count} added. Click again to measure distance.`);
        
        // If we have two points, complete the measurement
        if (count === 2) {
            // Create a permanent measurement line
            this.addMeasurementLine(this.appState.measurePoints);
            
            // Reset for next measurement
            this.appState.measurePoints = [];
            
            // Remove temporary line
            if (this.appState.measureLine) {
                this.map.removeLayer(this.appState.measureLine);
                this.appState.measureLine = null;
            }
            
            this.uiController.showStatusBar('Measurement added. Click to start a new measurement.');
        }
    }
    
    /**
     * Get the midpoint between two coordinates
     */
    getMidpoint(p1, p2) {
        return [
            (p1.lat + p2.lat) / 2,
            (p1.lng + p2.lng) / 2
        ];
    }
    
    /**
     * Calculate the distance between two points in meters
     */
    calculateDistance(p1, p2) {
        return this.map.distance(p1, p2);
    }
    
    /**
     * Format a distance value for display
     */
    formatDistance(distanceInMeters) {
        if (distanceInMeters < 1000) {
            return `${distanceInMeters.toFixed(1)} m`;
        } else {
            return `${(distanceInMeters / 1000).toFixed(2)} km`;
        }
    }
    
    /**
     * End the current measurement session
     */
    endMeasurement() {
        this.appState.isMeasuring = false;
        
        // Hide measurement UI
        if (this.uiController) {
            this.uiController.hideMeasurementToolbar();
        }
        
        // Show notification
        if (this.uiController) {
            this.uiController.showToast('Measurement completed', 'success');
        }
    }
    
    /**
     * Clear all measurements from the map
     */
    clearMeasurements() {
        // Clear the measurement layer
        this.measurementLayer.clearLayers();
        
        // Reset measurement state
        this.appState.isMeasuring = false;
        this.appState.measurementPoints = [];
        
        // Update UI if needed
        if (this.uiController && this.uiController.updateMeasurementTotal) {
            this.uiController.updateMeasurementTotal(0);
        }
    }

    /**
     * Enable excavation mode
     */
    enableExcavationMode() {
        this.appState.isExcavationMode = true;
        
        // Show indicators in UI
        document.getElementById('excavation-indicator').classList.add('visible');
        document.getElementById('exit-excavation-btn').classList.add('visible');
        
        // Change map display
        document.getElementById('map').classList.add('excavation-mode');
        
        // Start high accuracy location tracking if not already running
        if (!this.watchPositionId) {
            this.startHighAccuracyLocationTracking();
        }
        
        // Add instruction to click for setting excavation site
        if (this.uiController) {
            this.uiController.showToast('Click on the map to set your excavation site', 'warning', 5000);
        }
        
        // Set up click handler for excavation site selection
        this.excavationClickHandler = (e) => {
            this.setExcavationSite(e.latlng);
            
            // Remove the click handler after one use
            this.map.off('click', this.excavationClickHandler);
        };
        
        this.map.on('click', this.excavationClickHandler);
        
        // Zoom in for better accuracy
        this.map.setZoom(Math.max(this.map.getZoom(), 19));
        
        // Center on user location if available
        if (this.userLocationMarker) {
            this.map.setView(this.userLocationMarker.getLatLng());
        }
    }

    /**
     * Disable excavation mode
     */
    disableExcavationMode() {
        this.appState.isExcavationMode = false;
        
        // Hide indicators in UI
        document.getElementById('excavation-indicator').classList.remove('visible');
        document.getElementById('exit-excavation-btn').classList.remove('visible');
        document.getElementById('map').classList.remove('excavation-mode');
        
        // Stop high accuracy tracking
        this.stopHighAccuracyLocationTracking();
        
        // Remove excavation site circle if exists
        if (this.excavationCircle) {
            this.map.removeLayer(this.excavationCircle);
            this.excavationCircle = null;
        }
        
        // Remove proximity alerts
        this.clearProximityAlerts();
        
        // Remove click handler if it's still active
        if (this.excavationClickHandler) {
            this.map.off('click', this.excavationClickHandler);
            this.excavationClickHandler = null;
        }
        
        // Reset line styling
        this.resetProximityHighlights();
        
        // Update UI
        if (this.uiController) {
            this.uiController.showToast('Excavation mode deactivated', 'info');
            this.uiController.hideStatusBar();
        }
        
        // Disable auto-follow for user location
        this.locationFollowingEnabled = false;
        
        // Remove active state from button
        document.querySelector('.mode-button[data-mode="excavation"]')?.classList.remove('active');
        
        // Set discovery mode as active
        document.querySelector('.mode-button[data-mode="discovery"]')?.classList.add('active');
    }

    /**
     * Set the excavation site location
     * @param {L.LatLng} latlng The center point of the excavation
     */
    setExcavationSite(latlng) {
        // Remove existing excavation circle
        if (this.excavationCircle) {
            this.map.removeLayer(this.excavationCircle);
        }
        
        // Create a circle to represent the excavation area
        this.excavationCircle = L.circle(latlng, {
            color: '#f44336',
            fillColor: '#f44336',
            fillOpacity: 0.2,
            weight: 3,
            radius: 5, // 5-meter radius excavation area
            className: 'pulsing-circle' // Add a class for CSS animations
        }).addTo(this.map);
        
        // Add excavation marker at center
        if (this.excavationMarker) {
            this.map.removeLayer(this.excavationMarker);
        }
        
        // Create marker with excavation icon
        this.excavationMarker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'excavation-marker',
                html: '<i class="fas fa-hard-hat"></i>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            }),
            zIndexOffset: 1000
        }).addTo(this.map);
        
        // Store excavation site
        this.appState.excavationSite = latlng;
        
        // Start checking for utilities in proximity
        this.checkProximityAlerts();
        
        // Show toast notification
        if (this.uiController) {
            this.uiController.showToast('Excavation site set. Monitoring for nearby utilities.', 'warning');
        }
        
        // Enable proximity monitoring interval
        this.startProximityMonitoring();
    }

    /**
     * Start proximity monitoring at regular intervals
     */
    startProximityMonitoring() {
        // Clear any existing interval
        this.clearProximityMonitoring();
        
        // Start a new interval to check proximity
        this.proximityInterval = setInterval(() => {
            if (this.appState.isExcavationMode) {
                this.checkProximityAlerts();
            }
        }, 3000); // Check every 3 seconds
    }

    /**
     * Clear proximity monitoring interval
     */
    clearProximityMonitoring() {
        if (this.proximityInterval) {
            clearInterval(this.proximityInterval);
            this.proximityInterval = null;
        }
    }

    /**
     * Start high accuracy location tracking
     */
    startHighAccuracyLocationTracking() {
        // Stop existing watch if any
        this.stopHighAccuracyLocationTracking();
        
        // Reset position filter
        this.locationFilter.reset();
        
        if (navigator.geolocation) {
            // Show loading indicator
            if (this.uiController) {
                this.uiController.showStatusBar('Getting precise location...');
            }
            
            // First get a single high-accuracy position
            navigator.geolocation.getCurrentPosition(
                // Success callback for initial position
                (initialPosition) => {
                    console.log('Initial position obtained:', initialPosition.coords);
                    
                    // Add to filter
                    this.locationFilter.addPosition(initialPosition);
                    
                    // Update marker position
                    this.updateLocationMarker(initialPosition);
                    
                    // Start continuous watching with high accuracy
                    this.appState.highAccuracyWatchId = navigator.geolocation.watchPosition(
                        // Success callback for position updates
                        (position) => {
                            // Add to filter for smoothing
                            const filteredPosition = this.locationFilter.addPosition(position);
                            
                            if (filteredPosition) {
                                // Create enhanced position object with filtered coordinates
                                const enhancedPosition = {
                                    coords: {
                                        latitude: filteredPosition.latitude,
                                        longitude: filteredPosition.longitude,
                                        accuracy: position.coords.accuracy,
                                        heading: position.coords.heading || null,
                                        speed: position.coords.speed || 0
                                    },
                                    timestamp: position.timestamp
                                };
                                
                                // Update location marker with enhanced position
                                this.updateLocationMarker(enhancedPosition);
                            } else {
                                // If filtering failed, use raw position
                                this.updateLocationMarker(position);
                            }
                            
                            // Update heading indicator if available
                            if (position.coords.heading !== null && position.coords.heading !== undefined) {
                                const filteredHeading = this.locationFilter.addHeading(position.coords.heading);
                                this.updateHeading(filteredHeading);
                            }
                            
                            // Update proximity calculations in excavation mode
                            if (this.appState.isExcavationMode && this.excavationCircle) {
                                this.checkProximityAlerts();
                            }
                            
                            // Hide status bar if still showing
                            if (this.uiController && this.uiController.isStatusBarVisible) {
                                this.uiController.hideStatusBar();
                            }
                        },
                        // Error callback
                        (error) => {
                            console.error('Geolocation error:', error);
                            if (this.uiController) {
                                switch (error.code) {
                                    case error.PERMISSION_DENIED:
                                        this.uiController.showToast('Location access denied by user', 'error');
                                        break;
                                    case error.POSITION_UNAVAILABLE:
                                        this.uiController.showToast('Location information unavailable', 'error');
                                        break;
                                    case error.TIMEOUT:
                                        this.uiController.showToast('Location request timed out', 'error');
                                        break;
                                    default:
                                        this.uiController.showToast('Unknown error getting location', 'error');
                                }
                                this.uiController.hideStatusBar();
                            }
                        },
                        // Options for high accuracy
                        {
                            enableHighAccuracy: true,
                            timeout: 15000,
                            maximumAge: 0
                        }
                    );
                    
                    // Set up orientation tracking for heading
                    this.setupOrientationTracking();
                },
                // Error callback for initial position
                (error) => {
                    console.error('Error getting initial position:', error);
                    if (this.uiController) {
                        this.uiController.showToast('Unable to get your location', 'error');
                        this.uiController.hideStatusBar();
                    }
                },
                // Options for initial position
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            console.error('Geolocation not supported');
            if (this.uiController) {
                this.uiController.showToast('Geolocation not supported in your browser', 'error');
            }
        }
    }

    /**
     * Stop high accuracy location tracking
     */
    stopHighAccuracyLocationTracking() {
        if (this.appState.highAccuracyWatchId !== null) {
            navigator.geolocation.clearWatch(this.appState.highAccuracyWatchId);
            this.appState.highAccuracyWatchId = null;
            console.log('Stopped high accuracy location tracking');
        }
        
        // Stop orientation tracking
        if (this.orientationListenerAdded) {
            window.removeEventListener('deviceorientation', this.handleOrientation);
            this.orientationListenerAdded = false;
            console.log('Stopped orientation tracking');
        }
    }

    /**
     * Update user location marker's heading indicator
     * @param {number} heading The heading in degrees (0-359)
     */
    updateHeading(heading) {
        if (isNaN(heading)) return;
        
        // Apply smoothing for smoother rotations (avoid jerky movements)
        if (this.currentHeading !== undefined) {
            // Calculate shortest path between old and new heading
            let diff = heading - this.currentHeading;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            
            // Apply smoothing factor 
            const smoothingFactor = 0.3; // Adjust for more or less smoothing
            heading = this.currentHeading + (diff * smoothingFactor);
            
            // Normalize to 0-360 range
            if (heading < 0) heading += 360;
            if (heading >= 360) heading -= 360;
        }
        
        // Store current heading
        this.currentHeading = heading;
        
        // Update marker if it exists
        if (this.userLocationMarker) {
            const markerElement = this.userLocationMarker.getElement();
            if (markerElement) {
                // Update both the SVG icon and the heading arrow
                const iconElement = markerElement.querySelector('.location-marker-svg');
                const headingElement = markerElement.querySelector('.location-heading');
                
                if (iconElement) {
                    // Rotate the SVG icon to match the heading
                    iconElement.style.transform = `rotate(${heading}deg)`;
                }
                
                if (headingElement) {
                    // Make sure the arrow is visible
                    headingElement.style.opacity = '1';
                    // Update arrow rotation
                    headingElement.style.transform = `translateX(-50%) rotate(${heading}deg)`;
                }
                
                // Add heading indicator class if not already there
                markerElement.classList.add('with-heading');
            }
        }
    }

    /**
     * Check for utilities near the excavation site
     */
    checkProximityAlerts() {
        if (!this.appState.isExcavationMode || !this.excavationCircle) return;
        
        const excavationCenter = this.excavationCircle.getLatLng();
        const utilitiesInProximity = [];
        
        // Clear existing alerts
        this.clearProximityAlerts();
        
        // Check all utility types
        for (const type in this.utilityLayers) {
            this.utilityLayers[type].eachLayer(layer => {
                if (layer.utilityId) {
                    try {
                        // Calculate distance from excavation to utility
                        const distance = this.getMinDistanceToUtility(excavationCenter, layer);
                        
                        // If within threshold distance
                        if (distance < 50) { // 50 feet threshold
                            // Find the utility data
                            const utility = this.dataStore.getUtilityById(layer.utilityId);
                            if (utility) {
                                // Add to proximity list
                                utilitiesInProximity.push({
                                    utility: utility,
                                    distance: distance,
                                    layer: layer
                                });
                                
                                // Highlight the utility based on distance
                                this.highlightUtilityByProximity(layer, distance);
                            }
                        } else {
                            // Remove any existing highlight
                            this.removeProximityHighlight(layer);
                        }
                    } catch (error) {
                        console.error('Error processing utility for proximity check:', error);
                    }
                }
            });
        }
        
        // Sort by distance (closest first)
        utilitiesInProximity.sort((a, b) => a.distance - b.distance);
        
        // Update UI with proximity alerts
        this.updateProximityAlerts(utilitiesInProximity);
    }

    /**
     * Calculate minimum distance from a point to a utility line
     * @param {L.LatLng} point The point to measure from
     * @param {L.Polyline} utilityLayer The utility line layer
     * @returns {number} Distance in feet
     */
    getMinDistanceToUtility(point, utilityLayer) {
        // Get the polyline points
        const linePoints = utilityLayer.getLatLngs();
        
        // For each segment of the line, find the closest distance
        let minDistance = Infinity;
        
        for (let i = 0; i < linePoints.length - 1; i++) {
            const segmentStart = linePoints[i];
            const segmentEnd = linePoints[i + 1];
            
            // Calculate distance to this segment
            const distance = this.distanceToSegment(point, segmentStart, segmentEnd);
            
            // Convert to feet (1 meter = 3.28084 feet)
            const distanceFeet = distance * 3.28084;
            
            // Update minimum if this is closer
            if (distanceFeet < minDistance) {
                minDistance = distanceFeet;
            }
        }
        
        return minDistance;
    }

    /**
     * Highlight a utility line based on proximity
     * @param {L.Polyline} utilityLayer The utility line layer
     * @param {number} distance Distance in feet
     */
    highlightUtilityByProximity(utilityLayer, distance) {
        try {
            // Get the path element
            const path = utilityLayer.getElement();
            if (!path) return;
            
            // Remove existing highlight classes
            path.classList.remove(
                'proximity-warning',
                'proximity-caution',
                'proximity-danger',
                'proximity-critical'
            );
            
            // Store original style if not already saved
            if (!utilityLayer.options._originalStyle) {
                utilityLayer.options._originalStyle = {
                    weight: utilityLayer.options.weight || 3,
                    color: utilityLayer.options.color,
                    opacity: utilityLayer.options.opacity || 0.8
                };
            }
            
            // Add appropriate highlight class based on distance
            if (distance <= 5) {
                path.classList.add('proximity-critical');
                
                // Critical distance - make this utility really stand out
                utilityLayer.setStyle({
                    weight: utilityLayer.options._originalStyle.weight * 1.5,
                    opacity: 1.0
                });
                
            } else if (distance <= 10) {
                path.classList.add('proximity-danger');
                
                // Dangerous distance - make this utility more visible
                utilityLayer.setStyle({
                    weight: utilityLayer.options._originalStyle.weight * 1.3,
                    opacity: 0.9
                });
                
            } else if (distance <= 25) {
                path.classList.add('proximity-caution');
                
                // Caution distance - slightly emphasize
                utilityLayer.setStyle({
                    weight: utilityLayer.options._originalStyle.weight * 1.1,
                    opacity: 0.8
                });
                
            } else if (distance <= 50) {
                path.classList.add('proximity-warning');
                
                // Warning distance - return to normal style
                utilityLayer.setStyle(utilityLayer.options._originalStyle);
            }
            
            // Bring this utility to the front so it's visible
            if (utilityLayer.bringToFront) {
                utilityLayer.bringToFront();
            }
        } catch (error) {
            console.error('Error highlighting utility:', error);
        }
    }

    /**
     * Remove proximity highlight from a utility
     * @param {L.Polyline} utilityLayer The utility line layer
     */
    removeProximityHighlight(utilityLayer) {
        try {
            // Get the path element
            const path = utilityLayer.getElement();
            if (!path) return;
            
            // Remove highlight classes
            path.classList.remove(
                'proximity-warning',
                'proximity-caution',
                'proximity-danger',
                'proximity-critical'
            );
            
            // Restore original style if we saved it
            if (utilityLayer.options._originalStyle) {
                utilityLayer.setStyle(utilityLayer.options._originalStyle);
            }
        } catch (error) {
            console.error('Error removing utility highlight:', error);
        }
    }

    /**
     * Update proximity alerts in the UI
     * @param {Array} utilitiesInProximity Array of utilities in proximity
     */
    updateProximityAlerts(utilitiesInProximity) {
        try {
            // Get the alerts container
            const alertsContainer = document.getElementById('proximity-alerts');
            if (!alertsContainer) return;
            
            // Clear existing alerts
            alertsContainer.innerHTML = '';
            
            // Store active alerts in app state
            this.appState.activeAlerts = [];
            
            // Create new alerts
            utilitiesInProximity.forEach((item, index) => {
                const utility = item.utility;
                const distance = item.distance;
                
                // Store in active alerts
                this.appState.activeAlerts.push({
                    utilityId: utility.id,
                    distance: distance,
                    utility: utility
                });
                
                // Skip if more than 3 alerts (to avoid cluttering the UI)
                if (index >= 3) return;
                
                // Create alert element
                const alertEl = document.createElement('div');
                alertEl.className = 'proximity-alert';
                
                // Add class based on distance
                if (distance <= 5) {
                    alertEl.classList.add('critical');
                } else if (distance <= 10) {
                    alertEl.classList.add('danger');
                } else if (distance <= 25) {
                    alertEl.classList.add('caution');
                } else {
                    alertEl.classList.add('warning');
                }
                
                // Get utility type and icon
                const utilityIcons = {
                    water: 'fa-tint',
                    gas: 'fa-fire',
                    electric: 'fa-bolt',
                    sewer: 'fa-toilet',
                    telecom: 'fa-phone'
                };
                
                const utilityNames = {
                    water: 'Water',
                    gas: 'Gas',
                    electric: 'Electric',
                    sewer: 'Sewer',
                    telecom: 'Telecom'
                };
                
                const icon = utilityIcons[utility.type] || 'fa-question-circle';
                const name = utilityNames[utility.type] || 'Unknown';
                
                // Format distance for display
                const formattedDistance = distance.toFixed(1);
                
                // Create alert content
                alertEl.innerHTML = `
                    <div class="alert-icon">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="alert-content">
                        <div class="alert-title">${name} ${utility.lineType === 'main' ? 'Main' : 'Service'}</div>
                        <div class="alert-distance">${formattedDistance} ft</div>
                        <div class="alert-details">${utility.material || ''}, ${utility.depth || 3} ft deep</div>
                    </div>
                `;
                
                // Add alert to container
                alertsContainer.appendChild(alertEl);
                
                // Pan to utility if clicked
                alertEl.addEventListener('click', () => {
                    if (item.layer) {
                        // Calculate bounds of the line
                        const bounds = L.latLngBounds(item.layer.getLatLngs());
                        
                        // Adjust bounds to include excavation site
                        if (this.excavationCircle) {
                            bounds.extend(this.excavationCircle.getLatLng());
                        }
                        
                        // Pan to fit bounds
                        this.map.fitBounds(bounds, {
                            padding: [50, 50],
                            maxZoom: 20
                        });
                        
                        // Flash the utility temporarily
                        this.flashUtility(item.layer);
                    }
                });
            });
            
            // Show or hide alerts container based on whether there are any alerts
            if (utilitiesInProximity.length > 0) {
                alertsContainer.classList.add('visible');
                
                // Show toast for the most critical alert
                if (utilitiesInProximity.length > 0 && this.uiController) {
                    const closest = utilitiesInProximity[0];
                    const distance = closest.distance;
                    
                    // Only show toast for significant alerts
                    if (distance <= 10) {
                        const utilityNames = {
                            water: 'Water',
                            gas: 'Gas',
                            electric: 'Electric',
                            sewer: 'Sewer',
                            telecom: 'Telecom'
                        };
                        
                        const name = utilityNames[closest.utility.type] || 'Unknown';
                        const message = `Warning: ${name} utility only ${distance.toFixed(1)} ft away`;
                        
                        // Use appropriate severity level
                        let toastType = 'info';
                        if (distance <= 5) {
                            toastType = 'error';
                        } else if (distance <= 10) {
                            toastType = 'warning';
                        }
                        
                        this.uiController.showToast(message, toastType);
                    }
                }
            } else {
                alertsContainer.classList.remove('visible');
            }
        } catch (error) {
            console.error('Error updating proximity alerts:', error);
        }
    }

    /**
     * Flash a utility to highlight it temporarily
     * @param {L.Polyline} utilityLayer The utility layer to flash
     */
    flashUtility(utilityLayer) {
        try {
            // Save original style
            const originalStyle = {
                color: utilityLayer.options.color,
                weight: utilityLayer.options.weight,
                opacity: utilityLayer.options.opacity
            };
            
            // Flash effect
            utilityLayer.setStyle({
                color: '#ffffff',
                weight: originalStyle.weight * 1.5,
                opacity: 1
            });
            
            // Return to original style after 1.5 seconds
            setTimeout(() => {
                utilityLayer.setStyle(originalStyle);
            }, 1500);
        } catch (error) {
            console.error('Error flashing utility:', error);
        }
    }

    /**
     * Clear all proximity alerts
     */
    clearProximityAlerts() {
        // Clear the alerts array
        this.appState.activeAlerts = [];
        
        // Clear the UI alerts
        const alertsContainer = document.getElementById('proximity-alerts');
        if (alertsContainer) {
            alertsContainer.innerHTML = '';
            alertsContainer.classList.remove('visible');
        }
    }
} 