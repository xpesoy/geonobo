import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import Login from './components/auth/Login';
import Lobby from './components/lobby/Lobby';
import Game from './components/game/Game';
import GamePlay from './components/game/GamePlay';
import MapillaryAuth from './components/game/MapillaryAuth';

function App() {
  return (
    <SocketProvider>
      <Router>
        <div className="min-h-screen bg-gray-100">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/room/:roomId" element={<Game />} />
            <Route path="/play/:roomId" element={<GamePlay />} />
            <Route path="/auth/mapillary/callback" element={<MapillaryAuth />} />
          </Routes>
        </div>
      </Router>
    </SocketProvider>
  );
}

export default App;