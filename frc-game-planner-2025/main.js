const fieldCanvas = document.getElementById("field-canvas");
const stageCanvas = document.getElementById("stage-canvas");
const background = document.getElementById("field-background");
const colorPicker = document.getElementById("robot-color-picker");
const timerDisplay = document.getElementById("timer-display");

// ---------- Constants & State ---------- \\
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

// ---------- Tab System State ---------- \\
var currentTabId = 'AUTO';
const tabNames = ['AUTO', 'TRA SHIFT', 'ALL SHIFT 1', 'ALL SHIFT 2', 'ALL SHIFT 3', 'ALL SHIFT 4', 'END GAME'];

var tabStates = {};
tabNames.forEach(name => {
    tabStates[name] = {
        robotPaths: new Map(),
        recordingTime: 0,
        // Store coordinates for each of the 6 possible robots
        positions: [] 
    };
});

var robotPaths = tabStates[currentTabId].robotPaths;
var activeRobotTime = 0;

// ---------- Replay System ---------- \\
var isRecording = false;
var isReplaying = false;
var recordInterval = null;
var replayInterval = null;
var currentFrameIndex = 0;

// ---------- Initialization ---------- \\

window.onload = function () { 
    resizeCanvas(); 
    spawnInitialRobots();
    // Initialize the default positions for all tabs based on start
    captureAllTabPositions();
};
window.onresize = function () { resizeCanvas(); };

// Captures current robot positions into the current tab's state
function captureCurrentPositions() {
    let allBots = [...redRobots, ...blueRobots];
    tabStates[currentTabId].positions = allBots.map(bot => {
        const matrix = bot.robotElement.parentNode.transform.baseVal.getItem(0).matrix;
        return { x: matrix.e, y: matrix.f };
    });
}

// Helper to fill all tabs with initial positions so they don't jump to 0,0
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

    // 1. SAVE: Capture where robots are right now for the OLD tab
    captureCurrentPositions();
    tabStates[currentTabId].recordingTime = activeRobotTime;

    // 2. UI: Hide/Show drawing layers
    document.getElementById(`draw-layer-${currentTabId.replace(/ /g, '-')}`).style.display = 'none';
    document.getElementById(`draw-layer-${newTabId.replace(/ /g, '-')}`).style.display = 'block';

    // 3. LOAD: Update global references to the NEW tab
    currentTabId = newTabId;
    robotPaths = tabStates[currentTabId].robotPaths;
    activeRobotTime = tabStates[currentTabId].recordingTime;

    // 4. TELEPORT: Move the robot elements to the positions saved in the NEW tab
    let allBots = [...redRobots, ...blueRobots];
    let savedPos = tabStates[currentTabId].positions;
    
    allBots.forEach((bot, index) => {
        if (savedPos[index]) {
            bot.robotElement.parentNode.transform.baseVal.getItem(0).setTranslate(savedPos[index].x, savedPos[index].y);
        }
    });

    // 5. Update UI Buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active-tab', btn.innerText === newTabId);
    });

    if (isReplaying) stopReplay();
    updateTimer(activeRobotTime);
}

function resizeCanvas() {
    const bgRect = background.getBoundingClientRect();
    fieldCanvas.setAttribute("width", bgRect.width);
    fieldCanvas.setAttribute("height", bgRect.height);
    heightRatio = bgRect.height / 635.0; 
    updateAllRobotSizes(currentRobotSize);
}

function spawnInitialRobots() {
    clearAllTabs();
    const bgRect = background.getBoundingClientRect();
    const width = bgRect.width;
    const height = bgRect.height;
    const yRatios = [0.23, 0.50, 0.76];
    const redXRatio = 0.15;            
    const blueXRatio = 0.85;           

    allianceColor = Alliance.RED;
    yRatios.forEach(yRatio => createRobotAt(width * redXRatio, height * yRatio));
    allianceColor = Alliance.BLUE;
    yRatios.forEach(yRatio => createRobotAt(width * blueXRatio, height * yRatio));
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
    teamNumText.setAttribute("fill", "#FFF");
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

// ---------- Interaction Helpers ---------- \\

function getMousePosition(evt) {
    var CTM = fieldCanvas.getScreenCTM();
    return { x: (evt.clientX - CTM.e) / CTM.a, y: (evt.clientY - CTM.f) / CTM.d };
}

function clearDrawingsOnly() {
    const layer = document.getElementById(`draw-layer-${currentTabId.replace(/ /g, '-')}`);
    while(layer.firstChild) layer.removeChild(layer.firstChild);
    setMode(CanvasMode.PEN);
}

function selectElement(evt) {
    evt.stopPropagation();
    let target = evt.currentTarget;

    if (currentCanvasMode == CanvasMode.PEN) {
        let text = target.querySelector("text");
        if (text) changeColor(text.getAttribute("fill"));
        return;
    }

    if (currentCanvasMode == CanvasMode.DRAG) {
        // Reset local timer if we grab a DIFFERENT robot during recording
        if (isRecording && selectedElement !== target && target.classList.contains("robot-group")) {
            const existingPath = robotPaths.get(target);
            activeRobotTime = existingPath ? existingPath.length * 0.033 : 0;
            updateTimer(activeRobotTime);
        }

        selectedElement = target;
        clickStartTime = Date.now();
        offset = getMousePosition(evt);
        let transforms = selectedElement.transform.baseVal;
        if (transforms.length === 0 || transforms.getItem(0).type !== SVGTransform.SVG_TRANSFORM_TRANSLATE) {
            let translate = fieldCanvas.createSVGTransform();
            translate.setTranslate(0, 0);
            selectedElement.transform.baseVal.insertItemBefore(translate, 0);
        }
        transform = transforms.getItem(0);
        offset.x -= transform.matrix.e;
        offset.y -= transform.matrix.f;
    }

    if (currentCanvasMode == CanvasMode.DELETE) {
        if (!target.classList.contains("robot-group")) target.parentNode.removeChild(target);
    }
}

function releaseElement(evt) {
    if (selectedElement && selectedElement.classList.contains("robot-group") && currentCanvasMode == CanvasMode.DRAG) {
        if (Date.now() - clickStartTime < CLICK_THRESHOLD) {
            robotToColor = selectedElement;
            colorPicker.style.left = evt.clientX + "px";
            colorPicker.style.top = evt.clientY + "px";
            colorPicker.style.display = "block";
        }
    }
    selectedElement = null;
}

function makeDragable(element) {
    element.addEventListener("pointerdown", selectElement);
    element.addEventListener("pointerup", releaseElement);
}

fieldCanvas.addEventListener("pointerdown", (event) => {
    const now = Date.now();
    if (now - lastClickTime > 400) clickCount = 0;
    clickCount++;
    lastClickTime = now;

    if (event.target === fieldCanvas || event.target.id === "field-background") {
        colorPicker.style.display = "none";
        if (clickCount === 3) {
            clearDrawingsOnly();
            clickCount = 0;
            return;
        }
        if (clickCount === 2) {
            setMode(CanvasMode.DRAG);
            return;
        }
    } else {
        clickCount = 0;
    }
});

fieldCanvas.addEventListener("pointermove", (event) => {
    if (currentCanvasMode == CanvasMode.DRAG && selectedElement) {
        let position = getMousePosition(event);
        transform.setTranslate(position.x - offset.x, position.y - offset.y);
    }
});

// ---------- Record & Replay Logic ---------- \\

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

function updateTimer(seconds) { timerDisplay.innerHTML = seconds.toFixed(2) + "s"; }

// ---------- Global Helpers ---------- \\

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
    const modeIds = ["", "pen", "drag-tool", "", "robot-button", "piece-button", ""];
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
    clearDrawingsOnly();
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
    document.querySelectorAll(".robot-group text").forEach(t => t.style.fontSize = s + "px");
}

class Robot {
    constructor(c, img, txt) { this.color = c; this.robotElement = img; this.numberElement = txt; }
    updateDriveTrain(e) { this.robotElement.setAttribute("href", `assets/${this.color}${e.target.value}.svg`); }
    updateTeamNumber(e) { this.numberElement.innerHTML = e.target.value; }
}