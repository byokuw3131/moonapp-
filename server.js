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

// Admin Dashboard page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Public Settings endpoint
app.get('/api/settings', async (req, res) => {
  try {
    const title = await db.getSetting('app_title', 'Moon App');
    const banner = await db.getSetting('broadcast_banner', '');
    res.json({ app_title: title, broadcast_banner: banner });
  } catch (e) {
    res.json({ app_title: 'Moon App', broadcast_banner: '' });
  }
});

// ADMIN API ENDPOINTS
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  const currentPass = await db.getSetting('admin_password', 'admin123');
  if (password === currentPass) {
    res.json({ success: true, token: 'admin_' + Date.now() });
  } else {
    res.status(401).json({ error: 'Yalnış admin şifrəsi!' });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    const stats = await db.getAdminStats();
    res.json({ success: true, stats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await db.getAllUsersForAdmin();
    res.json({ success: true, users });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/user/toggle-verified', async (req, res) => {
  try {
    const { userId, isVerified } = req.body;
    const user = await db.setUserVerified(userId, isVerified);
    io.emit('user_verified_updated', { userId, isVerified: user.is_verified });
    io.emit('admin_data_changed');
    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/user/toggle-admin', async (req, res) => {
  try {
    const { userId, isAdmin } = req.body;
    const user = await db.setUserAdmin(userId, isAdmin);
    io.emit('user_admin_updated', { userId, isAdmin: user.is_admin });
    io.emit('admin_data_changed');
    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/user/delete', async (req, res) => {
  try {
    const { userId } = req.body;
    await db.deleteUser(userId);

    // Disconnect any active sockets for this deleted user
    if (userSockets.has(userId)) {
      const sids = userSockets.get(userId);
      for (const sid of sids) {
        const s = io.sockets.sockets.get(sid);
        if (s) {
          s.emit('user_deleted', { userId });
          s.disconnect(true);
        }
      }
      userSockets.delete(userId);
    }

    // Broadcast to all other clients so rooms and user lists refresh immediately
    io.emit('user_deleted', { userId });
    io.emit('room_added');
    io.emit('update_room_preview');
    io.emit('admin_data_changed');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/broadcast', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mesaj boş ola bilməz' });

    const sysMsg = {
      id: `msg_sys_${Date.now()}`,
      roomId: 'moon_lounge',
      senderId: 'system',
      senderName: '📢 Sistem Rəsmi Elan',
      senderAvatar: '⚡',
      content: message,
      type: 'text',
      timestamp: Date.now()
    };
    const saved = await db.saveMessage(sysMsg);
    saved.reactions = [];
    io.to('moon_lounge').emit('new_message', saved);
    io.emit('direct_message_notify', { roomId: 'moon_lounge', message: saved });
    io.emit('admin_data_changed');
    res.json({ success: true, message: saved });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/settings', async (req, res) => {
  try {
    const settings = await db.getAllSettings();
    res.json({ success: true, settings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/settings', async (req, res) => {
  try {
    const { app_title, admin_password, broadcast_banner } = req.body;
    if (app_title !== undefined) await db.setSetting('app_title', app_title);
    if (admin_password !== undefined && admin_password.trim()) await db.setSetting('admin_password', admin_password.trim());
    if (broadcast_banner !== undefined) await db.setSetting('broadcast_banner', broadcast_banner);
    io.emit('settings_updated', { app_title, broadcast_banner });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Socket user mappings
const socketToUser = new Map(); // socket.id -> userId
const userSockets = new Map();  // userId -> Set<socket.id>

function getSessionUserId(socket, fallbackId) {
  let uid = socketToUser.get(socket.id);
  if (!uid && fallbackId) {
    uid = fallbackId;
    socketToUser.set(socket.id, uid);
    if (!userSockets.has(uid)) {
      userSockets.set(uid, new Set());
    }
    userSockets.get(uid).add(socket.id);
  }
  return uid;
}

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // User Login or Auto-reconnect
  socket.on('auth_login', async (userData, callback) => {
    try {
      let { id, username, nickname, avatar, bio, pin_code } = userData;
      if (!username) {
        if (callback) callback({ error: 'İstifadəçi adı vacibdir.' });
        return;
      }

      username = username.trim().toLowerCase();
      nickname = (nickname && nickname.trim()) || username;
      id = id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const user = await db.upsertUser({ id, username, nickname, avatar, bio, pin_code });

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
      io.emit('admin_data_changed');

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
      const messages = await db.getRoomMessages(roomId, 150, userId);
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
    const userId = getSessionUserId(socket, msgData ? msgData.senderId : null);
    if (!userId) {
      if (callback) callback({ error: 'Oturum açıq deyil' });
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
        replyToSender: msgData.replyToSender || null,
        isViewOnce: !!msgData.isViewOnce
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

      io.emit('admin_data_changed');

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
      io.emit('admin_data_changed');
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

  // Delete a single message (fallback)
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

  // Delete message for me (Özümdən sil)
  socket.on('delete_message_for_me', async ({ messageId, roomId }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      await db.deleteMessageForMe(userId, messageId);
      socket.emit('message_deleted_for_me', { messageId, roomId });
      if (callback) callback({ success: true });
    } catch (e) {
      if (callback) callback({ error: e.message });
    }
  });

  // Delete message for everyone (Hamıdan sil)
  socket.on('delete_message_for_everyone', async ({ messageId, roomId }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      const updated = await db.deleteMessageForEveryone(messageId, userId);
      io.to(roomId).emit('message_deleted_for_everyone', { messageId, roomId, message: updated });
      io.to(roomId).emit('update_room_preview', {
        roomId,
        lastMessage: { content: '🚫 Bu mesaj silindi', timestamp: Date.now(), type: 'text', sender_name: '' }
      });
      if (callback) callback({ success: true, message: updated });
    } catch (e) {
      if (callback) callback({ error: e.message });
    }
  });

  // Open View-Once image (Bir dəfəlik şəkil açıldı)
  socket.on('open_view_once', async ({ messageId, roomId }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      const updated = await db.openViewOnceMessage(messageId, userId);
      io.to(roomId).emit('view_once_opened', { messageId, roomId });
      if (callback) callback({ success: true, message: updated });
    } catch (e) {
      if (callback) callback({ error: e.message });
    }
  });

  // 24-HOUR STORIES / STATUS HANDLERS
  socket.on('post_story', async (storyData, callback) => {
    const userId = getSessionUserId(socket, storyData ? storyData.userId : null);
    if (!userId) {
      if (callback) callback({ error: 'Oturum açıq deyil' });
      return;
    }
    try {
      const user = await db.getUser(userId);
      const story = await db.createStory({
        userId,
        userName: user ? user.nickname : 'İstifadəçi',
        userAvatar: user ? user.avatar : '/logo.png',
        type: storyData.type || 'text',
        content: storyData.content || '',
        mediaUrl: storyData.mediaUrl || null,
        bgColor: storyData.bgColor || '#00a884',
        durationHours: 24
      });
      io.emit('new_story', { story });
      if (callback) callback({ success: true, story });
    } catch (e) {
      console.error('post_story error:', e);
      if (callback) callback({ error: e.message });
    }
  });

  socket.on('get_stories', async (data, callback) => {
    const userId = socketToUser.get(socket.id);
    try {
      const stories = await db.getActiveStories(userId);
      if (callback) callback({ success: true, stories });
    } catch (e) {
      console.error('get_stories error:', e);
      if (callback) callback({ error: e.message });
    }
  });

  socket.on('view_story', async ({ storyId, ownerId }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      const user = await db.getUser(userId);
      const views = await db.viewStory({
        storyId,
        viewerId: userId,
        viewerName: user ? user.nickname : 'İstifadəçi',
        viewerAvatar: user ? user.avatar : '/logo.png'
      });
      if (ownerId && ownerId !== userId) {
        io.to('user_' + ownerId).emit('story_viewed', {
          storyId,
          viewerId: userId,
          viewerName: user ? user.nickname : 'İstifadəçi',
          viewerAvatar: user ? user.avatar : '/logo.png',
          viewsCount: views.length
        });
      }
      if (callback) callback({ success: true, views });
    } catch (e) {
      console.error('view_story error:', e);
      if (callback) callback({ error: e.message });
    }
  });

  socket.on('delete_story', async ({ storyId }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      await db.deleteStory(storyId, userId);
      io.emit('story_deleted', { storyId, userId });
      if (callback) callback({ success: true });
    } catch (e) {
      console.error('delete_story error:', e);
      if (callback) callback({ error: e.message });
    }
  });

  socket.on('get_story_viewers', async ({ storyId }, callback) => {
    try {
      const viewers = await db.getStoryViewers(storyId);
      if (callback) callback({ success: true, viewers });
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

  // Hide / Archive a chat (supports hide_chat and hide_room)
  const handleHideChat = async ({ roomId }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      await db.hideRoom(userId, roomId);
      if (callback) callback({ success: true });
    } catch (e) {
      if (callback) callback({ error: e.message });
    }
  };
  socket.on('hide_chat', handleHideChat);
  socket.on('hide_room', handleHideChat);

  // Unhide a chat
  const handleUnhideChat = async ({ roomId }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      await db.unhideRoom(userId, roomId);
      if (callback) callback({ success: true });
    } catch (e) {
      if (callback) callback({ error: e.message });
    }
  };
  socket.on('unhide_chat', handleUnhideChat);
  socket.on('unhide_room', handleUnhideChat);

  // Delete chat entirely (supports delete_chat and delete_room)
  const handleDeleteChat = async ({ roomId }, callback) => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    try {
      await db.deleteRoomForUser(userId, roomId);
      socket.leave(roomId);
      // Notify other room members if needed
      io.to(roomId).emit('update_room_preview', { roomId });
      if (callback) callback({ success: true });
    } catch (e) {
      if (callback) callback({ error: e.message });
    }
  };
  socket.on('delete_chat', handleDeleteChat);
  socket.on('delete_room', handleDeleteChat);

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
      callerAvatar: callerUser ? callerUser.avatar : '/logo.png',
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
          io.emit('admin_data_changed');
        }
      }
      socketToUser.delete(socket.id);
    }
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

// Render Free-tier Keep-Alive mechanism to prevent sleeping and disk resets
function initKeepAlive() {
  const externalUrl = process.env.RENDER_EXTERNAL_URL;
  if (!externalUrl) return;

  const pingUrl = externalUrl.endsWith('/') ? `${externalUrl}api/health` : `${externalUrl}/api/health`;
  const https = require('https');
  const http = require('http');
  const client = pingUrl.startsWith('https') ? https : http;

  console.log(`[Render Keep-Alive] Initialized for ${pingUrl}`);
  // Ping every 9 minutes (Render sleeps after 15 minutes of inactivity)
  setInterval(() => {
    client.get(pingUrl, (res) => {
      console.log(`[Render Keep-Alive] Ping ok, status: ${res.statusCode}`);
    }).on('error', (err) => {
      console.warn(`[Render Keep-Alive] Ping error: ${err.message}`);
    });
  }, 9 * 60 * 1000);
}

// Start Server
const PORT = process.env.PORT || 3000;
async function start() {
  try {
    await db.initDatabase();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`
==================================================
  🌙 Moon App - Real-Time Web Chat
  Sunucu başarıyla başlatıldı!
  Yerel Adres: http://localhost:${PORT}
  Ağ Adresi:   http://0.0.0.0:${PORT}
==================================================
      `);
      initKeepAlive();
    });
  } catch (err) {
    console.error('Başlatma hatası:', err);
    process.exit(1);
  }
}

start();
