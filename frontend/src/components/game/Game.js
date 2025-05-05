import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';

const Game = () => {
  const { roomId } = useParams();
  const navigate = useNavigate(); // 추가된 부분
  const { socket, username } = useSocket();
  const [room, setRoom] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [canStart, setCanStart] = useState(false);

  useEffect(() => {
    if (socket) {
      // 방 정보 요청
      socket.emit('requestRoomInfo', roomId);

      // 방 상태 업데이트 받기
      socket.on('roomInfo', (roomData) => {
        setRoom(roomData);
        setIsHost(roomData.host === username);
        setCanStart(roomData.players.length >= 4);
      });

      // 플레이어 입장/퇴장 이벤트
      socket.on('playerUpdate', (updatedRoom) => {
        setRoom(updatedRoom);
        setCanStart(updatedRoom.players.length >= 4);
      });

      // 게임 시작 이벤트 리스너 추가 (이 부분이 추가됨)
      socket.on('gameStarted', () => {
        console.log('게임 시작 이벤트 수신!');
        navigate(`/play/${roomId}`);
      });

      return () => {
        socket.off('roomInfo');
        socket.off('playerUpdate');
        socket.off('gameStarted'); // 추가된 부분
      };
    }
  }, [socket, roomId, username, navigate]);

  const startGame = () => {
    if (socket && isHost && canStart) {
      console.log('게임 시작 요청 전송');
      socket.emit('startGame', roomId);
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
      <div className="relative py-3 sm:max-w-4xl sm:mx-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-blue-500 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">{room.name}</h2>
            <p className="text-gray-600 mb-6">방장: {room.host}</p>

            <div className="grid grid-cols-2 gap-6">
              {/* 플레이어 목록 */}
              <div>
                <h3 className="text-xl font-semibold mb-4">플레이어 ({room.players.length}/10)</h3>
                <div className="space-y-2">
                  {room.players.map((player, index) => (
                    <div
                      key={player.id}
                      className={`p-3 rounded-lg ${
                        player.username === room.host 
                          ? 'bg-indigo-100 border-indigo-300 border' 
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{player.username}</span>
                        {player.username === room.host && (
                          <span className="text-xs bg-indigo-500 text-white px-2 py-1 rounded">방장</span>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* 빈 슬롯 표시 */}
                  {[...Array(Math.max(4 - room.players.length, 0))].map((_, index) => (
                    <div key={`empty-${index}`} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                      <span className="text-gray-400">대기 중...</span>
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
                      <p className="text-green-800">게임 시작 가능!</p>
                    ) : (
                      <p className="text-yellow-800">최소 4명이 필요합니다 ({room.players.length}/4)</p>
                    )}
                  </div>

                  {isHost && (
                    <button
                      onClick={startGame}
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
                    <p className="text-center text-gray-600">방장이 게임을 시작할 때까지 기다리세요.</p>
                  )}
                </div>

                {/* 디버깅용 버튼 (필요하면 사용) */}
                <div className="mt-4">
                  <button
                    onClick={() => navigate(`/play/${roomId}`)}
                    className="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded"
                  >
                    게임 화면으로 직접 이동 (디버깅)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;