import React, { useEffect, useRef, useCallback } from 'react';
import { VoiceAnalysis, MicrophoneState, PitchDetectionResult, VoiceHistory } from '../types';
import { PitchDetector } from '../utils/pitchDetection';
import { frequencyToMidi, getMidiNoteName, getMidiNoteNameOnly, centsFromFrequencies, isOctaveEquivalent, transposeNote } from '../utils/musicUtils';

// Deviation in cents wrapped to the nearest octave ([-600, 600] range)
const centsToNearestOctave = (targetHz: number, detectedHz: number): number => {
  if (!isFinite(targetHz) || !isFinite(detectedHz) || targetHz <= 0 || detectedHz <= 0) return 0;
  let cents = 1200 * Math.log2(detectedHz / targetHz);
  // wrap into [-600, 600]
  while (cents > 600) cents -= 1200;
  while (cents < -600) cents += 1200;
  return cents;
};

interface MicrophoneAnalyzerProps {
  isPlaying: boolean;
  isMuted: boolean;
  currentTimeRef: React.MutableRefObject<number>;
  currentSong: any;
  transpositionSemitones: number;
  onVoiceAnalysisUpdate: (analysis: VoiceAnalysis) => void;
  onVoiceHistoryUpdate: (history: VoiceHistory) => void;
  onNoteHit: (noteId: string) => void;
  onMicrophoneStateChange: (state: Partial<MicrophoneState>) => void;
}

const MicrophoneAnalyzer: React.FC<MicrophoneAnalyzerProps> = ({
  isPlaying,
  isMuted,
  currentTimeRef,
  currentSong,
  transpositionSemitones,
  onVoiceAnalysisUpdate,
  onVoiceHistoryUpdate,
  onNoteHit,
  onMicrophoneStateChange
}) => {
  const pitchDetectorRef = useRef<PitchDetector | null>(null);
  const analysisIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isInitializingRef = useRef(false);
  
  const lastUIUpdateTsRef = useRef(0);
  const UI_UPDATE_MS = 66; // ~15 Hz
  const historyBufferRef = useRef<VoiceHistory[]>([]);
  const lastHistoryFlushTsRef = useRef(0);
  const HISTORY_FLUSH_MS = 100; // 10 Hz
  const currentNoteIndexRef = useRef(0);
  const lastHitNoteIdRef = useRef<string | null>(null);
  
  // Initialize microphone when needed - Enhanced cross-browser error handling and retries
  const initializeMicrophone = useCallback(async () => {
    if (pitchDetectorRef.current || isInitializingRef.current) {
      return; // Already initialized or initializing
    }
    
    isInitializingRef.current = true;
    onMicrophoneStateChange({ isRequestingPermission: true, error: null });
    
    try {
      console.log('Initializing microphone...');
      const detector = new PitchDetector();
      
      // Enhanced initialization with retry logic
      let initSuccess = false;
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await detector.initialize();
          pitchDetectorRef.current = detector;
          initSuccess = true;
          break;
        } catch (attemptError) {
          lastError = attemptError as Error;
          console.warn(`Microphone initialization attempt ${attempt} failed:`, attemptError);
          
          if (attempt < 3) {
            // Wait before retry (helps with browser timing issues)
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          }
        }
      }
      
      if (initSuccess) {
        onMicrophoneStateChange({ 
          isEnabled: true, 
          hasPermission: true,
          isRequestingPermission: false,
          error: null 
        });
        
        console.log('Microphone initialized successfully');
      } else {
        throw lastError || new Error('Failed to initialize after retries');
      }
    } catch (error) {
      console.error('Failed to initialize microphone:', error);
      const errorMessage = error instanceof Error ? error.message : 'Microphone access failed';
      onMicrophoneStateChange({ 
        isEnabled: false, 
        hasPermission: false,
        isRequestingPermission: false,
        error: errorMessage
      });
      pitchDetectorRef.current = null;
    } finally {
      isInitializingRef.current = false;
    }
  }, [onMicrophoneStateChange]);
  
  useEffect(() => {
    currentNoteIndexRef.current = 0;
    lastHitNoteIdRef.current = null;
  }, [currentSong]);
  
  // Release microphone completely
  const releaseMicrophone = useCallback(() => {
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }

    if (pitchDetectorRef.current) {
      pitchDetectorRef.current.cleanup();
      pitchDetectorRef.current = null;
    }

    // reset fast-path state
    historyBufferRef.current = [];
    currentNoteIndexRef.current = 0;
    lastHitNoteIdRef.current = null;
    lastUIUpdateTsRef.current = 0;
    lastHistoryFlushTsRef.current = 0;

    onMicrophoneStateChange({ isRecording: false });
  }, [onMicrophoneStateChange]);
  
  // Start analysis loop - Enhanced error handling and browser compatibility
  const startAnalysis = useCallback(() => {
    if (analysisIntervalRef.current || !pitchDetectorRef.current) {
      return;
    }
    
    console.log('Starting voice analysis...');
    onMicrophoneStateChange({ isRecording: true });
    
    analysisIntervalRef.current = setInterval(() => {
      const detector = pitchDetectorRef.current;
      if (!detector) return;

      try {
        const now = Date.now();
        const pitchResult = detector.detectPitch();

        // Determine current target note in O(1) amortized time using a moving index
        const notes: any[] = currentSong?.notes || [];
        const idxRef = currentNoteIndexRef;
        const t = currentTimeRef.current;
        let idx = idxRef.current;

        // advance index while we've passed the end of current note
        while (idx < notes.length && t > notes[idx].time + notes[idx].duration) idx++;
        // (optional) allow small backward moves if user restarts/rewinds
        while (idx > 0 && t < notes[idx].time) idx--;
        idxRef.current = idx;

        const candidate = idx < notes.length ? notes[idx] : null;
        const inNote = candidate && t >= candidate.time && t <= candidate.time + candidate.duration;
        const targetNote = inNote ? transposeNote(candidate, transpositionSemitones) : null;

        if (pitchResult && isFinite(pitchResult.frequency) && isFinite(pitchResult.pitch)) {
          // Build VoiceAnalysis (use fields from detector directly, avoid extra conversions)
          const analysis: VoiceAnalysis = {
            currentPitch: {
              frequency: pitchResult.frequency,
              pitch: pitchResult.pitch,
              noteName: pitchResult.noteName,
              noteNameOnly: pitchResult.noteNameOnly,
              confidence: pitchResult.confidence,
              clarity: pitchResult.clarity,
              timestamp: now,
            },
            targetNote: targetNote || null,
            accuracy: 0,
            deviation: 0,
            isOnPitch: false,
            octaveAdjusted: false,
          };

          if (targetNote) {
            const deviation = centsToNearestOctave(targetNote.frequency, pitchResult.frequency);
            const octaveAdjusted = isOctaveEquivalent(targetNote.pitch, pitchResult.pitch);
            const isOnPitch = Math.abs(deviation) <= 50 || octaveAdjusted;
            const accuracy = Math.max(0, 1 - Math.abs(deviation) / 1200);

            analysis.accuracy = accuracy;
            analysis.deviation = deviation;
            analysis.isOnPitch = isOnPitch;
            analysis.octaveAdjusted = octaveAdjusted;

            // Guarded note hit: only once per note id
            if (isOnPitch && targetNote.id && lastHitNoteIdRef.current !== targetNote.id) {
              lastHitNoteIdRef.current = targetNote.id;
              onNoteHit(targetNote.id);
            }
          } else {
            // If we are outside any note, reset the last-hit guard
            lastHitNoteIdRef.current = null;
          }

          // Throttle UI updates to ~15 Hz
          if (now - lastUIUpdateTsRef.current >= UI_UPDATE_MS) {
            lastUIUpdateTsRef.current = now;
            onVoiceAnalysisUpdate(analysis);
          }

          // Buffer history and flush at 10 Hz
          if (isFinite(t) && isFinite(pitchResult.pitch)) {
            historyBufferRef.current.push({
              time: t,
              pitch: pitchResult.pitch,
              isOnPitch: analysis.isOnPitch,
            });
          }
          if (now - lastHistoryFlushTsRef.current >= HISTORY_FLUSH_MS) {
            lastHistoryFlushTsRef.current = now;
            const buf = historyBufferRef.current;
            if (buf.length) {
              for (const point of buf) onVoiceHistoryUpdate(point);
              historyBufferRef.current = [];
            }
          }
        } else {
          // No pitch detected — send sparse UI clears (respecting throttle)
          if (now - lastUIUpdateTsRef.current >= UI_UPDATE_MS) {
            lastUIUpdateTsRef.current = now;
            onVoiceAnalysisUpdate({
              currentPitch: null,
              targetNote: null,
              accuracy: 0,
              deviation: 0,
              isOnPitch: false,
              octaveAdjusted: false,
            });
          }
        }
      } catch (error) {
        console.error('Error in voice analysis:', error);
        // Continue the loop despite errors
      }
    }, 80); // Optimized frequency for cross-browser performance
  }, [currentTimeRef, currentSong, onVoiceAnalysisUpdate, onVoiceHistoryUpdate, onNoteHit, onMicrophoneStateChange]);
  
  // Stop analysis loop
  const stopAnalysis = useCallback(() => {
    console.log('Stopping voice analysis...');
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
    onMicrophoneStateChange({ isRecording: false });
  }, [onMicrophoneStateChange]);
  
  // MAIN EFFECT: Handle microphone lifecycle - FIXED: Proper async handling
  useEffect(() => {
    const shouldRecord = isPlaying && !isMuted;
    const hasDetector = pitchDetectorRef.current !== null;
    const isAnalyzing = analysisIntervalRef.current !== null;
    
    console.log('Microphone lifecycle check:', { 
      shouldRecord, 
      hasDetector, 
      isAnalyzing,
      isPlaying,
      isMuted
    });
    
    if (shouldRecord) {
      if (!hasDetector && !isInitializingRef.current) {
        // Need to initialize microphone first
        initializeMicrophone().then(() => {
          // Start analysis after successful initialization
          if (pitchDetectorRef.current && !analysisIntervalRef.current) {
            startAnalysis();
          }
        });
      } else if (hasDetector && !isAnalyzing) {
        // Microphone ready, start analysis
        startAnalysis();
      }
    } else {
      if (isAnalyzing) {
        // Stop analysis when not needed
        stopAnalysis();
      }
      if (hasDetector && !isPlaying) {
        // Release microphone completely when stopped
        releaseMicrophone();
      }
    }
  }, [isPlaying, isMuted, initializeMicrophone, startAnalysis, stopAnalysis, releaseMicrophone]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseMicrophone();
    };
  }, [releaseMicrophone]);
  
  // This component doesn't render anything visible
  return null;
};

export default MicrophoneAnalyzer;