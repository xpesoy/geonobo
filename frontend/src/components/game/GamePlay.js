// frontend/src/components/game/GamePlay.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import MapillaryViewer from './MapillaryViewer';
import GuessMap from './GuessMap';
import { calculateDistance, formatDistance, formatTime } from '../../utils/gameUtils';

const GamePlay = () => {
  const navigate = useNavigate();
  const { roomId } = useParams(); // URL에서 roomId 가져오기
  const { socket, username } = useSocket(); // SocketContext에서 소켓 가져오기
  
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
  const [error, setError] = useState('');

  useEffect(() => {
    if (!socket) {
      console.error('소켓 연결이 없습니다.');
      setError('서버 연결에 문제가 있습니다. 다시 시도해주세요.');
      return;
    }

    console.log('GamePlay 컴포넌트 마운트, roomId:', roomId);

    // 게임 이벤트 리스너 등록
    socket.on('roundStart', handleRoundStart);
    socket.on('roundEnd', handleRoundEnd);
    socket.on('gameEnd', handleGameEnd);
    socket.on('gameError', handleGameError);
    socket.on('playerSubmitted', handlePlayerSubmitted);

    // 임시 테스트용 게임 상태 설정 (API 문제 디버깅 동안 사용)
    setGameState(prev => ({
      ...prev,
      status: 'playing',
      currentRound: 1,
      maxRounds: 5,
      imageId: '1044139606487936', // 테스트용 이미지 ID
      timeLeft: 90,
      players: [{ id: 'test1', username: '테스트유저1' }]
    }));

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

    // 이미 방에 입장한 상태임을 서버에 알림
    socket.emit('requestRoomInfo', roomId);

    return () => {
      // 컴포넌트 언마운트 시 이벤트 리스너 제거
      socket.off('roundStart');
      socket.off('roundEnd');
      socket.off('gameEnd');
      socket.off('gameError');
      socket.off('playerSubmitted');
      clearInterval(timer); // 타이머 정리
    };
  }, [socket, roomId]);

  const handleRoundStart = (data) => {
    console.log('라운드 시작 이벤트 수신:', data);
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

    // 타이머 정리 (컴포넌트 언마운트나 다음 라운드 시작 시)
    return () => clearInterval(timer);
  };

  const handleRoundEnd = (data) => {
    console.log('라운드 종료 이벤트 수신:', data);
    setRoundResult(data);
    setGameState(prev => ({
      ...prev,
      status: 'waiting',
      eliminatedPlayers: [...prev.eliminatedPlayers, data.eliminatedPlayer],
      rankings: data.rankings
    }));
  };

  const handleGameEnd = (data) => {
    console.log('게임 종료 이벤트 수신:', data);
    setGameState(prev => ({
      ...prev,
      status: 'ended',
      rankings: data.finalRankings,
      winner: data.winner
    }));
  };

  const handleGameError = (errorMsg) => {
    console.error('게임 에러:', errorMsg);
    setError(errorMsg);
  };

  const handlePlayerSubmitted = (data) => {
    console.log(`플레이어 ${data.playerName}님이 추측을 제출했습니다.`);
  };

  const handleGuessSubmit = (guess) => {
    if (!socket) {
      setError('서버 연결에 문제가 있습니다.');
      return;
    }
    
    console.log('추측 제출:', guess, 'roomId:', roomId);
    setPlayerGuess(guess);
    setIsSubmitted(true);
    
    socket.emit('submitGuess', {
      roomId: roomId,
      guess: guess
    });
  };

  const getPlayerName = (playerId) => {
    if (!playerId) return '알 수 없음';
    const player = gameState.players.find(p => p.id === playerId);
    return player ? player.username : '알 수 없음';
  };

  const renderGameStatus = () => {
    if (error) {
      return (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <p>{error}</p>
          <button 
            onClick={() => navigate('/lobby')} 
            className="mt-2 bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded"
          >
            로비로 돌아가기
          </button>
        </div>
      );
    }

    if (gameState.status === 'ended') {
      return (
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">게임 종료!</h2>
          <p className="text-xl mb-2">우승자: {gameState.winner}</p>
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">최종 순위:</h3>
            {Object.entries(gameState.rankings)
              .sort((a, b) => a[1] - b[1])
              .map(([player, rank]) => (
                <p key={player} className="flex items-center justify-center gap-2">
                  <span className="font-semibold">{rank}위</span>
                  <span>{player}</span>
                </p>
              ))}
          </div>
          <button
            onClick={() => navigate('/lobby')}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            로비로 돌아가기
          </button>
        </div>
      );
    }

    if (roundResult) {
      const playerResult = roundResult.guesses[socket.id];
      const correctLocation = roundResult.correctLocation;
      const distance = playerResult ? playerResult.distance : null;

      return (
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold mb-2">라운드 {gameState.currentRound} 결과</h3>
          {distance && (
            <p className="mb-2">
              내 거리: <span className="font-semibold">{formatDistance(distance)}</span>
            </p>
          )}
          <p className="text-red-500 mb-4">
            탈락: <span className="font-semibold">{getPlayerName(roundResult.eliminatedPlayer)}</span>
          </p>
          <div className="mt-4">
            <h4 className="font-semibold">현재 순위:</h4>
            {Object.entries(gameState.rankings)
              .sort((a, b) => a[1] - b[1])
              .map(([player, rank]) => (
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
          라운드 {gameState.currentRound} / {gameState.maxRounds}
        </h3>
        <p className="text-lg">남은 시간: {formatTime(gameState.timeLeft)}</p>
        <p className="text-sm text-gray-600">
          남은 플레이어: {gameState.players.length}명
        </p>
        {isSubmitted && (
          <p className="text-green-500 mt-2">추측 제출 완료!</p>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-gray-800 text-white p-4">
        {renderGameStatus()}
      </div>
      
      <div className="flex-1 flex flex-col md:flex-row">
        <div className="w-full md:w-1/2 h-1/2 md:h-full border-b md:border-r border-gray-300">
          <MapillaryViewer 
            imageId={gameState.imageId}
            onImageLoad={(e) => console.log('이미지 로드됨:', e)}
          />
        </div>
        
        <div className="w-full md:w-1/2 h-1/2 md:h-full">
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