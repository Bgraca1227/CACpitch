/**
 * DataStore Module
 * Handles data storage and persistence for the application
 */

// Import Leaflet as a global (already loaded via CDN)
const L = window.L;

// Data Collections
export class DataStore {
    constructor() {
        // Initialize data store with empty collections
        this.utilities = {
            water: [],
            gas: [],
            electric: [],
            sewer: [],
            telecom: []
        };
        
        this.structures = {
            water: [],
            gas: [],
            electric: [],
            sewer: [],
            telecom: []
        };
        
        this.annotations = [];
        this.measurements = [];
        
        // Reference to controllers (will be set by main.js)
        this.mapController = null;
        this.uiController = null;
        
        // Track last save time to prevent excessive saves
        this.lastSaveTime = 0;
        this.saveDebounceTime = 500; // ms
        this.pendingSave = false;
        
        // Bind methods
        this.getUtilityById = this.getUtilityById.bind(this);
        this.getStructureById = this.getStructureById.bind(this);
        this.generateId = this.generateId.bind(this);
        this.saveData = this.saveData.bind(this);
        this.loadData = this.loadData.bind(this);
        this.exportData = this.exportData.bind(this);
        this.importData = this.importData.bind(this);
        this.loadInitialData = this.loadInitialData.bind(this);
        this.getUtilities = this.getUtilities.bind(this);
        this.getStructures = this.getStructures.bind(this);
        this.addUtility = this.addUtility.bind(this);
        this.addStructure = this.addStructure.bind(this);
        this.debouncedSave = this.debouncedSave.bind(this);
    }
    
    // Load initial data - returns a promise for async operation
    loadInitialData() {
        return new Promise((resolve, reject) => {
            try {
                const success = this.loadData();
                if (success) {
                    resolve();
                } else {
                    // If no data exists, create empty data structures
                    this.utilities = {
                        water: [],
                        gas: [],
                        electric: [],
                        sewer: [],
                        telecom: []
                    };
                    
                    this.structures = {
                        water: [],
                        gas: [],
                        electric: [],
                        sewer: [],
                        telecom: []
                    };
                    
                    this.annotations = [];
                    this.measurements = [];
                    
                    // Check if we have demo data to load
                    this.loadDemoDataIfEmpty();
                    
                    resolve();
                }
            } catch (error) {
                console.error('Error in loadInitialData:', error);
                // Still resolve but with an error notification
                reject(error);
            }
        });
    }
    
    // Load demo data if no existing data is found
    loadDemoDataIfEmpty() {
        // Skip if any data already exists
        if (this.getUtilities().length > 0 || this.getStructures().length > 0) {
            return;
        }
        
        console.log('No existing data found, loading demo data...');
        
        // Add a simple demo water main
        const waterMain = {
            id: this.generateId('utility'),
            type: 'water',
            lineType: 'main',
            coordinates: [
                [39.7684, -86.1581],
                [39.7686, -86.1579],
                [39.7688, -86.1577]
            ],
            size: 8,
            depth: 4,
            material: 'PVC',
            condition: 'Good',
            notes: 'Demo water main line',
            date: new Date().toISOString()
        };
        
        // Add a demo water service
        const waterService = {
            id: this.generateId('utility'),
            type: 'water',
            lineType: 'service',
            coordinates: [
                [39.7686, -86.1579],
                [39.7687, -86.1580]
            ],
            size: 2,
            depth: 3,
            material: 'Copper',
            condition: 'Good',
            notes: 'Demo water service line',
            date: new Date().toISOString()
        };
        
        // Add a demo gas main
        const gasMain = {
            id: this.generateId('utility'),
            type: 'gas',
            lineType: 'main',
            coordinates: [
                [39.7684, -86.1583],
                [39.7686, -86.1581],
                [39.7688, -86.1579]
            ],
            size: 6,
            depth: 3,
            material: 'Steel',
            condition: 'Good',
            notes: 'Demo gas main line',
            date: new Date().toISOString()
        };
        
        // Add the demo utilities
        this.addUtility(waterMain);
        this.addUtility(waterService);
        this.addUtility(gasMain);
        
        // Add a demo water valve
        const waterValve = {
            id: this.generateId('structure'),
            utilityType: 'water',
            structureType: 'valve',
            coordinates: [39.7686, -86.1579],
            size: 12,
            depth: 3,
            material: 'Cast Iron',
            condition: 'Good',
            notes: 'Demo water valve',
            date: new Date().toISOString()
        };
        
        // Add the demo structure
        this.addStructure(waterValve);
    }
    
    // Get all utilities as a flattened array
    getUtilities() {
        const allUtilities = [];
        for (const type in this.utilities) {
            this.utilities[type].forEach(utility => {
                allUtilities.push(utility);
            });
        }
        return allUtilities;
    }
    
    // Get all structures as a flattened array
    getStructures() {
        const allStructures = [];
        for (const type in this.structures) {
            this.structures[type].forEach(structure => {
                allStructures.push(structure);
            });
        }
        return allStructures;
    }
    
    // Add a utility to the data store
    addUtility(utility) {
        if (!utility || !utility.type) {
            console.error('Cannot add utility: missing required data');
            return false;
        }
        
        // Ensure utility has an ID
        if (!utility.id) {
            utility.id = this.generateId('utility');
        }
        
        // Ensure it has a date
        if (!utility.date) {
            utility.date = new Date().toISOString();
        }
        
        // Add to the appropriate type collection
        if (this.utilities[utility.type]) {
            this.utilities[utility.type].push(utility);
            this.debouncedSave(); // Save after adding
            return true;
        } else {
            console.error('Cannot add utility: invalid type', utility.type);
            return false;
        }
    }
    
    // Add a structure to the data store
    addStructure(structure) {
        if (!structure || !structure.utilityType) {
            console.error('Cannot add structure: missing required data');
            return false;
        }
        
        // Ensure structure has an ID
        if (!structure.id) {
            structure.id = this.generateId('structure');
        }
        
        // Ensure it has a date
        if (!structure.date) {
            structure.date = new Date().toISOString();
        }
        
        // Add to the appropriate type collection
        if (this.structures[structure.utilityType]) {
            this.structures[structure.utilityType].push(structure);
            this.debouncedSave(); // Save after adding
            return true;
        } else {
            console.error('Cannot add structure: invalid utility type', structure.utilityType);
            return false;
        }
    }
    
    // Delete a utility by ID
    deleteUtility(id) {
        let deleted = false;
        
        for (const type in this.utilities) {
            const index = this.utilities[type].findIndex(u => u.id === id);
            if (index !== -1) {
                this.utilities[type].splice(index, 1);
                deleted = true;
                break;
            }
        }
        
        if (deleted) {
            this.debouncedSave(); // Save after deleting
            return true;
        }
        
        return false;
    }
    
    // Delete a structure by ID
    deleteStructure(id) {
        let deleted = false;
        
        for (const type in this.structures) {
            const index = this.structures[type].findIndex(s => s.id === id);
            if (index !== -1) {
                this.structures[type].splice(index, 1);
                deleted = true;
                break;
            }
        }
        
        if (deleted) {
            this.debouncedSave(); // Save after deleting
            return true;
        }
        
        return false;
    }
    
    // Update a utility
    updateUtility(id, updates) {
        let updated = false;
        
        for (const type in this.utilities) {
            const utility = this.utilities[type].find(u => u.id === id);
            if (utility) {
                // Apply updates
                Object.assign(utility, updates);
                updated = true;
                break;
            }
        }
        
        if (updated) {
            this.debouncedSave(); // Save after updating
            return true;
        }
        
        return false;
    }
    
    // Update a structure
    updateStructure(id, updates) {
        let updated = false;
        
        for (const type in this.structures) {
            const structure = this.structures[type].find(s => s.id === id);
            if (structure) {
                // Apply updates
                Object.assign(structure, updates);
                updated = true;
                break;
            }
        }
        
        if (updated) {
            this.debouncedSave(); // Save after updating
            return true;
        }
        
        return false;
    }
    
    // Get a utility by ID
    getUtilityById(id) {
        let found = null;
        
        for (const type in this.utilities) {
            const utility = this.utilities[type].find(u => u.id === id);
            if (utility) {
                found = utility;
                break;
            }
        }
        
        return found;
    }
    
    // Get a structure by ID
    getStructureById(id) {
        let found = null;
        
        for (const type in this.structures) {
            const structure = this.structures[type].find(s => s.id === id);
            if (structure) {
                found = structure;
                break;
            }
        }
        
        return found;
    }
    
    // Generate a unique ID for a new element
    generateId(prefix) {
        return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
    }
    
    // Debounced save to prevent excessive storage operations
    debouncedSave() {
        const now = Date.now();
        
        // If it's been less than the debounce time since the last save, delay it
        if (now - this.lastSaveTime < this.saveDebounceTime) {
            // Clear any pending save
            if (this.pendingSave) {
                clearTimeout(this.pendingSave);
            }
            
            // Schedule a new save
            this.pendingSave = setTimeout(() => {
                this.saveData();
                this.pendingSave = null;
            }, this.saveDebounceTime);
        } else {
            // Save immediately
            this.saveData();
            this.lastSaveTime = now;
        }
    }
    
    // Save data to localStorage
    saveData() {
        try {
            const data = {
                utilities: this.utilities,
                structures: this.structures,
                annotations: this.annotations,
                measurements: this.measurements,
                timestamp: new Date().toISOString()
            };
            
            // Carefully remove circular references and Leaflet objects before saving
            function replacer(key, value) {
                // Skip Leaflet objects and DOM elements
                if (value instanceof L.Layer || 
                    value instanceof L.Map || 
                    value instanceof Element ||
                    (value && value._leaflet_id) || // Leaflet internal property
                    key === 'mapController' ||
                    key === 'uiController' ||
                    key === 'eventHandlers' ||
                    key === 'appState' ||
                    key === 'dataStore' ||
                    key === 'marker' || 
                    key === 'line' ||
                    key === 'editHandles' ||
                    key === 'layer') {
                    return undefined;
                }
                
                // Keep other properties
                return value;
            }
            
            // Use the replacer function to filter out problematic properties
            const cleanData = JSON.stringify(data, replacer);
            
            localStorage.setItem('cac_utilitrack_data', cleanData);
            
            // Additionally, save backup copy to handle corruption
            localStorage.setItem('cac_utilitrack_data_backup', cleanData);
            
            console.log('Data saved successfully');
            return true;
        } catch (error) {
            console.error('Error saving data:', error);
            
            // Show error toast if UI controller is available
            if (this.uiController && typeof this.uiController.showToast === 'function') {
                this.uiController.showToast('Error saving data: ' + error.message, 'error');
            }
            
            return false;
        }
    }
    
    // Load data from localStorage
    loadData() {
        try {
            // Try primary data first
            let savedData = localStorage.getItem('cac_utilitrack_data');
            
            // If primary data is missing or corrupt, try backup
            if (!savedData) {
                console.warn('Primary data not found, trying backup...');
                savedData = localStorage.getItem('cac_utilitrack_data_backup');
                
                if (!savedData) {
                    console.log('No saved data found');
                    return false;
                }
            }
            
            try {
                // Try parsing the data
                const data = JSON.parse(savedData);
                
                // Validate data structure
                if (!data || 
                    !data.utilities || 
                    !data.structures) {
                    console.error('Invalid data format');
                    return false;
                }
                
                // Validate utility types
                const requiredTypes = ['water', 'gas', 'electric', 'sewer', 'telecom'];
                for (const type of requiredTypes) {
                    if (!data.utilities[type] || !Array.isArray(data.utilities[type])) {
                        console.warn(`Missing or invalid ${type} utility array, creating empty array`);
                        data.utilities[type] = [];
                    }
                    
                    if (!data.structures[type] || !Array.isArray(data.structures[type])) {
                        console.warn(`Missing or invalid ${type} structure array, creating empty array`);
                        data.structures[type] = [];
                    }
                }
                
                // Restore data
                this.utilities = data.utilities;
                this.structures = data.structures;
                this.annotations = data.annotations || [];
                this.measurements = data.measurements || [];
                
                console.log('Data loaded successfully');
                return true;
            } catch (parseError) {
                console.error('Error parsing saved data:', parseError);
                
                // Try the backup if the primary data is corrupt
                if (savedData === localStorage.getItem('cac_utilitrack_data')) {
                    console.log('Trying backup data...');
                    const backupData = localStorage.getItem('cac_utilitrack_data_backup');
                    
                    if (backupData) {
                        try {
                            const data = JSON.parse(backupData);
                            
                            // Validate and restore from backup
                            if (data && data.utilities && data.structures) {
                                this.utilities = data.utilities;
                                this.structures = data.structures;
                                this.annotations = data.annotations || [];
                                this.measurements = data.measurements || [];
                                
                                console.log('Data restored from backup');
                                return true;
                            }
                        } catch (backupError) {
                            console.error('Error parsing backup data:', backupError);
                        }
                    }
                }
                
                return false;
            }
        } catch (error) {
            console.error('Error loading data:', error);
            return false;
        }
    }
    
    // Export data as JSON file
    exportData() {
        try {
            // Clean the data for export 
            const exportData = {
                utilities: {},
                structures: {},
                annotations: this.annotations,
                measurements: this.measurements,
                timestamp: new Date().toISOString(),
                version: '1.0'
            };
            
            // Convert utilities for export (removing circular references)
            for (const type in this.utilities) {
                exportData.utilities[type] = this.utilities[type].map(utility => {
                    return {
                        id: utility.id,
                        type: utility.type,
                        lineType: utility.lineType,
                        points: utility.points,
                        coordinates: utility.coordinates,
                        size: utility.size,
                        depth: utility.depth,
                        material: utility.material,
                        condition: utility.condition,
                        notes: utility.notes,
                        date: utility.date,
                        connections: utility.connections,
                        imageData: utility.imageData
                    };
                });
            }
            
            // Convert structures for export
            for (const type in this.structures) {
                exportData.structures[type] = this.structures[type].map(structure => {
                    return {
                        id: structure.id,
                        type: structure.type,
                        utilityType: structure.utilityType,
                        structureType: structure.structureType,
                        latlng: structure.latlng,
                        coordinates: structure.coordinates,
                        size: structure.size,
                        depth: structure.depth,
                        material: structure.material,
                        condition: structure.condition,
                        notes: structure.notes,
                        date: structure.date,
                        connections: structure.connections,
                        imageData: structure.imageData
                    };
                });
            }
            
            // Convert to JSON string
            const jsonString = JSON.stringify(exportData, null, 2);
            
            // Create a download link
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cac-utilitrack-export-${new Date().toISOString().split('T')[0]}.json`;
            
            // Trigger download
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Show success toast if UI controller is available
            if (this.uiController && typeof this.uiController.showToast === 'function') {
                this.uiController.showToast('Data exported successfully', 'success');
            }
            
            return true;
        } catch (error) {
            console.error('Error exporting data:', error);
            
            // Show error toast if UI controller is available
            if (this.uiController && typeof this.uiController.showToast === 'function') {
                this.uiController.showToast('Error exporting data: ' + error.message, 'error');
            }
            
            return false;
        }
    }
    
    // Import data from JSON file
    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            // Validate data format
            if (!data.utilities || !data.structures) {
                throw new Error('Invalid data format');
            }
            
            // Validate utility types
            const requiredTypes = ['water', 'gas', 'electric', 'sewer', 'telecom'];
            for (const type of requiredTypes) {
                if (!data.utilities[type]) {
                    console.warn(`Missing ${type} utility array, creating empty array`);
                    data.utilities[type] = [];
                }
                
                if (!data.structures[type]) {
                    console.warn(`Missing ${type} structure array, creating empty array`);
                    data.structures[type] = [];
                }
            }
            
            // Store the data
            this.utilities = data.utilities;
            this.structures = data.structures;
            this.annotations = data.annotations || [];
            this.measurements = data.measurements || [];
            
            // Save to local storage
            this.saveData();
            
            // Reload utility renderings if map controller is available
            if (this.mapController && typeof this.mapController.loadUtilities === 'function') {
                this.mapController.loadUtilities();
            }
            
            // Show success toast if UI controller is available
            if (this.uiController && typeof this.uiController.showToast === 'function') {
                this.uiController.showToast('Data imported successfully', 'success');
            }
            
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            
            // Show error toast if UI controller is available
            if (this.uiController && typeof this.uiController.showToast === 'function') {
                this.uiController.showToast('Error importing data: ' + error.message, 'error');
            }
            
            return false;
        }
    }
} 