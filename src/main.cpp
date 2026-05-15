#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <LittleFS.h>
#include <Adafruit_NeoPixel.h>

const char* ssid = "ESP32_GESTURE";
const char* password = "12345678";


#define TRIG_PIN 26
#define ECHO_PIN 27
#define FIRE_SENSOR_PIN 25 // ir sensor
#define TOUCH_PIN 4

#define RELAY_PIN 23
#define LED_PIN 19
#define LED_COUNT 15

Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

const long delayBeforeRelay = 1000;
bool isGameOverTimerRunning = false;
bool hasRelayStarted = false;
unsigned long gameOverSequenceStartTime = 0;


WebServer server(80);
WebSocketsServer webSocket = WebSocketsServer(81);

const int numSamples = 5;
float distanceSamples[numSamples];
int sampleIndex = 0;
bool bufferFilled = false;

float smoothedX = 275; 
int fire = 0;

void setStripColor(uint32_t color) {
  strip.fill(color);
  strip.show();
}

void clearStrip() {
  strip.clear();
  strip.show();
}

void fadeAllPixels(uint8_t fadeAmount) {
  for(int i=0; i < strip.numPixels(); i++) {
    uint32_t color = strip.getPixelColor(i);
    uint8_t r = (color >> 16) & 0xFF;
    uint8_t g = (color >> 8) & 0xFF;
    uint8_t b = color & 0xFF;

    r = (r <= fadeAmount) ? 0 : r - fadeAmount;
    g = (g <= fadeAmount) ? 0 : g - fadeAmount;
    b = (b <= fadeAmount) ? 0 : b - fadeAmount;

    strip.setPixelColor(i, r, g, b);
  }

}


float ol_measure_distance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return -1.0;
  return duration * 0.0343 / 2.0;
}

float ol_get_median(float *arr, int size) {
  float temp[size];
  memcpy(temp, arr, sizeof(float) * size);
  for (int i = 0; i < size - 1; i++) {
    for (int j = 0; j < size - i - 1; j++) {
      if (temp[j] > temp[j + 1]) {
        float t = temp[j];
        temp[j] = temp[j + 1];
        temp[j + 1] = t;
      }
    }
  }
  return temp[size / 2];
}

float getFilteredDistance() {
  float newDistance = ol_measure_distance();
  if (newDistance < 0) return -1;

  distanceSamples[sampleIndex] = newDistance;
  sampleIndex = (sampleIndex + 1) % numSamples;
  if (sampleIndex == 0) bufferFilled = true;

  if (bufferFilled)
    return ol_get_median(distanceSamples, numSamples);
  else
    return newDistance;
}

void triggerGameOverSequence() {
  if (isGameOverTimerRunning) return; 

  Serial.println("GAME OVER: Starting 1-second delay...");
  isGameOverTimerRunning = true;
  hasRelayStarted = false; 
  gameOverSequenceStartTime = millis();
}

void handleRoot() {
  File file = LittleFS.open("/index.html", "r");
  if (!file) {
    server.send(404, "text/plain", "File not found");
    return;
  }
  server.streamFile(file, "text/html");
  file.close();
}

void handleFileRequest(String path, String contentType) {
  if (server.uri() == path) {
    File file = LittleFS.open(path, "r");
    if (!file) {
      server.send(404, "text/plain", "Not found");
      return;
    }
    server.streamFile(file, contentType);
    file.close();
  }
}

void handleWebSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.printf("[%u] WebSocket Connected\n", num);
      break;
    case WStype_DISCONNECTED:
      Serial.printf("[%u] Disconnected!\n", num);
      break;
    case WStype_TEXT:

      if (strcmp((char*)payload, "gameOver") == 0) {
        triggerGameOverSequence();
      }
      
      else if (strcmp((char*)payload, "reset") == 0) {
        Serial.println("Game reset by client. Relay OFF, LEDs OFF, sending 'steam_off'.");
        digitalWrite(RELAY_PIN, HIGH); 
        clearStrip(); 
        webSocket.broadcastTXT("{\"event\":\"steam_off\"}"); 
        isGameOverTimerRunning = false;
        hasRelayStarted = false;
      }
      break;
    default:
      break;
  }
}

void broadcastGestureData() {
  float distance = getFilteredDistance(); 
  
  int mappedX = 275; 

  if (distance > 0) {
    mappedX = map((int)distance, 5, 25, 40, 510);
    mappedX = constrain(mappedX, 40, 510);
    smoothedX += (mappedX - smoothedX) * 0.2; 
  }
  
  // int touchValue = touchRead(T0); 

  fire = 0;
  if (digitalRead(FIRE_SENSOR_PIN) == LOW) fire = 1;
  // if (touchValue < 30) fire = 1; 

  String json = "{";
  json += "\"x\":" + String(smoothedX) + ","; 
  json += "\"fire\":" + String(fire);
  json += "}";
  webSocket.broadcastTXT(json);
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(FIRE_SENSOR_PIN, INPUT);

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH); 

  strip.begin();
  strip.setBrightness(15); 
  clearStrip(); 

  if (!LittleFS.begin()) {
    Serial.println("LittleFS Mount Failed!");
    return;
  }

  WiFi.softAP(ssid, password);
  IPAddress IP = WiFi.softAPIP();
  Serial.print("Access Point IP: ");
  Serial.println(IP);

  server.on("/", handleRoot);
  server.on("/script.js", []() { handleFileRequest("/script.js", "application/javascript"); });
  server.on("/style.css", []() { handleFileRequest("/style.css", "text/css"); });

  server.on("/cannon.png",  []() { handleFileRequest("/cannon.png", "image/png"); });
  server.on("/bullet.png",  []() { handleFileRequest("/bullet.png", "image/png"); });
  server.on("/monster.png", []() { handleFileRequest("/monster.png", "image/png"); });

  server.on("/explosion.mp3", []() { handleFileRequest("/explosion.mp3", "audio/mpeg"); });
  server.on("/firing.mp3", []() { handleFileRequest("/firing.mp3", "audio/mpeg"); });
  server.on("/game-over.mp3", []() { handleFileRequest("/game-over.mp3", "audio/mpeg"); });
  server.on("/steam.mp3", []() { handleFileRequest("/steam.mp3", "audio/mpeg"); });

  server.begin();

  webSocket.begin();
  webSocket.onEvent(handleWebSocketEvent);

  for (int i = 0; i < numSamples; i++) distanceSamples[i] = 15.0;

  Serial.println("WebSocket server started on port 81");
}

void loop() {
  server.handleClient();
  webSocket.loop();

  static unsigned long lastSend = 0;
  if (millis() - lastSend > 80) {
    if (!isGameOverTimerRunning) {

      broadcastGestureData();


      fadeAllPixels(40); 
      

      int ledPos = map(smoothedX, 40, 510, 0, LED_COUNT - 1);
      
      if (fire == 1) {
   
        strip.setPixelColor(ledPos, strip.Color(180, 100, 0));
      } else {
    
        strip.setPixelColor(ledPos, strip.Color(150, 150, 150));
      }
      
      strip.show(); 
    }
    lastSend = millis();
  }


  if (isGameOverTimerRunning && !hasRelayStarted) {
    unsigned long timeElapsed = millis() - gameOverSequenceStartTime;
    
    if (timeElapsed >= delayBeforeRelay) {
      Serial.println("1 sec elapsed. Relay ON, LEDs ON, sending 'steam_on'.");
      digitalWrite(RELAY_PIN, LOW); 
      webSocket.broadcastTXT("{\"event\":\"steam_on\"}");
      hasRelayStarted = true;

  
      setStripColor(strip.Color(150, 0, 0)); 
    }
  }
}