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
            water: new L.LayerGroup(),
            gas: new L.LayerGroup(),
            electric: new L.LayerGroup(),
            sewer: new L.LayerGroup(),
            telecom: new L.LayerGroup()
        };
        this.structureLayers = {
            water: new L.LayerGroup(),
            gas: new L.LayerGroup(),
            electric: new L.LayerGroup(),
            sewer: new L.LayerGroup(),
            telecom: new L.LayerGroup()
        };
        this.basemaps = {};
        this.currentMarker = null;
        this.currentLine = null;
        this.drawingMode = false;
        this.measurementLayer = new L.LayerGroup();
        this.annotationLayer = new L.LayerGroup();
        this.excavationCircle = null;
        this.proximityThreshold = 10; // meters
        this.userLocationMarker = null;
        this.watchPositionId = null;
        this.currentHeading = 0;
        this.connectionPointMarker = null;
        
        // Position filtering system
        this.locationFilter = {
            positions: [],
            maxPositions: 8,  // Increased from 5 for better averaging
            accuracyThreshold: 15, // Tightened from 20 meters for better quality
            headings: [],
            maxHeadings: 10,   // Increased from 8 for smoother heading
            
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
            },
            
            getFilteredPosition() {
                if (this.positions.length === 0) return null;
                
                // Enhanced weighting algorithm optimized for iPhone
                // Positions with better accuracy and more recent get higher weights
                let totalWeight = 0;
                let weightedLat = 0;
                let weightedLng = 0;
                
                this.positions.forEach((pos, index) => {
                    // Recency weight: more recent = higher weight (0.5 to 1.5 scale)
                    const recencyWeight = 0.5 + (index / this.positions.length);
                    
                    // Accuracy weight: better accuracy = higher weight (inverse relation to accuracy value)
                    // Use exponential scaling to highly favor more accurate readings
                    const accuracyFactor = Math.max(1, 25 - pos.coords.accuracy) / 25;
                    const accuracyWeight = Math.pow(accuracyFactor, 2); // Square for stronger preference
                    
                    // iPhone movement detection - reduce weight for unstable readings
                    let movementWeight = 1.0;
                    if (index > 0 && pos.coords.speed !== null && pos.coords.speed > 0.5) {
                        // If moving, slightly reduce weight
                        movementWeight = 0.9;
                    }
                    
                    // Combine weights
                    const weight = recencyWeight * accuracyWeight * movementWeight;
                    
                    weightedLat += pos.coords.latitude * weight;
                    weightedLng += pos.coords.longitude * weight;
                    totalWeight += weight;
                });
                
                // Return weighted average position
                return {
                    latitude: weightedLat / totalWeight,
                    longitude: weightedLng / totalWeight,
                    accuracy: this._calculateFilteredAccuracy()
                };
            },
            
            _calculateFilteredAccuracy() {
                // Calculate the average accuracy of recent readings, focusing on better readings
                if (this.positions.length === 0) return 15; // Default value
                
                const accuracies = this.positions.map(p => p.coords.accuracy);
                
                // Find the best 50% of readings
                const sortedAccuracies = [...accuracies].sort((a, b) => a - b);
                const bestHalf = sortedAccuracies.slice(0, Math.ceil(sortedAccuracies.length / 2));
                
                // Average of best readings
                const avgAccuracy = bestHalf.reduce((sum, val) => sum + val, 0) / bestHalf.length;
                return avgAccuracy;
            },
            
            addHeading(heading) {
                if (isNaN(heading)) return this.getFilteredHeading();
                
                this.headings.push(heading);
                
                if (this.headings.length > this.maxHeadings) {
                    this.headings.shift();
                }
                
                return this.getFilteredHeading();
            },
            
            getFilteredHeading() {
                if (this.headings.length === 0) return 0;
                
                // Enhanced heading algorithm optimized for iPhone
                // Special handling for heading values that wrap around 0/360
                
                // Check if we have enough samples
                if (this.headings.length < 2) return this.headings[0];
                
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
            },
            
            reset() {
                this.positions = [];
                this.headings = [];
            }
        };
    }

    /**
     * Initialize the map and add base layers
     */
    initMap() {
        // Create the Leaflet map
        this.map = L.map('map', {
            center: [39.7684, -86.1581], // Default to Indianapolis
            zoom: 18,
            zoomControl: false, // We'll add custom zoom controls
            attributionControl: true
        });

        // Add base layers
        this.basemaps = {
            streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors',
                maxZoom: 22
            }),
            satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                maxZoom: 22
            }),
            hybrid: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                maxZoom: 22
            })
        };

        // Add the default basemap
        this.basemaps.streets.addTo(this.map);

        // Add utility layers to the map
        Object.values(this.utilityLayers).forEach(layer => layer.addTo(this.map));
        Object.values(this.structureLayers).forEach(layer => layer.addTo(this.map));

        // Add measurement layer
        this.measurementLayer.addTo(this.map);
        
        // Add annotation layer
        this.annotationLayer.addTo(this.map);

        // Set up custom map controls
        this.setupMapControls();

        // Load utility data if available
        this.loadUtilities();

        // Set up map event listeners
        this.setupMapEvents();
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
            
            // Add event listeners to the radio buttons
            document.querySelectorAll('input[name="map-view"]').forEach(input => {
                input.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        this.setMapView(e.target.value);
                    }
                });
            });
        }
    }
    
    /**
     * Change the map base layer/view
     * @param {string} view - The view to set (streets, satellite, hybrid)
     */
    setMapView(view) {
        // Remove all current base layers
        Object.values(this.basemaps).forEach(layer => {
            if (this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        });
        
        // Add the selected base layer
        if (this.basemaps[view]) {
            this.basemaps[view].addTo(this.map);
            
            // Store the current view in app state
            this.appState.currentMapView = view;
            
            // Show notification
            if (this.uiController) {
                this.uiController.showToast(`Map view changed to ${view}`, 'info');
            }
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
            } else if (this.appState.isMeasuringDistance) {
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
        if (!this.appState.isMeasuringDistance) return;
        
        // Add the point to the measurement
        this.addMeasurementPoint(e.latlng);
    }
    
    /**
     * Add a point to the current measurement
     */
    addMeasurementPoint(latlng) {
        // Store the point
        if (!this.appState.measurementPoints) {
            this.appState.measurementPoints = [];
        }
        
        this.appState.measurementPoints.push(latlng);
        
        // Add marker at the point
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'measurement-point',
                html: `<div class="measurement-marker">${this.appState.measurementPoints.length}</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            })
        }).addTo(this.measurementLayer);
        
        // If we have at least two points, add a line and calculate distance
        if (this.appState.measurementPoints.length >= 2) {
            // Get the last two points
            const points = [
                this.appState.measurementPoints[this.appState.measurementPoints.length - 2],
                this.appState.measurementPoints[this.appState.measurementPoints.length - 1]
            ];
            
            // Calculate distance
            const distance = this.calculateDistance(points[0], points[1]);
            
            // Format distance for display
            const formattedDistance = this.formatDistance(distance);
            
            // Add polyline between the points
            const line = L.polyline(points, {
                color: '#ff4081',
                weight: 3,
                opacity: 0.8,
                dashArray: '5, 5'
            }).addTo(this.measurementLayer);
            
            // Add distance label
            const midpoint = this.getMidpoint(points[0], points[1]);
            
            L.marker(midpoint, {
                icon: L.divIcon({
                    className: 'measurement-label',
                    html: `<div class="measurement-distance">${formattedDistance}</div>`,
                    iconSize: [80, 20],
                    iconAnchor: [40, 10]
                })
            }).addTo(this.measurementLayer);
            
            // Update UI with total distance if needed
            if (this.appState.measurementPoints.length > 2) {
                let totalDistance = 0;
                
                for (let i = 1; i < this.appState.measurementPoints.length; i++) {
                    totalDistance += this.calculateDistance(
                        this.appState.measurementPoints[i-1],
                        this.appState.measurementPoints[i]
                    );
                }
                
                // Show total in UI
                if (this.uiController && this.uiController.updateMeasurementTotal) {
                    this.uiController.updateMeasurementTotal(totalDistance);
                }
            }
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
        this.appState.isMeasuringDistance = false;
        
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
        this.appState.isMeasuringDistance = false;
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
     * Optimized for iPhone GPS and permissions handling
     */
    startHighAccuracyLocationTracking() {
        // Stop existing watch if any
        this.stopHighAccuracyLocationTracking();
        
        // Reset position filter
        this.locationFilter.reset();
        
        if (navigator.geolocation) {
            // Initialize position prediction system
            this.lastPosition = null;
            this.lastPositionTime = null;
            this.velocityLat = 0;
            this.velocityLng = 0;
            
            // Show status while waiting for location
            if (this.uiController) {
                this.uiController.showStatusBar('Getting precise location...');
            }
            
            // Request iOS motion permissions if available
            this.requestMotionPermission();
            
            // First get a single high-accuracy position to establish baseline
            navigator.geolocation.getCurrentPosition(
                // Initial position success
                (initialPosition) => {
                    // Store initial position
                    this.lastPosition = {
                        latitude: initialPosition.coords.latitude,
                        longitude: initialPosition.coords.longitude,
                        accuracy: initialPosition.coords.accuracy
                    };
                    this.lastPositionTime = new Date().getTime();
                    
                    // Add to filter
                    this.locationFilter.addPosition(initialPosition);
                    
                    // Update marker position
                    this.updateLocationMarker(initialPosition);
                    
                    // Show accuracy information to user
                    if (this.uiController) {
                        // Only show if accuracy is concerning
                        if (initialPosition.coords.accuracy > 10) {
                            this.uiController.showToast(`GPS accuracy: ${initialPosition.coords.accuracy.toFixed(1)}m - For better results, hold device flat and stay in open areas`, 'info');
                        }
                    }
                    
                    // Check if we're on iOS
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                    
                    // Optimize watch settings for iOS/iPhone
                    const watchOptions = {
                        enableHighAccuracy: true,
                        timeout: isIOS ? 15000 : 10000,  // Longer timeout for iOS
                        maximumAge: isIOS ? 1000 : 0     // Small cache for iOS to reduce battery impact
                    };
                    
                    // Set iPhone-specific watch behavior
                    if (isIOS) {
                        // Set up attitude tracking for better heading on iPhone
                        this.setupDeviceAttitudeTracking();
                    }
                    
                    // Start watching position with optimized parameters
                    this.appState.highAccuracyWatchId = navigator.geolocation.watchPosition(
                        // Position update success
                        (position) => {
                            const now = new Date().getTime();
                            const timeDelta = (now - this.lastPositionTime) / 1000; // in seconds
                            
                            // Calculate velocity if we have previous position
                            if (this.lastPosition && timeDelta > 0) {
                                // Calculate speed in lat/lng per second (simple velocity)
                                const latDelta = position.coords.latitude - this.lastPosition.latitude;
                                const lngDelta = position.coords.longitude - this.lastPosition.longitude;
                                
                                // Use exponential smoothing for velocity (alpha = 0.3)
                                this.velocityLat = 0.3 * (latDelta / timeDelta) + 0.7 * this.velocityLat;
                                this.velocityLng = 0.3 * (lngDelta / timeDelta) + 0.7 * this.velocityLng;
                            }
                            
                            // Store position for next calculation
                            this.lastPosition = {
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                                accuracy: position.coords.accuracy
                            };
                            this.lastPositionTime = now;
                            
                            // Add to filter and get smoothed position
                            const filteredPosition = this.locationFilter.addPosition(position);
                            
                            // Update marker position with filtered position
                            if (filteredPosition) {
                                const enhancedPosition = {
                                    coords: {
                                        latitude: filteredPosition.latitude,
                                        longitude: filteredPosition.longitude,
                                        accuracy: filteredPosition.accuracy || position.coords.accuracy,
                                        heading: position.coords.heading || null,
                                        speed: position.coords.speed || null
                                    },
                                    timestamp: position.timestamp
                                };
                                
                                this.updateLocationMarker(enhancedPosition);
                            } else {
                                this.updateLocationMarker(position);
                            }
                                            
                            // Update heading indicator if available from GPS
                            if (position.coords.heading !== null && position.coords.heading !== undefined) {
                                const filteredHeading = this.locationFilter.addHeading(position.coords.heading);
                                this.updateHeading(filteredHeading);
                            }
                            
                            // Store timestamp for frequency monitoring
                            this.appState.lastLocationUpdate = now;
                            
                            // Update proximity calculations
                            if (this.appState.isExcavationMode) {
                                this.updateProximityCalculations();
                            }
                            
                            // Center map on user if following is enabled
                            if (this.appState.isExcavationMode && this.locationFollowingEnabled) {
                                if (filteredPosition) {
                                    this.map.setView([filteredPosition.latitude, filteredPosition.longitude]);
                                } else {
                                    this.map.setView([position.coords.latitude, position.coords.longitude]);
                                }
                            }
                        },
                        // Error handler with helpful messages
                        (error) => { 
                            console.error('Error watching position:', error);
                            // Show user-friendly error messages
                            if (this.uiController) {
                                switch(error.code) {
                                    case error.PERMISSION_DENIED:
                                        this.uiController.showToast('Location permission denied. Please enable location access in your settings.', 'error');
                                        break;
                                    case error.POSITION_UNAVAILABLE:
                                        this.uiController.showToast('Location information unavailable. Please check your GPS settings.', 'warning');
                                        break;
                                    case error.TIMEOUT:
                                        this.uiController.showToast('Location request timed out. Please try again in an open area.', 'warning');
                                        break;
                                    default:
                                        this.uiController.showToast('Error getting location. Please check your settings.', 'error');
                                }
                            }
                        },
                        // Options for high accuracy
                        watchOptions
                    );
                },
                // Initial position error
                (error) => { 
                    console.error('Error getting initial position:', error);
                    if (this.uiController) {
                        this.uiController.showToast('Unable to get your location. Please check permissions and try again.', 'error');
                    }
                },
                // Options for initial position
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0
                }
            );
        } else if (this.uiController) {
            this.uiController.showToast('Geolocation is not supported by your browser', 'error');
        }
    },
    
    /**
     * Request device motion/orientation permission (required for iOS 13+)
     */
    requestMotionPermission() {
        // Check if we're on iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        if (isIOS && typeof DeviceOrientationEvent !== 'undefined' && 
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            
            // iOS 13+ requires explicit permission
            DeviceOrientationEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        // Permission granted, now we can listen to device orientation
                        this.setupDeviceOrientationTracking();
                    } else {
                        // Permission denied
                        if (this.uiController) {
                            this.uiController.showToast('Motion sensors permission denied. Compass function may not work correctly.', 'warning');
                        }
                    }
                })
                .catch(error => {
                    console.error('Error requesting device orientation permission:', error);
                    // Still try to set up orientation tracking - might work on some devices
                    this.setupDeviceOrientationTracking();
                });
                
            // Also request motion permission if available
            if (typeof DeviceMotionEvent !== 'undefined' && 
                typeof DeviceMotionEvent.requestPermission === 'function') {
                
                DeviceMotionEvent.requestPermission()
                    .then(response => {
                        if (response === 'granted') {
                            // Permission granted for motion
                            console.log('Motion permission granted');
                        }
                    })
                    .catch(error => {
                        console.error('Error requesting motion permission:', error);
                    });
            }
        } else {
            // Non-iOS or older iOS - just set up the handler directly
            this.setupDeviceOrientationTracking();
        }
    },
    
    /**
     * Set up device orientation tracking for compass heading
     */
    setupDeviceOrientationTracking() {
        // Remove any existing listener to avoid duplicates
        window.removeEventListener('deviceorientation', this.handleDeviceOrientation);
        
        // Set up the handler with binding to maintain 'this' context
        this.handleDeviceOrientation = this.handleDeviceOrientation.bind(this);
        window.addEventListener('deviceorientation', this.handleDeviceOrientation);
    },
    
    /**
     * Set up device attitude tracking (extended tracking for iOS)
     */
    setupDeviceAttitudeTracking() {
        // This is a placeholder for additional iOS-specific attitude/motion tracking
        // In a real implementation, this would use additional iOS-specific APIs
        console.log('Device attitude tracking activated for iOS');
    },
    
    /**
     * Handle device orientation events for more accurate compass
     */
    handleDeviceOrientation(event) {
        // Check if we have the required data
        if (event.alpha !== null) {
            let heading = event.alpha;
            
            // iOS devices often need different calculations depending on orientation
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            
            if (isIOS) {
                // On iOS, we need to adjust based on device orientation
                const screenOrientation = window.orientation || 0;
                
                // Calculate heading based on screen orientation
                if (screenOrientation === 0) { // Portrait
                    heading = event.alpha;
                } else if (screenOrientation === 90) { // Landscape right
                    heading = event.alpha + 90;
                } else if (screenOrientation === -90) { // Landscape left
                    heading = event.alpha - 90;
                } else if (screenOrientation === 180) { // Upside down
                    heading = event.alpha + 180;
                }
                
                // Normalize heading to 0-360 range
                heading = (heading + 360) % 360;
            } else {
                // For Android, we might need webkitCompassHeading if available
                if (event.webkitCompassHeading) {
                    heading = event.webkitCompassHeading;
                } else {
                    // Android raw alpha needs to be inverted and adjusted
                    heading = 360 - event.alpha;
                }
            }
            
            // Add to filter and update UI
            if (!isNaN(heading)) {
                const filteredHeading = this.locationFilter.addHeading(heading);
                this.updateHeading(filteredHeading);
            }
        }
    },

    /**
     * Check for utilities near the excavation site
     */
    checkProximityAlerts() {
        if (!this.appState.isExcavationMode || !this.excavationCircle) return;
        
        const excavationCenter = this.excavationCircle.getLatLng();
        const utilitiesInProximity = [];
        
        // Check all utility types
        for (const type in this.utilityLayers) {
            this.utilityLayers[type].eachLayer(layer => {
                if (layer.utilityId) {
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
                }
            });
        }
        
        // Sort by distance (closest first)
        utilitiesInProximity.sort((a, b) => a.distance - b.distance);
        
        // Update UI with proximity alerts
        this.updateProximityAlerts(utilitiesInProximity);
    },

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
    },

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
        } else if (distance <= 10) {
            path.classList.add('proximity-danger');
        } else if (distance <= 25) {
            path.classList.add('proximity-caution');
        } else if (distance <= 50) {
            path.classList.add('proximity-warning');
        }
    },

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
    },

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
    },

    /**
     * Clear all proximity alerts
     */
    clearProximityAlerts() {
        // Clear the alerts array
        this.appState.activeAlerts = [];
        
        // Clear the UI alerts
        document.getElementById('proximity-alerts').innerHTML = '';
    },

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
    },

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
    },

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

        // SVG pin with center hole (matches original design)
        const svgIcon = `
            <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" class="location-marker-svg">
                <path d="M12,2C8.13,2 5,5.13 5,9c0,5.25 7,13 7,13s7,-7.75 7,-13c0,-3.87 -3.13,-7 -7,-7zM12,11.5c-1.38,0 -2.5,-1.12 -2.5,-2.5s1.12,-2.5 2.5,-2.5 2.5,1.12 2.5,2.5 -1.12,2.5 -2.5,2.5z" fill="#2196F3" stroke="white" stroke-width="1" />
                <circle cx="12" cy="9" r="2.5" fill="white" />
            </svg>`;

        // Create custom HTML icon (includes accuracy + heading elements)
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
        this.userLocationMarker = L.marker([lat, lng], {
            icon: userLocationIcon,
            zIndexOffset: 1000
        }).addTo(this.map);

        // Store reference & update accuracy visuals
        this.updateLocationAccuracy(lat, lng, 5);
        return this.userLocationMarker;
    },

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
                // scale between 0.8 – 2.0 of marker size based on accuracy metres
                const scale = Math.min(2.0, Math.max(0.8, accuracy / 20));
                accuracyEl.style.transform = `scale(${scale})`;
                // tint based on accuracy like original logic
                if (accuracy < 5) {
                    accuracyEl.style.backgroundColor = 'rgba(76, 175, 80, 0.15)';
                } else if (accuracy < 10) {
                    accuracyEl.style.backgroundColor = 'rgba(33, 150, 243, 0.15)';
                } else if (accuracy < 20) {
                    accuracyEl.style.backgroundColor = 'rgba(255, 152, 0, 0.15)';
                } else {
                    accuracyEl.style.backgroundColor = 'rgba(244, 67, 54, 0.15)';
                }
            }
        }

        // Existing Leaflet accuracy circle fallback (kept for desktop maps / large radii)
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
            this.accuracyCircle = null;
        }
        if (accuracy && accuracy > 0 && accuracy < 100) {
            this.accuracyCircle = L.circle([lat, lng], {
                radius: accuracy,
                color: 'var(--primary)',
                fillColor: 'var(--primary)',
                fillOpacity: 0.15,
                weight: 1,
                interactive: false
            }).addTo(this.map);
        }
    },

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
    },

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
    },

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
    },

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
    },

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
    },

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
    },

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
    },

    // Calculate distance from a point to an entire polyline (in meters)
    distanceToPolyline(point, polyline) {
        if (!polyline || polyline.length < 2) return Infinity;
        let min = Infinity;
        for (let i = 0; i < polyline.length - 1; i++) {
            const d = this.distanceToSegment(point, polyline[i], polyline[i + 1]);
            if (d < min) min = d;
        }
        return min;
    },

    /**
     * Start measurement mode
     */
    startMeasurement() {
        // Clear any existing measurements
        this.clearMeasurements();
        
        // Enable measurement mode
        this.appState.isMeasuringDistance = true;
        this.appState.measurementPoints = [];
        
        // Show measurement UI
        this.uiController.showToast('Click on the map to place measurement points', 'info');
        this.uiController.showMeasurementToolbar();
        
        // Add measurement layer to map if not already added
        if (!this.map.hasLayer(this.measurementLayer)) {
            this.measurementLayer.addTo(this.map);
        }
    },

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
                const headingElement = markerElement.querySelector('.location-heading');
                if (headingElement) {
                    headingElement.style.transform = `translateX(-50%) rotate(${heading}deg)`;
                    headingElement.style.opacity = '1';
                }
            }
        }
    },
    
    /**
     * Stop high accuracy location tracking
     */
    stopHighAccuracyLocationTracking() {
        if (this.appState.highAccuracyWatchId !== null) {
            navigator.geolocation.clearWatch(this.appState.highAccuracyWatchId);
            this.appState.highAccuracyWatchId = null;
        }
        
        // Also remove orientation listener if it exists
        if (this.handleDeviceOrientation) {
            window.removeEventListener('deviceorientation', this.handleDeviceOrientation);
        }
    },

    /**
     * Update the user location marker
     * @param {Object} position The position object from geolocation API
     */
    updateLocationMarker(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy || 10;
        const heading = position.coords.heading;
        const speed = position.coords.speed;
        
        // Create marker if it doesn't exist
        if (!this.userLocationMarker) {
            this.addUserLocationMarker(lat, lng);
        } else {
            // Update existing marker position
            this.userLocationMarker.setLatLng([lat, lng]);
        }
        
        // Update accuracy circle
        this.updateLocationAccuracy(lat, lng, accuracy);
        
        // Update heading if available
        if (heading !== null && heading !== undefined) {
            this.updateHeading(heading);
            
            // If using device orientation on iOS, add calibration indicator
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (isIOS) {
                this.showCompassCalibrationIfNeeded(accuracy);
            }
        }
        
        // Store as last known location
        this.appState.lastKnownLocation = {
            latitude: lat,
            longitude: lng,
            accuracy: accuracy,
            heading: heading,
            speed: speed,
            timestamp: new Date().getTime()
        };
        
        // Check if we should show accuracy improvement tips
        if (accuracy > 20 && !this.accuracyTipShown) {
            // Don't spam the user with too many tips
            this.accuracyTipShown = true;
            
            // Show tips based on device
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (isIOS && this.uiController) {
                this.uiController.showToast('For better GPS accuracy on iPhone, hold device flat with clear view of the sky', 'info');
            } else if (this.uiController) {
                this.uiController.showToast('For better GPS accuracy, move to an open area away from buildings', 'info');
            }
            
            // Reset tip after 2 minutes
            setTimeout(() => {
                this.accuracyTipShown = false;
            }, 120000);
        }
    },
    
    /**
     * Show compass calibration indicator if needed (iOS specific)
     * @param {number} accuracy The current position accuracy
     */
    showCompassCalibrationIfNeeded(accuracy) {
        // Check if we need to calibrate based on accuracy
        // Accuracy > 20m often indicates poor GPS which can affect compass
        if (accuracy > 20 && !this.compassCalibrationShown) {
            this.compassCalibrationShown = true;
            
            // Show calibration toast
            if (this.uiController) {
                this.uiController.showToast(
                    'Compass may need calibration. Try moving your phone in a figure-8 pattern.',
                    'warning'
                );
            }
            
            // Add visual indicator to the marker
            if (this.userLocationMarker) {
                const markerEl = this.userLocationMarker.getElement();
                if (markerEl) {
                    // Add calibration needed class to marker
                    markerEl.classList.add('needs-calibration');
                    
                    // Remove after 10 seconds
                    setTimeout(() => {
                        markerEl.classList.remove('needs-calibration');
                        this.compassCalibrationShown = false;
                    }, 10000);
                }
            }
        }
    },
} 