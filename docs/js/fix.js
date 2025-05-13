/**
 * Fix script for CAC UtiliTrack
 * This script attempts to fix common issues that might prevent the application from initializing
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
        console.log('Manual recovery triggered...');
        
        // Hide splash screen as a first step
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
            }, 500);
        }
        
        // Attempt recovery
        initializeFallback();
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

console.log('Fix script loaded successfully'); 