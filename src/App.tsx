import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Song, TimelineState, AudioState, MicrophoneState, VoiceAnalysis, PitchDetectionResult, VoiceHistory, SongResults } from './types';
import { getDefaultSong, getAllSongs, getSong, getSongById, getAllAvailableSongs, AudioSynthesizer, frequencyToMidi, getMidiNoteName, getMidiNoteNameOnly, centsFromFrequencies, isOctaveEquivalent, exportSongToText, transposeNote, transposeKey } from './utils/musicUtils';
import Timeline from './components/Timeline';
import Controls from './components/Controls';
import VoiceAnalyzer from './components/VoiceAnalyzer';
import ResultsDisplay from './components/ResultsDisplay';
import MicrophoneAnalyzer from './components/MicrophoneAnalyzer';
import SongSelectionModal from './components/SongSelectionModal';

function App() {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [availableSongs, setAvailableSongs] = useState<Song[]>([]);
  const [audioSynthesizer] = useState(() => new AudioSynthesizer());
  
  // Initialize songs on component mount
  useEffect(() => {
    const initializeSongs = async () => {
      try {
        const defaultSong = await getDefaultSong();
        const allSongs = await getAllAvailableSongs();
        setCurrentSong(defaultSong);
        setAvailableSongs(allSongs);
      } catch (error) {
        console.error('Failed to initialize songs:', error);
      }
    };
    
    initializeSongs();
  }, []);
  
  const [timeline, setTimeline] = useState<TimelineState>({
    currentTime: 0,
    isPlaying: false,
    scrollPosition: 0,
    zoom: 100,
    viewportWidth: window.innerWidth,
  });
  
  const [audio, setAudio] = useState<AudioState>({
    isLoaded: false,
    isPlaying: false,
    volume: 0.7,
    currentTime: 0,
    duration: 0,
    playbackRate: 1.0,
  });
  
  const [microphone, setMicrophone] = useState<MicrophoneState>(() => {
    // Load microphone mute state from localStorage
    let isMuted = false;
    try {
      const saved = localStorage.getItem('vocalCoach_microphoneMuted');
      isMuted = saved ? JSON.parse(saved) : false;
    } catch {
      isMuted = false;
    }
    
    return {
      isRecording: false,
      isEnabled: false,
      isMuted,
      volume: 0,
      error: null,
      hasPermission: false,
      isRequestingPermission: false,
    };
  });
  
  // Save microphone mute state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('vocalCoach_microphoneMuted', JSON.stringify(microphone.isMuted));
    } catch (error) {
      console.error('Failed to save microphone state:', error);
    }
  }, [microphone.isMuted]);
  
  const [voiceAnalysis, setVoiceAnalysis] = useState<VoiceAnalysis>({
    currentPitch: null,
    targetNote: null,
    accuracy: 0,
    deviation: 0,
    isOnPitch: false,
    octaveAdjusted: false,
  });
  
  const [voiceHistory, setVoiceHistory] = useState<VoiceHistory[]>([]);
  const [results, setResults] = useState<SongResults | null>(null);
  const [noteHits, setNoteHits] = useState<Set<string>>(new Set());
  const [songSelectionModal, setSongSelectionModal] = useState(false);
  
  // Countdown state for 3-second countdown before playback
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Note sound control with localStorage
  const [noteSoundEnabled, setNoteSoundEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('vocalCoach_noteSoundEnabled');
      return saved ? JSON.parse(saved) : false; // Default to OFF as requested
    } catch {
      return false;
    }
  });
  
  // Save note sound state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('vocalCoach_noteSoundEnabled', JSON.stringify(noteSoundEnabled));
    } catch (error) {
      console.error('Failed to save note sound state:', error);
    }
  }, [noteSoundEnabled]);
  
  // Toggle note sound function
  const toggleNoteSound = useCallback(() => {
    setNoteSoundEnabled((prev: boolean) => !prev);
  }, []);
  
  // Transposition control with localStorage
  const [transpositionSemitones, setTranspositionSemitones] = useState(() => {
    try {
      const saved = localStorage.getItem('vocalCoach_transposition');
      return saved ? JSON.parse(saved) : 0; // Default to 0 (no transposition)
    } catch {
      return 0;
    }
  });
  
  // Save transposition state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('vocalCoach_transposition', JSON.stringify(transpositionSemitones));
    } catch (error) {
      console.error('Failed to save transposition state:', error);
    }
  }, [transpositionSemitones]);
  
  // Transposition control functions
  const transposeUp = useCallback(() => {
    setTranspositionSemitones((prev: number) => Math.min(12, prev + 1));
  }, []);
  
  const transposeDown = useCallback(() => {
    setTranspositionSemitones((prev: number) => Math.max(-12, prev - 1));
  }, []);
  
  // Ref for current time to avoid stale closure in analyzeVoice
  const currentTimeRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameTsRef = useRef<number | null>(null);
  
  // Calculate actual song duration from notes
  const calculateSongDuration = (song: Song | null): number => {
    if (!song || song.notes.length === 0) return 60; // Default fallback
    const lastNote = song.notes.reduce((latest, note) => 
      (note.time + note.duration) > (latest.time + latest.duration) ? note : latest
    );
    return Math.ceil(lastNote.time + lastNote.duration + 2); // Add 2 second buffer
  };
  
  const actualSongDuration = calculateSongDuration(currentSong);
  
  // Debounced voice analysis update to reduce React re-renders
  const debouncedVoiceAnalysisUpdate = useCallback((analysis: VoiceAnalysis) => {
    setVoiceAnalysis(analysis);
  }, []);
  
  // Optimized voice history update
  const handleVoiceHistoryUpdate = useCallback((newPoint: VoiceHistory) => {
    setVoiceHistory(prev => {
      const newHistory = [...prev, newPoint];
      return newHistory.slice(-100); // Keep only last 100 points
    });
  }, []);
  
  // Note hit handler
  const handleNoteHit = useCallback((noteId: string) => {
    setNoteHits(prev => new Set([...prev, noteId]));
  }, []);
  
  // Microphone state change handler
  const handleMicrophoneStateChange = useCallback((changes: Partial<MicrophoneState>) => {
    setMicrophone(prev => ({ ...prev, ...changes }));
  }, []);
  
  // Initialize audio synthesizer - Enhanced for cross-browser compatibility
  const initializeAudio = useCallback(async () => {
    try {
      console.log('Initializing audio system...');
      await audioSynthesizer.initialize();
      setAudio(prev => ({ ...prev, isLoaded: true }));
      console.log('Audio system ready');
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      // Try again after a short delay (helps with Safari)
      setTimeout(async () => {
        try {
          await audioSynthesizer.initialize();
          setAudio(prev => ({ ...prev, isLoaded: true }));
          console.log('Audio system ready (retry)');
        } catch (retryError) {
          console.error('Audio initialization failed after retry:', retryError);
        }
      }, 100);
    }
  }, [audioSynthesizer]);
  
  // Toggle microphone mute
  const toggleMicrophoneMute = useCallback(() => {
    setMicrophone(prev => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);
  
  // Play note synthesis - UPDATED: Respect note sound setting
  const playCurrentNotes = useCallback(() => {
    // Don't play notes if sound is disabled, but still allow the song to continue
    if (!audio.isLoaded || !timeline.isPlaying || !currentSong || !noteSoundEnabled) return;
    
    const currentNotes = currentSong.notes.filter(note => {
      const noteStart = note.time;
      const noteEnd = note.time + note.duration;
      const currentTime = timeline.currentTime;
      
      return currentTime >= noteStart && currentTime <= noteEnd;
    });
    
    // Only play notes that aren't already playing
    currentNotes.forEach(note => {
      const remainingDuration = (note.time + note.duration) - timeline.currentTime;
      if (remainingDuration > 0 && remainingDuration <= note.duration) {
        // Check if note just started (within 0.15s tolerance)
        const timeSinceStart = timeline.currentTime - note.time;
        if (timeSinceStart <= 0.15) {
          const transposedNote = transposeNote(note, transpositionSemitones);
          audioSynthesizer.playNote(transposedNote.frequency, remainingDuration, note.id);
        }
      }
    });
  }, [audio.isLoaded, timeline.isPlaying, currentSong, timeline.currentTime, audioSynthesizer, noteSoundEnabled, transpositionSemitones]);
  
  // Check microphone permission before starting countdown
  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately as we just needed permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone permission denied or failed:', error);
      // Show user-friendly error message
      alert('Для работы приложения требуется доступ к микрофону. Пожалуйста, разрешите доступ и попробуйте снова.');
      return false;
    }
  }, []);
  
  // 3-second countdown before playback starts
  const startCountdown = useCallback(async () => {
    // Start countdown from 3
    for (let count = 3; count >= 1; count--) {
      setCountdown(count);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Clear countdown and start actual playback
    setCountdown(null);
    
    // Now start the actual playback logic
    console.log('Starting playback after countdown - current audio state:', { isLoaded: audio.isLoaded });
    
    // Initialize audio on first user interaction (critical for Safari/Chrome)
    if (!audio.isLoaded) {
      console.log('Audio not loaded, initializing...');
      await initializeAudio();
      
      // Wait a brief moment for audio to be ready (helps Safari)
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Double-check audio is ready before proceeding
    if (!audio.isLoaded) {
      console.warn('Audio still not loaded after initialization attempt');
      // Try one more time
      try {
        await audioSynthesizer.initialize();
        setAudio(prev => ({ ...prev, isLoaded: true }));
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (finalError) {
        console.error('Final audio initialization failed:', finalError);
      }
    }
    
    // Start playing
    setTimeline(prev => ({ ...prev, isPlaying: true }));
    setAudio(prev => ({ ...prev, isPlaying: true }));
    
    // Clear previous results
    setResults(null);
    setNoteHits(new Set());
    setVoiceHistory([]);
    
    // Play current notes after a longer delay to ensure audio is ready
    setTimeout(() => {
      console.log('Attempting to play current notes...');
      playCurrentNotes();
    }, 300); // Increased delay for Safari
  }, [audio.isLoaded, initializeAudio, audioSynthesizer, playCurrentNotes]);
  
  // Combined play/record function - Enhanced for cross-browser compatibility
  const togglePlayback = useCallback(async () => {
    if (timeline.isPlaying) {
      // Stop everything
      setTimeline(prev => ({ ...prev, isPlaying: false }));
      setAudio(prev => ({ ...prev, isPlaying: false }));
      audioSynthesizer.stopAll();
      // Also stop countdown if running
      setCountdown(null);
    } else {
      // Check microphone permission before starting countdown
      const hasPermission = await requestMicrophonePermission();
      if (hasPermission) {
        // Start countdown only if microphone permission granted
        startCountdown();
      }
    }
  }, [timeline.isPlaying, audioSynthesizer, startCountdown, requestMicrophonePermission]);
  
  // Update currentTime ref whenever timeline changes
  useEffect(() => {
    currentTimeRef.current = timeline.currentTime;
  }, [timeline.currentTime]);
  
  // Timeline progression with requestAnimationFrame — smoother and frame-accurate
  useEffect(() => {
    if (!timeline.isPlaying) return;

    const step = (ts: number) => {
      if (lastFrameTsRef.current == null) {
        lastFrameTsRef.current = ts;
        rafIdRef.current = requestAnimationFrame(step);
        return;
      }

      const dt = (ts - lastFrameTsRef.current) / 1000; // seconds
      lastFrameTsRef.current = ts;

      setTimeline(prev => {
        const rate = audio.playbackRate ?? 1.0;
        const rawNewTime = prev.currentTime + dt * rate;
        const newTime = Math.max(0, rawNewTime);

        if (newTime >= actualSongDuration) {
          // Song completed - calculate results
          const totalNotes = currentSong?.notes.length || 0;
          const correctNotes = noteHits.size;
          const accuracy = totalNotes > 0 ? correctNotes / totalNotes : 0;
          const scorePercentage = accuracy * 100;

          const songResults: SongResults = {
            totalNotes,
            correctNotes,
            accuracy,
            scorePercentage,
            completedAt: Date.now(),
          };

          setResults(songResults);
          setAudio(prevAudio => ({ ...prevAudio, isPlaying: false }));
          audioSynthesizer.stopAll();

          // stop rAF on next cleanup by flipping isPlaying
          return { ...prev, currentTime: 0, isPlaying: false };
        }

        // keep audio currentTime in sync for UI
        setAudio(prevAudio => ({ ...prevAudio, currentTime: newTime }));
        return { ...prev, currentTime: newTime };
      });

      // queue next frame if still playing
      rafIdRef.current = requestAnimationFrame(step);
    };

    rafIdRef.current = requestAnimationFrame(step);

    return () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      lastFrameTsRef.current = null;
    };
  }, [timeline.isPlaying, actualSongDuration, noteHits, audioSynthesizer, audio.playbackRate, currentSong]);
  
  // Play notes at the right time - FIXED: Removed timeline.currentTime dependency to prevent constant re-triggering
  useEffect(() => {
    if (timeline.isPlaying && audio.isLoaded) {
      playCurrentNotes();
    }
  }, [timeline.isPlaying, audio.isLoaded, playCurrentNotes]); // Removed timeline.currentTime to fix jerky playback
  
  // Song change handler - Updated to work with imported songs
  const handleSongChange = useCallback(async (songId: string) => {
    console.log('Attempting to change song to:', songId);
    
    // Use new getSongById function that searches both default and saved songs
    const song = await getSongById(songId);
    
    if (song) {
      console.log('Successfully found and loading song:', song.title);
      setCurrentSong(song);
      
      // Save last selected song ID to localStorage for default song loading
      try {
        localStorage.setItem('vocalCoach_lastSelectedSong', songId);
      } catch (error) {
        console.error('Failed to save last selected song:', error);
      }
      
      setTimeline(prev => ({ ...prev, currentTime: 0, isPlaying: false }));
      setResults(null);
      setNoteHits(new Set());
      setVoiceHistory([]);
      audioSynthesizer.stopAll();
    } else {
      console.error('Song not found:', songId);
      // Try to fallback to available songs list
      const fallbackSong = availableSongs.find(s => s.id === songId);
      if (fallbackSong) {
        console.log('Found song in fallback search:', fallbackSong.title);
        setCurrentSong(fallbackSong);
        
        // Save last selected song ID even for fallback
        try {
          localStorage.setItem('vocalCoach_lastSelectedSong', songId);
        } catch (error) {
          console.error('Failed to save last selected song:', error);
        }
        
        setTimeline(prev => ({ ...prev, currentTime: 0, isPlaying: false }));
        setResults(null);
        setNoteHits(new Set());
        setVoiceHistory([]);
        audioSynthesizer.stopAll();
      }
    }
  }, [audioSynthesizer, availableSongs]);
  
  // Refresh songs list - for when new songs are imported
  const refreshSongs = useCallback(async () => {
    const allSongs = await getAllAvailableSongs();
    setAvailableSongs(allSongs);
  }, []);
  
  // Export current song to TSV file
  const handleExportSong = useCallback(() => {
    if (!currentSong) return;
    
    try {
      const exportText = exportSongToText(currentSong);
      const blob = new Blob([exportText], { type: 'text/tab-separated-values' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentSong.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_notes.tsv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export song:', error);
      // Could show a toast notification here instead of alert
    }
  }, [currentSong]);
  
  // Restart current song
  const handleRestart = useCallback(() => {
    setTimeline(prev => ({ ...prev, currentTime: 0, isPlaying: false }));
    setResults(null);
    setNoteHits(new Set());
    setVoiceHistory([]);
    audioSynthesizer.stopAll();
  }, [audioSynthesizer]);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setTimeline(prev => ({ 
        ...prev, 
        viewportWidth: window.innerWidth 
      }));
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Handle spacebar for play/pause
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle spacebar when not in an input field
      if (event.code === 'Space' && 
          event.target instanceof HTMLElement && 
          !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
        event.preventDefault();
        togglePlayback();
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [togglePlayback]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioSynthesizer.cleanup();
    };
  }, [audioSynthesizer]);
  
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col overflow-y-auto md:overflow-hidden md:h-screen">
      {/* Loading state while songs are initializing */}
      {!currentSong ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <div className="text-xl text-gray-400">Loading songs...</div>
          </div>
        </div>
      ) : (
        <>
          {/* Isolated Microphone Analyzer - completely separate from UI timeline */}
          <MicrophoneAnalyzer
            isPlaying={timeline.isPlaying}
            isMuted={microphone.isMuted}
            currentTimeRef={currentTimeRef}
            currentSong={currentSong}
            transpositionSemitones={transpositionSemitones}
            onVoiceAnalysisUpdate={debouncedVoiceAnalysisUpdate}
            onVoiceHistoryUpdate={handleVoiceHistoryUpdate}
            onNoteHit={handleNoteHit}
            onMicrophoneStateChange={handleMicrophoneStateChange}
          />
          
          {/* Fixed Header */}
          <header className="h-16 bg-gray-800 border-b border-gray-700 px-6 flex-shrink-0 flex items-center justify-between">
            {/* Desktop: Show title and song info / Mobile: Hide */}
            <div className="hidden md:flex items-center space-x-4">
              <h1 className="text-xl font-bold text-white">Vocal Coach</h1>
              <div className="text-sm text-gray-400">
                {currentSong.title} • {currentSong.artist} • {transposeKey(currentSong.key, transpositionSemitones)}{transpositionSemitones !== 0 ? ` (${transpositionSemitones > 0 ? '+' : ''}${transpositionSemitones})` : ''}
              </div>
            </div>
            
            {/* Mobile: Empty space for balance / Desktop: Hidden */}
            <div className="block md:hidden flex-1"></div>
            
            <VoiceAnalyzer 
              voiceAnalysis={voiceAnalysis}
              microphone={microphone}
            />
          </header>
      
      {/* Controls */}
      <div className="flex-shrink-0">
        <Controls
          isPlaying={timeline.isPlaying}
          currentSong={currentSong}
          onTogglePlayback={togglePlayback}
          currentTime={timeline.currentTime}
          microphoneError={microphone.error}
          availableSongs={availableSongs}
          onSongChange={handleSongChange}
          microphone={microphone}
          onToggleMicrophoneMute={toggleMicrophoneMute}
          onSongsUpdate={refreshSongs}
          onExportSong={handleExportSong}
          noteSoundEnabled={noteSoundEnabled}
          onToggleNoteSound={toggleNoteSound}
        />
      </div>
      
      {/* Timeline - Large Section */}
      <div className="flex-1 min-h-0 relative">
        {/* Countdown Overlay */}
        {countdown && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="text-8xl font-bold text-white animate-pulse">
              {countdown}
            </div>
          </div>
        )}
        
        <Timeline
          song={currentSong}
          timeline={timeline}
          voiceAnalysis={voiceAnalysis}
          voiceHistory={voiceHistory}
          onTimelineChange={(changes) => setTimeline(prev => ({ ...prev, ...changes }))}
          transpositionSemitones={transpositionSemitones}
          onTransposeUp={transposeUp}
          onTransposeDown={transposeDown}
        />
      </div>
      
      {/* Bottom Panel with corrected layout */}
      <div className="h-12 bg-gray-800 border-t border-gray-700 p-2 flex-shrink-0">
        <div className="flex items-center justify-between h-full px-4">
          {/* LEFT: Download Notes button */}
          <button
            onClick={handleExportSong}
            disabled={timeline.isPlaying}
            className="text-xs text-blue-400 hover:text-blue-300 underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download Notes"
          >
            Download Notes
          </button>
          
          {/* CENTER: Spacebar instruction */}
          <div className="text-xs text-gray-500">
            Use SPACEBAR to Play/Pause
          </div>
          
          {/* RIGHT: Empty space for balance */}
          <div className="w-20"></div>
        </div>
      </div>
      
          {/* Results Modal */}
          {results && (
            <ResultsDisplay
              results={results}
              onClose={() => setResults(null)}
              onRestart={handleRestart}
              onChooseSong={() => {
                setResults(null);
                setSongSelectionModal(true);
              }}
            />
          )}
          
          {/* Song Selection Modal */}
          <SongSelectionModal
            isOpen={songSelectionModal}
            onClose={() => setSongSelectionModal(false)}
            currentSong={currentSong}
            availableSongs={availableSongs}
            onSongChange={handleSongChange}
            onSongsUpdate={refreshSongs}
            isPlaying={timeline.isPlaying}
          />
        </>
      )}
    </div>
  );
}

export default App;
