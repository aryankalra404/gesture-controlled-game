# 🎮 Gesture Controlled Shooting Game

A real-time gesture-controlled arcade shooter built on the **ESP32** microcontroller. Players control a cannon using hand gestures detected via an **ultrasonic sensor**, fire projectiles using an **IR sensor**, and experience physical feedback through a **relay-triggered mist maker/humidifier** and a **NeoPixel LED strip** — all rendered in a browser over Wi-Fi.

---

## 📸 Demo

https://github.com/aryankalra404/gesture-controlled-game/raw/main/demo.mp4

> _Connect to the ESP32's Wi-Fi hotspot → open browser → play with your hands in the air._

---

## ✨ Features

- 🖐️ **Gesture-based movement** — ultrasonic distance sensor maps hand position to cannon X-axis
- 🔫 **IR sensor firing** — hold hand over IR sensor to shoot bullets
- 💡 **NeoPixel LED feedback** — 15-LED strip tracks cannon position; turns red on Game Over
- 💨 **Mist maker / humidifier effect** — relay activates a mist maker 1 second after Game Over; turns off when player restarts
- 🌐 **WebSocket real-time communication** — ~80ms update loop between ESP32 and browser
- 🎮 **Canvas-based game** — cannon, bullets, monsters, explosions with progressive difficulty
- 👤 **User auth + leaderboard** — client-side login/register with localStorage high-score tracking
- 🔊 **Sound effects** — firing, explosion, game-over, and steam audio
- 📱 **Responsive UI** — works on desktop and mobile browsers

---

## 🗂️ Directory Structure

```
aryankalra404-gesture-controlled-game/
├── platformio.ini          # PlatformIO build config (board, libs, filesystem)
├── data/                   # Web files served from LittleFS (flash filesystem)
│   ├── index.html          # Game UI — login, canvas, leaderboard
│   ├── script.js           # Game logic, WebSocket client, asset loading
│   └── style.css           # Dark-themed responsive styling
└── src/
    └── main.cpp            # ESP32 firmware — sensors, WebSocket server, LEDs, relay
```

> **Note:** Game assets (images + audio) are included in `data/` and uploaded to the ESP32 flash filesystem.

---

## 🧰 Hardware Requirements

| Component | Pin | Notes |
|---|---|---|
| ESP32 Dev Board | — | Any standard 38-pin ESP32 |
| HC-SR04 Ultrasonic Sensor | TRIG: 26, ECHO: 27 | Detects hand distance (5–25 cm range) |
| IR Sensor | 25 | Active LOW — triggers firing |
| NeoPixel LED Strip | 19 | 15 LEDs, WS2812B |
| Relay Module | 23 | Active LOW — triggers mist maker/humidifier |
| Power Supply | — | 5V for NeoPixels; 3.3V logic for ESP32 |

---

## ⚙️ Software Requirements

- [PlatformIO](https://platformio.org/) (VS Code extension or CLI)
- Platform: `espressif32`
- Framework: `arduino`
- Libraries (auto-installed via `platformio.ini`):
  - `links2004/WebSockets @ ^2.3.7`
  - `adafruit/Adafruit NeoPixel @ ^1.12.0`

---

## 🚀 Setup Guide

### 1. Clone the Repository

```bash
git clone https://github.com/aryankalra404/gesture-controlled-game.git
cd gesture-controlled-game
```

### 2. Install PlatformIO

**Via VS Code:**
1. Open VS Code → Extensions (`Ctrl+Shift+X`)
2. Search **PlatformIO IDE** → Install
3. Restart VS Code

**Via CLI:**
```bash
pip install platformio
```

### 3. Wire the Hardware

Connect components to the ESP32 as per the pin table above. Ensure:
- Relay module is **active LOW** (relay OFF = `HIGH` signal)
- NeoPixel data line has a **300–500Ω resistor** inline
- Ultrasonic sensor and ESP32 share **common GND**

### 4. Upload Filesystem (Web Files)

Upload the `data/` folder to ESP32 flash using LittleFS:

**VS Code (PlatformIO sidebar):**
> `Project Tasks → esp32dev → Platform → Upload Filesystem Image`

**CLI:**
```bash
pio run --target uploadfs
```

### 5. Upload Firmware

**VS Code:** Click the **Upload** button (→) in the PlatformIO toolbar

**CLI:**
```bash
pio run --target upload
```

### 6. Monitor Serial Output (Optional)

```bash
pio device monitor --baud 115200
```

You should see:
```
Access Point IP: 192.168.4.1
WebSocket server started on port 81
```

### 7. Connect & Play

1. On your phone or laptop, connect to Wi-Fi: **`ESP32_GESTURE`** / password: **`12345678`**
2. Open a browser and go to: **`http://192.168.4.1`**
3. Register an account and start playing!

---

## 🎮 How to Play

| Action | Gesture |
|---|---|
| **Move cannon** | Move hand left/right above ultrasonic sensor (5–25 cm range) |
| **Fire** | Cover the IR sensor with your hand |
| **Game Over** | A monster reaches the bottom — mist maker turns on after 1 second |
| **Restart** | Click "Play Again" — mist maker turns off, game resets |

The LED strip mirrors your cannon's position in real time. On game over, it turns **solid red** and the mist maker activates after a 1-second delay. It turns off when the player clicks "Play Again".

---

## 🔌 WebSocket Protocol

The ESP32 runs a WebSocket server on **port 81**. Messages are JSON:

| Direction | Message | Description |
|---|---|---|
| ESP32 → Browser | `{"x": 275, "fire": 0}` | Cannon position (40–510) + fire state |
| ESP32 → Browser | `{"event": "steam_on"}` | Mist maker relay activated (1s after game over) |
| ESP32 → Browser | `{"event": "steam_off"}` | Mist maker relay deactivated (on restart) |
| Browser → ESP32 | `"gameOver"` | Triggers mist maker relay + LED game-over sequence |
| Browser → ESP32 | `"reset"` | Turns off mist maker, resets relay and LEDs |

---

## 🛠️ Configuration

You can tweak these constants in `src/main.cpp`:

```cpp
// Sensor pins
#define TRIG_PIN 26
#define ECHO_PIN 27
#define FIRE_SENSOR_PIN 25
#define RELAY_PIN 23
#define LED_PIN 19
#define LED_COUNT 15

// Gesture range (in cm) → mapped to canvas X (40–510)
map((int)distance, 5, 25, 40, 510)

// Relay delay after game over (ms)
const long delayBeforeRelay = 1000;

// LED brightness (0–255)
strip.setBrightness(15);
```

And in `script.js`:
```js
// Fire cooldown (ms)
if (Date.now() - lastFire > 300) { ... }

// Smoothing factor for cannon movement (0–1)
smoothedX += (mappedX - smoothedX) * 0.2;
```

---

## 📦 platformio.ini

```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
board_build.filesystem = littlefs

lib_deps =
  links2004/WebSockets@^2.3.7
  adafruit/Adafruit NeoPixel@^1.12.0
```

---

## ⚠️ Known Limitations

- **User data is stored in `localStorage`** — clearing browser data will erase accounts and scores
- **Single-player only** — WebSocket broadcasts to all connected clients simultaneously
- **No WPA2 Enterprise** — hotspot uses a simple shared password
- **Ultrasonic sensor is sensitive to angle** — keep hand parallel and within 5–25 cm for best results

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

---

## 📄 License

This project is open source. Add your preferred license (e.g. MIT) here.

---

_Built with ❤️ using ESP32, PlatformIO, and vanilla JS canvas._