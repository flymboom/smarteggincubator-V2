#include <Arduino.h>
#include <WiFi.h>
#include "esp_camera.h"
#include <Firebase_ESP_Client.h>
#include <PubSubClient.h>
#include "mbedtls/base64.h"

// Provide the token generation process info.
#include "addons/TokenHelper.h"
// Provide the RTDB payload printing info and other helper functions.
#include "addons/RTDBHelper.h"

#define CAMERA_MODEL_AI_THINKER

#if defined(CAMERA_MODEL_AI_THINKER)
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

#define LED_GPIO_NUM       4
#define RED_LED_GPIO_NUM  33
#endif

// ==========================================
// CONFIGURATION
// ==========================================
const char* ssid = "ajeng";
const char* password = "1234567890";

#define API_KEY "AIzaSyB31u_oDgwW7fNTq0VvU0PXIEXhdfZpcbg"
#define DATABASE_URL "smart-egg-incubator-e011f-default-rtdb.asia-southeast1.firebasedatabase.app"

// MQTT Broker Settings
const char* mqtt_server = "test.mosquitto.org";
const int mqtt_port = 1883;
// A secure, randomized topic string so others can't easily guess your video stream
const char* mqtt_topic = "smart-egg-incubator/cam/frame/7x9Qz2pL4mK8wR5v";

FirebaseData fbdo;
FirebaseData stream;
WiFiClient espClient;
PubSubClient mqttClient(espClient);
FirebaseAuth auth;
FirebaseConfig config;

bool flashState = false;
bool streamActive = false;
bool captureRequested = false;
int currentResolution = 5; // FRAMESIZE_QVGA default
unsigned long lastFrameTime = 0;
// We now calculate frame delay dynamically in loop() based on resolution

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("[MQTT] Attempting connection to Mosquitto...");
    // Use a STATIC client ID so that if the ESP32 reconnects, Mosquitto instantly kills 
    // the old ghost connection and SUPPRESSES its Last Will (preventing false 'offline' messages).
    String clientId = "ESP32Cam-Incubator-Master";
    
    // Connect with Last Will and Testament
    // topic: smart-egg-incubator/cam/status, QoS: 1, retain: true, message: "offline"
    if (mqttClient.connect(clientId.c_str(), NULL, NULL, "smart-egg-incubator/cam/status", 1, true, "offline")) {
      Serial.println("connected!");
      
      // Publish "online" when connected, with retain=true
      mqttClient.publish("smart-egg-incubator/cam/status", "online", true);
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void streamCallback(FirebaseStream data) {
  if (data.dataType() == "json") {
    FirebaseJson json;
    FirebaseJsonData jsonData;
    json.setJsonData(data.jsonString());
    
    // flash
    if (json.get(jsonData, "flash")) {
      flashState = jsonData.boolValue;
      digitalWrite(LED_GPIO_NUM, flashState ? HIGH : LOW);
      Serial.printf("[FIREBASE] Flash set to: %s\n", flashState ? "ON" : "OFF");
    }
    
    // stream_active
    if (json.get(jsonData, "stream_active")) {
      streamActive = jsonData.boolValue;
      Serial.printf("[FIREBASE] Stream Active set to: %s\n", streamActive ? "TRUE" : "FALSE");
    }

    // resolution
    if (json.get(jsonData, "resolution")) {
      int newRes = jsonData.intValue;
      if (newRes != currentResolution) {
        sensor_t * s = esp_camera_sensor_get();
        if (s) {
          s->set_framesize(s, (framesize_t)newRes);
          currentResolution = newRes;
          Serial.printf("[FIREBASE] Resolution changed to: %d\n", newRes);
        }
      }
    }
    
    // capture
    if (json.get(jsonData, "capture")) {
      captureRequested = true;
      Serial.println("[FIREBASE] Capture Requested!");
    }
  } else {
      // Handle individual node updates
      String path = data.dataPath();
      if (path == "/flash") {
        flashState = data.boolData();
        digitalWrite(LED_GPIO_NUM, flashState ? HIGH : LOW);
        Serial.printf("[FIREBASE] Flash set to: %s\n", flashState ? "ON" : "OFF");
      } else if (path == "/stream_active") {
        streamActive = data.boolData();
        Serial.printf("[FIREBASE] Stream Active set to: %s\n", streamActive ? "TRUE" : "FALSE");
      } else if (path == "/resolution") {
        int newRes = data.intData();
        if (newRes != currentResolution) {
          sensor_t * s = esp_camera_sensor_get();
          if (s) {
            s->set_framesize(s, (framesize_t)newRes);
            currentResolution = newRes;
            Serial.printf("[FIREBASE] Resolution changed to: %d\n", newRes);
          }
        }
      } else if (path == "/capture") {
        captureRequested = true;
        Serial.println("[FIREBASE] Capture Requested!");
      }
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) {
    Serial.println("[FIREBASE] Stream timeout, reconnecting...");
  }
}

void streamVideoToMQTT() {
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) {
        Serial.println("[CAMERA] Gagal mengambil frame!");
        return;
    }
    
    // Publish binary JPEG buffer to MQTT broker
    if (fb->len > 20000) {
        Serial.printf("[MQTT] Frame too large (%d bytes) for 20KB buffer. Please lower resolution!\n", fb->len);
    } else {
        if (!mqttClient.publish(mqtt_topic, fb->buf, fb->len)) {
            Serial.println("[MQTT] Gagal mengirim frame!");
        }
    }
    
    esp_camera_fb_return(fb);
}

void setup() {
    Serial.begin(115200);
    Serial.setDebugOutput(true);
    Serial.println();

    for (int i = 3; i > 0; i--) {
        delay(1000);
    }

    Serial.println("\n========================================================");
    Serial.println("  [★] SYSTEM START: AI-THINKER ESP32-CAM FIREBASE [★] ");
    Serial.println("========================================================");

    pinMode(LED_GPIO_NUM, OUTPUT);
    digitalWrite(LED_GPIO_NUM, LOW);
    pinMode(RED_LED_GPIO_NUM, OUTPUT);
    digitalWrite(RED_LED_GPIO_NUM, HIGH);

    camera_config_t cam_config;
    cam_config.ledc_channel = LEDC_CHANNEL_0;
    cam_config.ledc_timer = LEDC_TIMER_0;
    cam_config.pin_d0 = Y2_GPIO_NUM;
    cam_config.pin_d1 = Y3_GPIO_NUM;
    cam_config.pin_d2 = Y4_GPIO_NUM;
    cam_config.pin_d3 = Y5_GPIO_NUM;
    cam_config.pin_d4 = Y6_GPIO_NUM;
    cam_config.pin_d5 = Y7_GPIO_NUM;
    cam_config.pin_d6 = Y8_GPIO_NUM;
    cam_config.pin_d7 = Y9_GPIO_NUM;
    cam_config.pin_xclk = XCLK_GPIO_NUM;
    cam_config.pin_pclk = PCLK_GPIO_NUM;
    cam_config.pin_vsync = VSYNC_GPIO_NUM;
    cam_config.pin_href = HREF_GPIO_NUM;
    cam_config.pin_sccb_sda = SIOD_GPIO_NUM;
    cam_config.pin_sccb_scl = SIOC_GPIO_NUM;
    cam_config.pin_pwdn = PWDN_GPIO_NUM;
    cam_config.pin_reset = RESET_GPIO_NUM;
    cam_config.xclk_freq_hz = 20000000; // Increased to 20MHz for higher framerate
    cam_config.pixel_format = PIXFORMAT_JPEG;
    
    if(psramFound()){
        Serial.println("[CAMERA] PSRAM Terdeteksi, namun membatasi ke QVGA untuk MQTT RAM...");
        cam_config.frame_size = FRAMESIZE_QVGA;
        cam_config.jpeg_quality = 12;
        cam_config.fb_count = 2;
    } else {
        Serial.println("[CAMERA] PSRAM TIDAK Terdeteksi!");
        cam_config.frame_size = FRAMESIZE_QVGA;
        cam_config.jpeg_quality = 15;
        cam_config.fb_count = 1;
    }

    esp_err_t err = esp_camera_init(&cam_config);
    if (err != ESP_OK) {
        Serial.printf("[CAMERA] Gagal menginisialisasi kamera! Error: 0x%x\n", err);
        return;
    }
    
    sensor_t * s = esp_camera_sensor_get();
    if (s != NULL) {
        s->set_vflip(s, 1);
        s->set_hmirror(s, 1);
    }

    Serial.printf("[WIFI] Mencoba terhubung ke SSID: %s\n", ssid);
    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print("●");
        digitalWrite(RED_LED_GPIO_NUM, !digitalRead(RED_LED_GPIO_NUM));
    }
    digitalWrite(RED_LED_GPIO_NUM, LOW);
    Serial.println("\n[WIFI] Wi-Fi Terhubung!");

    // Firebase Setup
    config.api_key = API_KEY;
    config.database_url = DATABASE_URL;
    config.signer.test_mode = true;
    
    // Reduce SSL Buffer sizes so it doesn't crash on init
    fbdo.setBSSLBufferSize(4096, 1024);
    fbdo.setResponseSize(1024);
    
    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);

    // Firebase online status has been migrated to MQTT LWT for instant offline detection
    
    // The listener stream needs at least 4096 bytes to survive the TLS handshake
    // so we let it use the library defaults.
    if (!Firebase.RTDB.beginStream(&stream, "/camera/controls")) {
        Serial.printf("[FIREBASE] Stream error: %s\n", stream.errorReason().c_str());
    }
    Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);
    
    // Connect to MQTT Server
    Serial.println("[MQTT] Setting up Mosquitto connection...");
    mqttClient.setServer(mqtt_server, mqtt_port);
    // Lower buffer to 20KB to prevent out-of-memory crashes on ESP32
    mqttClient.setBufferSize(20480); 

    Serial.println("[SYSTEM] Sistem Siap!");
}

void loop() {
    if (!mqttClient.connected()) {
        reconnectMQTT();
    }
    mqttClient.loop();
    
    if (Firebase.isTokenExpired()) {
        Firebase.refreshToken(&config);
        Serial.println("[FIREBASE] Token refreshed");
    }

    unsigned long currentMillis = millis();

    // Dynamically adjust the framerate cap based on resolution to prevent Wi-Fi congestion
    int dynamicFrameDelay = 33; // Default ~30 FPS
    if (currentResolution < 5) {
        dynamicFrameDelay = 16; // ~60 FPS for QQVGA (and smaller)
    } else if (currentResolution == 5) {
        dynamicFrameDelay = 33; // ~30 FPS for QVGA
    } else {
        dynamicFrameDelay = 66; // ~15 FPS for VGA and higher to prevent crashes
    }

    // Normal streaming using MQTT at higher FPS
    if (streamActive) {
        if (currentMillis - lastFrameTime >= dynamicFrameDelay) {
            lastFrameTime = currentMillis;
            streamVideoToMQTT();
        }
    }

    // Manual capture functionality
    if (captureRequested) {
        captureRequested = false;
        Serial.println("[CAMERA] Manual Capture Triggered!");
        streamVideoToMQTT(); // just push the frame
    }
}
