import React, { useRef, useState } from 'react';
import { Song, MicrophoneState } from '../types';
import { exportSongToText, parseTextToSong, saveSongToStorage, getAllAvailableSongs } from '../utils/musicUtils';
import UploadModal from './UploadModal';
import SongSelectionModal from './SongSelectionModal';

interface ControlsProps {
  isPlaying: boolean;
  currentSong: Song;
  onTogglePlayback: () => void;
  currentTime: number;
  microphoneError: string | null;
  availableSongs: Song[];
  onSongChange: (songId: string) => void;
  microphone: MicrophoneState;
  onToggleMicrophoneMute: () => void;
  onSongsUpdate?: () => void;
  onExportSong?: () => void;
  noteSoundEnabled: boolean;
  onToggleNoteSound: () => void;
}

const Controls: React.FC<ControlsProps> = ({
  isPlaying,
  currentSong,
  onTogglePlayback,
  currentTime,
  microphoneError,
  availableSongs,
  onSongChange,
  microphone,
  onToggleMicrophoneMute,
  onSongsUpdate,
  onExportSong,
  noteSoundEnabled,
  onToggleNoteSound
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadModal, setUploadModal] = useState({ isOpen: false, title: '', message: '', isSuccess: false });
  const [songSelectionModal, setSongSelectionModal] = useState(false);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };
  
  const handleExportSong = () => {
    if (onExportSong) {
      onExportSong();
    }
  };
  
  const handleImportSong = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text.trim()) {
          setUploadModal({
            isOpen: true,
            title: 'Upload Failed',
            message: 'File is empty or invalid. Please check the file content.',
            isSuccess: false
          });
          return;
        }
        
        const title = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
        const song = parseTextToSong(text, title, 'Imported');
        
        if (song.notes.length === 0) {
          setUploadModal({
            isOpen: true,
            title: 'Upload Failed',
            message: 'No valid notes found in the file. Please check the format.',
            isSuccess: false
          });
          return;
        }
        
        saveSongToStorage(song);
        
        if (onSongsUpdate) {
          onSongsUpdate();
        }
        onSongChange(song.id);
        
        setUploadModal({
          isOpen: true,
          title: 'Upload Successful',
          message: `Successfully imported "${song.title}" with ${song.notes.length} notes! The song has been automatically selected.`,
          isSuccess: true
        });
      } catch (error) {
        console.error('Failed to import song:', error);
        setUploadModal({
          isOpen: true,
          title: 'Upload Failed',
          message: 'Failed to import song. Please check the file format.',
          isSuccess: false
        });
      }
    };
    
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      {/* Desktop Layout - Horizontal */}
      <div className="hidden md:flex items-center justify-between p-4 bg-gray-900 border-b border-gray-700">
        {/* Left Side - Current Song Display (Clickable) */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSongSelectionModal(true)}
            disabled={isPlaying}
            className={`px-4 py-3 bg-gray-800 text-white border border-gray-600 rounded-lg transition-all duration-200 hover:border-gray-500 hover:bg-gray-750 flex items-center space-x-2 ${
              isPlaying ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'
            }`}
            title="Click to choose song"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
            <span className="font-medium">{currentSong.title}</span>
            <span className="text-gray-400">• {currentSong.artist}</span>
            {!isPlaying && (
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>
        
        {/* Center - Main Play Control */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onToggleNoteSound}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
              noteSoundEnabled
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20'
                : 'bg-gray-600 hover:bg-gray-500 text-gray-300 shadow-lg shadow-gray-500/10'
            }`}
            title={noteSoundEnabled ? 'Mute Notes' : 'Enable Notes'}
          >
            {noteSoundEnabled ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4l-5 5H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            )}
          </button>
          
          <button
            onClick={onTogglePlayback}
            disabled={!!microphoneError}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg transition-all duration-200 ${
              isPlaying 
                ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/30' 
                : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={microphoneError || (isPlaying ? 'Stop' : 'Play & Record')}
          >
            {isPlaying ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          
          <button
            onClick={onToggleMicrophoneMute}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
              microphone.isMuted
                ? 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                : microphone.hasPermission
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
            }`}
            title={
              microphone.isMuted 
                ? 'Unmute Microphone' 
                : microphone.hasPermission 
                ? 'Mute Microphone' 
                : 'Enable Microphone (click to request permission)'
            }
          >
            {microphone.isMuted ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1a1 1 0 0 1 2 0v1a5 5 0 0 0 10 0v-1a1 1 0 0 1 2 0Z" />
              </svg>
            )}
          </button>
          
          <div className="flex items-center space-x-4 text-sm">
            {microphoneError && (
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                <span className="text-red-400 text-xs">{microphoneError}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-lg font-mono text-white">
              {formatTime(currentTime)}
            </div>
            <div className="text-xs text-gray-400">
              {formatTime(currentSong.duration)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Layout - 3 Rows */}
      <div className="flex md:hidden flex-col bg-gray-900 border-b border-gray-700 p-3 space-y-3">
        {/* Row 1: Song Selection Button */}
        <div className="flex justify-center">
          <button
            onClick={() => setSongSelectionModal(true)}
            disabled={isPlaying}
            className={`px-4 py-2 bg-gray-800 text-white border border-gray-600 rounded-lg transition-all duration-200 hover:border-gray-500 hover:bg-gray-750 flex items-center space-x-2 max-w-full ${
              isPlaying ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'
            }`}
            title="Click to choose song"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
            <span className="font-medium truncate">{currentSong.title}</span>
            <span className="text-gray-400 truncate">• {currentSong.artist}</span>
            {!isPlaying && (
              <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>
        
        {/* Row 2: Control Buttons */}
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={onToggleNoteSound}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
              noteSoundEnabled
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20'
                : 'bg-gray-600 hover:bg-gray-500 text-gray-300 shadow-lg shadow-gray-500/10'
            }`}
            title={noteSoundEnabled ? 'Mute Notes' : 'Enable Notes'}
          >
            {noteSoundEnabled ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4l-5 5H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            )}
          </button>
          
          <button
            onClick={onTogglePlayback}
            disabled={!!microphoneError}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg transition-all duration-200 ${
              isPlaying 
                ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/30' 
                : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={microphoneError || (isPlaying ? 'Stop' : 'Play & Record')}
          >
            {isPlaying ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          
          <button
            onClick={onToggleMicrophoneMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
              microphone.isMuted
                ? 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                : microphone.hasPermission
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
            }`}
            title={
              microphone.isMuted 
                ? 'Unmute Microphone' 
                : microphone.hasPermission 
                ? 'Mute Microphone' 
                : 'Enable Microphone (click to request permission)'
            }
          >
            {microphone.isMuted ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1a1 1 0 0 1 2 0v1a5 5 0 0 0 10 0v-1a1 1 0 0 1 2 0Z" />
              </svg>
            )}
          </button>
        </div>
        
        {/* Row 3: Time Display and Progress */}
        <div className="flex items-center justify-between px-2">
          <div className="text-sm font-mono text-white">
            {formatTime(currentTime)}
          </div>
          <div className="flex-1 mx-4 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-200"
              style={{ width: `${(currentTime / currentSong.duration) * 100}%` }}
            />
          </div>
          <div className="text-sm font-mono text-gray-400">
            {formatTime(currentSong.duration)}
          </div>
        </div>
        
        {/* Error Display for Mobile */}
        {microphoneError && (
          <div className="flex items-center justify-center space-x-2 px-4 py-2 bg-red-900/30 border border-red-500/30 rounded-lg">
            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span className="text-red-400 text-sm">{microphoneError}</span>
          </div>
        )}
      </div>

      <SongSelectionModal
        isOpen={songSelectionModal}
        onClose={() => setSongSelectionModal(false)}
        currentSong={currentSong}
        availableSongs={availableSongs}
        onSongChange={onSongChange}
        onSongsUpdate={onSongsUpdate}
        isPlaying={isPlaying}
      />
      
      <UploadModal
        isOpen={uploadModal.isOpen}
        onClose={() => setUploadModal(prev => ({ ...prev, isOpen: false }))}
        title={uploadModal.title}
        message={uploadModal.message}
        isSuccess={uploadModal.isSuccess}
      />
      
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        onChange={handleImportSong}
        style={{ display: 'none' }}
      />
    </>
  );
};

export default Controls;