import { useEffect, useState, useRef } from "react";
import { ref, onValue, set } from "firebase/database";
import { db } from "../lib/firebase";
import { Camera, Zap, Maximize2, Settings, Focus } from "lucide-react";
import mqtt from "mqtt";

export function LiveCam() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [resolution, setResolution] = useState(5);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mqttClientRef = useRef<mqtt.MqttClient | null>(null);

  useEffect(() => {
    // Force the ESP32 to permanently stream by updating Firebase
    set(ref(db, "camera/controls/stream_active"), true);
  }, []);

  useEffect(() => {
    const client = mqttClientRef.current;
    if (client && client.connected) {
      client.subscribe("smart-egg-incubator/cam/frame/7x9Qz2pL4mK8wR5v");
    }
  }, []);

  useEffect(() => {
    // Unconditional MQTT connection for LWT status and frames
    const client = mqtt.connect("wss://test.mosquitto.org:8081/mqtt");
    mqttClientRef.current = client;

    let statusTimeout: NodeJS.Timeout;

    client.on("connect", () => {
      console.log("Connected to Mosquitto Public Broker");
      client.subscribe("smart-egg-incubator/cam/status");
      client.subscribe("smart-egg-incubator/cam/frame/7x9Qz2pL4mK8wR5v");

      // If no status message is received within 3 seconds, assume offline
      // (Mosquitto public broker often drops retained messages)
      statusTimeout = setTimeout(() => {
        setIsOnline((prev) => (prev === null ? false : prev));
      }, 3000);
    });

    client.on("message", (topic, message) => {
      if (topic === "smart-egg-incubator/cam/status") {
        setIsOnline(message.toString() === "online");
      } else if (topic === "smart-egg-incubator/cam/frame/7x9Qz2pL4mK8wR5v") {
        const blob = new Blob([new Uint8Array(message)], {
          type: "image/jpeg",
        });
        const url = URL.createObjectURL(blob);

        setFrameUrl((prevUrl) => {
          if (prevUrl) URL.revokeObjectURL(prevUrl);
          return url;
        });
      }
    });

    client.on("error", (err) => {
      console.error("MQTT Error: ", err);
    });

    const controlsRef = ref(db, "camera/controls");
    const unsubscribeControls = onValue(controlsRef, (snapshot) => {
      const controls = snapshot.val();
      if (controls) {
        if (controls.flash !== undefined) setIsFlashOn(controls.flash);
        if (controls.resolution !== undefined)
          setResolution(controls.resolution);
      }
    });

    return () => {
      clearTimeout(statusTimeout);
      unsubscribeControls();
      client.end();
      setFrameUrl((prevUrl) => {
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        return null;
      });
    };
  }, []);

  const toggleFlash = () => {
    set(ref(db, "camera/controls/flash"), !isFlashOn);
  };

  const handleCapture = () => {
    if (!frameUrl) {
      alert("No stream active to capture a photo!");
      return;
    }

    // Trigger a browser download of the current active frame
    const link = document.createElement("a");
    link.href = frameUrl;
    link.download = `incubator-cam-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Optional: Visual feedback
    set(ref(db, "camera/controls/flash"), true);
    setTimeout(() => set(ref(db, "camera/controls/flash"), isFlashOn), 200);
  };

  const changeResolution = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value);
    set(ref(db, "camera/controls/resolution"), val);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err.message);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <p className="text-gray-600 dark:text-gray-400 mt-1 transition-colors">
            Live video stream and remote controls
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors">
          <div className="relative flex h-3 w-3">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? "bg-green-400 animate-ping" : "bg-red-400"}`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${isOnline ? "bg-green-500" : "bg-red-500"}`}
            ></span>
          </div>
          <span
            className={`font-semibold tracking-wide ${isOnline ? "text-green-400" : isOnline === null ? "text-yellow-400" : "text-gray-400"}`}
          >
            {isOnline === null
              ? "CONNECTING..."
              : isOnline
                ? "ONLINE"
                : "OFFLINE"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div
            ref={containerRef}
            className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-2xl relative group min-h-[300px] md:min-h-[500px] flex items-center justify-center bg-stripes bg-stripes-gray-200 dark:bg-stripes-gray-700 transition-colors"
          >
            {frameUrl ? (
              <img
                src={frameUrl}
                alt="ESP32-CAM Stream"
                className={`w-full h-full object-contain ${isFullscreen ? "max-h-screen" : "max-h-[70vh]"}`}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 transition-colors">
                <Camera className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">
                  {isOnline
                    ? "Waiting for camera stream..."
                    : "Camera is offline"}
                </p>
              </div>
            )}

            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={toggleFullscreen}
                className="p-2 bg-black/50 hover:bg-black/80 backdrop-blur-md rounded-lg text-white transition-all"
                title="Toggle Fullscreen"
              >
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>

            {frameUrl && (
              <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <span className="text-xs font-mono text-white tracking-wider">
                  LIVE
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2 transition-colors">
              <Settings className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              Camera Controls
            </h3>

            <div className="space-y-3">
              <button
                onClick={toggleFlash}
                disabled={!isOnline}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all border ${
                  !isOnline
                    ? "bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    : isFlashOn
                      ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-600 dark:text-yellow-500 hover:bg-yellow-500/30"
                      : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600"
                }`}
              >
                <Zap className="w-5 h-5" />
                {isFlashOn ? "Turn Flash Off" : "Turn Flash On"}
              </button>

              <button
                onClick={handleCapture}
                disabled={!isOnline || !frameUrl}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all border ${
                  !isOnline || !frameUrl
                    ? "bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 active:scale-95"
                }`}
              >
                <Focus className="w-5 h-5" />
                Capture Photo
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 transition-colors">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 transition-colors">
                Resolution
              </label>
              <select
                value={resolution}
                onChange={changeResolution}
                disabled={!isOnline}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
              >
                <option value="9">SVGA (800x600)</option>
                <option value="8">VGA (640x480)</option>
                <option value="6">CIF (400x296)</option>
                <option value="5">QVGA (320x240 - Default)</option>
                <option value="4">HQVGA (240x176)</option>
                <option value="3">QQVGA (160x120)</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                * Note: Changing resolution may momentarily freeze the stream.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
