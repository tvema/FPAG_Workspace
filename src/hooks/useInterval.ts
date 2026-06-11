import { useEffect, useRef } from 'react';

export function useInterval(callback: () => void | Promise<void>, delay: number | null) {
  const savedCallback = useRef(callback);
  const isRunning = useRef(false);

  useEffect(() => { savedCallback.current = callback; }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    
    let timeoutId: ReturnType<typeof setTimeout>;
    let isMounted = true;
    
    const tick = async () => {
      if (!isMounted) return;
      if (!isRunning.current) {
        isRunning.current = true;
        try {
          await savedCallback.current();
        } finally {
          isRunning.current = false;
        }
      }
      if (isMounted) {
        timeoutId = setTimeout(tick, delay);
      }
    };
    
    timeoutId = setTimeout(tick, delay);
    
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [delay]);
}
