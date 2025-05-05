const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const mapillaryService = require('./utils/mapillaryUtils');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 게임방 관리
const rooms = {};

app.get('/', (req, res) => {
  res.send('Geonobo 서버가 실행 중입니다!');
});

io.on('connection', (socket) => {
  console.log('새로운 클라이언트가 연결되었습니다:', socket.id);

  // 방 목록 요청
  socket.on('requestRooms', () => {
    broadcastRoomList();
  });

  // 방 생성
  socket.on('createRoom', ({ roomName, creator }) => {
    const roomId = Math.random().toString(36).substr(2, 9);
    rooms[roomId] = {
      id: roomId,
      name: roomName,
      host: creator,
      players: [],
      status: 'waiting',
      maxPlayers: 10,
      // 게임 관련 추가 속성
      currentRound: 0,
      maxRounds: 0,
      eliminatedPlayers: [],
      playerScores: {},
      currentLocation: null,
      roundStartTime: null,
      roundEndTime: null,
      playerGuesses: {},
      roundTimer: null
    };
    
    console.log(`방 생성: ${roomName} (ID: ${roomId})`);
    broadcastRoomList();
  });

  // 방 입장
  socket.on('joinRoom', ({ roomId, username }) => {
    const room = rooms[roomId];
    
    if (!room) {
      socket.emit('error', '방을 찾을 수 없습니다.');
      return;
    }
    
    if (room.players.length >= room.maxPlayers) {
      socket.emit('error', '방이 가득 찼습니다.');
      return;
    }
    
    if (room.status !== 'waiting') {
      socket.emit('error', '게임이 이미 시작되었습니다.');
      return;
    }
    
    socket.join(roomId);
    room.players.push({ id: socket.id, username });
    
    console.log(`${username}님이 ${room.name} 방에 입장했습니다.`);
    
    // 클라이언트에게 방 입장 성공 알림
    socket.emit('joinedRoom', roomId);
    
    // 방 정보 전송
    io.to(roomId).emit('playerUpdate', room);
    
    broadcastRoomList();
  });

  // 방 정보 요청 처리
  socket.on('requestRoomInfo', (roomId) => {
    const room = rooms[roomId];
    if (room) {
      socket.emit('roomInfo', room);
    } else {
      socket.emit('error', '방을 찾을 수 없습니다.');
    }
  });

  // 방 나가기
  socket.on('leaveRoom', (roomId) => {
    leaveRoomHandler(socket, roomId);
  });

  // 게임 시작 이벤트 처리 (수정된 버전)
  socket.on('startGame', async (roomId) => {
    const room = rooms[roomId];
    
    if (!room) {
      socket.emit('error', '방을 찾을 수 없습니다.');
      return;
    }
    
    if (room.players.length < 4) {
      socket.emit('error', '최소 4명이 필요합니다.');
      return;
    }
    
    room.status = 'playing';
    room.currentRound = 1;
    room.maxRounds = room.players.length - 1; // 5명이면 4라운드
    room.eliminatedPlayers = [];
    room.playerScores = {};
    
    // 게임 시작 이벤트 발송 (추가된 부분)
    io.to(roomId).emit('gameStarted');
    console.log(`게임 시작 이벤트 전송: ${roomId}`);
    
    // 첫 라운드 시작
    await startRound(room);
    
    console.log(`게임 시작: ${room.name}`);
    broadcastRoomList();
  });

  // 플레이어의 추측 위치 처리
  socket.on('submitGuess', ({ roomId, guess }) => {
    const room = rooms[roomId];
    
    if (!room || room.status !== 'playing') return;
    
    if (!room.eliminatedPlayers.includes(socket.id)) {
      // 거리 계산
      const distance = calculateDistance(
        room.currentLocation.lat,
        room.currentLocation.lng,
        guess.lat,
        guess.lng
      );
      
      room.playerGuesses[socket.id] = {
        ...guess,
        distance,
        timestamp: Date.now()
      };
      
      // 모든 플레이어에게 누가 제출했는지 알림
      io.to(roomId).emit('playerSubmitted', {
        playerId: socket.id,
        playerName: room.players.find(p => p.id === socket.id)?.username
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('클라이언트가 연결을 끊었습니다:', socket.id);
    
    // 모든 방에서 플레이어 제거
    for (const roomId in rooms) {
      leaveRoomHandler(socket, roomId);
    }
  });
});

// 새로운 라운드 시작
async function startRound(room) {
  try {
    // Mapillary에서 랜덤 위치 가져오기
    const location = await mapillaryService.getRandomLocation();
    
    room.currentLocation = location;
    room.roundStartTime = Date.now();
    room.roundEndTime = room.roundStartTime + 90000; // 90초
    room.playerGuesses = {};
    
    // 모든 플레이어에게 라운드 시작 알림
    io.to(room.id).emit('roundStart', {
      round: room.currentRound,
      maxRounds: room.maxRounds,
      imageId: location.imageId,
      timeLimit: 90, // 초
      activePlayers: room.players.filter(p => !room.eliminatedPlayers.includes(p.id))
    });
    
    // 라운드 타이머 설정
    room.roundTimer = setTimeout(() => {
      endRound(room);
    }, 90000);
    
  } catch (error) {
    console.error('Error starting round:', error);
    io.to(room.id).emit('gameError', '위치를 불러오는데 실패했습니다.');
  }
}

// 라운드 종료
function endRound(room) {
  // 답변하지 않은 플레이어는 자동으로 가장 먼 점수
  const maxLat = 85;
  const maxLng = 180;
  
  room.players.forEach(player => {
    if (!room.eliminatedPlayers.includes(player.id) && !room.playerGuesses[player.id]) {
      room.playerGuesses[player.id] = {
        lat: maxLat,
        lng: maxLng,
        distance: Number.MAX_VALUE
      };
    }
  });
  
  // 거리 계산 및 탈락자 결정
  const activePlayers = room.players.filter(p => !room.eliminatedPlayers.includes(p.id));
  
  if (activePlayers.length > 1) {
    let maxDistance = -1;
    let eliminatedPlayer = null;
    
    activePlayers.forEach(player => {
      const guess = room.playerGuesses[player.id];
      if (guess && guess.distance > maxDistance) {
        maxDistance = guess.distance;
        eliminatedPlayer = player;
      }
    });
    
    if (eliminatedPlayer) {
      room.eliminatedPlayers.push(eliminatedPlayer.id);
      
      // 순위 기록
      const rank = room.players.length - room.eliminatedPlayers.length + 1;
      room.playerScores[eliminatedPlayer.username] = rank;
    }
  }
  
  // 라운드 결과 전송
  io.to(room.id).emit('roundEnd', {
    correctLocation: room.currentLocation,
    guesses: room.playerGuesses,
    eliminatedPlayer: room.eliminatedPlayers[room.eliminatedPlayers.length - 1],
    rankings: room.playerScores
  });
  
  // 다음 라운드로 진행 또는 게임 종료
  if (activePlayers.length <= 1 || room.currentRound >= room.maxRounds) {
    // 게임 종료
    setTimeout(() => {
      endGame(room);
    }, 5000);
  } else {
    // 다음 라운드 시작
    room.currentRound++;
    setTimeout(() => {
      startRound(room);
    }, 5000);
  }
}

// 게임 종료
function endGame(room) {
  room.status = 'finished';
  
  io.to(room.id).emit('gameEnd', {
    finalRankings: room.playerScores,
    winner: room.players.find(p => !room.eliminatedPlayers.includes(p.id))?.username
  });
  
  // 5분 후 방 자동 삭제
  setTimeout(() => {
    delete rooms[room.id];
    broadcastRoomList();
  }, 300000);
}

// 하버사인 공식으로 거리 계산 (km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 지구 반지름 (km)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI/180);
}

// 방 나가기 핸들러
function leaveRoomHandler(socket, roomId) {
  const room = rooms[roomId];
  if (!room) return;
  
  // 방에서 플레이어 제거
  const playerIndex = room.players.findIndex(player => player.id === socket.id);
  if (playerIndex !== -1) {
    const leavingPlayer = room.players[playerIndex];
    room.players.splice(playerIndex, 1);
    socket.leave(roomId);
    
    console.log(`${leavingPlayer.username}님이 ${room.name} 방에서 나갔습니다.`);
    
    // 게임 중이면서 활성 플레이어가 나가는 경우 처리
    if (room.status === 'playing' && !room.eliminatedPlayers.includes(socket.id)) {
      room.eliminatedPlayers.push(socket.id);
      const rank = room.players.length - room.eliminatedPlayers.length + 2;
      room.playerScores[leavingPlayer.username] = rank;
      
      // 라운드 종료 체크
      const activePlayers = room.players.filter(p => !room.eliminatedPlayers.includes(p.id));
      if (activePlayers.length <= 1) {
        // 게임 즉시 종료
        if (room.roundTimer) {
          clearTimeout(room.roundTimer);
        }
        endGame(room);
      }
    }
    
    // 방이 비어있으면 삭제
    if (room.players.length === 0) {
      delete rooms[roomId];
      console.log(`방 삭제: ${room.name}`);
    } else {
      // 방에 있는 다른 플레이어들에게 알림
      io.to(roomId).emit('playerUpdate', room);
    }
    
    broadcastRoomList();
  }
}

// 모든 클라이언트에게 방 목록 전송
function broadcastRoomList() {
  const roomList = Object.values(rooms).map(room => ({
    id: room.id,
    name: room.name,
    host: room.host,
    players: room.players.length,
    maxPlayers: room.maxPlayers,
    status: room.status
  }));
  io.emit('roomList', roomList);
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});