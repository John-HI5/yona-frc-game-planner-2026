const slotCoords = [
    {x: 145, y: 270-27}, {x: 145, y: 490-27}, {x: 145, y: 880-27-27-15},
    {x: 2350, y: 420-27}, {x: 2350, y: 807-27-27-10}, {x: 2350, y: 1040-27-27-20}
];

// Add this near your other variable declarations
var robotHomePositions = [];

const fieldCanvas = document.getElementById("field-canvas");
const stageCanvas = document.getElementById("stage-canvas");
const slotsLayer = document.getElementById("slots-layer");
const background = document.getElementById("field-background");
const colorPicker = document.getElementById("robot-color-picker-container");
const timerDisplay = document.getElementById("timer-display");
var isDeleteMode = false;
var lastBackgroundClickTime = 0;

var isDraggingSlot = false;
var draggedSlotIndex = null;

var currentRobotSize = 60;
var currentTextSize = 14;
const CLICK_THRESHOLD = 200; 

const Alliance = { BLUE: 0, RED: 1 };
const CanvasMode = { DELETE: 0, PEN: 1, DRAG: 2, POLYGON: 3, ROBOT: 4, PIECE: 5, ARROW: 6 };

var currentCanvasMode = CanvasMode.DRAG;
var selectedColor = "#FFF";
var allianceColor = Alliance.BLUE;

var redRobots = [];
var blueRobots = [];
var heightRatio = 1.0; 

var selectedElement = null;
var offset = null;
var transform = null;
var robotToColor = null;
var clickStartTime = 0;

var lastClickTime = 0;
var clickCount = 0;

var pendingSlot = null;


var currentTabId = 'AUTO';
const tabNames = ['AUTO', 'TRA SHIFT', 'ALL SHIFT 1', 'ALL SHIFT 2', 'ALL SHIFT 3', 'ALL SHIFT 4', 'END GAME'];

var tabStates = {};
tabNames.forEach(name => {
    tabStates[name] = {
        robotPaths: new Map(),
        recordingTime: 0,
        positions: [] 
    };
});

var robotPaths = tabStates[currentTabId].robotPaths;
var activeRobotTime = 0;

// משתנה חדש לשמירת הלו"ז בזיכרון
var cachedSchedule = null;

window.onload = function () { 
    resizeCanvas(); 
    spawnInitialRobots();
    initSlots();
    captureAllTabPositions();

    // Add this line:
    document.addEventListener('fullscreenchange', resizeCanvas);
};

// ---save functions ---





function exportProgress() {
    // Create a copy of tabStates to modify for export
    const exportData = {};

    tabNames.forEach(name => {
        const state = tabStates[name];
        exportData[name] = {
            recordingTime: state.recordingTime,
            positions: state.positions,
            // Convert the Map to an Array of [key, value] pairs for JSON
            robotPaths: Array.from(state.robotPaths.entries()).map(([robot, path]) => {
                // Store robot by its index or ID so we can relink it on import
                const robotIndex = [...document.querySelectorAll('.robot-group')].indexOf(robot);
                return { robotIndex, path };
            })
        };
    });

    const dataStr = JSON.stringify(exportData);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `FRC_Strategy_${new Date().toLocaleDateString()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
}





function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const lines = text.split('\n').map(line => line.trim()).filter(line => line !== "");
            
            // חילוץ כותרות כדי למצוא אינדקסים של עמודות
            const headers = lines[0].split(',');
            const getIdx = (name) => headers.indexOf(name);

            const idx = {
                matchKey: getIdx('match_key'),
                red1: getIdx('red1'), red2: getIdx('red2'), red3: getIdx('red3'),
                blue1: getIdx('blue1'), blue2: getIdx('blue2'), blue3: getIdx('blue3')
            };

            // ניקוי הטאבים הקיימים (אופציונלי - תלוי אם אתה רוצה להוסיף או להחליף)
            // tabNames = []; 
            // tabStates = {};

            for (let i = 1; i < lines.length; i++) {
                const data = lines[i].split(',');
                if (data.length < headers.length) continue;

                const matchKey = data[idx.matchKey];
                // חילוץ שם קצר לטאב (למשל qm1 במקום 2026casnv_qm1)
                const tabId = matchKey.includes('_') ? matchKey.split('_')[1] : matchKey;

                // יצירת הסטייט עבור הטאב החדש מה-CSV
                if (!tabStates[tabId]) {
                    tabNames.push(tabId);
                    tabStates[tabId] = {
                        recordingTime: 0,
                        positions: {},
                        robotPaths: new Map(),
                        // שמירת מספרי הקבוצות בסטייט כדי שנוכל להציג אותם
                        teams: [
                            data[idx.red1], data[idx.red2], data[idx.red3],
                            data[idx.blue1], data[idx.blue2], data[idx.blue3]
                        ]
                    };
                }
            }

            // עדכון ה-UI (יצירת כפתורי הטאבים מחדש)
            renderTabs(); 
            
            // מעבר לטאב הראשון שנטען
            if (tabNames.length > 0) switchTab(tabNames[0]);

            alert(`נטענו ${lines.length - 1} משחקים בהצלחה!`);
        } catch (err) {
            console.error("Error parsing CSV:", err);
            alert("שגיאה בטעינת ה-CSV. וודא שהקובץ בפורמט הנכון.");
        }
    };
    reader.readAsText(file);
}

function loadMatchByNumber() {
    if (Object.keys(tabStates).length === 0) {
        alert("אם לא תשלח (CSV), איך תקח??");
        return;
    }

    const matchInput = prompt("איזה מספר משחק יאח?");
    if (!matchInput) return;

    const tabId = "qm" + matchInput;
    const matchData = tabStates[tabId];

    if (matchData && matchData.teams) {
        // המעבר לטאב עכשיו יוצר את השכבה אוטומטית בצורה בטוחה
        switchTab(tabId);

        // עדכון מספרי הרובוטים
        const teams = matchData.teams;
        [...redRobots, ...blueRobots].forEach((bot, i) => {
            if (bot && teams[i]) {
                bot.numberElement.textContent = teams[i];
                const prefix = i < 3 ? 'r' : 'b';
                const inputIdx = i < 3 ? i + 1 : i - 2;
                const inputField = document.getElementById(`${prefix}${inputIdx}`);
                if (inputField) inputField.value = teams[i];
            }
        });

        alert(`משחק ${matchInput} נטען בהצלחה! עכשיו תנסה לצייר.`);
    } else {
        alert(`משחק מספר ${matchInput} לא נמצא ב-CSV כפרה עליך`);
    }
}



// פונקציית עזר לריענון הטאבים ב-UI (תתאים את זה לשם הפונקציה אצלך)
function renderTabs() {
    const container = document.getElementById('tabs-container'); // שנה ל-ID האמיתי שלך
    if (!container) return;
    
    container.innerHTML = "";
    tabNames.forEach(name => {
        const btn = document.createElement('button');
        btn.innerText = name;
        btn.onclick = () => switchTab(name);
        container.appendChild(btn);
    });
}















// 1. פונקציה לטעינת הקובץ לזיכרון (קורה פעם אחת)
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            cachedSchedule = JSON.parse(e.target.result);
            alert("יונה טען לך יופי טופי");
            // אופציונלי: להפעיל ישר את בחירת המשחק אחרי הטעינה
            loadMatchByNumber();
        } catch (err) {
            console.error("JSON Error Details:", err);
            alert("חביריקו הקובץ אינו תקין...");
        }
    };
    reader.readAsText(file);
}


function undoLastAction() {
    // 1. Identify the current layer based on the active tab
    const layerId = `draw-layer-${currentTabId.replace(/ /g, '-')}`;
    const layer = document.getElementById(layerId);

    if (layer && layer.lastChild) {
        // 2. Remove the last element added (polyline, line, or image)
        layer.removeChild(layer.lastChild);
    } else {
        console.log("Nothing left to undo on this tab.");
    }
}



/*
// 2. פונקציה לשליפת משחק ספציפי מהזיכרון (מופעלת מהכפתור החדש)
function loadMatchByNumber() {
    if (!cachedSchedule) {
        alert("אם לא תשלח, איך תקח??");
        return;
    }

    const matchInput = prompt("איזה מספר משחק יאח?");
    if (!matchInput) return;

    // חיפוש בפורמט הרשמי של FRC
    const match = cachedSchedule.find(m => m.match_number == matchInput);

    if (match) {
        // עדכון ברית כחולה
        if (match.alliances && match.alliances.blue) {
            match.alliances.blue.team_keys.forEach((teamKey, index) => {
                if (blueRobots[index]) {
                    const teamNum = teamKey.replace('frc', '');
                    blueRobots[index].numberElement.innerHTML = teamNum;
                    const inputField = document.getElementById(`b${index + 1}`);
                    if (inputField) inputField.value = teamNum;
                }
            });
        }

        // עדכון ברית אדומה
        if (match.alliances && match.alliances.red) {
            match.alliances.red.team_keys.forEach((teamKey, index) => {
                if (redRobots[index]) {
                    const teamNum = teamKey.replace('frc', '');
                    redRobots[index].numberElement.innerHTML = teamNum;
                    const inputField = document.getElementById(`r${index + 1}`);
                    if (inputField) inputField.value = teamNum;
                }
            });
        }
        alert(`משחק ${matchInput} נטען ללוח בכישלון אדיר! תאשים את צוות בקרה`);
    } else {
        alert(`משחק מספר ${matchInput} לא נמצא בקובץ כפרה עליך`);
    }
}
*/
// --- המשך הקוד המקורי ---

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        // Enters fullscreen mode
        document.documentElement.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    } else {
        // Exits fullscreen mode
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}
/*
function initSlots() {
    slotsLayer.innerHTML = "";
    slotCoords.forEach(coord => {
        let group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("transform", `translate(${coord.x}, ${coord.y})`);
        group.classList.add("slot-group");
        
        let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("r", 40);
        circle.setAttribute("fill", "rgba(255,255,255,0.2)");
        circle.setAttribute("stroke", "white");
        circle.setAttribute("stroke-width", "2");
        
        let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("fill", "white");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.style.fontFamily = "monospace";
        text.style.fontWeight = "900";
        text.style.fontSize = currentTextSize + "px";
        text.style.pointerEvents = "none";

        group.appendChild(circle);
        group.appendChild(text);
        slotsLayer.appendChild(group);

        group.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            if (pendingSlot) pendingSlot.classList.remove("slot-active");
            pendingSlot = group;
            group.classList.add("slot-active");
        });
    });
}


function initSlots() {
    slotsLayer.innerHTML = "";
    
    // קבלת הממדים האמיתיים של הרקע כרגע
    const bgRect = background.getBoundingClientRect();
    const originalWidth = 2500; // רוחב התמונה המקורית שעלפיה קבעת את הקואורדינטות
    const originalHeight = 1200; // גובה התמונה המקורית (שנה לערך המדויק שלך אם שונה)
    
    // חישוב היחס בין הגודל המקורי לגודל המוצג כרגע
    const scaleX = bgRect.width / originalWidth;
    const scaleY = bgRect.height / originalHeight;

    slotCoords.forEach(coord => {
        let group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        
        // מיקום העיגול מוכפל ביחס של המסך הנוכחי
        const posX = coord.x * scaleX;
        const posY = coord.y * scaleY;
        
        group.setAttribute("transform", `translate(${posX}, ${posY})`);
        group.classList.add("slot-group");
        
        let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        // גם הרדיוס צריך להשתנות לפי גודל המסך
        circle.setAttribute("r", 40 * scaleX); 
        circle.setAttribute("fill", "rgba(255,255,255,0.2)");
        circle.setAttribute("stroke", "white");
        circle.setAttribute("stroke-width", "2");
        
        // ... (שאר הקוד של הטקסט נשאר זהה)
        let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("fill", "white");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.style.fontFamily = "monospace";
        text.style.fontWeight = "900";
        text.style.fontSize = (currentTextSize * scaleX) + "px";
        text.style.pointerEvents = "none";

        group.appendChild(circle);
        group.appendChild(text);
        slotsLayer.appendChild(group);

        group.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            if (pendingSlot) pendingSlot.classList.remove("slot-active");
            pendingSlot = group;
            group.classList.add("slot-active");
        });
    });
}

function initSlots() {
    slotsLayer.innerHTML = "";
    const bgRect = background.getBoundingClientRect();
    
    // וודא שהמספרים האלו הם הרזולוציה המדויקת של קובץ ה-PNG שלך
    const originalWidth = 2500; 
    const originalHeight = 1185; // שיניתי מ-1200 ל-1185 כדי שיתאים למגרש FRC סטנדרטי

    const scaleX = bgRect.width / originalWidth;
    const scaleY = bgRect.height / originalHeight;

    slotCoords.forEach(coord => {
        let group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        
        const posX = coord.x * scaleX;
        const posY = coord.y * scaleY;
        
        group.setAttribute("transform", `translate(${posX}, ${posY})`);
        group.classList.add("slot-group");
        
        let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("r", 40 * scaleX); 
        circle.setAttribute("fill", "rgba(255,255,255,0.2)");
        circle.setAttribute("stroke", "white");
        circle.setAttribute("stroke-width", "2");
        
        let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("fill", "white");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.style.fontFamily = "monospace";
        text.style.fontWeight = "900";
        // הוספתי scaleX גם לגודל הטקסט כדי שיקטן בטאבלט
        text.style.fontSize = (currentTextSize * scaleX) + "px"; 
        text.style.pointerEvents = "none";

        group.appendChild(circle);
        group.appendChild(text);
        slotsLayer.appendChild(group);

        group.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            if (pendingSlot) pendingSlot.classList.remove("slot-active");
            pendingSlot = group;
            group.classList.add("slot-active");
        });
    });
}

*/

function initSlots() {
    slotsLayer.innerHTML = "";
    const bgRect = background.getBoundingClientRect();
    
    const originalWidth = 2500; 
    const originalHeight = 1185; 

    const scaleX = bgRect.width / originalWidth;
    const scaleY = bgRect.height / originalHeight;

    slotCoords.forEach((coord, index) => {
        let group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        
        const posX = coord.x * scaleX;
        const posY = coord.y * scaleY;
        
        group.setAttribute("transform", `translate(${posX}, ${posY})`);
        group.classList.add("slot-group");
        group.setAttribute("data-index", index); 
        group.style.cursor = "move";
        
        let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("r", 40 * scaleX); 
        circle.setAttribute("fill", "rgba(255,255,255,0.2)");
        circle.setAttribute("stroke", "white");
        circle.setAttribute("stroke-width", "2");
        
        let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("fill", "white");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.style.fontFamily = "monospace";
        text.style.fontWeight = "900";
        text.style.fontSize = (currentTextSize * scaleX) + "px"; 
        text.style.pointerEvents = "none";

        group.appendChild(circle);
        group.appendChild(text);
        slotsLayer.appendChild(group);

        group.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            
            if (pendingSlot) pendingSlot.classList.remove("slot-active");
            pendingSlot = group;
            group.classList.add("slot-active");

            if (currentCanvasMode === CanvasMode.DRAG) {
                isDraggingSlot = true;
                draggedSlotIndex = index;
                
                const mousePos = getMousePosition(e);
                
                // FIXED: Get the CURRENT position from the SVG transform, not the array
                // This prevents the "jumping" bug
                let matrix = group.transform.baseVal.getItem(0).matrix;
                offset = {
                    x: mousePos.x - matrix.e,
                    y: mousePos.y - matrix.f
                };
            }
        });
    });
}



function captureCurrentPositions() {
    let allBots = [...redRobots, ...blueRobots];
    tabStates[currentTabId].positions = allBots.map(bot => {
        const matrix = bot.robotElement.parentNode.transform.baseVal.getItem(0).matrix;
        return { x: matrix.e, y: matrix.f };
    });
}

function captureAllTabPositions() {
    let allBots = [...redRobots, ...blueRobots];
    let startPos = allBots.map(bot => {
        const matrix = bot.robotElement.parentNode.transform.baseVal.getItem(0).matrix;
        return { x: matrix.e, y: matrix.f };
    });
    tabNames.forEach(name => {
        tabStates[name].positions = JSON.parse(JSON.stringify(startPos));
    });
}








function importAndPlayMacro(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            const events = data.events || data; 
            const meta = data.meta || null;

            if (!events || events.length === 0) return;

            if (meta && meta.name) document.title = meta.name;
            if (meta && meta.settings) applyRobotSettings(meta.settings);

            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.style.display = 'flex';

            const rect = fieldCanvas.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const fakeInit = { bubbles: true, clientX: centerX, clientY: centerY };
            
            fieldCanvas.dispatchEvent(new PointerEvent('pointerdown', fakeInit));
            fieldCanvas.dispatchEvent(new PointerEvent('pointerup', fakeInit));

            let cursor = document.getElementById('macro-cursor');
            if (!cursor) {
                cursor = document.createElement('div');
                cursor.id = 'macro-cursor';
                cursor.style = "position:fixed; display:none; pointer-events:none; z-index:1000000;";
                document.body.appendChild(cursor);
            }

            events.forEach((ev, index) => {
                setTimeout(() => {
                    // בדיקה אם תפריט ההגדרות פתוח כרגע
                    const sidebar = document.getElementById("sidebar");
                    const isSidebarOpen = sidebar && sidebar.classList.contains("open");

                    cursor.style.left = ev.x + 'px';
                    cursor.style.top = ev.y + 'px';

                    const allElements = document.elementsFromPoint(ev.x, ev.y);
                    let el = allElements.find(item => {
                        const isInsideSidebar = item.closest('#sidebar');
                        return item.id !== 'loading-overlay' && 
                               item.id !== 'macro-cursor' &&
                               !isInsideSidebar && 
                               window.getComputedStyle(item).pointerEvents !== 'none';
                    });

                    if (el) {
                        const isToolBtn = el.closest('button') || el.closest('.tab-btn');
                        const targetEl = isToolBtn || el;
                        const isControlBtn = targetEl.classList.contains('macro-ctrl-btn');

                        // --- התיקון החדש: חסימה בזמן שהסיידבר פתוח ---
                        if (isSidebarOpen && !isControlBtn) {
                            // אם הסיידבר פתוח, נאפשר אך ורק לחיצה על ה-fieldCanvas (כדי לסגור אותו)
                            // כל מטרה אחרת (רובוט, קו, כפתור כלי עבודה) נחסמת.
                            if (targetEl !== fieldCanvas && targetEl.id !== "field-background") {
                                return; 
                            }
                        }

                        if (!isControlBtn) {
                            const isPressed = (ev.type === 'mousedown' || ev.isDragging);
                            const eventInit = {
                                bubbles: true, cancelable: true, composed: true,
                                view: window, clientX: ev.x, clientY: ev.y,
                                buttons: isPressed ? 1 : 0, pointerId: 1,
                                pointerType: "mouse", isPrimary: true
                            };

                            const pType = ev.type === 'mousedown' ? 'pointerdown' : 
                                         ev.type === 'mouseup' ? 'pointerup' : 'pointermove';
                            
                            targetEl.dispatchEvent(new PointerEvent(pType, eventInit));
                            targetEl.dispatchEvent(new MouseEvent(ev.type, eventInit));

                            if (ev.type === 'mousedown') {
                                targetEl.dispatchEvent(new MouseEvent('click', eventInit));
                                if (targetEl.onclick) targetEl.onclick(new MouseEvent('click', eventInit));
                                if (typeof targetEl.click === 'function') targetEl.click();
                            }
                        }
                    }

                    if (index === events.length - 1) {
                        setTimeout(() => {
                            if (overlay) overlay.style.display = 'none';
                            const colorPicker = document.getElementById('robot-color-picker-container');
                            if (colorPicker) colorPicker.style.display = 'none';
                        }, 100);
                    }
                }, index * 1);
            });
        } catch (err) { 
            console.error("Macro error", err);
            if (document.getElementById('loading-overlay')) {
                document.getElementById('loading-overlay').style.display = 'none';
            }
        }
    };
    reader.readAsText(file);
}

// פונקציית עזר להחלת הגדרות הרובוטים שנשמרו ב-JSON
function applyRobotSettings(settings) {
    if (!settings || !settings.robots) return;

    settings.robots.forEach(savedBot => {
        const robotGroup = document.getElementById(savedBot.id);
        if (robotGroup) {
            // 1. עדכון המספר והצבע של הטקסט
            const txt = robotGroup.querySelector("text");
            if (txt) {
                txt.textContent = savedBot.number; // שימוש ב-textContent בטוח יותר
                txt.setAttribute("fill", savedBot.color);
                
                // עדכון גודל הפונט - מוודא שזה חל על האלמנט
                const fSize = settings.fontSize || 16;
                txt.style.fontSize = fSize + "px";
                txt.setAttribute("font-size", fSize); 
            }
            
            // 2. עדכון גודל וצבע גוף הרובוט
            const rect = robotGroup.querySelector("rect") || robotGroup.querySelector("circle");
            if (rect) {
                if (settings.robotSize) {
                    const rSize = settings.robotSize;
                    rect.setAttribute("width", rSize);
                    rect.setAttribute("height", rSize);
                    // אם זה עיגול
                    if (rect.tagName.toLowerCase() === 'circle') {
                        rect.setAttribute("r", rSize / 2);
                    }
                }
                if (savedBot.color) {
                    rect.setAttribute("fill", savedBot.color);
                }
            }
        }
    });
    console.log("Robot settings applied: Size " + settings.robotSize + ", Font " + settings.fontSize);
}

// Ensure these variables are at the top of your main.js
let macroEvents = []; 
let isMacroRecording = true; 

/**
 * Downloads the recorded macro events as a JSON file.
 */
window.exportMacro = function() {
    if (typeof macroEvents === 'undefined' || macroEvents.length === 0) {
        alert("אין מידע מוקלט לייצוא.");
        return;
    }

    const now = new Date();
    const timestamp = `${now.getDate()}-${now.getMonth() + 1}__${now.getHours()}-${now.getMinutes()}`;

    let fileName = prompt("name your strategy", "STR--" + timestamp);
    if (!fileName) return;

    const robotSettings = {
        // שים לב: וודא ש-currentRobotSize ו-currentFontSize קיימים ב-main.js
        robotSize: (typeof currentRobotSize !== 'undefined') ? currentRobotSize : 30,
        fontSize: (typeof currentFontSize !== 'undefined') ? currentFontSize : 16,
        robots: [...redRobots, ...blueRobots].map(bot => {
            // הגישה לאלמנט האב (ה-Group)
            const group = bot.robotElement.parentNode;
            
            // חיפוש הטקסט בתוך הקבוצה
            const txt = group.querySelector("text");
            
            // חיפוש הגוף (ריבוע או עיגול)
            const body = group.querySelector("rect") || group.querySelector("circle");
            
            return {
                id: group.id,
                // תיקון קריטי: שימוש ב-textContent במקום innerHTML
                number: txt ? txt.textContent.trim() : "", 
                color: body ? body.getAttribute("fill") : (bot.color || "red")
            };
        })
    };

    const dataToSave = {
        meta: {
            name: fileName,
            settings: robotSettings
        },
        events: macroEvents
    };

    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchorNode = document.createElement('a');
    
    downloadAnchorNode.setAttribute("href", url);
    downloadAnchorNode.setAttribute("download", fileName + ".json");
    
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    URL.revokeObjectURL(url);
    
    console.log("הקלטה והגדרות יוצאו בהצלחה בשם: " + fileName);
};




function switchTab(newTabId) {
    if (newTabId === currentTabId) return;
    
    captureCurrentPositions();
    tabStates[currentTabId].recordingTime = activeRobotTime;

    // הסתרת השכבה הישנה
    const oldLayer = document.getElementById(`draw-layer-${currentTabId.replace(/ /g, '-')}`);
    if (oldLayer) oldLayer.style.display = 'none';

    // בדיקה/יצירה של השכבה החדשה
    let newLayerId = `draw-layer-${newTabId.replace(/ /g, '-')}`;
    let newLayer = document.getElementById(newLayerId);
    
    if (!newLayer) {
        // יצירת שכבה חדשה לטאב שנטען מה-CSV
        newLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        newLayer.id = newLayerId;
        fieldCanvas.appendChild(newLayer);
    }
    
    newLayer.style.display = 'block';
    newLayer.style.pointerEvents = "none"; // מאפשר ללחוץ "דרכו" על הרובוטים

    currentTabId = newTabId;
    robotPaths = tabStates[currentTabId].robotPaths;
    activeRobotTime = tabStates[currentTabId].recordingTime;

    // עדכון מיקומי רובוטים
    let allBots = [...redRobots, ...blueRobots];
    let savedPos = tabStates[currentTabId].positions;
    allBots.forEach((bot, index) => {
        if (savedPos && savedPos[index]) {
            bot.robotElement.parentNode.transform.baseVal.getItem(0).setTranslate(savedPos[index].x, savedPos[index].y);
        }
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active-tab', btn.innerText === newTabId);
    });

    if (isReplaying) stopReplay();
    updateTimer(activeRobotTime);
}

function resizeCanvas() {
    const bgRect = background.getBoundingClientRect();
    
    // 1. Update SVG size to match the background image
    fieldCanvas.setAttribute("width", bgRect.width);
    fieldCanvas.setAttribute("height", bgRect.height);
    
    // 2. Update the ratio for robots
    heightRatio = bgRect.height / 635.0; 
    
    // 3. Update Robot sizes
    updateAllRobotSizes(currentRobotSize);
    
    // 4. CRITICAL: Re-draw the slots at their new positions
    initSlots(); 
}

function spawnInitialRobots() {
    clearAllTabs();
    const bgRect = background.getBoundingClientRect();
    const width = bgRect.width;
    const height = bgRect.height;

    // If we haven't set custom defaults, use the original FRC starting lines
    if (robotHomePositions.length === 0) {
        const yRatios = [0.23, 0.50, 0.76];
        const redXRatio = 0.15;            
        const blueXRatio = 0.85;           
        
        allianceColor = Alliance.RED;
        yRatios.forEach(yRatio => createRobotAt(width * redXRatio, height * yRatio));
        allianceColor = Alliance.BLUE;
        yRatios.forEach(yRatio => createRobotAt(width * blueXRatio, height * yRatio));
    } else {
        // Use the custom saved positions
        robotHomePositions.forEach((pos, index) => {
            // First 3 are Red, last 3 are Blue based on your spawn order
            allianceColor = (index < 3) ? Alliance.RED : Alliance.BLUE;
            createRobotAt(pos.xPercent * width, pos.yPercent * height);
        });
    }
    setMode(CanvasMode.DRAG);
}

function createRobotAt(x, y) {
    let isRed = (allianceColor == Alliance.RED);
    let robotList = isRed ? redRobots : blueRobots;
    let robotGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    robotGroup.setAttribute("transform", `translate(${x},${y})`);
    robotGroup.classList.add("robot-group");
    let driveId = (isRed ? "r" : "b") + (robotList.length + 1);
    let robotImg = addImage(0, 0, 90, "assets/" + (isRed ? "r" : "b") + "swerve.svg", currentRobotSize * heightRatio, robotGroup);
    robotImg.setAttribute("class", (isRed ? "r" : "b") + "bot");
    let teamNumText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    teamNumText.innerHTML = document.getElementById(driveId)?.value || (isRed ? robotList.length + 4 : robotList.length + 1);
    teamNumText.style = `font-family: monospace; font-weight: 900; pointer-events: none; font-size: ${currentTextSize}px;`;
    teamNumText.setAttribute("fill", isRed ? "#F00" : "#00F");
    teamNumText.setAttribute("dominant-baseline", "middle");
    teamNumText.setAttribute("text-anchor", "middle");
    robotGroup.appendChild(teamNumText);
    stageCanvas.appendChild(robotGroup);
    makeDragable(robotGroup);
    robotList.push(new Robot(isRed ? "r" : "b", robotImg, teamNumText));
}

function resetRobotPositions() {
    const bgRect = background.getBoundingClientRect();
    const width = bgRect.width;
    const height = bgRect.height;

    // Combine robots into one list to match the order in robotHomePositions
    const allBots = [...redRobots, ...blueRobots];

    if (robotHomePositions.length === allBots.length) {
        // USE CUSTOM DEFAULTS (from setCurrentAsDefault)
        allBots.forEach((robot, index) => {
            const group = robot.robotElement.parentNode;
            const pos = robotHomePositions[index];
            group.transform.baseVal.getItem(0).setTranslate(pos.xPercent * width, pos.yPercent * height);
        });
    } else {
        // FALLBACK to original hardcoded ratios if no default is set
        const yRatios = [0.23, 0.50, 0.76];
        const redXRatio = 0.15;
        const blueXRatio = 0.85;

        redRobots.forEach((robot, index) => {
            const group = robot.robotElement.parentNode;
            group.transform.baseVal.getItem(0).setTranslate(width * redXRatio, height * yRatios[index]);
        });
        blueRobots.forEach((robot, index) => {
            const group = robot.robotElement.parentNode;
            group.transform.baseVal.getItem(0).setTranslate(width * blueXRatio, height * yRatios[index]);
        });
    }

    // Clear paths and timer logic remains the same
    robotPaths.clear();
    activeRobotTime = 0;
    updateTimer(0);
    if (isReplaying) stopReplay();
}

function getMousePosition(evt) {
    var CTM = fieldCanvas.getScreenCTM();
    return { x: (evt.clientX - CTM.e) / CTM.a, y: (evt.clientY - CTM.f) / CTM.d };
}

function toggleRecording() {
    if (isReplaying) stopReplay();
    isRecording = !isRecording;
    const btn = document.getElementById("record-btn");
    if (isRecording) {
        btn.classList.add("record-active");
        recordInterval = setInterval(() => {
            if (selectedElement && selectedElement.classList.contains("robot-group")) {
                if (!robotPaths.has(selectedElement)) robotPaths.set(selectedElement, []);
                const matrix = selectedElement.transform.baseVal.getItem(0).matrix;
                robotPaths.get(selectedElement).push({ x: matrix.e, y: matrix.f });
                activeRobotTime += 0.033;
                updateTimer(activeRobotTime);
            }
        }, 33);
    } else {
        btn.classList.remove("record-active");
        clearInterval(recordInterval);
    }
}

var isRecording = false, isReplaying = false, recordInterval = null, replayInterval = null, currentFrameIndex = 0;

function toggleReplay() {
    if (isRecording) toggleRecording();
    if (robotPaths.size === 0) return;
    isReplaying = !isReplaying;
    const btn = document.getElementById("play-btn");
    if (isReplaying) {
        btn.classList.add("play-active");
        currentFrameIndex = 0;
        let maxFrames = 0;
        robotPaths.forEach(path => maxFrames = Math.max(maxFrames, path.length));
        replayInterval = setInterval(() => {
            if (currentFrameIndex >= maxFrames) { stopReplay(); return; }
            updateTimer(currentFrameIndex * 0.033);
            robotPaths.forEach((path, robot) => {
                if (path[currentFrameIndex]) robot.transform.baseVal.getItem(0).setTranslate(path[currentFrameIndex].x, path[currentFrameIndex].y);
            });
            currentFrameIndex++;
        }, 33);
    } else { stopReplay(); }
}

function stopReplay() {
    isReplaying = false;
    clearInterval(replayInterval);
    document.getElementById("play-btn").classList.remove("play-active");
    updateTimer(activeRobotTime);
}

var slotLayoutScale = 1.0;
var slotOffset = { x: 0, y: 0 };

function updateSlotTransform() {
    const scaleSlider = document.getElementById("slot-layout-scale");
    slotLayoutScale = parseFloat(scaleSlider.value);
    
    const layer = document.getElementById("slots-layer");
    
    // We apply both Scale and Translate. 
    // Note: We scale around the center of the field or top-left depending on your preference.
    // This string moves the layer AND shrinks/grows the gaps between circles.
    layer.setAttribute("transform", `translate(${slotOffset.x}, ${slotOffset.y}) scale(${slotLayoutScale})`);
}

// Update the Touchpad Logic to call the combined transform
const touchpad = document.getElementById("slot-touchpad");
const cursor = document.getElementById("touchpad-cursor");

touchpad.addEventListener("pointermove", (e) => {
    if (e.buttons !== 1) return;
    
    const rect = touchpad.getBoundingClientRect();
    let percentX = (e.clientX - rect.left) / rect.width;
    let percentY = (e.clientY - rect.top) / rect.height;
    
    percentX = Math.max(0, Math.min(1, percentX));
    percentY = Math.max(0, Math.min(1, percentY));

    cursor.style.left = (percentX * 100) + "%";
    cursor.style.top = (percentY * 100) + "%";

    // Sensitivity of the touchpad (adjust 600/400 to move further/less)
    slotOffset.x = (percentX - 0.5) * 600; 
    slotOffset.y = (percentY - 0.5) * 400;

    updateSlotTransform();
});

function resetSlotTransform() {
    slotLayoutScale = 1.0;
    slotOffset = { x: 0, y: 0 };
    document.getElementById("slot-layout-scale").value = 1.0;
    cursor.style.left = "50%";
    cursor.style.top = "50%";
    updateSlotTransform();
}

function updateTimer(seconds) { timerDisplay.innerHTML = seconds.toFixed(2) + "s"; }

function addImage(xpos, ypos, angle, src, size, parent) {
    let img = document.createElementNS("http://www.w3.org/2000/svg", "image");
    img.setAttribute("href", src);
    img.setAttribute("x", -size/2); img.setAttribute("y", -size/2);
    img.setAttribute("height", size); img.setAttribute("width", size);
    parent.appendChild(img);
    return img;
}
function openColorPicker(x, y) {
    colorPicker.style.display = "block";
    
    // Position it near the click but keep it inside the screen
    let posX = Math.min(x, window.innerWidth - 220);
    let posY = Math.min(y, window.innerHeight - 280);
    
    colorPicker.style.left = posX + "px";
    colorPicker.style.top = posY + "px";
}
function setMode(mode) {
    currentCanvasMode = mode;
    document.querySelectorAll('#tools button').forEach(b => b.classList.remove("active", "other-active"));
    const modeIds = ["delete-tool", "pen", "drag-tool", "", "robot-button", "piece-button", "arrow-tool"];
    const activeBtn = document.getElementById(modeIds[mode]);
    if (activeBtn) activeBtn.classList.add("active");
}

function changeColor(c) { selectedColor = c; }

// NEW: Initialize the pro color wheel
var iroPicker = new iro.ColorPicker("#iro-picker", {
    width: 180, // Good size for tablet fingers
    color: "#fff",
    layout: [
        { component: iro.ui.Wheel },
        { component: iro.ui.Slider, options: { sliderType: 'value' } }
    ]
});

// NEW: This replaces your old "input" listener
iroPicker.on('color:change', function(color) {
    if (robotToColor) {
        let hex = color.hexString;
        selectedColor = hex; // Updates your pen/arrow color
        
        let txt = robotToColor.querySelector("text");
        if (txt) { 
            txt.setAttribute("fill", hex); 
            txt.style.fill = hex; 
        }
    }
});

function clearField() {
    const layer = document.getElementById(`draw-layer-${currentTabId.replace(/ /g, '-')}`);
    while(layer.firstChild) layer.removeChild(layer.firstChild);
    robotPaths.clear();
    activeRobotTime = 0;
    updateTimer(0);
}

function clearAllTabs() {
    stageCanvas.innerHTML = "";
    redRobots = [];
    blueRobots = [];
    tabNames.forEach(name => {
        tabStates[name].robotPaths.clear();
        tabStates[name].recordingTime = 0;
        tabStates[name].positions = [];
        const layer = document.getElementById(`draw-layer-${name.replace(/ /g, '-')}`);
        if(layer) while(layer.firstChild) layer.removeChild(layer.firstChild);
    });
}

function updateAllRobotSizes(s) {
    currentRobotSize = parseInt(s);
    const scaledSize = currentRobotSize * heightRatio;
    document.querySelectorAll(".robot-group image").forEach(i => {
        i.setAttribute("width", scaledSize); i.setAttribute("height", scaledSize);
        i.setAttribute("x", -scaledSize/2); i.setAttribute("y", -scaledSize/2);
    });
}

function updateAllTextSizes(s) {
    currentTextSize = s;
    document.querySelectorAll(".robot-group text, .slot-group text").forEach(t => t.style.fontSize = s + "px");
}

class Robot {
    constructor(c, img, txt) { this.color = c; this.robotElement = img; this.numberElement = txt; }
    updateDriveTrain(e) { this.robotElement.setAttribute("href", `assets/${this.color}${e.target.value}.svg`); }
    updateTeamNumber(e) { this.numberElement.innerHTML = e.target.value; }
}