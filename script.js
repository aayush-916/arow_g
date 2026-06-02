const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const healthP1El = document.getElementById("healthP1");
const healthP2El = document.getElementById("healthP2");
const healthTextP1El = document.getElementById("healthTextP1");
const healthTextP2El = document.getElementById("healthTextP2");
const turnBadgeEl = document.getElementById("turnBadge");
const hintTextEl = document.getElementById("hintText");
const winnerOverlayEl = document.getElementById("winnerOverlay");
const winnerTextEl = document.getElementById("winnerText");
const restartButtonEl = document.getElementById("restartButton");

const DPR = Math.max(1, window.devicePixelRatio || 1);
const GRAVITY = 900;
const DAMAGE = 20;
const MAX_POWER = 780;
const MIN_POWER = 140;

const state = {
  width: 0,
  height: 0,
  groundY: 0,
  currentPlayer: 0,
  isDragging: false,
  dragPointerId: null,
  aimPoint: null,
  arrow: null,
  winner: null,
  players: [],
};

function makePlayers() {
  const width = state.width;
  const groundY = state.groundY;
  const archerSize = Math.max(28, Math.min(42, state.height * 0.11));
  const existingPlayers = state.players;

  state.players = [
    {
      id: 0,
      name: "Player 1",
      side: "left",
      x: width * 0.16,
      y: groundY,
      health: existingPlayers[0]?.health ?? 100,
      color: "#d95d39",
      accent: "#f6b35e",
      facing: 1,
      size: archerSize,
    },
    {
      id: 1,
      name: "Player 2",
      side: "right",
      x: width * 0.84,
      y: groundY,
      health: existingPlayers[1]?.health ?? 100,
      color: "#2e7d5b",
      accent: "#76d5a0",
      facing: -1,
      size: archerSize,
    },
  ];
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  state.width = rect.width;
  state.height = rect.height;
  canvas.width = Math.round(rect.width * DPR);
  canvas.height = Math.round(rect.height * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  state.groundY = state.height * 0.78;
  makePlayers();
  state.arrow = null;
  state.isDragging = false;
  state.dragPointerId = null;
  state.aimPoint = null;
  if (!state.winner) {
    updateHud();
  }
}

function restartGame() {
  state.currentPlayer = 0;
  state.winner = null;
  winnerOverlayEl.classList.add("hidden");
  resizeCanvas();
}

function updateHud() {
  const p1 = state.players[0];
  const p2 = state.players[1];

  healthP1El.style.width = `${p1.health}%`;
  healthP2El.style.width = `${p2.health}%`;
  healthTextP1El.textContent = `${p1.health} HP`;
  healthTextP2El.textContent = `${p2.health} HP`;

  if (state.winner) {
    turnBadgeEl.textContent = `${state.winner.name} Wins`;
    hintTextEl.textContent = "Tap restart to play again.";
    return;
  }

  turnBadgeEl.textContent = `${state.players[state.currentPlayer].name} Turn`;
  hintTextEl.textContent = state.arrow
    ? "Arrow in flight..."
    : "Touch and drag from your archer to aim, then release to fire.";
}

function getBowAnchor(player) {
  return {
    x: player.x + player.facing * player.size * 0.45,
    y: player.y - player.size * 1.45,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function pointerDown(event) {
  if (state.winner || state.arrow) {
    return;
  }

  const player = state.players[state.currentPlayer];
  const bow = getBowAnchor(player);
  const point = getPointerPosition(event);
  const distance = Math.hypot(point.x - bow.x, point.y - bow.y);
  const allowedRadius = Math.max(72, player.size * 3.1);

  if (distance > allowedRadius) {
    return;
  }

  state.isDragging = true;
  state.dragPointerId = event.pointerId;
  state.aimPoint = point;
  canvas.setPointerCapture(event.pointerId);
}

function pointerMove(event) {
  if (!state.isDragging || event.pointerId !== state.dragPointerId) {
    return;
  }

  state.aimPoint = getPointerPosition(event);
}

function pointerUp(event) {
  if (!state.isDragging || event.pointerId !== state.dragPointerId) {
    return;
  }

  const player = state.players[state.currentPlayer];
  const bow = getBowAnchor(player);
  const point = getPointerPosition(event);

  fireArrow(player, bow, point);

  state.isDragging = false;
  state.dragPointerId = null;
  state.aimPoint = null;
  canvas.releasePointerCapture(event.pointerId);
}

function fireArrow(player, bow, point) {
  const dx = bow.x - point.x;
  const dy = bow.y - point.y;
  const dragDistance = Math.hypot(dx, dy);
  const power = clamp(dragDistance * 4.2, MIN_POWER, MAX_POWER);

  if (dragDistance < 8) {
    return;
  }

  const normX = dx / dragDistance;
  const normY = dy / dragDistance;

  state.arrow = {
    ownerId: player.id,
    x: bow.x,
    y: bow.y,
    vx: normX * power,
    vy: normY * power,
    angle: Math.atan2(normY, normX),
    hitPlayerId: null,
  };

  updateHud();
}

function switchTurn() {
  state.currentPlayer = state.currentPlayer === 0 ? 1 : 0;
  updateHud();
}

function finishMatch(winner) {
  state.winner = winner;
  state.arrow = null;
  winnerTextEl.textContent = `${winner.name} Wins`;
  winnerOverlayEl.classList.remove("hidden");
  updateHud();
}

function registerHit(target) {
  target.health = Math.max(0, target.health - DAMAGE);
  updateHud();

  if (target.health <= 0) {
    const winner = state.players[target.id === 0 ? 1 : 0];
    finishMatch(winner);
  }
}

function arrowHitsPlayer(arrow, player) {
  const bodyTop = player.y - player.size * 1.9;
  const bodyBottom = player.y;
  const halfWidth = player.size * 0.35;

  return (
    arrow.x >= player.x - halfWidth &&
    arrow.x <= player.x + halfWidth &&
    arrow.y >= bodyTop &&
    arrow.y <= bodyBottom
  );
}

function updateArrow(deltaTime) {
  if (!state.arrow) {
    return;
  }

  const arrow = state.arrow;
  arrow.vy += GRAVITY * deltaTime;
  arrow.x += arrow.vx * deltaTime;
  arrow.y += arrow.vy * deltaTime;
  arrow.angle = Math.atan2(arrow.vy, arrow.vx);

  const target = state.players.find(
    (player) => player.id !== arrow.ownerId && arrowHitsPlayer(arrow, player)
  );

  if (target) {
    registerHit(target);
    if (!state.winner) {
      state.arrow = null;
      switchTurn();
    }
    return;
  }

  const outOfBounds =
    arrow.x < -40 ||
    arrow.x > state.width + 40 ||
    arrow.y > state.groundY + 18 ||
    arrow.y < -60;

  if (outOfBounds) {
    state.arrow = null;
    if (!state.winner) {
      switchTurn();
    }
  }
}

function drawBackground() {
  const skyGradient = ctx.createLinearGradient(0, 0, 0, state.groundY);
  skyGradient.addColorStop(0, "#8fd0ff");
  skyGradient.addColorStop(0.55, "#dff2ff");
  skyGradient.addColorStop(1, "#f4fbff");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, state.width, state.groundY);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(state.width * 0.2, state.height * 0.16, state.width * 0.11, state.height * 0.06, 0, 0, Math.PI * 2);
  ctx.ellipse(state.width * 0.72, state.height * 0.14, state.width * 0.14, state.height * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  const groundGradient = ctx.createLinearGradient(0, state.groundY, 0, state.height);
  groundGradient.addColorStop(0, "#8bc064");
  groundGradient.addColorStop(1, "#567f38");
  ctx.fillStyle = groundGradient;
  ctx.fillRect(0, state.groundY, state.width, state.height - state.groundY);

  ctx.fillStyle = "#6f8d4b";
  ctx.beginPath();
  ctx.moveTo(0, state.groundY);
  for (let x = 0; x <= state.width; x += 28) {
    const bump = Math.sin(x / 48) * 5;
    ctx.lineTo(x, state.groundY + bump);
  }
  ctx.lineTo(state.width, state.height);
  ctx.lineTo(0, state.height);
  ctx.closePath();
  ctx.fill();
}

function drawArcher(player, isCurrent) {
  const baseX = player.x;
  const baseY = player.y;
  const size = player.size;
  const bow = getBowAnchor(player);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "#44331f";
  ctx.lineWidth = Math.max(3, size * 0.11);

  ctx.beginPath();
  ctx.moveTo(baseX, baseY - size * 1.55);
  ctx.lineTo(baseX, baseY - size * 0.72);
  ctx.moveTo(baseX, baseY - size * 1.2);
  ctx.lineTo(baseX - size * 0.42, baseY - size * 0.95);
  ctx.moveTo(baseX, baseY - size * 1.2);
  ctx.lineTo(baseX + size * 0.42, baseY - size * 0.95);
  ctx.moveTo(baseX, baseY - size * 0.72);
  ctx.lineTo(baseX - size * 0.35, baseY);
  ctx.moveTo(baseX, baseY - size * 0.72);
  ctx.lineTo(baseX + size * 0.35, baseY);
  ctx.stroke();

  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(baseX, baseY - size * 1.8, size * 0.24, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = player.accent;
  ctx.lineWidth = Math.max(3, size * 0.1);
  ctx.beginPath();
  ctx.arc(
    bow.x,
    bow.y,
    size * 0.42,
    -Math.PI / 2,
    Math.PI / 2
  );
  ctx.stroke();

  ctx.strokeStyle = "rgba(64, 46, 24, 0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bow.x, bow.y - size * 0.42);
  ctx.lineTo(bow.x, bow.y + size * 0.42);
  ctx.stroke();

  if (isCurrent && !state.arrow) {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(baseX, baseY - size * 1.15, size * 0.95, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAimGuide() {
  if (!state.isDragging || !state.aimPoint) {
    return;
  }

  const player = state.players[state.currentPlayer];
  const bow = getBowAnchor(player);
  const dx = bow.x - state.aimPoint.x;
  const dy = bow.y - state.aimPoint.y;
  const dragDistance = Math.hypot(dx, dy);
  if (dragDistance < 1) {
    return;
  }

  const power = clamp(dragDistance * 4.2, MIN_POWER, MAX_POWER);
  const normX = dx / dragDistance;
  const normY = dy / dragDistance;
  const points = [];

  for (let step = 0; step < 24; step += 1) {
    const t = step * 0.12;
    const px = bow.x + normX * power * t;
    const py = bow.y + normY * power * t + 0.5 * GRAVITY * t * t;
    points.push({ x: px, y: py });
  }

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(bow.x, bow.y);
  points.forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(state.aimPoint.x, state.aimPoint.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawArrow() {
  if (!state.arrow) {
    return;
  }

  const arrow = state.arrow;

  ctx.save();
  ctx.translate(arrow.x, arrow.y);
  ctx.rotate(arrow.angle);

  ctx.strokeStyle = "#5f4323";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(16, 0);
  ctx.stroke();

  ctx.fillStyle = "#c9d7df";
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(8, -4);
  ctx.lineTo(8, 4);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#f0f4f6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.lineTo(-18, -5);
  ctx.moveTo(-12, 0);
  ctx.lineTo(-18, 5);
  ctx.stroke();

  ctx.restore();
}

let lastTime = 0;

function frame(time) {
  const deltaTime = Math.min(0.032, (time - lastTime) / 1000 || 0);
  lastTime = time;

  updateArrow(deltaTime);

  drawBackground();
  drawArcher(state.players[0], state.currentPlayer === 0);
  drawArcher(state.players[1], state.currentPlayer === 1);
  drawAimGuide();
  drawArrow();

  requestAnimationFrame(frame);
}

canvas.addEventListener("pointerdown", pointerDown);
canvas.addEventListener("pointermove", pointerMove);
canvas.addEventListener("pointerup", pointerUp);
canvas.addEventListener("pointercancel", pointerUp);
restartButtonEl.addEventListener("click", restartGame);
window.addEventListener("resize", resizeCanvas);

restartGame();
requestAnimationFrame(frame);
