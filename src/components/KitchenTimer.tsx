import { useState, useEffect } from 'react';

export default function KitchenTimer({ sentAt }: { sentAt?: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!sentAt) return;

    const updateTimer = () => {
      setElapsed(Math.floor((Date.now() - sentAt) / 1000));
    };

    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [sentAt]);

  if (!sentAt) return null;

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  
  // Highlight red if it's been more than 15 minutes (900 seconds)
  const isLate = elapsed > 900;

  return (
    <span className={`text-sm font-bold font-mono px-2 py-1 rounded-md ${
      isLate ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-orange-900/50 text-orange-200 border border-orange-500/30'
    }`}>
      ⏱️ {m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
    </span>
  );
}
