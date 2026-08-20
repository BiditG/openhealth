"use client";

import { useRef, useCallback, useState, useEffect } from "react";

/**
 * Hook for meditation audio — ambient music + bell alarm.
 *
 * Safari PWA blocks `new Audio().play()` unless the Audio element was created
 * and had `.play()` called during a user-gesture call-stack. `warmupBell()`
 * should be called during a user interaction (e.g. when the user starts the
 * session). It creates the bell Audio, plays it silently, then pauses —
 * "unlocking" it for later programmatic playback when the timer fires.
 */
export function useMeditationAudio() {
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const bellRef = useRef<HTMLAudioElement | null>(null);
  const vibrationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [bellRinging, setBellRinging] = useState(false);

  /** Pre-create & unlock the bell audio — call during a user gesture. */
  const warmupBell = useCallback(() => {
    if (bellRef.current) return;
    const audio = new Audio("/meditation-bell.mp3");
    audio.loop = true;
    audio.volume = 0; // silent warmup
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
      })
      .catch(() => {
        // Still store it — may work on retry
      });
    bellRef.current = audio;
  }, []);

  const startMusic = useCallback(
    (volume = 0.4) => {
      if (musicRef.current) {
        musicRef.current.pause();
      }
      const audio = new Audio("/meditation-ambient.mp3");
      audio.loop = true;
      audio.volume = volume;
      audio.play().catch(() => {
        console.warn("[meditation-audio] Autoplay blocked");
      });
      musicRef.current = audio;
      setMusicPlaying(true);

      // Also warm up the bell while we have a user-gesture context
      warmupBell();
    },
    [warmupBell]
  );

  const stopMusic = useCallback(() => {
    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current.src = "";
      musicRef.current = null;
    }
    setMusicPlaying(false);
  }, []);

  const toggleMusic = useCallback(
    (volume = 0.4) => {
      if (musicPlaying) {
        stopMusic();
      } else {
        startMusic(volume);
      }
    },
    [musicPlaying, startMusic, stopMusic]
  );

  const startBell = useCallback(() => {
    // Stop music first
    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current.src = "";
      musicRef.current = null;
      setMusicPlaying(false);
    }

    // Reuse pre-warmed bell (Safari PWA friendly)
    if (bellRef.current) {
      bellRef.current.volume = 0.8;
      bellRef.current.currentTime = 0;
      bellRef.current.play().catch(() => {
        console.warn("[meditation-audio] Bell play blocked (warmed)");
      });
    } else {
      // Fallback: create fresh (works on Chrome, may fail on Safari PWA)
      const audio = new Audio("/meditation-bell.mp3");
      audio.loop = true;
      audio.volume = 0.8;
      audio.play().catch(() => {
        console.warn("[meditation-audio] Bell autoplay blocked");
      });
      bellRef.current = audio;
    }
    setBellRinging(true);

    // Persistent vibration for mobile browsers / PWA
    if ("vibrate" in navigator) {
      navigator.vibrate([600, 1500]);
      vibrationRef.current = setInterval(() => {
        navigator.vibrate([600, 1500]);
      }, 2100);
    }

    // Fire a notification as fallback (user may have screen locked in PWA)
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("Meditation complete", {
          body: "Your meditation timer has finished",
          tag: "meditation-bell",
          requireInteraction: true,
        });
      } catch {
        // Notification API may not be available in some contexts
      }
    }
  }, []);

  const stopBell = useCallback(() => {
    if (bellRef.current) {
      bellRef.current.pause();
      bellRef.current.currentTime = 0;
      // Don't clear src — keep it warm for potential re-use
    }
    setBellRinging(false);
    if (vibrationRef.current) {
      clearInterval(vibrationRef.current);
      vibrationRef.current = null;
    }
    if ("vibrate" in navigator) {
      navigator.vibrate(0);
    }
  }, []);

  const cleanup = useCallback(() => {
    stopMusic();
    stopBell();
    // On full cleanup, release the bell audio
    if (bellRef.current) {
      bellRef.current.src = "";
      bellRef.current = null;
    }
  }, [stopMusic, stopBell]);

  // Cleanup on unmount — stop all audio and vibration
  useEffect(() => {
    return () => {
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current.src = "";
      }
      if (bellRef.current) {
        bellRef.current.pause();
        bellRef.current.src = "";
      }
      if (vibrationRef.current) {
        clearInterval(vibrationRef.current);
      }
    };
  }, []);

  return {
    musicPlaying,
    bellRinging,
    warmupBell,
    startMusic,
    stopMusic,
    toggleMusic,
    startBell,
    stopBell,
    cleanup,
  };
}
