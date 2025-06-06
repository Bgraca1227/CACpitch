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

/**
 * Initialize the application and all its components
 */
function initApplication() {
    try {
        console.log('Initializing CAC UtiliTrack application...');
        
        // Initialize the data store first and load saved data
        const dataStore = new DataStore();
        dataStore.loadInitialData(); // Make sure this doesn't throw if there's no data
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
        
        // Additional explicit connections to ensure full interconnectivity
        dataStore.mapController = mapController;
        uiController.init(); // Initialize UI before map to ensure all elements are ready
        console.log('UI initialized');
        
        // Initialize map after UI is ready
        setTimeout(() => {
            try {
                // Initialize map
                mapController.initMap();
                console.log('Map initialized');
                
                // Initialize event handlers after UI and map are ready (now synchronously)
                // This is the ONLY place event listeners should be initialized
                eventHandlers.setupEventListeners();
                console.log('Event handlers initialized');
                
                // Render initial data on the map
                mapController.loadUtilities();
                console.log('Utilities loaded');
                
                // Hide splash screen after full initialization
                setTimeout(() => {
                    hideSplashScreen();
                }, 500);
            } catch (error) {
                console.error('Error in delayed initialization:', error);
                initErrors.push(error);
                tryRecovery();
                hideSplashScreen();
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
        hideSplashScreen();
        
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

// Create a guaranteed initialization mechanism - this was missing from the original app but is crucial
let initTimeoutId = null;
let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

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

        // Hide splash screen even if there's an error
        hideSplashScreen();
        
        return;
    }
    
    try {
        // Initialize application
        initApplication();
        
        // Start the initialization verification process
        initTimeoutId = setTimeout(ensureInitialization, 1000);

        // Add a failsafe to hide splash screen after 5 seconds
        setTimeout(hideSplashScreen, 5000);
    } catch (error) {
        console.error('Failed to initialize application:', error);
        initErrors.push(error);
        
        // Try fallback initialization
        console.log('Attempting fallback initialization...');
        if (typeof window.recoverCAC === 'function') {
            window.recoverCAC();
        }
        
        // Make sure splash screen goes away
        hideSplashScreen();
    }
});

// Helper function to hide splash screen
function hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
        }, 500);
    }
}

// Global error handler
window.addEventListener('error', function(event) {
    console.error('Global error:', event.message);
    console.error('at', event.filename, 'line', event.lineno);
    initErrors.push(new Error(`${event.message} at ${event.filename}:${event.lineno}`));
    
    // Debounce error toasts to prevent error storms
    const now = Date.now();
    const errorKey = `${event.message}|${event.filename}|${event.lineno}`;
    
    // Skip showing the same error if it happened in the last 3 seconds
    if (window._lastErrorTime && 
        window._lastErrorMessage === errorKey && 
        now - window._lastErrorTime < 3000) {
        console.log('Suppressing duplicate error toast');
        return;
    }
    
    // Update error tracking
    window._lastErrorTime = now;
    window._lastErrorMessage = errorKey;
    
    // Handle specific known errors
    if (event.message.includes('findNearestUtility is not a function')) {
        console.log('Known issue detected: Missing findNearestUtility function');
        
        // If the MapController is available, try to add the missing function
        if (window.mapController) {
            if (!window.mapController.findNearestUtility) {
                console.log('Adding missing findNearestUtility function to MapController');
                
                // Add the missing function
                window.mapController.findNearestUtility = function(latlng, maxDistance = 50) {
                    let nearestUtility = null;
                    let minDistance = maxDistance;
                    
                    // Check all utility types if available
                    if (this.utilityLayers) {
                        for (const type in this.utilityLayers) {
                            this.utilityLayers[type].eachLayer(layer => {
                                if (layer.utilityId || layer.utilityData) {
                                    // Calculate distance from point to utility
                                    const distance = this.distanceToPolyline ? 
                                        this.distanceToPolyline(latlng, layer.getLatLngs()) : 
                                        0; // Default to 0 if the function doesn't exist
                                    
                                    // If this is closer than current minimum
                                    if (distance < minDistance) {
                                        minDistance = distance;
                                        
                                        // Get the utility data
                                        nearestUtility = {
                                            utility: layer.utilityData || (this.dataStore ? this.dataStore.getUtilityById(layer.utilityId) : null),
                                            distance: distance,
                                            layer: layer
                                        };
                                    }
                                }
                            });
                        }
                    }
                    
                    return nearestUtility;
                };
                
                console.log('Fix applied: Added findNearestUtility function');
            }
        }
    }
    
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

// Ensure critical user location marker styles are added
function ensureLocationMarkerStyles() {
    // Check if user location marker styles exist in document
    let hasStyles = false;
    for (let i = 0; i < document.styleSheets.length; i++) {
        try {
            const sheet = document.styleSheets[i];
            for (let j = 0; j < sheet.cssRules.length; j++) {
                if (sheet.cssRules[j].selectorText === '.user-location-marker') {
                    hasStyles = true;
                    break;
                }
            }
        } catch(e) {
            // Cross-origin stylesheet error, ignore
        }
        if (hasStyles) break;
    }
    
    // Add critical styles if not found
    if (!hasStyles) {
        console.log('Adding critical location marker styles');
        const style = document.createElement('style');
        style.textContent = `
            .user-location-marker {
                z-index: 1000 !important;
            }
            .user-location-marker .location-accuracy-circle {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background-color: rgba(33, 150, 243, 0.15);
                transform: scale(1.5);
            }
            .user-location-marker .location-heading {
                position: absolute;
                top: -12px;
                left: 50%;
                width: 0;
                height: 0;
                border-left: 8px solid transparent;
                border-right: 8px solid transparent;
                border-bottom: 16px solid #2196F3;
                transform-origin: bottom center;
                transform: translateX(-50%) rotate(0deg);
                transition: transform 0.5s ease-out;
            }
            .proximity-critical {
                stroke: #F44336 !important;
                stroke-opacity: 1 !important;
                stroke-width: 8 !important;
            }
        `;
        document.head.appendChild(style);
    }
}

// Add initialization hook to ensure styles are applied
document.addEventListener('DOMContentLoaded', function() {
    // Call this immediately and also after a delay to ensure it runs
    ensureLocationMarkerStyles();
    setTimeout(ensureLocationMarkerStyles, 2000);
}); 