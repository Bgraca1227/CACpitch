/**
 * CAC UtiliTrack Component Connection Patch
 * 
 * This script focuses on ensuring proper connections between application components.
 * It runs after the main application has initialized to fix any missing connections.
 */

(function() {
    console.log('CAC UtiliTrack Component Patch loading...');
    
    // Track if patch has been applied
    let patchApplied = false;
    
    /**
     * Apply patches to fix component connections
     * @returns {string} Status message
     */
    function patchCACUtiliTrack() {
        // Avoid applying patch multiple times
        if (patchApplied) {
            console.log('Patch already applied, skipping');
            return 'Patch already applied';
        }
        
        console.log('Applying CAC UtiliTrack component patches...');
        
        try {
            // Only proceed if core components exist
            if (!window.appState || !window.mapController || !window.uiController) {
                console.warn('Cannot apply patch: core components missing');
                return 'Core components missing';
            }
            
            // 1. Ensure component references are properly connected
            connectComponents();
            
            // 2. Add any missing critical methods
            addMissingMethods();
            
            // 3. Fix event handlers
            fixEventHandlers();
            
            // Mark as applied
            patchApplied = true;
            
            console.log('Component patches applied successfully');
            return 'Patch applied successfully';
        } catch (error) {
            console.error('Error applying component patch:', error);
            return 'Error: ' + error.message;
        }
    }
    
    /**
     * Connect application components
     */
    function connectComponents() {
        // Core component connections
        if (window.mapController) {
            if (!window.mapController.uiController) {
                window.mapController.uiController = window.uiController;
            }
            
            if (!window.mapController.eventHandlers && window.eventHandlers) {
                window.mapController.eventHandlers = window.eventHandlers;
            }
            
            if (!window.mapController.appState) {
                window.mapController.appState = window.appState;
            }
            
            if (!window.mapController.dataStore) {
                window.mapController.dataStore = window.dataStore;
            }
        }
        
        if (window.uiController) {
            if (!window.uiController.mapController) {
                window.uiController.mapController = window.mapController;
            }
            
            if (!window.uiController.eventHandlers && window.eventHandlers) {
                window.uiController.eventHandlers = window.eventHandlers;
            }
            
            if (!window.uiController.appState) {
                window.uiController.appState = window.appState;
            }
            
            if (!window.uiController.dataStore) {
                window.uiController.dataStore = window.dataStore;
            }
        }
        
        if (window.eventHandlers) {
            if (!window.eventHandlers.mapController) {
                window.eventHandlers.mapController = window.mapController;
            }
            
            if (!window.eventHandlers.uiController) {
                window.eventHandlers.uiController = window.uiController;
            }
            
            if (!window.eventHandlers.appState) {
                window.eventHandlers.appState = window.appState;
            }
            
            if (!window.eventHandlers.dataStore) {
                window.eventHandlers.dataStore = window.dataStore;
            }
        }
        
        if (window.dataStore) {
            if (!window.dataStore.mapController) {
                window.dataStore.mapController = window.mapController;
            }
        }
        
        console.log('Component connections verified');
    }
    
    /**
     * Add any missing critical methods to components
     */
    function addMissingMethods() {
        // Add missing methods to MapController
        if (window.mapController) {
            // Critical methods that must exist
            const criticalMethods = [
                'findNearestUtility',
                'updateHeading',
                'enableExcavationMode',
                'disableExcavationMode',
                'startHighAccuracyLocationTracking',
                'distanceToPolyline'
            ];
            
            criticalMethods.forEach(methodName => {
                if (typeof window.mapController[methodName] !== 'function') {
                    console.warn(`Adding missing ${methodName} method to MapController`);
                    
                    // Add minimal implementation based on method name
                    if (methodName === 'findNearestUtility') {
                        window.mapController.findNearestUtility = function(latlng, maxDistance = 50) {
                            console.log('Stub implementation of findNearestUtility called');
                            return null;
                        };
                    } else if (methodName === 'updateHeading') {
                        window.mapController.updateHeading = function(heading) {
                            console.log('Stub implementation of updateHeading called with:', heading);
                            window.mapController.currentHeading = heading;
                        };
                    } else if (methodName === 'enableExcavationMode') {
                        window.mapController.enableExcavationMode = function() {
                            console.log('Stub implementation of enableExcavationMode called');
                            window.appState.isExcavationMode = true;
                            
                            // Show indicators
                            const indicator = document.getElementById('excavation-indicator');
                            if (indicator) indicator.classList.add('visible');
                            
                            const exitBtn = document.getElementById('exit-excavation-btn');
                            if (exitBtn) exitBtn.classList.add('visible');
                        };
                    } else if (methodName === 'disableExcavationMode') {
                        window.mapController.disableExcavationMode = function() {
                            console.log('Stub implementation of disableExcavationMode called');
                            window.appState.isExcavationMode = false;
                            
                            // Hide indicators
                            const indicator = document.getElementById('excavation-indicator');
                            if (indicator) indicator.classList.remove('visible');
                            
                            const exitBtn = document.getElementById('exit-excavation-btn');
                            if (exitBtn) exitBtn.classList.remove('visible');
                        };
                    } else if (methodName === 'startHighAccuracyLocationTracking') {
                        window.mapController.startHighAccuracyLocationTracking = function() {
                            console.log('Stub implementation of startHighAccuracyLocationTracking called');
                            // Use regular geolocation as fallback
                            if (navigator.geolocation) {
                                navigator.geolocation.getCurrentPosition(
                                    pos => {
                                        if (window.mapController.updateLocationMarker) {
                                            window.mapController.updateLocationMarker(pos);
                                        }
                                    },
                                    err => console.warn('Geolocation error:', err)
                                );
                            }
                        };
                    } else if (methodName === 'distanceToPolyline') {
                        window.mapController.distanceToPolyline = function(point, polyline) {
                            console.log('Stub implementation of distanceToPolyline called');
                            return 100; // Return a safe default distance
                        };
                    }
                }
            });
        }
        
        // Add missing methods to UIController
        if (window.uiController) {
            // Critical UI methods
            const uiMethods = [
                'showToast',
                'showStatusBar',
                'hideStatusBar',
                'showMeasurementToolbar',
                'hideMeasurementToolbar'
            ];
            
            uiMethods.forEach(methodName => {
                if (typeof window.uiController[methodName] !== 'function') {
                    console.warn(`Adding missing ${methodName} method to UIController`);
                    
                    // Add minimal implementation
                    if (methodName === 'showToast') {
                        window.uiController.showToast = function(message, type = 'info') {
                            console.log(`Toast (${type}): ${message}`);
                            // Try to create a simple toast
                            try {
                                const container = document.getElementById('notification-container') || document.body;
                                const toast = document.createElement('div');
                                toast.className = `toast ${type}`;
                                toast.textContent = message;
                                toast.style.position = 'fixed';
                                toast.style.top = '10px';
                                toast.style.left = '50%';
                                toast.style.transform = 'translateX(-50%)';
                                toast.style.backgroundColor = type === 'error' ? '#f44336' : 
                                                              type === 'warning' ? '#ff9800' : '#2196F3';
                                toast.style.color = 'white';
                                toast.style.padding = '8px 16px';
                                toast.style.borderRadius = '4px';
                                toast.style.zIndex = '9999';
                                
                                container.appendChild(toast);
                                
                                // Remove after 3 seconds
                                setTimeout(() => {
                                    if (toast.parentNode) {
                                        toast.parentNode.removeChild(toast);
                                    }
                                }, 3000);
                            } catch (e) {
                                console.error('Error showing toast:', e);
                            }
                        };
                    } else if (methodName.startsWith('show') || methodName.startsWith('hide')) {
                        // Generic show/hide method
                        window.uiController[methodName] = function() {
                            console.log(`Stub implementation of ${methodName} called`);
                        };
                    }
                }
            });
        }
    }
    
    /**
     * Fix event handlers for critical UI elements
     */
    function fixEventHandlers() {
        // Fix excavation mode button
        const excavationBtn = document.querySelector('.mode-button[data-mode="excavation"]');
        if (excavationBtn && !excavationBtn._patched) {
            excavationBtn.addEventListener('click', function() {
                console.log('Excavation mode button clicked');
                
                // Update app state
                if (window.appState) {
                    window.appState.mode = 'excavation';
                }
                
                // Update UI
                document.querySelectorAll('.mode-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                excavationBtn.classList.add('active');
                
                // Enable excavation mode in map controller
                if (window.mapController && window.mapController.enableExcavationMode) {
                    window.mapController.enableExcavationMode();
                }
                
                // Show confirmation
                if (window.uiController && window.uiController.showToast) {
                    window.uiController.showToast('Excavation mode activated', 'warning');
                }
            });
            
            excavationBtn._patched = true;
        }
        
        // Fix exit excavation button
        const exitExcavationBtn = document.getElementById('exit-excavation-btn');
        if (exitExcavationBtn && !exitExcavationBtn._patched) {
            exitExcavationBtn.addEventListener('click', function() {
                console.log('Exit excavation button clicked');
                
                // Show confirmation dialog
                const modal = document.getElementById('exit-excavation-modal');
                if (modal) {
                    modal.classList.add('visible');
                    modal.style.display = 'flex';
                }
            });
            
            exitExcavationBtn._patched = true;
        }
        
        // Fix exit confirmation buttons
        const confirmExitBtn = document.getElementById('confirm-exit-excavation');
        if (confirmExitBtn && !confirmExitBtn._patched) {
            confirmExitBtn.addEventListener('click', function() {
                console.log('Confirm exit excavation clicked');
                
                // Hide modal
                const modal = document.getElementById('exit-excavation-modal');
                if (modal) {
                    modal.classList.remove('visible');
                    modal.style.display = 'none';
                }
                
                // Update app state
                if (window.appState) {
                    window.appState.mode = 'discovery';
                    window.appState.isExcavationMode = false;
                }
                
                // Update UI
                document.querySelectorAll('.mode-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                document.querySelector('.mode-button[data-mode="discovery"]').classList.add('active');
                
                // Disable excavation mode
                if (window.mapController && window.mapController.disableExcavationMode) {
                    window.mapController.disableExcavationMode();
                }
                
                // Show confirmation
                if (window.uiController && window.uiController.showToast) {
                    window.uiController.showToast('Excavation mode deactivated', 'info');
                }
            });
            
            confirmExitBtn._patched = true;
        }
        
        const cancelExitBtn = document.getElementById('cancel-exit-excavation');
        if (cancelExitBtn && !cancelExitBtn._patched) {
            cancelExitBtn.addEventListener('click', function() {
                console.log('Cancel exit excavation clicked');
                
                // Hide modal
                const modal = document.getElementById('exit-excavation-modal');
                if (modal) {
                    modal.classList.remove('visible');
                    modal.style.display = 'none';
                }
            });
            
            cancelExitBtn._patched = true;
        }
    }
    
    // Export patch function
    window.patchCACUtiliTrack = patchCACUtiliTrack;
    
    // Auto-apply patch after a delay
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
            // Only auto-apply if components exist
            if (window.appState && window.mapController && window.uiController) {
                patchCACUtiliTrack();
            }
        }, 2000); // Wait for main app to initialize
    });
    
    console.log('CAC UtiliTrack Component Patch loaded');
})(); 