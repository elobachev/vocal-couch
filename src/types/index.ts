// Core types for the vocal training application

export interface Note {
  id: string;
  time: number; // Start time in seconds
  duration: number; // Duration in seconds
  pitch: number; // MIDI note number (60 = C4)
  name: string; // Note name without octave (e.g., 'C')
  frequency: number; // Frequency in Hz
  velocity: number; // MIDI velocity (0-127)
  lyric?: string; // Lyric syllable or word for this note
}

// Deprecated - kept for backward compatibility during transition
export interface LyricSegment {
  id: string;
  time: number;
  duration: number;
  text: string;
  syllables?: string[];
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  tempo: number; // BPM
  duration: number; // Total duration in seconds
  timeSignature: [number, number]; // [numerator, denominator]
  key: string; // Musical key
  notes: Note[];
  // lyrics field removed - now integrated into notes
}

export interface PitchDetectionResult {
  frequency: number;
  pitch: number; // MIDI note number
  noteName: string; // With octave (e.g., 'A4')
  noteNameOnly: string; // Without octave (e.g., 'A')
  confidence: number; // 0-1
  clarity: number; // 0-1
  timestamp: number;
}

export interface VoiceAnalysis {
  currentPitch: PitchDetectionResult | null;
  targetNote: Note | null;
  accuracy: number; // 0-1
  deviation: number; // In cents (-1200 to +1200)
  isOnPitch: boolean;
  octaveAdjusted: boolean; // True if singing in different octave
}

export interface VoiceHistory {
  time: number;
  pitch: number;
  isOnPitch: boolean;
}

export interface TimelineState {
  currentTime: number;
  isPlaying: boolean;
  scrollPosition: number;
  zoom: number; // Pixels per second
  viewportWidth: number;
}

export interface AudioState {
  isLoaded: boolean;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  playbackRate: number;
}

export interface MicrophoneState {
  isRecording: boolean;
  isEnabled: boolean;
  isMuted: boolean;
  volume: number;
  error: string | null;
  hasPermission: boolean;
  isRequestingPermission: boolean;
}

export interface SongResults {
  totalNotes: number;
  correctNotes: number;
  accuracy: number;
  scorePercentage: number;
  completedAt: number;
}

export interface AppState {
  currentSong: Song | null;
  timeline: TimelineState;
  audio: AudioState;
  microphone: MicrophoneState;
  voiceAnalysis: VoiceAnalysis;
  voiceHistory: VoiceHistory[];
  results: SongResults | null;
  settings: {
    octaveTolerance: boolean;
    pitchSensitivity: number;
    visualizations: {
      showNoteNames: boolean;
      showFrequencies: boolean;
      showConfidence: boolean;
    };
  };
}