// ==UserScript==
// @name Asana Improvements
// @version 2025-09-29
// @updateURL https://raw.githubusercontent.com/vojtaflorian/Asana-Improvements/refs/heads/main/asana-improvements.js
// @downloadURL https://raw.githubusercontent.com/vojtaflorian/Asana-Improvements/refs/heads/main/asana-improvements.js
// @description Asana workflow enhancements
// @author Vojta Florian
// @homepage https://vojtaflorian.com
// @match https://app.asana.com/*
// @grant none
// ==/UserScript==

(function() {
    'use strict';

    // ============================================================================
    // CONFIGURATION
    // ============================================================================
    
    /**
     * Application configuration object
     * All configurable values are centralized here for easy maintenance
     */
    const CONFIG = {
        // UI configuration
        ui: {
            detailsPaneWidth: '80%',
            taskPaneWidth: '65%',
            taskPaneMinWidth: '50%',
            compactCellWidth: '80px',
            maxEnumValueWidth: '100px',
            enumValuePadding: '5px'
        },
        
        // Feature toggles
        features: {
            daysLeftCalculation: true,
            autoExpandSubtasks: true,
            autoExpandComments: true,
            toggleCompletedTasks: true,
            hidePaywallElements: true
        },
        
        // Date parsing configuration
        dateParser: {
            dayNames: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            todayKeyword: 'Today',
            tomorrowKeyword: 'Tomorrow'
        },
        
        // DOM selectors
        selectors: {
            dueDateElement: 'div.DueDate',
            subtaskLoadMore: '.SubtaskGrid-loadMore',
            commentExpand: '.TruncatedRichText-expand',
            completedSubtask: '.SubtaskTaskRow--completed',
            topbarRightSide: '.GlobalTopbarStructure-rightSide',
            subtasksLabel: '.TaskPaneSubtasks-label',
            taskPane: '.TaskPane'
        },
        
        // LocalStorage keys
        storage: {
            completedTasksHidden: 'completedSubtasksHidden'
        },
        
        // Performance configuration
        performance: {
            mutationObserverDebounce: 100,
            maxObserverRetries: 3,
            observerTimeout: 30000
        }
    };

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================
    
    /**
     * Safe DOM query selector with error handling
     * @param {string} selector - CSS selector
     * @param {Element} parent - Parent element (default: document)
     * @returns {Element|null}
     */
    function safeQuerySelector(selector, parent = document) {
        try {
            if (!selector || typeof selector !== 'string') {
                throw new Error('Invalid selector provided');
            }
            
            return parent.querySelector(selector);
        } catch (error) {
            console.error('Error in safeQuerySelector:', selector, error);
            return null;
        }
    }
    
    /**
     * Safe DOM query selector all with error handling
     * @param {string} selector - CSS selector
     * @param {Element} parent - Parent element (default: document)
     * @returns {NodeList|Array}
     */
    function safeQuerySelectorAll(selector, parent = document) {
        try {
            if (!selector || typeof selector !== 'string') {
                throw new Error('Invalid selector provided');
            }
            
            return parent.querySelectorAll(selector);
        } catch (error) {
            console.error('Error in safeQuerySelectorAll:', selector, error);
            return [];
        }
    }
    
    /**
     * Safe localStorage operations
     */
    const SafeStorage = {
        /**
         * Get item from localStorage
         * @param {string} key
         * @param {*} defaultValue
         * @returns {*}
         */
        getItem(key, defaultValue = null) {
            try {
                const value = localStorage.getItem(key);
                return value === null ? defaultValue : value;
            } catch (error) {
                console.error('Error reading from localStorage:', key, error);
                return defaultValue;
            }
        },
        
        /**
         * Set item in localStorage
         * @param {string} key
         * @param {string} value
         * @returns {boolean}
         */
        setItem(key, value) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (error) {
                console.error('Error writing to localStorage:', key, value, error);
                return false;
            }
        },
        
        /**
         * Remove item from localStorage
         * @param {string} key
         * @returns {boolean}
         */
        removeItem(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.error('Error removing from localStorage:', key, error);
                return false;
            }
        }
    };
    
    /**
     * Debounce function for performance optimization
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function}
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Validate if element exists and is visible
     * @param {Element} element
     * @returns {boolean}
     */
    function isElementValid(element) {
        try {
            if (!element) return false;
            if (!(element instanceof Element)) return false;
            
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        } catch (error) {
            console.error('Error validating element:', error);
            return false;
        }
    }

    // ============================================================================
    // STYLE INJECTION
    // ============================================================================
    
    /**
     * Safely inject global styles with error handling
     * @param {string} css - CSS rules to inject
     * @returns {boolean} Success status
     */
    function injectGlobalStyles(css) {
        try {
            // Validate CSS string
            if (!css || typeof css !== 'string') {
                throw new Error('Invalid CSS provided');
            }
            
            // Get or create head element
            let head = document.getElementsByTagName('head')[0];
            if (!head) {
                head = document.createElement('head');
                document.documentElement.appendChild(head);
            }
            
            // Create and append style element
            const style = document.createElement('style');
            style.type = 'text/css';
            style.setAttribute('data-source', 'asana-workflow-enhancement');
            style.innerHTML = css;
            
            head.appendChild(style);
            return true;
        } catch (error) {
            console.error('Failed to inject global styles:', error);
            return false;
        }
    }
    
    /**
     * Build CSS rules from configuration
     * @returns {string}
     */
    function buildCSSRules() {
        try {
            const rules = `
/* Details pane width adjustments */
.InboxPanesOrEmptyState-detailsPane:not(.InboxPanesOrEmptyState-pane--windowed) {
    width: ${CONFIG.ui.detailsPaneWidth} !important;
}

/* Task pane width adjustments */
.FullWidthPageStructureWithDetailsOverlay-detailsOverlay--fullHeightTaskPane {
    width: ${CONFIG.ui.taskPaneWidth} !important;
    min-width: ${CONFIG.ui.taskPaneMinWidth} !important;
}

/* Hide premium/upgrade UI elements */
${CONFIG.features.hidePaywallElements ? `
.Sidebar-changeInviteIconEnabled,
.Sidebar-cleanAndClearInviteAndHelpSection,
.BusinessOrAdvancedUpgradeButton,
.GlobalTopbar-upgradeButton,
.PremiumIconItemA11y,
.TaskPaneGenerateSubtasksButton,
.AiAssistantGlobalTopbarPaneButtonPresentation {
    display: none !important;
}
` : ''}

/* Compact cell styling */
.CustomPropertyEnumValueInput-button.CustomPropertyEnumValueInput-button--large {
    max-width: ${CONFIG.ui.maxEnumValueWidth} !important;
    padding: ${CONFIG.ui.enumValuePadding} !important;
}

.SpreadsheetCell--isCompact.SpreadsheetCell,
.SpreadsheetCell--isCompact.SpreadsheetCell.SpreadsheetCustomPropertyEnumCell-spreadsheetCell,
.SpreadsheetCell--isCompact.SpreadsheetCell.SpreadsheetAssigneeCell-cell.SpreadsheetTaskRow-assigneeCell,
.SpreadsheetCell--isCompact.SpreadsheetCell.SpreadsheetCustomPropertyNumberCell-spreadsheetCell,
.SpreadsheetHeaderColumn--fixedWidth.SpreadsheetHeaderColumn--isClickable.SpreadsheetHeaderColumn.SpreadsheetProjectHeaderRow-headerColumn {
    width: ${CONFIG.ui.compactCellWidth} !important;
}
`;
            
            return rules;
        } catch (error) {
            console.error('Failed to build CSS rules:', error);
            return '';
        }
    }

    // ============================================================================
    // DATE PARSING AND CALCULATION
    // ============================================================================
    
    /**
     * Parse various date string formats to Date object
     * @param {string} dateString - Date string to parse
     * @returns {Date|null}
     */
    function parseStringToDate(dateString) {
        try {
            // Validate input
            if (!dateString || typeof dateString !== 'string') {
                throw new Error('Invalid date string provided');
            }
            
            const trimmedString = dateString.trim();
            const config = CONFIG.dateParser;
            
            // Handle "Today"
            if (trimmedString === config.todayKeyword) {
                return new Date();
            }
            
            // Handle "Tomorrow"
            if (trimmedString === config.tomorrowKeyword) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                return tomorrow;
            }
            
            // Handle day names (Monday, Tuesday, etc.)
            const dayIndex = config.dayNames.indexOf(trimmedString);
            if (dayIndex !== -1) {
                const targetDay = dayIndex + 1; // getDay() returns 0 for Sunday
                let date = new Date();
                
                // Find next occurrence of the target day
                for (let i = 1; i <= 7; i++) {
                    date = new Date();
                    date.setDate(date.getDate() + i);
                    
                    if (date.getDay() === targetDay) {
                        return date;
                    }
                }
            }
            
            // Handle regular date strings
            const dateStr = trimmedString.includes(',') 
                ? trimmedString 
                : `${trimmedString}, ${new Date().getFullYear()}`;
            
            const parsedDate = new Date(dateStr);
            
            // Validate parsed date
            if (isNaN(parsedDate.getTime())) {
                throw new Error('Invalid date resulted from parsing');
            }
            
            return parsedDate;
        } catch (error) {
            console.error('Failed to parse date string:', dateString, error);
            return null;
        }
    }
    
    /**
     * Calculate days remaining until due date
     * @param {Date} dueDate - Due date
     * @returns {number|null}
     */
    function calculateDaysRemaining(dueDate) {
        try {
            if (!dueDate || !(dueDate instanceof Date)) {
                throw new Error('Invalid due date provided');
            }
            
            if (isNaN(dueDate.getTime())) {
                throw new Error('Invalid date object');
            }
            
            const today = new Date();
            const timeDiff = dueDate.getTime() - today.getTime();
            const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
            
            return daysDiff;
        } catch (error) {
            console.error('Failed to calculate days remaining:', error);
            return null;
        }
    }
    
    /**
     * Update all due date elements with days remaining
     */
    function updateDueDates() {
        try {
            if (!CONFIG.features.daysLeftCalculation) {
                return;
            }
            
            const dueDateElements = safeQuerySelectorAll(CONFIG.selectors.dueDateElement);
            
            if (dueDateElements.length === 0) {
                return;
            }
            
            dueDateElements.forEach((element) => {
                try {
                    // Skip if already updated (contains parentheses)
                    if (!element || !element.innerText || element.innerText.includes('(')) {
                        return;
                    }
                    
                    const originalText = element.innerText;
                    const dueDate = parseStringToDate(originalText);
                    
                    if (!dueDate) {
                        return;
                    }
                    
                    const daysRemaining = calculateDaysRemaining(dueDate);
                    
                    if (daysRemaining === null || daysRemaining <= 0) {
                        return;
                    }
                    
                    const daysRemainingRounded = Math.ceil(daysRemaining);
                    const newText = `${originalText} (${daysRemainingRounded} days)`;
                    
                    element.innerText = newText;
                } catch (error) {
                    console.error('Error updating individual due date:', error);
                }
            });
        } catch (error) {
            console.error('Critical error in updateDueDates:', error);
        }
    }

    // ============================================================================
    // AUTO-EXPAND FUNCTIONALITY
    // ============================================================================
    
    /**
     * Automatically click "load more" and "expand" buttons
     */
    function autoExpandContent() {
        try {
            if (!CONFIG.features.autoExpandSubtasks && !CONFIG.features.autoExpandComments) {
                return;
            }
            
            const selectors = [];
            
            if (CONFIG.features.autoExpandSubtasks) {
                selectors.push(CONFIG.selectors.subtaskLoadMore);
            }
            
            if (CONFIG.features.autoExpandComments) {
                selectors.push(CONFIG.selectors.commentExpand);
            }
            
            if (selectors.length === 0) {
                return;
            }
            
            const combinedSelector = selectors.join(', ');
            const expandButtons = safeQuerySelectorAll(combinedSelector);
            
            if (expandButtons.length === 0) {
                return;
            }
            
            expandButtons.forEach((button) => {
                try {
                    if (!isElementValid(button)) {
                        return;
                    }
                    
                    button.click();
                } catch (error) {
                    console.error('Error clicking expand button:', error);
                }
            });
        } catch (error) {
            console.error('Critical error in autoExpandContent:', error);
        }
    }

    // ============================================================================
    // TOGGLE COMPLETED TASKS FUNCTIONALITY
    // ============================================================================
    
    /**
     * Get current visibility state of completed tasks
     * @returns {boolean}
     */
    function getCompletedTasksHiddenState() {
        try {
            const state = SafeStorage.getItem(CONFIG.storage.completedTasksHidden, 'false');
            return state === 'true';
        } catch (error) {
            console.error('Error getting completed tasks hidden state:', error);
            return false;
        }
    }
    
    /**
     * Set visibility state of completed tasks
     * @param {boolean} hidden
     */
    function setCompletedTasksHiddenState(hidden) {
        try {
            const success = SafeStorage.setItem(
                CONFIG.storage.completedTasksHidden, 
                String(hidden)
            );
            
            if (!success) {
                throw new Error('Failed to save state to storage');
            }
        } catch (error) {
            console.error('Error setting completed tasks hidden state:', error);
        }
    }
    
    /**
     * Apply visibility state to completed subtasks
     */
    function applyCompletedTasksVisibility() {
        try {
            const hidden = getCompletedTasksHiddenState();
            const completedSubtasks = safeQuerySelectorAll(CONFIG.selectors.completedSubtask);
            
            if (completedSubtasks.length === 0) {
                return;
            }
            
            completedSubtasks.forEach((subtask) => {
                try {
                    if (!subtask) return;
                    
                    subtask.style.display = hidden ? 'none' : '';
                } catch (error) {
                    console.error('Error applying visibility to subtask:', error);
                }
            });
            
            // Update indicators after applying visibility
            updateTaskIndicators();
        } catch (error) {
            console.error('Critical error in applyCompletedTasksVisibility:', error);
        }
    }
    
    /**
     * Toggle visibility of completed subtasks
     */
    function toggleCompletedSubtasks() {
        try {
            const currentState = getCompletedTasksHiddenState();
            const newState = !currentState;
            
            setCompletedTasksHiddenState(newState);
            applyCompletedTasksVisibility();
        } catch (error) {
            console.error('Critical error in toggleCompletedSubtasks:', error);
        }
    }
    
    /**
     * Update indicators showing number of hidden completed tasks
     */
    function updateTaskIndicators() {
        try {
            const taskLabels = safeQuerySelectorAll(CONFIG.selectors.subtasksLabel);
            
            if (taskLabels.length === 0) {
                return;
            }
            
            taskLabels.forEach((label) => {
                try {
                    if (!label) return;
                    
                    const taskPane = label.closest(CONFIG.selectors.taskPane);
                    if (!taskPane) {
                        return;
                    }
                    
                    const completedSubtasks = taskPane.querySelectorAll(
                        CONFIG.selectors.completedSubtask
                    );
                    
                    let indicator = label.querySelector('.completed-subtasks-indicator');
                    
                    if (completedSubtasks.length > 0) {
                        if (!indicator) {
                            // Create new indicator
                            const content = label.querySelector('.LabeledRowStructure-right .LabeledRowStructure-content');
                            
                            if (!content) {
                                return;
                            }
                            
                            indicator = document.createElement('span');
                            indicator.classList.add('completed-subtasks-indicator');
                            indicator.innerText = ' [Toggle Complete tasks]';
                            indicator.style.color = '#eb7586';
                            indicator.style.cursor = 'pointer';
                            
                            indicator.addEventListener('click', () => {
                                toggleCompletedSubtasks();
                            });
                            
                            content.appendChild(indicator);
                        }
                    } else if (indicator) {
                        // Remove indicator if no completed subtasks
                        indicator.remove();
                    }
                } catch (error) {
                    console.error('Error updating task indicator:', error);
                }
            });
        } catch (error) {
            console.error('Critical error in updateTaskIndicators:', error);
        }
    }
    
    /**
     * Create toggle button in topbar
     */
    function createToggleButton() {
        try {
            if (!CONFIG.features.toggleCompletedTasks) {
                return;
            }
            
            // Check if button already exists
            if (document.querySelector('#toggleCompletedSubtasksButton')) {
                return;
            }
            
            // Find topbar
            const topbarRightSide = safeQuerySelector(CONFIG.selectors.topbarRightSide);
            
            if (!topbarRightSide) {
                return;
            }
            
            // Create button
            const button = document.createElement('button');
            button.id = 'toggleCompletedSubtasksButton';
            button.innerText = 'Toggle Complete tasks';
            button.style.marginLeft = '10px';
            button.style.cursor = 'pointer';
            button.classList.add(
                'ThemeableRectangularButtonPresentation',
                'ThemeableRectangularButtonPresentation--medium',
                'TopbarContingentUpgradeButton-button',
                'UpsellButton'
            );
            
            button.addEventListener('click', () => {
                toggleCompletedSubtasks();
            });
            
            topbarRightSide.appendChild(button);
        } catch (error) {
            console.error('Critical error in createToggleButton:', error);
        }
    }

    // ============================================================================
    // MUTATION OBSERVER
    // ============================================================================
    
    /**
     * Handle DOM mutations with debouncing
     */
    const handleMutations = debounce(() => {
        try {
            updateDueDates();
            autoExpandContent();
            createToggleButton();
            applyCompletedTasksVisibility();
        } catch (error) {
            console.error('Error handling mutations:', error);
        }
    }, CONFIG.performance.mutationObserverDebounce);
    
    /**
     * Setup mutation observer with error handling
     */
    function setupMutationObserver() {
        try {
            const observer = new MutationObserver((mutations) => {
                try {
                    handleMutations();
                } catch (error) {
                    console.error('Error in mutation observer callback:', error);
                }
            });
            
            // Configure observer
            const observerConfig = {
                childList: true,
                subtree: true
            };
            
            // Start observing
            observer.observe(document.body, observerConfig);
            
            return observer;
        } catch (error) {
            console.error('Critical error setting up mutation observer:', error);
            return null;
        }
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    
    /**
     * Initialize all features
     */
    function initialize() {
        try {
            // Inject styles
            const css = buildCSSRules();
            if (css) {
                injectGlobalStyles(css);
            }
            
            // Initial updates
            updateDueDates();
            autoExpandContent();
            createToggleButton();
            applyCompletedTasksVisibility();
            
            // Setup mutation observer
            setupMutationObserver();
        } catch (error) {
            console.error('Critical error during initialization:', error);
        }
    }
    
    /**
     * Initialize when DOM is ready
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // ============================================================================
    // PUBLIC API (for debugging)
    // ============================================================================
    
    // Expose public API for debugging purposes
    window.AsanaWorkflowEnhancement = {
        config: CONFIG,
        utils: {
            updateDueDates,
            autoExpandContent,
            toggleCompletedSubtasks,
            applyCompletedTasksVisibility
        },
        version: '1.0.0'
    };

})();
