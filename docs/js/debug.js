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
        }
    };
})(); 