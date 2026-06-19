import { useEffect, useState, useRef } from "react";
import { ref, onValue, set } from "firebase/database";
import { db } from "../lib/firebase";
import {
  Thermometer,
  Droplets,
  Zap,
  Flame,
  Wifi,
  RotateCw,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface SensorData {
  temperature: number;
  humidity: number;
  uptime: number;
  signalStrength: number;
  ip?: string;
  sht31: string;
  led: boolean;
  fan: boolean;
  door: string;
  heaterState: boolean;
  heaterMaster: boolean;
}

interface ChartDataPoint {
  time: string;
  temperature: number;
  humidity: number;
}

export function Dashboard() {
  const [data, setData] = useState<SensorData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const dataRef = useRef<SensorData | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const isConnectedRef = useRef(false);

  const [flashOn, setFlashOn] = useState(false);
  const [heaterOn, setHeaterOn] = useState(true);

  const [chartData, setChartData] = useState<ChartDataPoint[]>(() => {
    const initial: ChartDataPoint[] = [];
    const now = Date.now();
    for (let i = 19; i >= 0; i--) {
      initial.push({
        time: new Date(now - i * 3000).toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        temperature: 0,
        humidity: 0,
      });
    }
    return initial;
  });

  const [motorInterval, setMotorInterval] = useState("30");
  const [isTriggering, setIsTriggering] = useState(false);

  useEffect(() => {
    // Subscribe to sensors
    const sensorRef = ref(db, "incubator/sensors");
    const unsubscribeSensors = onValue(sensorRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        if (dataRef.current === null) {
          // First payload (cached or initial fetch)
          // We store it but don't trust it's online until we see it change!
          dataRef.current = val;
        } else if (val.uptime !== dataRef.current.uptime) {
          // Data is actively changing, device is definitely online
          dataRef.current = val;
          setData(val);
          lastUpdateRef.current = Date.now();
          if (!isConnectedRef.current) {
            setIsConnected(true);
            isConnectedRef.current = true;
          }

          // Update chart
          const timeStr = new Date().toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          setChartData((prev) => {
            const newData = [
              ...prev,
              {
                time: timeStr,
                temperature: val.temperature || 0,
                humidity: val.humidity || 0,
              },
            ];
            if (newData.length > 20) newData.shift();
            return newData;
          });
        }
      }
    });

    // Connection timeout monitor
    const connectionMonitor = setInterval(() => {
      if (isConnectedRef.current && Date.now() - lastUpdateRef.current > 5000) {
        // Device is offline
        setIsConnected(false);
        isConnectedRef.current = false;
        
        // Clear data


        setData(null);
        dataRef.current = null;
      }
    }, 1000);

    // Subscribe to camera flash control
    const flashRef = ref(db, "camera/controls/flash");
    const unsubscribeFlash = onValue(flashRef, (snapshot) => {
      const val = snapshot.val();
      if (val !== null) setFlashOn(val);
    });

    // Subscribe to heater control
    const heaterRef = ref(db, "incubator/controls/heater");
    const unsubscribeHeater = onValue(heaterRef, (snapshot) => {
      const val = snapshot.val();
      if (val !== null) setHeaterOn(val === 1);
    });

    // Subscribe to motor interval
    const motorIntRef = ref(db, "incubator/controls/motorInterval");
    const unsubscribeMotor = onValue(motorIntRef, (snapshot) => {
      const val = snapshot.val();
      if (val !== null) setMotorInterval(String(val));
    });

    return () => {
      clearInterval(connectionMonitor);
      unsubscribeSensors();
      unsubscribeFlash();
      unsubscribeHeater();
      unsubscribeMotor();
    };
  }, []);

  const toggleFlash = () => {
    set(ref(db, "camera/controls/flash"), !flashOn);
  };

  const toggleHeater = () => {
    set(ref(db, "incubator/controls/heater"), !heaterOn ? 1 : 0);
  };

  const handleSetInterval = () => {
    const min = parseInt(motorInterval, 10);
    if (!isNaN(min) && min >= 1) {
      set(ref(db, "incubator/controls/motorInterval"), min)
        .then(() => alert(`Motor interval set to ${min} minutes!`))
        .catch((err) => alert(`Failed to set interval: ${err.message}`));
    } else {
      alert("Please enter a valid interval in minutes (>= 1)");
    }
  };

  const handleTriggerMotor = () => {
    setIsTriggering(true);
    // Write a random positive integer to ensure Firebase triggers an update event
    // even if the ESP32 failed to reset it to 0 previously.
    const triggerValue = Math.floor(Math.random() * 100000) + 1;
    set(ref(db, "incubator/controls/motor"), triggerValue)
      .then(() => {
        setTimeout(() => setIsTriggering(false), 1500);
      })
      .catch((err) => {
        alert(`Failed to trigger motor: ${err.message}`);
        setIsTriggering(false);
      });
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const calculateStats = (key: "temperature" | "humidity") => {
    if (chartData.length === 0)
      return { min: "0.0", max: "0.0", avg: "0.0" };
    const values = chartData.map((d) => d[key]);
    const min = Math.min(...values).toFixed(1);
    const max = Math.max(...values).toFixed(1);
    const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
    return { min, max, avg };
  };

  const tempStats = calculateStats("temperature");
  const humStats = calculateStats("humidity");

  const tempVal = data?.temperature || 0;
  const tempTrend = tempVal > 24 ? "↑" : "↓";
  const tempTrendColor = tempVal > 24 ? "text-green-400" : "text-red-400";
  const tempStatusBg =
    tempVal > 26
      ? "bg-yellow-500/10 text-yellow-500"
      : "bg-green-500/10 text-green-500";

  return (
    <div className="space-y-6">
      {/* Device Status */}
      <div className="mb-4 lg:mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white transition-colors">ESP32 DevKit v1</h3>
            {isConnected ? (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-green-500/20 text-green-400">
                <Wifi className="w-4 h-4" />
                Connected
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-red-500/20 text-red-400">
                <Wifi className="w-4 h-4" />
                Disconnected
              </div>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap transition-colors">
                IP Address:
              </span>
              <span className="font-mono text-gray-900 dark:text-white truncate transition-colors">
                {isConnected && data?.ip ? data.ip : "Unavailable"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400 transition-colors">Uptime:</span>
              <span className="text-gray-900 dark:text-white transition-colors">
                {isConnected && data ? formatUptime(data.uptime) : "--"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400 transition-colors">Signal:</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden transition-colors">
                  <div
                    className={`h-full transition-colors ${isConnected ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}
                    style={{ width: `${isConnected ? data?.signalStrength || 0 : 0}%` }}
                  ></div>
                </div>
                <span className="text-gray-900 dark:text-white transition-colors">{isConnected ? data?.signalStrength || 0 : 0}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sensor Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 mb-4 lg:mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-lg ${tempStatusBg}`}>
              <Thermometer className="w-6 h-6" />
            </div>
            <div className={`text-base font-bold ${tempTrendColor}`}>
              {tempTrend}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors">Temperature</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold text-gray-900 dark:text-white transition-colors">
                {tempVal.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 transition-colors">°C</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg bg-green-500/10 text-green-500">
              <Droplets className="w-6 h-6" />
            </div>
            <div className="text-base font-bold text-gray-400 dark:text-gray-500 transition-colors">→</div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors">Humidity</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold text-gray-900 dark:text-white transition-colors">
                {(data?.humidity || 0).toFixed(0)}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 transition-colors">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-4 lg:mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white transition-colors">Temperature Chart</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 transition-colors">
              <span>
                Min: <strong className="text-gray-900 dark:text-white transition-colors">{tempStats.min}</strong>
              </span>
              <span>
                Max: <strong className="text-gray-900 dark:text-white transition-colors">{tempStats.max}</strong>
              </span>
              <span>
                Avg: <strong className="text-gray-900 dark:text-white transition-colors">{tempStats.avg}</strong>
              </span>
            </div>
          </div>
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(75, 85, 99, 0.2)"
                />
                <XAxis
                  dataKey="time"
                  stroke="rgb(156, 163, 175)"
                  tick={{ fill: "rgb(156, 163, 175)" }}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="rgb(156, 163, 175)"
                  tick={{ fill: "rgb(156, 163, 175)" }}
                />
                <Tooltip
                  formatter={(value: number) => value.toFixed(2)}
                  contentStyle={{
                    backgroundColor: "rgb(31, 41, 55)",
                    borderColor: "rgb(55, 65, 81)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="temperature"
                  stroke="rgb(239, 68, 68)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white transition-colors">Humidity Chart</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 transition-colors">
              <span>
                Min: <strong className="text-gray-900 dark:text-white transition-colors">{humStats.min}</strong>
              </span>
              <span>
                Max: <strong className="text-gray-900 dark:text-white transition-colors">{humStats.max}</strong>
              </span>
              <span>
                Avg: <strong className="text-gray-900 dark:text-white transition-colors">{humStats.avg}</strong>
              </span>
            </div>
          </div>
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(75, 85, 99, 0.2)"
                />
                <XAxis
                  dataKey="time"
                  stroke="rgb(156, 163, 175)"
                  tick={{ fill: "rgb(156, 163, 175)" }}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="rgb(156, 163, 175)"
                  tick={{ fill: "rgb(156, 163, 175)" }}
                />
                <Tooltip
                  formatter={(value: number) => value.toFixed(2)}
                  contentStyle={{
                    backgroundColor: "rgb(31, 41, 55)",
                    borderColor: "rgb(55, 65, 81)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="humidity"
                  stroke="rgb(59, 130, 246)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-4 lg:mb-8">
        {/* Device Control */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 transition-colors">Device Control</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg transition-colors border border-gray-100 dark:border-transparent">
              <div className="flex items-center gap-3">
                <Zap
                  className={`w-5 h-5 ${flashOn ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`}
                />
                <span className="text-sm text-gray-900 dark:text-white transition-colors">Camera Flash</span>
              </div>
              <button
                onClick={toggleFlash}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${flashOn ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${flashOn ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg transition-colors border border-gray-100 dark:border-transparent">
              <div className="flex items-center gap-3">
                <Flame
                  className={`w-5 h-5 ${heaterOn ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`}
                />
                <span className="text-sm text-gray-900 dark:text-white transition-colors">Heater (Auto)</span>
              </div>
              <button
                onClick={toggleHeater}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${heaterOn ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${heaterOn ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Motor Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 transition-colors">Motor Configuration</h3>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
            Motor Interval (Minutes)
          </label>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              type="number"
              value={motorInterval}
              onChange={(e) => setMotorInterval(e.target.value)}
              min="1"
              className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Interval (min)"
            />
            <button
              onClick={handleSetInterval}
              className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Save
            </button>
          </div>

          <hr className="border-gray-200 dark:border-gray-700 my-6 transition-colors" />

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
            Manual Override
          </label>
          <button
            onClick={handleTriggerMotor}
            disabled={isTriggering}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-70"
          >
            {isTriggering ? (
              <Loader2 className="w-5 h-5 shrink-0 animate-spin" />
            ) : (
              <RotateCw className="w-5 h-5 shrink-0" />
            )}
            <span className="whitespace-nowrap">
              {isTriggering ? "Triggering..." : "Trigger Motor Now"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
