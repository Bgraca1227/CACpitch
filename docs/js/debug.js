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
        }
    };
})(); 