'use client';

// useAudioPlayer.ts
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { AudioPlayer } from '@/hooks/audioPlayer/AudioPlayer';

const player = new AudioPlayer();

const subscribe = (callback: () => void) => player.subscribe(callback);
const getSnapshot = () => {
  const state = player.getSnapshot();
  return state;
};

// Cache the server snapshot object
const SERVER_SNAPSHOT = Object.freeze({
  isPlaying: false,
  isReady: false,
  currentTime: 0,
  duration: 0,
});

const getServerSnapshot = () => SERVER_SNAPSHOT;

export const useAudioPlayer = () => {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [isLoading, setIsLoading] = useState(false);

  // Add this effect to handle cleanup when the component unmounts
  useEffect(() => {
    return () => {
      player.dispose();
    };
  }, []);

  return {
    ...state,
    loadAudio: useCallback(async (url: string) => {
      setIsLoading(true);
      await player.loadAudio(url);
      setIsLoading(false);
    }, []),
    play: useCallback(() => player.play(), []),
    pause: useCallback(() => player.pause(), []),
    seek: useCallback((time: number) => player.seek(time), []),
    togglePlaying: useCallback(() => player.toggle(), []),
    disposeAudioResources: useCallback(() => player.dispose(), []),
    isLoading,
  };
};
