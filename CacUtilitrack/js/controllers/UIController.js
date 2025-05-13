/**
 * UIController Module
 * Handles UI elements and interactions
 */

import { AppState } from '../models/AppState.js';
import { DataStore } from '../models/DataStore.js';

export class UIController {
    constructor(appState, dataStore, mapController) {
        this.appState = appState;
        this.dataStore = dataStore;
        this.mapController = mapController;
        
        // Bind methods to maintain 'this' context
        this.init = this.init.bind(this);
        this.updateButtons = this.updateButtons.bind(this);
        this.showStatusBar = this.showStatusBar.bind(this);
        this.hideStatusBar = this.hideStatusBar.bind(this);
        this.showToast = this.showToast.bind(this);
        this.closeContextMenu = this.closeContextMenu.bind(this);
        this.showContextMenu = this.showContextMenu.bind(this);
        // Bind all other methods as needed
    }

    init() {
        this.setupEventListeners();
        this.updateButtons();
        
        // Initialize element positions
        setTimeout(() => {
            this.updateUIPositions();
        }, 500);
        
        // Show/hide line type selector based on initial mode
        if (this.appState.mode === 'mapping') {
            this.showLineTypeSelector();
        } else {
            this.hideLineTypeSelector();
        }
    }
    
    // Update UI based on current app state
    updateButtons() {
        // Update mode buttons
        document.querySelectorAll('#mode-toggle .mode-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`#mode-toggle .mode-button[data-mode="${this.appState.mode}"]`).classList.add('active');
        
        // Update utility type buttons
        document.querySelectorAll('#utility-toolbar .utility-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`#utility-toolbar .utility-button[data-utility="${this.appState.activeUtilityType}"]`).classList.add('active');
        
        // Update line type buttons
        document.querySelectorAll('#line-type-selector .line-type-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`#line-type-selector .line-type-button[data-type="${this.appState.activeLineType}"]`).classList.add('active');
        
        // Update measurement button
        if (this.appState.isMeasuring) {
            document.getElementById('measure-btn').classList.add('active');
        } else {
            document.getElementById('measure-btn').classList.remove('active');
        }
        
        // Update floating action button based on mode
        const addBtn = document.getElementById('add-utility-btn');
        if (this.appState.mode === 'discovery') {
            addBtn.innerHTML = '<i class="fas fa-plus"></i>';
            addBtn.title = 'Add Utility';
            addBtn.style.display = this.appState.isExcavationMode ? 'none' : 'flex';
        } else if (this.appState.mode === 'mapping') {
            addBtn.innerHTML = '<i class="fas fa-draw-polygon"></i>';
            addBtn.title = 'Draw Utility';
            addBtn.style.display = this.appState.isExcavationMode ? 'none' : 'flex';
        } else if (this.appState.mode === 'excavation') {
            addBtn.style.display = 'none';
        }
    }
    
    /* STATUS BAR */
    showStatusBar(message) {
        const statusBar = document.getElementById('status-bar');
        document.getElementById('status-text').innerHTML = message;
        statusBar.classList.add('visible');
    }
    
    hideStatusBar() {
        const statusBar = document.getElementById('status-bar');
        statusBar.classList.remove('visible');
    }
    
    /* TOAST NOTIFICATIONS */
    showToast(message, type = 'info') {
        const container = document.getElementById('notification-container');
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        // Set icon based on type
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'exclamation-circle';
        if (type === 'warning') icon = 'exclamation-triangle';
        
        toast.innerHTML = `
            <div class="toast-icon"><i class="fas fa-${icon}"></i></div>
            <div class="toast-content">${message}</div>
            <button class="toast-close"><i class="fas fa-times"></i></button>
        `;
        
        // Add to container
        container.appendChild(toast);
        
        // Add close event
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.remove('visible');
            setTimeout(() => {
                container.removeChild(toast);
            }, 300);
        });
        
        // Show toast with animation
        setTimeout(() => {
            toast.classList.add('visible');
        }, 10);
        
        // Auto-hide after timeout
        setTimeout(() => {
            if (container.contains(toast)) {
                toast.classList.remove('visible');
                setTimeout(() => {
                    if (container.contains(toast)) {
                        container.removeChild(toast);
                    }
                }, 300);
            }
        }, 5000);
    }
    
    /* CONTEXT MENU */
    showContextMenu(e, element) {
        const contextMenu = document.getElementById('context-menu');
        
        // Position menu at click coordinates
        const x = e.containerPoint.x;
        const y = e.containerPoint.y;
        
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        
        // Store selected element
        this.appState.selectedElement = element;
        
        // Update menu items based on element type
        if (element.type === 'utility') {
            document.getElementById('connect-item').style.display = 'flex';
            document.getElementById('measure-item').style.display = 'flex';
            document.getElementById('reposition-item').style.display = 'flex';
        } else {
            document.getElementById('connect-item').style.display = 'none';
            document.getElementById('measure-item').style.display = 'none';
            document.getElementById('reposition-item').style.display = 'none';
        }
        
        // Show menu
        contextMenu.classList.add('visible');
    }
    
    closeContextMenu() {
        const contextMenu = document.getElementById('context-menu');
        contextMenu.classList.remove('visible');
    }
    
    /* UTILITY INFO CARD */
    showUtilityInfoCard(utility, position) {
        const infoCard = document.getElementById('utility-info-card');
        
        // Set position
        infoCard.style.left = `${position.x}px`;
        infoCard.style.top = `${position.y}px`;
        
        // Fill in utility details
        const utilityTypeNames = {
            water: 'Water',
            gas: 'Gas',
            electric: 'Electric',
            sewer: 'Sewer',
            telecom: 'Telecom'
        };
        
        const lineTypeNames = {
            main: 'Main Line',
            service: 'Service Line'
        };
        
        document.getElementById('info-title').textContent = `${utilityTypeNames[utility.type]} ${lineTypeNames[utility.lineType]}`;
        document.getElementById('info-type').textContent = utilityTypeNames[utility.type];
        document.getElementById('info-line-type').textContent = lineTypeNames[utility.lineType];
        document.getElementById('info-size').textContent = `${utility.size} inches`;
        document.getElementById('info-depth').textContent = `${utility.depth} feet`;
        document.getElementById('info-material').textContent = utility.material || 'Unknown';
        document.getElementById('info-condition').textContent = utility.condition || 'Unknown';
        
        // Format date
        const date = utility.date ? new Date(utility.date) : new Date();
        document.getElementById('info-date').textContent = date.toLocaleString();
        
        // Display image if available
        const imageElement = document.getElementById('info-image');
        if (utility.imageData) {
            imageElement.src = utility.imageData;
            imageElement.style.display = 'block';
        } else {
            imageElement.style.display = 'none';
        }
        
        // Store selected element
        this.appState.selectedElement = {
            type: 'utility',
            element: utility
        };
        
        // Show card
        infoCard.classList.add('visible');
    }
    
    hideUtilityInfoCard() {
        const infoCard = document.getElementById('utility-info-card');
        infoCard.classList.remove('visible');
    }
    
    /* MODALS */
    showAddUtilityModal() {
        const modal = document.getElementById('add-utility-modal');
        
        // Reset form values
        document.querySelectorAll('#add-utility-modal .utility-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Select current utility type
        document.querySelector(`#add-utility-modal .utility-option[data-type="${this.appState.activeUtilityType}"]`).classList.add('selected');
        
        // Set line type to current
        if (this.appState.activeLineType === 'main') {
            document.getElementById('main-type').checked = true;
        } else {
            document.getElementById('service-type').checked = true;
        }
        
        // Reset other form fields
        document.getElementById('utility-size').value = '4';
        document.getElementById('utility-depth').value = '3';
        document.getElementById('utility-material').value = 'PVC';
        document.getElementById('utility-condition').value = 'Good';
        document.getElementById('utility-photo').value = '';
        document.getElementById('utility-notes').value = '';
        
        // Show modal
        modal.classList.add('visible');
        modal.querySelector('.modal-container').style.opacity = '0';
        
        setTimeout(() => {
            modal.querySelector('.modal-container').style.opacity = '1';
        }, 10);
    }
    
    hideAddUtilityModal() {
        const modal = document.getElementById('add-utility-modal');
        modal.querySelector('.modal-container').style.opacity = '0';
        
        setTimeout(() => {
            modal.classList.remove('visible');
        }, 300);
    }
    
    showAddStructureModal() {
        const modal = document.getElementById('add-structure-modal');
        
        // Reset form values
        document.querySelectorAll('#add-structure-modal .structure-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Reset form fields
        document.getElementById('structure-size').value = '24';
        document.getElementById('structure-depth').value = '3';
        document.getElementById('structure-material').value = 'Concrete';
        document.getElementById('structure-condition').value = 'Good';
        document.getElementById('structure-photo').value = '';
        document.getElementById('structure-notes').value = '';
        
        // Show modal
        modal.classList.add('visible');
        modal.querySelector('.modal-container').style.opacity = '0';
        
        setTimeout(() => {
            modal.querySelector('.modal-container').style.opacity = '1';
        }, 10);
    }
    
    hideAddStructureModal() {
        const modal = document.getElementById('add-structure-modal');
        modal.querySelector('.modal-container').style.opacity = '0';
        
        setTimeout(() => {
            modal.classList.remove('visible');
        }, 300);
    }
    
    /* LAYER PANEL */
    toggleLayersPanel() {
        const panel = document.getElementById('layers-panel');
        
        if (panel.classList.contains('visible')) {
            this.hideLayersPanel();
        } else {
            this.showLayersPanel();
        }
    }
    
    showLayersPanel() {
        const panel = document.getElementById('layers-panel');
        panel.classList.add('visible');
    }
    
    hideLayersPanel() {
        const panel = document.getElementById('layers-panel');
        panel.classList.remove('visible');
    }
    
    /* MAIN MENU */
    showMainMenu() {
        const menu = document.getElementById('main-menu-panel');
        
        if (menu) {
            menu.classList.add('visible');
        }
    }
    
    hideMainMenu() {
        const menu = document.getElementById('main-menu-panel');
        
        if (menu) {
            menu.classList.remove('visible');
        }
    }
    
    /* MEASUREMENT UI */
    showMeasurementToolbar() {
        const toolbar = document.getElementById('measurement-toolbar');
        toolbar.classList.add('visible');
        
        // Set the first button as active
        toolbar.querySelectorAll('.measurement-button').forEach(btn => {
            btn.classList.remove('active');
        });
        toolbar.querySelector('.measurement-button[data-tool="measure-distance"]').classList.add('active');
    }
    
    hideMeasurementToolbar() {
        const toolbar = document.getElementById('measurement-toolbar');
        toolbar.classList.remove('visible');
    }
    
    /* ANNOTATION UI */
    showAddAnnotationModal() {
        const modal = document.getElementById('add-annotation-modal');
        
        // Reset form
        document.getElementById('annotation-text').value = '';
        
        // Show modal
        modal.classList.add('visible');
        modal.querySelector('.modal-container').style.opacity = '0';
        
        setTimeout(() => {
            modal.querySelector('.modal-container').style.opacity = '1';
        }, 10);
    }
    
    hideAddAnnotationModal() {
        const modal = document.getElementById('add-annotation-modal');
        modal.querySelector('.modal-container').style.opacity = '0';
        
        setTimeout(() => {
            modal.classList.remove('visible');
        }, 300);
    }
    
    /* DELETE CONFIRMATION */
    showDeleteConfirmation() {
        const modal = document.getElementById('confirm-delete-modal');
        
        // Update message based on element type
        let message = 'Are you sure you want to delete this item? This action cannot be undone.';
        
        if (this.appState.selectedElement) {
            if (this.appState.selectedElement.type === 'utility') {
                message = 'Are you sure you want to delete this utility? This action cannot be undone.';
            } else if (this.appState.selectedElement.type === 'structure') {
                message = 'Are you sure you want to delete this structure? This action cannot be undone.';
            }
        }
        
        document.querySelector('.confirm-dialog-message').textContent = message;
        
        // Show modal
        modal.classList.add('visible');
        modal.querySelector('.confirm-dialog').classList.add('animate-scale');
    }
    
    hideDeleteConfirmation() {
        const modal = document.getElementById('confirm-delete-modal');
        modal.querySelector('.confirm-dialog').classList.remove('animate-scale');
        
        setTimeout(() => {
            modal.classList.remove('visible');
        }, 300);
    }
    
    /* REPOSITIONING UI */
    showRepositionPanel() {
        const panel = document.getElementById('reposition-panel');
        panel.classList.add('visible');
    }
    
    hideRepositionPanel() {
        const panel = document.getElementById('reposition-panel');
        panel.classList.remove('visible');
    }
    
    /* CONNECTION UI */
    showConnectUtilityModal(utility) {
        const modal = document.getElementById('connect-utility-modal');
        
        // Reset form
        document.getElementById('connection-type').value = 'tap';
        document.getElementById('connection-notes').value = '';
        
        // Populate target dropdown
        const dropdown = document.getElementById('connection-target');
        dropdown.innerHTML = ''; // Clear existing options
        
        // Find potential connection targets
        const targets = [];
        
        // Same utility type
        this.dataStore.utilities[utility.type].forEach(u => {
            if (u.id !== utility.id) {
                // Add main lines as potential targets
                if (u.lineType === 'main') {
                    const option = document.createElement('option');
                    option.value = u.id;
                    option.textContent = `${u.type.charAt(0).toUpperCase() + u.type.slice(1)} Main`;
                    dropdown.appendChild(option);
                    targets.push(u);
                }
            }
        });
        
        // Add structures of the same type
        this.dataStore.structures[utility.type].forEach(s => {
            const option = document.createElement('option');
            option.value = s.id;
            option.textContent = `${s.structureType.charAt(0).toUpperCase() + s.structureType.slice(1)}`;
            dropdown.appendChild(option);
            targets.push(s);
        });
        
        // Show or hide target group based on if we have targets
        document.getElementById('connection-target-group').style.display = targets.length > 0 ? 'block' : 'none';
        
        // Store selected utility
        this.appState.selectedElement = {
            type: 'utility',
            element: utility
        };
        
        // Show modal
        modal.classList.add('visible');
        modal.querySelector('.modal-container').style.opacity = '0';
        
        setTimeout(() => {
            modal.querySelector('.modal-container').style.opacity = '1';
        }, 10);
    }
    
    hideConnectUtilityModal() {
        const modal = document.getElementById('connect-utility-modal');
        modal.querySelector('.modal-container').style.opacity = '0';
        
        setTimeout(() => {
            modal.classList.remove('visible');
        }, 300);
    }
    
    /* IMPORT/EXPORT UI */
    importData() {
        // Create file input element
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        
        // Handle file selection
        input.onchange = function() {
            if (!input.files || !input.files[0]) return;
            
            const file = input.files[0];
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const jsonString = e.target.result;
                const success = this.dataStore.importData(jsonString);
                
                if (success) {
                    this.showToast('Data imported successfully', 'success');
                    // We'll need to render the imported data
                    if (typeof window.mapController !== 'undefined') {
                        window.mapController.renderAllData();
                    }
                } else {
                    this.showToast('Error importing data', 'error');
                }
            }.bind(this);
            
            reader.readAsText(file);
        };
        
        // Trigger file selection dialog
        input.click();
    }
    
    /* CLOSE ALL MODALS */
    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.remove('visible');
        });
    }
    
    /* DRAWING UI */
    showConfirmDrawingButton() {
        const btn = document.getElementById('confirm-drawing-btn');
        btn.classList.add('visible');
        
        // Ensure the button has the event listener
        if (!btn._hasClickListener) {
            btn.addEventListener('click', () => {
                if (this.appState.isDrawing && this.appState.drawingPoints.length >= 2) {
                    this.eventHandlers.finishUtilityDrawing();
                }
            });
            btn._hasClickListener = true;
        }
    }
    
    hideConfirmDrawingButton() {
        const btn = document.getElementById('confirm-drawing-btn');
        btn.classList.remove('visible');
    }
    
    /* LINE TYPE SELECTOR */
    showLineTypeSelector() {
        const selector = document.getElementById('line-type-selector');
        
        // Update active button based on current line type
        selector.querySelectorAll('.line-type-button').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeButton = selector.querySelector(`.line-type-button[data-type="${this.appState.activeLineType}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
        
        // Show the selector
        selector.classList.add('visible');
    }
    
    hideLineTypeSelector() {
        const selector = document.getElementById('line-type-selector');
        selector.classList.remove('visible');
    }
    
    /* ZOOM WARNING */
    showZoomWarning() {
        const warning = document.getElementById('zoom-warning');
        warning.classList.add('visible');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideZoomWarning();
        }, 5000);
    }
    
    hideZoomWarning() {
        const warning = document.getElementById('zoom-warning');
        warning.classList.remove('visible');
    }
    
    /* CONNECTION INDICATOR */
    showConnectionIndicator(latlng, utilityType) {
        const indicator = document.getElementById('connection-indicator');
        const icon = document.getElementById('connection-indicator-icon');
        
        // Position indicator at connection point
        const point = this.mapController.map.latLngToContainerPoint(latlng);
        indicator.style.left = `${point.x + 20}px`;
        indicator.style.top = `${point.y - 20}px`;
        
        // Update indicator styling based on utility type
        icon.className = `connection-indicator-icon ${utilityType}`;
        document.getElementById('connection-indicator-text').textContent = `Connect to ${utilityType} Main`;
        
        // Setup confirm connection button
        document.getElementById('confirm-connection-btn').addEventListener('click', () => {
            if (this.appState.isDrawing && this.appState.potentialConnection) {
                this.eventHandlers.finishUtilityDrawing();
            }
        }, { once: true }); // Important: use once to prevent multiple handlers
        
        // Show indicator
        indicator.classList.add('visible');
    }
    
    hideConnectionIndicator() {
        const indicator = document.getElementById('connection-indicator');
        indicator.classList.remove('visible');
    }
    
    updateConnectionIndicatorPosition(latlng) {
        const indicator = document.getElementById('connection-indicator');
        if (indicator && indicator.classList.contains('visible')) {
            const point = this.mapController.map.latLngToContainerPoint(latlng);
            indicator.style.left = `${point.x + 20}px`;
            indicator.style.top = `${point.y - 20}px`;
        }
    }

    /* EXCAVATION MODE UI */
    showExcavationModeIndicator() {
        const indicator = document.getElementById('excavation-indicator');
        if (indicator) {
            indicator.classList.add('visible');
        }
    }
    
    hideExcavationModeIndicator() {
        const indicator = document.getElementById('excavation-indicator');
        if (indicator) {
            indicator.classList.remove('visible');
        }
    }
    
    showExitExcavationButton() {
        const button = document.getElementById('exit-excavation-btn');
        if (button) {
            button.classList.add('visible');
        }
    }
    
    hideExitExcavationButton() {
        const button = document.getElementById('exit-excavation-btn');
        if (button) {
            button.classList.remove('visible');
        }
    }
    
    showExitConfirmation() {
        const modal = document.getElementById('exit-excavation-modal');
        modal.classList.add('visible');
    }
    
    hideExitConfirmation() {
        const modal = document.getElementById('exit-excavation-modal');
        modal.classList.remove('visible');
    }
    
    disableDrawingControls() {
        document.getElementById('add-utility-btn').style.display = 'none';
        document.getElementById('measure-btn').style.display = 'none';
        document.getElementById('layers-btn').style.display = 'none';
    }
    
    enableDrawingControls() {
        document.getElementById('add-utility-btn').style.display = 'flex';
        document.getElementById('measure-btn').style.display = 'flex';
        document.getElementById('layers-btn').style.display = 'flex';
    }
    
    /* PROXIMITY ALERTS */
    createProximityAlert(alert) {
        const container = document.getElementById('proximity-alerts');
        const utility = alert.utility;
        const distance = alert.distance;
        
        // Create alert element
        const alertElement = document.createElement('div');
        alertElement.className = 'proximity-alert danger';
        alertElement.id = `alert-${utility.id}`;
        
        // Icon for utility type
        const icons = {
            water: 'tint',
            gas: 'fire',
            electric: 'bolt',
            sewer: 'toilet',
            telecom: 'phone'
        };
        
        // Get utility type name
        const typeNames = {
            water: 'Water',
            gas: 'Gas',
            electric: 'Electric',
            sewer: 'Sewer',
            telecom: 'Telecom'
        };
        
        // Utility type color
        const typeColors = {
            water: '#29b6f6',
            gas: '#ffb300',
            electric: '#ffee58',
            sewer: '#8d6e63',
            telecom: '#ab47bc'
        };
        
        // Create HTML content
        alertElement.innerHTML = `
            <div class="proximity-alert-header" style="background-color: ${typeColors[utility.type]}">
                <div class="proximity-alert-title">
                    <i class="fas fa-${icons[utility.type]}"></i>
                    <span>${typeNames[utility.type]} Line Nearby</span>
                </div>
                <button class="proximity-alert-dismiss" data-utility-id="${utility.id}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="proximity-alert-body">
                <div class="proximity-alert-info">
                    <div class="proximity-info-item">
                        <div class="proximity-info-label">Line Type</div>
                        <div class="proximity-info-value">${utility.lineType === 'main' ? 'Main Line' : 'Service Line'}</div>
                    </div>
                    <div class="proximity-info-item">
                        <div class="proximity-info-label">Size</div>
                        <div class="proximity-info-value">${utility.size ? utility.size + ' in' : 'Unknown'}</div>
                    </div>
                    <div class="proximity-info-item">
                        <div class="proximity-info-label">Depth</div>
                        <div class="proximity-info-value">${utility.depth ? utility.depth + ' ft' : 'Unknown'}</div>
                    </div>
                    <div class="proximity-info-item">
                        <div class="proximity-info-label">Material</div>
                        <div class="proximity-info-value">${utility.material || 'Unknown'}</div>
                    </div>
                </div>
            </div>
            <div class="proximity-alert-footer">
                <div class="proximity-distance" style="color: ${this.getDistanceColor(distance)}">
                    <i class="fas fa-ruler-horizontal"></i>
                    <span id="distance-${utility.id}">${distance.toFixed(1)} ft</span>
                </div>
                <div class="proximity-timer" id="timer-${utility.id}">Tap × to dismiss</div>
            </div>
        `;
        
        // Add to container
        container.appendChild(alertElement);
        
        // Add click handler for dismiss button
        const dismissBtn = alertElement.querySelector('.proximity-alert-dismiss');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                this.dismissProximityAlert(utility.id);
            });
        }
        
        // Add haptic feedback if supported
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
        
        // Play sound if supported and enabled
        this.playAlertSound();
        
        // Store element reference
        alert.element = alertElement;
        
        // Show with animation
        setTimeout(() => {
            alertElement.classList.add('visible');
        }, 10);
    }
    
    getDistanceColor(distance) {
        if (distance <= 5) {
            return 'var(--danger)';
        } else if (distance <= 15) {
            return 'var(--warning)';
        } else {
            return 'var(--info)';
        }
    }
    
    playAlertSound() {
        // Create audio element if it doesn't exist
        if (!this.alertSound) {
            this.alertSound = new Audio();
            // Simple beep sound
            this.alertSound.src = 'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//vQxAAATmknABUwAAAAAmkkAFXAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
        }
        
        // Play the sound
        try {
            this.alertSound.play();
        } catch (e) {
            console.log('Could not play alert sound:', e);
        }
    }
    
    dismissProximityAlert(utilityId) {
        const alertIndex = this.appState.activeAlerts.findIndex(a => a.utilityId === utilityId);
        
        if (alertIndex >= 0) {
            const alert = this.appState.activeAlerts[alertIndex];
            this.removeProximityAlert(alert);
            
            // Remove from active alerts but don't add it again for 15 minutes
            this.appState.activeAlerts.splice(alertIndex, 1);
            
            // Initialize dismissedAlerts array if it doesn't exist
            if (!this.appState.dismissedAlerts) {
                this.appState.dismissedAlerts = [];
            }
            
            // Add to dismissed alerts with 5-minute timeout (300,000 ms)
            const dismissedUntil = new Date().getTime() + (5 * 60 * 1000);
            
            // Store in dismissed alerts
            this.appState.dismissedAlerts.push({
                utilityId: utilityId,
                dismissedUntil: dismissedUntil
            });
            
            // Show toast confirming dismissal
            this.showToast(`Alert dismissed for 5 minutes`, 'info');
        }
    }
    
    startAlertTimer(alert) {
        const timerElement = document.getElementById(`timer-${alert.utilityId}`);
        
        // No countdown timer needed anymore - we're using dismissal timeout instead
        if (timerElement) {
            timerElement.textContent = "Tap × to dismiss";
        }
        
        // Clear any existing timer
        if (alert.timer) {
            clearInterval(alert.timer);
        }
        
        // We don't need to set a timer anymore
        alert.timer = null;
    }
    
    closeAllProximityAlerts() {
        const container = document.getElementById('proximity-alerts');
        container.innerHTML = '';
        
        this.appState.activeAlerts.forEach(alert => {
            if (alert.timer) {
                clearInterval(alert.timer);
            }
        });
        
        this.appState.activeAlerts = [];
        this.appState.dismissedAlerts = []; // Clear dismissed alerts too
    }
    
    /* POSITIONING UTILITIES */
    updateUIPositions() {
        // Position connection indicator when it's visible
        const connectionIndicator = document.getElementById('connection-indicator');
        if (connectionIndicator && connectionIndicator.classList.contains('visible') && this.appState.potentialConnection) {
            const point = this.mapController.map.latLngToContainerPoint(this.appState.potentialConnection.connectionPoint);
            connectionIndicator.style.left = `${point.x + 20}px`;
            connectionIndicator.style.top = `${point.y - 20}px`;
        }
    }
    
    updateConfirmButtonPosition() {
        const navBar = document.getElementById('nav-bar');
        const button = document.getElementById('confirm-drawing-btn');
        const navHeight = navBar.offsetHeight;
        
        button.style.bottom = `${navHeight + 60}px`;
    }
    
    updateRepositionPanelPosition() {
        const navBar = document.getElementById('nav-bar');
        const panel = document.getElementById('reposition-panel');
        const navHeight = navBar.offsetHeight;
        
        panel.style.bottom = `${navHeight + 20}px`;
    }
    
    /* EVENT LISTENERS SETUP */
    setupEventListeners() {
        // Mode toggle
        document.querySelectorAll('#mode-toggle .mode-button').forEach(btn => {
            btn.addEventListener('click', e => {
                const mode = e.target.closest('.mode-button').getAttribute('data-mode');
                // This will be handled by the EventHandlers class
                this.mapController.eventHandlers.setMode(mode);
            });
        });
        
        // Utility type buttons
        document.querySelectorAll('#utility-toolbar .utility-button').forEach(btn => {
            btn.addEventListener('click', e => {
                const utilityType = e.target.closest('.utility-button').getAttribute('data-utility');
                // This will be handled by the EventHandlers class
                this.mapController.eventHandlers.setUtilityType(utilityType);
            });
        });
        
        // Map controls
        document.getElementById('zoom-in-btn').addEventListener('click', () => {
            this.mapController.map.zoomIn();
        });
        
        document.getElementById('zoom-out-btn').addEventListener('click', () => {
            this.mapController.map.zoomOut();
        });
        
        document.getElementById('locate-btn').addEventListener('click', () => {
            this.mapController.getUserLocation();
        });
        
        document.getElementById('recenter-btn').addEventListener('click', () => {
            if (this.mapController.userLocationMarker) {
                this.mapController.map.setView(this.mapController.userLocationMarker.getLatLng());
            }
        });
        
        document.getElementById('layers-btn').addEventListener('click', () => {
            this.toggleLayersPanel();
        });
        
        document.getElementById('measure-btn').addEventListener('click', () => {
            this.mapController.eventHandlers.toggleMeasurementMode();
        });
        
        // Action buttons
        document.getElementById('add-utility-btn').addEventListener('click', () => {
            if (this.appState.mode === 'discovery') {
                this.showAddUtilityModal();
            } else {
                this.mapController.eventHandlers.startUtilityMapping();
            }
        });
        
        // Menu button
        document.getElementById('menu-button').addEventListener('click', () => {
            this.showMainMenu();
        });
        
        // Close buttons for modals
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeAllModals();
            });
        });
        
        // Context menu actions
        document.getElementById('edit-item').addEventListener('click', () => {
            if (this.appState.selectedElement) {
                if (this.appState.selectedElement.type === 'utility') {
                    this.showEditUtilityModal(this.appState.selectedElement.element);
                } else if (this.appState.selectedElement.type === 'structure') {
                    this.showEditStructureModal(this.appState.selectedElement.element);
                }
            }
            this.closeContextMenu();
        });
        
        document.getElementById('delete-item').addEventListener('click', () => {
            if (this.appState.selectedElement) {
                this.showDeleteConfirmation();
            }
            this.closeContextMenu();
        });
        
        // Exit Excavation Button
        const exitExcavationBtn = document.getElementById('exit-excavation-btn');
        if (exitExcavationBtn) {
            exitExcavationBtn.addEventListener('click', () => {
                this.showExitConfirmation();
            });
        }
        
        // Confirm drawing button
        const confirmDrawingBtn = document.getElementById('confirm-drawing-btn');
        if (confirmDrawingBtn) {
            confirmDrawingBtn.addEventListener('click', () => {
                if (this.appState.isDrawing && this.appState.drawingPoints.length >= 2) {
                    this.mapController.eventHandlers.finishUtilityDrawing();
                }
            });
        }
        
        // Handle window resize events
        window.addEventListener('resize', () => {
            this.updateUIPositions();
        });
        
        console.log("UI event listeners initialized");
    }

    /**
     * Update the UI for the given mode
     * @param {string} mode The app mode ('discovery', 'mapping', or 'excavation')
     */
    updateForMode(mode) {
        // Update button states
        document.querySelectorAll('#mode-toggle .mode-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`#mode-toggle .mode-button[data-mode="${mode}"]`).classList.add('active');
        
        // Show or hide mode-specific UI elements
        if (mode === 'mapping') {
            this.showLineTypeSelector();
            document.getElementById('add-utility-btn').innerHTML = '<i class="fas fa-draw-polygon"></i>';
            document.getElementById('add-utility-btn').title = 'Draw Utility';
        } else if (mode === 'discovery') {
            this.hideLineTypeSelector();
            document.getElementById('add-utility-btn').innerHTML = '<i class="fas fa-plus"></i>';
            document.getElementById('add-utility-btn').title = 'Add Utility';
        } else if (mode === 'excavation') {
            this.hideLineTypeSelector();
            this.showExcavationModeIndicator();
            this.showExitExcavationButton();
            document.getElementById('add-utility-btn').style.display = 'none';
        }
        
        // Show status message
        if (mode === 'discovery') {
            this.showStatusBar('Discovery Mode: Mark utilities as you find them');
            setTimeout(() => this.hideStatusBar(), 3000);
        } else if (mode === 'mapping') {
            this.showStatusBar('Mapping Mode: Draw complete utility lines');
            setTimeout(() => this.hideStatusBar(), 3000);
        } else if (mode === 'excavation') {
            this.showStatusBar('CAUTION: Excavation Mode - Monitoring utility proximity');
            // Don't auto-hide this status message, it's important
        }
    }

    /**
     * Update the UI to reflect the selected utility type
     * @param {string} utilityType The selected utility type
     */
    updateUtilitySelection(utilityType) {
        // Update active utility type in app state
        this.appState.activeUtilityType = utilityType;
        
        // Update the active class on utility buttons
        document.querySelectorAll('.utility-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.utility-button[data-utility="${utilityType}"]`).classList.add('active');
        
        // Change the color of the add utility button to match the utility type
        const addBtn = document.getElementById('add-utility-btn');
        if (addBtn) {
            // Remove previous utility type classes
            addBtn.classList.remove('water', 'gas', 'electric', 'sewer', 'telecom');
            // Add the new utility type class
            addBtn.classList.add(utilityType);
        }
    }

    /**
     * Change the active screen
     * @param {string} screen The screen to display ('home', 'utilities', 'settings')
     */
    changeScreen(screen) {
        // Update navigation buttons
        document.querySelectorAll('.nav-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.nav-button[data-screen="${screen}"]`).classList.add('active');
        
        // Handle specific screens
        if (screen === 'home') {
            // Home is the map view - already visible
            this.showToast('Map view active', 'info');
        } else if (screen === 'utilities') {
            // Not implemented yet - would show a list of utilities
            this.showToast('Utilities list view coming soon', 'info');
        } else if (screen === 'settings') {
            // Not implemented yet - would show settings
            this.showToast('Settings view coming soon', 'info');
        }
    }

    /**
     * Pre-populate the utility form with data (for when finishing a line drawing)
     * @param {Object} utilityData Initial utility data to populate the form
     */
    prepopulateUtilityForm(utilityData) {
        // Select the utility type option
        document.querySelectorAll('#add-utility-modal .utility-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Select specified utility type
        const typeOption = document.querySelector(`#add-utility-modal .utility-option[data-type="${utilityData.type}"]`);
        if (typeOption) {
            typeOption.classList.add('selected');
        }
        
        // Set line type radio button
        if (utilityData.lineType === 'main') {
            document.getElementById('main-type').checked = true;
        } else {
            document.getElementById('service-type').checked = true;
        }
        
        // Fill in other fields
        if (utilityData.size) document.getElementById('utility-size').value = utilityData.size;
        if (utilityData.depth) document.getElementById('utility-depth').value = utilityData.depth;
        if (utilityData.material) document.getElementById('utility-material').value = utilityData.material;
        if (utilityData.condition) document.getElementById('utility-condition').value = utilityData.condition;
        if (utilityData.notes) document.getElementById('utility-notes').value = utilityData.notes;
    }

    /**
     * Show the add annotation dialog
     */
    showAddAnnotationDialog() {
        const dialog = document.getElementById('add-annotation-modal');
        
        if (dialog) {
            // Clear any previous text
            document.getElementById('annotation-text').value = '';
            
            // Show the dialog
            dialog.classList.add('visible');
            
            // Focus the text input
            document.getElementById('annotation-text').focus();
        }
    }

    /**
     * Hide the add annotation dialog
     */
    hideAddAnnotationDialog() {
        const dialog = document.getElementById('add-annotation-modal');
        
        if (dialog) {
            // Hide the dialog
            dialog.classList.remove('visible');
        }
    }

    /**
     * Show the measurement panel
     */
    showMeasurementPanel() {
        const panel = document.getElementById('measurement-panel');
        
        if (panel) {
            panel.classList.add('visible');
        }
    }

    /**
     * Hide the measurement panel
     */
    hideMeasurementPanel() {
        const panel = document.getElementById('measurement-panel');
        
        if (panel) {
            panel.classList.remove('visible');
        }
    }

    /**
     * Show line type selector
     */
    showLineTypeSelector() {
        const selector = document.getElementById('line-type-selector');
        
        if (selector) {
            selector.classList.add('visible');
        }
    }

    /**
     * Hide line type selector
     */
    hideLineTypeSelector() {
        const selector = document.getElementById('line-type-selector');
        
        if (selector) {
            selector.classList.remove('visible');
        }
    }

    /**
     * Show the main menu
     */
    showMainMenu() {
        const menu = document.getElementById('main-menu-panel');
        
        if (menu) {
            menu.classList.add('visible');
        }
    }

    /**
     * Hide the main menu
     */
    hideMainMenu() {
        const menu = document.getElementById('main-menu-panel');
        
        if (menu) {
            menu.classList.remove('visible');
        }
    }

    /**
     * Update an existing proximity alert
     * @param {Object} alert The alert to update
     */
    updateProximityAlert(alert) {
        const distance = alert.distance;
        const distanceElement = document.getElementById(`distance-${alert.utilityId}`);
        
        if (distanceElement) {
            // Update distance text
            distanceElement.textContent = `${distance.toFixed(1)} ft`;
            
            // Update color based on distance
            distanceElement.parentElement.style.color = this.getDistanceColor(distance);
        }
    }

    /**
     * Remove a proximity alert
     * @param {Object|string} alertOrId The alert object or utility ID
     */
    removeProximityAlert(alertOrId) {
        const utilityId = typeof alertOrId === 'string' ? alertOrId : alertOrId.utilityId;
        const alertElement = document.getElementById(`alert-${utilityId}`);
        
        if (alertElement) {
            // Add fade-out animation
            alertElement.classList.remove('visible');
            
            // Remove from DOM after animation
            setTimeout(() => {
                const container = document.getElementById('proximity-alerts');
                if (container && container.contains(alertElement)) {
                    container.removeChild(alertElement);
                }
            }, 300); // Match animation duration
        }
    }

    /**
     * Dismiss a proximity alert manually
     * @param {string} utilityId The utility ID
     */
    dismissProximityAlert(utilityId) {
        // Find the alert in active alerts
        if (this.appState.activeAlerts) {
            const index = this.appState.activeAlerts.findIndex(alert => alert.utilityId === utilityId);
            
            if (index >= 0) {
                // Remove from active alerts
                const alert = this.appState.activeAlerts[index];
                this.appState.activeAlerts.splice(index, 1);
                
                // Remove from UI
                this.removeProximityAlert(alert);
            }
        }
    }
} 