import { RefObject, useCallback, useEffect, useState } from 'react';

export function sendYtCommand(
  iframe: HTMLIFrameElement | null,
  func: string,
  args: unknown[] = []
) {
  iframe?.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func, args }),
    '*'
  );
}

export function initYtListening(iframe: HTMLIFrameElement | null) {
  const win = iframe?.contentWindow;
  if (!win) return;
  win.postMessage(JSON.stringify({ event: 'listening', id: 'maranata' }), '*');
  win.postMessage(
    JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }),
    '*'
  );
}

export function formatVideoTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  }
  return `${mins}:${rem.toString().padStart(2, '0')}`;
}

export function useYouTubeProgress(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  resetKey: string
) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [resetKey]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        !event.origin.includes('youtube.com') &&
        !event.origin.includes('youtube-nocookie.com')
      ) {
        return;
      }
      if (
        iframeRef.current?.contentWindow &&
        event.source !== iframeRef.current.contentWindow
      ) {
        return;
      }
      try {
        const data =
          typeof event.data === 'string'
            ? (JSON.parse(event.data) as {
                event?: string;
                info?: { currentTime?: number; duration?: number };
              })
            : null;
        if (data?.event === 'infoDelivery' && data.info) {
          if (typeof data.info.currentTime === 'number' && Number.isFinite(data.info.currentTime)) {
            setCurrentTime(data.info.currentTime);
          }
          if (
            typeof data.info.duration === 'number' &&
            Number.isFinite(data.info.duration) &&
            data.info.duration > 0
          ) {
            setDuration(data.info.duration);
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [iframeRef]);

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      const target = Math.max(
        0,
        duration > 0 ? Math.min(duration, currentTime + deltaSeconds) : currentTime + deltaSeconds
      );
      setCurrentTime(target);
      sendYtCommand(iframeRef.current, 'seekTo', [target, true]);
    },
    [iframeRef, currentTime, duration]
  );

  const seekTo = useCallback(
    (seconds: number) => {
      const target = Math.max(0, duration > 0 ? Math.min(duration, seconds) : seconds);
      setCurrentTime(target);
      sendYtCommand(iframeRef.current, 'seekTo', [target, true]);
    },
    [iframeRef, duration]
  );

  return {
    currentTime,
    duration,
    seekBy,
    seekTo,
    onIframeLoad: () => initYtListening(iframeRef.current),
  };
}
