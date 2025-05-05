import React, { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useNavigate } from 'react-router-dom';

const Lobby = () => {
  const { socket, username } = useSocket();
  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket) return;

    // 방 목록 요청
    socket.emit('requestRooms');
    
    // 방 목록 업데이트 수신
    socket.on('roomList', (roomList) => {
      setRooms(roomList);
    });

    // 방 입장 성공 처리
    socket.on('joinedRoom', (roomId) => {
      navigate(`/room/${roomId}`);
    });

    // 에러 처리
    socket.on('error', (message) => {
      setError(message);
    });

    return () => {
      socket.off('roomList');
      socket.off('joinedRoom');
      socket.off('error');
    };
  }, [socket, navigate]);

  const createRoom = () => {
    if (!roomName.trim()) {
      setError('방 이름을 입력해주세요.');
      return;
    }

    if (socket) {
      socket.emit('createRoom', { roomName: roomName.trim(), creator: username });
      setRoomName('');
      setError('');
    }
  };

  const joinRoom = (roomId) => {
    if (socket) {
      socket.emit('joinRoom', { roomId, username });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-4xl sm:mx-auto w-full">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-indigo-600 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-3xl mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h2 className="text-3xl font-bold mb-6 text-center">
                  Geonobo 대기실
                </h2>
                <p className="text-center mb-8">
                  안녕하세요, <span className="font-semibold">{username}</span>님!
                </p>
                
                {error && (
                  <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                    {error}
                  </div>
                )}
                
                <div className="mt-8">
                  <h3 className="text-xl font-semibold mb-4">새 방 만들기</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="방 이름"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      onKeyPress={(e) => e.key === 'Enter' && createRoom()}
                    />
                    <button
                      onClick={createRoom}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      방 만들기
                    </button>
                  </div>
                </div>

                <div className="mt-12">
                  <h3 className="text-xl font-semibold mb-4">방 목록</h3>
                  {rooms.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-gray-500">현재 생성된 방이 없습니다.</p>
                      <p className="text-sm text-gray-400 mt-2">새 방을 만들어보세요!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rooms.map((room) => (
                        <div
                          key={room.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                          <div>
                            <h4 className="font-medium text-lg">{room.name}</h4>
                            <p className="text-sm text-gray-500">
                              방장: {room.host}
                            </p>
                            <p className="text-sm text-gray-500">
                              {room.players}/{room.maxPlayers} 플레이어 • 
                              <span className={`ml-2 ${room.status === 'waiting' ? 'text-green-600' : 'text-yellow-600'}`}>
                                {room.status === 'waiting' ? '대기 중' : '게임 중'}
                              </span>
                            </p>
                          </div>
                          <button
                            onClick={() => joinRoom(room.id)}
                            disabled={room.players >= room.maxPlayers || room.status !== 'waiting'}
                            className={`px-6 py-2 rounded-md font-medium ${
                              room.players >= room.maxPlayers || room.status !== 'waiting'
                                ? 'bg-gray-300 cursor-not-allowed text-gray-600'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                          >
                            {room.players >= room.maxPlayers ? '가득 참' : '입장'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lobby;