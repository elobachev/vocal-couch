import React from 'react';
import { getMidiNoteName } from '../utils/musicUtils';

interface PianoKeyboardProps {
  activeNote?: number | null; // Current MIDI note being played
  height: number;
  onNoteClick?: (midiNote: number) => void;
}

const PianoKeyboard: React.FC<PianoKeyboardProps> = ({ activeNote, height, onNoteClick }) => {
  // Check if a note is a black key
  const isBlackKey = (midiNote: number) => {
    const noteInOctave = midiNote % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave); // C#, D#, F#, G#, A#
  };
  
  // Piano range: C3 to C6 (same as timeline)
  const minPitch = 48; // C3
  const maxPitch = 84; // C6
  const totalKeys = maxPitch - minPitch + 1;
  
  // Key height calculation - only count white keys for spacing
  const whiteKeyCount = Array.from({ length: totalKeys }, (_, i) => {
    const midiNote = minPitch + i;
    return !isBlackKey(midiNote);
  }).filter(Boolean).length;
  
  const whiteKeyHeight = (height * 0.8) / whiteKeyCount;
  const startY = height * 0.1;
  
  // Generate keys from high to low (top to bottom)
  const keys = [];
  let whiteKeyIndex = 0;
  
  for (let midiNote = maxPitch; midiNote >= minPitch; midiNote--) {
    const isBlack = isBlackKey(midiNote);
    const isActive = activeNote === midiNote;
    const noteName = getMidiNoteName(midiNote);
    
    let y;
    if (isBlack) {
      // Black key positioning - find adjacent white key and offset
      const prevWhiteNote = midiNote - 1;
      const nextWhiteNote = midiNote + 1;
      
      // Find the y position of the previous white key
      let prevWhiteIndex = 0;
      for (let i = maxPitch; i > prevWhiteNote; i--) {
        if (!isBlackKey(i)) prevWhiteIndex++;
      }
      
      y = startY + (prevWhiteIndex * whiteKeyHeight) + whiteKeyHeight / 2;
    } else {
      // White key positioning
      y = startY + (whiteKeyIndex * whiteKeyHeight);
      whiteKeyIndex++;
    }
    
    keys.push({
      midiNote,
      y,
      isBlack,
      isActive,
      noteName,
      height: isBlack ? whiteKeyHeight * 0.6 : whiteKeyHeight - 1
    });
  }
  
  return (
    <div className="w-20 bg-gray-900 border-r border-gray-600 relative" style={{ height }}>
      <svg width="100%" height={height} className="absolute inset-0">
        {/* White keys first (behind black keys) */}
        {keys.filter(key => !key.isBlack).map((key) => (
          <g key={`white-${key.midiNote}`}>
            <rect
              x="0"
              y={key.y}
              width="80"
              height={key.height}
              fill={key.isActive ? '#3b82f6' : '#ffffff'}
              stroke={key.isActive ? '#1d4ed8' : '#d1d5db'}
              strokeWidth={key.isActive ? "3" : "1"}
              className="cursor-pointer hover:fill-gray-100"
              onClick={() => onNoteClick && onNoteClick(key.midiNote)}
            />
          </g>
        ))}
        
        {/* Black keys on top - MINIMAL FIX: Better positioning between white keys */}
        {keys.filter(key => key.isBlack).map((key) => {
          const noteInOctave = key.midiNote % 12;
          
          // Find adjacent white keys to position between them
          const lowerWhite = key.midiNote - 1; // Previous semitone (should be white)
          const upperWhite = key.midiNote + 1; // Next semitone (should be white)
          
          // Find Y positions of the adjacent white keys
          let lowerY = 0, upperY = 0;
          let whiteIndex = 0;
          
          for (let midiNote = maxPitch; midiNote >= minPitch; midiNote--) {
            if (!isBlackKey(midiNote)) {
              const whiteKeyY = startY + (whiteIndex * whiteKeyHeight);
              
              if (midiNote === lowerWhite) lowerY = whiteKeyY;
              if (midiNote === upperWhite) upperY = whiteKeyY;
              
              whiteIndex++;
            }
          }
          
          // Position black key exactly between the centers of the two white keys
          const centerY = (lowerY + upperY) / 2 + whiteKeyHeight / 2;
          const blackKeyHeight = whiteKeyHeight * 0.6;
          
          return (
            <g key={`black-${key.midiNote}`}>
              <rect
                x="10" // Small margin from edge
                y={centerY - blackKeyHeight / 2} // Center between white keys
                width="35" // Appropriate width
                height={blackKeyHeight}
                fill={key.isActive ? '#1d4ed8' : '#000000'}
                stroke={key.isActive ? '#3b82f6' : '#333333'}
                strokeWidth={key.isActive ? "3" : "1"}
                className="cursor-pointer hover:fill-gray-800"
                onClick={() => onNoteClick && onNoteClick(key.midiNote)}
              />
            </g>
          );
        })}
        
        {/* Staff lines across the keyboard - only at octave markers */}
        {keys.filter(key => !key.isBlack && key.midiNote % 12 === 0).map((key) => (
          <line
            key={`staff-${key.midiNote}`}
            x1="76"
            y1={key.y + key.height}
            x2="80"
            y2={key.y + key.height}
            stroke="#6b7280"
            strokeWidth="2"
          />
        ))}
      </svg>
    </div>
  );
};

export default PianoKeyboard;