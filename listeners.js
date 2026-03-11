function getActiveLayer() {
  const layerId = `draw-layer-${currentTabId.replace(/ /g, '-')}`;
  return document.getElementById(layerId) || stageCanvas;
}

var currentArrow = null;
var currentPenPath = null;
var currentPolygon = null;

fieldCanvas.addEventListener("pointermove", (event) => {
  let position = getMousePosition(event);
  
  // 1. מניעת גלילה וזום של הדפדפן בזמן עבודה (קריטי לטאבלט)
  if (currentCanvasMode !== CanvasMode.DRAG || selectedElement || isDraggingSlot) {
    if (event.pointerType === 'touch') {
        event.preventDefault();
    }
  }

  if (currentCanvasMode == CanvasMode.ARROW) {
    if (currentArrow != null) {
      currentArrow.setAttribute("x2", position.x);
      currentArrow.setAttribute("y2", position.y);
    }
  } else if (currentCanvasMode == CanvasMode.DRAG) {
    // --- חדש: גרירת עיגולים לבנים (Slots) ---
    if (isDraggingSlot && draggedSlotIndex !== null && pendingSlot) {
      const newX = position.x - offset.x;
      const newY = position.y - offset.y;
      
      // עדכון ויזואלי של המיקום
      pendingSlot.setAttribute("transform", `translate(${newX}, ${newY})`);
      
      // עדכון הנתונים במערך המקורי כדי שישמר בשינוי רזולוציה
      const bgRect = background.getBoundingClientRect();
      const scaleX = bgRect.width / 2500;
      const scaleY = bgRect.height / 1185;
      
      slotCoords[draggedSlotIndex].x = newX / scaleX;
      slotCoords[draggedSlotIndex].y = newY / scaleY;
    } 
    // --- גרירת רובוטים (הקוד המקורי שלך) ---
    else if (selectedElement) {
      transform.setTranslate(position.x - offset.x, position.y - offset.y);
    }
  } else if (currentCanvasMode == CanvasMode.PEN) {
    if (currentPenPath) {
      currentPenPath.setAttribute(
        "points",
        currentPenPath.getAttribute("points") + position.x + " " + position.y + " "
      );
    }
  } 
  
  // --- כלי המחיקה המשופר לטאץ' ---
  else if (currentCanvasMode == CanvasMode.DELETE) {
    if (event.buttons !== 0 || event.pointerType === 'touch') {
      const offsets = [
        { dx: 0, dy: 0 },
        { dx: 40, dy: 10 },
        { dx: -40, dy: -40 },
        { dx: 40, dy: -40 },
        { dx: -40, dy: 40 }
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
  if (!document.getElementById("sidebar").classList.contains("open")) {
    var position = getMousePosition(event);
    const activeLayer = getActiveLayer();

    if (currentCanvasMode == CanvasMode.PIECE) {
      var piece = addImage(position.x, position.y, 0, "25assets/coral.svg", 30 * heightRatio, activeLayer);
      makeDragable(piece);
    } else if (currentCanvasMode == CanvasMode.ARROW) {
      if (currentArrow == null) {
        currentArrow = document.createElementNS("http://www.w3.org/2000/svg", "line");
        currentArrow.setAttribute("stroke", selectedColor);
        currentArrow.setAttribute("x1", position.x);
        currentArrow.setAttribute("y1", position.y);
        currentArrow.setAttribute("x2", position.x);
        currentArrow.setAttribute("y2", position.y);
        currentArrow.setAttribute("stroke-width", 4);
        currentArrow.setAttribute("marker-end", "url(#ah" + selectedColor.replace('#', '') + ")");
        activeLayer.appendChild(currentArrow);
        makeDragable(currentArrow);
      }
    } else if (currentCanvasMode == CanvasMode.PEN) {
      if (!event.target.closest('.robot-group')) {
        currentPenPath = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        currentPenPath.setAttribute("stroke", selectedColor);
        currentPenPath.setAttribute("fill", "none");
        currentPenPath.setAttribute("points", position.x + "," + position.y + " ");
        currentPenPath.setAttribute("stroke-width", 4);
        currentPenPath.setAttribute("stroke-linecap", "round");
        activeLayer.appendChild(currentPenPath);
        makeDragable(currentPenPath);
      }
    }
  } else {
    document.getElementById("sidebar").classList.replace("open", "closed");
    currentPolygon = null;
  }

  const now = Date.now();
  if (now - lastClickTime > 400) clickCount = 0;
  clickCount++;
  lastClickTime = now;

  if (event.target === fieldCanvas || event.target.id === "field-background") {
      colorPicker.style.display = "none";
      if (pendingSlot) {
          pendingSlot.classList.remove("slot-active");
          pendingSlot = null;
      }
      if (clickCount === 2) setMode(CanvasMode.DRAG);
      if (clickCount === 3) {
          clearField();
          setMode(CanvasMode.PEN);
          clickCount = 0;
      }
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

    // 1. Logic for Color Picking (Pen Mode)
    if (currentCanvasMode == CanvasMode.PEN && target.classList.contains("robot-group")) {
        let txt = target.querySelector("text");
        if (txt) {
            let robotColor = txt.getAttribute("fill") || txt.style.fill;
            changeColor(robotColor);
        }
        return; 
    }

    // 2. Logic for assigning a Robot to a Slot (Clicking a robot while a slot is active)
    if (pendingSlot && target.classList.contains("robot-group")) {
        let robotNum = target.querySelector("text").innerHTML;
        let robotColor = target.querySelector("text").getAttribute("fill") || target.querySelector("text").style.fill;
        let slotText = pendingSlot.querySelector("text");
        slotText.innerHTML = robotNum;
        slotText.setAttribute("fill", robotColor);
        pendingSlot.classList.remove("slot-active");
        pendingSlot = null;
        return;
    }

    // 3. Delete Logic
    if (currentCanvasMode == CanvasMode.DELETE) {
        if (!target.classList.contains("robot-group") && !target.classList.contains("slot-group")) target.remove();
        return;
    }

    // 4. Drag Logic
    if (currentCanvasMode == CanvasMode.DRAG) {
        // --- NEW: Handle White Circle (Slot) Dragging ---
        if (target.classList.contains("slot-group")) {
            isDraggingSlot = true;
            pendingSlot = target;
            target.classList.add("slot-active");
            
            // Get the index from the attribute we set in initSlots
            draggedSlotIndex = parseInt(target.getAttribute("data-index"));
            
            let mousePos = getMousePosition(evt);
            let transforms = target.transform.baseVal;
            
            // Ensure a translate transform exists
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
            return; // Stop here so it doesn't run the robot logic below
        }

        // --- Original Robot Dragging Logic ---
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
    alert("המיקומים נשמרו כברירת מחדל!");
};