// ==UserScript==
// @name Asana Improvements
// @version 2.5.0
// @updateURL https://github.com/vojtaflorian/Asana-Improvements/raw/main/asana-improvements.user.js?v=@version
// @downloadURL https://github.com/vojtaflorian/Asana-Improvements/raw/main/asana-improvements.user.js?v=@version
// @description Asana workflow enhancements (Sol + Legacy support) + AI Breakdown & AI Enhance (Gemini)
// @author Vojta Florian
// @match https://app.asana.com/*
// @grant GM_setValue
// @grant GM_getValue
// @grant GM_registerMenuCommand
// @grant GM_xmlhttpRequest
// @connect generativelanguage.googleapis.com
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
            aiBreakdown: true,
            aiEnhance: true,
        },
        ai: {
            model: "gemini-2.5-flash",
            apiBase: "https://generativelanguage.googleapis.com/v1beta/models",
            storageKey: "gemini_api_key",
            maxComments: 15,
            maxCommentLen: 500,
            maxDescLen: 2000,
        },
        selectors: {
            dueDate: ".SpreadsheetTaskDueDateCell-cell span, .DueDateTokenButton span, .TaskDueDateToken-tokenButton span, [aria-label='Due date'] span",
            expandLinks: ".SubtaskGrid-loadMore, .TaskStoryFeed-expandLink, .SubtaskGrid-loadMoreSubtasksButton, .TruncatedRichText-expand, [aria-label*='Load more'], [aria-label*='Show more'], .SubtaskGridShowMoreRow-button",
            completedSubtask: ".SubtaskTaskRow--completed, .SubtaskGridRow--completed, .TaskPaneSubtasks-taskRow--completed",
            topbarAnchor: ".GlobalTopbar-rightSide, .LearningHubTopbarButton, .TopbarSettingsMenuButton",
            subtaskHeader: ".TaskPaneSubtasks-sectionHeadingText",
            sidebarFooter: ".SidebarFooter, .SidebarFooter--withoutModesSidebar",
            // AI context sources (best-effort; Asana mění DOM — případně dolaď podle [Asana-Imp] logu)
            taskName: 'textarea[aria-label="Task Name"]',
            description: ".ProseMirror",
            parentTask: ".TaskAncestry-ancestorLink",
            subtaskNames: ".SubtaskTaskRow-taskName textarea",
            addSubtask: '.SubtaskGrid-addSubtaskButton, [aria-label="Add subtask"]',
            comments: ".TaskStoryFeed .TruncatedRichText-content",
            attachments: ".AttachmentThumbnail-name, .TaskAttachmentsCard [class*='name'], .AttachmentGrid-thumbnailContainer [aria-label]",
        },
        storage: {
            completedTasksHidden: "asana_completed_tasks_hidden"
        }
    };

    let areCompletedHidden = localStorage.getItem(CONFIG.storage.completedTasksHidden) === "true";

    // --- AI API KEY SETUP MENU ---
    GM_registerMenuCommand("Nastavit Gemini API Klíč", () => {
        const currentKey = GM_getValue(CONFIG.ai.storageKey, "");
        const newKey = prompt("Zadejte svůj Google Gemini API klíč:", currentKey);
        if (newKey !== null) {
            GM_setValue(CONFIG.ai.storageKey, newKey.trim());
            alert("API klíč byl úspěšně uložen!");
        }
    });

    // ============================================================================
    // UTILITIES
    // ============================================================================

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

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

    // ============================================================================
    // AI: SHARED CORE (Gemini)
    // ============================================================================

    function getApiKey() {
        const key = GM_getValue(CONFIG.ai.storageKey, "");
        if (!key) {
            alert("Nejdříve si nastavte Gemini API klíč v menu Tampermonkey (ikona rozšíření → tento skript)!");
            return null;
        }
        return key;
    }

    /**
     * Volání Gemini. Bez groundingu vynutí JSON přes response_mime_type.
     * S groundingem (google_search) JSON vynutit nelze → instruujeme JSON v promptu a parsujeme z textu.
     * Vrací Promise<string> (raw text odpovědi).
     */
    function callGemini(promptText, { grounding = false } = {}) {
        return new Promise((resolve, reject) => {
            const apiKey = getApiKey();
            if (!apiKey) {
                reject(new Error("NO_API_KEY"));
                return;
            }

            const body = { contents: [{ parts: [{ text: promptText }] }] };
            if (grounding) {
                body.tools = [{ google_search: {} }];
            } else {
                body.generationConfig = { response_mime_type: "application/json" };
            }

            GM_xmlhttpRequest({
                method: "POST",
                url: `${CONFIG.ai.apiBase}/${CONFIG.ai.model}:generateContent?key=${apiKey}`,
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify(body),
                onload: (response) => {
                    if (response.status !== 200) {
                        reject(new Error(`HTTP ${response.status}: ${response.responseText}`));
                        return;
                    }
                    try {
                        const data = JSON.parse(response.responseText);
                        const cand = data.candidates && data.candidates[0];
                        if (!cand) {
                            const fb = data.promptFeedback ? JSON.stringify(data.promptFeedback) : "žádní kandidáti";
                            reject(new Error(`Prázdná odpověď AI (${fb})`));
                            return;
                        }
                        const parts = cand.content && cand.content.parts;
                        const text = parts ? parts.map(p => p.text || "").join("") : "";
                        if (!text) {
                            reject(new Error(`AI vrátila prázdný text (finishReason: ${cand.finishReason || "?"})`));
                            return;
                        }
                        resolve(text);
                    } catch (e) {
                        reject(new Error(`Parse chyba: ${e.message} | raw: ${response.responseText.slice(0, 500)}`));
                    }
                },
                onerror: () => reject(new Error("Síťová chyba při spojení s Google API.")),
            });
        });
    }

    /** Robustní extrakce JSON z textu (zvládne ```json fences i okolní prózu z groundingu). */
    function parseAiJson(text) {
        let t = text.trim();
        const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fence) t = fence[1].trim();
        if (!t.startsWith("{")) {
            const s = t.indexOf("{");
            const e = t.lastIndexOf("}");
            if (s !== -1 && e !== -1 && e > s) t = t.slice(s, e + 1);
        }
        return JSON.parse(t);
    }

    /** Posbírá kontext otevřeného úkolu z DOMu. */
    function gatherTaskContext() {
        const titleEl = document.querySelector(CONFIG.selectors.taskName) || document.querySelector("h1");
        const title = titleEl ? (titleEl.value || titleEl.innerText || "").trim() : "";

        const desc = (document.querySelector(CONFIG.selectors.description)?.innerText || "")
            .trim().slice(0, CONFIG.ai.maxDescLen);

        const ancestors = Array.from(document.querySelectorAll(CONFIG.selectors.parentTask))
            .map(a => a.innerText.trim()).filter(Boolean);

        const subtasks = Array.from(document.querySelectorAll(CONFIG.selectors.subtaskNames))
            .map(n => n.value.trim()).filter(Boolean);

        const comments = Array.from(document.querySelectorAll(CONFIG.selectors.comments))
            .map(c => c.innerText.trim()).filter(Boolean)
            .map(c => c.slice(0, CONFIG.ai.maxCommentLen))
            .slice(0, CONFIG.ai.maxComments);

        const attachments = Array.from(document.querySelectorAll(CONFIG.selectors.attachments))
            .map(a => (a.innerText || a.getAttribute("aria-label") || "").trim())
            .filter(Boolean);

        log("AI kontext:", { title, descLen: desc.length, ancestors: ancestors.length, subtasks: subtasks.length, comments: comments.length, attachments: attachments.length });
        return { title, desc, ancestors, subtasks, comments, attachments, hasTask: !!titleEl };
    }

    /** Společný stav tlačítka během běhu + jednotné chybové hlášení. */
    async function withLoading(btn, normalHtml, loadingHtml, fn) {
        if (btn) {
            btn.innerHTML = loadingHtml;
            btn.style.pointerEvents = "none";
        }
        try {
            await fn();
        } catch (e) {
            console.error("[Asana-Imp] AI chyba:", e);
            if (e.message !== "NO_API_KEY") alert("AI chyba: " + e.message);
        } finally {
            if (btn) {
                btn.innerHTML = normalHtml;
                btn.style.pointerEvents = "auto";
            }
        }
    }

    // ============================================================================
    // AI: TOPBAR BUTTONS
    // ============================================================================

    function makeTopbarBtn({ id, html, bg, color }) {
        const btn = document.createElement("button");
        btn.id = id;
        btn.innerHTML = html;
        btn.className = "ThemeableRectangularButtonPresentation ThemeableRectangularButtonPresentation--medium";
        Object.assign(btn.style, {
            margin: "0 6px 0 0",
            padding: "0 12px",
            height: "28px",
            fontSize: "11px",
            borderRadius: "4px",
            border: "none",
            cursor: "pointer",
            fontWeight: "600",
            backgroundColor: bg,
            color: color,
            transition: "background 0.2s",
        });
        return btn;
    }

    function addHover(btn, base, hover) {
        btn.onmouseover = () => (btn.style.backgroundColor = hover);
        btn.onmouseout = () => (btn.style.backgroundColor = base);
    }

    function injectAiButtons() {
        const anchor = document.querySelector(CONFIG.selectors.topbarAnchor);
        if (!anchor) return;
        const container = anchor.parentElement;

        if (CONFIG.features.aiBreakdown && !document.getElementById("ai-breakdown-btn")) {
            const btn = makeTopbarBtn({ id: "ai-breakdown-btn", html: "✨ AI Rozpad", bg: "#8a3ffc", color: "white" });
            addHover(btn, "#8a3ffc", "#6a2bc4");
            btn.onclick = handleBreakdownClick;
            container.insertBefore(btn, container.firstChild);
            log("✨ AI Rozpad tlačítko vloženo");
        }

        if (CONFIG.features.aiEnhance && !document.getElementById("ai-enhance-btn")) {
            const btn = makeTopbarBtn({ id: "ai-enhance-btn", html: "🔮 AI Vylepšení", bg: "#0d7d6c", color: "white" });
            addHover(btn, "#0d7d6c", "#0a5e51");
            btn.onclick = handleEnhanceClick;
            container.insertBefore(btn, container.firstChild);
            log("🔮 AI Vylepšení tlačítko vloženo");
        }
    }

    // ============================================================================
    // AI: PROMPTS
    // ============================================================================

    function buildBreakdownPrompt(ctx) {
        return `
# Role
Jste expert na projektové řízení se zaměřením na rozpad úkolů v kontextu plánování.

# Task
Rozdělit zadaný úkol na menší, logické, spravovatelné podúkoly a vrátit je jako strukturovaný seznam v JSON formátu. Výstup musí obsahovat pouze **konkrétní, akční kroky** — žádné abstraktní kategorie, obecné procesy nebo korporátní klišé.

# Instructions

## Klíčová pravidla
- Vrať **POUZE jednu úroveň** podúkolů (plochý seznam bez zanořených pod-pod-úkolů)
- Omez počet nových podúkolů na **maximálně 5-6 položek** — eliminuj redundanci, agreguj související krůčky
- Používej typ section pouze pro tematické seskupení (max 2 sekce), pouze pokud zásadně zlepší srozumitelnost
- **Nikdy neduplikuj** již existující podúkoly — tvůj návrh by měl být doplňující
- **Každý úkol musí být konkrétní a akční** — vylučuj všechny abstraktní fáze, obecné procesy, evaluace bez implementace a formulace bez specifického výstupu
- Prioritizuj logickou posloupnost — úkoly by měly následovat přirozený tok práce

## Co VYLOUČIT
Nepřidávej úkoly typu: "Analýza"/"Vyhodnocení" bez výstupu, "Formulování doporučení", procesy seskupování/kategorizace, obecné manageriální kroky, přípravné fáze bez vykonatelnosti, prezentace stakeholderům.
Jestliže navrhuješ sekci, musí mít uvnitř alespoň 2-3 konkrétní podúkoly.

## Kontext úkolu
- Nadřazený kontext: ${ctx.ancestors.join(" > ") || "Žádný"}
- Název úkolu: ${ctx.title}
- Popis úkolu: ${ctx.desc || "Bez popisu"}
- Již existující podúkoly: ${ctx.subtasks.join(", ") || "Žádné"}

## Výstup
Vrať **striktně validní JSON**:
{
  "items": [
    { "type": "section" | "subtask", "title": "Jasný, konkrétní, akční název" }
  ]
}
`;
    }

    function buildEnhancePrompt(ctx) {
        return `
# Role
Jste senior projektový analytik. Důkladně prostudujete kontext úkolu a navrhnete (a) vylepšený popis a (b) doplňující podúkoly.

# Task
Na základě VŠECH dostupných informací (popis, komentáře, podúkoly, nadřazené úkoly, přílohy) vrať JSON se dvěma částmi: vylepšeným popisem a seznamem doplňujících podúkolů.

# Výzkum
Máš k dispozici vyhledávání na webu. Pokud úkol odkazuje na konkrétní technologie, knihovny, API, normy nebo nástroje, **dohledej a vlož relevantní, REÁLNĚ EXISTUJÍCÍ odkazy** (oficiální dokumentace, specifikace). Nikdy si URL nevymýšlej — pokud si nejsi jistý existencí odkazu, vynech ho.

# Popis — pravidla
- **Stručný, ale hutný.** Žádná vata, žádné korporátní klišé.
- Strukturuj: 1 věta cíl → klíčové body / kroky → odkazy na dokumentaci (bare URL na samostatném řádku).
- Doplň jen to, co reálně přidává hodnotu oproti stávajícímu popisu (kontext, gotchas, odkazy). Neopakuj zbytečně název úkolu.
- Piš česky. Plain text (žádný markdown nadpis), odřádkování běžnými znaky nového řádku.

# Podúkoly — pravidla
- Plochý seznam, max 5-6 konkrétních akčních položek, žádné duplikáty existujících.
- Section jen pro tematické seskupení (max 2), každá s 2-3 podúkoly.

# Kontext úkolu
- Nadřazený kontext: ${ctx.ancestors.join(" > ") || "Žádný"}
- Název úkolu: ${ctx.title}
- Stávající popis: ${ctx.desc || "Bez popisu"}
- Existující podúkoly: ${ctx.subtasks.join(", ") || "Žádné"}
- Přílohy (názvy): ${ctx.attachments.join(", ") || "Žádné"}
- Komentáře:
${ctx.comments.length ? ctx.comments.map((c, i) => `[${i + 1}] ${c}`).join("\n") : "Žádné"}

# Výstup
Vrať POUZE validní JSON (žádné markdown fences, žádný text okolo):
{
  "description": "Vylepšený popis jako plain text...",
  "subtasks": [
    { "type": "section" | "subtask", "title": "Konkrétní akční název" }
  ]
}
`;
    }

    // ============================================================================
    // AI: CLICK HANDLERS
    // ============================================================================

    function handleBreakdownClick() {
        const btn = document.getElementById("ai-breakdown-btn");
        const ctx = gatherTaskContext();
        if (!ctx.hasTask) {
            alert("Nejdříve v Asaně rozklikni detail úkolu (pravý panel)!");
            return;
        }
        withLoading(btn, "✨ AI Rozpad", "⏳ Zpracovávám...", async () => {
            const text = await callGemini(buildBreakdownPrompt(ctx), { grounding: false });
            const items = parseAiJson(text).items || [];
            if (!items.length) {
                alert("AI nevrátila žádné podúkoly.");
                return;
            }
            showApprovalModal({
                heading: "Zkontrolovat a vytvořit podúkoly",
                items,
                onConfirm: ({ items }) => createSubtasksSequentially(items),
            });
        });
    }

    function handleEnhanceClick() {
        const btn = document.getElementById("ai-enhance-btn");
        const ctx = gatherTaskContext();
        if (!ctx.hasTask) {
            alert("Nejdříve v Asaně rozklikni detail úkolu (pravý panel)!");
            return;
        }
        withLoading(btn, "🔮 AI Vylepšení", "⏳ Studuji kontext...", async () => {
            const text = await callGemini(buildEnhancePrompt(ctx), { grounding: true });
            const parsed = parseAiJson(text);
            const description = typeof parsed.description === "string" ? parsed.description : "";
            const items = Array.isArray(parsed.subtasks) ? parsed.subtasks : [];
            if (!description && !items.length) {
                alert("AI nevrátila popis ani podúkoly.");
                return;
            }
            showApprovalModal({
                heading: "Vylepšení úkolu — zkontrolovat a zapsat",
                description,
                items,
                onConfirm: async ({ description, items }) => {
                    if (description !== null) await writeDescription(description);
                    if (items.length) await createSubtasksSequentially(items);
                },
            });
        });
    }

    // ============================================================================
    // AI: APPROVAL MODAL (DOM-built — bez HTML injection)
    // ============================================================================

    function showApprovalModal({ heading, description = null, items = [], onConfirm }) {
        const existing = document.getElementById("ai-modal-overlay");
        if (existing) existing.remove();

        const overlay = document.createElement("div");
        overlay.id = "ai-modal-overlay";
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.6);z-index:999999;display:flex;justify-content:center;align-items:center;";

        const box = document.createElement("div");
        box.style.cssText = "width:600px;max-height:85vh;display:flex;flex-direction:column;background-color:var(--color-background-panel, var(--color-surface-default, window));color:var(--color-text-default, windowtext);border-radius:8px;border:1px solid var(--color-border-default, #e8ecee);box-shadow:0 4px 20px rgba(0,0,0,0.3);padding:24px;";

        const h2 = document.createElement("h2");
        h2.textContent = heading;
        h2.style.cssText = "margin:0 0 16px;";
        box.appendChild(h2);

        // --- Description section (jen pro Enhance) ---
        let descCheckbox = null;
        let descTextarea = null;
        if (description !== null) {
            const wrap = document.createElement("div");
            wrap.style.cssText = "margin-bottom:20px;";

            const label = document.createElement("label");
            label.style.cssText = "display:flex;align-items:center;gap:8px;font-weight:600;margin-bottom:8px;cursor:pointer;";
            descCheckbox = document.createElement("input");
            descCheckbox.type = "checkbox";
            descCheckbox.checked = true;
            descCheckbox.style.cursor = "pointer";
            label.appendChild(descCheckbox);
            label.appendChild(document.createTextNode("Zapsat navržený popis"));
            wrap.appendChild(label);

            descTextarea = document.createElement("textarea");
            descTextarea.value = description; // property → žádná injection
            descTextarea.style.cssText = "width:100%;min-height:140px;resize:vertical;box-sizing:border-box;padding:8px;border:1px solid var(--color-border-default, #e8ecee);border-radius:4px;background:transparent;color:inherit;font:inherit;";
            wrap.appendChild(descTextarea);
            box.appendChild(wrap);
        }

        // --- Subtasks section ---
        if (items.length) {
            const controls = document.createElement("div");
            controls.style.cssText = "display:flex;gap:12px;margin-bottom:12px;";
            const btnUncheck = document.createElement("button");
            btnUncheck.type = "button";
            btnUncheck.textContent = "Odznačit vše";
            btnUncheck.className = "ThemeableRectangularButtonPresentation ThemeableRectangularButtonPresentation--medium ThemeableRectangularButtonPresentation--secondary";
            const btnCheck = document.createElement("button");
            btnCheck.type = "button";
            btnCheck.textContent = "Označit vše";
            btnCheck.className = "ThemeableRectangularButtonPresentation ThemeableRectangularButtonPresentation--medium ThemeableRectangularButtonPresentation--secondary";
            controls.appendChild(btnUncheck);
            controls.appendChild(btnCheck);
            box.appendChild(controls);

            const list = document.createElement("div");
            list.style.cssText = "overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:24px;";

            const rows = items.map((item, index) => {
                const isSection = item.type === "section";
                const row = document.createElement("div");
                row.style.cssText = `display:flex;align-items:center;gap:12px;padding-left:${isSection ? "0" : "24px"};`;

                const chk = document.createElement("input");
                chk.type = "checkbox";
                chk.checked = true;
                chk.dataset.type = item.type;
                chk.style.cursor = "pointer";

                const txt = document.createElement("input");
                txt.type = "text";
                txt.value = item.title || "";
                txt.dataset.type = item.type;
                txt.className = "TextInput";
                txt.style.cssText = `flex:1;background-color:transparent;color:inherit;${isSection ? "font-weight:bold;" : ""}`;

                row.appendChild(chk);
                row.appendChild(txt);
                list.appendChild(row);
                return { chk, txt, item, index };
            });
            box.appendChild(list);

            // Kaskádové (de)označení sekce → její podúkoly
            rows.forEach(({ chk, item }, index) => {
                if (item.type !== "section") return;
                chk.addEventListener("change", () => {
                    for (let i = index + 1; i < rows.length; i++) {
                        if (rows[i].item.type === "section") break;
                        rows[i].chk.checked = chk.checked;
                    }
                });
            });

            const setAll = (checked) => rows.forEach(r => (r.chk.checked = checked));
            btnUncheck.onclick = () => setAll(false);
            btnCheck.onclick = () => setAll(true);

            box._collectItems = () => rows
                .filter(r => r.chk.checked)
                .map(r => ({ type: r.txt.dataset.type, title: r.txt.value.trim() }))
                .filter(r => r.title);
        } else {
            box._collectItems = () => [];
        }

        // --- Footer ---
        const footer = document.createElement("div");
        footer.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-top:auto;";
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.textContent = "Zrušit";
        cancel.className = "ThemeableRectangularButtonPresentation ThemeableRectangularButtonPresentation--medium ThemeableRectangularButtonPresentation--secondary";
        const confirm = document.createElement("button");
        confirm.type = "button";
        confirm.textContent = "Zapsat do Asany";
        confirm.className = "ThemeableRectangularButtonPresentation ThemeableRectangularButtonPresentation--medium ThemeableRectangularButtonPresentation--primary";
        footer.appendChild(cancel);
        footer.appendChild(confirm);
        box.appendChild(footer);

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        cancel.onclick = () => overlay.remove();
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) overlay.remove();
        });

        confirm.onclick = async () => {
            const result = {
                description: descCheckbox && descCheckbox.checked ? descTextarea.value.trim() : null,
                items: box._collectItems(),
            };
            confirm.textContent = "Zapisuji...";
            confirm.style.pointerEvents = "none";
            try {
                await onConfirm(result);
            } catch (e) {
                console.error("[Asana-Imp] Zápis selhal:", e);
                alert("Zápis do Asany selhal: " + e.message);
            }
            overlay.remove();
        };
    }

    // ============================================================================
    // AI: WRITE-BACK TO ASANA
    // ============================================================================

    function textToHtml(text) {
        const esc = escapeHtml(text);
        const linked = esc.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
        return linked
            .split(/\n{2,}/)
            .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
            .join("");
    }

    /**
     * Zápis popisu do ProseMirror editoru.
     * Primárně paste event s text/html (zachová odkazy), fallback execCommand insertText (plain).
     * Pozn.: ProseMirror je contentEditable, ne textarea — nativní value setter zde nefunguje.
     */
    async function writeDescription(text) {
        const editor = document.querySelector(CONFIG.selectors.description);
        if (!editor) {
            log("ProseMirror editor nenalezen — popis nezapsán");
            return false;
        }
        editor.focus();
        await new Promise(r => setTimeout(r, 100));
        document.execCommand("selectAll", false, null);

        let handled = false;
        try {
            const dt = new DataTransfer();
            dt.setData("text/html", textToHtml(text));
            dt.setData("text/plain", text);
            const pasteEvent = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt });
            // dispatchEvent vrací false, když ProseMirror zavolá preventDefault (= zpracoval paste)
            handled = editor.dispatchEvent(pasteEvent) === false;
        } catch (e) {
            log("Paste event selhal, fallback na insertText:", e.message);
        }

        if (!handled) {
            document.execCommand("insertText", false, text);
        }
        log("Popis zapsán (paste:", handled, ")");
        return true;
    }

    async function createSubtasksSequentially(items) {
        for (const item of items) {
            const addBtn = document.querySelector(CONFIG.selectors.addSubtask);
            if (!addBtn) {
                console.warn("[Asana-Imp] Tlačítko pro přidání podúkolu nenalezeno.");
                continue;
            }

            addBtn.click();
            await new Promise(resolve => setTimeout(resolve, 350));

            const activeInput = document.activeElement;
            if (activeInput && activeInput.tagName === "TEXTAREA") {
                const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;

                // Sekci vložíme jako vizuálně odlišený podúkol (Asana nemá API na sekce v podúkolech)
                let textToInsert = item.title;
                if (item.type === "section") {
                    textToInsert = `[ ${item.title.toUpperCase()} ]`;
                }

                nativeTextAreaValueSetter.call(activeInput, textToInsert);
                activeInput.dispatchEvent(new Event("input", { bubbles: true }));
                activeInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));

                await new Promise(resolve => setTimeout(resolve, 400));
            }
        }
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    let debounceTimer;
    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            updateDueDates();
            autoExpand();
            injectToggleUI();
            applyCompletedVisibility();
            injectAiButtons();
        }, 300);
    });

    function init() {
        injectStyles();
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            updateDueDates();
            autoExpand();
            injectToggleUI();
            injectAiButtons();
        }, 1000);
    }

    if (document.readyState === "complete") init();
    else window.addEventListener("load", init);

})();
