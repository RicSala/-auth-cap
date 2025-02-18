'use client';

import { LiveAudioVisualizer } from 'react-audio-visualize';

import { cn } from '@workspace/ui/lib/utils';

interface AudioVisualizerWithAxisProps {
  status: 'idle' | 'recording' | 'paused' | 'stopped';
  mediaRecorder?: MediaRecorder | null;
  className?: string;
  fftSize?:
    | 1024
    | 256
    | 32
    | 64
    | 128
    | 512
    | 2048
    | 4096
    | 8192
    | 16384
    | 32768;
}

export function NoteLiveAudioVisualizer({
  status,
  mediaRecorder,
  className,
  fftSize = 1024,
}: AudioVisualizerWithAxisProps) {
  return (
    <div
      className={cn(
        'relative h-24 w-48 max-w-full rounded-md bg-indigo-100',
        className
      )}
    >
      <div className='absolute left-0 right-0 top-1/2 h-[1px] bg-muted-foreground' />
      {status === 'recording' && mediaRecorder && (
        <LiveAudioVisualizer
          mediaRecorder={mediaRecorder}
          width={256}
          height={96}
          barColor=''
          barWidth={4}
          gap={2}
          fftSize={fftSize}
          smoothingTimeConstant={0.8}
        />
      )}
    </div>
  );
}
