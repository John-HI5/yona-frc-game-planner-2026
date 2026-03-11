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
const colorPicker = document.getElementById("robot-color-picker");
const timerDisplay = document.getElementById("timer-display");


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

// --- פונקציות טעינת לו"ז FRC ---

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


function setCurrentAsDefault() {
    const bgRect = background.getBoundingClientRect();
    const allBots = [...redRobots, ...blueRobots];

    // 1. Capture current positions as percentages (so they stay accurate on resize)
    robotHomePositions = allBots.map(bot => {
        const matrix = bot.robotElement.parentNode.transform.baseVal.getItem(0).matrix;
        return { 
            xPercent: matrix.e / bgRect.width, 
            yPercent: matrix.f / bgRect.height 
        };
    });

    // 2. Update all Tab States so they start here
    tabNames.forEach(name => {
        tabStates[name].positions = allBots.map((bot, index) => {
            return { 
                x: robotHomePositions[index].xPercent * bgRect.width, 
                y: robotHomePositions[index].yPercent * bgRect.height 
            };
        });
        // Optional: Clear paths if you want the new default to be a "clean slate"
        tabStates[name].robotPaths.clear();
    });


}

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

function switchTab(newTabId) {
    if (newTabId === currentTabId) return;
    captureCurrentPositions();
    tabStates[currentTabId].recordingTime = activeRobotTime;
    document.getElementById(`draw-layer-${currentTabId.replace(/ /g, '-')}`).style.display = 'none';
    document.getElementById(`draw-layer-${newTabId.replace(/ /g, '-')}`).style.display = 'block';
    currentTabId = newTabId;
    robotPaths = tabStates[currentTabId].robotPaths;
    activeRobotTime = tabStates[currentTabId].recordingTime;
    let allBots = [...redRobots, ...blueRobots];
    let savedPos = tabStates[currentTabId].positions;
    allBots.forEach((bot, index) => {
        if (savedPos[index]) {
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

function setMode(mode) {
    currentCanvasMode = mode;
    document.querySelectorAll('#tools button').forEach(b => b.classList.remove("active", "other-active"));
    const modeIds = ["delete-tool", "pen", "drag-tool", "", "robot-button", "piece-button", "arrow-tool"];
    const activeBtn = document.getElementById(modeIds[mode]);
    if (activeBtn) activeBtn.classList.add("active");
}

function changeColor(c) { selectedColor = c; }

colorPicker.addEventListener("input", (e) => {
    if (robotToColor) {
        let hex = e.target.value;
        let txt = robotToColor.querySelector("text");
        if (txt) { txt.setAttribute("fill", hex); txt.style.fill = hex; }
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