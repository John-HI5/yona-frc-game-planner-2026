function getActiveLayer() {
  const layerId = `draw-layer-${currentTabId.replace(/ /g, '-')}`;
  return document.getElementById(layerId) || stageCanvas;
}

var currentArrow = null;
var currentPenPath = null;
var currentPolygon = null;

fieldCanvas.addEventListener("pointermove", (event) => {
  let position = getMousePosition(event);
  
  if (currentCanvasMode == CanvasMode.ARROW) {
    if (currentArrow != null) {
      currentArrow.setAttribute("x2", position.x);
      currentArrow.setAttribute("y2", position.y);
    }
  } else if (currentCanvasMode == CanvasMode.DRAG) {
    if (selectedElement) {
      event.preventDefault(); 
      transform.setTranslate(position.x - offset.x, position.y - offset.y);
    }
  } else if (currentCanvasMode == CanvasMode.PEN) {
    if (currentPenPath) {
      event.preventDefault(); 
      currentPenPath.setAttribute(
        "points",
        currentPenPath.getAttribute("points") + position.x + " " + position.y + " "
      );
    }
  } else if (currentCanvasMode == CanvasMode.DELETE && (event.buttons != 0 || event.pointerType === 'touch')) {
    let target = document.elementFromPoint(event.clientX, event.clientY);
    if (target && target !== fieldCanvas && target.id !== "field-background") {
      let isRobot = target.closest('.robot-group');
      let isSlot = target.closest('.slot-group');
      if (!isRobot && !isSlot) target.remove();
    }
  }
});

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
      // Fix: Don't start path if clicking on a robot (logic handled in selectElement)
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

  // Handle Double/Triple clicks for resetting mode
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
      // FIX 1: Triple click deletes drawing and goes to pen mode
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
});

function makeDragable(element) {
  element.addEventListener("pointerdown", selectElement);
  element.addEventListener("pointerup", releaseElement);
}

function selectElement(evt) {
    evt.stopPropagation();
    let target = evt.currentTarget;

    // FIX 2: Robot click in PEN mode sets the pen color
    if (currentCanvasMode == CanvasMode.PEN && target.classList.contains("robot-group")) {
        let txt = target.querySelector("text");
        if (txt) {
            let robotColor = txt.getAttribute("fill") || txt.style.fill;
            changeColor(robotColor);
        }
        return; 
    }

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

    if (currentCanvasMode == CanvasMode.DELETE) {
        if (!target.classList.contains("robot-group") && !target.classList.contains("slot-group")) target.remove();
        return;
    }

    if (currentCanvasMode == CanvasMode.DRAG) {
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