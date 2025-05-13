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
 * Enhanced with better error handling and component connection
 */
function initApplication() {
    try {
        console.log('Initializing CAC UtiliTrack application...');
        
        // Initialize the data store first and load saved data
        const dataStore = new DataStore();
        dataStore.loadInitialData().catch(err => {
            console.warn('Error loading initial data, continuing with empty store:', err);
        });
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
        
        // Critical! Connect controllers to each other in a centralized way
        connectComponents(appState, dataStore, mapController, uiController, eventHandlers);
        
        // UI must be initialized before map
        uiController.init();
        console.log('UI initialized');
        
        // Initialize map after UI is ready
        setTimeout(() => {
            try {
                // Initialize map
                mapController.initMap();
                console.log('Map initialized');
                
                // Verify map initialization
                if (!mapController.map) {
                    throw new Error('Map initialization failed to create map instance');
                }
                
                // Initialize event handlers after UI and map are ready
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
        }, 500); // Increased delay for better component readiness
        
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

/**
 * Connect all components to each other
 * Centralized function to ensure all cross-references are properly established
 */
function connectComponents(appState, dataStore, mapController, uiController, eventHandlers) {
    // Connect controllers to each other
    mapController.uiController = uiController;
    mapController.eventHandlers = eventHandlers;
    mapController.appState = appState;
    mapController.dataStore = dataStore;
    
    uiController.mapController = mapController;
    uiController.eventHandlers = eventHandlers;
    uiController.appState = appState;
    uiController.dataStore = dataStore;
    
    eventHandlers.mapController = mapController;
    eventHandlers.uiController = uiController;
    eventHandlers.appState = appState;
    eventHandlers.dataStore = dataStore;
    
    // Connect data store to controllers for callbacks
    dataStore.mapController = mapController;
    dataStore.uiController = uiController;
    
    console.log('All component cross-references established');
}

// Try to recover from initialization errors with improved recovery logic
function tryRecovery() {
    console.log('Attempting to recover from initialization errors...');
    
    // Check if components exist
    const componentsExist = window.appState && window.dataStore && 
                           window.mapController && window.uiController && 
                           window.eventHandlers;
    
    if (componentsExist) {
        console.log('Components exist, reconnecting...');
        
        // Reconnect components
        connectComponents(
            window.appState, 
            window.dataStore, 
            window.mapController, 
            window.uiController, 
            window.eventHandlers
        );
        
        // Retry map initialization if needed
        if (window.mapController && !window.mapController.map) {
            console.log('Map not initialized, retrying...');
            try {
                window.mapController.initMap();
            } catch (e) {
                console.error('Map initialization retry failed:', e);
            }
        }
    } else if (typeof window.recoverCAC === 'function') {
        console.log('Using existing recovery function...');
        window.recoverCAC();
    } else {
        console.log('Creating basic recovery...');
        
        // Create basic fallback objects if needed
        if (!window.appState) window.appState = new AppState();
        if (!window.dataStore) window.dataStore = new DataStore();
        
        // Try minimal initialization
        try {
            if (!window.mapController) {
                window.mapController = new MapController(window.appState, window.dataStore);
            }
            
            if (!window.uiController) {
                window.uiController = new UIController(window.appState, window.dataStore, window.mapController);
            }
            
            if (!window.eventHandlers) {
                window.eventHandlers = new EventHandlers(window.appState, window.dataStore, window.mapController, window.uiController);
            }
            
            // Connect components
            connectComponents(
                window.appState, 
                window.dataStore, 
                window.mapController, 
                window.uiController, 
                window.eventHandlers
            );
            
            // Initialize minimal components
            if (!window.mapController.map) {
                window.mapController.initMap();
            }
            
            window.uiController.init();
        } catch (e) {
            console.error('Recovery initialization failed:', e);
        }
        
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

// Create a guaranteed initialization mechanism with improved timing and retries
let initTimeoutId = null;
let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 5; // Increased max attempts

function ensureInitialization() {
    // Check if map is properly initialized
    if (window.mapController && window.mapController.map && 
        window.mapController.map.getContainer) {
        console.log('Application verified as initialized, clearing timeout');
        clearTimeout(initTimeoutId);
        return;
    }
    
    initAttempts++;
    console.log(`Init attempt ${initAttempts}/${MAX_INIT_ATTEMPTS}`);
    
    if (initAttempts <= MAX_INIT_ATTEMPTS) {
        console.log(`App not initialized after ${initAttempts} seconds, retrying...`);
        try {
            if (initAttempts === 1) {
                // First retry, just reconnect components
                if (window.appState && window.mapController) {
                    connectComponents(
                        window.appState, 
                        window.dataStore, 
                        window.mapController, 
                        window.uiController, 
                        window.eventHandlers
                    );
                }
            } else {
                // Full reinitialization on subsequent attempts
                initApplication();
            }
        } catch (e) {
            console.error('Error during retry initialization:', e);
        }
        
        // Schedule next check with increasing delay
        initTimeoutId = setTimeout(ensureInitialization, 1000 * Math.min(initAttempts, 3));
    } else {
        console.warn(`Failed to initialize after ${MAX_INIT_ATTEMPTS} attempts, forcing recovery`);
        tryRecovery();
    }
}

// Initialize the application when DOM content is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM content loaded, initializing application...');
    
    // Check for required scripts and stylesheets
    ensureRequiredResources();
    
    try {
        // Initialize application
        initApplication();
        
        // Start the initialization verification process
        initTimeoutId = setTimeout(ensureInitialization, 1500); // Increased initial check delay

        // Add a failsafe to hide splash screen after 5 seconds
        setTimeout(hideSplashScreen, 5000);
    } catch (error) {
        console.error('Failed to initialize application:', error);
        initErrors.push(error);
        
        // Try fallback initialization
        console.log('Attempting fallback initialization...');
        if (typeof window.recoverCAC === 'function') {
            window.recoverCAC();
        } else {
            tryRecovery();
        }
        
        // Make sure splash screen goes away
        hideSplashScreen();
    }
    
    // Add window resize handler to fix UI positioning
    window.addEventListener('resize', handleWindowResize);
});

// Check that required resources are available
function ensureRequiredResources() {
    // Critical check for Leaflet library
    if (!window.L) {
        console.error('Leaflet library not loaded! Loading dynamically...');
        
        // Load Leaflet CSS
        const leafletCSS = document.createElement('link');
        leafletCSS.rel = 'stylesheet';
        leafletCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
        document.head.appendChild(leafletCSS);
        
        // Load Leaflet JS
        const leafletScript = document.createElement('script');
        leafletScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        leafletScript.onload = function() {
            console.log('Leaflet loaded dynamically, restarting initialization...');
            setTimeout(() => {
                initApplication();
            }, 500);
        };
        document.head.appendChild(leafletScript);
        
        initErrors.push(new Error('Leaflet library not available'));
        
        const warningDiv = document.createElement('div');
        warningDiv.style.position = 'fixed';
        warningDiv.style.top = '10px';
        warningDiv.style.left = '50%';
        warningDiv.style.transform = 'translateX(-50%)';
        warningDiv.style.backgroundColor = 'rgba(255, 152, 0, 0.9)';
        warningDiv.style.color = 'white';
        warningDiv.style.padding = '10px 20px';
        warningDiv.style.borderRadius = '4px';
        warningDiv.style.zIndex = '9999';
        warningDiv.textContent = 'Loading map components... Please wait.';
        document.body.appendChild(warningDiv);
        
        // Remove the warning after a few seconds
        setTimeout(() => {
            if (document.body.contains(warningDiv)) {
                document.body.removeChild(warningDiv);
            }
        }, 10000);
    }
}

// Handle window resize to fix UI positioning
function handleWindowResize() {
    if (window.uiController && typeof window.uiController.updateUIPositions === 'function') {
        window.uiController.updateUIPositions();
    }
    
    // Make sure map gets resized properly
    if (window.mapController && window.mapController.map) {
        window.mapController.map.invalidateSize();
    }
}

// Helper function to hide splash screen with multiple fail-safes
function hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        // Make sure it's visible before trying to animate
        if (splash.style.display !== 'none') {
            splash.style.opacity = '0';
            
            // Use multiple mechanisms to ensure it gets hidden
            setTimeout(() => {
                splash.style.display = 'none';
                splash.setAttribute('aria-hidden', 'true');
            }, 500);
        } else {
            // If it's already not displaying, just make sure it's hidden
            splash.style.display = 'none';
            splash.setAttribute('aria-hidden', 'true');
        }
    }
}

// Enhanced global error handler
window.addEventListener('error', function(event) {
    console.error('Global error:', event.message);
    console.error('at', event.filename, 'line', event.lineno);
    
    // Skip if this is an error in the fix/patch scripts to avoid loops
    if (event.filename && (event.filename.includes('fix.js') || event.filename.includes('patch.js'))) {
        console.warn('Error in fix/patch script, skipping automatic recovery');
        return;
    }
    
    // Save error details for debugging
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
    
    // Show an error toast if UI controller is available
    if (window.uiController && typeof window.uiController.showToast === 'function') {
        window.uiController.showToast('Application error detected', 'error');
    }
    
    // Try automatic recovery if critical components are broken
    if (window.appState && window.dataStore && window.mapController) {
        // Check if map still exists
        if (!window.mapController.map && typeof window.mapController.initMap === 'function') {
            console.log('Map lost, attempting to restore...');
            try {
                window.mapController.initMap();
            } catch (e) {
                console.error('Failed to restore map:', e);
            }
        }
        
        // Try reconnecting components
        connectComponents(
            window.appState,
            window.dataStore,
            window.mapController,
            window.uiController,
            window.eventHandlers
        );
    }
});

// Export the initialization function for potential manual triggering
export { initApplication, connectComponents };

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
        leaflet: !!window.L,
        mapInstance: !!(window.mapController && window.mapController.map)
    };
    
    console.log('Component Status:', status);
    
    // Check if map is initialized
    if (window.mapController && window.mapController.map) {
        console.log('Map Status: Initialized');
        console.log('Map Center:', window.mapController.map.getCenter());
        console.log('Map Zoom:', window.mapController.map.getZoom());
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
            } else if (typeof window.patchCACUtiliTrack === 'function') {
                window.patchCACUtiliTrack();
                return 'Patch applied';
            } else {
                tryRecovery();
                return 'Basic recovery attempted';
            }
        }
    };
}; 