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
        }
    };
})(); 