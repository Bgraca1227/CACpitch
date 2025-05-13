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
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // CRITICAL: This strong guard prevents attaching duplicate listeners
        // This method is sometimes called multiple times by recovery scripts
        if (this._listenersInitialized) return;
        this._listenersInitialized = true;
        
        console.log('Setting up event listeners (first initialization)');

        this.setupNavigationListeners();
        this.setupUtilityToolbarListeners();
        this.setupModeToggleListeners();
        this.setupActionButtonListeners();
        this.setupModalListeners();
        this.setupContextMenuListeners();
        this.setupMapListeners();
        this.setupKeyboardListeners();
        this.setupAnnotationHandlers();
        this.setupMeasurementHandlers();
        this.setupLineTypeListeners();
        this.setupRepositioningListeners();
        this.setupExcavationListeners();
        this.setupUtilityInfoCardListeners();
        
        console.log('All event listeners set up');
    }

    /**
     * Setup navigation bar listeners
     */
    setupNavigationListeners() {
        const navButtons = document.querySelectorAll('.nav-button');
        
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                const screen = button.getAttribute('data-screen');
                
                navButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                this.uiController.changeScreen(screen);
            });
        });
    }

    /**
     * Setup utility toolbar listeners
     */
    setupUtilityToolbarListeners() {
        const utilityButtons = document.querySelectorAll('.utility-button');
        
        utilityButtons.forEach(button => {
            button.addEventListener('click', () => {
                const utility = button.getAttribute('data-utility');
                
                utilityButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                this.appState.selectedUtility = utility;
                this.uiController.updateUtilitySelection(utility);
            });
        });
    }

    /**
     * Setup mode toggle listeners
     */
    setupModeToggleListeners() {
        const modeButtons = document.querySelectorAll('.mode-button');
        
        modeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.getAttribute('data-mode');
                
                if (this.appState.mode === mode) return;
                
                if (mode === 'excavation') {
                    this.showExcavationWarning();
                    return;
                }
                
                modeButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                this.appState.mode = mode;
                this.uiController.updateForMode(mode);
                
                if (mode === 'mapping') {
                    this.uiController.showLineTypeSelector();
                } else {
                    this.uiController.hideLineTypeSelector();
                    this.mapController.clearDrawing();
                }
            });
        });
    }

    /**
     * Show excavation mode warning
     */
    showExcavationWarning() {
        // Show confirmation dialog
        const modal = document.getElementById('exit-excavation-modal');
        const messageEl = modal.querySelector('.exit-confirmation-message');
        
        // Change message for entering excavation mode
        messageEl.textContent = 'Excavation mode provides real-time safety alerts for nearby utilities. Do you want to continue?';
        
        // Change button text
        const confirmBtn = document.getElementById('confirm-exit-excavation');
        confirmBtn.textContent = 'Enter Excavation Mode';
        confirmBtn.classList.remove('btn-danger');
        confirmBtn.classList.add('btn-primary');
        
        // Show modal
        modal.style.display = 'flex';
        modal.classList.add('visible');
        
        // Add one-time listener for confirmation
        const confirmHandler = () => {
            this.enterExcavationMode();
            modal.style.display = 'none';
            modal.classList.remove('visible');
            
            // Change button text back for future exits
            confirmBtn.textContent = 'Exit Mode';
            confirmBtn.classList.remove('btn-primary');
            confirmBtn.classList.add('btn-danger');
            
            // Remove this temporary handler
            confirmBtn.removeEventListener('click', confirmHandler);
        };
        
        const cancelHandler = () => {
            modal.style.display = 'none';
            modal.classList.remove('visible');
            
            // Reset mode selection
            document.querySelectorAll('#mode-toggle .mode-button').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector('#mode-toggle .mode-button[data-mode="discovery"]').classList.add('active');
            
            // Remove this temporary handler
            document.getElementById('cancel-exit-excavation').removeEventListener('click', cancelHandler);
        };
        
        // Add temporary handlers
        confirmBtn.addEventListener('click', confirmHandler);
        document.getElementById('cancel-exit-excavation').addEventListener('click', cancelHandler);
    }

    /**
     * Enter excavation mode
     */
    enterExcavationMode() {
        // Set application mode
        this.appState.mode = 'excavation';
        this.appState.isExcavationMode = true;
        
        // Update UI
        this.uiController.updateForMode('excavation');
        
        // Start map tracking
        this.mapController.enableExcavationMode();
        
        // Show notification
        this.uiController.showToast('Excavation mode activated. Click on map to set dig location.', 'warning');
    }

    /**
     * Handle exit excavation request
     */
    handleExitExcavation() {
        // Show confirmation modal
        const modal = document.getElementById('exit-excavation-modal');
        const messageEl = modal.querySelector('.exit-confirmation-message');
        
        // Set message for exiting
        messageEl.textContent = 'Are you sure you want to exit excavation mode? This will disable real-time proximity alerts.';
        
        // Show modal
        modal.style.display = 'flex';
        modal.classList.add('visible');
    }

    /**
     * Cancel exiting excavation mode
     */
    cancelExitExcavation() {
        const modal = document.getElementById('exit-excavation-modal');
        modal.style.display = 'none';
        modal.classList.remove('visible');
    }

    /**
     * Confirm exiting excavation mode
     */
    confirmExitExcavation() {
        // Exit excavation mode
        this.appState.mode = 'discovery';
        this.appState.isExcavationMode = false;
        
        // Update map
        this.mapController.disableExcavationMode();
        
        // Update UI
        this.uiController.updateForMode('discovery');
        
        // Hide confirmation dialog
        const modal = document.getElementById('exit-excavation-modal');
        modal.style.display = 'none';
        modal.classList.remove('visible');
        
        // Show notification
        this.uiController.showToast('Excavation mode deactivated', 'info');
    }

    /**
     * Setup action button listeners
     */
    setupActionButtonListeners() {
        document.getElementById('add-utility-btn').addEventListener('click', () => {
            if (this.appState.mode === 'mapping') {
                this.mapController.drawingMode = true;
                this.uiController.showToast('Click on the map to start drawing a utility line', 'info');
            } else {
                this.uiController.showAddUtilityModal();
            }
        });
        
        document.getElementById('confirm-drawing-btn')?.addEventListener('click', () => {
            const utilityData = this.mapController.finishDrawing();
            if (utilityData) {
                this.uiController.prepopulateUtilityForm(utilityData);
                this.uiController.showAddUtilityModal();
            }
        });
        
        document.getElementById('menu-button').addEventListener('click', () => {
            this.uiController.toggleMainMenu();
        });
        
        document.getElementById('measure-btn')?.addEventListener('click', () => {
            this.mapController.startMeasurement();
        });
        
        document.getElementById('layers-btn')?.addEventListener('click', () => {
            this.uiController.toggleLayersPanel();
        });

        /* Map control buttons that were previously wired in UIController */
        const zoomInBtn  = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const locateBtn  = document.getElementById('locate-btn');
        const recenterBtn = document.getElementById('recenter-btn');

        zoomInBtn?.addEventListener('click', () => {
            this.mapController?.map?.zoomIn();
        });

        zoomOutBtn?.addEventListener('click', () => {
            this.mapController?.map?.zoomOut();
        });

        locateBtn?.addEventListener('click', () => {
            this.mapController?.getUserLocation?.();
        });

        recenterBtn?.addEventListener('click', () => {
            if (this.mapController?.userLocationMarker) {
                this.mapController.map.setView(
                    this.mapController.userLocationMarker.getLatLng(),
                    this.mapController.map.getZoom()
                );
            } else {
                this.mapController?.getUserLocation?.();
            }
        });

        /* Update UI layout responsively */
        window.addEventListener('resize', () => {
            this.uiController?.updateUIPositions?.();
        });
    }

    /**
     * Setup modal listeners
     */
    setupModalListeners() {
        // Add utility modal
        document.getElementById('confirm-add-utility')?.addEventListener('click', () => {
            this.handleAddUtility();
        });
        
        document.getElementById('cancel-add-utility')?.addEventListener('click', () => {
            this.uiController.hideAddUtilityModal();
        });
        
        // Add structure modal
        document.getElementById('confirm-add-structure')?.addEventListener('click', () => {
            this.handleAddStructure();
        });
        
        document.getElementById('cancel-add-structure')?.addEventListener('click', () => {
            this.uiController.hideAddStructureModal();
        });
        
        // Main menu options
        document.getElementById('menu-add-utility')?.addEventListener('click', () => {
            this.uiController.hideMainMenu();
            this.uiController.showAddUtilityModal();
        });
        
        document.getElementById('menu-add-structure')?.addEventListener('click', () => {
            this.uiController.hideMainMenu();
            this.uiController.showAddStructureModal();
        });
        
        document.getElementById('menu-export')?.addEventListener('click', () => {
            this.uiController.hideMainMenu();
            this.exportData();
        });
        
        document.getElementById('menu-import')?.addEventListener('click', () => {
            this.uiController.hideMainMenu();
            this.importData();
        });
        
        // Add main menu close button listener
        document.getElementById('close-main-menu')?.addEventListener('click', () => {
            this.uiController.hideMainMenu();
        });
        
        // Menu-toggle-layers button
        document.getElementById('menu-toggle-layers')?.addEventListener('click', () => {
            this.uiController.hideMainMenu();
            this.uiController.toggleLayersPanel();
        });
        
        // Layers panel close button
        document.getElementById('close-layers')?.addEventListener('click', () => {
            this.uiController.hideLayersPanel();
        });
        
        // Layer panel listeners
        document.getElementById('layer-water')?.addEventListener('change', (e) => {
            this.toggleUtilityLayer('water', e.target.checked);
        });
        
        document.getElementById('layer-gas')?.addEventListener('change', (e) => {
            this.toggleUtilityLayer('gas', e.target.checked);
        });
        
        document.getElementById('layer-electric')?.addEventListener('change', (e) => {
            this.toggleUtilityLayer('electric', e.target.checked);
        });
        
        document.getElementById('layer-sewer')?.addEventListener('change', (e) => {
            this.toggleUtilityLayer('sewer', e.target.checked);
        });
        
        document.getElementById('layer-telecom')?.addEventListener('change', (e) => {
            this.toggleUtilityLayer('telecom', e.target.checked);
        });
        
        // Excavation listeners
        document.getElementById('exit-excavation-btn')?.addEventListener('click', () => {
            this.uiController.showExitConfirmation();
        });
        
        document.getElementById('confirm-exit-excavation')?.addEventListener('click', () => {
            this.mapController.disableExcavationMode();
            this.uiController.hideExitConfirmation();
            this.uiController.showToast('Excavation mode ended', 'info');
            
            const modeButtons = document.querySelectorAll('.mode-button');
            modeButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelector('[data-mode="discovery"]').classList.add('active');
        });
    }

    /**
     * Handle adding a new utility from the form
     */
    handleAddUtility() {
        const selectedUtilityType = document.querySelector('.utility-option.selected')?.getAttribute('data-type');
        const lineType = document.querySelector('input[name="line-type"]:checked')?.value;
        const size = document.getElementById('utility-size')?.value;
        const depth = document.getElementById('utility-depth')?.value;
        const material = document.getElementById('utility-material')?.value;
        const condition = document.getElementById('utility-condition')?.value;
        
        if (!selectedUtilityType || !lineType) return;
        
        const coordinates = this.appState.userLocation ? 
            [this.appState.userLocation] : 
            [this.mapController.map.getCenter()];
        
        const utilityData = {
            id: `utility-${Date.now()}`,
            type: selectedUtilityType,
            lineType: lineType,
            coordinates: coordinates,
            size: parseFloat(size || "0"),
            depth: parseFloat(depth || "0"),
            material: material || "Unknown",
            condition: condition || "Unknown",
            dateAdded: new Date().toISOString()
        };
        
        this.dataStore.addUtility(utilityData);
        this.mapController.renderUtility(utilityData);
        this.uiController.hideAddUtilityModal();
        this.uiController.showToast(`${selectedUtilityType} utility added successfully`, 'success');
    }

    /**
     * Handle adding a new structure from the form
     */
    handleAddStructure() {
        const selectedStructure = document.querySelector('.structure-option.selected');
        if (!selectedStructure) return;
        
        const structureType = selectedStructure.getAttribute('data-structure');
        const utilityType = selectedStructure.getAttribute('data-utility');
        const size = document.getElementById('structure-size')?.value;
        const depth = document.getElementById('structure-depth')?.value;
        const material = document.getElementById('structure-material')?.value;
        const condition = document.getElementById('structure-condition')?.value;
        
        const coordinates = this.appState.userLocation ? 
            this.appState.userLocation : 
            this.mapController.map.getCenter();
        
        const structureData = {
            id: `structure-${Date.now()}`,
            structureType: structureType,
            utilityType: utilityType,
            coordinates: coordinates,
            size: parseFloat(size || "0"),
            depth: parseFloat(depth || "0"),
            material: material || "Unknown",
            condition: condition || "Unknown",
            dateAdded: new Date().toISOString()
        };
        
        this.dataStore.addStructure(structureData);
        this.mapController.renderStructure(structureData);
        this.uiController.hideAddStructureModal();
        this.uiController.showToast(`${structureType} structure added successfully`, 'success');
    }

    /**
     * Toggle utility layer visibility
     */
    toggleUtilityLayer(utilityType, visible) {
        const utilityLayer = this.mapController.utilityLayers[utilityType];
        const structureLayer = this.mapController.structureLayers[utilityType];
        
        if (!utilityLayer || !structureLayer) return;
        
        if (visible) {
            // Add layers to map if they aren't already
            if (!this.mapController.map.hasLayer(utilityLayer)) {
                this.mapController.map.addLayer(utilityLayer);
            }
            if (!this.mapController.map.hasLayer(structureLayer)) {
                this.mapController.map.addLayer(structureLayer);
            }
        } else {
            // Remove layers from map if they're present
            if (this.mapController.map.hasLayer(utilityLayer)) {
                this.mapController.map.removeLayer(utilityLayer);
            }
            if (this.mapController.map.hasLayer(structureLayer)) {
                this.mapController.map.removeLayer(structureLayer);
            }
        }
    }

    /**
     * Export data to file
     */
    exportData() {
        const data = this.dataStore.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `utilitrack-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        this.uiController.showToast('Data exported successfully', 'success');
    }

    /**
     * Import data from file
     */
    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    this.dataStore.importData(data);
                    this.mapController.loadUtilities();
                    this.uiController.showToast('Data imported successfully', 'success');
                } catch (error) {
                    this.uiController.showToast('Error importing data: Invalid file format', 'error');
                }
            };
            
            reader.readAsText(file);
        });
        
        input.click();
    }

    /**
     * Set the application mode
     * @param {string} mode The mode to set ('discovery', 'mapping', or 'excavation')
     */
    setMode(mode) {
        if (mode === this.appState.mode) return;
        
        // Update state
        const previousMode = this.appState.mode;
        this.appState.mode = mode;
        
        // Cancel any active drawing or measurement
        if (this.mapController.drawingMode) {
            this.mapController.clearDrawing();
        }
        
        // Handle excavation mode separately
        if (mode === 'excavation') {
            this.showExcavationWarning();
            return; // showExcavationWarning will handle the rest
        } else if (previousMode === 'excavation') {
            // Exiting excavation mode
            this.mapController.disableExcavationMode();
        }
        
        // Update UI
        this.uiController.updateForMode(mode);
        
        // Show toast
        this.uiController.showToast(`Switched to ${this.capitalizeFirstLetter(mode)} Mode`, 'info');
    }

    /**
     * Set the active utility type
     * @param {string} utilityType The utility type to set
     */
    setUtilityType(utilityType) {
        this.appState.selectedUtility = utilityType;
        
        // Update UI
        document.querySelectorAll('#utility-toolbar .utility-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`#utility-toolbar .utility-button[data-utility="${utilityType}"]`).classList.add('active');
        
        // Show toast
        this.uiController.showToast(`Selected ${utilityType} utility type`, 'info');
    }

    /**
     * Setup measurement handlers
     */
    setupMeasurementHandlers() {
        // Measure button click
        document.getElementById('measure-btn')?.addEventListener('click', () => {
            this.toggleMeasurementMode();
        });

        // Measurement toolbar buttons
        document.querySelectorAll('#measurement-toolbar .measurement-button').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.getAttribute('data-tool');
                this.handleMeasurementTool(tool);
            });
        });

        // Add function to handle measurement tool selection
        if (!this.handleMeasurementTool) {
            this.handleMeasurementTool = (tool) => {
                // Update button states
                document.querySelectorAll('#measurement-toolbar .measurement-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                document.querySelector(`#measurement-toolbar .measurement-button[data-tool="${tool}"]`)?.classList.add('active');
                
                // Handle tool actions
                if (tool === 'measure-distance') {
                    // Reset measurement points
                    this.appState.measurePoints = [];
                    this.uiController.showStatusBar('Click on the map to start measuring');
                } else if (tool === 'add-note') {
                    // Nothing to do, just wait for click
                    this.uiController.showStatusBar('Click on the map to add a note');
                } else if (tool === 'clear-measurements') {
                    // Clear all measurements
                    this.mapController.clearMeasurements();
                    this.uiController.showToast('Measurements cleared', 'info');
                    
                    // Reset to measure distance
                    this.handleMeasurementTool('measure-distance');
                } else if (tool === 'exit-measure') {
                    // Exit measurement mode
                    this.endMeasurementMode();
                }
            };
        }
    }
    
    /**
     * Toggle measurement mode on/off
     */
    toggleMeasurementMode() {
        if (this.appState.isMeasuring) {
            this.endMeasurementMode();
        } else {
            this.startMeasurementMode();
        }
    }
    
    /**
     * Start measurement mode
     */
    startMeasurementMode() {
        // Can't measure in excavation mode
        if (this.appState.mode === 'excavation') {
            this.uiController.showToast('Measurement not available in excavation mode', 'warning');
            return;
        }
        
        // Cancel any active drawing
        if (this.mapController.drawingMode) {
            this.mapController.clearDrawing();
        }
        
        // Start measurement
        this.mapController.startMeasurement();
        
        // Update button state
        document.getElementById('measure-btn').classList.add('active');
    }
    
    /**
     * End measurement mode
     */
    endMeasurementMode() {
        this.mapController.endMeasurement();
        
        // Update button state
        document.getElementById('measure-btn').classList.remove('active');
        
        // Show notification
        this.uiController.showToast('Measurement mode ended', 'info');
    }

    /**
     * Start drawing a utility line
     */
    startUtilityMapping() {
        if (this.appState.mode !== 'mapping') {
            this.setMode('mapping');
        }
        
        this.mapController.drawingMode = true;
        this.appState.isDrawing = true;
        this.uiController.showToast('Click on the map to start drawing a utility line', 'info');
        this.uiController.showStatusBar('Click on the map to add points. Click Finish when done.');
        
        // Change cursor to crosshair
        document.body.style.cursor = 'crosshair';
    }

    /**
     * Finish drawing the current utility line
     */
    finishUtilityDrawing() {
        const points = this.mapController.finishDrawing();
        if (points && points.length >= 2) {
            // Launch the add utility modal with prepared data
            const utilityData = {
                type: this.appState.selectedUtility,
                lineType: this.appState.lineType || 'service',
                coordinates: points,
                size: 4, // Default size
                depth: 3, // Default depth
                material: 'PVC', // Default material
                condition: 'Good' // Default condition
            };
            
            // Add to data store
            if (this.dataStore.addUtility(utilityData)) {
                this.uiController.showToast('Utility line added successfully', 'success');
            }
        } else {
            this.uiController.showToast('Not enough points to create a utility line', 'warning');
        }
        
        // Reset drawing state
        this.appState.isDrawing = false;
        document.body.style.cursor = '';
        this.uiController.hideConfirmDrawingButton();
        this.uiController.hideStatusBar();
    }

    /**
     * Helper method to capitalize the first letter of a string
     * @param {string} string The string to capitalize
     * @returns {string} The capitalized string
     */
    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    /**
     * Add annotation functionality
     */
    setupAnnotationHandlers() {
        // Add annotation button
        document.getElementById('add-annotation-btn')?.addEventListener('click', () => {
            if (this.appState.mode === 'discovery') {
                this.uiController.showToast('Click on the map to add an annotation', 'info');
                this.startAddingAnnotation();
            }
        });
        
        // Annotation text input submit
        document.getElementById('annotation-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.confirmAddAnnotation();
        });
        
        // Cancel annotation button
        document.getElementById('cancel-annotation-btn')?.addEventListener('click', () => {
            this.cancelAddAnnotation();
        });
    }

    /**
     * Start adding an annotation
     */
    startAddingAnnotation() {
        // Set the annotation state
        this.appState.isAddingAnnotation = true;
        
        // Change cursor
        document.getElementById('map').style.cursor = 'crosshair';
        
        // Add one-time click handler for annotation placement
        this.annotationClickHandler = (e) => {
            // Store location
            this.annotationLocation = e.latlng;
            
            // Show annotation dialog
            this.uiController.showAddAnnotationDialog();
            
            // Remove handler after one use
            this.mapController.map.off('click', this.annotationClickHandler);
        };
        
        this.mapController.map.once('click', this.annotationClickHandler);
    }

    /**
     * Confirm adding an annotation
     */
    confirmAddAnnotation() {
        const textInput = document.getElementById('annotation-text');
        const text = textInput.value.trim();
        
        if (text && this.annotationLocation) {
            // Create annotation object
            const annotation = {
                id: this.dataStore.generateId('annotation'),
                text: text,
                latlng: this.annotationLocation,
                createdAt: new Date().toISOString()
            };
            
            // Add to data store
            this.dataStore.annotations.push(annotation);
            this.dataStore.saveData();
            
            // Render on map
            this.mapController.renderAnnotation(annotation);
            
            // Reset state
            this.cancelAddAnnotation();
            
            // Show confirmation
            this.uiController.showToast('Annotation added', 'success');
        } else {
            this.uiController.showToast('Please enter text for the annotation', 'error');
        }
    }

    /**
     * Cancel adding an annotation
     */
    cancelAddAnnotation() {
        // Reset state
        this.appState.isAddingAnnotation = false;
        this.annotationLocation = null;
        
        // Reset cursor
        document.getElementById('map').style.cursor = '';
        
        // Hide dialog
        this.uiController.hideAddAnnotationDialog();
        
        // Remove event handler if it's still active
        if (this.annotationClickHandler) {
            this.mapController.map.off('click', this.annotationClickHandler);
            this.annotationClickHandler = null;
        }
    }

    /**
     * Set the line type for utility drawing
     * @param {string} lineType - 'main' or 'service'
     */
    setLineType(lineType) {
        // Update state
        this.appState.activeLineType = lineType;
        
        // Update UI buttons
        document.querySelectorAll('#line-type-selector .line-type-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`#line-type-selector .line-type-button[data-type="${lineType}"]`).classList.add('active');
        
        // Update any active drawing
        if (this.appState.isDrawing && this.mapController.currentLine) {
            const currentOptions = this.mapController.currentLine.options;
            
            // Update line style based on type
            if (lineType === 'main') {
                this.mapController.currentLine.setStyle({
                    weight: 6,
                    dashArray: null
                });
            } else {
                this.mapController.currentLine.setStyle({
                    weight: 4,
                    dashArray: '8, 8'
                });
            }
        }
        
        // Show notification
        this.uiController.showToast(`Changed to ${lineType === 'main' ? 'Main Line' : 'Service Line'} mode`, 'info');
    }

    /**
     * Setup map-related listeners
     * This is critical for handling map interactions
     */
    setupMapListeners() {
        // Map click handler - most critical event for the application
        this.mapController.map.on('click', (e) => {
            // Close any open UI elements first
            this.uiController.closeContextMenu();
            this.uiController.hideUtilityInfoCard();
            
            // Handle based on current mode and state
            if (this.appState.isMeasuring) {
                this.handleMeasurementClick(e);
                return;
            }
            
            if (this.appState.isDrawing) {
                this.handleDrawingClick(e);
                return;
            }
            
            // Handle excavation mode clicks differently
            if (this.appState.mode === 'excavation') {
                this.handleExcavationClick(e);
                return;
            }
            
            // Store click location for the add utility modal if in discovery mode
            if (this.appState.mode === 'discovery') {
                // Check current zoom level for accuracy warning
                const currentZoom = this.mapController.map.getZoom();
                if (currentZoom < 18) {
                    this.uiController.showToast('For better accuracy, zoom in closer before adding utilities', 'warning');
                }
                
                this.appState.tempLocation = e.latlng;
            }
        });
        
        // Context menu (right click) handler
        this.mapController.map.on('contextmenu', (e) => {
            // Find element under click
            const utility = this.mapController.findNearestUtility(e.latlng, 20);
            const structure = this.mapController.findNearestStructure(e.latlng, 20);
            
            // Determine closest element
            let closestElement = null;
            
            if (utility && structure) {
                // Calculate distances to compare
                const distToUtility = this.mapController.distanceToPolyline(e.latlng, utility.line.getLatLngs());
                const distToStructure = this.mapController.map.distance(e.latlng, structure.latlng);
                
                if (distToUtility < distToStructure) {
                    closestElement = {
                        type: 'utility',
                        element: utility
                    };
                } else {
                    closestElement = {
                        type: 'structure',
                        element: structure
                    };
                }
            } else if (utility) {
                closestElement = {
                    type: 'utility',
                    element: utility
                };
            } else if (structure) {
                closestElement = {
                    type: 'structure',
                    element: structure
                };
            }
            
            // If we found an element, show context menu
            if (closestElement) {
                this.uiController.showContextMenu(e, closestElement);
            }
        });
        
        // Mouse move for drawing preview
        this.mapController.map.on('mousemove', (e) => {
            // Update temp line during drawing
            if (this.appState.isDrawing && this.appState.drawingPoints.length > 0) {
                const points = [...this.appState.drawingPoints, e.latlng];
                this.mapController.showTempLine(points);
            }
            
            // Update measurement line preview
            if (this.appState.isMeasuring && this.appState.measurePoints.length === 1) {
                if (this.appState.measureLine) {
                    this.mapController.map.removeLayer(this.appState.measureLine);
                }
                
                this.appState.measureLine = L.polyline(
                    [this.appState.measurePoints[0], e.latlng],
                    {
                        color: 'var(--primary)',
                        weight: 2,
                        opacity: 0.6,
                        dashArray: '5, 5'
                    }
                ).addTo(this.mapController.map);
            }
            
            // Update connection indicator position if active
            if (this.appState.isDrawing && this.appState.activeLineType === 'service' && this.appState.potentialConnection) {
                this.uiController.updateConnectionIndicatorPosition(this.appState.potentialConnection.connectionPoint);
            }
        });
    }

    /**
     * Handle map click during drawing mode
     * @param {Object} e Map click event
     */
    handleDrawingClick(e) {
        const latlng = e.latlng;
        
        // Add point to drawing
        this.appState.drawingPoints.push(latlng);
        
        // Update status
        const count = this.appState.drawingPoints.length;
        this.uiController.showStatusBar(`Point ${count} added. Click to add more points or use the Finish Drawing button`);
        
        // Show confirm button after at least 2 points
        if (count >= 2) {
            this.uiController.showConfirmDrawingButton();
        }
    }

    /**
     * Start utility drawing
     */
    startUtilityDrawing() {
        // Must be in mapping mode
        if (this.appState.mode !== 'mapping') {
            this.setMode('mapping');
        }
        
        // Start drawing
        this.appState.isDrawing = true;
        this.appState.drawingPoints = [];
        
        // Update status
        this.uiController.showStatusBar('Click on the map to start drawing a utility line. Use the Finish button when done.');
        
        // Update UI
        document.body.style.cursor = 'crosshair';
    }

    /**
     * Finish utility drawing
     */
    finishUtilityDrawing() {
        // Check if we have enough points
        if (this.appState.drawingPoints.length < 2) {
            this.uiController.showToast('Not enough points to create a utility line', 'warning');
            this.cancelDrawing();
            return;
        }
        
        // Create utility object
        const utility = {
            id: this.dataStore.generateId('utility'),
            type: this.appState.activeUtilityType,
            lineType: this.appState.activeLineType,
            points: [...this.appState.drawingPoints],
            size: 4, // Default size
            depth: 3, // Default depth
            material: 'PVC', // Default material
            condition: 'Good', // Default condition
            date: new Date().toISOString(),
            notes: '',
            connections: []
        };
        
        // Handle connection to main if available
        if (this.appState.activeLineType === 'service' && this.appState.potentialConnection) {
            const mainLine = this.appState.potentialConnection.mainLine;
            const connectionPoint = this.appState.potentialConnection.connectionPoint;
            
            // Update the last point to connect precisely to the main
            utility.points[utility.points.length - 1] = connectionPoint;
            
            // Record the connection in both utilities
            utility.connections.push({
                type: 'main',
                targetId: mainLine.id,
                point: connectionPoint,
                date: new Date().toISOString()
            });
            
            mainLine.connections.push({
                type: 'service',
                targetId: utility.id,
                point: connectionPoint,
                date: new Date().toISOString()
            });
            
            // Add a connector marker at the connection point
            const connector = this.mapController.addConnectorMarker(connectionPoint, utility.type);
            
            // Store reference to the connector
            utility.connector = connector;
            
            this.uiController.showToast('Service connected to main line', 'success');
        } else {
            // No connection, just a regular utility line
            this.uiController.showToast('Utility line added successfully', 'success');
        }
        
        // Add to data store
        this.dataStore.utilities[this.appState.activeUtilityType].push(utility);
        
        // Add to map
        this.mapController.addUtilityLine(utility);
        
        // Clean up drawing state
        this.cancelDrawing();
        
        // Save data
        this.dataStore.saveData();
    }

    /**
     * Cancel drawing
     */
    cancelDrawing() {
        // Reset drawing state
        this.appState.isDrawing = false;
        this.appState.drawingPoints = [];
        this.appState.potentialConnection = null;
        
        // Remove temp line if exists
        if (this.appState.tempLine) {
            this.mapController.map.removeLayer(this.appState.tempLine);
            this.appState.tempLine = null;
        }
        
        // Remove connection point marker if exists
        if (this.appState.connectionPointMarker) {
            this.mapController.map.removeLayer(this.appState.connectionPointMarker);
            this.appState.connectionPointMarker = null;
        }
        
        // Update UI
        document.body.style.cursor = '';
        this.uiController.hideStatusBar();
        this.uiController.hideConfirmDrawingButton();
        this.uiController.hideConnectionIndicator();
    }

    /**
     * Setup line type selector listeners
     */
    setupLineTypeListeners() {
        const lineTypeButtons = document.querySelectorAll('#line-type-selector .line-type-button');
        
        lineTypeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const lineType = button.getAttribute('data-type');
                
                // Update active state
                lineTypeButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update app state
                this.appState.activeLineType = lineType;
                
                // Show notification
                this.uiController.showToast(`Selected ${lineType} line type`, 'info');
            });
        });
    }

    /**
     * Setup keyboard listeners for shortcuts
     */
    setupKeyboardListeners() {
        document.addEventListener('keydown', e => {
            // Escape key to cancel current action
            if (e.key === 'Escape') {
                if (this.appState.isDrawing) {
                    this.cancelDrawing();
                    this.uiController.showToast('Drawing canceled', 'info');
                }
                
                if (this.appState.isMeasuring) {
                    this.endMeasurementMode();
                    this.uiController.showToast('Measurement canceled', 'info');
                }
                
                if (this.appState.repositioningUtility) {
                    this.mapController.disableRepositioning(false);
                    this.uiController.showToast('Repositioning canceled', 'info');
                }
            }
            
            // Enter key to complete current action
            if (e.key === 'Enter') {
                if (this.appState.isDrawing && this.appState.drawingPoints.length >= 2) {
                    this.finishUtilityDrawing();
                }
                
                if (this.appState.repositioningUtility) {
                    this.mapController.disableRepositioning(true);
                }
            }
        });
    }

    /**
     * Setup context menu listeners
     */
    setupContextMenuListeners() {
        // Implementation needed
    }

    /**
     * Setup repositioning listeners
     */
    setupRepositioningListeners() {
        // Cancel reposition button
        document.getElementById('cancel-reposition-btn')?.addEventListener('click', () => {
            this.cancelRepositioning();
        });
        
        // Save reposition button
        document.getElementById('save-reposition-btn')?.addEventListener('click', () => {
            this.saveRepositioning();
        });
    }

    /**
     * Setup excavation listeners
     */
    setupExcavationListeners() {
        // Exit excavation button
        document.getElementById('exit-excavation-btn')?.addEventListener('click', () => {
            this.handleExitExcavation();
        });
        
        // Confirm exit excavation
        document.getElementById('confirm-exit-excavation')?.addEventListener('click', () => {
            this.confirmExitExcavation();
        });
        
        // Cancel exit excavation
        document.getElementById('cancel-exit-excavation')?.addEventListener('click', () => {
            this.cancelExitExcavation();
        });

        // Set excavation site on map click
        // (This is already handled by handleExcavationClick method)
    }

    /**
     * Handle map click during measurement mode
     * @param {Object} e Map click event
     */
    handleMeasurementClick(e) {
        if (!this.appState.isMeasuring) return;
        
        // Determine active tool from toolbar
        const activeBtn = document.querySelector('#measurement-toolbar .measurement-button.active');
        if (!activeBtn) return;
        
        const toolType = activeBtn.getAttribute('data-tool');
        if (toolType === 'measure-distance') {
            // Let the MapController handle the measurement point
            this.mapController.handleMeasurementClick(e);
        } else if (toolType === 'add-note') {
            // Store location and open annotation modal
            this.appState.tempLocation = e.latlng;
            this.uiController.showAddAnnotationModal();
        }
    }

    /**
     * Handle map click during excavation mode
     * @param {Object} e Map click event
     */
    handleExcavationClick(e) {
        // In excavation mode a click sets/updates the excavation site
        if (!this.appState.isExcavationMode) return;
        
        console.log('Setting excavation site at', e.latlng);
        
        // Set excavation site through MapController
        this.mapController.setExcavationSite(e.latlng);
        
        // Show confirmation toast
        this.uiController.showToast('Excavation site set. Monitoring for nearby utilities.', 'warning');
        
        // Make the excavation site circle pulse
        const excavationCircle = this.mapController.excavationCircle;
        if (excavationCircle) {
            const element = excavationCircle.getElement();
            if (element) {
                element.classList.add('pulse-excavation');
            }
        }
    }

    /**
     * Show exit excavation confirmation dialog
     */
    showExitExcavationConfirmation() {
        const modal = document.getElementById('exit-excavation-modal');
        if (modal) {
            // Force style directly on the modal to ensure it displays correctly
            modal.style.display = 'flex';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.right = '0';
            modal.style.bottom = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.justifyContent = 'center';
            modal.style.alignItems = 'center';
            modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
            modal.style.zIndex = '9999';
            
            console.log('Exit excavation confirmation dialog displayed');
        } else {
            console.error('Exit excavation modal not found');
        }
    }

    /**
     * Setup utility info card listeners
     */
    setupUtilityInfoCardListeners() {
        // Close info card button
        document.getElementById('info-close-btn')?.addEventListener('click', () => {
            this.uiController.hideUtilityInfoCard();
        });
        
        // Edit utility button - opens the edit modal
        document.getElementById('edit-utility-btn')?.addEventListener('click', () => {
            const utilityId = this.appState.selectedUtilityId;
            if (utilityId) {
                const utility = this.dataStore.getUtilityById(utilityId);
                if (utility) {
                    this.uiController.showEditUtilityModal(utility);
                }
            }
            this.uiController.hideUtilityInfoCard();
        });
        
        // Delete utility button - shows confirmation dialog
        document.getElementById('delete-utility-btn')?.addEventListener('click', () => {
            const utilityId = this.appState.selectedUtilityId;
            if (utilityId) {
                this.uiController.showDeleteConfirmation(utilityId);
            }
            this.uiController.hideUtilityInfoCard();
        });
        
        // Reposition utility button - enters high accuracy repositioning mode
        document.getElementById('reposition-utility-btn')?.addEventListener('click', () => {
            const utilityId = this.appState.selectedUtilityId;
            if (utilityId) {
                const utility = this.dataStore.getUtilityById(utilityId);
                if (utility) {
                    this.startHighAccuracyRepositioning(utility);
                }
            }
            this.uiController.hideUtilityInfoCard();
        });
    }
    
    /**
     * Start high accuracy repositioning for a utility
     * @param {Object} utility The utility to reposition
     */
    startHighAccuracyRepositioning(utility) {
        // Set app state for repositioning
        this.appState.isRepositioning = true;
        this.appState.repositioningUtilityId = utility.id;
        
        // Show the repositioning panel
        this.uiController.showRepositionPanel();
        
        // Find the utility's layer
        const utilityLayer = this.mapController.findUtilityLayerById(utility.id);
        if (!utilityLayer) {
            this.uiController.showToast('Could not find utility to reposition', 'error');
            this.cancelRepositioning();
            return;
        }
        
        // Create repositioning markers along the utility line
        this.createRepositioningHandles(utilityLayer);
        
        // Show toast notification
        this.uiController.showToast('Drag the blue markers to reposition the utility line', 'info');
    }
    
    /**
     * Create repositioning handles at each vertex of the utility line
     * @param {Object} utilityLayer The Leaflet layer for the utility
     */
    createRepositioningHandles(utilityLayer) {
        // Get the coordinates of the utility line
        const latlngs = utilityLayer.getLatLngs();
        this.appState.originalPositions = [...latlngs];
        this.appState.repositioningMarkers = [];
        
        // Create a draggable marker for each vertex
        latlngs.forEach((latlng, index) => {
            const marker = L.marker(latlng, {
                icon: L.divIcon({
                    className: 'reposition-handle',
                    html: '<div class="handle-point"></div>',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                }),
                draggable: true
            }).addTo(this.mapController.map);
            
            // Store original position
            marker.originalPosition = latlng;
            marker.vertexIndex = index;
            
            // Add drag events
            marker.on('drag', (e) => {
                this.handleRepositioningMarkerDrag(e, utilityLayer);
            });
            
            // Store marker in app state
            this.appState.repositioningMarkers.push(marker);
        });
    }
    
    /**
     * Handle repositioning marker drag
     * @param {Event} e The drag event
     * @param {Object} utilityLayer The utility layer being repositioned
     */
    handleRepositioningMarkerDrag(e, utilityLayer) {
        const marker = e.target;
        const index = marker.vertexIndex;
        
        // Get current positions
        const latlngs = utilityLayer.getLatLngs();
        
        // Update the position at this index
        latlngs[index] = marker.getLatLng();
        
        // Update the utility line
        utilityLayer.setLatLngs(latlngs);
    }
    
    /**
     * Cancel utility repositioning
     */
    cancelRepositioning() {
        if (!this.appState.isRepositioning) return;
        
        // Find the utility layer
        const utilityId = this.appState.repositioningUtilityId;
        if (utilityId) {
            const utilityLayer = this.mapController.findUtilityLayerById(utilityId);
            
            // Restore original positions
            if (utilityLayer && this.appState.originalPositions) {
                utilityLayer.setLatLngs(this.appState.originalPositions);
            }
        }
        
        // Remove repositioning markers
        this.clearRepositioningMarkers();
        
        // Hide the repositioning panel
        this.uiController.hideRepositionPanel();
        
        // Reset app state
        this.appState.isRepositioning = false;
        this.appState.repositioningUtilityId = null;
        this.appState.originalPositions = null;
        
        // Show notification
        this.uiController.showToast('Repositioning cancelled', 'info');
    }
    
    /**
     * Save utility repositioning
     */
    saveRepositioning() {
        if (!this.appState.isRepositioning) return;
        
        // Find the utility layer
        const utilityId = this.appState.repositioningUtilityId;
        if (utilityId) {
            const utilityLayer = this.mapController.findUtilityLayerById(utilityId);
            
            if (utilityLayer) {
                // Get the updated positions
                const newPositions = utilityLayer.getLatLngs();
                
                // Update the utility in the data store
                const utility = this.dataStore.getUtilityById(utilityId);
                if (utility) {
                    utility.coordinates = newPositions;
                    this.dataStore.updateUtility(utility);
                    
                    // Show notification
                    this.uiController.showToast('Utility repositioned successfully', 'success');
                }
            }
        }
        
        // Remove repositioning markers
        this.clearRepositioningMarkers();
        
        // Hide the repositioning panel
        this.uiController.hideRepositionPanel();
        
        // Reset app state
        this.appState.isRepositioning = false;
        this.appState.repositioningUtilityId = null;
        this.appState.originalPositions = null;
    }
    
    /**
     * Clear all repositioning markers from the map
     */
    clearRepositioningMarkers() {
        if (this.appState.repositioningMarkers) {
            this.appState.repositioningMarkers.forEach(marker => {
                if (marker) {
                    this.mapController.map.removeLayer(marker);
                }
            });
            this.appState.repositioningMarkers = [];
        }
    }
    
    /**
     * Handle utility delete confirmation
     */
    confirmDeleteUtility() {
        const utilityId = this.appState.selectedUtilityId;
        if (!utilityId) return;
        
        // Get the utility
        const utility = this.dataStore.getUtilityById(utilityId);
        if (!utility) return;
        
        // Remove the utility from the data store
        this.dataStore.deleteUtility(utilityId);
        
        // Remove the utility from the map
        this.mapController.removeUtility(utilityId);
        
        // Hide the confirmation dialog
        this.uiController.hideDeleteConfirmation();
        
        // Show notification
        this.uiController.showToast(`${utility.type.charAt(0).toUpperCase() + utility.type.slice(1)} utility deleted`, 'success');
    }
} 