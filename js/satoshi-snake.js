(function () {
  "use strict";

  var modal = document.getElementById("satoshi-snake-modal");
  var trigger = document.getElementById("satoshi-snake-trigger");
  if (!modal || !trigger) {
    return;
  }

  var canvas = document.getElementById("ss-canvas");
  var ctx = canvas.getContext("2d");
  var scoreEl = document.getElementById("ss-score");
  var finalEl = document.getElementById("ss-final");
  var gameoverEl = document.getElementById("ss-gameover");
  var replayBtn = document.getElementById("ss-replay");
  var closeBtn = modal.querySelector(".ss-close");

  var COLS = 20;
  var ROWS = 20;
  var cellSize = 16;
  var snake = [];
  var dir = { x: 1, y: 0 };
  var nextDir = { x: 1, y: 0 };
  var food = { x: 0, y: 0 };
  var score = 0;
  var tickMs = 140;
  var loopId = null;
  var gameOver = false;
  var touchStart = null;

  function resizeCanvas() {
    var max = Math.min(360, window.innerWidth - 56);
    cellSize = Math.max(12, Math.floor(max / COLS));
    canvas.width = cellSize * COLS;
    canvas.height = cellSize * ROWS;
    draw();
  }

  function spawnFood() {
    var empty = [];
    var x;
    var y;
    for (y = 0; y < ROWS; y += 1) {
      for (x = 0; x < COLS; x += 1) {
        if (!snake.some(function (segment) {
          return segment.x === x && segment.y === y;
        })) {
          empty.push({ x: x, y: y });
        }
      }
    }
    if (!empty.length) {
      return;
    }
    food = empty[Math.floor(Math.random() * empty.length)];
  }

  function resetGame() {
    snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 }
    ];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    tickMs = 140;
    gameOver = false;
    scoreEl.textContent = "0";
    gameoverEl.hidden = true;
    canvas.hidden = false;
    spawnFood();
    draw();
    startLoop();
  }

  function startLoop() {
    stopLoop();
    loopId = window.setInterval(tick, tickMs);
  }

  function stopLoop() {
    if (loopId !== null) {
      window.clearInterval(loopId);
      loopId = null;
    }
  }

  function restartLoopWithSpeed() {
    stopLoop();
    loopId = window.setInterval(tick, tickMs);
  }

  function endGame() {
    gameOver = true;
    stopLoop();
    finalEl.textContent = String(score);
    canvas.hidden = true;
    gameoverEl.hidden = false;
    replayBtn.focus();
  }

  function tick() {
    if (gameOver) {
      return;
    }

    dir = nextDir;
    var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      endGame();
      return;
    }

    if (snake.some(function (segment) {
      return segment.x === head.x && segment.y === head.y;
    })) {
      endGame();
      return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score += 100;
      scoreEl.textContent = String(score);
      tickMs = Math.max(60, tickMs - 4);
      spawnFood();
      restartLoopWithSpeed();
    } else {
      snake.pop();
    }

    draw();
  }

  function themeColors() {
    var style = getComputedStyle(document.documentElement);
    return {
      bg: style.getPropertyValue("--bg").trim() || "#fff",
      fg: style.getPropertyValue("--fg").trim() || "#111",
      muted: style.getPropertyValue("--muted").trim() || "#444",
      border: style.getPropertyValue("--border").trim() || "#e5e5e5"
    };
  }

  function drawCell(x, y, fill) {
    var pad = Math.max(1, Math.floor(cellSize * 0.08));
    ctx.fillStyle = fill;
    ctx.fillRect(
      x * cellSize + pad,
      y * cellSize + pad,
      cellSize - pad * 2,
      cellSize - pad * 2
    );
  }

  function draw() {
    var i;
    var colors = themeColors();

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

    for (i = 0; i < snake.length; i += 1) {
      drawCell(
        snake[i].x,
        snake[i].y,
        i === 0 ? colors.fg : colors.muted
      );
    }

    var cx = food.x * cellSize + cellSize / 2;
    var cy = food.y * cellSize + cellSize / 2;
    var size = cellSize * 0.72;

    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);

    ctx.fillStyle = colors.fg;
    ctx.font = "600 " + Math.floor(cellSize * 0.5) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u20bf", cx, cy + 0.5);
  }

  function setDirection(x, y) {
    if (gameOver) {
      return;
    }
    if (x === -dir.x && y === -dir.y) {
      return;
    }
    nextDir = { x: x, y: y };
  }

  function onKeyDown(event) {
    if (!modal.classList.contains("is-open")) {
      return;
    }

    var key = event.key;
    if (key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }

    if (key === "ArrowUp" || key === "w" || key === "W") {
      event.preventDefault();
      setDirection(0, -1);
    } else if (key === "ArrowDown" || key === "s" || key === "S") {
      event.preventDefault();
      setDirection(0, 1);
    } else if (key === "ArrowLeft" || key === "a" || key === "A") {
      event.preventDefault();
      setDirection(-1, 0);
    } else if (key === "ArrowRight" || key === "d" || key === "D") {
      event.preventDefault();
      setDirection(1, 0);
    }
  }

  function onTouchStart(event) {
    if (gameOver || event.touches.length !== 1) {
      return;
    }
    touchStart = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    };
  }

  function onTouchEnd(event) {
    if (!touchStart || gameOver) {
      return;
    }
    var touch = event.changedTouches[0];
    var dx = touch.clientX - touchStart.x;
    var dy = touch.clientY - touchStart.y;
    var absDx = Math.abs(dx);
    var absDy = Math.abs(dy);
    touchStart = null;

    if (Math.max(absDx, absDy) < 24) {
      return;
    }

    if (absDx > absDy) {
      setDirection(dx > 0 ? 1 : -1, 0);
    } else {
      setDirection(0, dy > 0 ? 1 : -1);
    }
  }

  function openModal() {
    modal.hidden = false;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("ss-modal-open");
    resizeCanvas();
    resetGame();
    closeBtn.focus();
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("ss-modal-open");
    stopLoop();
    trigger.focus();
  }

  trigger.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  replayBtn.addEventListener("click", resetGame);
  modal.querySelector(".ss-backdrop").addEventListener("click", closeModal);
  canvas.addEventListener("touchstart", onTouchStart, { passive: true });
  canvas.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", function () {
    if (modal.classList.contains("is-open")) {
      resizeCanvas();
    }
  });

  new MutationObserver(function () {
    if (modal.classList.contains("is-open")) {
      draw();
    }
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });
})();
