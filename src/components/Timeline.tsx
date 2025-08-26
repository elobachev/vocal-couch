import React, { useRef, useEffect } from 'react';
import { Song, VoiceAnalysis, VoiceHistory, TimelineState } from '../types';
import { isOctaveEquivalent, transposeNote } from '../utils/musicUtils';
import PianoKeyboard from './PianoKeyboard';

interface TimelineProps {
  song: Song;
  timeline: TimelineState;
  voiceAnalysis: VoiceAnalysis;
  voiceHistory: VoiceHistory[];
  onTimelineChange: (state: Partial<TimelineState>) => void;
  transpositionSemitones: number;
  onTransposeUp: () => void;
  onTransposeDown: () => void;
}

const Timeline: React.FC<TimelineProps> = ({
  song,
  timeline,
  voiceAnalysis,
  voiceHistory,
  onTimelineChange,
  transpositionSemitones,
  onTransposeUp,
  onTransposeDown
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Calculate actual song duration from notes
  const calculateSongDuration = (song: Song): number => {
    if (song.notes.length === 0) return 60; // Default fallback
    const lastNote = song.notes.reduce((latest, note) => 
      (note.time + note.duration) > (latest.time + latest.duration) ? note : latest
    );
    return Math.ceil(lastNote.time + lastNote.duration + 2); // Add 2 second buffer
  };
  
  const actualSongDuration = calculateSongDuration(song);
  
  // Auto-scroll timeline
  useEffect(() => {
    if (timeline.isPlaying && containerRef.current) {
      const container = containerRef.current;
      const scrollPosition = timeline.currentTime * timeline.zoom - container.clientWidth / 2;
      container.scrollLeft = Math.max(0, scrollPosition);
    }
  }, [timeline.currentTime, timeline.isPlaying, timeline.zoom]);
  
  // Draw timeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set canvas dimensions
    canvas.width = actualSongDuration * timeline.zoom;
    canvas.height = height;
    
    // Background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, canvas.width, height);
    
    // Draw time grid with fixed-width time markers
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    for (let i = 0; i <= actualSongDuration; i += 5) {
      const x = i * timeline.zoom;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      
      // Add time labels with fixed width
      if (i > 0) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        const timeLabel = `${Math.floor(i / 60)}:${(i % 60).toString().padStart(2, '0')}`;
        // Fixed width background for time labels
        const labelWidth = 30;
        ctx.fillStyle = 'rgba(31, 41, 55, 0.8)';
        ctx.fillRect(x - labelWidth/2, 5, labelWidth, 12);
        ctx.fillStyle = '#9ca3af';
        ctx.fillText(timeLabel, x, 14);
      }
    }
    
    // Note range for visualization (C3 to C6)
    const minPitch = 48; // C3
    const maxPitch = 84; // C6
    const pitchRange = maxPitch - minPitch;
    
    // Draw staff lines (horizontal lines for piano keys)
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;
    
    // Draw lines for each semitone
    for (let pitch = minPitch; pitch <= maxPitch; pitch++) {
      const normalizedPitch = (pitch - minPitch) / pitchRange;
      const y = height - (normalizedPitch * height * 0.8) - height * 0.1;
      
      // Emphasize octave lines (C notes)
      if (pitch % 12 === 0) {
        ctx.strokeStyle = '#6b7280';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.6;
      } else {
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.3;
      }
      
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    ctx.globalAlpha = 1; // Reset alpha
    
    // Apply transposition to notes for display
    const transposedNotes = song.notes.map(note => transposeNote(note, transpositionSemitones));
    
    // Draw notes - small uniform rectangles (increased by 20%)
    transposedNotes.forEach((note, originalIndex) => {
      const x = note.time * timeline.zoom;
      const width = note.duration * timeline.zoom;
      const normalizedPitch = (note.pitch - minPitch) / pitchRange;
      const y = height - (normalizedPitch * height * 0.8) - height * 0.1;
      const noteHeight = 10; // Increased from 8 to 10 (20% increase)
      
      // Check if this is the currently active note (use original note for timing)
      const originalNote = song.notes[originalIndex];
      const isActiveNote = timeline.currentTime >= originalNote.time && 
                          timeline.currentTime <= originalNote.time + originalNote.duration;
      
      // Color: active note gets blue highlight, others stay neutral gray
      ctx.fillStyle = isActiveNote ? '#3b82f6' : '#6b7280';
      ctx.fillRect(x, y - noteHeight/2, width, noteHeight);
      
      // Add glow effect for active note
      if (isActiveNote) {
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 8;
        ctx.fillRect(x, y - noteHeight/2, width, noteHeight);
        ctx.shadowBlur = 0;
      }
      
      // Note name (without octave) with fixed width background
      ctx.fillStyle = isActiveNote ? 'rgba(59, 130, 246, 0.3)' : 'rgba(107, 114, 128, 0.3)';
      const noteLabelWidth = 20;
      ctx.fillRect(x + width/2 - noteLabelWidth/2, y - noteHeight/2 - 16, noteLabelWidth, 12);
      
      ctx.fillStyle = isActiveNote ? '#ffffff' : '#d1d5db';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(note.name, x + width/2, y - noteHeight/2 - 2);
      
      // Removed per-note lyric drawing block as requested
    });
    
    // Draw lyrics on a single baseline at the bottom (syllable-level sync retained)
    // This replaces per-note lyric drawing and keeps highlighting for the active syllable
    (function drawLyricsBaseline() {
      const lyricBaselineY = height - 18; // baseline near the bottom

      // Optional subtle baseline under the lyrics (like a lyric line on a staff)
      ctx.save();
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, lyricBaselineY + 8);
      ctx.lineTo(canvas.width, lyricBaselineY + 8);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Draw each lyric centered under its note's time span
      song.notes.forEach(note => {
        if (!note.lyric) return;

        const x = note.time * timeline.zoom;
        const widthPx = note.duration * timeline.zoom;
        const centerX = x + widthPx / 2;

        const isActiveLyric = (
          timeline.currentTime >= note.time &&
          timeline.currentTime <= note.time + note.duration
        );

        // Text style
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = isActiveLyric ? 'bold 14px sans-serif' : '12px sans-serif';

        // Highlight background for the active lyric syllable/word
        if (isActiveLyric) {
          const metrics = ctx.measureText(note.lyric);
          const bgWidth = Math.max(metrics.width + 8, 40); // minimum sensible width
          ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
          ctx.fillRect(centerX - bgWidth / 2, lyricBaselineY - 10, bgWidth, 20);
        }

        // Lyric text itself
        ctx.fillStyle = isActiveLyric ? '#3b82f6' : '#9ca3af';
        ctx.fillText(note.lyric, centerX, lyricBaselineY);
      });

      ctx.restore();
    })();
    
    // Draw voice history trail - Real pitch line from user singing
    if (voiceHistory.length > 1) {
      // Enhanced cross-browser Canvas rendering
      ctx.save(); // Save current context state
      
      ctx.strokeStyle = '#3b82f6'; // Blue color
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Use more explicit path creation for better Chrome compatibility
      ctx.beginPath();
      let pathStarted = false;
      
      voiceHistory.forEach((point, index) => {
        const x = point.time * timeline.zoom;
        const normalizedPitch = (point.pitch - minPitch) / pitchRange;
        const y = height - (normalizedPitch * height * 0.8) - height * 0.1;
        
        // Validate coordinates to prevent Canvas issues
        if (isFinite(x) && isFinite(y) && x >= 0 && y >= 0 && y <= height) {
          if (!pathStarted || index === 0) {
            ctx.moveTo(x, y);
            pathStarted = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      
      if (pathStarted) {
        ctx.stroke();
      }
      
      // Add points for better visibility - enhanced for Chrome
      ctx.fillStyle = '#3b82f6';
      voiceHistory.forEach((point) => {
        const x = point.time * timeline.zoom;
        const normalizedPitch = (point.pitch - minPitch) / pitchRange;
        const y = height - (normalizedPitch * height * 0.8) - height * 0.1;
        
        // Validate coordinates before drawing
        if (isFinite(x) && isFinite(y) && x >= 0 && y >= 0 && y <= height) {
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
      
      ctx.restore(); // Restore context state
    }
    
    // Draw current voice pitch indicator - Enhanced cross-browser compatibility
    if (timeline.isPlaying) {
      const x = timeline.currentTime * timeline.zoom; // Move with time (X-axis)
      
      // Enhanced validation for cross-browser compatibility
      if (!isFinite(x) || x < 0) {
        return; // Skip drawing if invalid coordinates
      }
      
      ctx.save(); // Save context state
      
      // If we have current pitch, draw the indicator
      if (voiceAnalysis.currentPitch) {
        const normalizedPitch = (voiceAnalysis.currentPitch.pitch - minPitch) / pitchRange;
        const y = height - (normalizedPitch * height * 0.8) - height * 0.1; // Move with pitch (Y-axis)
        
        // Enhanced coordinate validation
        if (!isFinite(y) || y < 0 || y > height) {
          ctx.restore();
          return; // Skip if invalid coordinates
        }
        
        // Voice line color based on accuracy
        const isCorrect = voiceAnalysis.isOnPitch || 
          (voiceAnalysis.targetNote && isOctaveEquivalent(voiceAnalysis.targetNote.pitch, voiceAnalysis.currentPitch.pitch));
        
        const indicatorColor = isCorrect ? '#10b981' : '#9ca3af'; // Green for correct, neutral gray for incorrect
        ctx.strokeStyle = indicatorColor;
        ctx.fillStyle = indicatorColor;
        ctx.lineWidth = 4;
        
        // Draw current pitch indicator - vertical line that moves horizontally with time
        ctx.beginPath();
        ctx.moveTo(x, Math.max(0, y - 20)); // Ensure within bounds
        ctx.lineTo(x, Math.min(height, y + 20)); // Ensure within bounds
        ctx.stroke();
        
        // Draw pitch point with enhanced visibility
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fill();
        
        // Glow effect - improved for Chrome
        if (ctx.shadowColor !== undefined) {
          ctx.shadowColor = indicatorColor;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, 2 * Math.PI);
          ctx.fill();
          ctx.shadowBlur = 0; // Reset
        }
      } else {
        // Even without current pitch, draw a neutral timeline indicator
        ctx.strokeStyle = '#6b7280';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        
        // Draw neutral timeline indicator
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      
      ctx.restore(); // Restore context state
    }
    
    // Draw playhead
    const playheadX = timeline.currentTime * timeline.zoom;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
    
  }, [song, timeline, voiceAnalysis, voiceHistory, transpositionSemitones]);
  
  return (
    <div className="flex-1 bg-gray-900 relative overflow-hidden">
      {/* Timeline Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gray-800 border-b border-gray-700 p-2">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-300">
            {/* Removed: Timeline with Piano - Scroll follows playback */}
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs text-gray-400">Zoom:</span>
            <input
              type="range"
              min="50"
              max="200"
              value={timeline.zoom}
              onChange={(e) => onTimelineChange({ zoom: parseInt(e.target.value) })}
              className="w-20"
            />
            <span className="text-xs text-gray-400">{timeline.zoom}px/s</span>
          </div>
        </div>
      </div>
      
      {/* Main content with Piano + Timeline */}
      <div className="flex mt-12 h-full" style={{ height: 'calc(100% - 3rem)' }}>
        {/* Piano Keyboard - FIXED: Show current target note based on timeline */}
        <div className="flex flex-col">
          <PianoKeyboard 
            activeNote={
              (() => {
                const currentNote = song.notes.find(note => 
                  timeline.currentTime >= note.time && 
                  timeline.currentTime <= note.time + note.duration
                );
                return currentNote ? currentNote.pitch + transpositionSemitones : null;
              })()
            }
            height={400}
            onNoteClick={(midiNote) => {
              // Optional: Could play the clicked note for reference
              console.log('Piano key clicked:', midiNote);
            }}
          />
          
          {/* Transposition Controls */}
          <div className="flex flex-col md:flex-col items-center mt-2 px-2">
            {/* Desktop: Vertical layout / Mobile: Horizontal layout */}
            <div className="flex flex-row md:flex-col space-x-1 md:space-x-0 md:space-y-1">
              <button
                onClick={onTransposeUp}
                disabled={transpositionSemitones >= 12}
                className="w-8 h-8 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:opacity-50 rounded text-white text-xs flex items-center justify-center transition-colors"
                title="Транспозиция вверх"
              >
                <span className="hidden md:block">▲</span>
                <span className="block md:hidden">▲</span>
              </button>
              <div className="text-xs text-gray-400 text-center font-mono min-w-[2rem] flex items-center justify-center">
                {transpositionSemitones > 0 ? `+${transpositionSemitones}` : transpositionSemitones}
              </div>
              <button
                onClick={onTransposeDown}
                disabled={transpositionSemitones <= -12}
                className="w-8 h-8 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:opacity-50 rounded text-white text-xs flex items-center justify-center transition-colors"
                title="Транспозиция вниз"
              >
                <span className="hidden md:block">▼</span>
                <span className="block md:hidden">▼</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Scrollable Timeline */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden"
        >
          <canvas
            ref={canvasRef}
            className="block cursor-pointer"
            height="400"
            onClick={(e) => {
              const canvas = canvasRef.current!;
              const container = containerRef.current!;
              const rect = container.getBoundingClientRect();
              const x = e.clientX - rect.left + container.scrollLeft;
              const newTime = x / timeline.zoom;
              onTimelineChange({ currentTime: Math.max(0, Math.min(actualSongDuration, newTime)) });
            }}
          />
        </div>
      </div>
      
      {/* Legend - REMOVED: User requested to remove unnecessary labels */}
      {/* No legend labels at bottom left per user requirements */}
    </div>
  );
};

export default Timeline;