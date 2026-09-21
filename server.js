const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');
const { Server } = require('socket.io');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 25e6 // 25 MB max payload for audio/images
});

// Configure upload directory
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Upload API Endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Dosya seçilmedi.' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    fileUrl,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    mimetype: req.file.mimetype
  });
});

// Health check endpoint for hosting providers
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), app: 'MoonApp' });
});

// Socket user mappings
const socketToUser = new Map(); // socket.id -> userId
const userSockets = new Map();  // userId -> Set<socket.id>

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // User Login or Auto-reconnect
  socket.on('auth_login', async (userData, callback) => {
    try {
      let { id, username, nickname, avatar, bio } = userData;
      if (!username) {
        if (callback) callback({ error: 'Kullanıcı adı gereklidir.' });
        return;
      }

      username = username.trim().toLowerCase();
      nickname = (nickname && nickname.trim()) || username;
      id = id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const user = await db.upsertUser({ id, username, nickname, avatar, bio });

      // Track socket
      socketToUser.set(socket.id, user.id);
      if (!userSockets.has(user.id)) {
        userSockets.set(user.id, new Set());
      }
      userSockets.get(user.id).add(socket.id);

      // Join personal room for 100% reliable direct message delivery
      socket.join('user_' + user.id);

      // Auto join moon_lounge room
      socket.join('moon_lounge');

      // Fetch user rooms
      const rooms = await db.getUserRooms(user.id);
      // Join all user's rooms so they receive notifications
      rooms.forEach((r) => socket.join(r.id));

      // Broadcast user presence
      io.emit('user_presence', { userId: user.id, online: 1, lastSeen: Date.now() });

      if (callback) {
        callback({ success: true, user, rooms });
      }
    } catch (err) {
      console.error('Login error:', err);
      if (callback) callback({ error: 'Giriş sırasında hata oluştu: ' + err.message });
    }
  });

  // Get conversation rooms (with optional showHidden flag)
  socket.on('get_rooms', async (data, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      const showHidden = data && data.showHidden === true;
      const rooms = await db.getUserRooms(userId, showHidden);
      rooms.forEach((r) => socket.join(r.id));
      if (callback) callback({ rooms });
    } catch (err) {
      console.error('get_rooms error:', err);
    }
  });

  // Get all registered users for starting a new chat
  socket.on('get_users', async (data, callback) => {
    const userId = socketToUser.get(socket.id);
    try {
      const showHidden = data && data.showHidden === true;
      const users = await db.getAllUsers(userId, showHidden);
      if (callback) callback({ users });
    } catch (err) {
      console.error('get_users error:', err);
    }
  });

  // Hide / Block user
  socket.on('hide_user', async ({ targetUserId }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      await db.hideUser(userId, targetUserId);
      if (callback) callback({ success: true });
    } catch (e) {
      if (callback) callback({ error: e.message });
    }
  });

  // Unhide user
  socket.on('unhide_user', async ({ targetUserId }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      await db.unhideUser(userId, targetUserId);
      if (callback) callback({ success: true });
    } catch (e) {
      if (callback) callback({ error: e.message });
    }
  });

  // Start or open direct 1-on-1 chat
  socket.on('open_direct_chat', async ({ targetUserId }, callback) => {
    const currentUserId = socketToUser.get(socket.id);
    if (!currentUserId || !targetUserId) return;

    try {
      const room = await db.getOrCreateDirectRoom(currentUserId, targetUserId);
      socket.join(room.id);

      // Also join target user's sockets if they are online
      if (userSockets.has(targetUserId)) {
        userSockets.get(targetUserId).forEach((targetSocketId) => {
          const targetSocket = io.sockets.sockets.get(targetSocketId);
          if (targetSocket) {
            targetSocket.join(room.id);
          }
        });
      }

      // Notify target user via user channel
      io.to('user_' + targetUserId).emit('room_added', { roomId: room.id, room });

      if (callback) callback({ success: true, room });
    } catch (err) {
      console.error('open_direct_chat error:', err);
      if (callback) callback({ error: err.message });
    }
  });

  // Join Room & Load Messages
  socket.on('join_room', async ({ roomId }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!roomId) return;

    socket.join(roomId);

    try {
      const messages = await db.getRoomMessages(roomId, 150);
      if (userId) {
        await db.markRoomMessagesRead(roomId, userId);
        socket.to(roomId).emit('messages_read_receipt', { roomId, readerId: userId });
      }

      if (callback) {
        callback({ success: true, messages });
      }
    } catch (err) {
      console.error('join_room error:', err);
      if (callback) callback({ error: err.message });
    }
  });

  // Send Message
  socket.on('send_message', async (msgData, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) {
      if (callback) callback({ error: 'Oturum açık değil.' });
      return;
    }

    try {
      const user = await db.getUser(userId);
      const messageObj = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        roomId: msgData.roomId,
        senderId: userId,
        senderName: user ? user.nickname : 'Bilinmeyen',
        senderAvatar: user ? user.avatar : '👤',
        content: msgData.content || '',
        type: msgData.type || 'text',
        fileUrl: msgData.fileUrl || null,
        fileName: msgData.fileName || null,
        fileSize: msgData.fileSize || null,
        duration: msgData.duration || null,
        status: 'sent',
        timestamp: Date.now(),
        replyToId: msgData.replyToId || null,
        replyToText: msgData.replyToText || null,
        replyToSender: msgData.replyToSender || null
      };

      const savedMsg = await db.saveMessage(messageObj);
      savedMsg.reactions = [];

      // Broadcast to room
      io.to(msgData.roomId).emit('new_message', savedMsg);

      // Inform users in room to refresh their preview list
      io.to(msgData.roomId).emit('update_room_preview', {
        roomId: msgData.roomId,
        lastMessage: savedMsg
      });

      // Direct message notification to room members so recipient ALWAYS receives it even if not focused on this room
      try {
        const memberIds = await db.getRoomMemberIds(msgData.roomId);
        if (memberIds && memberIds.length > 0) {
          memberIds.forEach((mId) => {
            io.to('user_' + mId).emit('direct_message_notify', {
              roomId: msgData.roomId,
              message: savedMsg
            });
          });
        }
      } catch (errMembers) {
        console.error('Member notify error:', errMembers);
      }

      if (callback) callback({ success: true, message: savedMsg });
    } catch (err) {
      console.error('send_message error:', err);
      if (callback) callback({ error: 'Mesaj göndərilə bilmədi: ' + err.message });
    }
  });

  // Update profile (photo, nickname, bio)
  socket.on('update_profile', async (profileData, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      const updated = await db.updateUserProfile(userId, profileData);
      if (callback) callback({ success: true, user: updated });
      io.emit('user_updated', { user: updated });
    } catch (err) {
      if (callback) callback({ error: err.message });
    }
  });

  // Typing indicators
  socket.on('typing', ({ roomId }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId || !roomId) return;
    db.getUser(userId).then((user) => {
      if (user) {
        socket.to(roomId).emit('user_typing', {
          roomId,
          userId,
          nickname: user.nickname
        });
      }
    });
  });

  socket.on('stop_typing', ({ roomId }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId || !roomId) return;
    socket.to(roomId).emit('user_stop_typing', { roomId, userId });
  });

  // Mark read
  socket.on('mark_read', async ({ roomId }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId || !roomId) return;
    try {
      await db.markRoomMessagesRead(roomId, userId);
      socket.to(roomId).emit('messages_read_receipt', { roomId, readerId: userId });
    } catch (err) {
      console.error('mark_read error:', err);
    }
  });

  // Delete a single message
  socket.on('delete_message', async ({ messageId, roomId }, callback) => {
    try {
      const deleted = await db.deleteMessage(messageId);
      if (deleted) {
        io.to(roomId).emit('message_deleted', { messageId, roomId });
        const lastMsgs = await db.getRoomMessages(roomId, 1);
        const lastMsg = lastMsgs && lastMsgs.length > 0 ? lastMsgs[lastMsgs.length - 1] : null;
        io.to(roomId).emit('update_room_preview', {
          roomId,
          lastMessage: lastMsg || { content: '', timestamp: Date.now(), type: 'text', sender_name: '' }
        });
        if (callback) callback({ success: true });
      }
    } catch (e) {
      if (callback) callback({ error: e.message });
    }
  });

  // Clear all messages in a chat
  socket.on('clear_chat', async ({ roomId }, callback) => {
    try {
      await db.clearRoomMessages(roomId);
      io.to(roomId).emit('chat_cleared', { roomId });
      io.to(roomId).emit('update_room_preview', {
        roomId,
        lastMessage: { content: '', timestamp: Date.now(), type: 'text', sender_name: '' }
      });
      if (callback) callback({ success: true });
    } catch (e) {
      if (callback) callback({ error: e.message });
    }
  });

  // Hide / Archive a chat
  socket.on('hide_chat', async ({ roomId }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      await db.hideRoom(userId, roomId);
      if (callback) callback({ success: true });
    } catch (e) {
      if (callback) callback({ error: e.message });
    }
  });

  // Unhide a chat
  socket.on('unhide_chat', async ({ roomId }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      await db.unhideRoom(userId, roomId);
      if (callback) callback({ success: true });
    } catch (e) {
      if (callback) callback({ error: e.message });
    }
  });

  // Delete chat entirely
  socket.on('delete_chat', async ({ roomId }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      await db.deleteRoomForUser(userId, roomId);
      socket.leave(roomId);
      if (callback) callback({ success: true });
    } catch (e) {
      if (callback) callback({ error: e.message });
    }
  });

  // Edit Message
  socket.on('edit_message', async ({ messageId, roomId, newContent }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      const updatedMsg = await db.editMessage(messageId, userId, newContent);
      io.to(roomId).emit('message_edited', {
        messageId,
        roomId,
        newContent: updatedMsg.content,
        isEdited: 1
      });
      if (callback) callback({ success: true, message: updatedMsg });
    } catch (e) {
      if (callback) callback({ error: e.message });
    }
  });

  // Toggle Message Reaction
  socket.on('react_message', async ({ messageId, roomId, reaction }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      const user = await db.getUser(userId);
      const reactions = await db.toggleReaction(messageId, userId, user ? user.nickname : 'İstifadəçi', reaction);
      io.to(roomId).emit('message_reaction_updated', {
        messageId,
        roomId,
        reactions
      });
      if (callback) callback({ success: true, reactions });
    } catch (e) {
      if (callback) callback({ error: e.message });
    }
  });

  // Set / Verify PIN code
  socket.on('set_user_pin', async ({ pinCode }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      await db.setUserPin(userId, pinCode);
      if (callback) callback({ success: true });
    } catch (e) {
      if (callback) callback({ error: e.message });
    }
  });

  socket.on('verify_user_pin', async ({ pinCode }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      const res = await db.verifyUserPin(userId, pinCode);
      if (callback) callback(res);
    } catch (e) {
      if (callback) callback({ error: e.message });
    }
  });

  // VOICE & VIDEO CALLING SIGNALING (WebRTC 1-on-1 Guaranteed Delivery)
  socket.on('call_user', async ({ targetUserId, offer, callType = 'voice' }, callback) => {
    const callerId = socketToUser.get(socket.id);
    if (!callerId || !targetUserId) {
      if (callback) callback({ error: 'Zəng edilə bilmədi.' });
      return;
    }

    const callerUser = await db.getUser(callerId);

    // Relay call directly to user's personal channel
    io.to('user_' + targetUserId).emit('incoming_call', {
      fromUserId: callerId,
      callerName: callerUser ? callerUser.nickname : 'İstifadəçi',
      callerAvatar: callerUser ? callerUser.avatar : '🌙',
      offer,
      callType
    });

    if (callback) callback({ success: true });
  });

  socket.on('accept_call', ({ targetUserId, answer }) => {
    const userId = socketToUser.get(socket.id);
    if (!userId || !targetUserId) return;
    io.to('user_' + targetUserId).emit('call_accepted', {
      fromUserId: userId,
      answer
    });
  });

  socket.on('reject_call', ({ targetUserId }) => {
    const userId = socketToUser.get(socket.id);
    if (!targetUserId) return;
    io.to('user_' + targetUserId).emit('call_rejected', { fromUserId: userId });
  });

  socket.on('end_call', ({ targetUserId }) => {
    const userId = socketToUser.get(socket.id);
    if (!targetUserId) return;
    io.to('user_' + targetUserId).emit('call_ended', { fromUserId: userId });
  });

  socket.on('ice_candidate', ({ targetUserId, candidate }) => {
    const userId = socketToUser.get(socket.id);
    if (!targetUserId || !candidate) return;
    io.to('user_' + targetUserId).emit('ice_candidate', {
      fromUserId: userId,
      candidate
    });
  });

  // Disconnect
  socket.on('disconnect', async () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      const userSocketsSet = userSockets.get(userId);
      if (userSocketsSet) {
        userSocketsSet.delete(socket.id);
        if (userSocketsSet.size === 0) {
          userSockets.delete(userId);
          await db.setUserOnline(userId, false);
          io.emit('user_presence', { userId, online: 0, lastSeen: Date.now() });
        }
      }
      socketToUser.delete(socket.id);
    }
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
async function start() {
  try {
    await db.initDatabase();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`
==================================================
  🌙 MoonApp - WhatsApp Benzeri Web Sohbet
  Sunucu başarıyla başlatıldı!
  Yerel Adres: http://localhost:${PORT}
  Ağ Adresi:   http://0.0.0.0:${PORT}
==================================================
      `);
    });
  } catch (err) {
    console.error('Başlatma hatası:', err);
    process.exit(1);
  }
}

start();
