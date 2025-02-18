'use client';

import { Play, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Pause } from 'lucide-react';
import { AudioVisualizer } from 'react-audio-visualize';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';
import { useAudioPlayer } from '@/hooks/audioPlayer/useAudioPlayer';
import { NoteLiveAudioVisualizer } from '@/components/NoteLiveAudioVisualizer';
import { useAudioRecorder } from '@/hooks/useAudioRec';

type NoteAudioModProps = {
  showNudge?: boolean;
  className?: string;
  onAudioChange?: (blob: Blob | null) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  initialAudioUrl?: string;
  disabled?: boolean;
};

export function NoteAudio({
  className,
  onAudioChange,
  onLoadingChange,
  initialAudioUrl,
  disabled = false,
  showNudge = true,
}: NoteAudioModProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayedBlob, setDisplayedBlob] = useState<Blob | null>(null);

  const {
    audioUrl,
    isRecording,
    releaseResources,
    startRecording,
    mediaRecorder,
    stopRecording,
    togglePauseResume,
    recordingTime,
    isPaused,
    recordingBlob,
    status,
    isStopped,
  } = useAudioRecorder();

  const isPreparing = false;

  const {
    isPlaying,
    play,
    pause,
    duration,
    isReady,
    loadAudio: loadAudioPlayer,
    disposeAudioResources,
    isLoading,
    currentTime,
  } = useAudioPlayer();

  // Handle initial audio if provided
  useEffect(() => {
    if (initialAudioUrl) {
      loadAudioPlayer(initialAudioUrl);
    }
  }, [initialAudioUrl, loadAudioPlayer]);

  // sync the displayed blob with the audio blob
  useEffect(() => {
    if (recordingBlob) {
      setDisplayedBlob(recordingBlob);
    }
  }, [recordingBlob]);

  // Notify parent component when audio changes
  useEffect(() => {
    disposeAudioResources();
    if (audioUrl && recordingBlob) {
      loadAudioPlayer(audioUrl);
      onAudioChange?.(recordingBlob);
    }
  }, [
    audioUrl,
    disposeAudioResources,
    loadAudioPlayer,
    onAudioChange,
    recordingBlob,
  ]);

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  // Handle errors
  // useEffect(() => {
  //   if (isError) {
  //     toast.error(error?.message);
  //   }
  // }, [isError, error]);

  const handleReset = () => {
    releaseResources();
    disposeAudioResources();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onAudioChange?.(null);
    setDisplayedBlob(null);
  };

  const handleToggleRecording = () => {
    if (!recordingBlob && !isRecording) {
      startRecording();
    } else if (isRecording) {
      togglePauseResume();
    } else {
      togglePauseResume();
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const recordingStyles = cn(
    'flex items-center justify-center transition-colors',
    {
      'bg-primary hover:bg-primary/90 animate-pulse':
        !isRecording && !isPreparing,
      '!bg-red-500 !hover:bg-red-600': isRecording,
    }
  );

  const handleFileSelect = (file: File) => {
    // reset the displayed blob
    setDisplayedBlob(null);
    releaseResources();
    disposeAudioResources();
    onAudioChange?.(file);
    setDisplayedBlob(file);
    // transform the audio into a url, and load it into the player
    const audioUrl = URL.createObjectURL(file);
    loadAudioPlayer(audioUrl);
  };

  return (
    <div
      className={cn(
        'flex max-w-full flex-col items-center gap-4 p-4',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1',
          isRecording ? 'bg-green-500 bg-opacity-20' : ''
        )}
      >
        <div className='h-3 w-3 rounded-full bg-primary' />
        {isRecording ? 'Grabando' : 'En espera'}
        {JSON.stringify({
          recorderStatus: mediaRecorder?.state,
          blobUrl: audioUrl,
        })}
      </div>
      <div
        className={cn('relative h-24 w-48 max-w-full rounded-md bg-indigo-100')}
      >
        <NoteLiveAudioVisualizer
          className={cn(`absolute inset-0 mx-auto overflow-hidden`, {
            'opacity-100': isRecording,
            'opacity-0': !isRecording && displayedBlob,
          })}
          status={status}
          mediaRecorder={mediaRecorder}
        />
        {displayedBlob && (
          <AudioVisualizer
            barPlayedColor='hsl(230 100% 62%)'
            currentTime={currentTime}
            blob={displayedBlob}
            width={640}
            height={240}
            style={{
              width: '100%',
              height: '100%',
              opacity: !displayedBlob || isRecording ? 0 : 1,
              transition: 'opacity 1s ease-in-out',
            }}
          />
        )}
      </div>
      {/* Duration display */}
      {/* <div>{secondsToTimerString(recordingTime || duration)}</div> */}
      {/* Controls */}
      <div className='flex max-w-md items-center gap-4'>
        <Button
          className='flex h-10 w-10 items-center justify-center rounded-full bg-primary p-2 text-primary-foreground'
          onClick={togglePlayPause}
          disabled={!isReady || disabled}
        >
          {isPlaying ? (
            <Pause className='h-4 w-4' />
          ) : (
            <Play className='h-4 w-4' />
          )}
        </Button>

        <Button
          className='flex items-center justify-center rounded-full bg-primary p-2 text-primary-foreground'
          onClick={handleToggleRecording}
        >
          Record
        </Button>

        <Button
          className='flex h-10 w-10 items-center justify-center rounded-full bg-primary p-2 text-primary-foreground'
          onClick={handleReset}
          disabled={!isReady || disabled}
        >
          <Trash2 size={20} />
        </Button>
      </div>
    </div>
  );
}
