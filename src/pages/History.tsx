import { useEffect, useState } from 'react';
import { ref, onValue, query, orderByKey, limitToLast, remove } from 'firebase/database';
import { db } from '../lib/firebase';
import { Trash2 } from 'lucide-react';

interface HistoryRecord {
  id: string;
  temperature: number;
  humidity: number;
  timestamp: number;
}

export function History() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const historyRef = query(ref(db, 'incubator/history'), orderByKey(), limitToLast(50));
    
    const unsubscribe = onValue(historyRef, (snapshot) => {
      setLoading(false);
      const dataObj = snapshot.val();
      if (dataObj) {
        const data = Object.keys(dataObj).map((key) => ({
          id: key,
          ...dataObj[key]
        })).reverse();
        setHistory(data);
      } else {
        setHistory([]);
      }
    }, (err) => {
      console.error(err);
      setError(true);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to clear all history? This action cannot be undone.")) {
      try {
        await remove(ref(db, 'incubator/history'));
      } catch (err) {
        console.error("Failed to clear history:", err);
        alert("Failed to clear history.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white transition-colors">History</h2>
        <button
          onClick={handleClearHistory}
          disabled={loading || history.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-500 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4" />
          Clear History
        </button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className={`w-full text-left ${history.length > 0 ? 'min-w-[500px]' : ''}`}>
          <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 transition-colors">
            <tr>
              <th className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 transition-colors">Time</th>
              <th className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 transition-colors">Temperature (°C)</th>
              <th className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 transition-colors">Humidity (%)</th>
            </tr>
          </thead>
          {history.length > 0 && (
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 transition-colors" id="historyTableBody">
              {history.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base text-gray-900 dark:text-white transition-colors">
                    {row.timestamp ? new Date(row.timestamp).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base text-gray-900 dark:text-white transition-colors">{row.temperature !== undefined && row.temperature !== null ? Number(row.temperature).toFixed(2) : '-'}</td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm sm:text-base text-gray-900 dark:text-white transition-colors">{row.humidity !== undefined && row.humidity !== null ? Number(row.humidity).toFixed(2) : '-'}</td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
        </div>
        
        {loading && (
          <div className="px-4 py-12 text-center text-gray-500">Loading history...</div>
        )}
        {!loading && error && (
          <div className="px-4 py-12 text-center text-red-500">Failed to load from Firebase.</div>
        )}
        {!loading && !error && history.length === 0 && (
          <div className="px-4 py-12 text-center text-gray-500">No history data available.</div>
        )}
      </div>
    </div>
  );
}
