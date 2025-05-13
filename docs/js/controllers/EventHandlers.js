/**
 * CAC UtiliTrack - Event Handlers
 * 
 * Responsible for:
 * - Setting up all event listeners
 * - Delegating actions to the appropriate controllers
 * - Managing user interactions
 */

export class EventHandlers {
    constructor(appState, dataStore, mapController, uiController) {
        this.appState = appState;
        this.dataStore = dataStore;
        this.mapController = mapController;
        this.uiController = uiController;
        
        // Flag to prevent duplicate listeners
        this._listenersInitialized = false;
        
        // Track attached event listeners for cleanup
        this.attachedListeners = new Map();
        
        // Bind methods to maintain context
        this.setupEventListeners = this.setupEventListeners.bind(this);
        this.setMode = this.setMode.bind(this);
        this.setUtilityType = this.setUtilityType.bind(this);
        this.setLineType = this.setLineType.bind(this);
        this.toggleMeasurementMode = this.toggleMeasurementMode.bind(this);
        this.startUtilityDrawing = this.startUtilityDrawing.bind(this);
        this.finishUtilityDrawing = this.finishUtilityDrawing.bind(this);
        this.cancelUtilityDrawing = this.cancelUtilityDrawing.bind(this);
        this.handleAddUtility = this.handleAddUtility.bind(this);
        this.handleAddStructure = this.handleAddStructure.bind(this);
        this.toggleExcavationMode = this.toggleExcavationMode.bind(this);
        this.cleanupEventListeners = this.cleanupEventListeners.bind(this);
    }

    /**
     * Set up all event listeners for the application
     */
    setupEventListeners() {
        // Prevent duplicate listeners
        if (this._listenersInitialized) {
            console.warn('Event listeners already initialized, skipping setup');
            return;
        }
        
        console.log('Setting up event listeners...');
        
        // Clean up any existing listeners first to prevent duplicates
        this.cleanupEventListeners();
        
        // Mode toggle buttons
        this.attachListener('#mode-toggle .mode-button', 'click', this.handleModeClick.bind(this));
        
        // Utility type buttons
        this.attachListener('#utility-toolbar .utility-button', 'click', this.handleUtilityTypeClick.bind(this));
        
        // Line type buttons
        this.attachListener('#line-type-selector .line-type-button', 'click', this.handleLineTypeClick.bind(this));
        
        // Map control buttons
        this.attachListener('#add-utility-btn', 'click', this.startUtilityDrawing.bind(this));
        this.attachListener('#confirm-drawing-btn', 'click', this.finishUtilityDrawing.bind(this));
        this.attachListener('#measure-btn', 'click', this.toggleMeasurementMode.bind(this));
        
        // Add Utility Modal
        this.attachListener('#add-utility-modal .utility-option', 'click', this.handleUtilityOptionClick.bind(this));
        this.attachListener('#confirm-add-utility', 'click', this.handleAddUtility.bind(this));
        this.attachListener('#cancel-add-utility', 'click', () => this.uiController.hideAddUtilityModal());
        this.attachListener('#close-add-utility', 'click', () => this.uiController.hideAddUtilityModal());
        
        // Add Structure Modal
        this.attachListener('#add-structure-modal .structure-option', 'click', this.handleStructureOptionClick.bind(this));
        this.attachListener('#confirm-add-structure', 'click', this.handleAddStructure.bind(this));
        this.attachListener('#cancel-add-structure', 'click', () => this.uiController.hideAddStructureModal());
        this.attachListener('#close-add-structure', 'click', () => this.uiController.hideAddStructureModal());
        
        // Measurement Toolbar
        this.attachListener('#measurement-toolbar .measurement-button', 'click', this.handleMeasurementToolClick.bind(this));
        
        // Context Menu
        this.attachListener('#edit-item', 'click', this.handleEditItem.bind(this));
        this.attachListener('#delete-item', 'click', this.handleDeleteItem.bind(this));
        this.attachListener('#connect-item', 'click', this.handleConnectItem.bind(this));
        this.attachListener('#measure-item', 'click', this.handleMeasureItem.bind(this));
        this.attachListener('#reposition-item', 'click', this.handleRepositionItem.bind(this));
        
        // Layers Panel
        this.attachListener('#layers-btn', 'click', () => this.uiController.toggleLayersPanel());
        this.attachListener('#close-layers', 'click', () => this.uiController.hideLayersPanel());
        this.attachListener('.layer-checkbox', 'change', this.handleLayerToggle.bind(this));
        
        // Main Menu
        this.attachListener('#menu-button', 'click', () => this.uiController.toggleMainMenu());
        this.attachListener('#close-main-menu', 'click', () => this.uiController.hideMainMenu());
        this.attachListener('#menu-add-utility', 'click', this.handleMenuAddUtility.bind(this));
        this.attachListener('#menu-add-structure', 'click', this.handleMenuAddStructure.bind(this));
        this.attachListener('#menu-export', 'click', () => this.dataStore.exportData());
        this.attachListener('#menu-import', 'click', () => this.uiController.importData());
        
        // Utility Info Card
        this.attachListener('#info-close-btn', 'click', () => this.uiController.hideUtilityInfoCard());
        this.attachListener('#edit-utility-btn', 'click', this.handleEditUtility.bind(this));
        this.attachListener('#reposition-utility-btn', 'click', this.handleRepositionUtility.bind(this));
        
        // Excavation Mode
        this.attachListener('.excavation-mode-button', 'click', this.toggleExcavationMode.bind(this));
        this.attachListener('#exit-excavation-btn', 'click', this.handleExitExcavation.bind(this));
        this.attachListener('#confirm-exit-excavation', 'click', () => this.disableExcavationMode());
        this.attachListener('#cancel-exit-excavation', 'click', () => this.uiController.hideExitConfirmation());
        
        // Reposition Panel
        this.attachListener('#cancel-reposition-btn', 'click', this.cancelRepositioning.bind(this));
        this.attachListener('#save-reposition-btn', 'click', this.saveRepositioning.bind(this));
        
        // Delete Confirmation
        this.attachListener('#cancel-delete', 'click', () => this.uiController.hideDeleteConfirmation());
        this.attachListener('#confirm-delete', 'click', this.confirmDelete.bind(this));
        
        // Add navigation bar buttons
        this.attachListener('.nav-button', 'click', this.handleNavigation.bind(this));
        
        // Map click handler to close modals/panels when clicking outside
        document.addEventListener('click', this.handleDocumentClick.bind(this));
        
        // Map click handling through MapController
        
        // Mark as initialized
        this._listenersInitialized = true;
        
        console.log('Event listeners setup complete');
    }
    
    /**
     * Clean up event listeners to prevent duplicates
     */
    cleanupEventListeners() {
        // Clean up tracked listeners
        this.attachedListeners.forEach((handlers, selector) => {
            const elements = document.querySelectorAll(selector);
            
            elements.forEach(element => {
                handlers.forEach(({ eventType, handler }) => {
                    element.removeEventListener(eventType, handler);
                });
            });
        });
        
        // Clear the tracking map
        this.attachedListeners.clear();
        
        console.log('Event listeners cleaned up');
    }
    
    /**
     * Attach an event listener and track it for cleanup
     * @param {string} selector CSS selector for target elements
     * @param {string} eventType Event type to listen for
     * @param {Function} handler Event handler function
     */
    attachListener(selector, eventType, handler) {
        const elements = document.querySelectorAll(selector);
        
        if (elements.length === 0) {
            console.warn(`No elements found for selector: ${selector}`);
            return;
        }
        
        elements.forEach(element => {
            // Wrap the handler to provide consistent event object structure
            const wrappedHandler = (event) => {
                handler(event, element);
            };
            
            // Store the original handler and wrapped handler mapping
            element._originalHandler = handler;
            element._wrappedHandler = wrappedHandler;
            
            // Add the actual event listener
            element.addEventListener(eventType, wrappedHandler);
        });
        
        // Track this listener for cleanup
        if (!this.attachedListeners.has(selector)) {
            this.attachedListeners.set(selector, []);
        }
        
        this.attachedListeners.get(selector).push({
            eventType,
            handler: handler
        });
    }

    /**
     * Handle mode button clicks
     */
    handleModeClick(event, element) {
        const mode = element.getAttribute('data-mode');
        this.setMode(mode);
    }
    
    /**
     * Set the application mode
     * @param {string} mode - The mode to set ('discovery', 'mapping', 'excavation')
     */
    setMode(mode) {
        if (!['discovery', 'mapping', 'excavation'].includes(mode)) {
            console.error(`Invalid mode: ${mode}`);
            return;
        }
        
        // Save previous mode
        const prevMode = this.appState.mode;
        
        // Update app state
        this.appState.setMode(mode);
        
        // Update UI
        this.uiController.updateForMode(mode);
        
        // Special handling for excavation mode
        if (mode === 'excavation' && prevMode !== 'excavation') {
            this.enableExcavationMode();
        } else if (prevMode === 'excavation' && mode !== 'excavation') {
            this.disableExcavationMode();
        }
        
        console.log(`Mode changed: ${prevMode} -> ${mode}`);
    }
    
    /**
     * Handle utility type button clicks
     */
    handleUtilityTypeClick(event, element) {
        const utilityType = element.getAttribute('data-utility');
        this.setUtilityType(utilityType);
    }
    
    /**
     * Set the active utility type
     * @param {string} type - The utility type to set
     */
    setUtilityType(type) {
        if (!['water', 'gas', 'electric', 'sewer', 'telecom'].includes(type)) {
            console.error(`Invalid utility type: ${type}`);
            return;
        }
        
        // Update app state
        this.appState.setUtilityType(type);
        
        // Update UI
        this.uiController.updateUtilitySelection(type);
    }
    
    /**
     * Handle line type button clicks
     */
    handleLineTypeClick(event, element) {
        const lineType = element.getAttribute('data-type');
        this.setLineType(lineType);
    }
    
    /**
     * Set the active line type
     * @param {string} type - The line type to set ('main' or 'service')
     */
    setLineType(type) {
        if (!['main', 'service'].includes(type)) {
            console.error(`Invalid line type: ${type}`);
            return;
        }
        
        // Update app state
        this.appState.setLineType(type);
        
        // Update UI
        const buttons = document.querySelectorAll('#line-type-selector .line-type-button');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-type') === type);
        });
    }
    
    /**
     * Toggle measurement mode
     */
    toggleMeasurementMode() {
        if (this.appState.isMeasuring) {
            // Turn off measurement mode
            this.appState.isMeasuring = false;
            this.mapController.endMeasurement();
            
            // Update UI
            document.getElementById('measure-btn').classList.remove('active');
        } else {
            // Turn on measurement mode
            this.mapController.startMeasurement();
            
            // Update UI
            document.getElementById('measure-btn').classList.add('active');
        }
    }
    
    /**
     * Handle measurement tool button clicks
     */
    handleMeasurementToolClick(event, element) {
        const tool = element.getAttribute('data-tool');
        
        // Remove active class from all measurement buttons
        document.querySelectorAll('#measurement-toolbar .measurement-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        element.classList.add('active');
        
        // Handle different tools
        switch (tool) {
            case 'measure-distance':
                // Reset measurement state
                this.appState.measurePoints = [];
                this.uiController.showStatusBar('Click on the map to start measuring');
                break;
                
            case 'add-note':
                this.uiController.showStatusBar('Click on the map to add a note');
                break;
                
            case 'clear-measurements':
                this.mapController.clearMeasurements();
                break;
                
            case 'exit-measure':
                this.mapController.endMeasurement();
                document.getElementById('measure-btn').classList.remove('active');
                break;
        }
    }
    
    /**
     * Start utility drawing mode
     */
    startUtilityDrawing() {
        if (this.appState.mode !== 'mapping') {
            // Switch to mapping mode automatically
            this.setMode('mapping');
        }
        
        // Enable drawing mode
        this.appState.isDrawing = true;
        this.mapController.drawingMode = true;
        
        // Update UI
        document.body.style.cursor = 'crosshair';
        this.uiController.showConfirmDrawingButton();
        this.uiController.showStatusBar('Click on the map to draw utility line');
        
        // Show toast message
        this.uiController.showToast(`Drawing ${this.appState.activeUtilityType} ${this.appState.activeLineType} line`, 'info');
        
        console.log('Started utility drawing');
    }
    
    /**
     * Finish utility drawing and save
     */
    finishUtilityDrawing() {
        if (!this.appState.isDrawing) return;
        
        // Get the drawn points from the map controller
        const points = this.mapController.finishDrawing();
        
        if (!points || points.length < 2) {
            this.uiController.showToast('Not enough points to create a utility line', 'error');
            this.cancelUtilityDrawing();
            return;
        }
        
        // Show utility form to collect details
        this.uiController.showAddUtilityModal();
        
        // Store temp points for later use
        this.appState.drawingPoints = points;
        
        // Reset drawing state
        this.appState.isDrawing = false;
        this.mapController.drawingMode = false;
        
        // Update UI
        document.body.style.cursor = '';
        this.uiController.hideConfirmDrawingButton();
        this.uiController.hideStatusBar();
    }
    
    /**
     * Cancel utility drawing without saving
     */
    cancelUtilityDrawing() {
        // Reset drawing state
        this.appState.isDrawing = false;
        this.mapController.drawingMode = false;
        this.mapController.clearDrawing();
        
        // Update UI
        document.body.style.cursor = '';
        this.uiController.hideConfirmDrawingButton();
        this.uiController.hideStatusBar();
        this.uiController.showToast('Drawing cancelled', 'info');
    }
    
    /**
     * Handle utility option selection in the add utility modal
     */
    handleUtilityOptionClick(event, element) {
        // Remove selected class from all options
        document.querySelectorAll('#add-utility-modal .utility-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Add selected class to clicked option
        element.classList.add('selected');
    }
    
    /**
     * Handle structure option selection in the add structure modal
     */
    handleStructureOptionClick(event, element) {
        // Remove selected class from all options
        document.querySelectorAll('#add-structure-modal .structure-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Add selected class to clicked option
        element.classList.add('selected');
    }
    
    /**
     * Handle document clicks to close UI elements when clicking outside
     */
    handleDocumentClick(event) {
        // Close context menu when clicking outside
        const contextMenu = document.getElementById('context-menu');
        if (contextMenu.classList.contains('visible') && 
            !contextMenu.contains(event.target)) {
            this.uiController.closeContextMenu();
        }
    }
    
    /**
     * Handle Add Utility form submission
     */
    handleAddUtility() {
        // Get form values
        const utilityType = document.querySelector('#add-utility-modal .utility-option.selected')?.getAttribute('data-type') || this.appState.activeUtilityType;
        const lineType = document.querySelector('#add-utility-modal input[name="line-type"]:checked')?.value || 'service';
        const size = parseFloat(document.getElementById('utility-size').value);
        const depth = parseFloat(document.getElementById('utility-depth').value);
        const material = document.getElementById('utility-material').value;
        const condition = document.getElementById('utility-condition').value;
        const notes = document.getElementById('utility-notes').value;
        
        // Create utility object
        const utility = {
            id: this.dataStore.generateId('utility'),
            type: utilityType,
            lineType: lineType,
            coordinates: this.appState.drawingPoints.map(p => [p.lat, p.lng]),
            size: size,
            depth: depth,
            material: material,
            condition: condition,
            notes: notes,
            date: new Date().toISOString()
        };
        
        // Get photo data if available
        const photoInput = document.getElementById('utility-photo');
        if (photoInput.files && photoInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                utility.imageData = e.target.result;
                // Save utility after image is loaded
                this.saveUtility(utility);
            };
            reader.readAsDataURL(photoInput.files[0]);
        } else {
            // Save utility without image
            this.saveUtility(utility);
        }
        
        // Hide modal
        this.uiController.hideAddUtilityModal();
    }
    
    /**
     * Save a utility to the data store
     */
    saveUtility(utility) {
        // Add to data store
        const success = this.dataStore.addUtility(utility);
        
        if (success) {
            // Add to map
            this.mapController.renderUtility(utility);
            
            // Show success message
            this.uiController.showToast(`${utility.type} ${utility.lineType} added`, 'success');
        } else {
            // Show error message
            this.uiController.showToast('Failed to add utility', 'error');
        }
        
        // Clear drawing points
        this.appState.drawingPoints = [];
    }
    
    /**
     * Handle Add Structure form submission
     */
    handleAddStructure() {
        // Get form values
        const structureOption = document.querySelector('#add-structure-modal .structure-option.selected');
        if (!structureOption) {
            this.uiController.showToast('Please select a structure type', 'error');
            return;
        }
        
        const structureType = structureOption.getAttribute('data-structure');
        const utilityType = structureOption.getAttribute('data-utility');
        const size = parseFloat(document.getElementById('structure-size').value);
        const depth = parseFloat(document.getElementById('structure-depth').value);
        const material = document.getElementById('structure-material').value;
        const condition = document.getElementById('structure-condition').value;
        const notes = document.getElementById('structure-notes').value;
        
        // Create structure object
        const structure = {
            id: this.dataStore.generateId('structure'),
            structureType: structureType,
            utilityType: utilityType,
            coordinates: this.appState.tempLocation,
            size: size,
            depth: depth,
            material: material,
            condition: condition,
            notes: notes,
            date: new Date().toISOString()
        };
        
        // Get photo data if available
        const photoInput = document.getElementById('structure-photo');
        if (photoInput.files && photoInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                structure.imageData = e.target.result;
                // Save structure after image is loaded
                this.saveStructure(structure);
            };
            reader.readAsDataURL(photoInput.files[0]);
        } else {
            // Save structure without image
            this.saveStructure(structure);
        }
        
        // Hide modal
        this.uiController.hideAddStructureModal();
    }
    
    /**
     * Save a structure to the data store
     */
    saveStructure(structure) {
        // Add to data store
        const success = this.dataStore.addStructure(structure);
        
        if (success) {
            // Add to map
            this.mapController.renderStructure(structure);
            
            // Show success message
            this.uiController.showToast(`${structure.utilityType} ${structure.structureType} added`, 'success');
        } else {
            // Show error message
            this.uiController.showToast('Failed to add structure', 'error');
        }
        
        // Clear temp location
        this.appState.tempLocation = null;
    }
    
    /**
     * Handle Edit Item action from context menu
     */
    handleEditItem() {
        const element = this.appState.selectedElement;
        if (!element) return;
        
        this.uiController.closeContextMenu();
        
        if (element.type === 'utility') {
            this.handleEditUtility();
        } else if (element.type === 'structure') {
            this.handleEditStructure();
        }
    }
    
    /**
     * Handle Delete Item action from context menu
     */
    handleDeleteItem() {
        this.uiController.closeContextMenu();
        this.uiController.showDeleteConfirmation();
    }
    
    /**
     * Confirm deletion of selected element
     */
    confirmDelete() {
        const element = this.appState.selectedElement;
        if (!element) return;
        
        this.uiController.hideDeleteConfirmation();
        
        if (element.type === 'utility') {
            // Remove from data store
            this.dataStore.deleteUtility(element.element.id);
            
            // Remove from map
            this.mapController.loadUtilities(); // Refresh all utilities
            
            // Show success message
            this.uiController.showToast('Utility deleted', 'success');
        } else if (element.type === 'structure') {
            // Remove from data store
            this.dataStore.deleteStructure(element.element.id);
            
            // Remove from map
            this.mapController.loadUtilities(); // Refresh all
            
            // Show success message
            this.uiController.showToast('Structure deleted', 'success');
        }
        
        // Clear selected element
        this.appState.selectedElement = null;
    }
    
    /**
     * Toggle excavation mode
     */
    toggleExcavationMode() {
        if (this.appState.isExcavationMode) {
            this.disableExcavationMode();
        } else {
            this.enableExcavationMode();
        }
    }
    
    /**
     * Enable excavation mode
     */
    enableExcavationMode() {
        this.appState.setExcavationMode(true);
        this.mapController.enableExcavationMode();
        this.uiController.showExcavationModeIndicator();
        this.uiController.showExitExcavationButton();
        this.uiController.showToast('Excavation mode enabled - Click on map to set excavation site', 'warning');
    }
    
    /**
     * Disable excavation mode
     */
    disableExcavationMode() {
        this.appState.setExcavationMode(false);
        this.mapController.disableExcavationMode();
        this.uiController.hideExcavationModeIndicator();
        this.uiController.hideExitExcavationButton();
        this.uiController.hideExitConfirmation();
        this.uiController.showToast('Excavation mode disabled', 'info');
    }
    
    /**
     * Handle Exit Excavation button click
     */
    handleExitExcavation() {
        this.uiController.showExitConfirmation();
    }
    
    /**
     * Handle navigation button clicks
     */
    handleNavigation(event, element) {
        const screen = element.getAttribute('data-screen');
        if (screen) {
            // Remove active class from all buttons
            document.querySelectorAll('.nav-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Add active class to clicked button
            element.classList.add('active');
            
            // Change screen
            this.uiController.changeScreen(screen);
        }
    }
    
    /**
     * Handle layer toggle checkbox change
     */
    handleLayerToggle(event, element) {
        const layer = element.getAttribute('data-layer');
        const isChecked = element.checked;
        
        if (!layer) return;
        
        // Update map layers based on checkbox
        if (layer.startsWith('layer-')) {
            const utilityType = layer.replace('layer-', '');
            
            if (this.mapController.utilityLayers[utilityType]) {
                if (isChecked) {
                    this.mapController.utilityLayers[utilityType].addTo(this.mapController.map);
                } else {
                    this.mapController.map.removeLayer(this.mapController.utilityLayers[utilityType]);
                }
            }
        } else if (layer === 'layer-structures') {
            // Toggle all structure layers
            for (const type in this.mapController.structureLayers) {
                if (isChecked) {
                    this.mapController.structureLayers[type].addTo(this.mapController.map);
                } else {
                    this.mapController.map.removeLayer(this.mapController.structureLayers[type]);
                }
            }
        } else if (layer === 'layer-mains') {
            // Toggle main lines (implement in MapController)
        } else if (layer === 'layer-services') {
            // Toggle service lines (implement in MapController)
        }
    }
    
    /**
     * Handle connect item action from context menu
     */
    handleConnectItem() {
        // Implement connection functionality
        this.uiController.closeContextMenu();
    }
    
    /**
     * Handle measure item action from context menu
     */
    handleMeasureItem() {
        this.uiController.closeContextMenu();
        
        // Start measurement mode
        this.toggleMeasurementMode();
    }
    
    /**
     * Handle reposition item action from context menu
     */
    handleRepositionItem() {
        this.uiController.closeContextMenu();
        this.handleRepositionUtility();
    }
    
    /**
     * Handle utility repositioning
     */
    handleRepositionUtility() {
        const element = this.appState.selectedElement;
        if (!element || element.type !== 'utility') return;
        
        // Hide info card if open
        this.uiController.hideUtilityInfoCard();
        
        // Set utility for repositioning
        this.appState.repositioningUtility = element.element;
        
        // Show reposition panel
        this.uiController.showRepositionPanel();
        
        // Start repositioning in map controller
        if (this.mapController.startRepositioning) {
            this.mapController.startRepositioning(element.element);
        }
        
        this.uiController.showToast('Repositioning mode active - Drag control points to reposition', 'info');
    }
    
    /**
     * Cancel utility repositioning
     */
    cancelRepositioning() {
        // Cancel repositioning in map controller
        if (this.mapController.cancelRepositioning) {
            this.mapController.cancelRepositioning();
        }
        
        // Reset app state
        this.appState.resetRepositioning();
        
        // Hide reposition panel
        this.uiController.hideRepositionPanel();
        
        this.uiController.showToast('Repositioning cancelled', 'info');
    }
    
    /**
     * Save utility repositioning
     */
    saveRepositioning() {
        // Save repositioning in map controller
        if (this.mapController.saveRepositioning) {
            this.mapController.saveRepositioning();
        }
        
        // Reset app state
        this.appState.resetRepositioning();
        
        // Hide reposition panel
        this.uiController.hideRepositionPanel();
        
        this.uiController.showToast('Utility position updated', 'success');
    }
    
    /**
     * Handle Edit Utility action
     */
    handleEditUtility() {
        const element = this.appState.selectedElement;
        if (!element || element.type !== 'utility') return;
        
        // Hide info card if open
        this.uiController.hideUtilityInfoCard();
        
        // Show add utility modal with prepopulated values
        this.uiController.showAddUtilityModal();
        
        // Pre-populate form with utility values
        this.uiController.prepopulateUtilityForm(element.element);
    }
    
    /**
     * Handle Edit Structure action
     */
    handleEditStructure() {
        const element = this.appState.selectedElement;
        if (!element || element.type !== 'structure') return;
        
        // Hide info card if open
        this.uiController.hideUtilityInfoCard();
        
        // Show add structure modal with prepopulated values
        this.uiController.showAddStructureModal();
        
        // Pre-populate form with structure values (implement in UIController)
    }
    
    /**
     * Handle menu add utility action
     */
    handleMenuAddUtility() {
        this.uiController.hideMainMenu();
        
        // Show add utility form without drawing
        this.uiController.showAddUtilityModal();
    }
    
    /**
     * Handle menu add structure action
     */
    handleMenuAddStructure() {
        this.uiController.hideMainMenu();
        
        // Show add structure form
        this.uiController.showAddStructureModal();
    }
} 