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
  timeslice: 200, // Adjusted to 1 second for better performance
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
  currentDeviceLabel: string | null;
}

const isSafari = () =>
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const getAudioConstraints = (deviceId: string | null) => {
  if (isSafari()) {
    console.log('Safari detected');
    return {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
        sampleRate: { ideal: 44100 }, // Safari works better with this sample rate
      },
    };
  }

  return {
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  };
};

export const useAudioRecorder = (): AudioRecorderHook => {
  const [state, setState] = useState<AudioRecorderState>(INITIAL_STATE);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceLabel, setCurrentDeviceLabel] = useState<string | null>(
    null
  );

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timer | null>(null);
  const mimeTypeRef = useRef<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Fetch available audio input devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        const deviceInfos = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = deviceInfos.filter(
          (device) => device.kind === 'audioinput'
        );
        console.log('🎤 Found devices:', audioDevices);
        setDevices(audioDevices);
      } catch (error) {
        console.error('Error enumerating devices:', error);
      }
    };

    getDevices();
  }, []);

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

  const _handleError = (error: unknown) => {
    console.error('❌ Recording error:', error);
    reset();
    setState((prev) => ({
      ...prev,
      status: 'idle',
      error:
        error instanceof Error ? error : new Error('Unknown recording error'),
    }));
  };

  // Clear everything
  const reset = () => {
    if (state.blobUrl) {
      URL.revokeObjectURL(state.blobUrl);
    }
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setState(INITIAL_STATE);
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
    chunksRef.current = [];
    _clearTimer();
  };

  const setupRecorder = (recorder: MediaRecorder) => {
    let dataReceived = false;

    const handlePause = () => {
      _clearTimer();
      const audioBlob = new Blob(chunksRef.current, {
        type: mimeTypeRef.current!,
      });
      const url = URL.createObjectURL(audioBlob);
      setState((prev) => ({
        ...prev,
        status: 'paused',
        blobUrl: url,
        recordingBlob: audioBlob,
      }));
    };

    const handleResume = () => {
      _startTimer();
      setState((prev) => ({
        ...prev,
        status: 'recording',
      }));
    };

    const handleDataAvailable = (e: BlobEvent) => {
      console.log('📊 Data available event:', {
        size: e.data?.size,
        type: e.data?.type,
        timestamp: new Date().toISOString(),
      });

      if (e.data?.size > 0) {
        dataReceived = true;
        try {
          const chunk = new Blob([e.data], { type: mimeTypeRef.current! });
          if (chunk.size > 0) {
            chunksRef.current.push(chunk);
            console.log(
              '✅ Chunk added, total chunks:',
              chunksRef.current.length
            );
          }
        } catch (error) {
          console.error('❌ Invalid chunk received:', error);
        }
      }
    };

    const handleStop = () => {
      console.log('🛑 Stop event triggered', {
        chunksLength: chunksRef.current.length,
        dataReceived,
      });

      try {
        if (!dataReceived) {
          throw new Error('No audio data was received during recording');
        }

        if (chunksRef.current.length === 0) {
          throw new Error('No audio data recorded');
        }

        const audioBlob = new Blob(chunksRef.current, {
          type: mimeTypeRef.current!,
        });

        if (audioBlob.size === 0) {
          throw new Error('Generated empty audio blob');
        }

        console.log('✅ Audio blob created:', {
          size: audioBlob.size,
          type: audioBlob.type,
        });

        const url = URL.createObjectURL(audioBlob);
        _clearTimer();

        // Test the audio blob by playing it
        const audio = new Audio(url);
        audio.play();

        setState((prev) => ({
          ...prev,
          status: 'stopped',
          recordingBlob: audioBlob,
          blobUrl: url,
          error: null,
        }));

        _cleanTracks(recorder);
      } catch (error) {
        console.error('❌ Error in stop handler:', error);
        _handleError(error);
      }
    };

    const handleError = (error: ErrorEvent) => {
      console.error('❌ Recorder error:', error);
      _handleError(error);
    };

    recorder.addEventListener('dataavailable', handleDataAvailable);
    recorder.addEventListener('stop', handleStop);
    recorder.addEventListener('pause', handlePause);
    recorder.addEventListener('resume', handleResume);
    recorder.addEventListener('error', handleError);

    return () => {
      recorder.removeEventListener('dataavailable', handleDataAvailable);
      recorder.removeEventListener('stop', handleStop);
      recorder.removeEventListener('pause', handlePause);
      recorder.removeEventListener('resume', handleResume);
      recorder.removeEventListener('error', handleError);
    };
  };

  const startRecording = async (retryCount = 0) => {
    try {
      console.log('🎙️ Starting recording attempt:', retryCount);

      if (mediaRecorderRef.current?.state === 'recording') {
        console.log('⚠️ Recorder already recording, stopping first...');
        stopRecording();
      }
      reset();

      const selectedDeviceId = devices.length > 0 ? devices[0]?.deviceId : null;
      setCurrentDeviceLabel(
        devices.length > 0
          ? devices[0]?.label || 'Default Microphone'
          : 'Default Microphone'
      );

      console.log('🎤 Requesting media stream...');
      const stream = await navigator.mediaDevices
        .getUserMedia(getAudioConstraints(selectedDeviceId ?? null))
        .catch((error) => {
          console.error('❌ Failed to get media stream:', error);
          throw error;
        });

      if (!stream?.active) {
        console.error('❌ Stream is inactive');
        throw new Error('Obtained inactive media stream');
      }

      console.log('✅ Stream obtained:', {
        tracks: stream.getTracks().map((t) => ({
          kind: t.kind,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
        })),
      });

      mediaStreamRef.current = stream;

      const mimeType = getBestSupportedMimeType();
      console.log('📝 Using MIME type:', mimeType);

      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.error('❌ Mime type not supported');
        throw new Error(`Mime type ${mimeType} is not supported`);
      }
      mimeTypeRef.current = mimeType;

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: RECORDER_OPTIONS.audioBitsPerSecond,
      });

      console.log('🎙️ Recorder created:', {
        state: recorder.state,
        mimeType: recorder.mimeType,
        audioBitsPerSecond: recorder.audioBitsPerSecond,
      });

      if (recorder.state === 'inactive') {
        const cleanup = setupRecorder(recorder);
        cleanupRef.current = cleanup;
        mediaRecorderRef.current = recorder;

        try {
          console.log('▶️ Starting recorder...');
          recorder.start(RECORDER_OPTIONS.timeslice);
          _startTimer();
          setState((prev) => ({
            ...prev,
            status: 'recording',
            recordingBlob: null,
            error: null,
          }));
          console.log('✅ Recorder started successfully');
        } catch (error) {
          console.error('❌ Failed to start recorder:', error);
          cleanup();
          throw error;
        }
      }
    } catch (error) {
      if (retryCount < 2) {
        console.warn(`⚠️ Recording failed, retrying... (${retryCount + 1}/2)`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return startRecording(retryCount + 1);
      }
      _handleError(error);
    }
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
    console.log('Toggling pause/resume');
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === 'inactive') return;

    if (state.status === 'paused') {
      console.log('Resuming recording');
      mediaRecorderRef.current.resume();
      _startTimer();
    } else {
      console.log('Pausing recording');
      // Pause recording
      _clearTimer();

      if (state.blobUrl) {
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
    currentDeviceLabel,
  };
};
