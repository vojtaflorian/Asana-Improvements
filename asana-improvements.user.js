// ==UserScript==
// @name Asana Improvements
// @version 2.4.1
// @updateURL https://raw.githubusercontent.com/vojtaflorian/Asana-Improvements/refs/heads/main/asana-improvements.user.js?v=@version
// @downloadURL https://raw.githubusercontent.com/vojtaflorian/Asana-Improvements/refs/heads/main/asana-improvements.user.js?v=@version
// @description Asana workflow enhancements (Sol + Legacy support)
// @author Vojta Florian
// @match https://app.asana.com/*
// @grant none
// ==/UserScript==

(function () {
    "use strict";

    const DEBUG = true;
    function log(...args) {
        if (DEBUG) console.log("[Asana-Imp]", ...args);
    }

    const CONFIG = {
        ui: {
            detailsPaneWidth: "80%",
            taskPaneWidth: "65%",
            taskPaneMinWidth: "50%",
        },
        features: {
            daysLeftCalculation: true,
            autoExpandSubtasks: true,
            autoExpandComments: true,
            toggleCompletedTasks: true,
            hidePaywallElements: true,
        },
        selectors: {
            dueDate: ".SpreadsheetTaskDueDateCell-cell span, .DueDateTokenButton span, .TaskDueDateToken-tokenButton span, [aria-label='Due date'] span",
            expandLinks: ".SubtaskGrid-loadMore, .TaskStoryFeed-expandLink, .SubtaskGrid-loadMoreSubtasksButton, .TruncatedRichText-expand, [aria-label*='Load more'], [aria-label*='Show more'], .SubtaskGridShowMoreRow-button",
            completedSubtask: ".SubtaskTaskRow--completed, .SubtaskGridRow--completed, .TaskPaneSubtasks-taskRow--completed",
            topbarAnchor: ".GlobalTopbar-rightSide, .LearningHubTopbarButton, .TopbarSettingsMenuButton",
            subtaskHeader: ".TaskPaneSubtasks-sectionHeadingText",
            sidebarFooter: ".SidebarFooter, .SidebarFooter--withoutModesSidebar"
        },
        storage: {
            completedTasksHidden: "asana_completed_tasks_hidden"
        }
    };

    let areCompletedHidden = localStorage.getItem(CONFIG.storage.completedTasksHidden) === "true";

    // ============================================================================
    // UTILITIES
    // ============================================================================

    function applyCompletedVisibility() {
        const completed = document.querySelectorAll(CONFIG.selectors.completedSubtask);
        completed.forEach(el => {
            el.style.display = areCompletedHidden ? "none" : "";
        });
        
        const topBtn = document.getElementById("custom-toggle-completed");
        if (topBtn) {
            topBtn.style.backgroundColor = areCompletedHidden ? "#eb7586" : "";
            topBtn.style.color = areCompletedHidden ? "white" : "";
            topBtn.innerText = areCompletedHidden ? "Show Completed" : "Hide Completed";
        }
        
        document.querySelectorAll(".inline-subtask-toggle").forEach(btn => {
            btn.style.backgroundColor = areCompletedHidden ? "#eb7586" : "transparent";
            btn.style.color = areCompletedHidden ? "white" : "#6d6e6f";
            btn.style.borderColor = areCompletedHidden ? "#eb7586" : "#e0e0e0";
            btn.innerText = areCompletedHidden ? "Show Hidden" : "Hide Completed";
        });
    }

    function toggleCompleted() {
        areCompletedHidden = !areCompletedHidden;
        localStorage.setItem(CONFIG.storage.completedTasksHidden, areCompletedHidden);
        applyCompletedVisibility();
    }

    // ============================================================================
    // FEATURES
    // ============================================================================

    function updateDueDates() {
        if (!CONFIG.features.daysLeftCalculation) return;
        const elements = document.querySelectorAll(CONFIG.selectors.dueDate);
        elements.forEach(el => {
            if (el.innerText.includes("(")) return;
            const text = el.innerText.trim();
            if (!text || text.length > 20) return;

            const now = new Date();
            now.setHours(0, 0, 0, 0);
            let target = null;
            if (text === "Today" || text === "Dnes") target = now;
            else if (text === "Tomorrow" || text === "Zítra") {
                target = new Date(now);
                target.setDate(now.getDate() + 1);
            } else {
                const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                const dayIdx = days.findIndex(d => text.startsWith(d));
                if (dayIdx !== -1) {
                    target = new Date(now);
                    let diff = dayIdx - now.getDay();
                    if (diff <= 0) diff += 7;
                    target.setDate(now.getDate() + diff);
                } else {
                    const parsed = new Date(text);
                    if (!isNaN(parsed)) target = parsed;
                    else {
                        const withYear = new Date(`${text}, ${now.getFullYear()}`);
                        if (!isNaN(withYear)) target = withYear;
                    }
                }
            }
            if (target) {
                const diffTime = target - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays >= 0) el.innerText = `${text} (${diffDays}d)`;
            }
        });
    }

    function autoExpand() {
        // Direct selector expansion
        document.querySelectorAll(CONFIG.selectors.expandLinks).forEach(el => {
            if (el.offsetParent !== null && !el.dataset.clicked) {
                el.dataset.clicked = "true";
                el.click();
            }
        });

        // Text fallback
        if (CONFIG.features.autoExpandSubtasks) {
            document.querySelectorAll("[role='button'], button").forEach(btn => {
                if (btn.dataset.clicked) return;
                const txt = btn.textContent.toLowerCase();
                if (txt.includes("load more subtask") || txt.includes("show more subtask") || txt.includes("zobrazit další")) {
                    btn.dataset.clicked = "true";
                    btn.click();
                }
            });
        }
    }

    function injectToggleUI() {
        if (!CONFIG.features.toggleCompletedTasks) return;
        const anchor = document.querySelector(CONFIG.selectors.topbarAnchor);
        if (anchor && !document.getElementById("custom-toggle-completed")) {
            const container = anchor.parentElement;
            const btn = document.createElement("button");
            btn.id = "custom-toggle-completed";
            btn.className = "ThemeableRectangularButtonPresentation ThemeableRectangularButtonPresentation--medium";
            btn.style.margin = "0 10px";
            btn.style.padding = "0 12px";
            btn.style.height = "28px";
            btn.style.fontSize = "11px";
            btn.style.borderRadius = "4px";
            btn.style.border = "1px solid #e0e0e0";
            btn.style.cursor = "pointer";
            btn.style.fontWeight = "600";
            btn.onclick = toggleCompleted;
            container.insertBefore(btn, container.firstChild);
            applyCompletedVisibility();
        }

        const headers = document.querySelectorAll(CONFIG.selectors.subtaskHeader);
        headers.forEach(h => {
            const stack = h.closest(".Stack--direction-row");
            if (stack && !stack.querySelector(".inline-subtask-toggle")) {
                const btn = document.createElement("button");
                btn.className = "inline-subtask-toggle";
                btn.style.cursor = "pointer";
                btn.style.marginLeft = "12px";
                btn.style.padding = "2px 8px";
                btn.style.fontSize = "10px";
                btn.style.fontWeight = "600";
                btn.style.borderRadius = "12px";
                btn.style.border = "1px solid #e0e0e0";
                btn.style.textTransform = "uppercase";
                btn.style.height = "20px";
                btn.onclick = (e) => {
                    e.stopPropagation();
                    toggleCompleted();
                };
                const container = h.parentElement;
                container.appendChild(btn);
                applyCompletedVisibility();
            }
        });
    }

    function injectStyles() {
        const css = `
            ${CONFIG.features.hidePaywallElements ? `
                .SidebarFooter, .SidebarFooter--withoutModesSidebar, .BusinessOrAdvancedUpgradeButton, .PremiumIconItemA11y, .GlobalTopbar-upgradeButton, .TaskPaneGenerateSubtasksButton {
                    display: none !important;
                }
            ` : ""}
            .SpreadsheetTaskName-taskName:hover {
                position: relative; z-index: 9999; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                padding: 4px 8px; border-radius: 4px; width: auto !important; max-width: 600px; white-space: normal;
            }
            body.DesignTokenThemeSelectors-theme--darkMode .SpreadsheetTaskName-taskName:hover {
                background: #252628; color: white;
            }
            .inline-subtask-toggle:hover { opacity: 0.8; }
        `;
        if (!document.getElementById("asana-imp-styles")) {
            const style = document.createElement("style");
            style.id = "asana-imp-styles";
            style.innerHTML = css;
            document.head.appendChild(style);
        }
    }

    let debounceTimer;
    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            updateDueDates();
            autoExpand();
            injectToggleUI();
            applyCompletedVisibility();
        }, 300);
    });

    function init() {
        injectStyles();
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { updateDueDates(); autoExpand(); injectToggleUI(); }, 1000);
    }

    if (document.readyState === "complete") init();
    else window.addEventListener("load", init);

})();
