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