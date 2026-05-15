const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const restartBtn = document.getElementById("restartBtn");
const finalScore = document.getElementById("finalScore");
const scoreEl = document.getElementById("score");

const loginOverlay = document.getElementById("loginOverlay");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const showRegister = document.getElementById("showRegister");
const showLogin = document.getElementById("showLogin");
const authError = document.getElementById("authError");
const gameContainer = document.getElementById("gameContainer");
const userInfo = document.getElementById("userInfo");
const welcomeMsg = document.getElementById("welcomeMsg");
const logoutBtn = document.getElementById("logoutBtn");

const leaderboardList = document.getElementById("highScoreList");

const cannonImg = new Image();
const bulletImg = new Image();
const monsterImg = new Image(); 
const explosionSound = new Audio();
const firingSound = new Audio();
const gameOverSound = new Audio();
const steamSound = new Audio();

const assetSources = {
  cannon: "/cannon.png",
  bullet: "/bullet.png",
  monster: "/monster.png",
  explosion: "/explosion.mp3",
  firing: "/firing.mp3",
  gameOver: "/game-over.mp3",
  steam: "/steam.mp3"
};

let player, bullets, enemies, explosions, score, lastFire, gameOver;
let socket;
let enemySpeed;

let currentUser = null;
let gameLoopInterval = null;
let assetsAreLoading = false;

function getStorage(key) {
  return JSON.parse(localStorage.getItem(key)) || {};
}
function saveStorage(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

showRegister.addEventListener("click", (e) => {
  e.preventDefault();
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");
  authError.innerText = "";
});

showLogin.addEventListener("click", (e) => {
  e.preventDefault();
  registerForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
  authError.innerText = "";
});

loginForm.addEventListener("submit", handleLogin);
registerForm.addEventListener("submit", handleRegister);
logoutBtn.addEventListener("click", handleLogout);

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById("loginUser").value;
  const pass = document.getElementById("loginPass").value;
  const users = getStorage("gameUsers");

  if (users[username] && users[username] === pass) {
    authError.innerText = "";
    document.getElementById("loginForm").reset();
    showGame(username);
  } else {
    authError.innerText = "Invalid username or password.";
  }
}

function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById("registerUser").value;
  const pass = document.getElementById("registerPass").value;
  const users = getStorage("gameUsers");

  const validUsernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{4,14}$/;

  if (users[username]) {
    authError.innerText = "Username already taken.";
  } else if (!validUsernameRegex.test(username)) {
    authError.innerText = "Username must be 5-15 characters, start with a letter, and use only letters, numbers, or _.";
  } else if (pass.length < 4) {
    authError.innerText = "Password must be at least 4 characters.";
  } else {
    users[username] = pass;
    saveStorage("gameUsers", users);
    
    const scores = getStorage("gameScores");
    if (!scores[username]) {
      scores[username] = 0;
      saveStorage("gameScores", scores);
    }
    
    authError.innerText = "";
    document.getElementById("registerForm").reset();
    showGame(username);
  }
}

function handleLogout() {
  gameContainer.classList.add("hidden");
  loginOverlay.classList.remove("hidden");
  
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
    gameLoopInterval = null;
  }
  
  if (socket) {
    socket.close();
    socket = null;
  }
  
  if (!firingSound.paused) {
    firingSound.pause();
    firingSound.currentTime = 0;
  }
  
  currentUser = null;
  welcomeMsg.innerText = "";
  
  registerForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
}

function showGame(username) {
  currentUser = username;
  welcomeMsg.innerText = `Welcome, ${username}!`;
  
  loginOverlay.classList.add("hidden");
  gameContainer.classList.remove("hidden");
  
  updateLeaderboard();
  
  initializeGame();
}

function updateLeaderboard() {
  const scores = getStorage("gameScores");
  
  const scoreArray = Object.entries(scores).map(([user, score]) => {
    return { user, score };
  });
  
  scoreArray.sort((a, b) => b.score - a.score);
  
  leaderboardList.innerHTML = "";
  scoreArray.forEach(item => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${item.user}</strong>: ${item.score}`;
    leaderboardList.appendChild(li);
  });
}

function updateUserHighScore(newScore) {
  if (!currentUser) return; 
  
  const scores = getStorage("gameScores");
  const currentHighScore = scores[currentUser] || 0;
  
  if (newScore > currentHighScore) {
    scores[currentUser] = newScore;
    saveStorage("gameScores", scores);
    
    updateLeaderboard();
  }
}

function resetGame() {
  player = { x: 275, y: canvas.height - 40, size: 40, targetX: 275 };
  bullets = [];
  enemies = [];
  explosions = [];
  score = 0;
  lastFire = 0;
  gameOver = false;
  enemySpeed = 1;
  updateScore();
  overlay.style.visibility = "hidden";

  if (!steamSound.paused) {
    steamSound.pause();
    steamSound.currentTime = 0;
  }
  if (socket) {
    socket.send("reset");
  }
}

function drawPlayer() {
  ctx.drawImage(cannonImg, player.x - player.size, player.y - player.size, player.size * 2, player.size * 2);
}

function drawBullets() {
  bullets.forEach(b => {
    ctx.drawImage(bulletImg, b.x - 4, b.y - 20, 8, 20); 
    b.y -= 5; 
  });
  bullets = bullets.filter(b => b.y > 0);
}

function drawEnemies() {
  for (let e of enemies) {
    ctx.drawImage(monsterImg, e.x - 25, e.y - 25, 50, 50); 
    e.y += (enemySpeed / 5); 
    if (e.y >= canvas.height - 10) {
      endGame();
      return;
    }
  }
}

function drawExplosions() {
  for (let i = 0; i < explosions.length; i++) {
    let ex = explosions[i];
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 0, 0, ${ex.alpha})`;
    ctx.fill();
    ex.radius += 0.4;
    ex.alpha -= 0.01;
  }
  explosions = explosions.filter(ex => ex.alpha > 0);
}

function checkCollision() {
  bullets.forEach((b, bi) => {
    enemies.forEach((e, ei) => {
      if (Math.abs(b.x - e.x) < 25 && Math.abs(b.y - e.y) < 25) { 
        let ex = e.x, ey = e.y;
        bullets.splice(bi, 1);
        enemies.splice(ei, 1);
        
        // if (socket) socket.send("monster_hit"); 
        
        explosions.push({ x: ex, y: ey, radius: 1, alpha: 1 });
        score++;
        updateScore();
        
        let shouldIncrease = true;
        if (score < 50 && enemySpeed >= 6) {
            shouldIncrease = false;
        }
        
        if (shouldIncrease) {
            enemySpeed += 0.016; 
        }
        
        explosionSound.currentTime = 0; 
        explosionSound.play();
      }
    });
  });
}

function updateScore() {
  scoreEl.innerText = "Score: " + score;
}

function spawnEnemy() {
  if (Math.random() < (0.01 + enemySpeed * 0.001)) {
    enemies.push({ x: Math.random() * 500 + 25, y: 0 });
  }
}

function gameLoop() {
  if (gameOver) return;
  
  player.x += (player.targetX - player.x) * 0.1; 
  
  let shouldIncrease = true;
  if (score < 50 && enemySpeed >= 6) {
      shouldIncrease = false;
  }

  if (shouldIncrease) {
      enemySpeed += 0.0004; 
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPlayer();
  drawBullets();
  drawEnemies();
  drawExplosions();
  checkCollision();
  spawnEnemy();
}

function endGame() {
  gameOver = true;
  finalScore.innerText = "Your Score: " + score;
  overlay.style.visibility = "visible";
  
  updateUserHighScore(score);
  
  if (!firingSound.paused) {
    firingSound.pause();
    firingSound.currentTime = 0;
  }
  explosionSound.pause();
  explosionSound.currentTime = 0;
  
  gameOverSound.currentTime = 0;
  gameOverSound.play();
  
  if (socket) {
    socket.send("gameOver");
  }
}

restartBtn.addEventListener("click", resetGame);

function initWebSocket() {
  if (socket) {
    socket.close();
  }
  socket = new WebSocket("ws://" + window.location.hostname + ":81/");
  
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data); 
    
    if (data.x !== undefined) {
      player.targetX = Math.max(40, Math.min(510, data.x));
  
      if (!gameOver) {
        if (data.fire === 1) {
          if (Date.now() - lastFire > 300) {
            bullets.push({ x: player.x, y: player.y - player.size });
            lastFire = Date.now();
          }
          if (firingSound.paused) { 
            firingSound.loop = true;
            firingSound.play();
          }
        } else { 
          if (!firingSound.paused) {
            firingSound.pause();
            firingSound.currentTime = 0;
          }
        }
      }
    }
    
    if (data.event === "steam_on") {
      console.log("Received steam_on");
      steamSound.currentTime = 0;
      steamSound.loop = true; 
      steamSound.play();
    } else if (data.event === "steam_off") {
      console.log("Received steam_off");
      steamSound.pause();
      steamSound.currentTime = 0;
    }
  };
  
  socket.onclose = () => {
    if (currentUser) {
      console.log("Socket closed. Reconnecting...");
      setTimeout(initWebSocket, 2000);
    } else {
      console.log("Socket closed. User logged out.");
    }
  };

  socket.onerror = (err) => {
    console.error("WebSocket Error: ", err);
  };
}

let assetsLoaded = 0;
const totalAssets = Object.keys(assetSources).length;

function onAssetLoad() {
  assetsLoaded++;
  if (assetsLoaded === totalAssets) {
    assetsAreLoading = false;
    console.log("All assets loaded. Starting game.");
    startGame();
  }
}

function preloadAssets() {
  if (assetsAreLoading) return;
  assetsAreLoading = true;
  assetsLoaded = 0; 
  console.log("Loading assets...");
  
  cannonImg.onload = onAssetLoad;
  bulletImg.onload = onAssetLoad;
  monsterImg.onload = onAssetLoad; 
  
  cannonImg.onerror = () => console.error("Failed to load cannon.png");
  bulletImg.onerror = () => console.error("Failed to load bullet.png");
  monsterImg.onerror = () => console.error("Failed to load monster.png");
  
  explosionSound.addEventListener("canplaythrough", onAssetLoad, { once: true });
  firingSound.addEventListener("canplaythrough", onAssetLoad, { once: true });
  gameOverSound.addEventListener("canplaythrough", onAssetLoad, { once: true });
  steamSound.addEventListener("canplaythrough", onAssetLoad, { once: true }); 
  
  explosionSound.onerror = () => console.error("Failed to load explosion.mp3");
  firingSound.onerror = () => console.error("Failed to load firing.mp3");
  gameOverSound.onerror = () => console.error("Failed to load game-over.mp3");
  steamSound.onerror = () => console.error("Failed to load steam.mp3");
  
  cannonImg.src = assetSources.cannon;
  bulletImg.src = assetSources.bullet;
  monsterImg.src = assetSources.monster;
  explosionSound.src = assetSources.explosion;
  firingSound.src = assetSources.firing;
  gameOverSound.src = assetSources.gameOver;
  steamSound.src = assetSources.steam;
}

function startGame() {
  resetGame();
  initWebSocket();
  
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
  }

  gameLoopInterval = setInterval(gameLoop, 16);
}

function initializeGame() {
  preloadAssets();
}