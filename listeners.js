function getActiveLayer() {
    const layerId = `draw-layer-${currentTabId.replace(/ /g, '-')}`;
    return document.getElementById(layerId) || stageCanvas;
}
// ... (משתני גרירה נשארים אותו דבר) ...

fieldCanvas.addEventListener("pointerdown", (event) => {
    // 1. טיפול בסיידבר - אם פתוח, סגור אותו ובטל את הלחיצה הנוכחית
    const sidebar = document.getElementById("sidebar");
    if (sidebar && sidebar.classList.contains("open")) {
        sidebar.classList.replace("open", "closed");
        return;
    }

    const position = getMousePosition(event);
    const activeLayer = getActiveLayer();
    
    // זיהוי על מה לחצנו
    const isRobot = event.target.closest('.robot-group');
    const isSlot = event.target.closest('.slot-group');
    const clickedPath = event.target.tagName === 'polyline' ? event.target : null;

    // --- לוגיקת לחיצה כפולה על הרקע למעבר למצב מחיקה ---
    if (!isRobot && !isSlot && !clickedPath) {
        const currentTime = new Date().getTime();
        const gap = currentTime - lastBackgroundClickTime;

        if (gap < 300 && gap > 0) { // לחיצה כפולה
            isDeleteMode = !isDeleteMode;
            currentCanvasMode = isDeleteMode ? CanvasMode.DELETE : CanvasMode.PEN;
            
            // שינוי סמן העכבר לחיווי ויזואלי
            fieldCanvas.style.cursor = isDeleteMode ? "crosshair" : "default";

            // עדכון אינדיקטור המחיקה (הכפתור הלא לחיץ)
            const delIndicator = document.getElementById('delete-indicator');
            if (delIndicator) {
                if (isDeleteMode) {
                    delIndicator.classList.replace('delete-off', 'delete-on');
                } else {
                    delIndicator.classList.replace('delete-on', 'delete-off');
                }
            }
            
            lastBackgroundClickTime = 0;
            return; // עוצר כאן כדי שלא יתחיל לצייר בלחיצה השנייה
        }
        lastBackgroundClickTime = currentTime;
    }

    // --- לוגיקת מחיקה ---
    if (isDeleteMode) {
        if (clickedPath) {
            clickedPath.remove(); // מוחק את הקו
        }
        return; // במצב מחיקה לא מציירים קווים חדשים
    }

    // --- גרירת סלוטים (החזרת הפונקציונליות) ---
    if (isSlot) {
        isDraggingSlot = true;
        const match = isSlot.id.match(/\d+/);
        draggedSlotIndex = match ? parseInt(match[0]) : null;
        return;
    }

    // --- לוגיקת ציור רגילה (רק אם לא לחצנו על רובוט/סלוט) ---
    if (!isRobot && !isSlot) {
        if (typeof colorPicker !== 'undefined') colorPicker.style.display = "none";
        
        if (typeof pendingSlot !== 'undefined' && pendingSlot) {
            pendingSlot.classList.remove("slot-active");
            pendingSlot = null;
        }

        // יצירת הקו החדש
        currentPenPath = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        currentPenPath.setAttribute("stroke", selectedColor || "white");
        currentPenPath.setAttribute("fill", "none");
        currentPenPath.setAttribute("points", `${position.x},${position.y} `);
        currentPenPath.setAttribute("stroke-width", 4);
        currentPenPath.setAttribute("stroke-linecap", "round");
        
        // חשוב מאוד: מאפשר ללחוץ על הקו בעתיד כדי למחוק אותו
        currentPenPath.style.pointerEvents = "auto"; 

        if (activeLayer) {
            activeLayer.appendChild(currentPenPath);
            // אם יש פונקציית גרירה לקווים:
            if (typeof makeDragable === 'function') makeDragable(currentPenPath);
        }
    }
});
fieldCanvas.addEventListener("pointermove", (event) => {
  let position = getMousePosition(event);
  if (event.pointerType === 'touch') event.preventDefault();

  if (isDraggingSlot && draggedSlotIndex !== null && pendingSlot) {
    const newX = position.x - offset.x;
    const newY = position.y - offset.y;
    pendingSlot.setAttribute("transform", `translate(${newX}, ${newY})`);
    
    const bgRect = background.getBoundingClientRect();
    const scaleX = bgRect.width / 2500;
    const scaleY = bgRect.height / 1185;
    slotCoords[draggedSlotIndex].x = newX / scaleX;
    slotCoords[draggedSlotIndex].y = newY / scaleY;
  } 
  else if (selectedElement) {
    transform.setTranslate(position.x - offset.x, position.y - offset.y);
  }
  else if (currentPenPath) {
    currentPenPath.setAttribute(
      "points",
      currentPenPath.getAttribute("points") + position.x + " " + position.y + " "
    );
  }
  else if (currentCanvasMode == CanvasMode.ARROW && currentArrow) {
      currentArrow.setAttribute("x2", position.x);
      currentArrow.setAttribute("y2", position.y);
  }
}, { passive: false });

fieldCanvas.addEventListener("pointerup", (event) => {
    currentArrow = null;
    currentPenPath = null;
    isDraggingSlot = false;
    draggedSlotIndex = null;
});

// ... (שאר הפונקציות: makeDragable, selectElement, וכו' נשארות ללא שינוי)


let lastRobotClickTime = 0;
let lastRobotClicked = null;
const DOUBLE_CLICK_DELAY = 300; // זמן במיל-שניות ללחיצה כפולה

var currentArrow = null;
var currentPenPath = null;
var currentPolygon = null;

fieldCanvas.addEventListener("pointermove", (event) => {
  let position = getMousePosition(event);
  
  // 1. מניעת גלילה וזום (קריטי לטאבלט) - מופעל תמיד כשמבצעים פעולה על הקנבס
  if (event.pointerType === 'touch') {
      event.preventDefault();
  }

  // --- לוגיקת גרירת סלוטים (עיגולים לבנים) ---
  if (isDraggingSlot && draggedSlotIndex !== null && pendingSlot) {
    const newX = position.x - offset.x;
    const newY = position.y - offset.y;
    
    pendingSlot.setAttribute("transform", `translate(${newX}, ${newY})`);
    
    const bgRect = background.getBoundingClientRect();
    const scaleX = bgRect.width / 2500;
    const scaleY = bgRect.height / 1185;
    
    slotCoords[draggedSlotIndex].x = newX / scaleX;
    slotCoords[draggedSlotIndex].y = newY / scaleY;
  } 
  
  // --- לוגיקת גרירת רובוטים או אלמנטים קיימים ---
  else if (selectedElement) {
    transform.setTranslate(position.x - offset.x, position.y - offset.y);
  }

  // --- לוגיקת ציור (מופעלת אם נוצר קו ב-pointerdown) ---
  else if (currentPenPath) {
    currentPenPath.setAttribute(
      "points",
      currentPenPath.getAttribute("points") + position.x + " " + position.y + " "
    );
  }

  // --- לוגיקת חץ (אם עדיין בשימוש דרך Mode) ---
  else if (currentCanvasMode == CanvasMode.ARROW && currentArrow) {
      currentArrow.setAttribute("x2", position.x);
      currentArrow.setAttribute("y2", position.y);
  }
  
  // --- כלי המחיקה ---
  // נשאר תלוי Mode כי מחיקה בדרך כלל דורשת בחירה מכוונת של "מחק"
  else if (currentCanvasMode == CanvasMode.DELETE) {
    if (event.buttons !== 0 || event.pointerType === 'touch') {
      const offsets = [
        { dx: 0, dy: 0 }, { dx: 40, dy: 10 }, { dx: -40, dy: -40 },
        { dx: 40, dy: -40 }, { dx: -40, dy: 40 }
      ];

      offsets.forEach(off => {
        let target = document.elementFromPoint(event.clientX + off.dx, event.clientY + off.dy);
        
        if (target && target !== fieldCanvas && target.id !== "field-background") {
          let isRobot = target.closest('.robot-group');
          let isSlot = target.closest('.slot-group');
          
          if (!isRobot && !isSlot) {
            const validTags = ["path", "polyline", "line", "image", "circle", "ellipse"];
            if (validTags.includes(target.tagName.toLowerCase())) {
                target.remove();
            }
          }
        }
      });
    }
  }
}, { passive: false });



fieldCanvas.addEventListener("pointerdown", (event) => {
  const sidebar = document.getElementById("sidebar");
  if (sidebar && sidebar.classList.contains("open")) {
    sidebar.classList.replace("open", "closed");
    return;
  }

  // --- תיקון המחק: אם אנחנו במצב מחיקה, אל תייצר קו חדש! ---
  if (currentCanvasMode === CanvasMode.DELETE) return;

  const position = getMousePosition(event);
  const activeLayer = getActiveLayer();

  const isRobot = event.target.closest('.robot-group');
  const isSlot = event.target.closest('.slot-group');
  const hitBackground = !isRobot && !isSlot;

  if (hitBackground) {
    if (typeof colorPicker !== 'undefined') colorPicker.style.display = "none";
    if (pendingSlot) {
      pendingSlot.classList.remove("slot-active");
      pendingSlot = null;
    }

    // יצירת קו רק אם אנחנו לא במצב מחיקה
    currentPenPath = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    currentPenPath.setAttribute("stroke", selectedColor || "black");
    currentPenPath.setAttribute("fill", "none");
    currentPenPath.setAttribute("points", position.x + "," + position.y + " ");
    currentPenPath.setAttribute("stroke-width", 4);
    currentPenPath.setAttribute("stroke-linecap", "round");
    currentPenPath.style.pointerEvents = "auto"; 
    
    if (activeLayer) {
      activeLayer.appendChild(currentPenPath);
      makeDragable(currentPenPath); 
    }
  } else {
    currentPenPath = null;
  }
});

fieldCanvas.addEventListener("pointerup", (event) => {

    currentArrow = null;

    currentPenPath = null;

    // Reset slot dragging

    isDraggingSlot = false;

    draggedSlotIndex = null;

});


function makeDragable(element) {
  element.addEventListener("pointerdown", selectElement);
  element.addEventListener("pointerup", releaseElement);
}

function selectElement(evt) {
    evt.stopPropagation();
    let target = evt.currentTarget;
    const now = Date.now();

    // --- 1. בדיקה קריטית: האם יש סלוט (עיגול לבן) שמחכה לרובוט? ---
    // אנחנו שמים את זה בראש הפונקציה כדי שזה יקרה לפני הגרירה או שינוי הצבע
    if (pendingSlot && target.classList.contains("robot-group")) {
        let txt = target.querySelector("text");
        if (txt) {
            let robotNum = txt.innerHTML;
            let robotColor = txt.getAttribute("fill") || txt.style.fill;
            let slotText = pendingSlot.querySelector("text");
            
            slotText.innerHTML = robotNum;
            slotText.setAttribute("fill", robotColor);
        }
        
        pendingSlot.classList.remove("slot-active");
        pendingSlot = null;
        
        // חשוב: אנחנו עוצרים כאן כדי שהלחיצה רק תשבץ את הרובוט ולא תתחיל לגרור אותו
        return; 
    }

    // --- 2. לוגיקת רובוט (צבע וגרירה) ---
    if (target.classList.contains("robot-group")) {
        
        // בדיקת דאבל קליק לצבע רובוט
        if (lastRobotClicked === target && (now - lastRobotClickTime) < DOUBLE_CLICK_DELAY) {
            robotToColor = target;
            colorPicker.style.left = evt.clientX + "px";
            colorPicker.style.top = evt.clientY + "px";
            colorPicker.style.display = "block";
            
            selectedElement = null; 
            lastRobotClickTime = 0; 
            return; 
        } else {
            // לחיצה יחידה - עדכון צבע עט
            let txt = target.querySelector("text");
            let rect = target.querySelector("rect");
            if (txt || rect) {
                let robotColor = (txt ? txt.getAttribute("fill") : null) || 
                                 (rect ? rect.getAttribute("fill") : "red");
                selectedColor = robotColor;
                if (typeof changeColor === 'function') changeColor(robotColor);
            }
        }
        
        lastRobotClickTime = now;
        lastRobotClicked = target;

        // לוגיקת גרירת רובוט
        if (isRecording && selectedElement !== target) {
            const existingPath = robotPaths.get(target);
            activeRobotTime = existingPath ? existingPath.length * 0.033 : 0;
            updateTimer(activeRobotTime);
        }
        
        selectedElement = target;
        clickStartTime = now;
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
        return; 
    }

    // --- 3. לוגיקת גרירת סלוטים (עיגולים לבנים) ---
    if (target.classList.contains("slot-group")) {
        isDraggingSlot = true;
        pendingSlot = target;
        target.classList.add("slot-active");
        draggedSlotIndex = parseInt(target.getAttribute("data-index"));
        
        let mousePos = getMousePosition(evt);
        let transforms = target.transform.baseVal;
        
        if (transforms.length === 0 || transforms.getItem(0).type !== SVGTransform.SVG_TRANSFORM_TRANSLATE) {
            let translate = fieldCanvas.createSVGTransform();
            translate.setTranslate(0, 0);
            target.transform.baseVal.insertItemBefore(translate, 0);
        }
        
        let matrix = transforms.getItem(0).matrix;
        offset = {
            x: mousePos.x - matrix.e,
            y: mousePos.y - matrix.f
        };
        return;
    }

    // --- 4. לוגיקת מחיקה ---
    if (currentCanvasMode == CanvasMode.DELETE) {
        if (!target.classList.contains("robot-group") && !target.classList.contains("slot-group")) {
            target.remove();
        }
        return;
    }
}



function releaseElement(evt) {
    selectedElement = null;
    isDraggingSlot = false;
    draggedSlotIndex = null;
}

let isMouseDownDuringRecord = false;

// הקלטת תנועה (כולל סימון אם העכבר לחוץ כדי לאפשר גרירה בנגן)
window.addEventListener('mousemove', (e) => {
    if (isMacroRecording) {
        macroEvents.push({ 
            type: 'mousemove', 
            x: e.clientX, 
            y: e.clientY,
            isDragging: isMouseDownDuringRecord 
        });
    }
});

// הקלטת לחיצה
window.addEventListener('mousedown', (e) => {
    if (isMacroRecording) {
        isMouseDownDuringRecord = true;
        macroEvents.push({ type: 'mousedown', x: e.clientX, y: e.clientY });
    }
});

// הקלטת עזיבה
window.addEventListener('mouseup', (e) => {
    if (isMacroRecording) {
        isMouseDownDuringRecord = false;
        macroEvents.push({ type: 'mouseup', x: e.clientX, y: e.clientY });
    }
});

// --- Button Actions ---

window.undoLastAction = function() {
    const layerId = `draw-layer-${currentTabId.replace(/ /g, '-')}`;
    const layer = document.getElementById(layerId);

    if (layer && layer.lastChild) {
        layer.removeChild(layer.lastChild);
    }
};

window.setCurrentAsDefault = function() {
    const bgRect = background.getBoundingClientRect();
    const allBots = [...redRobots, ...blueRobots];

    if (allBots.length === 0) return;

    robotHomePositions = allBots.map(bot => {
        const matrix = bot.robotElement.parentNode.transform.baseVal.getItem(0).matrix;
        return { 
            xPercent: matrix.e / bgRect.width, 
            yPercent: matrix.f / bgRect.height 
        };
    });

    tabNames.forEach(name => {
        tabStates[name].positions = allBots.map((bot, index) => {
            return { 
                x: robotHomePositions[index].xPercent * bgRect.width, 
                y: robotHomePositions[index].yPercent * bgRect.height 
            };
        });
    });
};