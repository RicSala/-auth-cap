import { useCallback, useEffect, useRef, useState } from 'react';

import { getBestSupportedMimeType } from '@/hooks/audioConst';

interface AudioRecorderState {
  status: 'idle' | 'recording' | 'paused' | 'stopped';
  recordingTime: number;
  recordingBlob: Blob | null;
  blobUrl: string | null;
  error: Error | null;
}

const INITIAL_STATE: AudioRecorderState = {
  status: 'idle',
  recordingTime: 0,
  recordingBlob: null,
  blobUrl: null,
  error: null,
};

export const RECORDER_OPTIONS = {
  audioBitsPerSecond: 24000,
  timeslice: 100, // milliseconds
} as const;

interface AudioRecorderHook {
  audioUrl: string | null;
  status: 'idle' | 'recording' | 'paused' | 'stopped';
  isPaused: boolean;
  isRecording: boolean;
  isStopped: boolean;
  recordingTime: number;
  startRecording: () => void;
  stopRecording: () => void;
  togglePauseResume: () => void;
  mediaRecorder: MediaRecorder | null;
  recordingBlob: Blob | null;
  releaseResources: () => void;
}

export const useAudioRecorder = (): AudioRecorderHook => {
  const [state, setState] = useState<AudioRecorderState>(INITIAL_STATE);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timer | null>(null);
  const mimeTypeRef = useRef<string | null>(null);

  // Does NOT set recordingTime = 0
  const _clearTimer = useCallback(() => {
    if (!timerIntervalRef.current) return;
    clearInterval(timerIntervalRef.current as NodeJS.Timeout);
    timerIntervalRef.current = null;
  }, []);

  // Start / continue the timer
  const _startTimer = useCallback(() => {
    _clearTimer();
    timerIntervalRef.current = setInterval(() => {
      setState((prev) => ({
        ...prev,
        recordingTime: prev.recordingTime + 1,
      }));
    }, 1000);
  }, [_clearTimer]);

  const _cleanTracks = useCallback((recorder: MediaRecorder | null) => {
    if (!recorder) return;
    recorder.stream.getTracks().forEach((track) => track.stop());
  }, []);

  // Clear everything
  const reset = () => {
    setState(INITIAL_STATE);
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
    chunksRef.current = [];
    _clearTimer();
  };

  const startRecording = () => {
    reset();

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      .then((stream) => {
        mediaStreamRef.current = stream;
        const mimeType = getBestSupportedMimeType();
        console.log('Using mimeType', { mimeType });
        mimeTypeRef.current = mimeType;

        const recorder = new MediaRecorder(stream, {
          mimeType,
          audioBitsPerSecond: RECORDER_OPTIONS.audioBitsPerSecond,
        });
        mediaRecorderRef.current = recorder;

        // Set event listeners
        recorder.addEventListener('dataavailable', (e) => {
          console.log('Data available', {
            size: e.data.size,
            type: e.data.type,
            state: recorder.state,
            chunksLength: chunksRef.current.length,
            allChunkSizes: chunksRef.current.map((chunk) => chunk.size),
          });
          if (e.data.size > 0) chunksRef.current.push(e.data);
        });

        recorder.addEventListener('stop', () => {
          const audioBlob = new Blob(chunksRef.current, {
            type: mimeTypeRef.current!,
          });

          const url = URL.createObjectURL(audioBlob);

          _clearTimer();

          setState((prev) => ({
            ...prev,
            status: 'stopped',
            recordingBlob: audioBlob,
            blobUrl: url,
          }));

          _cleanTracks(recorder);
        });

        recorder.addEventListener('pause', async () => {
          console.log('Running pause handler', {
            chunksLength: chunksRef.current.length,
            allChunkSizes: chunksRef.current.map((chunk) => chunk.size),
          });

          const audioBlob = new Blob(chunksRef.current, {
            type: mimeTypeRef.current!,
          });

          const url = URL.createObjectURL(audioBlob);

          _clearTimer();

          setState((prev) => ({
            ...prev,
            status: 'paused',
            recordingBlob: audioBlob,
            blobUrl: url,
          }));

          recorder.addEventListener('resume', () => {
            console.log('Resuming recording');
            setState((prev) => ({ ...prev, status: 'recording' }));
          });
        });

        console.log('Starting recorder');
        recorder.start(RECORDER_OPTIONS.timeslice);
        _startTimer();
        setState((prev) => ({
          ...prev,
          status: 'recording',
          recordingBlob: null,
        }));
      });
  };

  // Stop recording function
  const stopRecording = () => {
    console.log('Clicked stop');
    console.log(mediaRecorderRef.current);
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === 'inactive') return;
    console.log('Stopping recorder');
    _clearTimer();

    mediaRecorderRef.current.stop();
  };

  const togglePauseResume = async () => {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === 'inactive') return;
    console.log('Toggling pause/resume');

    if (state.status === 'paused') {
      mediaRecorderRef.current.resume();
      _startTimer();
    } else {
      // Pause recording
      _clearTimer();

      if (state.blobUrl) {
        console.log('Revoking previous url');
        URL.revokeObjectURL(state.blobUrl);
      }
      mediaRecorderRef.current?.pause();
    }
  };

  // Cleanup effect
  useEffect(() => {
    return () => {
      _cleanTracks(mediaRecorderRef.current);
      _clearTimer();
    };
  }, [_clearTimer, _cleanTracks]);

  return {
    audioUrl: state.blobUrl,
    status: state.status,
    isPaused: state.status === 'paused',
    isRecording: state.status === 'recording',
    isStopped: state.status === 'stopped',
    recordingTime: state.recordingTime,
    startRecording,
    stopRecording,
    togglePauseResume,
    mediaRecorder: mediaRecorderRef.current,
    recordingBlob: state.recordingBlob,
    releaseResources: reset,
  };
};
