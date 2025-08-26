import React, { useRef } from 'react';
import { Song } from '../types';
import { parseTextToSong, saveSongToStorage, getAllAvailableSongs, getSavedSongs } from '../utils/musicUtils';

interface SongSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong: Song;
  availableSongs: Song[];
  onSongChange: (songId: string) => void;
  onSongsUpdate?: () => void;
  isPlaying: boolean;
}

interface SongTileProps {
  song: Song;
  isSelected: boolean;
  onClick: () => void;
  isUserSong?: boolean;
}

const SongTile: React.FC<SongTileProps> = ({ song, isSelected, onClick, isUserSong = false }) => {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:scale-105 ${
        isSelected
          ? 'border-blue-500 bg-blue-900/30 shadow-lg shadow-blue-500/20'
          : 'border-gray-600 bg-gray-800 hover:border-gray-500 hover:bg-gray-750'
      }`}
    >
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white truncate">{song.title}</h3>
          {isUserSong && (
            <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full">
              User Song
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400">{song.artist}</p>
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>{song.notes.length} notes</span>
          <span>{Math.ceil(song.duration)}s</span>
        </div>
      </div>
    </div>
  );
};

const SongSelectionModal: React.FC<SongSelectionModalProps> = ({
  isOpen,
  onClose,
  currentSong,
  availableSongs,
  onSongChange,
  onSongsUpdate,
  isPlaying
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = React.useState<{ message: string; isSuccess: boolean } | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);

  if (!isOpen) return null;

  // Разделяем песни на дефолтные и пользовательские
  const savedSongs = getSavedSongs();
  const defaultSongs = availableSongs.filter(song => !savedSongs[song.id]);
  const userSongs = availableSongs.filter(song => savedSongs[song.id]);

  const handleSongSelect = (song: Song) => {
    if (isPlaying) return; // Don't allow changing songs while playing
    
    console.log('Selecting song:', song.id, song.title);
    onSongChange(song.id);
    setUploadStatus(null); // Clear upload status when selecting a song
    onClose();
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file) return;
    
    // Check file extension
    if (!file.name.toLowerCase().endsWith('.tsv')) {
      setUploadStatus({
        message: 'Please upload a .tsv file. Other formats are not supported.',
        isSuccess: false
      });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text.trim()) {
          setUploadStatus({
            message: 'File is empty or invalid. Please check the file content.',
            isSuccess: false
          });
          return;
        }
        
        // Extract title from filename
        const title = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
        const song = parseTextToSong(text, title, 'Imported');
        
        if (song.notes.length === 0) {
          setUploadStatus({
            message: 'No valid notes found in the file. Please check the format.',
            isSuccess: false
          });
          return;
        }
        
        // Save to localStorage
        saveSongToStorage(song);
        
        setUploadStatus({
          message: `Successfully imported "${song.title}" with ${song.notes.length} notes!`,
          isSuccess: true
        });
        
        // Immediately update the song list and select the new song
        if (onSongsUpdate) {
          onSongsUpdate();
        }
        
        // Auto-select uploaded song and close after showing success message
        setTimeout(() => {
          onSongChange(song.id);
          setUploadStatus(null);
          onClose();
        }, 800);
      } catch (error) {
        console.error('Failed to import song:', error);
        setUploadStatus({
          message: 'Failed to import song. Please check the file format.',
          isSuccess: false
        });
      }
    };
    
    reader.readAsText(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    setUploadStatus(null); // Clear upload status when closing
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-600 max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Choose Song</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Upload status */}
          {uploadStatus && (
            <div className={`mb-6 p-4 rounded-lg border ${
              uploadStatus.isSuccess 
                ? 'border-green-500 bg-green-900/30 text-green-400'
                : 'border-red-500 bg-red-900/30 text-red-400'
            }`}>
              {uploadStatus.message}
            </div>
          )}

          {/* Upload button with drag and drop */}
          <div className="mb-6">
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`w-full p-6 border-2 border-dashed rounded-lg transition-all duration-200 cursor-pointer ${
                isPlaying
                  ? 'border-gray-600 text-gray-500 cursor-not-allowed'
                  : isDragOver
                  ? 'border-blue-400 bg-blue-900/30 text-blue-300'
                  : 'border-blue-500 text-blue-400 hover:border-blue-400 hover:bg-blue-900/20'
              }`}
              onClick={() => !isPlaying && handleUploadClick()}
            >
              <div className="flex flex-col items-center space-y-3">
                <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <polyline points="9,15 12,12 15,15"/>
                </svg>
                <div className="text-center">
                  <p className="font-medium text-lg mb-2">
                    {isPlaying 
                      ? 'Stop playback to upload' 
                      : isDragOver 
                      ? 'Drop your .tsv file here'
                      : 'Upload New Song'
                    }
                  </p>
                  <p className="text-sm opacity-75">
                    {isDragOver 
                      ? 'Release to upload'
                      : 'Click to browse or drag & drop .tsv files'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Default songs */}
          {defaultSongs.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Built-in Songs</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {defaultSongs.map(song => (
                  <SongTile
                    key={song.id}
                    song={song}
                    isSelected={song.id === currentSong.id}
                    onClick={() => handleSongSelect(song)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* User songs */}
          {userSongs.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Your Songs</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userSongs.map(song => (
                  <SongTile
                    key={song.id}
                    song={song}
                    isSelected={song.id === currentSong.id}
                    onClick={() => handleSongSelect(song)}
                    isUserSong={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {availableSongs.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>
              <p className="text-gray-400">No songs available</p>
              <p className="text-sm text-gray-500 mt-2">Upload your songs to get started</p>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".tsv"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};

export default SongSelectionModal;