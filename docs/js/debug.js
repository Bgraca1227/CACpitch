/**
 * Debug Script for CAC UtiliTrack
 * This script helps diagnose loading issues with the application
 */

// Run this immediately on load
(function() {
    console.log('=== CAC UtiliTrack Debug Script Loaded ===');
    
    // Check if Leaflet is available
    if (window.L) {
        console.log('✅ Leaflet library is loaded:', window.L.version);
    } else {
        console.error('❌ Leaflet library is not available!');
    }
    
    // DOM content loaded event
    document.addEventListener('DOMContentLoaded', function() {
        console.log('✅ DOM content loaded event fired');
        
        // Check if critical DOM elements exist
        const criticalElements = [
            'map',
            'splash-screen',
            'app-header',
            'utility-toolbar',
            'map-controls',  // This may be a class not an ID
            'add-utility-modal',
            'add-structure-modal'
        ];
        
        criticalElements.forEach(id => {
            let element = document.getElementById(id);
            
            // Special case for map-controls which might be a class instead of ID
            if (!element && id === 'map-controls') {
                element = document.querySelector('.map-controls');
                if (element) {
                    console.log(`✅ Element found by class: .${id}`);
                    return;
                }
            }
            
            if (element) {
                console.log(`✅ Element found: #${id}`);
            } else {
                console.error(`❌ Critical element missing: #${id}`);
            }
        });
    });
    
    // Check for module loading issues
    window.addEventListener('error', function(event) {
        console.error('❌ Error detected:', event.message);
        console.error('  At:', event.filename, 'line', event.lineno, 'col', event.colno);
        console.error('  Stack:', event.error?.stack);
    });
    
    // Add manual debugging function
    window.debugCACUtils = {
        checkImports: function() {
            console.log('=== Import Checks ===');
            try {
                console.log('Attempting to load AppState...');
                import('./models/AppState.js').then(
                    module => console.log('✅ AppState module loaded successfully'),
                    error => console.error('❌ Failed to load AppState:', error)
                );
                
                console.log('Attempting to load DataStore...');
                import('./models/DataStore.js').then(
                    module => console.log('✅ DataStore module loaded successfully'),
                    error => console.error('❌ Failed to load DataStore:', error)
                );
                
                console.log('Attempting to load MapController...');
                import('./controllers/MapController.js').then(
                    module => console.log('✅ MapController module loaded successfully'),
                    error => console.error('❌ Failed to load MapController:', error)
                );
                
                console.log('Attempting to load UIController...');
                import('./controllers/UIController.js').then(
                    module => console.log('✅ UIController module loaded successfully'),
                    error => console.error('❌ Failed to load UIController:', error)
                );
                
                console.log('Attempting to load EventHandlers...');
                import('./controllers/EventHandlers.js').then(
                    module => console.log('✅ EventHandlers module loaded successfully'),
                    error => console.error('❌ Failed to load EventHandlers:', error)
                );
            } catch (e) {
                console.error('❌ General import checking error:', e);
            }
        },
        
        checkMapContainer: function() {
            const mapContainer = document.getElementById('map');
            if (!mapContainer) {
                console.error('❌ Map container element not found!');
                return;
            }
            
            console.log('Map container dimensions:', {
                width: mapContainer.clientWidth,
                height: mapContainer.clientHeight,
                style: window.getComputedStyle(mapContainer)
            });
        },
        
        checkGlobalObjects: function() {
            console.log('=== Global Object Checks ===');
            console.log('appState available:', !!window.appState);
            console.log('dataStore available:', !!window.dataStore);
            console.log('mapController available:', !!window.mapController);
            console.log('uiController available:', !!window.uiController);
            console.log('eventHandlers available:', !!window.eventHandlers);
            
            // Add a way to manually initialize global objects if they're missing
            if (!window.appState || !window.dataStore || !window.mapController || 
                !window.uiController || !window.eventHandlers) {
                console.log('Some global objects are missing. Use debugCACUtils.forceInitGlobals() to attempt recovery');
            }
        },
        
        forceInitGlobals: function() {
            console.log('Attempting to manually initialize global objects...');
            
            try {
                // Try to import and initialize all modules
                Promise.all([
                    import('./models/AppState.js'),
                    import('./models/DataStore.js'),
                    import('./controllers/MapController.js'), 
                    import('./controllers/UIController.js'),
                    import('./controllers/EventHandlers.js')
                ]).then(modules => {
                    const [AppStateModule, DataStoreModule, MapControllerModule, UIControllerModule, EventHandlersModule] = modules;
                    
                    // Create instances if they don't exist
                    if (!window.appState) window.appState = new AppStateModule.AppState();
                    if (!window.dataStore) window.dataStore = new DataStoreModule.DataStore();
                    if (!window.mapController) window.mapController = new MapControllerModule.MapController(window.appState, window.dataStore);
                    if (!window.uiController) window.uiController = new UIControllerModule.UIController(window.appState, window.dataStore, window.mapController);
                    if (!window.eventHandlers) window.eventHandlers = new EventHandlersModule.EventHandlers(window.appState, window.dataStore, window.mapController, window.uiController);
                    
                    console.log('Global objects initialized manually. Check their status with debugCACUtils.checkGlobalObjects()');
                }).catch(error => {
                    console.error('Failed to initialize globals:', error);
                });
            } catch (e) {
                console.error('Manual initialization failed:', e);
            }
        },
        
        // New function for diagnosing and fixing map issues
        fixMapIssues: function() {
            console.log('=== Diagnosing and fixing map issues ===');
            
            const mapContainer = document.getElementById('map');
            if (!mapContainer) {
                console.error('❌ Map container missing - creating one now...');
                
                // Create map container if missing
                const container = document.createElement('div');
                container.id = 'map';
                container.style.width = '100%';
                container.style.height = '100%';
                container.style.zIndex = '1';
                
                // Find map-container and append to it
                const mapContainerEl = document.querySelector('.map-container');
                if (mapContainerEl) {
                    mapContainerEl.appendChild(container);
                    console.log('✅ Created new map container element');
                } else {
                    document.body.appendChild(container);
                    console.log('⚠️ Created map container but had to append to body - layout may be incorrect');
                }
            }
            
            // Check if Leaflet map is properly initialized
            if (!window.mapController || !window.mapController.map) {
                console.error('❌ MapController or map instance missing - attempting to recreate');
                
                // Make sure Leaflet is loaded
                if (!window.L) {
                    console.error('❌ Leaflet not loaded - cannot fix map');
                    this.loadLeaflet();
                    return;
                }
                
                try {
                    // If mapController exists but map doesn't, try reinitializing
                    if (window.mapController && typeof window.mapController.initMap === 'function') {
                        console.log('Attempting to reinitialize map using mapController.initMap()');
                        window.mapController.initMap();
                        
                        // Check if map was created
                        if (window.mapController.map) {
                            console.log('✅ Map reinitialized successfully');
                            return;
                        }
                    }
                    
                    // If that fails, create a basic map instance as fallback
                    console.log('Creating fallback map instance');
                    const fallbackMap = L.map('map', {
                        center: [40.7128, -74.0060], // New York as default
                        zoom: 13,
                        zoomControl: false // We have custom zoom controls
                    });
                    
                    // Add base tile layer
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    }).addTo(fallbackMap);
                    
                    // If mapController exists, attach this map
                    if (window.mapController) {
                        window.mapController.map = fallbackMap;
                        console.log('✅ Attached fallback map to existing mapController');
                        
                        // Create basic utility layers as needed
                        if (!window.mapController.utilityLayers) {
                            window.mapController.utilityLayers = {
                                water: L.layerGroup().addTo(fallbackMap),
                                gas: L.layerGroup().addTo(fallbackMap),
                                electric: L.layerGroup().addTo(fallbackMap),
                                sewer: L.layerGroup().addTo(fallbackMap),
                                telecom: L.layerGroup().addTo(fallbackMap)
                            };
                        }
                    } else {
                        console.log('⚠️ Created fallback map but mapController is missing');
                        window.fallbackMap = fallbackMap; // Save reference
                    }
                } catch (e) {
                    console.error('Failed to create fallback map:', e);
                }
            } else {
                console.log('✅ Map instance exists and appears valid');
                
                // Force map to refresh its container dimensions - fixes many common issues
                window.mapController.map.invalidateSize();
                console.log('Forced map to refresh its container size');
            }
        },
        
        // Dynamically load Leaflet if missing
        loadLeaflet: function() {
            if (window.L) {
                console.log('✅ Leaflet already loaded');
                return;
            }
            
            console.log('Attempting to load Leaflet dynamically...');
            
            // Create and load CSS
            const leafletCSS = document.createElement('link');
            leafletCSS.rel = 'stylesheet';
            leafletCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
            document.head.appendChild(leafletCSS);
            
            // Create and load JS
            const leafletScript = document.createElement('script');
            leafletScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
            leafletScript.onload = () => {
                console.log('✅ Leaflet loaded dynamically');
                console.log('Run debugCACUtils.fixMapIssues() to complete map initialization');
            };
            leafletScript.onerror = (error) => {
                console.error('❌ Failed to load Leaflet:', error);
            };
            document.body.appendChild(leafletScript);
        },
        
        // Check if key components are available
        checkImports: function() {
            console.log('Checking imports and component availability:');
            
            // Check external libraries
            console.log('- Leaflet:', typeof L !== 'undefined' ? '✅ Available' : '❌ Missing');
            
            // Check app components
            console.log('- AppState:', typeof window.appState !== 'undefined' ? '✅ Available' : '❌ Missing');
            console.log('- DataStore:', typeof window.dataStore !== 'undefined' ? '✅ Available' : '❌ Missing');
            console.log('- MapController:', typeof window.mapController !== 'undefined' ? '✅ Available' : '❌ Missing');
            console.log('- UIController:', typeof window.uiController !== 'undefined' ? '✅ Available' : '❌ Missing');
            console.log('- EventHandlers:', typeof window.eventHandlers !== 'undefined' ? '✅ Available' : '❌ Missing');
            
            // Check for map initialization
            if (typeof window.mapController !== 'undefined') {
                console.log('- Map instance:', window.mapController.map ? '✅ Initialized' : '❌ Not initialized');
            }
            
            return this.getComponentStatus();
        },
        
        // Get component status
        getComponentStatus: function() {
            return {
                leaflet: typeof L !== 'undefined',
                appState: typeof window.appState !== 'undefined',
                dataStore: typeof window.dataStore !== 'undefined',
                mapController: typeof window.mapController !== 'undefined',
                uiController: typeof window.uiController !== 'undefined',
                eventHandlers: typeof window.eventHandlers !== 'undefined',
                mapInitialized: typeof window.mapController !== 'undefined' && !!window.mapController.map
            };
        },
        
        // Check measurement functionality
        checkMeasurementFeature: function() {
            console.log('Checking measurement functionality:');
            
            // Check if required components exist
            if (!window.appState) {
                console.log('❌ AppState missing, measurement cannot function');
                return false;
            }
            
            if (!window.mapController || !window.mapController.map) {
                console.log('❌ MapController or map missing, measurement cannot function');
                return false;
            }
            
            // Check for measurement methods
            const hasMeasureMethods = 
                typeof window.mapController.startMeasurement === 'function' &&
                typeof window.mapController.addMeasurementLine === 'function';
            
            console.log('- Measurement methods:', hasMeasureMethods ? '✅ Available' : '❌ Missing');
            
            // Check for UI elements
            const measureBtn = document.getElementById('measure-btn');
            const toolbar = document.getElementById('measurement-toolbar');
            
            console.log('- Measure button:', measureBtn ? '✅ Found' : '❌ Missing');
            console.log('- Measurement toolbar:', toolbar ? '✅ Found' : '❌ Missing');
            
            // Try to fix if issues found
            if (!hasMeasureMethods || !measureBtn || !toolbar) {
                console.log('Issues found with measurement feature, attempting to fix...');
                
                // Add emergency event handler to measure button if it exists
                if (measureBtn) {
                    measureBtn.addEventListener('click', function() {
                        if (window.appState) {
                            window.appState.isMeasuring = !window.appState.isMeasuring;
                            
                            if (window.appState.isMeasuring) {
                                // Enter measurement mode
                                this.classList.add('active');
                                if (toolbar) toolbar.classList.add('visible');
                                document.body.style.cursor = 'crosshair';
                            } else {
                                // Exit measurement mode
                                this.classList.remove('active');
                                if (toolbar) toolbar.classList.remove('visible');
                                document.body.style.cursor = '';
                            }
                        }
                    });
                }
                
                console.log('Applied emergency fixes to measurement feature');
            }
            
            return hasMeasureMethods && measureBtn && toolbar;
        },
        
        // Check excavation mode functionality
        checkExcavationFeature: function() {
            console.log('Checking excavation mode functionality:');
            
            // Check if required components exist
            if (!window.appState) {
                console.log('❌ AppState missing, excavation mode cannot function');
                return false;
            }
            
            if (!window.mapController || !window.mapController.map) {
                console.log('❌ MapController or map missing, excavation mode cannot function');
                return false;
            }
            
            // Check for excavation methods
            const hasExcavationMethods = 
                typeof window.mapController.enableExcavationMode === 'function' &&
                typeof window.mapController.disableExcavationMode === 'function';
            
            console.log('- Excavation methods:', hasExcavationMethods ? '✅ Available' : '❌ Missing');
            
            // Check for UI elements
            const excavationBtn = document.querySelector('.mode-button[data-mode="excavation"]');
            const exitBtn = document.getElementById('exit-excavation-btn');
            const indicator = document.getElementById('excavation-indicator');
            const confirmDialog = document.getElementById('exit-excavation-modal');
            
            console.log('- Excavation button:', excavationBtn ? '✅ Found' : '❌ Missing');
            console.log('- Exit button:', exitBtn ? '✅ Found' : '❌ Missing');
            console.log('- Excavation indicator:', indicator ? '✅ Found' : '❌ Missing');
            console.log('- Confirmation dialog:', confirmDialog ? '✅ Found' : '❌ Missing');
            
            // Try to fix if issues found
            if (!hasExcavationMethods || !excavationBtn || !exitBtn || !indicator || !confirmDialog) {
                console.log('Issues found with excavation feature, attempting to fix...');
                
                // Set up minimal methods if needed
                if (window.mapController && !window.mapController.enableExcavationMode) {
                    window.mapController.enableExcavationMode = function() {
                        window.appState.isExcavationMode = true;
                        document.getElementById('excavation-indicator')?.classList.add('visible');
                        document.getElementById('exit-excavation-btn')?.classList.add('visible');
                    };
                }
                
                if (window.mapController && !window.mapController.disableExcavationMode) {
                    window.mapController.disableExcavationMode = function() {
                        window.appState.isExcavationMode = false;
                        document.getElementById('excavation-indicator')?.classList.remove('visible');
                        document.getElementById('exit-excavation-btn')?.classList.remove('visible');
                    };
                }
                
                console.log('Applied emergency fixes to excavation mode feature');
            }
            
            return hasExcavationMethods && excavationBtn && exitBtn && indicator && confirmDialog;
        },
        
        // Fix feature connections
        fixFeatureConnections: function() {
            // This method should be called by the debug panel to try to repair features
            console.log('Attempting to repair feature connections...');
            
            // Check and fix measurement feature
            this.checkMeasurementFeature();
            
            // Check and fix excavation feature
            this.checkExcavationFeature();
            
            // Try to force reconnection between components
            if (window.appState && window.mapController && window.uiController && window.eventHandlers) {
                window.mapController.appState = window.appState;
                window.mapController.uiController = window.uiController;
                window.mapController.eventHandlers = window.eventHandlers;
                
                window.uiController.appState = window.appState;
                window.uiController.mapController = window.mapController;
                window.uiController.eventHandlers = window.eventHandlers;
                
                window.eventHandlers.appState = window.appState;
                window.eventHandlers.mapController = window.mapController;
                window.eventHandlers.uiController = window.uiController;
                
                console.log('Component connections repaired');
                return true;
            }
            
            return false;
        },
        
        lastErrors: [],
        lastWarnings: [],
        
        // Log an error and store it
        logError: function(message, details) {
            const error = { message, details, time: new Date().toISOString() };
            console.error(message, details);
            this.lastErrors.push(error);
            if (this.lastErrors.length > 20) this.lastErrors.shift();
            return error;
        },
        
        // Log a warning and store it
        logWarning: function(message, details) {
            const warning = { message, details, time: new Date().toISOString() };
            console.warn(message, details);
            this.lastWarnings.push(warning);
            if (this.lastWarnings.length > 20) this.lastWarnings.shift();
            return warning;
        },
        
        // Test component imports
        checkImports: function() {
            console.log('Checking imports...');
            
            const components = [
                { name: 'AppState', status: false },
                { name: 'DataStore', status: false },
                { name: 'MapController', status: false },
                { name: 'UIController', status: false },
                { name: 'EventHandlers', status: false }
            ];
            
            // Check global components
            components.forEach(comp => {
                comp.status = window[comp.name.toLowerCase()] !== undefined;
                console.log(`${comp.name}: ${comp.status ? '✅ Available' : '❌ Missing'}`);
            });
            
            return components;
        },
        
        // Create a debug overlay panel for location and heading
        showLocationDebug: function() {
            // Create or get debug panel
            let debugPanel = document.getElementById('location-debug-panel');
            if (!debugPanel) {
                debugPanel = document.createElement('div');
                debugPanel.id = 'location-debug-panel';
                debugPanel.style.position = 'fixed';
                debugPanel.style.bottom = '120px';
                debugPanel.style.right = '10px';
                debugPanel.style.backgroundColor = 'rgba(0,0,0,0.7)';
                debugPanel.style.color = 'white';
                debugPanel.style.padding = '10px';
                debugPanel.style.borderRadius = '5px';
                debugPanel.style.fontSize = '12px';
                debugPanel.style.fontFamily = 'monospace';
                debugPanel.style.zIndex = '9999';
                debugPanel.style.maxWidth = '300px';
                
                // Add content container
                const content = document.createElement('div');
                content.id = 'location-debug-content';
                debugPanel.appendChild(content);
                
                // Add buttons
                const btnContainer = document.createElement('div');
                btnContainer.style.marginTop = '10px';
                btnContainer.style.display = 'flex';
                btnContainer.style.gap = '5px';
                
                // Create buttons
                const refreshBtn = document.createElement('button');
                refreshBtn.textContent = 'Refresh';
                refreshBtn.style.padding = '3px 8px';
                refreshBtn.style.fontSize = '11px';
                refreshBtn.style.backgroundColor = '#555';
                refreshBtn.style.color = 'white';
                refreshBtn.style.border = 'none';
                refreshBtn.style.borderRadius = '3px';
                refreshBtn.onclick = () => this.updateLocationDebug();
                
                const closeBtn = document.createElement('button');
                closeBtn.textContent = 'Close';
                closeBtn.style.padding = '3px 8px';
                closeBtn.style.fontSize = '11px';
                closeBtn.style.backgroundColor = '#555';
                closeBtn.style.color = 'white';
                closeBtn.style.border = 'none';
                closeBtn.style.borderRadius = '3px';
                closeBtn.onclick = () => debugPanel.style.display = 'none';
                
                const fixBtn = document.createElement('button');
                fixBtn.textContent = 'Fix Heading';
                fixBtn.style.padding = '3px 8px';
                fixBtn.style.fontSize = '11px';
                fixBtn.style.backgroundColor = '#007BFF';
                fixBtn.style.color = 'white';
                fixBtn.style.border = 'none';
                fixBtn.style.borderRadius = '3px';
                fixBtn.onclick = () => this.fixHeadingIssue();
                
                // Add buttons to container
                btnContainer.appendChild(refreshBtn);
                btnContainer.appendChild(fixBtn);
                btnContainer.appendChild(closeBtn);
                
                // Add button container to panel
                debugPanel.appendChild(btnContainer);
                
                // Add to document
                document.body.appendChild(debugPanel);
            } else {
                debugPanel.style.display = 'block';
            }
            
            // Initial update
            this.updateLocationDebug();
            
            // Set interval to update regularly
            if (this._locationDebugInterval) {
                clearInterval(this._locationDebugInterval);
            }
            this._locationDebugInterval = setInterval(() => this.updateLocationDebug(), 1000);
            
            return debugPanel;
        },
        
        // Update location debug panel content
        updateLocationDebug: function() {
            const content = document.getElementById('location-debug-content');
            if (!content) return;
            
            // Get current state
            const data = {
                userLocation: window.appState?.userLocation || 'Not available',
                currentHeading: window.mapController?.currentHeading || 'Not available',
                locationMarker: !!window.mapController?.userLocationMarker,
                headingElement: false,
                filter: {
                    positions: window.mapController?.locationFilter?.positions?.length || 0,
                    headings: window.mapController?.locationFilter?.headings?.length || 0
                },
                watchActive: !!window.appState?.highAccuracyWatchId,
                isExcavationMode: window.appState?.isExcavationMode || false,
                lastUpdate: window.appState?.lastLocationUpdate ? 
                    `${Math.floor((Date.now() - window.appState.lastLocationUpdate) / 1000)}s ago` : 
                    'Never'
            };
            
            // Check heading element
            if (data.locationMarker) {
                const marker = window.mapController.userLocationMarker;
                const element = marker.getElement();
                if (element) {
                    const headingEl = element.querySelector('.location-heading');
                    data.headingElement = !!headingEl;
                    if (headingEl) {
                        data.headingStyle = {
                            transform: headingEl.style.transform,
                            opacity: headingEl.style.opacity,
                            visible: getComputedStyle(headingEl).visibility !== 'hidden'
                        };
                    }
                }
            }
            
            // Format HTML
            let html = `<div style="font-weight:bold;margin-bottom:5px;">Location Debug</div>`;
            
            if (typeof data.userLocation === 'object') {
                html += `<div>Lat: ${data.userLocation.lat?.toFixed(6) || 'N/A'}</div>`;
                html += `<div>Lng: ${data.userLocation.lng?.toFixed(6) || 'N/A'}</div>`;
                html += `<div>Accuracy: ${data.userLocation.accuracy?.toFixed(1) || 'N/A'}m</div>`;
            } else {
                html += `<div style="color:#ff6b6b;">User location not available</div>`;
            }
            
            html += `<div>Heading: ${typeof data.currentHeading === 'number' ? 
                data.currentHeading.toFixed(1) + '°' : 
                `<span style="color:#ff6b6b;">${data.currentHeading}</span>`}</div>`;
            
            html += `<div>Marker: ${data.locationMarker ? 
                `<span style="color:#a3ff8c;">✓</span>` : 
                `<span style="color:#ff6b6b;">✗</span>`}</div>`;
            
            html += `<div>Heading Element: ${data.headingElement ? 
                `<span style="color:#a3ff8c;">✓</span>` : 
                `<span style="color:#ff6b6b;">✗</span>`}</div>`;
            
            if (data.headingStyle) {
                html += `<div>Transform: ${data.headingStyle.transform}</div>`;
                html += `<div>Opacity: ${data.headingStyle.opacity}</div>`;
                html += `<div>Visible: ${data.headingStyle.visible ? '✓' : '✗'}</div>`;
            }
            
            html += `<div>Filter Positions: ${data.filter.positions}</div>`;
            html += `<div>Filter Headings: ${data.filter.headings}</div>`;
            html += `<div>Watch Active: ${data.watchActive ? 
                `<span style="color:#a3ff8c;">✓</span>` : 
                `<span style="color:#ff6b6b;">✗</span>`}</div>`;
            html += `<div>Excavation Mode: ${data.isExcavationMode ? 
                `<span style="color:#a3ff8c;">✓</span>` : 
                `<span style="color:#ff6b6b;">✗</span>`}</div>`;
            html += `<div>Last Update: ${data.lastUpdate}</div>`;
            
            content.innerHTML = html;
        },
        
        // Try to fix heading issues
        fixHeadingIssue: function() {
            if (!window.mapController || !window.mapController.userLocationMarker) {
                console.error('Cannot fix heading: map controller or marker not available');
                return false;
            }
            
            try {
                // Generate a test heading
                const testHeading = 45; // Northeast
                
                // Get marker element
                const marker = window.mapController.userLocationMarker;
                const element = marker.getElement();
                
                if (!element) {
                    console.error('Cannot fix heading: marker element not available');
                    return false;
                }
                
                // Check for heading element
                let headingEl = element.querySelector('.location-heading');
                
                // If heading element doesn't exist, create it
                if (!headingEl) {
                    console.log('Creating missing heading element');
                    headingEl = document.createElement('div');
                    headingEl.className = 'location-heading';
                    element.appendChild(headingEl);
                }
                
                // Apply strong styling
                headingEl.style.position = 'absolute';
                headingEl.style.top = '-20px';
                headingEl.style.left = '50%';
                headingEl.style.width = '0';
                headingEl.style.height = '0';
                headingEl.style.borderLeft = '12px solid transparent';
                headingEl.style.borderRight = '12px solid transparent';
                headingEl.style.borderBottom = '24px solid #2196F3';
                headingEl.style.transformOrigin = 'bottom center';
                headingEl.style.transform = `translateX(-50%) rotate(${testHeading}deg)`;
                headingEl.style.opacity = '1';
                headingEl.style.zIndex = '1001';
                headingEl.style.transition = 'transform 0.3s ease-out';
                
                // Make sure container has the right class
                element.classList.add('with-heading');
                
                console.log('Applied test heading:', testHeading);
                
                // Update controller's current heading
                window.mapController.currentHeading = testHeading;
                
                return true;
            } catch (error) {
                console.error('Error fixing heading:', error);
                return false;
            }
        },
        
        // Add debug button to UI
        addDebugButton: function() {
            // Create button if it doesn't exist
            let debugBtn = document.getElementById('debug-location-btn');
            if (!debugBtn) {
                debugBtn = document.createElement('button');
                debugBtn.id = 'debug-location-btn';
                debugBtn.innerHTML = '<i class="fas fa-bug"></i>';
                debugBtn.style.position = 'fixed';
                debugBtn.style.bottom = '140px';
                debugBtn.style.right = '15px';
                debugBtn.style.width = '48px';
                debugBtn.style.height = '48px';
                debugBtn.style.borderRadius = '50%';
                debugBtn.style.backgroundColor = '#F44336';
                debugBtn.style.color = 'white';
                debugBtn.style.border = 'none';
                debugBtn.style.boxShadow = '0 3px 5px rgba(0,0,0,0.2)';
                debugBtn.style.zIndex = '9999';
                debugBtn.style.fontSize = '18px';
                debugBtn.style.cursor = 'pointer';
                
                // Add click handler
                debugBtn.addEventListener('click', () => this.showLocationDebug());
                
                // Add to document
                document.body.appendChild(debugBtn);
            }
            
            return debugBtn;
        },
        
        // Debug utility specifically for location and heading
        testLocationAndHeading: function() {
            console.log('=== Testing Location and Heading Functionality ===');
            
            // 1. Check for required location-related objects and methods
            const checks = [
                { name: 'appState', obj: window.appState },
                { name: 'mapController', obj: window.mapController },
                { name: 'mapController.locationFilter', obj: window.mapController?.locationFilter },
                { name: 'mapController.userLocationMarker', obj: window.mapController?.userLocationMarker },
                { name: 'mapController.addUserLocationMarker', fn: window.mapController?.addUserLocationMarker },
                { name: 'mapController.updateHeading', fn: window.mapController?.updateHeading },
                { name: 'mapController.handleOrientation', fn: window.mapController?.handleOrientation },
                { name: 'mapController.processHeading', fn: window.mapController?.processHeading },
                { name: 'mapController.startWatchingOrientation', fn: window.mapController?.startWatchingOrientation },
                { name: 'mapController.locationFilter.addHeading', fn: window.mapController?.locationFilter?.addHeading },
                { name: 'mapController.locationFilter.getFilteredHeading', fn: window.mapController?.locationFilter?.getFilteredHeading }
            ];
            
            // Display check results
            let results = '<div style="font-family: monospace; font-size: 12px;">Location System Components:</div>';
            checks.forEach(check => {
                const hasObj = check.obj !== undefined;
                const hasFn = check.fn !== undefined && typeof check.fn === 'function';
                const status = (check.obj && hasObj) || (check.fn && hasFn) ? 
                    '<span style="color: green;">✓</span>' : 
                    '<span style="color: red;">✗</span>';
                
                results += `<div>${status} ${check.name}</div>`;
            });
            
            // 2. Check if geolocation is available in browser
            const geoAvailable = navigator.geolocation !== undefined;
            results += `<div>${geoAvailable ? '<span style="color: green;">✓</span>' : '<span style="color: red;">✗</span>'} Geolocation API</div>`;
            
            // 3. Check device orientation API
            const orientationAvailable = window.DeviceOrientationEvent !== undefined;
            results += `<div>${orientationAvailable ? '<span style="color: green;">✓</span>' : '<span style="color: red;">✗</span>'} DeviceOrientation API</div>`;
            
            // 4. Check motion API
            const motionAvailable = window.DeviceMotionEvent !== undefined;
            results += `<div>${motionAvailable ? '<span style="color: green;">✓</span>' : '<span style="color: red;">✗</span>'} DeviceMotion API</div>`;
            
            // 5. Test the heading update method with sample values
            results += '<div style="margin-top: 10px;"><b>Heading Test Results:</b></div>';
            
            try {
                if (window.mapController && window.mapController.updateHeading) {
                    // Test with cardinal directions
                    const headings = [0, 90, 180, 270];
                    headings.forEach(heading => {
                        window.mapController.updateHeading(heading);
                        results += `<div>Set heading to ${heading}° - current: ${window.mapController.currentHeading}°</div>`;
                    });
                    
                    // Check if the heading is properly stored
                    const finalHeading = window.mapController.currentHeading;
                    results += `<div>Final heading value: ${finalHeading}°</div>`;
                    
                    // Check DOM update
                    if (window.mapController.userLocationMarker) {
                        const markerEl = window.mapController.userLocationMarker.getElement();
                        const headingEl = markerEl?.querySelector('.location-heading');
                        
                        if (headingEl) {
                            const transform = headingEl.style.transform;
                            results += `<div>Heading element transform: ${transform}</div>`;
                        } else {
                            results += `<div style="color: red;">Heading element not found in marker</div>`;
                        }
                    } else {
                        results += `<div style="color: orange;">No user location marker to test heading</div>`;
                    }
                } else {
                    results += `<div style="color: red;">updateHeading method not available for testing</div>`;
                }
            } catch (e) {
                results += `<div style="color: red;">Error testing heading: ${e.message}</div>`;
            }
            
            // 6. Test filtering functionality
            results += '<div style="margin-top: 10px;"><b>Heading Filter Test:</b></div>';
            
            try {
                if (window.mapController?.locationFilter?.addHeading && 
                    window.mapController?.locationFilter?.getFilteredHeading) {
                    
                    // Test with sequence around north (0/360 boundary)
                    const testSequence = [358, 359, 0, 1, 2];
                    window.mapController.locationFilter.headings = []; // Reset
                    
                    let filteredResults = [];
                    testSequence.forEach(heading => {
                        const filtered = window.mapController.locationFilter.addHeading(heading);
                        filteredResults.push(filtered);
                    });
                    
                    results += `<div>Input: [${testSequence.join(', ')}]</div>`;
                    results += `<div>Filtered: [${filteredResults.map(h => h.toFixed(1)).join(', ')}]</div>`;
                    
                    // Check if averaging around 0/360 works properly
                    const lastFiltered = filteredResults[filteredResults.length - 1];
                    results += `<div>${(lastFiltered > 350 || lastFiltered < 10) ? 
                        '<span style="color: green;">✓</span> Filter properly handles 0/360 boundary' : 
                        '<span style="color: red;">✗</span> Filter fails on 0/360 boundary'}</div>`;
                    
                } else {
                    results += `<div style="color: red;">Heading filter methods not available for testing</div>`;
                }
            } catch (e) {
                results += `<div style="color: red;">Error testing heading filter: ${e.message}</div>`;
            }
            
            // 7. Provide actions to fix issues
            results += '<div style="margin-top: 10px;"><b>Fix Actions:</b></div>';
            results += '<div><button id="fix-location-heading-btn" style="padding: 5px; margin: 5px 0; background: #333; color: white; border: none; border-radius: 3px;">Apply Location/Heading Fixes</button></div>';
            
            // Add the results to the debug panel
            const debugContent = document.getElementById('debug-content');
            if (debugContent) {
                debugContent.innerHTML = results;
                
                // Add click handler for the fix button
                setTimeout(() => {
                    document.getElementById('fix-location-heading-btn')?.addEventListener('click', function() {
                        // Apply location and heading fixes
                        if (typeof window.patchCACUtiliTrack === 'function') {
                            const fixes = window.patchCACUtiliTrack();
                            debugContent.innerHTML += `<div style="color: green;">Applied ${fixes} fixes to location/heading system</div>`;
                            
                            // Force a test heading update to verify
                            if (window.mapController && window.mapController.updateHeading) {
                                window.mapController.updateHeading(45);
                                debugContent.innerHTML += `<div>Tested heading with 45° update</div>`;
                            }
                        } else {
                            debugContent.innerHTML += `<div style="color: red;">Patch function not available</div>`;
                        }
                    });
                }, 100);
            }
            
            console.log('Location and heading diagnostics complete');
            return results;
        },
        
        // Add test function to force device orientation permission request on iOS
        requestOrientationPermission: function() {
            console.log('Requesting device orientation permission...');
            
            if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
                // iOS 13+ permission request
                DeviceOrientationEvent.requestPermission()
                    .then(permissionState => {
                        console.log('Orientation permission state:', permissionState);
                        if (permissionState === 'granted') {
                            console.log('Permission granted - device orientation events should work');
                            
                            // Try to setup orientation handling
                            if (window.mapController && window.mapController.addOrientationListener) {
                                window.mapController.addOrientationListener();
                                console.log('Added orientation listener');
                            }
                        } else {
                            console.error('Permission denied for device orientation');
                        }
                    })
                    .catch(error => {
                        console.error('Error requesting orientation permission:', error);
                    });
            } else if (window.DeviceOrientationEvent) {
                console.log('No permission required for device orientation on this browser');
                // Try to setup orientation handling
                if (window.mapController && window.mapController.addOrientationListener) {
                    window.mapController.addOrientationListener();
                    console.log('Added orientation listener');
                }
            } else {
                console.error('Device orientation not supported on this device');
            }
        },
        
        // Test for motion permission
        requestMotionPermission: function() {
            console.log('Requesting device motion permission...');
            
            if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
                // iOS 13+ permission request
                DeviceMotionEvent.requestPermission()
                    .then(permissionState => {
                        console.log('Motion permission state:', permissionState);
                        if (permissionState === 'granted') {
                            console.log('Permission granted - device motion events should work');
                            
                            // Try to setup motion handling
                            if (window.mapController && window.mapController.addMotionListener) {
                                window.mapController.addMotionListener();
                                console.log('Added motion listener');
                            }
                        } else {
                            console.error('Permission denied for device motion');
                        }
                    })
                    .catch(error => {
                        console.error('Error requesting motion permission:', error);
                    });
            } else if (window.DeviceMotionEvent) {
                console.log('No permission required for device motion on this browser');
                // Try to setup motion handling
                if (window.mapController && window.mapController.addMotionListener) {
                    window.mapController.addMotionListener();
                    console.log('Added motion listener');
                }
            } else {
                console.error('Device motion not supported on this device');
            }
        },
        
        // Function to display current heading information
        monitorHeading: function(duration = 30) {
            console.log(`Starting heading monitor for ${duration} seconds...`);
            
            // Create a container for the heading display if needed
            let headingDisplay = document.getElementById('heading-monitor-display');
            if (!headingDisplay) {
                headingDisplay = document.createElement('div');
                headingDisplay.id = 'heading-monitor-display';
                headingDisplay.style.position = 'fixed';
                headingDisplay.style.top = '50px';
                headingDisplay.style.right = '10px';
                headingDisplay.style.background = 'rgba(0,0,0,0.7)';
                headingDisplay.style.color = 'white';
                headingDisplay.style.padding = '10px';
                headingDisplay.style.borderRadius = '5px';
                headingDisplay.style.zIndex = '9999';
                headingDisplay.style.fontFamily = 'monospace';
                headingDisplay.style.fontSize = '12px';
                headingDisplay.style.maxWidth = '200px';
                document.body.appendChild(headingDisplay);
            }
            
            // Initialize data
            let headingData = [];
            const startTime = Date.now();
            const endTime = startTime + (duration * 1000);
            
            // Start monitoring
            const monitorInterval = setInterval(() => {
                // Check if we should stop
                if (Date.now() > endTime) {
                    clearInterval(monitorInterval);
                    headingDisplay.innerHTML += '<div style="color: yellow;">Monitoring complete</div>';
                    return;
                }
                
                // Get current heading
                const currentHeading = window.mapController?.currentHeading || 'N/A';
                const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
                
                // Store data point
                headingData.push({
                    time: elapsedSeconds,
                    heading: currentHeading
                });
                
                // Update display
                headingDisplay.innerHTML = `
                    <div style="font-weight: bold;">Heading Monitor (${elapsedSeconds}s / ${duration}s)</div>
                    <div>Current: ${typeof currentHeading === 'number' ? currentHeading.toFixed(1) : currentHeading}°</div>
                    <div style="height: 60px; margin-top: 5px; position: relative; border-top: 1px solid #666; border-bottom: 1px solid #666;">
                        ${headingData.map(d => {
                            if (typeof d.heading !== 'number') return '';
                            const y = 60 - (d.heading / 360 * 60);
                            return `<div style="position: absolute; left: ${d.time/duration*100}%; top: ${y}px; width: 2px; height: 2px; background: cyan;"></div>`;
                        }).join('')}
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 2px;">
                        <span>0°</span>
                        <span>N</span>
                        <span>E</span>
                        <span>S</span>
                        <span>W</span>
                        <span>360°</span>
                    </div>
                    <div style="margin-top: 5px; font-size: 10px;">
                        ${headingData.slice(-5).map(d => 
                            `${d.time}s: ${typeof d.heading === 'number' ? d.heading.toFixed(1) : d.heading}°`
                        ).join('<br>')}
                    </div>
                `;
            }, 500);
            
            return "Heading monitor started";
        }
    };
})();

// Add test location button to debug panel buttons
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) {
            const buttonContainer = debugPanel.querySelector('div[style*="margin-top"]');
            if (buttonContainer) {
                // Add location test button
                const locationBtn = document.createElement('button');
                locationBtn.className = 'debug-btn';
                locationBtn.setAttribute('data-action', 'test-location');
                locationBtn.style.padding = '3px 6px';
                locationBtn.style.background = '#333';
                locationBtn.style.color = 'white';
                locationBtn.style.border = '1px solid #666';
                locationBtn.style.borderRadius = '3px';
                locationBtn.style.fontSize = '10px';
                locationBtn.textContent = 'Test Location/Heading';
                buttonContainer.appendChild(locationBtn);
                
                // Add listener
                locationBtn.addEventListener('click', function() {
                    window.debugCACUtils.testLocationAndHeading();
                });
                
                // Add monitor heading button
                const monitorBtn = document.createElement('button');
                monitorBtn.className = 'debug-btn';
                monitorBtn.setAttribute('data-action', 'monitor-heading');
                monitorBtn.style.padding = '3px 6px';
                monitorBtn.style.background = '#333';
                monitorBtn.style.color = 'white';
                monitorBtn.style.border = '1px solid #666';
                monitorBtn.style.borderRadius = '3px';
                monitorBtn.style.fontSize = '10px';
                monitorBtn.textContent = 'Monitor Heading';
                buttonContainer.appendChild(monitorBtn);
                
                // Add listener
                monitorBtn.addEventListener('click', function() {
                    window.debugCACUtils.monitorHeading(30);
                });
            }
        }
    }, 2000); // Wait for debug panel creation
}); 