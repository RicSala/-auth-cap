export interface AudioPlayerState {
  isPlaying: boolean;
  isReady: boolean;
  currentTime: number;
  duration: number;
}

interface AudioPlayerInternalState {
  id: string;
  isPlaying: boolean;
  isReady: boolean;
  currentTime: number; //
  offset: number; //
  duration: number;
  startTime: number;
  error: Error | null;
}

export class AudioPlayerError extends Error {
  constructor(
    message: string,
    public code: 'LOAD_ERROR' | 'PLAYBACK_ERROR'
  ) {
    super(message);
    this.name = 'AudioPlayerError';
  }
}

// AudioPlayer.ts
export class AudioPlayer {
  private static instanceCounter = 0;
  private state: AudioPlayerInternalState = {
    id: `player-${++AudioPlayer.instanceCounter}`,
    isPlaying: false,
    isReady: false,
    currentTime: 0,
    offset: 0,
    duration: 0,
    startTime: 0,
    error: null,
  };

  private audio = {
    context: null as AudioContext | null,
    source: null as AudioBufferSourceNode | null,
    buffer: null as AudioBuffer | null,
  };

  private subscribers = new Set<() => void>();
  private lastSnapshot: AudioPlayerState | null = null;
  private stableSnapshot: AudioPlayerState = {
    isPlaying: false,
    isReady: false,
    currentTime: 0,
    duration: 0,
  };
  private timeUpdateId: number | null = null;

  private getCurrentTime(): number {
    if (!this.state.isPlaying) return this.state.offset;
    if (!this.audio.context) return 0;
    return (
      this.audio.context.currentTime - this.state.startTime + this.state.offset
    );
  }

  // Setup source node
  private setupSource() {
    if (!this.audio.context || !this.audio.buffer) return null;

    const source = this.audio.context.createBufferSource();
    source.buffer = this.audio.buffer;
    source.connect(this.audio.context.destination);

    // Handle end of playback
    source.onended = () => {
      const currentTime = this.getCurrentTime();
      // If not at end of playback, do nothing
      if (!(currentTime >= this.audio.buffer!.duration - 0.1)) return;
      this.state.offset = 0;
      this.state.isPlaying = false;
      this.audio.source = null;
      this.stopTimeUpdates();
      this.notify();
    };

    return source;
  }

  private handleError(error: unknown, code: 'LOAD_ERROR' | 'PLAYBACK_ERROR') {
    const audioError = new AudioPlayerError(
      error instanceof Error ? error.message : 'Unknown error',
      code
    );
    console.error(audioError);
    this.transition({ isReady: false });
    throw audioError;
  }

  private startPlayback() {
    if (!this.audio.context) return;

    this.audio.source = this.setupSource();
    if (!this.audio.source) return;

    this.audio.source.start(0, this.state.offset);
    this.transition({
      isPlaying: true,
      startTime: this.audio.context.currentTime,
    });
  }

  private notify() {
    this.subscribers.forEach((cb) => {
      cb();
    });
  }

  private transition(updates: Partial<AudioPlayerInternalState>) {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...updates };

    if (JSON.stringify(prevState) !== JSON.stringify(this.state)) {
      return this.notify();
    }
  }

  private updateCurrentTime() {
    if (!this.audio.context) return;

    const currentTime = this.state.isPlaying
      ? this.audio.context.currentTime -
        this.state.startTime +
        this.state.offset
      : this.state.offset;

    this.transition({ currentTime });
  }

  private setupTimeUpdates() {
    this.stopTimeUpdates();

    const updateTime = () => {
      if (this.state.isPlaying) {
        this.updateCurrentTime();
        this.timeUpdateId = requestAnimationFrame(updateTime);
      }
    };

    this.timeUpdateId = requestAnimationFrame(updateTime);
  }

  private stopTimeUpdates() {
    if (this.timeUpdateId !== null) {
      cancelAnimationFrame(this.timeUpdateId);
      this.timeUpdateId = null;
    }
  }

  getSnapshot(): AudioPlayerState {
    // Don't create a new object, update the stable one

    const newSnapshot = {
      isPlaying: this.state.isPlaying,
      isReady: this.state.isReady,
      currentTime: this.getCurrentTime(),
      duration: this.audio.buffer?.duration || 0,
    };

    if (JSON.stringify(this.stableSnapshot) !== JSON.stringify(newSnapshot)) {
      this.stableSnapshot = newSnapshot;
    }

    return this.stableSnapshot;
  }

  subscribe(callback: () => void) {
    this.subscribers.add(callback);
    // Log the current subscribers
    return () => {
      this.subscribers.delete(callback);
      // Log the current subscribers after removal
    };
  }

  async loadAudio(url: string) {
    try {
      if (!this.audio.context) {
        this.audio.context = new window.AudioContext();
      } else {
        await this.audio.context.suspend();
      }

      // set cors to allow cross origin
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.audio.buffer = await this.audio.context.decodeAudioData(arrayBuffer);
      this.transition({ offset: 0, isReady: true });
      this.setupSource();
    } catch (error) {
      console.error('Error loading audio:', error);
      // Clean up properly
      if (this.audio.context) {
        await this.audio.context.close();
        this.audio.context = null;
      }
      this.audio.buffer = null;
      this.transition({
        isReady: false,
        error: error as Error,
        isPlaying: false,
        offset: 0,
        currentTime: 0,
        duration: 0,
      });
    }
  }

  async play() {
    if (!this.audio.context || !this.audio.buffer || this.state.isPlaying)
      return;

    try {
      // Resume context before playing
      await this.audio.context.resume();

      this.audio.source = this.setupSource();
      if (!this.audio.source) return;

      const startTime = this.audio.context.currentTime;
      this.audio.source.start(0, this.state.offset);
      this.setupTimeUpdates();

      this.transition({
        isPlaying: true,
        startTime,
      });
    } catch (error) {
      this.handleError(error, 'PLAYBACK_ERROR');
    }
  }

  async pause() {
    if (!this.audio.context || !this.state.isPlaying) return;

    this.audio.source?.stop();
    this.audio.source = null;

    // Suspend context when pausing
    await this.audio.context.suspend();

    this.stopTimeUpdates();
    this.transition({
      isPlaying: false,
      offset: this.getCurrentTime(),
      isReady: true,
    });
  }

  seek(time: number) {
    if (!this.audio.buffer) return;

    const wasPlaying = this.state.isPlaying;

    if (this.audio.source) {
      this.audio.source.stop();
      this.audio.source = null;
    }

    this.state.offset = Math.max(0, Math.min(time, this.audio.buffer.duration));

    if (wasPlaying) {
      this.startPlayback();
    } else {
      this.notify();
    }
  }

  toggle() {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  dispose() {
    this.pause();
    this.stopTimeUpdates();
    if (this.audio.context) {
      this.audio.context.close();
      this.audio.context = null;
    }

    this.audio.buffer = null;
    this.lastSnapshot = null;
    this.stableSnapshot = {
      isPlaying: false,
      isReady: false,
      currentTime: 0,
      duration: 0,
    };
    this.state = {
      id: this.state.id,
      isPlaying: false,
      isReady: false,
      currentTime: 0,
      offset: 0,
      duration: 0,
      startTime: 0,
      error: null,
    };
  }
}
