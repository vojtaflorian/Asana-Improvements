// ==UserScript==
// @name Asana better workflow
// @namespace http://example.com
// @version 0.442
// @updateURL https://raw.githubusercontent.com/vojtaflorian/Asana-Improvements/main/AsanaBetterWorkflow.js
// @downloadURL https://raw.githubusercontent.com/vojtaflorian/Asana-Improvements/main/AsanaBetterWorkflow.js
// @description Forced Asana min width.
// @author Vojta Florian
// @homepage https://vojtaflorian.com
// @match https://app.asana.com/*


// @grant none
// ==/UserScript==

(function() {
    'use strict';

/*ÚPRAVA STYLU, ODEBRÁNÍ ZBYTEČNOSTÍ A ŠÍŘKA ÚKOLU NA MALÉM OKNĚ*/
    addGlobalStyle(`
.InboxPanesOrEmptyState-detailsPane:not(.InboxPanesOrEmptyState-pane--windowed) {
     width: 80% !important;
}


.FullWidthPageStructureWithDetailsOverlay-detailsOverlay--fullHeightTaskPane {
   width: 65% !important;
   min-width: 50% !important;
}

.Sidebar-changeInviteIconEnabled,
.Sidebar-cleanAndClearInviteAndHelpSection,
.BusinessOrAdvancedUpgradeButton,
.GlobalTopbar-upgradeButton,
/*odebírá placené funkce*/
.PremiumIconItemA11y,
.TaskPaneGenerateSubtasksButton,
.AiAssistantGlobalTopbarPaneButtonPresentation {
     display: none !important;
}


.CustomPropertyEnumValueInput-button.CustomPropertyEnumValueInput-button--large {
     max-width: 100px !important;
     padding: 5px !important;
}
.SpreadsheetCell--isCompact.SpreadsheetCell,
.SpreadsheetCell--isCompact.SpreadsheetCell.SpreadsheetCustomPropertyEnumCell-spreadsheetCell,
.SpreadsheetCell--isCompact.SpreadsheetCell.SpreadsheetAssigneeCell-cell.SpreadsheetTaskRow-assigneeCell,
.SpreadsheetCell--isCompact.SpreadsheetCell.SpreadsheetCustomPropertyNumberCell-spreadsheetCell,
.SpreadsheetHeaderColumn--fixedWidth.SpreadsheetHeaderColumn--isClickable.SpreadsheetHeaderColumn.SpreadsheetProjectHeaderRow-headerColumn {
    width: 80px !important;
}

`);

    function addGlobalStyle(css) {
        var head, style;
        head = document.getElementsByTagName('head')[0];
        if (!head) { return; }
        style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css;
        head.appendChild(style);
    }

/*PŘIDÁNÍ POČTU DNŮ K DATUMU ÚKOLU*/

 // Funkce pro převod textu na datum
var str2date = (s) => {
    var days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (s === 'Today') { return new Date(); }
    if (s === 'Tomorrow') { return new Date((new Date()).getTime() + 24 * 60 * 60 * 1000); }
    if (days.indexOf(s) > -1) {
        var date = new Date();
        for (var i = 1; i < 7; i++) {
            date = new Date((new Date()).getTime() + i * 24 * 60 * 60 * 1000);
            if (date.getDay() === days.indexOf(s) + 1) { // +1 protože getDay vrací index od neděle
                return date;
            }
        }
    }
    return new Date(s.includes(',') ? s : s + ',' + (new Date()).getFullYear());
};

// Funkce pro aktualizaci due date polí
function updateDueDates() {
    const dueDates = document.querySelectorAll('div.DueDate');
    dueDates.forEach(duedate => {
        if (duedate && !duedate.innerText.includes('(')) {
            var date_today = new Date();
            var date_due = str2date(duedate.innerText);
            var days_left = (date_due - date_today) / (1000 * 60 * 60 * 24);
            if (days_left > 0) {
                duedate.innerText = duedate.innerText + ' (' + Math.ceil(days_left) + ' days)';
            }
        }
    });
}

// Inicializace při načtení stránky
document.addEventListener('DOMContentLoaded', () => {
    updateDueDates();
});

// Nastavení MutationObserver pro sledování změn v DOM
const mobs = new MutationObserver((mutations) => {
    mutations.forEach(() => {
        updateDueDates();
    });
});

mobs.observe(document.body, {
    subtree: true,
    childList: true,
});
/*AUTOCLICK NA NAČTENÍ VŠECH SUBTASKS A CELÝCH KOMENTÁŘŮ*/
  /*TLAČÍTKO PRO SKRÝVÁNÍ HOTOVÝCH ÚKOLŮ*/
    function createToggleButton() {
        if (document.querySelector('#toggleCompletedSubtasksButton')) return;

        const button = document.createElement('button');
        button.id = 'toggleCompletedSubtasksButton';
        button.innerText = 'Toggle Complete tasks';
        button.style.marginLeft = '10px';
        button.style.cursor = 'pointer';
        button.classList.add('ThemeableRectangularButtonPresentation', 'ThemeableRectangularButtonPresentation--medium', 'TopbarContingentUpgradeButton-button', 'UpsellButton');

        button.addEventListener('click', () => {
            toggleCompletedSubtasks();
            updateTaskIndicators();
        });

        const topbarRightSide = document.querySelector('.GlobalTopbarStructure-rightSide');
        if (topbarRightSide) {
            topbarRightSide.appendChild(button);
        }
    }

    function applySavedState() {
        const currentState = localStorage.getItem('completedSubtasksHidden') === 'true';
        const completedSubtasks = document.querySelectorAll('.SubtaskTaskRow--completed');
        completedSubtasks.forEach(subtask => {
            if (currentState) {
                subtask.style.display = 'none';
            } else {
                subtask.style.display = '';
            }
        });
        updateTaskIndicators();
    }

    function toggleCompletedSubtasks() {
        const completedSubtasks = document.querySelectorAll('.SubtaskTaskRow--completed');
        const currentState = localStorage.getItem('completedSubtasksHidden') === 'true';
        completedSubtasks.forEach(subtask => {
            if (currentState) {
                subtask.style.display = '';
            } else {
                subtask.style.display = 'none';
            }
        });
        localStorage.setItem('completedSubtasksHidden', !currentState);
    }

    function updateTaskIndicators() {
        const tasks = document.querySelectorAll('.TaskPaneSubtasks-label');
        tasks.forEach(task => {
            const subtasks = task.closest('.TaskPane').querySelectorAll('.SubtaskTaskRow--completed');
            let indicator = task.querySelector('.completed-subtasks-indicator');

            if (subtasks.length > 0) {
                if (!indicator) {
                    indicator = document.createElement('span');
                    indicator.classList.add('completed-subtasks-indicator');
                    indicator.innerText = ' [Toggle Complete tasks]';
                    indicator.style.color = '#eb7586';
                    indicator.style.cursor = 'pointer';
                    indicator.addEventListener('click', () => {
                        toggleCompletedSubtasks();
                        updateTaskIndicators();
                    });
                    task.querySelector('.LabeledRowStructure-right .LabeledRowStructure-content').appendChild(indicator);
                }
            } else if (indicator) {
                indicator.remove();
            }
        });
    }

    function clickButtons() {
        const links = document.querySelectorAll('.SubtaskGrid-loadMore, .TruncatedRichText-expand');
        links.forEach(link => link.click());
    }

    document.addEventListener('DOMContentLoaded', () => {
        clickButtons();
        createToggleButton();
        applySavedState();
    });

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                clickButtons();
                createToggleButton();
                applySavedState();
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
