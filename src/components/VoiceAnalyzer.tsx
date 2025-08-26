import React from 'react';
import { VoiceAnalysis, MicrophoneState } from '../types';

interface VoiceAnalyzerProps {
  voiceAnalysis: VoiceAnalysis;
  microphone: MicrophoneState;
}

const VoiceAnalyzer: React.FC<VoiceAnalyzerProps> = ({
  voiceAnalysis,
  microphone
}) => {
  const { currentPitch, targetNote, isOnPitch, accuracy } = voiceAnalysis;
  
  return (
    <div className="flex items-center space-x-2 md:space-x-4">
      {/* Current Voice Note Display */}
      <div className="flex items-center space-x-1 md:space-x-3">
        <div className="hidden md:block text-sm text-gray-400">Your Voice:</div>
        <div className="block md:hidden text-xs text-gray-400">Voice:</div>
        <div className={`text-lg md:text-xl font-bold px-2 md:px-3 py-1 rounded-lg min-w-[50px] md:min-w-[60px] text-center ${
          currentPitch
            ? isOnPitch 
              ? 'text-green-400 bg-green-900 bg-opacity-50'
              : 'text-red-400 bg-red-900 bg-opacity-50'
            : 'text-gray-500 bg-gray-800'
        }`}>
          {currentPitch ? currentPitch.noteName : '---'}
        </div>
      </div>
      
      {/* Target Note Display - Hidden on mobile */}
      <div className="hidden md:flex items-center space-x-3 min-w-[120px]">
        <div className="text-sm text-gray-400">Target:</div>
        {targetNote ? (
          <div className="text-lg font-medium text-blue-400 px-3 py-1 rounded-lg bg-blue-900 bg-opacity-30 min-w-[50px] text-center">
            {targetNote.name}
          </div>
        ) : (
          <div className="text-lg font-medium text-gray-600 px-3 py-1 rounded-lg bg-gray-800 min-w-[50px] text-center">
            --
          </div>
        )}
      </div>
      
      {/* Accuracy Meter */}
      <div className="flex items-center space-x-1 md:space-x-2 min-w-[100px] md:min-w-[140px]">
        <div className="text-xs md:text-sm text-gray-400">Accuracy:</div>
        {currentPitch && targetNote ? (
          <>
            <div className="w-12 md:w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-200 ${
                  accuracy > 0.8 ? 'bg-green-500' : accuracy > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${accuracy * 100}%` }}
              />
            </div>
            <div className={`text-xs md:text-sm font-medium ${
              accuracy > 0.8 ? 'text-green-400' : accuracy > 0.6 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {(accuracy * 100).toFixed(0)}%
            </div>
          </>
        ) : (
          <>
            <div className="w-12 md:w-20 h-2 bg-gray-800 rounded-full"></div>
            <div className="text-xs md:text-sm text-gray-600 w-6 md:w-8">--</div>
          </>
        )}
      </div>
      
      {/* Microphone Status - Hidden on mobile */}
      <div className="hidden md:flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${
          microphone.error 
            ? 'bg-red-500'
            : microphone.isMuted
              ? 'bg-gray-500'
              : microphone.isRecording 
                ? 'bg-green-500 animate-pulse'
                : microphone.isEnabled
                  ? 'bg-blue-500'
                  : 'bg-gray-500'
        }`} />
        <div className="text-xs text-gray-400">
          {microphone.error 
            ? 'Error' 
            : microphone.isMuted
              ? 'Muted'
              : microphone.isRecording 
                ? 'Recording'
                : microphone.isEnabled
                  ? 'Ready'
                  : 'Disabled'
          }
        </div>
      </div>
    </div>
  );
};

export default VoiceAnalyzer;