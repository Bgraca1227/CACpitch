/**
 * CAC UtiliTrack - Automatic Fix Script
 * 
 * This script addresses common issues with the UtiliTrack application:
 * - Module loading errors
 * - Component initialization failures
 * - Cross-component references
 * - Map initialization issues
 * - Event handling conflicts
 * - Data persistence problems
 */

console.log('=== CacUtiliTrack Fix Script ===');

// Create global recovery object
window.CAC_Recovery = {
    attempts: 0,
    maxAttempts: 3,
    errors: []
};

// Monitor for errors
window.addEventListener('error', function(event) {
    console.error('Error detected:', event.message);
    window.CAC_Recovery.errors.push({
        message: event.message,
        file: event.filename,
        line: event.lineno,
        stack: event.error?.stack || 'No stack trace',
        time: new Date().toISOString()
    });
});

// Wait for page to load
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, running checks...');
    
    // Check critical DOM elements
    checkDomElements();
    
    // Ensure Leaflet is loaded
    checkLeaflet();
    
    // Fix module loading issues
    fixModuleLoading();
    
    // Setup fallback initialization
    setupFallbackInit();
    
    // Add extra element monitoring
    monitorCriticalElements();
});

// Check if Leaflet library is properly loaded
function checkLeaflet() {
    if (!window.L) {
        console.error('CRITICAL: Leaflet library not loaded!');
        
        // Attempt to load Leaflet dynamically
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        script.integrity = 'sha512-XQoYMqMTK8LvdxXYG3nZ448hOEQiglfqkJs1NOQV44cWnUrBc8PkAOcXy20w0vlaXaVUearIOBhiXZ5V3ynxwA==';
        script.crossOrigin = 'anonymous';
        script.onload = function() {
            console.log('Leaflet loaded dynamically!');
            
            // Also load the CSS
            if (!document.querySelector('link[href*="leaflet.css"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
                document.head.appendChild(link);
            }
            
            // Attempt recovery after Leaflet loads
            setTimeout(function() {
                window.recoverCAC();
            }, 1000);
        };
        
        document.head.appendChild(script);
    } else {
        console.log('✅ Leaflet is loaded:', window.L.version);
    }
}

// Check if critical DOM elements exist
function checkDomElements() {
    const criticalElements = [
        'map', 'splash-screen', 'app-header', 'utility-toolbar', 
        'add-utility-modal', 'add-structure-modal',
        'main-menu-panel', 'proximity-alerts', 'line-type-selector',
        'confirm-drawing-btn', 'connection-indicator', 'excavation-indicator'
    ];
    
    // Also check elements that might be classes instead of IDs
    const classCriticalElements = [
        'map-controls', 'action-buttons', 'mode-toggle'
    ];
    
    let missing = [];
    criticalElements.forEach(id => {
        const el = document.getElementById(id);
        if (!el) {
            missing.push(id);
            console.error(`Missing critical element: #${id}`);
        }
    });
    
    classCriticalElements.forEach(cls => {
        const el = document.querySelector(`.${cls}`);
        if (!el) {
            missing.push(`.${cls}`);
            console.error(`Missing critical element with class: .${cls}`);
        }
    });
    
    if (missing.length > 0) {
        console.error('Critical UI elements are missing!', missing);
        window.CAC_Recovery.missingElements = missing;
    } else {
        console.log('✅ All critical DOM elements present');
    }
}

// Fix issues with ES modules
function fixModuleLoading() {
    // Add a fallback for when modules fail to load
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        window.CAC_Recovery.errors.push({
            type: 'unhandled-rejection',
            reason: event.reason?.message || 'Unknown reason',
            time: new Date().toISOString()
        });
        
        if (event.reason && event.reason.message && 
            (event.reason.message.includes('module') || 
             event.reason.message.includes('import') || 
             event.reason.message.includes('unexpected token'))) {
            console.error('Module loading error detected, trying fallback...');
            setTimeout(() => {
                if (!window.appState) {
                    console.log('Application not initialized, attempting fallback initialization...');
                    initializeFallback();
                }
            }, 3000);
        }
    });
    
    // Add a workaround for browsers that don't support ES modules
    if (!supportsESModules()) {
        console.warn('Browser may not fully support ES modules, adding fallback script...');
        
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/es-module-shims@1.6.3/dist/es-module-shims.js';
        script.async = true;
        document.head.appendChild(script);
    }
}

// Check if browser supports ES modules
function supportsESModules() {
    try {
        new Function('return import("")');
        return true;
    } catch (err) {
        return false;
    }
}

// Fallback initialization
function initializeFallback() {
    console.log('Running fallback initialization...');
    window.CAC_Recovery.attempts++;
    
    // Don't try too many times
    if (window.CAC_Recovery.attempts > window.CAC_Recovery.maxAttempts) {
        console.error('Too many recovery attempts. Please refresh the page manually.');
        displayFatalError();
        return;
    }
    
    try {
        // Try to initialize the application directly
        Promise.all([
            import('./models/AppState.js'),
            import('./models/DataStore.js'),
            import('./controllers/MapController.js'),
            import('./controllers/UIController.js'),
            import('./controllers/EventHandlers.js')
        ]).then(modules => {
            console.log('All modules loaded successfully!');
            const [AppStateModule, DataStoreModule, MapControllerModule, UIControllerModule, EventHandlersModule] = modules;
            
            // Create instances
            window.appState = new AppStateModule.AppState();
            window.dataStore = new DataStoreModule.DataStore();
            window.mapController = new MapControllerModule.MapController(window.appState, window.dataStore);
            window.uiController = new UIControllerModule.UIController(window.appState, window.dataStore, window.mapController);
            window.eventHandlers = new EventHandlersModule.EventHandlers(window.appState, window.dataStore, window.mapController, window.uiController);
            
            // Connect controllers
            window.mapController.uiController = window.uiController;
            window.mapController.eventHandlers = window.eventHandlers;
            window.uiController.mapController = window.mapController;
            window.uiController.eventHandlers = window.eventHandlers;
            
            // Initialize components
            try {
                // Hide splash screen first
                document.getElementById('splash-screen').style.opacity = '0';
                setTimeout(() => {
                    document.getElementById('splash-screen').style.display = 'none';
                }, 500);
                
                // Initialize components in the correct order
                window.mapController.initMap();
                window.uiController.init();
                window.eventHandlers.setupEventListeners();
                
                // Show success message
                try {
                    window.uiController.showToast('Application initialized in recovery mode', 'warning');
                } catch (e) {
                    console.error('Could not show toast:', e);
                }
                
                console.log('Fallback initialization complete!', {
                    appState: window.appState,
                    dataStore: window.dataStore,
                    mapController: window.mapController,
                    uiController: window.uiController,
                    eventHandlers: window.eventHandlers
                });
            } catch (e) {
                console.error('Error during fallback initialization:', e);
                window.CAC_Recovery.errors.push({
                    type: 'fallback-init-error',
                    message: e.message,
                    stack: e.stack || 'No stack trace',
                    time: new Date().toISOString()
                });
                
                // Try synchronous initialization
                tryDirectInitialization();
            }
        }).catch(error => {
            console.error('Failed to load modules in fallback mode:', error);
            window.CAC_Recovery.errors.push({
                type: 'module-load-error',
                message: error.message,
                stack: error.stack || 'No stack trace',
                time: new Date().toISOString()
            });
            
            // Try synchronous initialization
            tryDirectInitialization();
        });
    } catch (e) {
        console.error('Critical error in fallback initialization:', e);
        window.CAC_Recovery.errors.push({
            type: 'critical-fallback-error',
            message: e.message,
            stack: e.stack || 'No stack trace',
            time: new Date().toISOString()
        });
        
        // Try synchronous initialization
        tryDirectInitialization();
    }
}

// Last resort: Try direct initialization without modules
function tryDirectInitialization() {
    console.log('Attempting direct initialization without modules...');
    
    // Make sure the fix script runs after all other scripts
    setTimeout(() => {
        // Check if globals are available from a non-module context
        if (typeof AppState !== 'undefined' && 
            typeof DataStore !== 'undefined' &&
            typeof MapController !== 'undefined' &&
            typeof UIController !== 'undefined' &&
            typeof EventHandlers !== 'undefined') {
            
            console.log('Global classes found, initializing directly');
            
            // Create instances
            window.appState = new AppState();
            window.dataStore = new DataStore();
            window.mapController = new MapController(window.appState, window.dataStore);
            window.uiController = new UIController(window.appState, window.dataStore, window.mapController);
            window.eventHandlers = new EventHandlers(window.appState, window.dataStore, window.mapController, window.uiController);
            
            // Connect controllers
            window.mapController.uiController = window.uiController;
            window.mapController.eventHandlers = window.eventHandlers;
            window.uiController.mapController = window.mapController;
            window.uiController.eventHandlers = window.eventHandlers;
            
            try {
                // Initialize map and UI
                window.mapController.initMap();
                window.uiController.init();
                window.eventHandlers.setupEventListeners();
                
                console.log('Direct initialization complete!');
            } catch (e) {
                console.error('Error during direct initialization:', e);
                window.CAC_Recovery.errors.push({
                    type: 'direct-init-error',
                    message: e.message,
                    stack: e.stack || 'No stack trace',
                    time: new Date().toISOString()
                });
                
                displayFatalError();
            }
        } else {
            console.error('Global classes not available for direct initialization');
            displayFatalError();
        }
    }, 1000);
}

// Setup a fallback initialization
function setupFallbackInit() {
    // Create a global recovery function
    window.recoverCAC = function() {
        console.log('Running CAC UtiliTrack recovery...');
        
        // 1. Check for critical components
        const componentsExist = window.appState && window.dataStore && 
                                window.mapController && window.uiController && 
                                window.eventHandlers;
        
        if (!componentsExist) {
            console.log('Some components missing, attempting to recreate...');
            recreateComponents();
        } else {
            console.log('All components exist, reconnecting...');
            reconnectComponents();
        }
        
        // 2. Check for map issues
        if (!window.mapController || !window.mapController.map) {
            console.log('Map not initialized, fixing...');
            fixMapIssues();
        }
        
        // 3. Fix event handlers if needed
        if (window.eventHandlers && !window.eventHandlers._listenersInitialized) {
            console.log('Event listeners not initialized, fixing...');
            if (typeof window.eventHandlers.setupEventListeners === 'function') {
                window.eventHandlers.setupEventListeners();
            }
        }
        
        // 4. Fix data persistence issues
        fixDataPersistence();
        
        // 5. Fix UI visibility issues
        fixUIVisibility();
        
        // 6. Finally, hide splash screen if it's still visible
        const splash = document.getElementById('splash-screen');
        if (splash && splash.style.display !== 'none') {
            console.log('Hiding splash screen...');
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
            }, 500);
        }
        
        console.log('Recovery completed!');
        return true;
    };
    
    // Auto-trigger after timeout (5 seconds) if not initialized yet
    setTimeout(() => {
        if (!window.appState || !window.mapController || !window.uiController) {
            console.log('Application not initialized after timeout, attempting recovery...');
            window.recoverCAC();
        }
    }, 5000);
}

// Display a fatal error message when all recovery attempts fail
function displayFatalError() {
    // Hide splash screen
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
        }, 500);
    }
    
    // Create an error dialog
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '50%';
    errorDiv.style.left = '50%';
    errorDiv.style.transform = 'translate(-50%, -50%)';
    errorDiv.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
    errorDiv.style.color = 'white';
    errorDiv.style.padding = '20px';
    errorDiv.style.borderRadius = '8px';
    errorDiv.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    errorDiv.style.zIndex = '9999';
    errorDiv.style.maxWidth = '400px';
    errorDiv.style.textAlign = 'center';
    
    errorDiv.innerHTML = `
        <h3 style="margin-top:0">Application Error</h3>
        <p>The application could not be initialized correctly.</p>
        <p>Please try refreshing the page or check your internet connection.</p>
        <button id="reload-btn" style="background:white;color:black;border:none;padding:8px 16px;border-radius:4px;margin-top:10px;cursor:pointer;">Reload Page</button>
        <div style="margin-top:15px;font-size:12px;color:#ffccbc">
            <details>
                <summary>Technical Details</summary>
                <div style="text-align:left;margin-top:8px;white-space:pre-wrap;font-family:monospace;max-height:200px;overflow:auto;">
                    Errors: ${window.CAC_Recovery.errors.length}
                    Last error: ${window.CAC_Recovery.errors.length > 0 ? window.CAC_Recovery.errors[window.CAC_Recovery.errors.length - 1].message : 'None'}
                </div>
            </details>
        </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Add reload button functionality
    document.getElementById('reload-btn').addEventListener('click', function() {
        location.reload();
    });
}

// Monitor for dynamic changes to critical elements
function monitorCriticalElements() {
    // Check for map container
    const checkMapContainer = () => {
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            // Check if map container has size
            if (mapContainer.clientWidth === 0 || mapContainer.clientHeight === 0) {
                console.warn('Map container has zero size!');
                
                // Try to fix the container size
                mapContainer.style.width = '100%';
                mapContainer.style.height = '100%';
                
                // If map is already initialized, invalidate size
                if (window.mapController && window.mapController.map) {
                    setTimeout(() => {
                        window.mapController.map.invalidateSize();
                    }, 100);
                }
            }
        }
    };
    
    // Run monitoring every second
    setInterval(() => {
        checkMapContainer();
    }, 1000);
}

// Additional UI fixes and support for map controls
document.addEventListener('DOMContentLoaded', function() {
    console.log('Adding supplementary map control fixes...');
    
    // Force critical element styles immediately and repeatedly
    setInterval(function() {
        // Ensure map controls are visible
        const mapControls = document.querySelector('.map-controls');
        if (mapControls) {
            mapControls.style.position = 'absolute';
            mapControls.style.right = '15px';
            mapControls.style.top = 'calc(var(--space-lg) + 50px)';
            mapControls.style.zIndex = '1000';
            mapControls.style.display = 'flex';
            mapControls.style.flexDirection = 'column';
            mapControls.style.gap = 'var(--space-sm)';
            
            // Ensure buttons are properly styled
            mapControls.querySelectorAll('.map-control-button').forEach(btn => {
                btn.style.width = '48px';
                btn.style.height = '48px';
                btn.style.display = 'flex';
                btn.style.alignItems = 'center';
                btn.style.justifyContent = 'center';
                btn.style.backgroundColor = 'var(--bg-card)';
                btn.style.color = 'var(--gray-600)';
                btn.style.borderRadius = 'var(--radius-full)';
                btn.style.boxShadow = 'var(--shadow-md)';
            });
        }
        
        // Ensure that the splash screen is hidden after a few seconds
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if (splash) {
                splash.style.opacity = '0';
                splash.style.display = 'none';
            }
        }, 3000);
        
        // Ensure all maps are fully initialized
        if (window.L && window.mapController && window.mapController.map) {
            // Fix map container size issues
            const mapContainer = document.getElementById('map');
            if (mapContainer) {
                mapContainer.style.width = '100%';
                mapContainer.style.height = '100%';
                
                // Force map to refresh its size - sometimes required for maps to render properly
                window.mapController.map.invalidateSize();
            }
        }
    }, 1000);
    
    // Fix Leaflet CSS issues that might be caused by CSS conflicts
    const fixLeafletStyles = function() {
        // Force Leaflet controls to be visible (sometimes hidden by CSS conflicts)
        const leafletControls = document.querySelectorAll('.leaflet-control-container, .leaflet-control');
        leafletControls.forEach(control => {
            if (control) {
                control.style.zIndex = '1000';
                control.style.pointerEvents = 'auto';
                control.style.visibility = 'visible';
                control.style.display = 'block';
            }
        });
        
        // Fix Leaflet markers that might be hidden
        const markers = document.querySelectorAll('.leaflet-marker-icon');
        markers.forEach(marker => {
            marker.style.visibility = 'visible';
            marker.style.opacity = '1';
        });
    };
    
    // Apply these fixes immediately and periodically
    setTimeout(fixLeafletStyles, 1000);
    setInterval(fixLeafletStyles, 3000);
    
    // Add missing event listeners that might be causing issues
    const addCriticalEventListeners = function() {
        // Ensure zoom controls work
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const locateBtn = document.getElementById('locate-btn');
        const recenterBtn = document.getElementById('recenter-btn');
        
        if (zoomInBtn && !zoomInBtn._hasListener) {
            zoomInBtn._hasListener = true;
            zoomInBtn.addEventListener('click', function() {
                if (window.mapController && window.mapController.map) {
                    window.mapController.map.zoomIn();
                }
            });
        }
        
        if (zoomOutBtn && !zoomOutBtn._hasListener) {
            zoomOutBtn._hasListener = true;
            zoomOutBtn.addEventListener('click', function() {
                if (window.mapController && window.mapController.map) {
                    window.mapController.map.zoomOut();
                }
            });
        }
        
        if (locateBtn && !locateBtn._hasListener) {
            locateBtn._hasListener = true;
            locateBtn.addEventListener('click', function() {
                if (window.mapController && typeof window.mapController.locateUser === 'function') {
                    window.mapController.locateUser();
                } else if (window.mapController && typeof window.mapController.getUserLocation === 'function') {
                    window.mapController.getUserLocation();
                }
            });
        }
        
        if (recenterBtn && !recenterBtn._hasListener) {
            recenterBtn._hasListener = true;
            recenterBtn.addEventListener('click', function() {
                if (window.mapController && window.mapController.map) {
                    const userLocationMarker = window.mapController.userLocationMarker;
                    if (userLocationMarker) {
                        window.mapController.map.setView(userLocationMarker.getLatLng());
                    }
                }
            });
        }
    };
    
    // Apply event listeners after a delay and repeatedly
    setTimeout(addCriticalEventListeners, 1500);
    setInterval(addCriticalEventListeners, 3000);
    
    // Add global error recovery for map issues
    window.addEventListener('error', function(event) {
        // If Leaflet-related error
        if (event.message && (
            event.message.includes('map') || 
            event.message.includes('L.') || 
            event.message.includes('leaflet')
        )) {
            console.warn('Map-related error detected, attempting recovery:', event.message);
            
            // Try to recover map functionality
            setTimeout(function() {
                if (window.mapController && !window.mapController.map) {
                    console.log('Attempting to reinitialize map...');
                    try {
                        window.mapController.initMap();
                    } catch (e) {
                        console.error('Failed to reinitialize map:', e);
                    }
                }
            }, 1000);
        }
    });
    
    console.log('Map control fixes applied successfully');
});

// Create a basic map if none exists
function createEmergencyMap() {
    if (window.L && document.getElementById('map')) {
        console.log('Creating emergency map...');
        
        // Create a fallback map object
        window.emergencyMap = L.map('map', {
            center: [40.7128, -74.0060], // Default to NYC
            zoom: 16
        });
        
        // Add base tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 22
        }).addTo(window.emergencyMap);
        
        // Store reference to emergency map
        if (!window.mapController) {
            window.mapController = { map: window.emergencyMap };
        } else {
            window.mapController.map = window.emergencyMap;
        }
        
        console.log('Emergency map created');
    } else {
        console.error('Cannot create emergency map - Leaflet or map element missing');
    }
}

// Fix component references
function fixComponentReferences() {
    // Create components if they don't exist
    if (!window.appState) {
        console.log('Creating emergency AppState');
        window.appState = {
            mode: 'discovery',
            activeUtilityType: 'water',
            activeLineType: 'service',
            isDrawing: false,
            drawingPoints: [],
            tempLine: null,
            isMeasuring: false,
            measurePoints: [],
            isExcavationMode: false
        };
    }
    
    // Connect components if they exist
    if (window.mapController && window.uiController) {
        window.mapController.uiController = window.uiController;
        window.uiController.mapController = window.mapController;
    }
    
    if (window.appState && window.mapController) {
        window.mapController.appState = window.appState;
    }
    
    if (window.appState && window.uiController) {
        window.uiController.appState = window.appState;
    }
    
    console.log('Component references fixed');
}

// Fix critical features
function fixCriticalFeatures() {
    // Fix measurement functionality
    fixMeasurementFeature();
    
    // Fix excavation mode functionality
    fixExcavationFeature();
}

// Fix measurement feature functionality
function fixMeasurementFeature() {
    console.log('Fixing measurement feature...');
    
    // Make sure measurement button works
    const measureBtn = document.getElementById('measure-btn');
    if (measureBtn) {
        // Remove existing listeners to avoid duplicates
        const newBtn = measureBtn.cloneNode(true);
        measureBtn.parentNode.replaceChild(newBtn, measureBtn);
        
        // Add direct event handler
        newBtn.addEventListener('click', function() {
            if (window.appState) {
                window.appState.isMeasuring = !window.appState.isMeasuring;
                
                if (window.appState.isMeasuring) {
                    // Enter measurement mode
                    this.classList.add('active');
                    const toolbar = document.getElementById('measurement-toolbar');
                    toolbar.classList.add('visible');
                    document.body.style.cursor = 'crosshair';
                    
                    // Set default active tool
                    toolbar.querySelectorAll('.measurement-button').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    toolbar.querySelector('.measurement-button[data-tool="measure-distance"]').classList.add('active');
                    
                    // Update toolbar button handlers
                    toolbar.querySelectorAll('.measurement-button').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const tool = this.getAttribute('data-tool');
                            
                            toolbar.querySelectorAll('.measurement-button').forEach(b => {
                                b.classList.remove('active');
                            });
                            this.classList.add('active');
                            
                            if (tool === 'exit-measure') {
                                // Exit measurement mode
                                window.appState.isMeasuring = false;
                                measureBtn.classList.remove('active');
                                toolbar.classList.remove('visible');
                                document.body.style.cursor = '';
                            }
                        });
                    });
                } else {
                    // Exit measurement mode
                    this.classList.remove('active');
                    document.getElementById('measurement-toolbar').classList.remove('visible');
                    document.body.style.cursor = '';
                }
            }
        });
    }
}

// Fix excavation mode functionality
function fixExcavationFeature() {
    console.log('Fixing excavation mode...');
    
    // Fix excavation mode button
    const excavationBtn = document.querySelector('.mode-button[data-mode="excavation"]');
    if (excavationBtn) {
        // Replace with new button to avoid duplicate event handlers
        const newBtn = excavationBtn.cloneNode(true);
        excavationBtn.parentNode.replaceChild(newBtn, excavationBtn);
        
        // Add direct event handler
        newBtn.addEventListener('click', function() {
            // Show confirmation dialog
            const modal = document.getElementById('exit-excavation-modal');
            if (modal) {
                const messageEl = modal.querySelector('.exit-confirmation-message');
                if (messageEl) {
                    messageEl.textContent = 'Excavation mode provides real-time safety alerts for nearby utilities. Do you want to continue?';
                }
                
                const confirmBtn = modal.querySelector('#confirm-exit-excavation');
                if (confirmBtn) {
                    confirmBtn.textContent = 'Enter Excavation Mode';
                    
                    // Remove existing handler and add new one
                    const newConfirmBtn = confirmBtn.cloneNode(true);
                    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
                    
                    newConfirmBtn.addEventListener('click', function() {
                        // Enter excavation mode
                        if (window.appState) {
                            window.appState.mode = 'excavation';
                            window.appState.isExcavationMode = true;
                        }
                        
                        // Update UI
                        document.querySelectorAll('#mode-toggle .mode-button').forEach(btn => {
                            btn.classList.remove('active');
                        });
                        newBtn.classList.add('active');
                        
                        // Show excavation indicator
                        document.getElementById('excavation-indicator').classList.add('visible');
                        document.getElementById('exit-excavation-btn').classList.add('visible');
                        
                        // Hide the modal
                        modal.classList.remove('visible');
                    });
                }
                
                // Show the modal
                modal.classList.add('visible');
            }
        });
    }
    
    // Fix exit excavation button
    const exitBtn = document.getElementById('exit-excavation-btn');
    if (exitBtn) {
        // Replace with new button
        const newExitBtn = exitBtn.cloneNode(true);
        exitBtn.parentNode.replaceChild(newExitBtn, exitBtn);
        
        // Add direct handler
        newExitBtn.addEventListener('click', function() {
            // Show confirmation dialog
            const modal = document.getElementById('exit-excavation-modal');
            if (modal) {
                const messageEl = modal.querySelector('.exit-confirmation-message');
                if (messageEl) {
                    messageEl.textContent = 'Are you sure you want to exit excavation mode? This will disable real-time proximity alerts.';
                }
                
                const confirmBtn = modal.querySelector('#confirm-exit-excavation');
                if (confirmBtn) {
                    confirmBtn.textContent = 'Exit Mode';
                    
                    // Remove existing handler and add new one
                    const newConfirmBtn = confirmBtn.cloneNode(true);
                    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
                    
                    newConfirmBtn.addEventListener('click', function() {
                        // Exit excavation mode
                        if (window.appState) {
                            window.appState.mode = 'discovery';
                            window.appState.isExcavationMode = false;
                        }
                        
                        // Update UI
                        document.querySelectorAll('#mode-toggle .mode-button').forEach(btn => {
                            btn.classList.remove('active');
                        });
                        document.querySelector('#mode-toggle .mode-button[data-mode="discovery"]').classList.add('active');
                        
                        // Hide indicators
                        document.getElementById('excavation-indicator').classList.remove('visible');
                        document.getElementById('exit-excavation-btn').classList.remove('visible');
                        
                        // Hide the modal
                        modal.classList.remove('visible');
                    });
                }
                
                // Show the modal
                modal.classList.add('visible');
            }
        });
    }
}

// Ensure splash screen gets hidden
function hideSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash && (splash.style.display !== 'none' || splash.style.opacity !== '0')) {
        console.log('Forcing splash screen to hide');
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
        }, 500);
    }
}

// Hide splash after a timeout in case app initialization fails
setTimeout(hideSplash, 3000);

// Run the recovery function once the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Give the main app time to initialize first
    setTimeout(function() {
        // Only run recovery if components aren't properly initialized
        if (!window.mapController || !window.mapController.map || !window.eventHandlers) {
            console.log('Components not initialized properly, running recovery...');
            window.recoverCAC();
        }
    }, 1500);
});

console.log('=== CAC UtiliTrack Fix Script Loaded ===');

// Add an error handler that provides recovery mechanisms
/**
 * Clean up event listeners to prevent duplicates
 * This is a utility function used during recovery
 */
function cleanupEventListeners() {
    console.log('Cleaning up potential duplicate event listeners...');
    
    // Most critical elements that often have duplicate listeners
    const criticalElements = [
        'add-utility-btn',
        'zoom-in-btn',
        'zoom-out-btn',
        'locate-btn',
        'measure-btn',
        'layers-btn',
        'menu-button',
        'confirm-drawing-btn',
        'exit-excavation-btn',
    ];
    
    // Clone all existing listeners before removing them
    criticalElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            // Create new element to replace the old one
            const newElement = element.cloneNode(true);
            if (element.parentNode) {
                element.parentNode.replaceChild(newElement, element);
            }
        }
    });
    
    // Mark EventHandlers as needing reinitialization
    if (window.eventHandlers) {
        window.eventHandlers._listenersInitialized = false;
    }
}

// Set up a global error limiter to prevent error toasts from stacking
document.addEventListener('DOMContentLoaded', function() {
    // Set up a global error limiter to prevent error toasts from stacking
});

/**
 * Fix Leaflet map issues
 */
function fixMapIssues() {
    // Check if Leaflet is available
    if (!window.L) {
        console.error('Leaflet library not loaded, cannot fix map');
        loadLeaflet();
        return;
    }
    
    try {
        // Get the map container element
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            console.error('Map container not found');
            return;
        }
        
        // Check if the map container has proper dimensions
        if (mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) {
            console.log('Map container has zero dimensions, fixing...');
            mapContainer.style.width = '100%';
            mapContainer.style.height = '100%';
        }
        
        // Check for existing map instance
        if (window.mapController && window.mapController.map) {
            // Try to invalidate the map size to fix rendering issues
            window.mapController.map.invalidateSize();
            console.log('Map exists, invalidated size to fix rendering');
            return;
        }
        
        // Create a new MapController if needed
        if (!window.mapController) {
            console.log('Creating new MapController...');
            
            // Create required dependencies if missing
            if (!window.appState) {
                try {
                    // Try to use the AppState class from the module
                    import('./models/AppState.js').then(module => {
                        window.appState = new module.AppState();
                        console.log('Created new AppState');
                    }).catch(err => {
                        // Fallback to a simplified AppState
                        window.appState = {
                            mode: 'discovery',
                            activeUtilityType: 'water',
                            activeLineType: 'service',
                            isDrawing: false,
                            isMeasuring: false,
                            measurePoints: [],
                            setMode: function(mode) { this.mode = mode; },
                            setUtilityType: function(type) { this.activeUtilityType = type; },
                            setLineType: function(type) { this.activeLineType = type; }
                        };
                        console.log('Created fallback AppState');
                    });
                } catch (e) {
                    // If dynamic import fails, create a minimal AppState
                    window.appState = {
                        mode: 'discovery',
                        activeUtilityType: 'water',
                        activeLineType: 'service',
                        isDrawing: false,
                        isMeasuring: false,
                        measurePoints: [],
                        setMode: function(mode) { this.mode = mode; },
                        setUtilityType: function(type) { this.activeUtilityType = type; },
                        setLineType: function(type) { this.activeLineType = type; }
                    };
                    console.log('Created minimal AppState after import error');
                }
            }
            
            if (!window.dataStore) {
                try {
                    // Try to use the DataStore class from the module
                    import('./models/DataStore.js').then(module => {
                        window.dataStore = new module.DataStore();
                        console.log('Created new DataStore');
                    }).catch(err => {
                        // Fallback to a simplified DataStore
                        window.dataStore = {
                            utilities: { water: [], gas: [], electric: [], sewer: [], telecom: [] },
                            structures: { water: [], gas: [], electric: [], sewer: [], telecom: [] },
                            annotations: [],
                            measurements: [],
                            generateId: function(prefix) {
                                return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
                            }
                        };
                        console.log('Created fallback DataStore');
                    });
                } catch (e) {
                    // If dynamic import fails, create a minimal DataStore
                    window.dataStore = {
                        utilities: { water: [], gas: [], electric: [], sewer: [], telecom: [] },
                        structures: { water: [], gas: [], electric: [], sewer: [], telecom: [] },
                        annotations: [],
                        measurements: [],
                        generateId: function(prefix) {
                            return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
                        }
                    };
                    console.log('Created minimal DataStore after import error');
                }
            }
            
            try {
                // Try to use the MapController class from the module
                import('./controllers/MapController.js').then(module => {
                    window.mapController = new module.MapController(window.appState, window.dataStore);
                    window.mapController.initMap();
                    console.log('Created and initialized MapController from module');
                }).catch(err => {
                    console.error('Could not import MapController module, creating fallback map', err);
                    createFallbackMap();
                });
            } catch (e) {
                console.error('Error creating MapController from module, creating fallback map', e);
                createFallbackMap();
            }
        } else if (window.mapController && !window.mapController.map) {
            // Map controller exists but map is not initialized
            console.log('MapController exists but map not initialized, attempting initialization...');
            try {
                window.mapController.initMap();
                console.log('Successfully initialized map');
            } catch (e) {
                console.error('Error initializing map, creating fallback', e);
                createFallbackMap();
            }
        }
    } catch (e) {
        console.error('Error in fixMapIssues:', e);
        createFallbackMap();
    }
}

/**
 * Create a fallback map as a last resort
 */
function createFallbackMap() {
    if (!window.L) {
        console.error('Leaflet not available, cannot create fallback map');
        return;
    }
    
    try {
        // Create a basic Leaflet map
        const fallbackMap = L.map('map', {
            center: [39.8283, -98.5795], // Center of US
            zoom: 18
        });
        
        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 22
        }).addTo(fallbackMap);
        
        // Create minimal MapController if needed
        if (!window.mapController) {
            window.mapController = {
                map: fallbackMap,
                utilityLayers: {
                    water: L.layerGroup().addTo(fallbackMap),
                    gas: L.layerGroup().addTo(fallbackMap),
                    electric: L.layerGroup().addTo(fallbackMap),
                    sewer: L.layerGroup().addTo(fallbackMap),
                    telecom: L.layerGroup().addTo(fallbackMap)
                },
                structureLayers: {
                    water: L.layerGroup().addTo(fallbackMap),
                    gas: L.layerGroup().addTo(fallbackMap),
                    electric: L.layerGroup().addTo(fallbackMap),
                    sewer: L.layerGroup().addTo(fallbackMap),
                    telecom: L.layerGroup().addTo(fallbackMap)
                },
                measurementLayer: L.layerGroup().addTo(fallbackMap),
                annotationLayer: L.layerGroup().addTo(fallbackMap)
            };
        } else {
            window.mapController.map = fallbackMap;
        }
        
        console.log('Created fallback map and assigned to mapController');
        
        // Try to locate user
        fallbackMap.locate({setView: true, maxZoom: 18});
        
    } catch (e) {
        console.error('Error creating fallback map:', e);
    }
}

/**
 * Recreate missing application components
 */
function recreateComponents() {
    try {
        // Create AppState if needed
        if (!window.appState) {
            console.log('Creating new AppState...');
            try {
                import('./models/AppState.js').then(module => {
                    window.appState = new module.AppState();
                    reconnectComponents();
                }).catch(e => {
                    console.error('Failed to import AppState:', e);
                });
            } catch (e) {
                window.appState = {
                    mode: 'discovery',
                    activeUtilityType: 'water',
                    activeLineType: 'service',
                    setMode: function(mode) { this.mode = mode; },
                    setUtilityType: function(type) { this.activeUtilityType = type; },
                    setLineType: function(type) { this.activeLineType = type; }
                };
                console.log('Created minimal AppState');
            }
        }
        
        // Create DataStore if needed
        if (!window.dataStore) {
            console.log('Creating new DataStore...');
            try {
                import('./models/DataStore.js').then(module => {
                    window.dataStore = new module.DataStore();
                    reconnectComponents();
                }).catch(e => {
                    console.error('Failed to import DataStore:', e);
                });
            } catch (e) {
                window.dataStore = {
                    utilities: { water: [], gas: [], electric: [], sewer: [], telecom: [] },
                    structures: { water: [], gas: [], electric: [], sewer: [], telecom: [] },
                    annotations: [],
                    measurements: [],
                    lastSaveTime: 0,
                    generateId: function(prefix) {
                        return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
                    },
                    debouncedSave: function() {},
                    saveData: function() {}
                };
                console.log('Created minimal DataStore');
            }
        }
        
        // Create MapController if needed
        if (!window.mapController) {
            console.log('Creating new MapController...');
            try {
                import('./controllers/MapController.js').then(module => {
                    window.mapController = new module.MapController(window.appState, window.dataStore);
                    reconnectComponents();
                    window.mapController.initMap();
                }).catch(e => {
                    console.error('Failed to import MapController:', e);
                });
            } catch (e) {
                console.error('Error creating MapController, will use fallback map', e);
                fixMapIssues();
            }
        }
        
        // Create UIController if needed
        if (!window.uiController) {
            console.log('Creating new UIController...');
            try {
                import('./controllers/UIController.js').then(module => {
                    window.uiController = new module.UIController(window.appState, window.dataStore, window.mapController);
                    reconnectComponents();
                    window.uiController.init();
                }).catch(e => {
                    console.error('Failed to import UIController:', e);
                });
            } catch (e) {
                console.error('Error creating UIController:', e);
                window.uiController = {
                    showToast: function(message, type) {
                        alert(message);
                    },
                    showStatusBar: function(text) {
                        const statusBar = document.getElementById('status-bar');
                        const statusText = document.getElementById('status-text');
                        if (statusBar && statusText) {
                            statusText.innerHTML = text;
                            statusBar.classList.add('visible');
                        }
                    },
                    hideStatusBar: function() {
                        const statusBar = document.getElementById('status-bar');
                        if (statusBar) {
                            statusBar.classList.remove('visible');
                        }
                    },
                    init: function() {}
                };
                console.log('Created minimal UIController');
            }
        }
        
        // Create EventHandlers if needed
        if (!window.eventHandlers) {
            console.log('Creating new EventHandlers...');
            try {
                import('./controllers/EventHandlers.js').then(module => {
                    window.eventHandlers = new module.EventHandlers(
                        window.appState, 
                        window.dataStore, 
                        window.mapController, 
                        window.uiController
                    );
                    reconnectComponents();
                    window.eventHandlers.setupEventListeners();
                }).catch(e => {
                    console.error('Failed to import EventHandlers:', e);
                });
            } catch (e) {
                console.error('Error creating EventHandlers:', e);
            }
        }
    } catch (e) {
        console.error('Error recreating components:', e);
    }
}

/**
 * Reconnect all components to each other
 */
function reconnectComponents() {
    if (!window.appState || !window.dataStore || !window.mapController || !window.uiController) {
        console.warn('Cannot reconnect components - some are missing');
        return;
    }
    
    try {
        console.log('Reconnecting all components...');
        
        // Connect mapController references
        window.mapController.appState = window.appState;
        window.mapController.dataStore = window.dataStore;
        window.mapController.uiController = window.uiController;
        if (window.eventHandlers) {
            window.mapController.eventHandlers = window.eventHandlers;
        }
        
        // Connect uiController references
        window.uiController.appState = window.appState;
        window.uiController.dataStore = window.dataStore;
        window.uiController.mapController = window.mapController;
        if (window.eventHandlers) {
            window.uiController.eventHandlers = window.eventHandlers;
        }
        
        // Connect eventHandlers references
        if (window.eventHandlers) {
            window.eventHandlers.appState = window.appState;
            window.eventHandlers.dataStore = window.dataStore;
            window.eventHandlers.mapController = window.mapController;
            window.eventHandlers.uiController = window.uiController;
        }
        
        // Connect dataStore references
        window.dataStore.mapController = window.mapController;
        window.dataStore.uiController = window.uiController;
        
        console.log('All components reconnected successfully');
    } catch (e) {
        console.error('Error reconnecting components:', e);
    }
}

/**
 * Fix data persistence issues
 */
function fixDataPersistence() {
    try {
        if (!window.dataStore) return;
        
        // Ensure dataStore has a debouncedSave method
        if (!window.dataStore.debouncedSave) {
            console.log('Adding missing debouncedSave method to dataStore');
            window.dataStore.debouncedSave = function() {
                if (this.saveData && typeof this.saveData === 'function') {
                    this.saveData();
                }
            };
        }
        
        // Ensure dataStore has a saveData method
        if (!window.dataStore.saveData) {
            console.log('Adding missing saveData method to dataStore');
            window.dataStore.saveData = function() {
                try {
                    // Create safe-to-save data object
                    const data = {
                        utilities: this.utilities || { water: [], gas: [], electric: [], sewer: [], telecom: [] },
                        structures: this.structures || { water: [], gas: [], electric: [], sewer: [], telecom: [] },
                        annotations: this.annotations || [],
                        measurements: this.measurements || [],
                        timestamp: new Date().toISOString()
                    };
                    
                    // Handle circular references
                    const jsonString = JSON.stringify(data, function(key, value) {
                        // Skip DOM elements, Leaflet objects and controller references
                        if (key === 'mapController' || key === 'uiController' || 
                            key === 'eventHandlers' || key === 'appState' || 
                            key === 'dataStore' || key === 'map' ||
                            (value && value._leaflet_id) || 
                            (value instanceof Element)) {
                            return undefined;
                        }
                        return value;
                    });
                    
                    localStorage.setItem('cac_utilitrack_data', jsonString);
                    
                    // Also save a backup copy
                    localStorage.setItem('cac_utilitrack_data_backup', jsonString);
                    
                    return true;
                } catch (e) {
                    console.error('Error saving data:', e);
                    return false;
                }
            };
        }
        
        // Ensure dataStore has a loadData method
        if (!window.dataStore.loadData) {
            console.log('Adding missing loadData method to dataStore');
            window.dataStore.loadData = function() {
                try {
                    const savedData = localStorage.getItem('cac_utilitrack_data') || 
                                      localStorage.getItem('cac_utilitrack_data_backup');
                    
                    if (!savedData) return false;
                    
                    const data = JSON.parse(savedData);
                    
                    if (!data || !data.utilities || !data.structures) return false;
                    
                    this.utilities = data.utilities;
                    this.structures = data.structures;
                    this.annotations = data.annotations || [];
                    this.measurements = data.measurements || [];
                    
                    return true;
                } catch (e) {
                    console.error('Error loading data:', e);
                    return false;
                }
            };
        }
    } catch (e) {
        console.error('Error fixing data persistence:', e);
    }
}

/**
 * Fix UI visibility issues
 */
function fixUIVisibility() {
    try {
        // Hide splash screen first for better user experience
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
            }, 500);
        }
        
        // Check utility toolbar visibility
        const utilityToolbar = document.getElementById('utility-toolbar');
        if (utilityToolbar && window.getComputedStyle(utilityToolbar).visibility === 'hidden') {
            utilityToolbar.style.visibility = 'visible';
            utilityToolbar.style.display = 'flex';
        }
        
        // Check map controls visibility
        const mapControls = document.querySelector('.map-controls');
        if (mapControls && window.getComputedStyle(mapControls).visibility === 'hidden') {
            mapControls.style.visibility = 'visible';
            mapControls.style.display = 'flex';
        }
        
        // Check mode toggle visibility
        const modeToggle = document.getElementById('mode-toggle');
        if (modeToggle && window.getComputedStyle(modeToggle).visibility === 'hidden') {
            modeToggle.style.visibility = 'visible';
            modeToggle.style.display = 'flex';
        }
        
        // Check action buttons visibility
        const actionButtons = document.querySelector('.action-buttons');
        if (actionButtons && window.getComputedStyle(actionButtons).visibility === 'hidden') {
            actionButtons.style.visibility = 'visible';
            actionButtons.style.display = 'flex';
        }
        
        // Check if modals are stuck open
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            // If a modal is inadvertently left open (without visible class but display block)
            if (window.getComputedStyle(modal).display !== 'none' && !modal.classList.contains('visible')) {
                modal.style.display = 'none';
            }
        });
    } catch (e) {
        console.error('Error fixing UI visibility:', e);
    }
}

/**
 * Load Leaflet library if not available
 */
function loadLeaflet() {
    if (window.L) return;
    
    console.log('Loading Leaflet library dynamically...');
    
    // Create a script element to load Leaflet JavaScript
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.async = true;
    
    // Create a link element to load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    
    // Append elements to document
    document.head.appendChild(link);
    document.body.appendChild(script);
    
    // Set up callback for when script loads
    script.onload = function() {
        console.log('Leaflet loaded successfully');
        // After Leaflet loads, try to fix map issues
        setTimeout(fixMapIssues, 500);
    };
    
    script.onerror = function() {
        console.error('Failed to load Leaflet library');
    };
}

// Alias for backwards compatibility
window.patchCACUtiliTrack = window.recoverCAC;

// Auto-run fix script after a delay to allow normal initialization first
setTimeout(function() {
    // Only run if there are obvious issues
    if (!window.mapController || !window.mapController.map || 
        !window.uiController || !window.dataStore || !window.appState) {
        console.log('Detected initialization issues, running fix script...');
        window.recoverCAC();
    }
}, 3000);

// Export the recovery function for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        recoverCAC: window.recoverCAC,
        patchCACUtiliTrack: window.patchCACUtiliTrack
    };
} 