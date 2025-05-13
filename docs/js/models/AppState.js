/**
 * AppState Module
 * Central state management for the application
 */

// Application State
export class AppState {
    constructor() {
        // Application mode ('discovery', 'mapping', 'excavation')
        this.mode = 'discovery';
        
        // Active utility type ('water', 'gas', 'electric', 'sewer', 'telecom')
        this.activeUtilityType = 'water';
        
        // Active line type ('main', 'service')
        this.activeLineType = 'service';
        
        // Drawing state
        this.isDrawing = false;
        this.drawingPoints = []; // Points collected during drawing
        this.tempLine = null; // Temporary line during drawing
        this.potentialConnection = null; // Potential connection when drawing a service line
        this.connectionPointMarker = null; // Marker for connection point
        
        // Measuring state
        this.isMeasuring = false;
        this.measurePoints = []; // Points for measurement
        this.measureLine = null; // Current measurement line
        this.measureStart = null;
        this.measureEnd = null;
        
        // Current action in progress
        this.currentAction = null;
        
        // Excavation mode settings
        this.isExcavationMode = false;
        this.excavationSite = null;
        this.excavationRadius = 5; // Default 5 meter radius
        this.proximityThreshold = 50; // Default 50 feet warning threshold
        
        // Location tracking
        this.trackLocation = false;
        this.highAccuracyWatchId = null;
        this.lastKnownLocation = null;
        this.lastLocationUpdate = null;
        this.locationAccuracy = null;
        this.heading = null;
        this.locationFollowingEnabled = true; // Whether map should follow user location
        
        // Map settings
        this.mapZoom = 18;
        this.mapCenter = [39.7684, -86.1581]; // Default to Indianapolis
        this.activeBaseMap = 'streets';
        this.lastMapCenter = null; // Last map center position
        this.lastMapZoom = null; // Last map zoom level
        
        // UI settings
        this.showUtilityLayers = {
            water: true,
            gas: true,
            electric: true,
            sewer: true,
            telecom: true
        };
        this.showStructureLayers = {
            water: true,
            gas: true,
            electric: true,
            sewer: true,
            telecom: true
        };
        this.showMeasurements = true;
        this.showAnnotations = true;
        
        // Active alerts for proximity warnings
        this.activeAlerts = [];
        this.dismissedAlerts = []; // List of dismissed alerts with timeout
        
        // Selected element
        this.selectedElement = null; // Currently selected utility/structure
        this.tempLocation = null; // Temporary location for adding utilities/structures
        this.userLocation = null; // User's current location
        
        // Repositioning state
        this.repositioningUtility = null; // Utility being repositioned
        this.controlPoints = []; // Control points for repositioning
        
        // Excavation mode properties
        this.distanceThresholds = {
            warning: 50, // Yellow warning (feet)
            caution: 25, // Orange warning (feet)
            danger: 14,  // Red warning (feet)
            critical: 5  // Critical alert (feet)
        };
        
        // Bind methods
        this.setMode = this.setMode.bind(this);
        this.setUtilityType = this.setUtilityType.bind(this);
        this.setLineType = this.setLineType.bind(this);
        this.resetDrawing = this.resetDrawing.bind(this);
        this.resetMeasurement = this.resetMeasurement.bind(this);
        this.resetRepositioning = this.resetRepositioning.bind(this);
        this.setLocationTracking = this.setLocationTracking.bind(this);
    }
    
    /**
     * Set the application mode
     * @param {string} mode 'discovery', 'mapping', or 'excavation'
     */
    setMode(mode) {
        if (['discovery', 'mapping', 'excavation'].includes(mode)) {
            const prevMode = this.mode;
            this.mode = mode;
            
            // Handle mode-specific state changes
            if (mode === 'excavation') {
                this.isExcavationMode = true;
            } else if (prevMode === 'excavation') {
                this.isExcavationMode = false;
            }
            
            // Reset states when changing modes
            this.resetDrawing();
            this.resetMeasurement();
        } else {
            console.error(`Invalid mode: ${mode}`);
        }
    }
    
    /**
     * Set the active utility type
     * @param {string} type 'water', 'gas', 'electric', 'sewer', or 'telecom'
     */
    setUtilityType(type) {
        if (['water', 'gas', 'electric', 'sewer', 'telecom'].includes(type)) {
            this.activeUtilityType = type;
        } else {
            console.error(`Invalid utility type: ${type}`);
        }
    }
    
    /**
     * Set the active line type
     * @param {string} type 'main' or 'service'
     */
    setLineType(type) {
        if (['main', 'service'].includes(type)) {
            this.activeLineType = type;
        } else {
            console.error(`Invalid line type: ${type}`);
        }
    }
    
    /**
     * Toggle the drawing state
     * @param {boolean} isDrawing Whether drawing is active
     */
    setDrawingState(isDrawing) {
        this.isDrawing = isDrawing;
        
        // Reset drawing state when turning off
        if (!isDrawing) {
            this.resetDrawing();
        }
    }
    
    /**
     * Toggle the measurement state
     * @param {boolean} isMeasuring Whether measuring is active
     */
    setMeasuringState(isMeasuring) {
        this.isMeasuring = isMeasuring;
        
        // Reset measurement state when turning off
        if (!isMeasuring) {
            this.resetMeasurement();
        }
    }
    
    /**
     * Toggle location tracking
     * @param {boolean} enableTracking Whether to enable tracking
     */
    setLocationTracking(enableTracking) {
        this.trackLocation = enableTracking;
    }

    /**
     * Reset drawing state
     */
    resetDrawing() {
        this.isDrawing = false;
        this.drawingPoints = [];
        this.potentialConnection = null;
        this.tempLine = null;
        
        if (this.connectionPointMarker) {
            this.connectionPointMarker = null;
        }
    }

    /**
     * Reset measurement state
     */
    resetMeasurement() {
        this.isMeasuring = false;
        this.measurePoints = [];
        this.measureLine = null;
        this.measureStart = null;
        this.measureEnd = null;
    }

    /**
     * Reset repositioning state
     */
    resetRepositioning() {
        this.repositioningUtility = null;
        this.controlPoints = [];
    }
    
    /**
     * Set excavation mode state
     * @param {boolean} enabled Whether excavation mode is enabled
     */
    setExcavationMode(enabled) {
        this.isExcavationMode = enabled;
        
        if (enabled) {
            this.mode = 'excavation';
            // Reset any active alerts when entering excavation mode
            this.activeAlerts = [];
            this.dismissedAlerts = [];
        } else if (this.mode === 'excavation') {
            // Default to discovery mode when exiting excavation
            this.mode = 'discovery';
        }
    }
    
    /**
     * Update user location
     * @param {Object} location The user's location object
     */
    updateUserLocation(location) {
        this.lastKnownLocation = location;
        this.lastLocationUpdate = new Date().getTime();
        
        // Update user location
        if (location && location.coords) {
            this.userLocation = [location.coords.latitude, location.coords.longitude];
            this.locationAccuracy = location.coords.accuracy;
        }
    }
} 