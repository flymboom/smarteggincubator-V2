import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase';
import { Thermometer, DoorClosed, Lightbulb, Flame } from 'lucide-react';

interface SensorData {
  sht31: string;
  door: string;
  led: boolean;
  heaterState: boolean;
}

export function SystemStatus() {
  const [data, setData] = useState<SensorData | null>(null);

  useEffect(() => {
    const sensorRef = ref(db, 'incubator/sensors');
    const unsubscribe = onValue(sensorRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        setData(val);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden overflow-x-auto transition-colors">
        <table className="w-full text-left min-w-[300px]">
          <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 transition-colors">
            <tr>
              <th className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 transition-colors">Component</th>
              <th className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 transition-colors">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 transition-colors">
            <tr className="hover:bg-gray-50 dark:hover:bg-transparent transition-colors">
              <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3 transition-colors">
                <Thermometer className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-colors" />
                SHT31 Sensor
              </td>
              <td className="px-4 sm:px-6 py-3 sm:py-4">
                {data?.sht31 === 'Connected' ? (
                  <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">Connected</span>
                ) : (
                  <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500">Disconnected</span>
                )}
              </td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-transparent transition-colors">
              <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3 transition-colors">
                <DoorClosed className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-colors" />
                Door Status
              </td>
              <td className="px-4 sm:px-6 py-3 sm:py-4">
                {data?.door === 'Open' ? (
                  <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500">Open</span>
                ) : (
                  <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">Closed</span>
                )}
              </td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-transparent transition-colors">
              <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3 transition-colors">
                <Lightbulb className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-colors" />
                Light Bulb
              </td>
              <td className="px-4 sm:px-6 py-3 sm:py-4">
                {data?.led ? (
                  <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500">On</span>
                ) : (
                  <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">Off</span>
                )}
              </td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-transparent transition-colors">
              <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3 transition-colors">
                <Flame className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-colors" />
                Heater Status
              </td>
              <td className="px-4 sm:px-6 py-3 sm:py-4">
                {data?.heaterState ? (
                  <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-500">Heating</span>
                ) : (
                  <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">Off</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
