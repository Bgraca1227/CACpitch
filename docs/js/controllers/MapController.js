/**
 * Position filter for smoothing location data
 */
class PositionFilter {
    constructor() {
        this.positions = [];
        this.maxPositions = 10;  // Increased from 5 to 10 for smoother location averaging
        this.accuracyThreshold = 35; // Increased from 20 to 35 meters to accommodate more challenging environments
        this.headings = [];
        this.maxHeadings = 10;   // Increased from 8 to 10 heading samples for better smoothing
        this.lastHeading = null; // Track last heading for dampening
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
        
        // Always add positions for tracking, but weight them by accuracy
        this.positions.push(position);
        
        // Keep only the most recent positions
        if (this.positions.length > this.maxPositions) {
            this.positions.shift();
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
        let totalAccuracy = 0;
        
        this.positions.forEach((pos, index) => {
            // More recent positions get higher weight
            const recencyWeight = Math.pow((index + 1) / this.positions.length, 2); // Squared for greater emphasis on recent positions
            // More accurate positions get higher weight
            const accuracyWeight = 1 / Math.max(1, pos.coords.accuracy);
            const weight = recencyWeight * accuracyWeight;
            
            weightedLat += pos.coords.latitude * weight;
            weightedLng += pos.coords.longitude * weight;
            totalWeight += weight;
            
            // Track average accuracy
            totalAccuracy += pos.coords.accuracy;
        });
        
        // Return weighted average position with accuracy estimate
        return {
            latitude: weightedLat / totalWeight,
            longitude: weightedLng / totalWeight,
            accuracy: totalAccuracy / this.positions.length
        };
    }
    
    addHeading(heading) {
        if (isNaN(heading)) return this.getFilteredHeading();
        
        // Apply a simple motion model to reduce jitter
        if (this.lastHeading !== null) {
            // Dampening: new heading is a weighted average of new and previous
            const dampFactor = 0.3; // Lower = more dampening
            heading = (1 - dampFactor) * this.lastHeading + dampFactor * heading;
            
            // Handle wrap-around for angles crossing 0/360 boundary
            if (Math.abs(heading - this.lastHeading) > 180) {
                if (heading > this.lastHeading) {
                    heading -= 360;
                } else {
                    heading += 360;
                }
                heading = (1 - dampFactor) * this.lastHeading + dampFactor * heading;
                // Normalize back to 0-360
                if (heading < 0) heading += 360;
                if (heading >= 360) heading -= 360;
            }
        }
        
        this.lastHeading = heading;
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
        this.lastHeading = null;
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
            telecom: L.layerGroup(),
            sewer: L.layerGroup(),
            custom: L.layerGroup()
        };
        this.structureLayers = {
            water: L.layerGroup(),
            gas: L.layerGroup(),
            electric: L.layerGroup(),
            telecom: L.layerGroup(),
            sewer: L.layerGroup(),
            custom: L.layerGroup()
        };
        this.measurementLayer = L.layerGroup();
        
        this.userLocationMarker = null;
        this.followUser = false;
        this.utilityHighlights = [];
        this.selectedUtility = null;
        this.selectedPoint = null;
        this.connectionPointMarker = null;
        this.drawingPoints = [];
        this.uiController = null; // Will be set by main.js
        this.eventHandlers = null; // Will be set by main.js
        this.accuracyCircle = null;
        
        // Location tracking properties
        this.watchPositionId = null;
        this.currentHeading = 0;
        this.lastPosition = null;
        this.isOrientationActive = false;
        this.orientationHandler = null;
        this.motionHandler = null;
        this.proximityInterval = null;
        
        // Create an instance of PositionFilter for location smoothing
        this.positionFilter = new PositionFilter();
        
        // Signal strength indicator
        this.signalStrengthIndicator = null;
        this.updateSignalRate = 0; // Track updates per second
        this.lastUpdateTime = Date.now();
        this.updateCountInLastSecond = 0;
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
        console.log('Setting up map controls');
        
        // Check if map controls exist
        let mapControls = document.getElementById('map-controls');
        if (!mapControls) {
            // Create the map controls container
            mapControls = document.createElement('div');
            mapControls.id = 'map-controls';
            mapControls.className = 'map-controls';
            
            // Create control buttons
            const controls = [
                { id: 'zoom-in-btn', icon: 'fa-plus', title: 'Zoom In', handler: () => this.map.zoomIn() },
                { id: 'zoom-out-btn', icon: 'fa-minus', title: 'Zoom Out', handler: () => this.map.zoomOut() },
                { id: 'locate-btn', icon: 'fa-crosshairs', title: 'Locate Me', handler: () => this.locateUser() },
                { id: 'recenter-btn', icon: 'fa-location-arrow', title: 'Recenter Map', handler: () => {
                    if (this.userLocationMarker) {
                        this.map.setView(this.userLocationMarker.getLatLng(), this.map.getZoom());
                    } else {
                        this.locateUser();
                    }
                }}
            ];
            
            // Add buttons to container
            controls.forEach(control => {
                const button = document.createElement('button');
                button.id = control.id;
                button.className = 'map-control-button';
                button.innerHTML = `<i class="fas ${control.icon}"></i>`;
                button.addEventListener('click', control.handler);
                mapControls.appendChild(button);
            });
            
            // Add to map container
            document.querySelector('.map-container').appendChild(mapControls);
        }
        
        // Ensure map controls are visible
        mapControls.style.position = 'absolute';
        mapControls.style.right = '15px';
        mapControls.style.top = 'calc(var(--space-lg) + 50px)';
        mapControls.style.display = 'flex';
        mapControls.style.flexDirection = 'column';
        mapControls.style.gap = '8px';
        mapControls.style.zIndex = '2000';
        
        // Update button styles
        document.querySelectorAll('.map-control-button').forEach(btn => {
            btn.style.width = '48px';
            btn.style.height = '48px';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.backgroundColor = 'white';
            btn.style.color = '#757575';
            btn.style.borderRadius = '50%';
            btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        });
        
        console.log('Map controls setup complete');
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
        // Attempt to start orientation tracking immediately (within the same
        // user-gesture that triggered Locate Me) so iOS devices will show the
        // motion-permission prompt together with the location prompt.
        this.setupOrientationTracking();

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
     * Add user location marker to the map
     * @param {number} lat Latitude
     * @param {number} lng Longitude
     * @returns {L.Marker} The location marker
     */
    addUserLocationMarker(lat, lng) {
        // Remove existing marker if any
        if (this.userLocationMarker) {
            this.map.removeLayer(this.userLocationMarker);
        }

        // Create a clean minimal SVG marker
        const markerHtml = `
            <div class="location-marker-container">
                <div class="location-accuracy-circle"></div>
                <div class="location-pulse"></div>
                <div class="location-pulse-inner"></div>
                <div class="location-center"></div>
                <div class="location-heading" style="position:absolute; width:0; height:0; left:50%; top:-10px; border-left:8px solid transparent; border-right:8px solid transparent; border-bottom:16px solid #2196F3; transform-origin:bottom center; transform:translateX(-50%) rotate(0deg); opacity:1; z-index:1000;"></div>
            </div>
        `;
        
        // Create the icon with accuracy circle
        const userLocationIcon = L.divIcon({
            className: 'user-location-marker with-heading medium-accuracy', // Add with-heading class to start with arrow
            html: markerHtml,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
        
        // Add marker to map
        const marker = L.marker([lat, lng], {
            icon: userLocationIcon,
            zIndexOffset: 1000
        }).addTo(this.map);
        
        // Store reference to marker
        this.userLocationMarker = marker;
        
        // Debug check
        console.log('[Debug] Created user location marker with heading');
        
        // Add click handler to center map on user location
        marker.on('click', () => {
            this.map.setView([lat, lng], this.map.getZoom());
            if (this.uiController) {
                this.uiController.showToast('Centered on your location', 'info');
            }
        });
        
        // Add signal strength indicator
        this.addSignalStrengthIndicator();
        
        // Force immediate heading application
        if (this.currentHeading !== undefined && this.currentHeading !== null) {
            this.updateHeading(this.currentHeading);
        }
        
        return marker;
    }
    
    /**
     * Update the user's location marker on the map
     * @param {object} position Position object from geolocation
     */
    updateLocationMarker(position) {
        // Use position filter to smooth location data
        const filteredPosition = this.positionFilter.addPosition(position);
        
        if (!filteredPosition) return;
        
        const lat = filteredPosition.latitude;
        const lng = filteredPosition.longitude;
        const accuracy = position.coords.accuracy;
        
        // Create marker if it doesn't exist
        if (!this.userLocationMarker) {
            this.userLocationMarker = this.addUserLocationMarker(lat, lng);
        } else {
            // Update existing marker position
            this.userLocationMarker.setLatLng([lat, lng]);
            
            // Update accuracy circle and marker class
            const markerElement = this.userLocationMarker.getElement();
            if (markerElement && accuracy) {
                // Remove all accuracy classes
                markerElement.classList.remove('high-accuracy', 'medium-accuracy', 'low-accuracy', 'very-low-accuracy');
                
                // Update accuracy circle size
                const accuracyCircle = markerElement.querySelector('.location-accuracy-circle');
                if (accuracyCircle) {
                    // Scale the accuracy circle based on the accuracy value
                    // Limit to reasonable sizes
                    const scale = Math.min(2.0, Math.max(0.9, accuracy / 20));
                    accuracyCircle.style.transform = `scale(${scale})`;
                }
                
                // Add appropriate accuracy class
                if (accuracy < 5) {
                    markerElement.classList.add('high-accuracy');
                } else if (accuracy < 15) {
                    markerElement.classList.add('medium-accuracy');
                } else if (accuracy < 30) {
                    markerElement.classList.add('low-accuracy');
                } else {
                    markerElement.classList.add('very-low-accuracy');
                }
            }
        }
        
        // Update signal strength indicator
        this.updateSignalStrengthIndicator(accuracy);
        
        // Update app state with latest position
        this.appState.userLocation = [lat, lng];
    }

    /**
     * Update the heading indicator on the user location marker
     * @param {number} heading Heading in degrees (0-360)
     */
    updateHeading(heading) {
        if (isNaN(heading)) {
            console.warn('updateHeading called with invalid heading:', heading);
            return;
        }
        
        // Normalize heading to 0-360 range
        heading = ((heading % 360) + 360) % 360;
        
        // Store current heading (heading is already filtered by processHeading)
        this.currentHeading = heading;
        
        // Update marker if it exists
        try {
            if (this.userLocationMarker) {
                const markerElement = this.userLocationMarker.getElement();
                
                if (markerElement) {
                    // Get the heading element (should only be one)
                    const headingElement = markerElement.querySelector('.location-heading');
                    
                    if (headingElement) {
                        // Make sure the arrow is visible by setting opacity
                        headingElement.style.opacity = '1';
                        
                        // Update the rotation - use CSS transform for better performance
                        // Note: translateX(-50%) centers the arrow, then rotate by heading
                        const transform = `translateX(-50%) rotate(${heading}deg)`;
                        headingElement.style.transform = transform;
                        
                        // Force a reflow to ensure the transform is applied immediately
                        headingElement.getBoundingClientRect();
                        
                        console.log(`Heading updated to ${heading}° (source: ${this.lastHeadingSource || 'unknown'})`);
                    } else {
                        console.error('❌ Heading element NOT found in marker');
                    }
                    
                    // Add heading indicator class if not already there
                    if (!markerElement.classList.contains('with-heading')) {
                        markerElement.classList.add('with-heading');
                    }
                } else {
                    console.error('❌ Marker element is null/undefined');
                }
            } else {
                console.error('❌ userLocationMarker is null/undefined');
            }
        } catch (error) {
            console.error('Error updating heading indicator:', error);
        }
    }
    
    /**
     * Set up device orientation tracking for compass heading
     */
    setupOrientationTracking() {
        // Store initial settings
        this.isOrientationActive = false;
        this.motionActive = false;
        
        // Check for orientation API
        if (window.DeviceOrientationEvent) {
            // For iOS 13+ we need to request permission
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                // Request permission immediately (we should be inside a user gesture if locateUser triggered this)
                DeviceOrientationEvent.requestPermission()
                    .then(permissionState => {
                        if (permissionState === 'granted') {
                            this.addOrientationListener();
                            if (this.uiController) {
                                this.uiController.showToast('Compass access granted', 'success');
                            }
                        } else {
                            if (this.uiController) {
                                this.uiController.showToast('Compass access denied - direction indicator may be less accurate', 'warning');
                            }
                        }
                    })
                    .catch(error => {
                        console.error('Error requesting orientation permission:', error);
                        if (this.uiController) {
                            this.uiController.showToast('Failed to access compass - direction may be less accurate', 'warning');
                        }
                    });
            } else {
                // For non-iOS devices, just add the listener
                this.addOrientationListener();
            }
        } else {
            console.log('Device orientation API not available');
            
            // Show calibration notice if geolocation-based heading isn't available
            if (this.uiController) {
                this.uiController.showToast('Compass not available - direction may be less accurate', 'info');
            }
        }
    }
    
    /**
     * Add the device orientation event listener with error handling
     */
    addOrientationListener() {
        // Remove any existing listener first to prevent duplicates
        if (this.orientationHandler) {
            try {
                console.log('Removing existing orientation listener');
                window.removeEventListener('deviceorientation', this.orientationHandler);
                window.removeEventListener('deviceorientationabsolute', this.orientationHandler);
            } catch (e) {
                console.warn('Error removing orientation listener:', e);
            }
        }
        
        // Define the handler with improved error handling
        this.orientationHandler = (e) => {
            try {
                this.handleOrientation(e);
            } catch (error) {
                console.error('Error in orientation handler:', error);
            }
        };
        
        // First try to use absoluteOrientation if available (more accurate)
        try {
            console.log('Testing available orientation APIs...');
            
            let eventType = null;
            
            // Check for absolute orientation first (preferred)
            if ('ondeviceorientationabsolute' in window) {
                console.log('deviceorientationabsolute API detected - using this');
                eventType = 'deviceorientationabsolute';
            } 
            // Fall back to regular orientation with absolute flag check
            else if ('ondeviceorientation' in window) {
                console.log('deviceorientation API detected - using this');
                eventType = 'deviceorientation';
            }
            
            if (eventType) {
                console.log(`Adding listener for ${eventType} events`);
                window.addEventListener(eventType, this.orientationHandler, false);
                this.isOrientationActive = true;
                console.log(`${eventType} tracking started successfully`);
                
                // Check if we're getting events quickly
                let eventCount = 0;
                const testTimeout = setTimeout(() => {
                    console.log(`Orientation event count after 2 seconds: ${eventCount}`);
                    if (eventCount === 0) {
                        console.warn('No orientation events received - sensor might be blocked or unavailable');
                    }
                }, 2000);
                
                // Count events briefly
                const countHandler = () => { eventCount++; };
                window.addEventListener(eventType, countHandler);
                setTimeout(() => {
                    window.removeEventListener(eventType, countHandler);
                    clearTimeout(testTimeout);
                }, 2100);
            } else {
                throw new Error('No supported orientation API found');
            }
        } catch (error) {
            console.error('Failed to add orientation listener:', error);
            this.isOrientationActive = false;
            
            // Try to use geolocation-based heading as backup
            if (this.uiController) {
                this.uiController.showToast('Compass may not be available - using GPS for direction', 'info');
            }
        }
    }
    
    /**
     * Handle device orientation event with improved accuracy
     * @param {DeviceOrientationEvent} e The orientation event
     */
    handleOrientation(e) {
        // First check for iOS compass data which is most reliable
        if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
            // iOS uses webkitCompassHeading (degrees from north, clockwise)
            const heading = e.webkitCompassHeading;
            // Check for valid heading range
            if (heading >= 0 && heading <= 360) {
                this.processHeading(heading, 'compass');
                return; // Exit early with iOS heading
            }
        }
        
        // Android/Chrome approach with better orientation handling
        if (e.alpha !== null && e.alpha !== undefined) {
            let heading;
            
            // For absolute orientation API (most accurate non-iOS approach)
            if (e.absolute === true) {
                // Compass heading - alpha is the device's rotation around z-axis
                // 0 degrees = North, increasing clockwise
                heading = e.alpha;
            } 
            // Apply screen orientation correction if available
            else if (window.screen && window.screen.orientation) {
                const screenOrientation = window.screen.orientation.angle || 0;
                
                // Standard device orientation calculation
                heading = e.alpha;
                
                // Apply screen orientation correction
                // The device may be rotated relative to its natural orientation
                heading = (heading - screenOrientation + 360) % 360;
            } 
            // Last resort - use alpha directly but correct for device coordinate system
            else {
                // Most Android devices report alpha relative to device's y-axis
                // We need to convert this to compass heading (relative to north)
                heading = (360 - e.alpha + 360) % 360;
            }
            
            // Normalize to 0-360 range and check validity
            heading = ((heading % 360) + 360) % 360;
            
            if (heading >= 0 && heading <= 360) {
                this.processHeading(heading, 'compass');
            }
        }
    }
    
    /**
     * Process and smooth heading values with source prioritization
     * @param {number} rawHeading Raw heading in degrees
     * @param {string} source Source of the heading ('compass', 'gps', 'motion')
     */
    processHeading(rawHeading, source = 'compass') {
        if (isNaN(rawHeading)) return;
        
        // Update last heading source and time
        this.lastHeadingSource = source;
        this.lastHeadingTime = Date.now();
        
        // Prioritize compass over GPS over motion
        const sourcePriority = { compass: 3, gps: 2, motion: 1 };
        const currentPriority = sourcePriority[source] || 1;
        
        // If we have a higher priority source active recently, ignore lower priority
        if (this.lastHeadingPriority && currentPriority < this.lastHeadingPriority) {
            const timeSinceLastHigh = Date.now() - this.lastHighPriorityTime;
            if (timeSinceLastHigh < 3000) { // 3 second preference for higher priority sources
                return;
            }
        }
        
        // Store priority info
        if (currentPriority >= (this.lastHeadingPriority || 0)) {
            this.lastHeadingPriority = currentPriority;
            this.lastHighPriorityTime = Date.now();
        }
        
        // Use the position filter to smooth headings
        const filteredHeading = this.positionFilter.addHeading(rawHeading);
        
        // Update the heading display
        this.updateHeading(filteredHeading);
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
        // Already in excavation mode
        if (this.appState.isExcavationMode) return;
        
        // Set state
        this.appState.isExcavationMode = true;
        this.appState.activeAlerts = [];
        
        // Show excavation mode UI
        if (this.uiController) {
            this.uiController.showExcavationModeIndicator();
            this.uiController.showExitExcavationButton();
        }
        
        // Set a more focused zoom level and follow user
        this.map.setZoom(21); // Increased from 18 for much closer zoom
        
        // Go to user's location if available
        if (this.userLocationMarker) {
            this.map.setView(this.userLocationMarker.getLatLng());
            this.followUser = true;
        }
        
        // Apply excavation mode visual style
        document.body.classList.add('excavation-mode');
        
        // Reset any existing utility highlights
        this.resetAllUtilityHighlights();
        
        // Enable high accuracy location tracking
        this.startHighAccuracyLocationTracking();
        
        // Start proximity monitoring at frequent intervals
        this.startProximityMonitoring();
        
        console.log('Excavation mode enabled');
    }
    
    /**
     * Disable excavation mode
     */
    disableExcavationMode() {
        // Not in excavation mode
        if (!this.appState.isExcavationMode) return;
        
        // Set state
        this.appState.isExcavationMode = false;
        this.appState.activeAlerts = [];
        
        // Hide excavation mode UI
        if (this.uiController) {
            this.uiController.hideExcavationModeIndicator();
            this.uiController.hideExitExcavationButton();
            this.uiController.clearAllProximityAlerts();
        }
        
        // Reset zoom level to normal
        this.map.setZoom(16);
        
        // Remove excavation mode visual style
        document.body.classList.remove('excavation-mode');
        
        // Reset any existing utility highlights
        this.resetAllUtilityHighlights();
        
        // Disable high accuracy location tracking
        this.stopHighAccuracyLocationTracking();
        
        // Stop proximity monitoring
        this.stopProximityMonitoring();
        
        console.log('Excavation mode disabled');
    }
    
    /**
     * Toggle location following mode
     */
    toggleLocationFollowing() {
        this.followUser = !this.followUser;
        
        if (this.followUser && this.userLocationMarker) {
            // Center map on user's location
            this.map.setView(this.userLocationMarker.getLatLng(), 
                this.appState.isExcavationMode ? 21 : 18);
            
            if (this.uiController) {
                this.uiController.showToast('Following your location', 'info');
            }
        } else {
            if (this.uiController) {
                this.uiController.showToast('Stopped following your location', 'info');
            }
        }
    }
    
    /**
     * Disable location following
     */
    disableLocationFollowing() {
        this.followUser = false;
    }
    
    /**
     * Start proximity monitoring at regular intervals
     */
    startProximityMonitoring() {
        // Clear any existing interval
        this.stopProximityMonitoring();
        
        // Start a new interval to check proximity
        this.proximityInterval = setInterval(() => {
            if (this.appState.isExcavationMode && this.userLocationMarker) {
                this.checkProximityAlerts();
            }
        }, 2000); // Check every 2 seconds
    }
    
    /**
     * Stop proximity monitoring interval
     */
    stopProximityMonitoring() {
        if (this.proximityInterval) {
            clearInterval(this.proximityInterval);
            this.proximityInterval = null;
        }
    }
    
    /**
     * Start high accuracy location tracking with improved error handling
     */
    startHighAccuracyLocationTracking() {
        try {
            // Stop current watching
            if (this.watchPositionId) {
                navigator.geolocation.clearWatch(this.watchPositionId);
                this.watchPositionId = null;
            }
            
            // Reset position filter
            this.positionFilter.reset();
            
            // Start new watching with high accuracy
            if (navigator.geolocation) {
                const options = {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                };
                
                try {
                    this.watchPositionId = navigator.geolocation.watchPosition(
                        (position) => {
                            this.updateLocationMarker(position);
                            
                            // Update heading if available from GPS
                            // Use same prioritization logic as normal position watching
                            const now = Date.now();
                            const compassAge = now - this.lastHeadingTime;
                            
                            if (position.coords.heading !== null && position.coords.heading !== undefined) {
                                // Prefer compass heading over GPS heading, but use GPS if compass is stale
                                if (this.lastHeadingSource !== 'compass' || compassAge > 2000) {
                                    this.processHeading(position.coords.heading, 'gps');
                                }
                            }
                            
                            // Center map if following
                            if (this.followUser && this.userLocationMarker) {
                                this.map.setView(this.userLocationMarker.getLatLng());
                            }
                            
                            // Check proximity if in excavation mode
                            if (this.appState.isExcavationMode) {
                                this.checkProximityAlerts();
                            }
                        },
                        (error) => {
                            console.error('Error watching position:', error);
                            
                            // Show error in signal indicator
                            if (this.signalStrengthIndicator) {
                                const barElements = this.signalStrengthIndicator.querySelectorAll('.signal-bar');
                                barElements.forEach(bar => bar.classList.remove('active'));
                                const textElement = this.signalStrengthIndicator.querySelector('.signal-text');
                                if (textElement) {
                                    textElement.textContent = 'GPS: Error';
                                }
                            }
                            
                            // Show user-friendly error
                            if (this.uiController && error.code) {
                                let errorMsg = 'Location error';
                                switch(error.code) {
                                    case 1: // PERMISSION_DENIED
                                        errorMsg = 'Location permission denied';
                                        break;
                                    case 2: // POSITION_UNAVAILABLE
                                        errorMsg = 'Location unavailable';
                                        break;
                                    case 3: // TIMEOUT
                                        errorMsg = 'Location request timed out';
                                        break;
                                }
                                this.uiController.showToast(errorMsg, 'error');
                            }
                        },
                        options
                    );
                } catch (e) {
                    console.error('Exception setting up geolocation:', e);
                    if (this.uiController) {
                        this.uiController.showToast('Failed to start location tracking', 'error');
                    }
                }
                
                // Setup orientation tracking for heading
                this.setupOrientationTracking();
            }
        } catch (error) {
            console.error('Error starting high accuracy location tracking:', error);
            if (this.uiController) {
                this.uiController.showToast('Error starting location tracking', 'error');
            }
        }
    }
    
    /**
     * Stop high accuracy location tracking
     */
    stopHighAccuracyLocationTracking() {
        if (this.watchPositionId) {
            navigator.geolocation.clearWatch(this.watchPositionId);
            this.watchPositionId = null;
        }
        
        // Remove orientation listener if active
        if (this.orientationHandler && this.isOrientationActive) {
            window.removeEventListener('deviceorientation', this.orientationHandler);
            this.isOrientationActive = false;
        }
        
        // Start with normal accuracy
        this.startWatchingPosition();
    }
    
    /**
     * Reset all utility highlight styling
     */
    resetAllUtilityHighlights() {
        // Reset previous highlights
        this.utilityHighlights.forEach(highlightInfo => {
            const { layer, originalStyle } = highlightInfo;
            
            // Reset to original style
            if (layer && originalStyle) {
                layer.setStyle(originalStyle);
            }
        });
        
        // Clear the highlights array
        this.utilityHighlights = [];
    }
    
    /**
     * Check proximity to utilities and show alerts with improved error handling
     */
    checkProximityAlerts() {
        try {
            // Get current user location
            if (!this.userLocationMarker) return;
            
            const userLocation = this.userLocationMarker.getLatLng();
            if (!userLocation) return;
            
            // Reset utility highlights
            this.resetAllUtilityHighlights();
            
            // Active alerts list
            const activeAlerts = [];
            
            // Check all utility layers
            Object.keys(this.utilityLayers).forEach(utilityType => {
                const layer = this.utilityLayers[utilityType];
                
                // Skip if layer is not visible
                if (!this.map.hasLayer(layer)) return;
                
                // Check each utility in the layer
                layer.eachLayer(utility => {
                    // Skip if utility is not a line or polygon
                    if (!utility.getLatLngs) return;
                    
                    try {
                        // Calculate distance to utility
                        const utilityPoints = utility.getLatLngs();
                        let minDistance = Infinity;
                        let closestPoint;
                        
                        // For multi-polygons and complex line strings
                        if (utilityPoints.length && typeof utilityPoints[0].lat !== 'function') {
                            // Handle multi-part geometries
                            utilityPoints.forEach(partPoints => {
                                if (Array.isArray(partPoints)) {
                                    partPoints.forEach(point => {
                                        const distance = userLocation.distanceTo(point);
                                        if (distance < minDistance) {
                                            minDistance = distance;
                                            closestPoint = point;
                                        }
                                    });
                                }
                            });
                        } else {
                            // Simple line string
                            utilityPoints.forEach(point => {
                                const distance = userLocation.distanceTo(point);
                                if (distance < minDistance) {
                                    minDistance = distance;
                                    closestPoint = point;
                                }
                            });
                        }
                        
                        // If distance is less than threshold, add to alerts
                        if (minDistance <= 20) { // 20 meters threshold
                            // Get utility data
                            const utilityData = utility.feature?.properties || utility.utilityData || {};
                            
                            // Determine alert level
                            let alertLevel;
                            if (minDistance <= 2) {
                                alertLevel = 'critical';
                            } else if (minDistance <= 5) {
                                alertLevel = 'danger';
                            } else if (minDistance <= 10) {
                                alertLevel = 'caution';
                            } else {
                                alertLevel = 'warning';
                            }
                            
                            // Create alert data
                            const alert = {
                                id: `utility-${utilityType}-${utility._leaflet_id}`,
                                utilityType,
                                distance: minDistance,
                                level: alertLevel,
                                utility,
                                utilityData,
                                closestPoint,
                                timestamp: Date.now()
                            };
                            
                            // Add to active alerts
                            activeAlerts.push(alert);
                            
                            // Store the original style
                            const originalStyle = {
                                color: utility.options.color,
                                weight: utility.options.weight,
                                opacity: utility.options.opacity
                            };
                            
                            // Apply highlight style
                            let highlightColor;
                            let highlightWeight = utility.options.weight + 2;
                            
                            switch (alertLevel) {
                                case 'critical':
                                    highlightColor = '#F44336'; // Red
                                    highlightWeight = utility.options.weight + 4;
                                    break;
                                case 'danger':
                                    highlightColor = '#FF5722'; // Deep Orange
                                    highlightWeight = utility.options.weight + 3;
                                    break;
                                case 'caution':
                                    highlightColor = '#FF9800'; // Orange
                                    break;
                                default:
                                    highlightColor = '#FFC107'; // Amber
                            }
                            
                            // Apply highlight style
                            utility.setStyle({
                                color: highlightColor,
                                weight: highlightWeight,
                                opacity: 1
                            });
                            
                            // Add to highlights list
                            this.utilityHighlights.push({
                                layer: utility,
                                originalStyle
                            });
                        }
                    } catch (e) {
                        console.error('Error checking proximity for utility:', e);
                    }
                });
            });
            
            // Update app state with active alerts
            this.appState.activeAlerts = activeAlerts;
            
            // Update UI
            if (this.uiController && this.uiController.updateProximityAlerts) {
                this.uiController.updateProximityAlerts(activeAlerts);
            }
        } catch (error) {
            console.error('Error checking proximity alerts:', error);
        }
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

    startHighAccuracyRepositioning(utility) {
        console.log('Starting high accuracy repositioning for utility:', utility);
        
        // Store reference to the utility being repositioned
        this.appState.repositioningUtility = utility;
        
        // Hide the original utility line temporarily
        this.hideUtilityLine(utility);
        
        // Create control points at vertices of the utility line
        this.createControlPoints(utility);
        
        // Show the preview line
        this.createUtilityLinePreview(utility);
        
        // Show the repositioning panel
        this.uiController.showRepositionPanel();
        
        // Show instructions
        this.uiController.showStatusBar('Drag the blue points to reposition the utility line. Click Save when done.');
    }

    createControlPoints(utility) {
        // Clear any existing control points
        this.clearControlPoints();
        
        // Get coordinates - handle both coordinates and points properties
        const coordinates = utility.coordinates || utility.points || [];
        
        // Create a control point for each vertex
        this.appState.controlPoints = coordinates.map((coord, index) => {
            // Create marker for this point
            const marker = L.marker(coord, {
                icon: L.divIcon({
                    className: 'edit-control-point',
                    iconSize: [16, 16]
                }),
                draggable: true
            }).addTo(this.map);
            
            // Add drag event handlers
            marker.on('drag', () => {
                // Update the preview line during dragging
                this.updateUtilityLinePreview();
            });
            
            // Create a label for this point
            const label = L.marker(coord, {
                icon: L.divIcon({
                    className: 'control-point-label',
                    html: `${index+1}`,
                    iconSize: [20, 20]
                })
            }).addTo(this.map);
            
            // Update label position when marker is dragged
            marker.on('drag', (e) => {
                label.setLatLng(e.latlng);
            });
            
            return { marker, label, originalPos: L.latLng(coord) };
        });
    }

    createUtilityLinePreview(utility) {
        // Get current control point positions
        const positions = this.appState.controlPoints.map(cp => cp.marker.getLatLng());
        
        // Create a preview line
        this.previewLine = L.polyline(positions, {
            color: this.getUtilityColor(utility.type),
            weight: utility.lineType === 'main' ? 6 : 4,
            opacity: 0.8,
            dashArray: utility.lineType === 'service' ? '5, 5' : null,
            className: `utility-line ${utility.type}`
        }).addTo(this.map);
    }

    updateUtilityLinePreview() {
        if (!this.previewLine || !this.appState.controlPoints) return;
        
        // Get updated positions
        const positions = this.appState.controlPoints.map(cp => cp.marker.getLatLng());
        
        // Update the preview line
        this.previewLine.setLatLngs(positions);
    }

    hideUtilityLine(utility) {
        // Find and hide the utility line on the map
        this.utilityLayers[utility.type].eachLayer(layer => {
            if (layer.utilityId === utility.id) {
                layer.setStyle({ opacity: 0.2 }); // Make it faint but still visible
            }
        });
    }

    showUtilityLine(utility) {
        // Find and show the utility line on the map
        this.utilityLayers[utility.type].eachLayer(layer => {
            if (layer.utilityId === utility.id) {
                layer.setStyle({ opacity: 0.8 }); // Restore normal opacity
            }
        });
    }

    saveRepositionedUtility() {
        const utility = this.appState.repositioningUtility;
        if (!utility) return;
        
        // Get updated coordinates
        const newCoordinates = this.appState.controlPoints.map(cp => cp.marker.getLatLng());
        
        // Update utility coordinates
        utility.coordinates = newCoordinates;
        
        // Remove the original utility line
        this.utilityLayers[utility.type].eachLayer(layer => {
            if (layer.utilityId === utility.id) {
                this.utilityLayers[utility.type].removeLayer(layer);
            }
        });
        
        // Add the updated line
        this.renderUtility(utility);
        
        // Save changes to data store
        this.dataStore.saveData();
        
        // Show success message
        this.uiController.showToast('Utility repositioned successfully', 'success');
        
        // Cleanup
        this.disableRepositioning();
    }

    disableRepositioning(save = false) {
        // Save changes if requested
        if (save && this.appState.repositioningUtility) {
            this.saveRepositionedUtility();
        } else if (this.appState.repositioningUtility) {
            // Show the original utility line again
            this.showUtilityLine(this.appState.repositioningUtility);
        }
        
        // Clear control points
        this.clearControlPoints();
        
        // Remove preview line
        if (this.previewLine) {
            this.map.removeLayer(this.previewLine);
            this.previewLine = null;
        }
        
        // Reset state
        this.appState.repositioningUtility = null;
        
        // Hide UI elements
        this.uiController.hideRepositionPanel();
        this.uiController.hideStatusBar();
    }

    clearControlPoints() {
        // Remove all control points from the map
        if (this.appState.controlPoints) {
            this.appState.controlPoints.forEach(cp => {
                if (cp.marker) this.map.removeLayer(cp.marker);
                if (cp.label) this.map.removeLayer(cp.label);
            });
        }
        
        // Clear the array
        this.appState.controlPoints = [];
    }

    removeUtilityFromMap(utility) {
        // Find and remove the utility from its layer
        this.utilityLayers[utility.type].eachLayer(layer => {
            if (layer.utilityId === utility.id) {
                this.utilityLayers[utility.type].removeLayer(layer);
            }
        });
    }

    /**
     * Start watching the user's position
     */
    startWatchingPosition() {
        if (this.watchPositionId) return; // Already watching
        
        // Store initial heading and last heading source
        this.currentHeading = 0;
        this.lastHeadingSource = null;
        this.lastHeadingTime = 0;
        
        if (navigator.geolocation) {
            // Set options for geolocation
            const options = {
                enableHighAccuracy: this.appState.isExcavationMode, // High accuracy in excavation mode
                timeout: 10000,
                maximumAge: 0
            };
            
            this.watchPositionId = navigator.geolocation.watchPosition(
                // Success callback
                (position) => {
                    // Update marker position
                    this.updateLocationMarker(position);
                                
                    // Update heading indicator if available from GPS
                    // Only use GPS heading if we don't have a recent compass reading
                    const now = Date.now();
                    const compassAge = now - this.lastHeadingTime;
                    
                    if (position.coords.heading !== null && position.coords.heading !== undefined) {
                        // Prefer compass heading over GPS heading, but use GPS if compass is stale
                        if (this.lastHeadingSource !== 'compass' || compassAge > 2000) {
                            this.processHeading(position.coords.heading, 'gps');
                        }
                    }
                    
                    // Center map on user if following
                    if (this.followUser && this.userLocationMarker) {
                        this.map.setView(this.userLocationMarker.getLatLng());
                    }
                    
                    // Check proximity if in excavation mode
                    if (this.appState.isExcavationMode) {
                        this.checkProximityAlerts();
                    }
                },
                // Error callback
                (error) => {
                    console.error('Error watching position:', error);
                },
                // Options
                options
            );
        }
    }
    
    /**
     * Stop watching user position and clean up resources
     */
    stopWatchingPosition() {
        if (this.watchPositionId) {
            navigator.geolocation.clearWatch(this.watchPositionId);
            this.watchPositionId = null;
        }
        
        // Remove orientation listener if added
        if (this.orientationHandler && this.isOrientationActive) {
            window.removeEventListener('deviceorientation', this.orientationHandler);
            this.isOrientationActive = false;
        }
        
        // Remove signal strength indicator
        if (this.signalStrengthIndicator) {
            this.map.getContainer().removeChild(this.signalStrengthIndicator);
            this.signalStrengthIndicator = null;
        }
    }

    /**
     * Add a signal strength indicator to the map
     */
    addSignalStrengthIndicator() {
        try {
            // Remove existing indicator if any
            if (this.signalStrengthIndicator) {
                if (this.map && this.map.getContainer()) {
                    this.map.getContainer().removeChild(this.signalStrengthIndicator);
                }
                this.signalStrengthIndicator = null;
            }
            
            // Create indicator element
            const indicator = document.createElement('div');
            indicator.className = 'signal-strength-indicator';
            indicator.innerHTML = `
                <div class="signal-strength-bars">
                    <div class="signal-bar"></div>
                    <div class="signal-bar"></div>
                    <div class="signal-bar"></div>
                    <div class="signal-bar"></div>
                </div>
                <span class="signal-text">GPS: Waiting...</span>
            `;
            
            // Make sure map container exists
            if (this.map && this.map.getContainer()) {
                // Add to map
                this.map.getContainer().appendChild(indicator);
                
                // Store reference
                this.signalStrengthIndicator = indicator;
            }
        } catch (error) {
            console.error('Error adding signal strength indicator:', error);
        }
    }
    
    /**
     * Update the signal strength indicator
     * @param {number} accuracy The accuracy in meters
     */
    updateSignalStrengthIndicator(accuracy) {
        try {
            if (!this.signalStrengthIndicator || !this.map || !this.map.getContainer()) {
                // If indicator doesn't exist, try to create it
                this.addSignalStrengthIndicator();
                if (!this.signalStrengthIndicator) return;
            }
            
            // Calculate update rate
            const now = Date.now();
            this.updateCountInLastSecond++;
            
            if (now - this.lastUpdateTime >= 1000) {
                this.updateSignalRate = this.updateCountInLastSecond;
                this.updateCountInLastSecond = 0;
                this.lastUpdateTime = now;
            }
            
            // Determine bars to show based on accuracy
            let bars = 0;
            let text = '';
            
            if (accuracy < 5) {
                bars = 4;
                text = 'GPS: Excellent';
            } else if (accuracy < 10) {
                bars = 3;
                text = 'GPS: Good';
            } else if (accuracy < 20) {
                bars = 2;
                text = 'GPS: Fair';
            } else if (accuracy < 35) {
                bars = 1;
                text = 'GPS: Poor';
            } else {
                bars = 0;
                text = 'GPS: Weak';
            }
            
            // Add update rate
            text += ` (${this.updateSignalRate}/s)`;
            
            // Update UI
            const barElements = this.signalStrengthIndicator.querySelectorAll('.signal-bar');
            barElements.forEach((bar, index) => {
                if (index < bars) {
                    bar.classList.add('active');
                } else {
                    bar.classList.remove('active');
                }
            });
            
            // Update text
            const textElement = this.signalStrengthIndicator.querySelector('.signal-text');
            if (textElement) {
                textElement.textContent = text;
            }
        } catch (error) {
            console.error('Error updating signal strength indicator:', error);
        }
    }
} 