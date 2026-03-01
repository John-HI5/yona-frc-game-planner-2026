// Function to get the current active drawing layer based on the tab
function getActiveLayer() {
  const layerId = `draw-layer-${currentTabId.replace(/ /g, '-')}`;
  return document.getElementById(layerId) || stageCanvas;
}

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
      currentPenPath.setAttribute(
        "points",
        currentPenPath.getAttribute("points") + position.x + " " + position.y + " "
      );
    }
  } else if (
    currentCanvasMode == CanvasMode.DELETE &&
    event.buttons != 0 &&
    event.target != fieldCanvas
  ) {
    if (
      !event.target.classList.contains("rbot") &&
      !event.target.classList.contains("bbot") &&
      !event.target.classList.contains("robot-group")
    ) {
      event.target.parentNode.removeChild(event.target);
    }
  }
});

fieldCanvas.addEventListener("pointerdown", (event) => {
  if (!document.getElementById("sidebar").classList.contains("open")) {
    var position = getMousePosition(event);
    const activeLayer = getActiveLayer();

    if (currentCanvasMode == CanvasMode.ROBOT) {
      if (
        (allianceColor == Alliance.RED && redRobots.length < 3) ||
        (allianceColor == Alliance.BLUE && blueRobots.length < 3)
      ) {
        let driveConfig = allianceColor == Alliance.RED ? "r" + (redRobots.length + 1) : "b" + (blueRobots.length + 1);
        let robotGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        robotGroup.setAttribute("transform", "translate(" + position.x + "," + position.y + ")");
        robotGroup.classList.add("robot-group");

        var robot = addImage(0, 0, 90, "assets/" + (allianceColor == Alliance.RED ? "r" : "b") + document.getElementById(driveConfig + "d").value + ".svg", currentRobotSize * heightRatio, robotGroup);
        robot.setAttribute("class", (allianceColor == Alliance.RED ? "r" : "b") + "bot");

        var teamNumber = document.createElementNS("http://www.w3.org/2000/svg", "text");
        teamNumber.innerHTML = document.getElementById(driveConfig).value;
        teamNumber.style = `font-family: monospace; font-weight: 900; font-size: ${currentTextSize}px;`;
        teamNumber.setAttribute("fill", "white");
        teamNumber.setAttribute("dominant-baseline", "middle");
        teamNumber.setAttribute("text-anchor", "middle");

        robotGroup.appendChild(teamNumber);
        stageCanvas.appendChild(robotGroup); 
        makeDragable(robotGroup);

        if (allianceColor == Alliance.RED) {
          redRobots.push(new Robot("r", robot, teamNumber));
        } else {
          blueRobots.push(new Robot("b", robot, teamNumber));
        }
      }
    } else if (currentCanvasMode == CanvasMode.PIECE) {
      var piece = addImage(position.x, position.y, 0, "25assets/coral.svg", 30 * heightRatio, activeLayer);
      makeDragable(piece);
    } else if (currentCanvasMode == CanvasMode.POLYGON) {
      if (currentPolygon == null) {
        currentPolygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        currentPolygon.setAttribute("fill", selectedColor);
        currentPolygon.setAttribute("points", position.x + ", " + position.y + " ");
        currentPolygon.setAttribute("stroke", selectedColor);
        currentPolygon.setAttribute("stroke-width", "3px");
        currentPolygon.setAttribute("fill-opacity", 0.4);
        activeLayer.appendChild(currentPolygon);
        makeDragable(currentPolygon);
      } else {
        var pts = currentPolygon.getAttribute("points");
        currentPolygon.setAttribute("points", pts + position.x + "," + position.y + " ");
      }
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
      currentPenPath = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      currentPenPath.setAttribute("stroke", selectedColor);
      currentPenPath.setAttribute("fill", "none");
      currentPenPath.setAttribute("points", position.x + "," + position.y + " ");
      currentPenPath.setAttribute("stroke-width", 4);
      currentPenPath.setAttribute("stroke-linecap", "round");
      activeLayer.appendChild(currentPenPath);
      makeDragable(currentPenPath);
    }
  } else {
    document.getElementById("sidebar").classList.replace("open", "closed");
    currentPolygon = null;
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