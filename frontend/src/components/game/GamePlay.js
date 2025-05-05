// frontend/src/components/game/GamePlay.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../../services/socket';
import MapillaryViewer from './MapillaryViewer';
import GuessMap from './GuessMap';
import { calculateDistance, formatDistance, formatTime } from '../../utils/gameUtils';

const GamePlay = () => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState({
    status: 'waiting', // waiting, playing, ended
    currentRound: 0,
    maxRounds: 0,
    timeLeft: 90,
    imageId: null,
    players: [],
    eliminatedPlayers: [],
    rankings: {},
    winner: null
  });
  const [playerGuess, setPlayerGuess] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    // 게임 이벤트 리스너
    socket.on('roundStart', handleRoundStart);
    socket.on('roundEnd', handleRoundEnd);
    socket.on('gameEnd', handleGameEnd);
    socket.on('gameError', handleGameError);
    socket.on('playerSubmitted', handlePlayerSubmitted);

    return () => {
      socket.off('roundStart');
      socket.off('roundEnd');
      socket.off('gameEnd');
      socket.off('gameError');
      socket.off('playerSubmitted');
    };
  }, []);

  const handleRoundStart = (data) => {
    setGameState(prev => ({
      ...prev,
      status: 'playing',
      currentRound: data.round,
      maxRounds: data.maxRounds,
      imageId: data.imageId,
      timeLeft: data.timeLimit,
      players: data.activePlayers
    }));
    setPlayerGuess(null);
    setRoundResult(null);
    setIsSubmitted(false);
    
    // 타이머 시작
    const timer = setInterval(() => {
      setGameState(prev => {
        if (prev.timeLeft <= 1) {
          clearInterval(timer);
          return { ...prev, timeLeft: 0 };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
  };

  const handleRoundEnd = (data) => {
    setRoundResult(data);
    setGameState(prev => ({
      ...prev,
      status: 'waiting',
      eliminatedPlayers: [...prev.eliminatedPlayers, data.eliminatedPlayer],
      rankings: data.rankings
    }));
  };

  const handleGameEnd = (data) => {
    setGameState(prev => ({
      ...prev,
      status: 'ended',
      rankings: data.finalRankings,
      winner: data.winner
    }));
  };

  const handleGameError = (error) => {
    console.error('Game error:', error);
    // 에러 메시지 표시
  };

  const handlePlayerSubmitted = (data) => {
    // 다른 플레이어가 제출했을 때 UI 업데이트
    console.log(`${data.playerName} has submitted their guess!`);
  };

  const handleGuessSubmit = (guess) => {
    setPlayerGuess(guess);
    setIsSubmitted(true);
    socket.emit('submitGuess', {
      roomId: socket.roomId,
      guess: guess
    });
  };

  const renderGameStatus = () => {
    if (gameState.status === 'ended') {
      return (
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Game Over!</h2>
          <p className="text-xl mb-2">Winner: {gameState.winner}</p>
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Final Rankings:</h3>
            {Object.entries(gameState.rankings).map(([player, rank]) => (
              <p key={player}>
                {rank}. {player}
              </p>
            ))}
          </div>
          <button
            onClick={() => navigate('/lobby')}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            Return to Lobby
          </button>
        </div>
      );
    }

    if (roundResult) {
      const playerResult = roundResult.guesses[socket.id];
      const correctLocation = roundResult.correctLocation;
      const distance = playerResult ? calculateDistance(
        correctLocation.lat,
        correctLocation.lng,
        playerResult.lat,
        playerResult.lng
      ) : null;

      return (
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold mb-2">Round {gameState.currentRound} Results</h3>
          {distance && <p>Your Distance: {formatDistance(distance)}</p>}
          <p className="text-red-500">
            Eliminated: {getPlayerName(roundResult.eliminatedPlayer)}
          </p>
          <div className="mt-4">
            <h4 className="font-semibold">Current Rankings:</h4>
            {Object.entries(gameState.rankings).map(([player, rank]) => (
              <p key={player}>
                {rank}. {player}
              </p>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">
          Round {gameState.currentRound} of {gameState.maxRounds}
        </h3>
        <p className="text-lg">Time Left: {formatTime(gameState.timeLeft)}</p>
        <p className="text-sm text-gray-600">
          Active Players: {gameState.players.length}
        </p>
      </div>
    );
  };

  const getPlayerName = (playerId) => {
    // socket 객체에서 플레이어 정보 가져오기
    return 'Player'; // 실제로는 플레이어 이름을 찾아서 반환
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-gray-800 text-white p-4">
        {renderGameStatus()}
      </div>
      
      <div className="flex-1 flex">
        <div className="w-1/2 border-r border-gray-300">
          <MapillaryViewer 
            imageId={gameState.imageId}
            onImageLoad={(e) => console.log('Image loaded:', e)}
          />
        </div>
        
        <div className="w-1/2">
          <GuessMap
            onGuessSubmit={handleGuessSubmit}
            disabled={isSubmitted || gameState.timeLeft <= 0 || gameState.status !== 'playing'}
          />
        </div>
      </div>
    </div>
  );
};

export default GamePlay;