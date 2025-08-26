import React from 'react';
import { SongResults } from '../types';

interface ResultsDisplayProps {
  results: SongResults;
  onClose: () => void;
  onRestart: () => void;
  onChooseSong?: () => void;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  results,
  onClose,
  onRestart,
  onChooseSong
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    if (score >= 50) return 'text-orange-400';
    return 'text-red-400';
  };
  
  const getScoreMessage = (score: number) => {
    if (score >= 90) return 'Excellent! Perfect pitch!';
    if (score >= 70) return 'Great job! Keep it up!';
    if (score >= 50) return 'Good effort! Practice more!';
    return 'Keep practicing! You\'ll get better!';
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl p-8 max-w-lg w-full mx-4 border border-gray-700">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Song Complete!</h2>
          <div className="text-gray-400">Here's how you did:</div>
        </div>
        
        {/* Score Circle */}
        <div className="flex justify-center mb-8">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              {/* Background circle */}
              <path
                d="m18,2.0845 a 15.9155,15.9155 0 0,1 0,31.831 a 15.9155,15.9155 0 0,1 0,-31.831"
                fill="none"
                stroke="#374151"
                strokeWidth="2"
              />
              {/* Progress circle */}
              <path
                d="m18,2.0845 a 15.9155,15.9155 0 0,1 0,31.831 a 15.9155,15.9155 0 0,1 0,-31.831"
                fill="none"
                stroke={results.scorePercentage >= 90 ? '#10b981' : results.scorePercentage >= 70 ? '#f59e0b' : '#ef4444'}
                strokeWidth="2"
                strokeDasharray={`${results.scorePercentage}, 100`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className={`text-3xl font-bold ${getScoreColor(results.scorePercentage)}`}>
                  {Math.round(results.scorePercentage)}%
                </div>
                <div className="text-xs text-gray-400">Score</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Stats */}
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Notes Hit:</span>
            <span className="text-white font-semibold">
              {results.correctNotes} / {results.totalNotes}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Accuracy:</span>
            <span className={`font-semibold ${getScoreColor(results.accuracy * 100)}`}>
              {(results.accuracy * 100).toFixed(1)}%
            </span>
          </div>
          
          <div className="text-center py-4">
            <div className={`text-lg font-medium ${getScoreColor(results.scorePercentage)}`}>
              {getScoreMessage(results.scorePercentage)}
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={onRestart}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={onChooseSong || onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Choose Song
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultsDisplay;