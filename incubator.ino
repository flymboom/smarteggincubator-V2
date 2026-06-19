#include <WiFi.h>
#include <ArduinoOTA.h>
#include <Wire.h>
#include <Adafruit_SHT31.h>
#include <Firebase_ESP_Client.h>

// Provide the token generation process info.
#include "addons/TokenHelper.h"
// Provide the RTDB payload printing info and other helper functions.
#include "addons/RTDBHelper.h"

const char* ssid = "ajeng";
const char* password = "1234567890";

#define API_KEY "AIzaSyB31u_oDgwW7fNTq0VvU0PXIEXhdfZpcbg"
#define DATABASE_URL "smart-egg-incubator-e011f-default-rtdb.asia-southeast1.firebasedatabase.app" 

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
FirebaseData stream;

Adafruit_SHT31 sht31 = Adafruit_SHT31();

bool ledState = true;
bool fanState = false;
bool relay1State = false;
bool relay2State = false;
bool heaterMasterEnable = true;
bool heaterState = true;

const int LDR_PIN = 34;
const int HEATER_PIN = 25;
const int MOTOR_DC_PIN = 23;
const int LED_EKSTERNAL_PIN = 14;

unsigned long lastMotorMillis = 0;
unsigned long motorTurnOnMillis = 0;
unsigned long motorInterval = 3600000; // 1 Jam default
const unsigned long motorDuration = 10000;    // 6 detik
bool motorAutoActive = false;
bool motorState = false;
bool resetMotorFlag = false;

float currentTemp = 0.0;
float currentHum = 0.0;

unsigned long lastLdrTime = 0;
unsigned long lastSendTime = 0;

void streamCallback(FirebaseStream data) {
  Serial.printf("stream path, %s\nevent path, %s\ndata type, %s\nevent type, %s\n\n",
                data.streamPath().c_str(),
                data.dataPath().c_str(),
                data.dataType().c_str(),
                data.eventType().c_str());

  String type = data.dataType();
  if (type == "int" || type == "float" || type == "double") {
    String path = data.dataPath();
    int state = data.intData();

    if (path == "/led") {
      ledState = (state == 1);
      digitalWrite(LED_EKSTERNAL_PIN, ledState ? HIGH : LOW);
      Serial.println(ledState ? "LED ON" : "LED OFF");
    } else if (path == "/heater") {
      heaterMasterEnable = (state == 1);
      if (!heaterMasterEnable) {
        heaterState = false;
        digitalWrite(HEATER_PIN, LOW);
      }
      Serial.println(heaterMasterEnable ? "Heater Auto ON" : "Heater Auto OFF");
    } else if (path == "/motorInterval") {
      motorInterval = (unsigned long)state * 60000; // convert minutes to ms
      Serial.printf("Motor interval changed to %lu ms\n", motorInterval);
    } else if (path == "/motor") {
      if (state > 0) {
        motorState = true;
        motorAutoActive = true;
        motorTurnOnMillis = millis();
        digitalWrite(MOTOR_DC_PIN, LOW); // Active LOW -> Motor ON
        Serial.println("Motor TRIGGERED manually");
        // Set flag to reset the button in loop() to avoid blocking stream callback
        resetMotorFlag = true;
      }
    }
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout)
    Serial.println("stream timed out, resuming...\n");
  if (!stream.httpConnected())
    Serial.printf("error resume stream, %s\n\n", stream.errorReason().c_str());
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_EKSTERNAL_PIN, OUTPUT);
  digitalWrite(LED_EKSTERNAL_PIN, LOW);
  
  pinMode(MOTOR_DC_PIN, OUTPUT);
  digitalWrite(MOTOR_DC_PIN, HIGH); 
  
  pinMode(LDR_PIN, INPUT);
  
  pinMode(HEATER_PIN, OUTPUT);
  digitalWrite(HEATER_PIN, LOW); 
  
  if (! sht31.begin(0x44)) { 
    Serial.println("Couldn't find SHT31");
  } else {
    Serial.println("SHT31 Found!");
  }

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connected to WiFi. IP Address: ");
  Serial.println(WiFi.localIP());

  ArduinoOTA.begin();

  // Firebase Setup
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  
  // Use test mode so we don't need to configure Email/Password or Anonymous Auth in Firebase Console
  config.signer.test_mode = true;
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  if (!Firebase.RTDB.beginStream(&stream, "/incubator/controls")) {
    Serial.printf("stream begin error, %s\n\n", stream.errorReason().c_str());
  }
  Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);
}

void loop() {
  ArduinoOTA.handle();
  
  unsigned long currentMillis = millis();

  if (resetMotorFlag) {
    resetMotorFlag = false;
    Firebase.RTDB.setInt(&fbdo, "/incubator/controls/motor", 0);
  }

  // Send Sensor Update Every 1 Second
  if (currentMillis - lastSendTime >= 1000) {
    lastSendTime = currentMillis;

    // Use a JSON object to push all data at once to save overhead
    FirebaseJson json;
    json.set("temperature", isnan(currentTemp) ? 0.0 : currentTemp);
    json.set("humidity", isnan(currentHum) ? 0.0 : currentHum);
    json.set("uptime", currentMillis / 1000);
    
    int rssi = WiFi.RSSI();
    int signalPercent = 0;
    if (rssi >= -50) signalPercent = 100;
    else if (rssi <= -100) signalPercent = 0;
    else signalPercent = 2 * (rssi + 100);
    json.set("signalStrength", signalPercent);
    
    json.set("ip", WiFi.localIP().toString());
    json.set("sht31", isnan(currentTemp) ? "disconnected" : "connected");
    json.set("led", ledState);
    json.set("fan", fanState);
    json.set("relay1", relay1State);
    json.set("relay2", relay2State);
    
    int ldrValue = analogRead(LDR_PIN);
    json.set("door", (ldrValue <= 3500) ? "opened" : "closed");
    
    json.set("heaterMaster", heaterMasterEnable);
    json.set("heaterState", heaterState);
    json.set("motor", motorState);

    // Set data in Firebase
    if (!Firebase.RTDB.setJSON(&fbdo, "/incubator/sensors", &json)) {
       Serial.printf("Error setting sensors: %s\n", fbdo.errorReason().c_str());
    }
  }

  // Motor Auto Timer Logic
  if (currentMillis - lastMotorMillis >= motorInterval) {
    lastMotorMillis = currentMillis;
    motorState = true;
    motorAutoActive = true;
    motorTurnOnMillis = currentMillis;
    digitalWrite(MOTOR_DC_PIN, LOW); // Active LOW -> Motor ON
  }

  if (motorAutoActive && (currentMillis - motorTurnOnMillis >= motorDuration)) {
    motorState = false;
    motorAutoActive = false;
    digitalWrite(MOTOR_DC_PIN, HIGH); // Motor OFF
  }

  // LDR Auto LED Logic
  int ldrRaw = analogRead(LDR_PIN);
  if (ldrRaw <= 3250) { // Pintu terbuka (terang)
    if (!ledState) {
      ledState = true;
      digitalWrite(LED_EKSTERNAL_PIN, HIGH);
    }
  } else {
    if (ledState) {
      ledState = false;
      digitalWrite(LED_EKSTERNAL_PIN, LOW);
    }
  }
  
  // Read Sensors every 1 second
  if (currentMillis - lastLdrTime >= 1000) {
    lastLdrTime = currentMillis;
    
    currentTemp = sht31.readTemperature();
    currentHum = sht31.readHumidity();

    if (!isnan(currentTemp)) {
      if (heaterMasterEnable) {
        if (currentTemp >= 38.0) {
          heaterState = false;
        } else if (currentTemp < 38.0) {
          heaterState = true;
        }
      } else {
        heaterState = false;
      }
      digitalWrite(HEATER_PIN, heaterState ? HIGH : LOW);
    }
  }
}
