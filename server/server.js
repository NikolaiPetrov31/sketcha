const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const rooms = {};

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('create_room', (data) => {
    const { username, roomName } = data;
    
    let roomCode = generateRoomCode();
    while (rooms[roomCode]) {
      roomCode = generateRoomCode();
    }

    rooms[roomCode] = {
      name: roomName,
      host: socket.id,
      users: [{
        id: socket.id,
        name: username,
        isHost: true,
        canDraw: true
      }],
      whiteboardElements: []
    };

    socket.join(roomCode);

    console.log(`Room created: ${roomCode} (${roomName}) by ${username}`);

    socket.emit('room_created', { 
      roomCode,
      roomName,
      users: rooms[roomCode].users,
      whiteboardElements: rooms[roomCode].whiteboardElements
    });
  });

  socket.on('join_room', (data) => {
    const { username, roomCode } = data;

    if (!rooms[roomCode]) {
      socket.emit('join_error', { message: 'Room not found. Check the code and try again.' });
      return;
    }

    rooms[roomCode].users.push({
      id: socket.id,
      name: username,
      isHost: false,
      canDraw: false
    });

    socket.join(roomCode);

    console.log(`${username} joined room: ${roomCode}`);

    socket.emit('room_joined', {
      roomCode,
      roomName: rooms[roomCode].name,
      users: rooms[roomCode].users,
      whiteboardElements: rooms[roomCode].whiteboardElements
    });

    socket.to(roomCode).emit('user_joined', {
      user: { id: socket.id, name: username, isHost: false },
      users: rooms[roomCode].users
    });
  });

  socket.on('whiteboard_update', (data) => {
    const { roomCode, elements } = data;
    if (rooms[roomCode]) {
      const user = rooms[roomCode].users.find(u => u.id === socket.id);
      if (user && user.canDraw) {
        rooms[roomCode].whiteboardElements = elements;
        socket.to(roomCode).emit('whiteboard_update', { actions: elements });
      }
    }
  });

  socket.on('whiteboard_add_action', (data) => {
    const { roomCode, action } = data;
    if (rooms[roomCode]) {
      const user = rooms[roomCode].users.find(u => u.id === socket.id);
      if (user && user.canDraw) {
        rooms[roomCode].whiteboardElements.push(action);
        socket.to(roomCode).emit('whiteboard_add_action', { action });
      }
    }
  });

  socket.on('whiteboard_drawing', (data) => {
    const { roomCode, action } = data;
    if (rooms[roomCode]) {
      const user = rooms[roomCode].users.find(u => u.id === socket.id);
      if (user && user.canDraw) {
        socket.to(roomCode).emit('whiteboard_drawing', { userId: socket.id, userName: user.name, action });
      }
    }
  });

  socket.on('whiteboard_drawing_end', (data) => {
    const { roomCode } = data;
    if (rooms[roomCode]) {
      socket.to(roomCode).emit('whiteboard_drawing_end', { userId: socket.id });
    }
  });

  socket.on('toggle_draw_access', (data) => {
    const { roomCode, targetUserId, canDraw } = data;
    const room = rooms[roomCode];
    if (room) {
      const requester = room.users.find(u => u.id === socket.id);
      if (requester && requester.isHost) {
        const targetUser = room.users.find(u => u.id === targetUserId);
        if (targetUser && !targetUser.isHost) {
          targetUser.canDraw = canDraw;
          io.to(roomCode).emit('users_updated', { users: room.users });
        }
      }
    }
  });

  socket.on('kick_user', (data) => {
    const { roomCode, targetUserId } = data;
    const room = rooms[roomCode];
    
    if (room) {
      const requester = room.users.find(u => u.id === socket.id);
      if (requester && requester.isHost && targetUserId !== socket.id) {
        const targetIndex = room.users.findIndex(u => u.id === targetUserId);
        if (targetIndex !== -1) {
          const targetUser = room.users[targetIndex];
          room.users.splice(targetIndex, 1);
          
          io.to(targetUserId).emit('kicked_from_room');
          
          const targetSocket = io.sockets.sockets.get(targetUserId);
          if (targetSocket) {
            targetSocket.leave(roomCode);
          }

          io.to(roomCode).emit('user_left', {
            user: targetUser,
            users: room.users
          });
          
          console.log(`User ${targetUser.name} was kicked from ${roomCode}`);
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    for (const [roomCode, room] of Object.entries(rooms)) {
      const userIndex = room.users.findIndex(u => u.id === socket.id);
      if (userIndex !== -1) {
        const user = room.users[userIndex];
        const wasHost = user.isHost;
        room.users.splice(userIndex, 1);
        console.log(`${user.name} left room: ${roomCode}`);

        if (wasHost && room.users.length > 0) {
          room.users[0].isHost = true;
          console.log(`${room.users[0].name} is the new host of ${roomCode}`);
        }

        socket.to(roomCode).emit('user_left', {
          user,
          users: room.users
        });

        if (room.users.length === 0) {
          delete rooms[roomCode];
          console.log(`Room ${roomCode} deleted (empty)`);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
