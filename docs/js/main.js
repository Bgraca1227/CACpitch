/**
 * Main application entry point
 * This file initializes all components and sets up global references
 */

// Import application modules
import { AppState } from './models/AppState.js';
import { DataStore } from './models/DataStore.js';
import { MapController } from './controllers/MapController.js';
import { UIController } from './controllers/UIController.js';
import { EventHandlers } from './controllers/EventHandlers.js';

// Global error tracking for debugging
let initErrors = [];
let initTimeoutId = null;
let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

// Check for iPhone to handle iOS-specific initialization
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

/**
 * Initialize the application and all its components
 */
function initApplication() {
    try {
        console.log('Initializing CAC UtiliTrack application...');
        
        // Initialize the data store first and load saved data
        const dataStore = new DataStore();
        
        // Handle loadInitialData as a Promise
        dataStore.loadInitialData()
            .then(() => {
                console.log('DataStore initialized');
                
                // Initialize app state
                const appState = new AppState();
                console.log('AppState initialized');
                
                // Initialize the map controller
                const mapController = new MapController(appState, dataStore);
                console.log('MapController initialized');
                
                // Initialize the UI controller
                const uiController = new UIController(appState, dataStore, mapController);
                console.log('UIController initialized');
                
                // Initialize event handlers
                const eventHandlers = new EventHandlers(appState, dataStore, mapController, uiController);
                console.log('EventHandlers initialized');
                
                // Critical! Connect controllers to each other
                mapController.uiController = uiController;
                mapController.eventHandlers = eventHandlers;
                uiController.mapController = mapController;
                uiController.eventHandlers = eventHandlers;
                
                // Initialize map first
                mapController.initMap();
                console.log('Map initialized');
                
                // Wait a short time before initializing UI to ensure the map is ready
                setTimeout(() => {
                    try {
                        // Initialize UI
                        uiController.init();
                        console.log('UI initialized');
                        
                        // Initialize event handlers after UI is ready
                        eventHandlers.setupEventListeners();
                        console.log('Event handlers initialized');
                        
                        // Render initial data on the map
                        mapController.loadUtilities();
                        console.log('Utilities loaded');
                        
                        // Apply iOS-specific optimizations if needed
                        if (isIOS) {
                            applyIOSOptimizations(mapController);
                        }
                        
                        // Hide splash screen after full initialization
                        setTimeout(() => {
                            const splash = document.getElementById('splash-screen');
                            if (splash) {
                                splash.style.opacity = '0';
                                setTimeout(() => {
                                    splash.style.display = 'none';
                                }, 500);
                            }
                        }, 500);
                    } catch (error) {
                        console.error('Error in delayed initialization:', error);
                        initErrors.push(error);
                        tryRecovery();
                    }
                }, 300);
                
                // Make components available globally for debugging
                window.appState = appState;
                window.dataStore = dataStore;
                window.mapController = mapController;
                window.uiController = uiController;
                window.eventHandlers = eventHandlers;
                window.initErrors = initErrors;
                
                console.log('Application initialization complete!');
                
                // Return the initialized components
                return { appState, dataStore, mapController, uiController, eventHandlers };
            })
            .catch(error => {
                console.error('Error initializing data store:', error);
                initErrors.push(error);
                tryRecovery();
                throw error;
            });
    } catch (error) {
        console.error('Error initializing application:', error);
        initErrors.push(error);
        
        // Show an error toast if UI controller is available
        if (window.uiController && typeof window.uiController.showToast === 'function') {
            window.uiController.showToast('Error initializing application', 'error');
        }
        
        // Try recovery
        tryRecovery();
        
        // Re-throw to allow potential fallback handling
        throw error;
    }
}

// Try to recover from initialization errors
function tryRecovery() {
    console.log('Attempting to recover from initialization errors...');
    
    // Check if fix.js already created recovery functions
    if (typeof window.recoverCAC === 'function') {
        console.log('Using existing recovery function...');
        window.recoverCAC();
    } else {
        console.log('Creating basic recovery...');
        
        // Hide splash screen at minimum
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
            }, 500);
        }
        
        // Create basic alert
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '10px';
        errorDiv.style.left = '50%';
        errorDiv.style.transform = 'translateX(-50%)';
        errorDiv.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
        errorDiv.style.color = 'white';
        errorDiv.style.padding = '10px 20px';
        errorDiv.style.borderRadius = '4px';
        errorDiv.style.zIndex = '9999';
        errorDiv.innerHTML = 'Application initialization failed. <button id="retry-btn" style="background:white;color:black;border:none;padding:3px 8px;border-radius:3px;margin-left:10px;cursor:pointer;">Retry</button>';
        document.body.appendChild(errorDiv);
        
        // Add retry button functionality
        document.getElementById('retry-btn')?.addEventListener('click', function() {
            location.reload();
        });
    }
}

// Create a guaranteed initialization mechanism
function ensureInitialization() {
    if (window.mapController && window.mapController.map) {
        console.log('Application verified as initialized, clearing timeout');
        clearTimeout(initTimeoutId);
        return;
    }
    
    initAttempts++;
    console.log(`Init attempt ${initAttempts}/${MAX_INIT_ATTEMPTS}`);
    
    if (initAttempts <= MAX_INIT_ATTEMPTS) {
        console.log(`App not initialized after ${initAttempts} seconds, retrying...`);
        try {
            initApplication();
        } catch (e) {
            console.error('Error during retry initialization:', e);
        }
        
        // Schedule next check
        initTimeoutId = setTimeout(ensureInitialization, 1000);
    } else {
        console.warn(`Failed to initialize after ${MAX_INIT_ATTEMPTS} attempts, forcing recovery`);
        tryRecovery();
    }
}

/**
 * Request iOS motion & orientation permissions (required for iOS 13+)
 * @returns {boolean} True if initialization should proceed immediately, false if waiting for permission
 */
function requestIOSMotionPermissions() {
    if (isIOS) {
        // iOS 13+ requires user gesture to request motion permissions
        if (typeof DeviceOrientationEvent !== 'undefined' && 
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            
            // Create a button for the user to tap (iOS requires user gesture)
            const permissionBtn = document.createElement('button');
            permissionBtn.id = 'ios-permission-btn';
            permissionBtn.className = 'ios-permission-button';
            permissionBtn.textContent = 'Enable Compass & Location';
            permissionBtn.style.position = 'fixed';
            permissionBtn.style.top = '50%';
            permissionBtn.style.left = '50%';
            permissionBtn.style.transform = 'translate(-50%, -50%)';
            permissionBtn.style.zIndex = '10000';
            permissionBtn.style.padding = '12px 20px';
            permissionBtn.style.background = '#2196F3';
            permissionBtn.style.color = 'white';
            permissionBtn.style.border = 'none';
            permissionBtn.style.borderRadius = '24px';
            permissionBtn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            permissionBtn.style.fontSize = '16px';
            permissionBtn.style.fontWeight = 'bold';
            
            // Add button to DOM
            document.body.appendChild(permissionBtn);
            
            // Handle button click
            permissionBtn.addEventListener('click', () => {
                // Request device orientation permission
                DeviceOrientationEvent.requestPermission()
                    .then(response => {
                        if (response === 'granted') {
                            console.log('DeviceOrientation permission granted');
                            
                            // Also request motion permission
                            if (typeof DeviceMotionEvent !== 'undefined' && 
                                typeof DeviceMotionEvent.requestPermission === 'function') {
                                
                                DeviceMotionEvent.requestPermission()
                                    .then(motionResponse => {
                                        console.log(`DeviceMotion permission ${motionResponse}`);
                                        
                                        // Remove the button once permissions are handled
                                        document.body.removeChild(permissionBtn);
                                        
                                        // Initialize the application
                                        initApplication();
                                        
                                        // Start the initialization verification process
                                        initTimeoutId = setTimeout(ensureInitialization, 1000);
                                    })
                                    .catch(error => {
                                        console.error('Error requesting motion permission:', error);
                                        document.body.removeChild(permissionBtn);
                                        initApplication();
                                        initTimeoutId = setTimeout(ensureInitialization, 1000);
                                    });
                            } else {
                                // No motion permission API, just remove button and init
                                document.body.removeChild(permissionBtn);
                                initApplication();
                                initTimeoutId = setTimeout(ensureInitialization, 1000);
                            }
                        } else {
                            console.warn('DeviceOrientation permission denied');
                            document.body.removeChild(permissionBtn);
                            initApplication();
                            initTimeoutId = setTimeout(ensureInitialization, 1000);
                        }
                    })
                    .catch(error => {
                        console.error('Error requesting orientation permission:', error);
                        document.body.removeChild(permissionBtn);
                        initApplication();
                        initTimeoutId = setTimeout(ensureInitialization, 1000);
                    });
            });
            
            // Don't initialize app yet, wait for permission response
            return false;
        }
    }
    
    // Non-iOS or older iOS that doesn't need permission - proceed with normal init
    return true;
}

/**
 * Apply iOS-specific optimizations to improve performance
 * @param {MapController} mapController The map controller instance
 */
function applyIOSOptimizations(mapController) {
    if (!mapController || !mapController.map) return;
    
    // Prevent overly aggressive scroll handling on iOS
    mapController.map.options.inertia = false;
    mapController.map.options.bounceAtZoomLimits = false;
    
    // Adjust touch gesture sensitivity for iPhone
    if (mapController.map.touchZoom) {
        mapController.map.touchZoom.options.touchStartToleranceDistance = 2;
    }
    
    // Refresh location tracking when app regains focus
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            // Refresh location tracking when app becomes visible again
            if (mapController.appState && mapController.appState.isExcavationMode) {
                if (typeof mapController.stopHighAccuracyLocationTracking === 'function' &&
                    typeof mapController.startHighAccuracyLocationTracking === 'function') {
                    mapController.stopHighAccuracyLocationTracking();
                    setTimeout(() => {
                        mapController.startHighAccuracyLocationTracking();
                    }, 500);
                }
            }
        }
    });
    
    console.log('iOS optimizations applied');
}

// Initialize the application when DOM content is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM content loaded, initializing application...');
    
    // Critical check for Leaflet library
    if (!window.L) {
        console.error('Leaflet library not loaded!');
        initErrors.push(new Error('Leaflet library not available'));
        
        const warningDiv = document.createElement('div');
        warningDiv.style.position = 'fixed';
        warningDiv.style.top = '10px';
        warningDiv.style.left = '50%';
        warningDiv.style.transform = 'translateX(-50%)';
        warningDiv.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
        warningDiv.style.color = 'white';
        warningDiv.style.padding = '10px 20px';
        warningDiv.style.borderRadius = '4px';
        warningDiv.style.zIndex = '9999';
        warningDiv.textContent = 'Error: Leaflet mapping library failed to load';
        document.body.appendChild(warningDiv);
        
        return;
    }
    
    try {
        // Check if we need to handle iOS permissions first
        if (requestIOSMotionPermissions()) {
            // If not iOS or no permission needed, initialize immediately
            initApplication();
            
            // Start the initialization verification process
            initTimeoutId = setTimeout(ensureInitialization, 1000);
        }
    } catch (error) {
        console.error('Failed to initialize application:', error);
        initErrors.push(error);
        
        // Try fallback initialization
        console.log('Attempting fallback initialization...');
        if (typeof window.recoverCAC === 'function') {
            window.recoverCAC();
        }
    }
});

// Global error handler
window.addEventListener('error', function(event) {
    console.error('Global error:', event.message);
    console.error('at', event.filename, 'line', event.lineno);
    initErrors.push(new Error(`${event.message} at ${event.filename}:${event.lineno}`));
    
    // Show an error toast if UI controller is available
    if (window.uiController && typeof window.uiController.showToast === 'function') {
        window.uiController.showToast('Application error detected', 'error');
    }
});

// Export the initialization function for potential manual triggering
export { initApplication };

// Add a global debug helper function
window.debugCAC = function() {
    console.log('CAC UtiliTrack Debug Information:');
    console.log('App State:', window.appState);
    console.log('Data Store:', window.dataStore);
    console.log('Map Controller:', window.mapController);
    console.log('UI Controller:', window.uiController);
    console.log('Event Handlers:', window.eventHandlers);
    console.log('Initialization Errors:', window.initErrors || []);
    
    // Check if critical components are instantiated
    const status = {
        appState: !!window.appState,
        dataStore: !!window.dataStore,
        mapController: !!window.mapController,
        uiController: !!window.uiController,
        eventHandlers: !!window.eventHandlers,
        leaflet: !!window.L
    };
    
    console.log('Component Status:', status);
    
    // Check if map is initialized
    if (window.mapController && window.mapController.map) {
        console.log('Map Status: Initialized');
    } else {
        console.log('Map Status: Not initialized');
    }
    
    return {
        status: status,
        errors: window.initErrors || [],
        fix: function() {
            if (typeof window.recoverCAC === 'function') {
                window.recoverCAC();
                return 'Recovery attempted';
            }
            return 'Recovery function not available';
        }
    };
}; 