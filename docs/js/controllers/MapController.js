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
        // Add simple speed-based outlier detection
        if (this.positions.length > 0) {
            const lastPos = this.positions[this.positions.length - 1];
            const timeDelta = (position.timestamp - lastPos.timestamp) / 1000;
            if (timeDelta > 0) {
                const distDelta = this.calculateDistance(
                    {lat: lastPos.coords.latitude, lng: lastPos.coords.longitude},
                    {lat: position.coords.latitude, lng: position.coords.longitude}
                );
                const speed = distDelta / timeDelta; // meters per second
                // Reject positions with unrealistic speed (e.g., > 30 m/s ≈ 108 km/h)
                if (speed > 30 && this.positions.length > 2) {
                    console.warn('Position rejected: unrealistic speed');
                    return this.getFilteredPosition();
                }
            }
        }
        
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
    
    // Helper method to calculate distance between two points
    calculateDistance(p1, p2) {
        if (!p1 || !p2) return 0;
        
        // Using the Haversine formula to calculate distance
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
        
        // Create base map layer - use a more reliable tile provider
        this.streetLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 22,
            crossOrigin: true
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
        
        // Get user location immediately on map initialization
        setTimeout(() => {
            this.locateUser();
        }, 1000);
        
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
                    this.streetLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                        subdomains: 'abcd',
                        maxZoom: 22,
                        crossOrigin: true
                    });
                }
                this.streetLayer.addTo(this.map);
                break;
                
            case 'satellite':
                if (!this.satelliteLayer) {
                    this.satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                        maxZoom: 22,
                        crossOrigin: true
                    });
                }
                this.satelliteLayer.addTo(this.map);
                break;
                
            case 'hybrid':
                if (!this.satelliteLayer) {
                    this.satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                        maxZoom: 22,
                        crossOrigin: true
                    });
                }
                
                if (!this.hybridLayer) {
                    this.hybridLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                        subdomains: 'abcd',
                        maxZoom: 22,
                        opacity: 0.7,
                        crossOrigin: true
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
                    
                    // Always create a persistent user location marker
                    if (!this.userLocationMarker) {
                        this.addUserLocationMarker(position.coords.latitude, position.coords.longitude);
                    } else {
                        this.userLocationMarker.setLatLng(userLocation);
                    }
                    
                    // Update the location marker
                    this.updateLocationMarker(position);

                    // Store the location
                    this.appState.userLocation = userLocation;
                    
                    // Start high accuracy location tracking
                    this.startHighAccuracyLocationTracking();
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    if (this.uiController) {
                        this.uiController.showToast('Could not get your location: ' + this.getPositionErrorMessage(error), 'error');
                    }
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            console.error('Geolocation not supported');
            if (this.uiController) {
                this.uiController.showToast('Geolocation is not supported by your browser', 'error');
            }
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
        
        // Start high accuracy location tracking
        this.startHighAccuracyLocationTracking();
        
        // Set up click handler for excavation site selection
        this.excavationClickHandler = (e) => {
            this.setExcavationSite(e.latlng);
            
            // Remove the click handler after one use
            this.map.off('click', this.excavationClickHandler);
        };
        
        this.map.on('click', this.excavationClickHandler);
        
        // Zoom in for better accuracy
        this.map.setZoom(21);
        
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
        
        // Restore map display
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
            radius: 5 // 5-meter radius excavation area
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
        
        // Track retry attempts for timeouts
        this.geoLocationRetries = this.geoLocationRetries || 0;
        
        if (navigator.geolocation) {
            // Show status
            if (this.uiController) {
                this.uiController.showStatusBar('Getting precise location...');
            }
            
            // Options optimized for mobile devices - reduce timeout on retries
            const geoOptions = {
                enableHighAccuracy: true,
                timeout: this.geoLocationRetries > 1 ? 5000 : 10000, // Reduce timeout after retries
                maximumAge: 0
            };
            
            // First get a single high-accuracy position
            navigator.geolocation.getCurrentPosition(
                // Initial position success
                (initialPosition) => {
                    // Reset retry counter on success
                    this.geoLocationRetries = 0;
                    
                    console.log('Got initial high accuracy position', initialPosition.coords);
                    
                    // Add to filter
                    this.locationFilter.addPosition(initialPosition);
                    
                    // Update marker position
                    this.updateLocationMarker(initialPosition);
                    
                    // Add user location marker if it doesn't exist
                    if (!this.userLocationMarker) {
                        this.addUserLocationMarker(initialPosition.coords.latitude, initialPosition.coords.longitude);
                        // Center map on user location
                        this.map.setView([initialPosition.coords.latitude, initialPosition.coords.longitude], 21);
                    }
                    
                    // Start watching orientation for compass heading
                    this.startWatchingOrientation();
                    
                    // Clear status after getting initial position
                    setTimeout(() => {
                        if (this.uiController) {
                            this.uiController.hideStatusBar();
                        }
                    }, 1500);
                    
                    // Start watching position with optimized parameters
                    this.appState.highAccuracyWatchId = navigator.geolocation.watchPosition(
                        // Position update handler
                        (position) => {
                            // Reset retry counter on any successful position
                            this.geoLocationRetries = 0;
                            
                            console.log('Position update', position.coords);
                            
                            // Add to filter and get smoothed position
                            const filteredPosition = this.locationFilter.addPosition(position);
                            
                            // Update marker position with filtered position if available
                            if (filteredPosition) {
                                const enhancedPosition = {
                                    coords: {
                                        latitude: filteredPosition.latitude,
                                        longitude: filteredPosition.longitude,
                                        accuracy: position.coords.accuracy,
                                        heading: position.coords.heading || null
                                    },
                                    timestamp: position.timestamp
                                };
                                
                                this.updateLocationMarker(enhancedPosition);
                            } else {
                                this.updateLocationMarker(position);
                            }
                            
                            // Update heading if available from GPS
                            if (position.coords.heading !== null && position.coords.heading !== undefined) {
                                const filteredHeading = this.locationFilter.addHeading(position.coords.heading);
                                this.updateHeading(filteredHeading);
                            }
                            
                            // Store timestamp for frequency monitoring
                            this.appState.lastLocationUpdate = new Date().getTime();
                            
                            // Update proximity calculations in excavation mode
                            if (this.appState.isExcavationMode) {
                                this.checkProximityAlerts();
                            }
                            
                            // Center map on user if following is enabled
                            if (this.appState.locationFollowing) {
                                const centerPoint = filteredPosition ? 
                                    [filteredPosition.latitude, filteredPosition.longitude] : 
                                    [position.coords.latitude, position.coords.longitude];
                                this.map.setView(centerPoint);
                            }
                        },
                        // Error handler
                        (error) => { 
                            console.error('Error watching position:', error); 
                            if (this.uiController) {
                                // If it's a timeout, offer solutions
                                if (error.code === 3) { // TIMEOUT
                                    this.uiController.showToast('Location timeout. Try enabling location permissions or moving to an area with better GPS signal.', 'warning');
                                } else {
                                    this.uiController.showToast('Location error: ' + this.getPositionErrorMessage(error), 'error');
                                }
                            }
                            
                            // Retry with lower accuracy after multiple timeouts
                            if (error.code === 3 && this.geoLocationRetries >= 2) {
                                // After multiple timeouts, retry with lower accuracy
                                setTimeout(() => {
                                    navigator.geolocation.getCurrentPosition(
                                        (pos) => this.updateLocationMarker(pos),
                                        (e) => console.error('Fallback position failed:', e),
                                        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
                                    );
                                }, 2000);
                            }
                        },
                        geoOptions
                    );
                },
                // Error handler for initial position
                (error) => { 
                    console.error('Error getting initial position:', error); 
                    
                    // Increment retry counter
                    this.geoLocationRetries++;
                    
                    if (this.uiController) {
                        // If it's a timeout, offer solutions
                        if (error.code === 3) { // TIMEOUT
                            this.uiController.showToast('Location timeout. Check your device location settings and ensure you\'ve granted permission.', 'warning');
                        } else if (error.code === 1) { // PERMISSION_DENIED
                            this.uiController.showToast('Location access denied. Please enable location services for this app.', 'error');
                        } else {
                            this.uiController.showToast('Location error: ' + this.getPositionErrorMessage(error), 'error');
                        }
                    }
                    
                    // If we have timeouts, retry with lower accuracy after a few attempts
                    if (error.code === 3 && this.geoLocationRetries >= 2) {
                        console.log('Retrying with lower accuracy after multiple timeouts');
                        setTimeout(() => {
                            navigator.geolocation.getCurrentPosition(
                                (pos) => {
                                    if (this.uiController) {
                                        this.uiController.showToast('Using approximate location (lower accuracy)', 'info');
                                    }
                                    this.updateLocationMarker(pos);
                                },
                                (e) => console.error('Fallback position failed:', e),
                                { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
                            );
                        }, 1000);
                    }
                },
                geoOptions
            );
        } else {
            console.error('Geolocation not supported');
            if (this.uiController) {
                this.uiController.showToast('Geolocation is not supported by your browser', 'error');
            }
        }
    }
    
    /**
     * Convert position error code to human-readable message
     */
    getPositionErrorMessage(error) {
        switch(error.code) {
            case 1: // PERMISSION_DENIED
                return 'Location permission denied';
            case 2: // POSITION_UNAVAILABLE
                return 'Location information unavailable';
            case 3: // TIMEOUT
                return 'Location request timed out';
            default:
                return 'Unknown location error';
        }
    }
    
    /**
     * Update user location marker's heading indicator
     * @param {number} heading The heading in degrees (0-359)
     */
    updateHeading(heading) {
        if (isNaN(heading)) return;
        
        // Store current heading
        this.currentHeading = heading;
        
        // Update marker if it exists
        if (this.userLocationMarker) {
            const markerElement = this.userLocationMarker.getElement();
            if (markerElement) {
                // Force add with-heading class to the container
                markerElement.classList.add('with-heading');
                
                // Check if heading element exists, if not create it
                let headingElement = markerElement.querySelector('.location-heading');
                if (!headingElement) {
                    console.log('Creating missing heading element');
                    headingElement = document.createElement('div');
                    headingElement.className = 'location-heading';
                    markerElement.appendChild(headingElement);
                }
                
                if (headingElement) {
                    // Make sure we add with-heading class to parent to ensure visibility
                    markerElement.classList.add('with-heading');
                    
                    // Apply the heading rotation
                    headingElement.style.transform = `translateX(-50%) rotate(${heading}deg)`;
                    headingElement.style.opacity = '1';
                    
                    // Add a strong blue color for better visibility
                    headingElement.style.borderBottomColor = '#2196F3';
                    
                    // Add transition for smoother rotation
                    headingElement.style.transition = 'transform 0.3s ease-out';
                    
                    // Force visibility and style
                    headingElement.style.display = 'block';
                    headingElement.style.visibility = 'visible';
                    headingElement.style.position = 'absolute';
                    headingElement.style.top = '-20px';
                    headingElement.style.left = '50%';
                    headingElement.style.width = '0';
                    headingElement.style.height = '0';
                    headingElement.style.borderLeft = '12px solid transparent';
                    headingElement.style.borderRight = '12px solid transparent';
                    headingElement.style.borderBottom = '24px solid #2196F3';
                    headingElement.style.transformOrigin = 'bottom center';
                    headingElement.style.zIndex = '1001';
                    
                    // For debugging
                    console.log(`Updated heading to ${heading} degrees`);
                } else {
                    console.warn('Heading element not found in marker');
                }
            } else {
                console.warn('Marker element not found');
            }
        } else {
            console.warn('User location marker not found');
        }
    }

    /**
     * Start watching device orientation for compass heading
     * Uses modern methods to avoid deprecation warnings
     */
    startWatchingOrientation() {
        // Check if device orientation is supported
        if (!window.DeviceOrientationEvent) {
            console.log('Device orientation not supported on this device');
            return;
        }
        
        // Function to setup the orientation tracking
        const setupOrientation = () => {
            console.log('Setting up device orientation tracking');
            
            // Create orientation handler with improved platform detection
            this.handleDeviceOrientation = (event) => {
                // iOS and Android have different implementations
                let heading = null;
                
                // iOS devices use webkitCompassHeading
                if (event.webkitCompassHeading !== undefined) {
                    heading = event.webkitCompassHeading;
                    console.log('iOS heading detected:', heading);
                } 
                // Android devices typically use alpha with compensation
                else if (event.alpha !== null) {
                    // Alpha is the compass direction in degrees (0-360)
                    heading = 360 - event.alpha;
                    console.log('Android heading detected:', heading, 'from alpha:', event.alpha);
                    
                    // Apply device orientation compensation if gamma/beta available
                    if (event.gamma !== null && event.beta !== null) {
                        // Adjust heading based on device orientation
                        const gamma = event.gamma; // Left-right tilt
                        const beta = event.beta;   // Front-back tilt
                        
                        console.log('Device orientation - beta:', beta, 'gamma:', gamma);
                        
                        // Only apply compensation when device is significantly tilted
                        if (Math.abs(gamma) > 25 || Math.abs(beta) > 25) {
                            // Complex compensation algorithm here
                            // This is a simplified version
                            if (Math.abs(gamma) > 25) {
                                heading += (gamma > 0 ? -15 : 15);
                                console.log('Heading adjusted for tilt to:', heading);
                            }
                        }
                    }
                }
                
                // If we got a valid heading, filter and update
                if (heading !== null && !isNaN(heading)) {
                    // Normalize to 0-360 range
                    heading = (heading + 360) % 360;
                    
                    // Use our filter to smooth the heading
                    const filteredHeading = this.locationFilter.addHeading(heading);
                    
                    // For debugging
                    if (Math.abs(filteredHeading - (this.currentHeading || 0)) > 5) {
                        console.log('Significant heading change:', this.currentHeading, '->', filteredHeading);
                    }
                    
                    // Update the heading indicator
                    this.updateHeading(filteredHeading);
                }
            };
            
            // Try both absolute and regular orientation events
            if ('ondeviceorientationabsolute' in window) {
                console.log('Using deviceorientationabsolute event');
                window.addEventListener('deviceorientationabsolute', this.handleDeviceOrientation, {passive: true});
            } else {
                console.log('Using deviceorientation event');
                window.addEventListener('deviceorientation', this.handleDeviceOrientation, {passive: true});
            }
            
            // Set a test heading after a short delay to verify the system works
            setTimeout(() => {
                // Force a known test heading to verify visually
                this.updateHeading(45);
                console.log('Applied test heading: 45 degrees');
                
                // Return to normal heading updates after 3 seconds
                setTimeout(() => {
                    if (this.locationFilter.headings.length === 0) {
                        console.log('No real heading data received yet, forcing compass mode');
                        // If we haven't gotten real data, try enabling compass mode through location
                        this.startHighAccuracyLocationTracking();
                    }
                }, 3000);
            }, 2000);
        };
        
        // Request permission if needed (iOS 13+)
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            console.log('Requesting orientation permission on iOS');
            DeviceOrientationEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        console.log('iOS orientation permission granted');
                        setupOrientation();
                    } else {
                        console.log('Device orientation permission denied');
                        if (this.uiController) {
                            this.uiController.showToast('Compass heading not available - permissions denied', 'warning');
                        }
                    }
                })
                .catch(err => {
                    console.error('Error requesting orientation permission:', err);
                    
                    // Try to set up anyway - might work on some devices
                    console.log('Trying orientation without explicit permission');
                    setupOrientation();
                });
        } else {
            // No permission needed, just set up
            console.log('No orientation permission needed on this device');
            setupOrientation();
        }
    }

    /**
     * Stop watching device orientation
     */
    stopWatchingOrientation() {
        if (this.handleDeviceOrientation) {
            window.removeEventListener('deviceorientation', this.handleDeviceOrientation);
            this.handleDeviceOrientation = null;
        }
    }

    /**
     * Check for utilities near the excavation site
     */
    checkProximityAlerts() {
        if (!this.appState.isExcavationMode) return;
        
        // Use either the excavation site or user location
        const centerPoint = this.excavationCircle ? 
            this.excavationCircle.getLatLng() : 
            (this.userLocationMarker ? this.userLocationMarker.getLatLng() : null);
            
        if (!centerPoint) return;
            
        const utilitiesInProximity = [];
        
        // Check all utility types
        for (const type in this.utilityLayers) {
            this.utilityLayers[type].eachLayer(layer => {
                if (layer.utilityId || layer.utilityData) {
                    // Calculate distance from excavation to utility
                    const distance = this.getMinDistanceToUtility(centerPoint, layer);
                    
                    // If within threshold distance (50 feet)
                    if (distance < 50) {
                        // Find the utility data
                        const utility = layer.utilityData || this.dataStore.getUtilityById(layer.utilityId);
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
        // Get the SVG path element
        const path = utilityLayer.getElement();
        if (!path) return;
        
        // Remove existing highlight classes
        path.classList.remove(
            'proximity-warning',
            'proximity-caution',
            'proximity-danger',
            'proximity-critical'
        );
        
        // Add appropriate highlight class based on distance
        if (distance <= 5) {
            path.classList.add('proximity-critical');
            
            // Also add pulsing effect for critical distance
            path.style.animation = 'pulse-critical 1s infinite';
            
            // Play alert sound if enabled
            this.playProximityAlertSound('critical');
        } else if (distance <= 10) {
            path.classList.add('proximity-danger');
            path.style.animation = 'pulse-danger 1.5s infinite';
        } else if (distance <= 25) {
            path.classList.add('proximity-caution');
            path.style.animation = '';
        } else if (distance <= 50) {
            path.classList.add('proximity-warning');
            path.style.animation = '';
        }
    }

    /**
     * Play a proximity alert sound if enabled
     * @param {string} level Alert level: 'warning', 'caution', 'danger', 'critical'
     */
    playProximityAlertSound(level) {
        // Only play sounds occasionally to avoid constant noise
        if (this.lastAlertSound && Date.now() - this.lastAlertSound < 3000) {
            return;
        }
        
        this.lastAlertSound = Date.now();
        
        // Check if sound is enabled in settings
        if (this.appState.soundEnabled === false) {
            return;
        }
        
        // Create a simple beep sound
        let frequency = 440; // Default A4 note
        let duration = 200;  // ms
        
        switch (level) {
            case 'critical':
                frequency = 880;  // Higher pitch for critical
                duration = 300;
                break;
            case 'danger':
                frequency = 660;
                duration = 200;
                break;
            case 'caution':
                frequency = 440;
                duration = 150;
                break;
            case 'warning':
                frequency = 330;
                duration = 100;
                break;
        }
        
        try {
            // Create audio context if not already created
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Create oscillator
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;
            gainNode.gain.value = 0.2;
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.start();
            
            // Stop after duration
            setTimeout(() => {
                oscillator.stop();
            }, duration);
        } catch (e) {
            console.error('Error playing alert sound:', e);
        }
    }

    /**
     * Remove proximity highlight from a utility
     * @param {L.Polyline} utilityLayer The utility line layer
     */
    removeProximityHighlight(utilityLayer) {
        const path = utilityLayer.getElement();
        if (!path) return;
        
        path.classList.remove(
            'proximity-warning',
            'proximity-caution',
            'proximity-danger',
            'proximity-critical'
        );
        
        // Remove animation
        path.style.animation = '';
    }

    /**
     * Update proximity alerts in the UI
     * @param {Array} utilitiesInProximity Array of utilities in proximity
     */
    updateProximityAlerts(utilitiesInProximity) {
        // Get the most critical utilities (first 3)
        const criticalUtilities = utilitiesInProximity.slice(0, 3);
        
        // Get existing alerts
        const existingAlerts = this.appState.activeAlerts || [];
        
        // Update or create alerts for critical utilities
        criticalUtilities.forEach(item => {
            const utility = item.utility;
            const distance = item.distance;
            
            // Check if this utility already has an alert
            const existingAlert = existingAlerts.find(alert => alert.utilityId === utility.id);
            
            if (!existingAlert) {
                // Create a new alert
                const alert = {
                    utilityId: utility.id,
                    utility: utility,
                    distance: distance,
                    timestamp: new Date().getTime()
                };
                
                // Add to active alerts
                if (!this.appState.activeAlerts) {
                    this.appState.activeAlerts = [];
                }
                
                this.appState.activeAlerts.push(alert);
                
                // Create UI alert
                if (this.uiController) {
                    this.uiController.createProximityAlert(alert);
                    
                    // Also show toast for very close utilities
                    if (distance <= 5) {
                        this.uiController.showToast(`WARNING: ${utility.type} utility VERY CLOSE!`, 'error');
                    } else if (distance <= 10 && !this.hasShownWarningToast) {
                        this.uiController.showToast(`Caution: ${utility.type} utility nearby`, 'warning');
                        this.hasShownWarningToast = true;
                        
                        // Reset the warning toast flag after a delay
                        setTimeout(() => {
                            this.hasShownWarningToast = false;
                        }, 10000);
                    }
                }
            } else {
                // Update existing alert
                existingAlert.distance = distance;
                
                // Update UI
                if (this.uiController) {
                    this.uiController.updateProximityAlert(existingAlert);
                }
            }
        });
        
        // Remove alerts for utilities no longer in critical proximity
        if (this.appState.activeAlerts) {
            const alertsToRemove = [];
            
            this.appState.activeAlerts.forEach(alert => {
                const stillCritical = criticalUtilities.some(item => item.utility.id === alert.utilityId);
                
                if (!stillCritical) {
                    alertsToRemove.push(alert);
                }
            });
            
            // Remove from active alerts
            alertsToRemove.forEach(alert => {
                const index = this.appState.activeAlerts.findIndex(a => a.utilityId === alert.utilityId);
                
                if (index >= 0) {
                    this.appState.activeAlerts.splice(index, 1);
                    
                    // Remove from UI
                    if (this.uiController) {
                        this.uiController.removeProximityAlert(alert);
                    }
                }
            });
        }
    }

    /**
     * Clear all proximity alerts
     */
    clearProximityAlerts() {
        // Clear the alerts array
        this.appState.activeAlerts = [];
        
        // Clear the UI alerts
        document.getElementById('proximity-alerts').innerHTML = '';
    }

    /**
     * Reset all proximity highlights
     */
    resetProximityHighlights() {
        // For each utility layer
        for (const type in this.utilityLayers) {
            this.utilityLayers[type].eachLayer(layer => {
                if (layer.utilityId) {
                    this.removeProximityHighlight(layer);
                }
            });
        }
    }

    /**
     * Calculate the distance from a point to a line segment
     * @param {L.LatLng} point The point to measure from
     * @param {L.LatLng} segmentStart Start point of the segment
     * @param {L.LatLng} segmentEnd End point of the segment
     * @returns {number} Distance in meters
     */
    distanceToSegment(point, segmentStart, segmentEnd) {
        // If segment start and end are the same point, just return distance to that point
        if (segmentStart.lat === segmentEnd.lat && segmentStart.lng === segmentEnd.lng) {
            return this.map.distance(point, segmentStart);
        }
        
        // Convert LatLng points to Cartesian coordinates using map projection
        const p = this.map.project(point);
        const v = this.map.project(segmentStart);
        const w = this.map.project(segmentEnd);
        
        // Vector from segment start to end
        const segmentVector = {
            x: w.x - v.x,
            y: w.y - v.y
        };
        
        // Length squared of the segment
        const lengthSquared = segmentVector.x * segmentVector.x + segmentVector.y * segmentVector.y;
        
        // If segment is effectively a point, just return distance to that point
        if (lengthSquared === 0) {
            return this.map.distance(point, segmentStart);
        }
        
        // Vector from segment start to point
        const pointVector = {
            x: p.x - v.x,
            y: p.y - v.y
        };
        
        // Projection of pointVector onto segmentVector, normalized by segment length
        const t = (pointVector.x * segmentVector.x + pointVector.y * segmentVector.y) / lengthSquared;
        
        if (t < 0) {
            // Point projects before segment start, closest point is segment start
            return this.map.distance(point, segmentStart);
        } else if (t > 1) {
            // Point projects after segment end, closest point is segment end
            return this.map.distance(point, segmentEnd);
        } else {
            // Point projects onto segment, find the closest point on segment
            const closest = {
                x: v.x + t * segmentVector.x,
                y: v.y + t * segmentVector.y
            };
            
            // Convert back to LatLng and return distance
            const closestLatLng = this.map.unproject(closest);
            return this.map.distance(point, closestLatLng);
        }
    }

    /**
     * Add a user location marker to the map
     * @param {number} lat Latitude
     * @param {number} lng Longitude
     */
    addUserLocationMarker(lat, lng) {
        // Remove existing marker if any
        if (this.userLocationMarker) {
            this.map.removeLayer(this.userLocationMarker);
        }

        // Create a professional map pin SVG with a direction indicator - match original exactly
        const svgIcon = `
            <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" class="location-marker-svg">
                <defs>
                    <radialGradient id="accuracy-gradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                        <stop offset="0%" style="stop-color:#2196F3;stop-opacity:0.6" />
                        <stop offset="100%" style="stop-color:#2196F3;stop-opacity:0" />
                    </radialGradient>
                </defs>
                <path d="M12,2C8.13,2 5,5.13 5,9c0,5.25 7,13 7,13s7,-7.75 7,-13c0,-3.87 -3.13,-7 -7,-7zM12,11.5c-1.38,0 -2.5,-1.12 -2.5,-2.5s1.12,-2.5 2.5,-2.5 2.5,1.12 2.5,2.5 -1.12,2.5 -2.5,2.5z" 
                    fill="#2196F3" stroke="white" stroke-width="1" />
                <circle cx="12" cy="9" r="2.5" fill="white" />
            </svg>
        `;
        
        // Create the icon with accuracy circle and pulses - exactly match original
        const userLocationIcon = L.divIcon({
            className: 'user-location-marker with-heading',
            html: `
                <div class="location-accuracy-circle"></div>
                <div class="location-pulse"></div>
                <div class="location-pulse-inner"></div>
                <div class="location-marker-container">
                    ${svgIcon}
                    <div class="location-center"></div>
                    <div class="location-heading"></div>
                </div>
            `,
            iconSize: [48, 48],
            iconAnchor: [24, 24]
        });
        
        // Add marker to map
        const marker = L.marker([lat, lng], {
            icon: userLocationIcon,
            zIndexOffset: 1000
        }).addTo(this.map);
        
        // Add click handler to center map on user location
        marker.on('click', () => {
            this.map.setView([lat, lng], this.map.getZoom());
            if (this.uiController) {
                this.uiController.showToast('Centered on your location', 'info');
            }
        });
        
        // Store reference to marker
        this.userLocationMarker = marker;
        
        // Start watching orientation if supported
        this.startWatchingOrientation();
        
        return marker;
    }
    
    /**
     * Start watching device position
     * This method is implemented as a compatibility function and relies on startHighAccuracyLocationTracking
     */
    startWatchingPosition() {
        // If we already have a high accuracy watch, we don't need to do anything
        if (this.appState.highAccuracyWatchId) {
            console.log('High accuracy position watching already active');
            return;
        }
        
        // Otherwise, start basic position watching
        if (navigator.geolocation) {
            this.watchPositionId = navigator.geolocation.watchPosition(
                (position) => {
                    // Update marker position
                    const latlng = [position.coords.latitude, position.coords.longitude];
                    if (this.userLocationMarker) {
                        this.userLocationMarker.setLatLng(latlng);
                    }
                    
                    // Update accuracy circle
                    this.updateLocationAccuracy(
                        position.coords.latitude, 
                        position.coords.longitude, 
                        position.coords.accuracy
                    );
                },
                (error) => {
                    console.error('Error watching position:', error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        }
    }

    /**
     * Update the location accuracy circle
     * @param {number} lat Latitude
     * @param {number} lng Longitude
     * @param {number} accuracy Accuracy in meters
     */
    updateLocationAccuracy(lat, lng, accuracy) {
        // Update CSS based accuracy ring when available
        if (this.userLocationMarker) {
            const markerEl = this.userLocationMarker.getElement();
            const accuracyEl = markerEl?.querySelector('.location-accuracy-circle');
            if (accuracyEl && accuracy) {
                // scale between 0.8 – 2.0 of marker size based on accuracy meters
                const scale = Math.min(2.0, Math.max(0.8, accuracy / 20));
                accuracyEl.style.transform = `scale(${scale})`;
                
                // tint based on accuracy like original logic
                if (accuracy < 5) {
                    accuracyEl.style.backgroundColor = 'rgba(76, 175, 80, 0.15)'; // Green
                } else if (accuracy < 10) {
                    accuracyEl.style.backgroundColor = 'rgba(33, 150, 243, 0.15)'; // Blue
                } else if (accuracy < 20) {
                    accuracyEl.style.backgroundColor = 'rgba(255, 152, 0, 0.15)'; // Orange
                } else {
                    accuracyEl.style.backgroundColor = 'rgba(244, 67, 54, 0.15)'; // Red
                }
            }
        }

        // Leaflet accuracy circle (for larger radii)
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
            this.accuracyCircle = null;
        }
        
        // Only show separate circle for larger accuracies
        if (accuracy && accuracy > 10 && accuracy < 100) {
            this.accuracyCircle = L.circle([lat, lng], {
                radius: accuracy,
                color: 'var(--primary)',
                fillColor: 'var(--primary)',
                fillOpacity: 0.15,
                weight: 1,
                interactive: false
            }).addTo(this.map);
        }
    }

    /**
     * Stop high accuracy location tracking
     */
    stopHighAccuracyLocationTracking() {
        if (this.appState.highAccuracyWatchId !== null) {
            navigator.geolocation.clearWatch(this.appState.highAccuracyWatchId);
            this.appState.highAccuracyWatchId = null;
        }
        
        // Also stop orientation watching
        this.stopWatchingOrientation();
    }

    /**
     * Update the location marker with new position data
     * @param {Object} position Geolocation position object
     */
    updateLocationMarker(position) {
        if (!position || !position.coords) return;
        
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        
        // Update app state with current location
        this.appState.userLocation = {
            lat: lat,
            lng: lng,
            accuracy: accuracy,
            timestamp: position.timestamp || new Date().getTime()
        };
        
        // Create marker if it doesn't exist
        if (!this.userLocationMarker) {
            this.addUserLocationMarker(lat, lng);
        } else {
            // Update existing marker position with animation
            this.userLocationMarker.setLatLng([lat, lng]);
        }
        
        // Update accuracy circle
        this.updateLocationAccuracy(lat, lng, accuracy);
        
        // Update heading if available
        if (position.coords.heading !== null && 
            position.coords.heading !== undefined && 
            !isNaN(position.coords.heading)) {
            const filteredHeading = this.locationFilter.addHeading(position.coords.heading);
            this.updateHeading(filteredHeading);
        }
        
        // Only check for nearby utilities in excavation mode
        if (this.appState.isExcavationMode) {
            this.checkProximityAlerts();
        }
    }

    // Find nearby mains of the same type - critical for connecting service lines to mains
    findNearbyMains(latlng, utilityType, maxDistance = 20) {
        let nearestMain = null;
        let minDistance = maxDistance;
        
        // Check utilities of the same type
        this.dataStore.utilities[utilityType].forEach(utility => {
            if (!utility.line || utility.lineType !== 'main') return;
            
            // Calculate distance to line
            const distance = this.distanceToPolyline(latlng, utility.line.getLatLngs());
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestMain = utility;
                
                // Also find the closest point on the main line for connection
                nearestMain.connectionPoint = this.findClosestPointOnLine(latlng, utility.line.getLatLngs());
            }
        });
        
        return nearestMain;
    }

    // Find exact connection point on a line
    findClosestPointOnLine(point, polyline) {
        let minDistance = Infinity;
        let closestPoint = null;
        let segmentIndex = -1;
        
        for (let i = 0; i < polyline.length - 1; i++) {
            const p1 = polyline[i];
            const p2 = polyline[i + 1];
            
            // Calculate closest point using vector projection
            const distance = this.distanceToSegment(point, p1, p2);
            
            if (distance < minDistance) {
                minDistance = distance;
                
                // Calculate the actual point on the line
                closestPoint = this.projectPointOnSegment(point, p1, p2);
                segmentIndex = i;
            }
        }
        
        return {
            point: closestPoint,
            distance: minDistance,
            segmentIndex: segmentIndex
        };
    }

    // Project a point onto a line segment
    projectPointOnSegment(point, segmentStart, segmentEnd) {
        const p = L.latLng(point);
        const p1 = L.latLng(segmentStart);
        const p2 = L.latLng(segmentEnd);
        
        // Calculate the closest point on the segment
        const x = p.lng;
        const y = p.lat;
        const x1 = p1.lng;
        const y1 = p1.lat;
        const x2 = p2.lng;
        const y2 = p2.lat;
        
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        return L.latLng(yy, xx);
    }

    // Add connector marker at a connection point
    addConnectorMarker(latlng, utilityType) {
        const markerHtml = `<svg width="12" height="12" viewBox="0 0 12 12">
            <circle cx="6" cy="6" r="5" class="connector-point ${utilityType}" />
        </svg>`;
        
        const icon = L.divIcon({
            html: markerHtml,
            className: '',
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });
        
        return L.marker(latlng, {
            icon: icon,
            interactive: false
        }).addTo(this.map);
    }

    // Show temporary drawing line during mapping - critical for the drawing feature
    showTempLine(points) {
        // Remove existing temp line if any
        if (this.appState.tempLine) {
            this.map.removeLayer(this.appState.tempLine);
            this.appState.tempLine = null;
        }
        
        if (!points || points.length < 2) return;
        
        // Get color based on selected utility type
        const colors = {
            water: '#29b6f6',
            gas: '#ffb300',
            electric: '#ffee58',
            sewer: '#8d6e63',
            telecom: '#ab47bc'
        };
        
        // Get utility type name for display
        const utilityNames = {
            water: 'Water',
            gas: 'Gas',
            electric: 'Electric',
            sewer: 'Sewer',
            telecom: 'Telecom'
        };
        
        // Create line options based on line type with enhanced visibility
        const lineOptions = {
            color: colors[this.appState.activeUtilityType],
            weight: this.appState.activeLineType === 'main' ? 8 : 6, // Increased from 6/4 to 8/6
            opacity: 0.9, // Increased from 0.7 to 0.9
            lineJoin: 'round',
            className: `utility-line-drawing ${this.appState.activeUtilityType}`
        };
        
        // Add dash style for service lines
        if (this.appState.activeLineType === 'service') {
            lineOptions.dashArray = '8, 8';
            lineOptions.lineCap = 'butt';
        } else {
            lineOptions.lineCap = 'round';
        }
        
        // Create temporary polyline
        this.appState.tempLine = L.polyline(points, lineOptions).addTo(this.map);
        
        // Show current line type in the status bar with color highlight
        const lineTypeText = this.appState.activeLineType === 'main' ? 'Main Line' : 'Service Line';
        this.uiController.showStatusBar(`Drawing <span style="color:${colors[this.appState.activeUtilityType]}; font-weight:bold">${utilityNames[this.appState.activeUtilityType]} ${lineTypeText}</span>. Click to add more points or use Finish Drawing button.`);
        
        // If this is a service line, check for nearby mains to connect to
        if (this.appState.activeLineType === 'service' && points.length >= 2) {
            const lastPoint = points[points.length - 1];
            const nearbyMain = this.findNearbyMains(lastPoint, this.appState.activeUtilityType, 30);
            
            // If a main line is found nearby
            if (nearbyMain && nearbyMain.connectionPoint) {
                // Store the potential connection
                this.appState.potentialConnection = {
                    mainLine: nearbyMain,
                    connectionPoint: nearbyMain.connectionPoint.point
                };
                
                // Show connection indicator
                this.uiController.showConnectionIndicator(nearbyMain.connectionPoint.point, this.appState.activeUtilityType);
                
                // Add visual indicator at connection point
                if (this.appState.connectionPointMarker) {
                    this.map.removeLayer(this.appState.connectionPointMarker);
                }
                
                // Create pulsing marker for connection point
                const pulseIcon = L.divIcon({
                    html: `<div class="connection-point-indicator" style="width:10px;height:10px;background-color:${colors[this.appState.activeUtilityType]};border-radius:50%;"></div>`,
                    className: '',
                    iconSize: [10, 10],
                    iconAnchor: [5, 5]
                });
                
                this.appState.connectionPointMarker = L.marker(nearbyMain.connectionPoint.point, {
                    icon: pulseIcon,
                    interactive: false
                }).addTo(this.map);
            } else {
                // No nearby main, clear potential connection
                this.appState.potentialConnection = null;
                this.uiController.hideConnectionIndicator();
                
                // Remove connection point marker if it exists
                if (this.appState.connectionPointMarker) {
                    this.map.removeLayer(this.appState.connectionPointMarker);
                    this.appState.connectionPointMarker = null;
                }
            }
        }
    }

    // Add a utility line to the map (used when adding a brand-new utility)
    addUtilityLine(utility) {
        if (!utility) return null;
        // Allow either .coordinates (preferred) or legacy .points array
        if (!utility.coordinates && utility.points) {
            utility.coordinates = utility.points;
        }
        if (!utility.coordinates || utility.coordinates.length < 2) {
            console.error('addUtilityLine: invalid utility object', utility);
            return null;
        }
        // Render on map using existing renderer for consistency
        const lineLayer = this.renderUtility(utility);
        // Add a marker at the first vertex so the line is easy to select later
        if (utility.coordinates && utility.coordinates.length > 0) {
            const firstPoint = utility.coordinates[0];
            const marker = this.addUtilityMarker(firstPoint, utility.type, utility.id, utility.lineType);
            utility.marker = marker;
        }
        // Persist reference
        utility.line = lineLayer;
        return lineLayer;
    }

    // Find the nearest utility to a point on the map (any type)
    findNearestUtility(latlng, maxDistance = 50) {
        let nearestUtility = null;
        let minDistance = maxDistance;
        
        // Check all utility types
        for (const type in this.utilityLayers) {
            this.utilityLayers[type].eachLayer(layer => {
                if (layer.utilityId || layer.utilityData) {
                    // Calculate distance from point to utility
                    const distance = this.distanceToPolyline(latlng, layer.getLatLngs());
                    
                    // If this is closer than current minimum
                    if (distance < minDistance) {
                        minDistance = distance;
                        
                        // Get the utility data
                        nearestUtility = {
                            utility: layer.utilityData || this.dataStore.getUtilityById(layer.utilityId),
                            distance: distance,
                            layer: layer
                        };
                    }
                }
            });
        }
        
        return nearestUtility;
    }

    // Add a utility marker at a given location (used by addUtilityLine & others)
    addUtilityMarker(latlng, utilityType, utilityId, lineType = 'service') {
        if (!latlng) return null;
        const icons = {
            water: 'tint',
            gas: 'fire',
            electric: 'bolt',
            sewer: 'toilet',
            telecom: 'phone'
        };
        const markerHtml = `\n            <div class="utility-marker ${utilityType} ${lineType}">\n                <i class="fas fa-${icons[utilityType] || 'question'}"></i>\n            </div>\n        `;
        const icon = L.divIcon({
            html: markerHtml,
            className: '',
            iconSize: [36, 36],
            iconAnchor: [18, 36]
        });
        const marker = L.marker(latlng, { icon, draggable: false });
        marker.utilityId = utilityId;
        if (this.utilityLayers[utilityType]) {
            marker.addTo(this.utilityLayers[utilityType]);
        } else {
            marker.addTo(this.map);
        }
        return marker;
    }

    // Calculate distance from a point to an entire polyline (in meters)
    distanceToPolyline(point, polyline) {
        if (!polyline || polyline.length < 2) return Infinity;
        let min = Infinity;
        for (let i = 0; i < polyline.length - 1; i++) {
            const d = this.distanceToSegment(point, polyline[i], polyline[i + 1]);
            if (d < min) min = d;
        }
        return min;
    }

    /**
     * Start measurement mode
     */
    startMeasurement() {
        // Clear any existing measurements
        this.clearMeasurements();
        
        // Enable measurement mode
        this.appState.isMeasuring = true;
        this.appState.measurementPoints = [];
        
        // Show measurement UI
        this.uiController.showToast('Click on the map to place measurement points', 'info');
        this.uiController.showMeasurementToolbar();
        
        // Add measurement layer to map if not already added
        if (!this.map.hasLayer(this.measurementLayer)) {
            this.measurementLayer.addTo(this.map);
        }
    }

    /**
     * Add a measurement line between two points
     * @param {Array} points Array containing two LatLng points
     */
    addMeasurementLine(points) {
        if (!points || points.length < 2) return;
        
        // Create polyline
        const line = L.polyline(points, {
            color: '#ff4081',
            weight: 3,
            opacity: 0.8,
            dashArray: '5, 5',
            className: 'measure-line'
        }).addTo(this.measurementLayer);
        
        // Calculate distance
        const distance = this.calculateDistance(points[0], points[1]);
        
        // Format distance for display
        const formattedDistance = this.formatDistance(distance);
        
        // Add distance label
        const midpoint = this.getMidpoint(points[0], points[1]);
        
        const labelHtml = `
            <div class="measurement-distance">${formattedDistance}</div>
        `;
        
        const icon = L.divIcon({
            html: labelHtml,
            className: 'measurement-label',
            iconSize: [80, 24],
            iconAnchor: [40, 12]
        });
        
        // Create marker for the label
        const marker = L.marker(midpoint, {
            icon: icon,
            draggable: false
        }).addTo(this.measurementLayer);
        
        // Store reference to the measurement in the data store if it exists
        if (this.dataStore && this.dataStore.measurements) {
            const measurement = {
                id: `measurement-${Date.now()}`,
                points: points,
                distance: distance,
                line: line,
                label: marker
            };
            
            this.dataStore.measurements.push(measurement);
            this.dataStore.saveData();
        }
        
        return line;
    }
} 