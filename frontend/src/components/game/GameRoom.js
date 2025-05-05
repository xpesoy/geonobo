import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';

const GameRoom = () => {
  const { roomId } = useParams();
  const { socket, username } = useSocket();
  const [room, setRoom] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [canStart, setCanStart] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket) return;

    // 방 정보 요청
    socket.emit('requestRoomInfo', roomId);

    // 방 정보 수신
    socket.on('roomInfo', (roomData) => {
      setRoom(roomData);
      setIsHost(roomData.host === username);
      setCanStart(roomData.players.length >= 4);
    });

    // 플레이어 업데이트 처리
    socket.on('playerUpdate', (updatedRoom) => {
      setRoom(updatedRoom);
      setCanStart(updatedRoom.players.length >= 4);
    });

    socket.on('gameStarted', () => {
      console.log(`gameStarted 이벤트 수신: ${roomId}`);
      navigate(`/play/${roomId}`);
      console.log('navigate 함수 호출 완료');
    });

    // 에러 처리
    socket.on('error', (message) => {
      setError(message);
      setTimeout(() => {
        navigate('/lobby');
      }, 3000);
    });

    return () => {
      socket.off('roomInfo');
      socket.off('playerUpdate');
      socket.off('gameStarted');
      socket.off('error');
    };
  }, [socket, roomId, username, navigate]);

  const startGame = () => {
    console.log('startGame 클릭됨!');
    console.log('socket:', socket);
    console.log('isHost:', isHost);
    console.log('canStart:', canStart);
    
    if (socket && isHost && canStart) {
      console.log('startGame 이벤트 전송');
      socket.emit('startGame', roomId);
    } else {
      console.log('조건 불충족');
    }
  };

  const leaveRoom = () => {
    if (socket) {
      socket.emit('leaveRoom', roomId);
      navigate('/lobby');
    }
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-4xl sm:mx-auto w-full">
        <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-blue-500 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold">{room.name}</h2>
              <button
                onClick={leaveRoom}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                방 나가기
              </button>
            </div>
            
            {error && (
              <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* 플레이어 목록 */}
              <div>
                <h3 className="text-xl font-semibold mb-4">
                  플레이어 ({room.players.length}/{room.maxPlayers})
                </h3>
                <div className="space-y-2">
                  {room.players.map((player, index) => (
                    <div
                      key={player.id}
                      className={`p-3 rounded-lg flex items-center justify-between ${
                        player.username === room.host 
                          ? 'bg-indigo-100 border-indigo-300 border' 
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <span className="font-medium">{player.username}</span>
                      {player.username === room.host && (
                        <span className="text-xs bg-indigo-500 text-white px-2 py-1 rounded">방장</span>
                      )}
                    </div>
                  ))}
                  
                  {/* 빈 슬롯 표시 */}
                  {room.players.length < 4 && [...Array(4 - room.players.length)].map((_, index) => (
                    <div key={`empty-${index}`} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                      <span className="text-gray-400">최소 인원 대기 중...</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 게임 준비 상태 */}
              <div>
                <h3 className="text-xl font-semibold mb-4">게임 준비</h3>
                
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg ${canStart ? 'bg-green-100' : 'bg-yellow-100'}`}>
                    {canStart ? (
                      <p className="text-green-800 font-medium">게임 시작 가능!</p>
                    ) : (
                      <p className="text-yellow-800 font-medium">
                        최소 4명이 필요합니다 ({room.players.length}/4)
                      </p>
                    )}
                  </div>

                  {isHost && (
                    <button
                    onClick={() => {
                      console.log('버튼 클릭 감지됨!');
                      startGame();
                    }}
                      disabled={!canStart}
                      className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
                        canStart
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-gray-300 cursor-not-allowed text-gray-600'
                      }`}
                    >
                      게임 시작!
                    </button>
                  )}

                  {!isHost && (
                    <div className="text-center text-gray-600 p-4 bg-gray-50 rounded-lg">
                      <p>방장이 게임을 시작할 때까지 기다리세요.</p>
                    </div>
                  )}
                </div>

                <div className="mt-8 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <h4 className="font-semibold text-indigo-800 mb-2">게임 규칙</h4>
                  <ul className="text-sm text-indigo-700 space-y-1">
                    <li>• 360도 뷰를 보고 위치를 추측합니다.</li>
                    <li>• 가장 먼 거리를 답한 1명이 탈락합니다.</li>
                    <li>• 최후의 1인이 될 때까지 경쟁합니다.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameRoom;