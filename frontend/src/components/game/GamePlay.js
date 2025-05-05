// frontend/src/components/game/GamePlay.js
import React, { useState, useEffect, useRef } from 'react';
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
  const timerRef = useRef(null);
  const gameInitialized = useRef(false);
  
  // 초기 게임 데이터 로드
  useEffect(() => {
    if (gameInitialized.current) return;
    
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

    // 액세스 토큰 확인
    const accessToken = localStorage.getItem('mapillary_access_token');
  
    if (!accessToken) {
      console.log('Mapillary 인증이 필요합니다.');
      setError('게임을 시작하기 위해 Mapillary 인증이 필요합니다. 로그인해주세요.');
      return;
    }
    
    // 기본 이미지 ID 설정
    const defaultImageId = "315004160190383";
    
    // 서버에서 이미지 ID 가져오기
    fetch(`http://localhost:5000/api/mapillary/fallback-image?accessToken=${encodeURIComponent(accessToken)}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`API 요청 실패: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.imageId) {
          console.log('이미지 ID 가져옴:', data.imageId);
          gameInitialized.current = true;
          
          setGameState(prev => ({
            ...prev,
            status: 'playing',
            currentRound: 1,
            maxRounds: 5,
            imageId: data.imageId,
            timeLeft: 90,
            players: [{ id: 'test1', username: '테스트유저1' }]
          }));
          
          // 타이머 시작
          startTimer();
        } else {
          throw new Error('유효한 이미지 ID가 없습니다.');
        }
      })
      .catch(err => {
        console.error('이미지 요청 실패:', err);
        
        // 오류 시 기본 이미지로 설정
        console.log('기본 이미지 ID 사용:', defaultImageId);
        gameInitialized.current = true;
        
        setGameState(prev => ({
          ...prev,
          status: 'playing',
          currentRound: 1,
          maxRounds: 5,
          imageId: defaultImageId,
          timeLeft: 90,
          players: [{ id: 'test1', username: '테스트유저1' }]
        }));
        
        // 타이머 시작
        startTimer();
      });

    // 이미 방에 입장한 상태임을 서버에 알림
    socket.emit('requestRoomInfo', roomId);

    return () => {
      // 컴포넌트 언마운트 시 이벤트 리스너 제거
      socket.off('roundStart');
      socket.off('roundEnd');
      socket.off('gameEnd');
      socket.off('gameError');
      socket.off('playerSubmitted');
      clearInterval(timerRef.current); // 타이머 정리
    };
  }, [socket, roomId, navigate]);

  // 타이머 시작 함수
  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.timeLeft <= 1) {
          clearInterval(timerRef.current);
          return { ...prev, timeLeft: 0 };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
  };

  const handleRoundStart = (data) => {
    console.log('라운드 시작 이벤트 수신:', data);
    clearInterval(timerRef.current);
    
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
    startTimer();
  };

  const handleRoundEnd = (data) => {
    console.log('라운드 종료 이벤트 수신:', data);
    clearInterval(timerRef.current);
    
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
    clearInterval(timerRef.current);
    
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
          <div className="flex mt-2 gap-2">
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-1 px-3 rounded"
            >
              새로고침
            </button>
            <button 
              onClick={() => navigate('/auth/mapillary/callback')}
              className="bg-green-500 hover:bg-green-600 text-white font-medium py-1 px-3 rounded"
            >
              Mapillary 로그인
            </button>
            <button 
              onClick={() => navigate('/lobby')} 
              className="bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded"
            >
              로비로 돌아가기
            </button>
          </div>
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
      const playerResult = roundResult.guesses[socket?.id];
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

  // 로딩 상태 표시
  if (!gameState.imageId) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-800 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">게임 초기화 중...</h2>
          <p>파노라마 이미지를 불러오고 있습니다</p>
          {error && (
            <div className="mt-4 text-red-400 p-4 bg-red-900 bg-opacity-30 rounded">
              <p>{error}</p>
              <div className="mt-2">
                <button 
                  onClick={() => navigate('/auth/mapillary/callback')}
                  className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded text-sm mr-2"
                >
                  Mapillary 로그인
                </button>
                <button 
                  onClick={() => navigate('/lobby')}
                  className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded text-sm"
                >
                  로비로 돌아가기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-gray-800 text-white p-4">
        {renderGameStatus()}
      </div>
      
      <div className="flex-1 flex flex-col md:flex-row">
        <div className="w-full md:w-1/2 h-1/2 md:h-full border-b md:border-r border-gray-300">
          {gameState.imageId && (
            <MapillaryViewer 
              key={gameState.imageId} // 키를 이미지 ID로 설정하여 새 이미지마다 컴포넌트 재생성
              imageId={gameState.imageId}
              onImageLoad={(e) => console.log('이미지 로드됨:', e)}
            />
          )}
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