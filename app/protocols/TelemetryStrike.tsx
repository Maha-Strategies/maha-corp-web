'use client';
import { useEffect } from 'react';

export default function TelemetryStrike({ endpoint, wordCount }: { endpoint: string, wordCount: string }) {
  useEffect(() => {
    const logTelemetry = async () => {
      try {
        await fetch('/api/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: endpoint,
            agent: navigator.userAgent,
            payload_size: wordCount,
            status: '200 OK'
          }),
        });
      } catch (error) {
        console.error('[TELEMETRY ERROR] Ground Station link failed:', error);
      }
    };
    logTelemetry();
  }, [endpoint, wordCount]);

  return null; 
}