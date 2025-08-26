import { Song, Note, LyricSegment } from '../types';
import twinkleSong from '../default_songs/twinkle';
import yankeedoodleSong from '../default_songs/yankeedoodle';
import happybirthdaySong from '../default_songs/happybirthday';

// Utility functions
export function midiToFrequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

export function frequencyToMidi(frequency: number): number {
  return Math.round(12 * Math.log2(frequency / 440) + 69);
}

export function getMidiNoteName(midiNote: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = midiNote % 12;
  return `${noteNames[noteIndex]}${octave}`;
}

export function getMidiNoteNameOnly(midiNote: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteIndex = midiNote % 12;
  return noteNames[noteIndex];
}

export function centsFromFrequencies(f1: number, f2: number): number {
  return 1200 * Math.log2(f2 / f1);
}

export function isOctaveEquivalent(midi1: number, midi2: number): boolean {
  return (midi1 % 12) === (midi2 % 12);
}

// Транспозиция нот
export function transposeNote(note: Note, semitones: number): Note {
  const transposedPitch = note.pitch + semitones;
  return {
    ...note,
    pitch: transposedPitch,
    frequency: midiToFrequency(transposedPitch),
    name: getMidiNoteNameOnly(transposedPitch)
  };
}

// Транспозиция тональности
export function transposeKey(originalKey: string, semitones: number): string {
  const keyMap: { [key: string]: number } = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
    'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
  };
  
  const reverseKeyMap: { [key: number]: string } = {
    0: 'C', 1: 'C#', 2: 'D', 3: 'D#', 4: 'E', 5: 'F',
    6: 'F#', 7: 'G', 8: 'G#', 9: 'A', 10: 'A#', 11: 'B'
  };

  // Парсим оригинальную тональность (например, "C Major" или "A Minor")
  const parts = originalKey.split(' ');
  const rootNote = parts[0];
  const mode = parts.length > 1 ? parts.slice(1).join(' ') : 'Major';
  
  if (!(rootNote in keyMap)) {
    return originalKey; // Возвращаем оригинал, если не можем распарсить
  }
  
  // Транспонируем корневую ноту
  const originalSemitone = keyMap[rootNote];
  let newSemitone = (originalSemitone + semitones) % 12;
  if (newSemitone < 0) newSemitone += 12;
  
  const newRootNote = reverseKeyMap[newSemitone];
  return `${newRootNote} ${mode}`;
}

// Audio synthesis using Web Audio API with cross-browser compatibility
export class AudioSynthesizer {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private oscillators: Map<string, OscillatorNode> = new Map();
  private isInitialized: boolean = false;
  private userInteractionReceived: boolean = false;

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Create AudioContext with cross-browser support
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio API is not supported in this browser');
      }
      
      // Safari-compatible initialization
      const options: AudioContextOptions = {
        latencyHint: 'interactive'
      };
      
      // Only add sampleRate for modern browsers
      if (window.AudioContext) {
        options.sampleRate = 44100;
      }
      
      this.audioContext = new AudioContextClass(options);
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.gain.value = 0.3;
      
      // Handle different AudioContext states across browsers
      if (this.audioContext.state === 'suspended') {
        console.log('AudioContext suspended, attempting to resume...');
        try {
          await this.audioContext.resume();
          if (this.audioContext.state === 'suspended') {
            console.warn('AudioContext still suspended - user interaction required');
            // Don't throw error, just mark as needing user interaction
            this.userInteractionReceived = false;
          } else {
            this.userInteractionReceived = true;
          }
        } catch (resumeError) {
          console.warn('Failed to resume AudioContext:', resumeError);
          this.userInteractionReceived = false;
        }
      } else {
        this.userInteractionReceived = true;
      }
      
      this.isInitialized = true;
      console.log('Audio initialized successfully, state:', this.audioContext.state);
    } catch (error) {
      console.error('Audio initialization failed:', error);
      throw error;
    }
  }

  // Ensure AudioContext is ready for playback
  private async ensureAudioContext(): Promise<boolean> {
    if (!this.audioContext || !this.gainNode) {
      console.warn('Audio not initialized');
      return false;
    }
    
    // Handle suspended state (common in Safari)
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        this.userInteractionReceived = true;
        console.log('AudioContext resumed successfully');
      } catch (error) {
        console.error('Failed to resume AudioContext:', error);
        return false;
      }
    }
    
    return this.audioContext.state === 'running';
  }

  async playNote(frequency: number, duration: number, id: string = '') {
    if (!await this.ensureAudioContext()) {
      console.warn('AudioContext not ready, cannot play note');
      return;
    }

    try {
      const oscillator = this.audioContext!.createOscillator();
      const noteGain = this.audioContext!.createGain();
      
      oscillator.connect(noteGain);
      noteGain.connect(this.gainNode!);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      // Envelope for smooth attack and release - cross-browser compatible
      const currentTime = this.audioContext!.currentTime;
      noteGain.gain.setValueAtTime(0, currentTime);
      
      // Use exponential ramps for better Safari compatibility
      try {
        noteGain.gain.exponentialRampToValueAtTime(0.4, currentTime + 0.05); // Attack
        noteGain.gain.exponentialRampToValueAtTime(0.4, currentTime + Math.max(duration - 0.1, 0.05)); // Sustain
        noteGain.gain.exponentialRampToValueAtTime(0.01, currentTime + duration); // Release
      } catch (rampError) {
        // Fallback to linear ramps for older browsers
        noteGain.gain.linearRampToValueAtTime(0.4, currentTime + 0.05);
        noteGain.gain.linearRampToValueAtTime(0.4, currentTime + Math.max(duration - 0.1, 0.05));
        noteGain.gain.linearRampToValueAtTime(0, currentTime + duration);
      }
      
      oscillator.start(currentTime);
      oscillator.stop(currentTime + duration);
      
      if (id) {
        this.oscillators.set(id, oscillator);
        oscillator.onended = () => {
          this.oscillators.delete(id);
        };
      }
      
      console.log(`Playing note: ${frequency}Hz for ${duration}s (AudioContext state: ${this.audioContext!.state})`);
    } catch (error) {
      console.error('Error playing note:', error);
    }
  }

  stopAll() {
    this.oscillators.forEach((oscillator, id) => {
      try {
        oscillator.stop();
        this.oscillators.delete(id);
      } catch (e) {
        // Oscillator already stopped
      }
    });
  }

  cleanup() {
    this.stopAll();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Load songs from separate TSV files
async function loadSongFromTSVFile(filename: string): Promise<Song> {
  try {
    const response = await fetch(`/songs/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}`);
    }
    const text = await response.text();
    return parseTextToSong(text); // now parses TSV
  } catch (error) {
    console.error(`Error loading song ${filename}:`, error);
    throw error;
  }
}

// Song library - loaded from imported defaults
const songs: Record<string, Song> = {};
let songsLoaded = false;

// Initialize songs from imported defaults
async function initializeSongs() {
  if (songsLoaded) return;
  try {
    // Parse songs with fixed IDs to prevent selection issues
    const twinkleParsed = parseTextToSong(twinkleSong);
    const yankeedoodleParsed = parseTextToSong(yankeedoodleSong);
    const happybirthdayParsed = parseTextToSong(happybirthdaySong);
    
    // Override with stable IDs for default songs
    twinkleParsed.id = 'twinkle';
    yankeedoodleParsed.id = 'yankeedoodle';
    happybirthdayParsed.id = 'happybirthday';
    
    songs['twinkle'] = twinkleParsed;
    songs['yankeedoodle'] = yankeedoodleParsed;
    songs['happybirthday'] = happybirthdayParsed;
    
    songsLoaded = true;
    console.log('Default songs initialized from imports (twinkle, yankeedoodle, happybirthday)');
  } catch (error) {
    console.error('Failed to initialize default songs from imports:', error);
    songsLoaded = true; // avoid repeated attempts
  }
}

export async function getSongById(songId: string): Promise<Song | null> {
  // First try default songs
  await initializeSongs();
  if (songs[songId]) {
    return songs[songId];
  }
  
  // Then try saved songs
  const savedSongs = getSavedSongs();
  if (savedSongs[songId]) {
    return savedSongs[songId];
  }
  
  return null;
}

export async function getSong(songId: string): Promise<Song | null> {
  await initializeSongs();
  return songs[songId] || null;
}

export async function getAllSongs(): Promise<Song[]> {
  await initializeSongs();
  return Object.values(songs);
}

export async function getDefaultSong(): Promise<Song> {
  await initializeSongs();
  
  // First priority: last selected song from localStorage
  const lastSelectedSongId = localStorage.getItem('vocalCoach_lastSelectedSong');
  if (lastSelectedSongId && songs[lastSelectedSongId]) {
    return songs[lastSelectedSongId];
  }
  
  // Second priority: Twinkle Twinkle Little Star
  return songs['twinkle'] || songs['yankeedoodle'] || songs['happybirthday'];
}

// Import/Export functionality
export function exportSongToText(song: Song): string {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    const mmm = String(ms).padStart(3, '0');
    return `${mm}:${ss}:${mmm}`;
  };

  const header = `${song.title}\t${song.artist}`;

  const lines: string[] = [header];
  song.notes.forEach(note => {
    const startTime = formatTime(note.time);
    const endTime = formatTime(note.time + note.duration);
    // Prefer existing helpers to format pitch as C#4 etc.
    const pitchName = getMidiNoteName(note.pitch);
    const lyric = note.lyric || '';
    lines.push(`${startTime}-${endTime}\t${pitchName}\t${lyric}`.trim());
  });

  return lines.join('\n');
}

export function parseTextToSong(text: string, _title: string = 'Imported Song', _artist: string = 'Unknown'): Song {
  const rawLines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0);
  if (rawLines.length === 0) {
    return {
      id: `imported-${Date.now()}`,
      title: 'Untitled song',
      artist: 'Untitled author',
      tempo: 120,
      duration: 0,
      timeSignature: [4, 4],
      key: 'C Major',
      notes: []
    };
  }

  const isRangeLine = (line: string): boolean => {
    const first = line.split('\t')[0];
    if (!first || !first.includes('-')) return false;
    const [a, b] = first.split('-');
    const parseTS = (s: string): number | null => {
      const t = s.trim();
      let m = t.match(/^(\d+):(\d{1,2})(?:[.:](\d{1,3}))?$/);
      if (m) {
        const min = parseInt(m[1], 10);
        const sec = parseInt(m[2], 10);
        const ms = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) : 0;
        return min * 60 + sec + ms / 1000;
      }
      m = t.match(/^(\d+)(?:[.:](\d{1,3}))?$/);
      if (m) {
        const sec = parseInt(m[1], 10);
        const ms = m[2] ? parseInt(m[2].padEnd(3, '0'), 10) : 0;
        return sec + ms / 1000;
      }
      return null;
    };
    return parseTS(a) !== null && parseTS(b) !== null;
  };

  // Header detection
  let title = 'Untitled song';
  let artist = 'Untitled author';
  let idx = 0;
  if (!isRangeLine(rawLines[0])) {
    const [t, a = 'Untitled author'] = rawLines[0].split('\t');
    title = (t ?? '').trim() || 'Untitled song';
    artist = (a ?? '').trim() || 'Untitled author';
    idx = 1;
  }

  const toSeconds = (stamp: string): number => {
    const t = stamp.trim();
    let m = t.match(/^(\d+):(\d{1,2})(?:[.:](\d{1,3}))?$/);
    if (m) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const ms = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) : 0;
      return min * 60 + sec + ms / 1000;
    }
    m = t.match(/^(\d+)(?:[.:](\d{1,3}))?$/);
    if (m) {
      const sec = parseInt(m[1], 10);
      const ms = m[2] ? parseInt(m[2].padEnd(3, '0'), 10) : 0;
      return sec + ms / 1000;
    }
    throw new Error(`Bad timestamp: ${stamp}`);
  };

  const noteMap: { [key: string]: number } = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
  };

  const toMidi = (pitchStr: string): { midi: number; name: string } => {
    const s = String(pitchStr).trim();
    if (/^\d+$/.test(s)) {
      const midi = parseInt(s, 10);
      const name = getMidiNoteNameOnly(midi); // name without octave
      return { midi, name };
    }
    const m = s.match(/^([A-G])([#b]?)(\d)$/);
    if (!m) throw new Error(`Bad pitch: ${s}`);
    const [, letter, accidental, octaveStr] = m;
    const octave = parseInt(octaveStr, 10);
    const value = noteMap[letter + (accidental || '')];
    const midi = (octave + 1) * 12 + value;
    return { midi, name: letter + (accidental || '') };
  };

  const notes: Note[] = [];
  let maxTime = 0;
  for (; idx < rawLines.length; idx++) {
    const cols = rawLines[idx].split('\t');
    if (cols.length < 3) continue;
    const range = cols[0];
    const pitchCol = cols[1];
    const lyric = cols.slice(2).join('\t').trim();
    const [startS, endS] = range.split('-');
    const start = toSeconds(startS);
    const end = toSeconds(endS);
    const dur = end - start;
    const { midi, name } = toMidi(pitchCol);

    notes.push({
      id: String(idx + 1),
      time: start,
      duration: dur,
      pitch: midi,
      name,
      frequency: midiToFrequency(midi),
      velocity: 80,
      lyric: lyric || undefined
    });
    if (end > maxTime) maxTime = end;
  }

  // Generate stable ID based on title and content hash
  const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
  const contentHash = text.length.toString(36) + notes.length.toString(36);
  const stableId = `${titleSlug}-${contentHash}`;

  return {
    id: stableId,
    title,
    artist,
    tempo: 120,
    duration: Math.ceil(maxTime + 2),
    timeSignature: [4, 4],
    key: 'C Major',
    notes
  };
}

// LocalStorage management for songs
export function saveSongToStorage(song: Song): void {
  try {
    const savedSongs = getSavedSongs();
    savedSongs[song.id] = song;
    localStorage.setItem('vocalCoach_savedSongs', JSON.stringify(savedSongs));
  } catch (error) {
    console.error('Failed to save song to storage:', error);
  }
}

export function getSavedSongs(): Record<string, Song> {
  try {
    const saved = localStorage.getItem('vocalCoach_savedSongs');
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('Failed to load saved songs:', error);
    return {};
  }
}

export async function getAllAvailableSongs(): Promise<Song[]> {
  const defaultSongs = await getAllSongs();
  const savedSongs = Object.values(getSavedSongs());
  return [...defaultSongs, ...savedSongs];
}

export function deleteSavedSong(songId: string): void {
  try {
    const savedSongs = getSavedSongs();
    delete savedSongs[songId];
    localStorage.setItem('vocalCoach_savedSongs', JSON.stringify(savedSongs));
  } catch (error) {
    console.error('Failed to delete song:', error);
  }
}

export async function loadExternalTSV(url: string): Promise<Song> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch TSV: ${url}`);
  const text = await res.text();
  return parseTextToSong(text);
}