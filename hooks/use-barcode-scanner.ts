'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeScanner {
  onScan: (barcode: string) => void;
  enabled?: boolean;
}

export function useBarcodeScanner({ onScan, enabled = true }: UseBarcodeScanner) {
  const buffer = useRef('');
  const lastKeyTime = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if user is typing in an input field (except for Enter key processing)
      const target = event.target as HTMLElement;
      const isInputField = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime.current;

      // If more than 100ms has passed, this is likely a new scan or manual typing
      if (timeDiff > 100) {
        buffer.current = '';
      }

      lastKeyTime.current = currentTime;

      if (event.key === 'Enter') {
        if (buffer.current.length >= 3) {
          // Prevent form submission if we're processing a barcode
          event.preventDefault();
          onScan(buffer.current);
        }
        buffer.current = '';
        return;
      }

      // Only accumulate alphanumeric characters
      if (event.key.length === 1 && /[a-zA-Z0-9]/.test(event.key)) {
        // If typing in input field, only capture if input is fast (scanner-like)
        if (isInputField && timeDiff > 50) {
          buffer.current = '';
          return;
        }
        
        buffer.current += event.key;
      }

      // Clear buffer after timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        buffer.current = '';
      }, 200);
    },
    [onScan, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleKeyDown, enabled]);

  return {
    clearBuffer: () => {
      buffer.current = '';
    },
  };
}
