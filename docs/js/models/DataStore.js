/**
 * DataStore Module
 * Handles data storage and persistence for the application
 */

// Import Leaflet as a global (already loaded via CDN)
const L = window.L;

// Data Collections
export class DataStore {
    constructor() {
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
    }
    
    // Load initial data - returns a promise for async operation
    loadInitialData() {
        return new Promise((resolve, reject) => {
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
                
                resolve();
            }
        });
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
        
        // Add to the appropriate type collection
        if (this.utilities[utility.type]) {
            this.utilities[utility.type].push(utility);
            this.saveData(); // Save after adding
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
        
        // Add to the appropriate type collection
        if (this.structures[structure.utilityType]) {
            this.structures[structure.utilityType].push(structure);
            this.saveData(); // Save after adding
            return true;
        } else {
            console.error('Cannot add structure: invalid utility type', structure.utilityType);
            return false;
        }
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
        return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }
    
    // Save data to localStorage
    saveData() {
        try {
            const data = {
                utilities: this.utilities,
                structures: this.structures,
                annotations: this.annotations,
                measurements: this.measurements
            };
            
            // Remove circular references before saving
            const cleanData = JSON.stringify(data, (key, value) => {
                // Skip Leaflet objects
                if (
                    key === 'marker' || 
                    key === 'line' ||
                    key === 'editHandles' ||
                    key === 'layer' ||
                    value instanceof L.Layer ||
                    value instanceof L.Map
                ) {
                    return undefined;
                }
                
                // Keep the rest
                return value;
            });
            
            localStorage.setItem('cac_utilitrack_data', cleanData);
            return true;
        } catch (error) {
            console.error('Error saving data:', error);
            return false;
        }
    }
    
    // Load data from localStorage
    loadData() {
        try {
            const savedData = localStorage.getItem('cac_utilitrack_data');
            
            if (!savedData) {
                return false;
            }
            
            const data = JSON.parse(savedData);
            
            // Restore data
            this.utilities = data.utilities || this.utilities;
            this.structures = data.structures || this.structures;
            this.annotations = data.annotations || this.annotations;
            this.measurements = data.measurements || this.measurements;
            
            return true;
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
                        structureType: structure.structureType,
                        latlng: structure.latlng,
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
            
            return true;
        } catch (error) {
            console.error('Error exporting data:', error);
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
            
            // Store the data
            this.utilities = data.utilities;
            this.structures = data.structures;
            this.annotations = data.annotations || [];
            this.measurements = data.measurements || [];
            
            // Save to local storage
            this.saveData();
            
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }
} 