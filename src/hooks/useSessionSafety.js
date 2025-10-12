import { useEffect, useRef } from 'react';

export function useSessionTimeout(onTimeout, timeoutMinutes = 30) {
  const lastActivityRef = useRef(Date.now());
  const timeoutRef = useRef(null);

  useEffect(() => {
    const resetTimeout = () => {
      lastActivityRef.current = Date.now();
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        console.warn('Session timeout detected - triggering emergency logout');
        onTimeout();
      }, timeoutMinutes * 60 * 1000);
    };

    // Activity events to track
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    // Reset timeout on any activity
    const handleActivity = () => resetTimeout();

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Set initial timeout
    resetTimeout();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [timeoutMinutes, onTimeout]);

  // Return function to manually check if session should timeout
  const checkSessionHealth = () => {
    const timeSinceLastActivity = Date.now() - lastActivityRef.current;
    const timeoutMs = timeoutMinutes * 60 * 1000;
    
    return {
      isHealthy: timeSinceLastActivity < timeoutMs,
      timeSinceLastActivity: Math.floor(timeSinceLastActivity / 1000),
      timeoutInSeconds: timeoutMinutes * 60
    };
  };

  return { checkSessionHealth };
}

export function useInfiniteLoopDetection(onLoopDetected, maxCallsPerSecond = 10) {
  const callCountRef = useRef(0);
  const lastResetRef = useRef(Date.now());

  const trackApiCall = () => {
    const now = Date.now();
    const timeSinceReset = now - lastResetRef.current;

    // Reset counter every second
    if (timeSinceReset >= 1000) {
      callCountRef.current = 0;
      lastResetRef.current = now;
    }

    callCountRef.current++;

    // Check if we're making too many calls
    if (callCountRef.current > maxCallsPerSecond) {
      console.error(`Infinite loop detected! ${callCountRef.current} API calls in the last second`);
      onLoopDetected();
      return false; // Block the call
    }

    return true; // Allow the call
  };

  return { trackApiCall };
}