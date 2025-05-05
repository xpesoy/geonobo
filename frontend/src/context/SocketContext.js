import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [username, setUsername] = useState(localStorage.getItem('username') || '');

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('서버에 연결되었습니다.');
    });

    return () => newSocket.close();
  }, []);

  return (
    <SocketContext.Provider value={{ socket, username, setUsername }}>
      {children}
    </SocketContext.Provider>
  );
};