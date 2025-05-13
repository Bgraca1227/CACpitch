/**
 * CAC UtiliTrack - Main Application Entry Point
 * 
 * This file initializes all components and manages the application lifecycle.
 * It implements a structured initialization process with proper error handling.
 */

// Import application modules
import { AppState } from './models/AppState.js';
import { DataStore } from './models/DataStore.js';
import { MapController } from './controllers/MapController.js';
import { UIController } from './controllers/UIController.js';
import { EventHandlers } from './controllers/EventHandlers.js';

// Application instance - will hold component references
let app = null;

// Initialization errors tracking
const initErrors = [];

/**
 * Application class to manage component lifecycle
 */
class Application {
    constructor() {
        this.appState = null;
        this.dataStore = null;
        this.mapController = null;
        this.uiController = null;
        this.eventHandlers = null;
        this.initialized = false;
        this.initPromise = null;
    }
    
    /**
     * Initialize the application and all components
     * @returns {Promise} Promise that resolves when initialization is complete
     */
    async initialize() {
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = new Promise(async (resolve, reject) => {
            try {
                console.log('Initializing CAC UtiliTrack application...');
                
                // Initialize components in dependency order
                await this.initDataStore();
                await this.initAppState();
                await this.initControllers();
                
                // Connect components using structured approach
                this.connectComponents();
                
                // Initialize UI first
                await this.initUI();
                
                // Then initialize map
                await this.initMap();
                
                // Set up event handlers 
                this.setupEvents();
                
                // Load data
                this.loadData();
                
                // Hide splash screen after initialization
                this.hideSplashScreen();
                
                // Mark as initialized
                this.initialized = true;
                console.log('Application initialization complete');
                
                // Expose limited app interface globally for debugging only
                this.exposeDebugInterface();
                
                resolve(this);
            } catch (error) {
                console.error('Error initializing application:', error);
                initErrors.push(error);
                
                // Try to show error in UI
                this.showInitError(error);
                
                // Try recovery
                this.tryRecovery();
                
                reject(error);
            }
        });
        
        return this.initPromise;
    }
    
    /**
     * Initialize data store
     */
    async initDataStore() {
        try {
            this.dataStore = new DataStore();
            await this.dataStore.loadInitialData();
            console.log('DataStore initialized');
        } catch (error) {
            console.error('Error initializing DataStore:', error);
            // Create minimal data store to allow app to continue
            this.dataStore = new DataStore();
            initErrors.push(error);
        }
    }
    
    /**
     * Initialize app state
     */
    async initAppState() {
        try {
            this.appState = new AppState();
            console.log('AppState initialized');
        } catch (error) {
            console.error('Error initializing AppState:', error);
            // Create minimal state to allow app to continue
            this.appState = { mode: 'discovery' };
            initErrors.push(error);
        }
    }
    
    /**
     * Initialize controllers
     */
    async initControllers() {
        try {
            // Create controllers with minimal dependencies first
            this.mapController = new MapController(this.appState, this.dataStore);
            this.uiController = new UIController(this.appState, this.dataStore);
            this.eventHandlers = new EventHandlers(this.appState, this.dataStore);
            
            console.log('Controllers initialized');
        } catch (error) {
            console.error('Error initializing controllers:', error);
            initErrors.push(error);
            throw error; // This is critical, so rethrow
        }
    }
    
    /**
     * Connect components with references safely
     */
    connectComponents() {
        // Give each controller references it needs
        if (this.mapController) {
            this.mapController.uiController = this.uiController;
            this.mapController.eventHandlers = this.eventHandlers;
        }
        
        if (this.uiController) {
            this.uiController.mapController = this.mapController;
            this.uiController.eventHandlers = this.eventHandlers;
        }
        
        if (this.eventHandlers) {
            this.eventHandlers.mapController = this.mapController;
            this.eventHandlers.uiController = this.uiController;
        }
        
        if (this.dataStore) {
            this.dataStore.mapController = this.mapController;
        }
        
        console.log('Components connected');
    }
    
    /**
     * Initialize UI
     */
    async initUI() {
        if (!this.uiController) return;
        
        try {
            await this.uiController.init();
            console.log('UI initialized');
        } catch (error) {
            console.error('Error initializing UI:', error);
            initErrors.push(error);
        }
    }
    
    /**
     * Initialize map
     */
    async initMap() {
        if (!this.mapController) return;
        
        try {
            // Wrap initMap in a promise to ensure it completes
            await new Promise((resolve, reject) => {
                try {
                    this.mapController.initMap();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
            
            console.log('Map initialized');
        } catch (error) {
            console.error('Error initializing map:', error);
            initErrors.push(error);
        }
    }
    
    /**
     * Set up event handlers
     */
    setupEvents() {
        if (!this.eventHandlers) return;
        
        try {
            this.eventHandlers.setupEventListeners();
            console.log('Event handlers initialized');
        } catch (error) {
            console.error('Error setting up event handlers:', error);
            initErrors.push(error);
        }
    }
    
    /**
     * Load initial data
     */
    loadData() {
        if (!this.mapController) return;
        
        try {
            this.mapController.loadUtilities();
            console.log('Data loaded');
        } catch (error) {
            console.error('Error loading data:', error);
            initErrors.push(error);
        }
    }
    
    /**
     * Hide splash screen 
     */
    hideSplashScreen() {
        try {
            const splash = document.getElementById('splash-screen');
            if (splash) {
                splash.style.opacity = '0';
                setTimeout(() => {
                    splash.style.display = 'none';
                }, 500);
            }
        } catch (error) {
            console.error('Error hiding splash screen:', error);
        }
    }
    
    /**
     * Show initialization error in UI
     */
    showInitError(error) {
        if (this.uiController && typeof this.uiController.showToast === 'function') {
            this.uiController.showToast('Error initializing application: ' + error.message, 'error');
        } else {
            // Fallback error display if UI controller not available
            const errorDiv = document.createElement('div');
            Object.assign(errorDiv.style, {
                position: 'fixed',
                top: '10px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(244, 67, 54, 0.9)',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '4px',
                zIndex: '9999'
            });
            errorDiv.textContent = 'Application initialization failed';
            document.body.appendChild(errorDiv);
        }
    }
    
    /**
     * Try to recover from initialization errors
     */
    tryRecovery() {
        console.log('Attempting to recover from initialization errors...');
        
        // Try existing recovery function if available
        if (typeof window.recoverCAC === 'function') {
            window.recoverCAC();
        } else if (typeof window.patchCACUtiliTrack === 'function') {
            window.patchCACUtiliTrack();
        }
        
        // Always hide splash screen on error
        this.hideSplashScreen();
    }
    
    /**
     * Expose limited interface for debugging only
     * This avoids exposing entire controllers to global scope
     */
    exposeDebugInterface() {
        // Limited access to app components for debugging only
        window.CACApp = {
            version: '1.0.0',
            getState: () => this.appState,
            debug: {
                getAppState: () => this.appState,
                getDataStore: () => this.dataStore,
                getMapController: () => this.mapController,
                getUIController: () => this.uiController,
                getEventHandlers: () => this.eventHandlers,
                getErrors: () => initErrors,
                fix: () => this.tryRecovery()
            }
        };
        
        // For backward compatibility with existing code
        window.appState = this.appState;
        window.dataStore = this.dataStore;
        window.mapController = this.mapController;
        window.uiController = this.uiController;
        window.eventHandlers = this.eventHandlers;
        window.initErrors = initErrors;
    }
}

/**
 * Initialize the application
 */
function initApplication() {
    // Validate Leaflet is available
    if (!window.L) {
        console.error('Leaflet library not loaded!');
        displayCriticalError('Error: Leaflet mapping library failed to load');
        return;
    }
    
    // Create and initialize app
    app = new Application();
    return app.initialize().catch(error => {
        console.error('Application initialization failed:', error);
    });
}

/**
 * Display a critical error when essential components are missing
 */
function displayCriticalError(message) {
    const errorDiv = document.createElement('div');
    Object.assign(errorDiv.style, {
        position: 'fixed',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(244, 67, 54, 0.9)',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '4px',
        zIndex: '9999'
    });
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    // Hide splash screen
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => {splash.style.display = 'none';}, 500);
    }
}

// Initialize the application when DOM content is loaded
document.addEventListener('DOMContentLoaded', initApplication);

// Global error handler
window.addEventListener('error', function(event) {
    console.error('Global error:', event.message, 'at', event.filename, 'line', event.lineno);
    
    // Only show error toast occasionally to prevent error storms
    const now = Date.now();
    const errorKey = `${event.message}|${event.filename}|${event.lineno}`;
    
    if (window._lastErrorTime && 
        window._lastErrorMessage === errorKey && 
        now - window._lastErrorTime < 3000) {
        return;
    }
    
    // Update error tracking
    window._lastErrorTime = now;
    window._lastErrorMessage = errorKey;
    
    // Show error in UI if available
    if (window.uiController && typeof window.uiController.showToast === 'function') {
        window.uiController.showToast('Application error detected', 'error');
    }
});

// Export for potential module use
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