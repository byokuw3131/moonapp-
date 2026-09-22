const path = require('path');
const fs = require('fs');

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
let isPostgres = false;
let pgPool = null;
let sqliteDb = null;

if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
  const { Pool } = require('pg');
  isPostgres = true;
  pgPool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });
  console.log('[Database] Connected to PostgreSQL cloud database!');
} else {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, 'moonapp.sqlite');
  sqliteDb = new sqlite3.Database(dbPath);
  console.log('[Database] Using local SQLite database engine.');
}

function adaptSql(sql) {
  if (!isPostgres) return sql;
  let s = sql;
  if (/^PRAGMA/i.test(s.trim())) {
    return 'SELECT 1';
  }
  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(s)) {
    s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
    if (!/ON\s+CONFLICT/i.test(s)) {
      s += ' ON CONFLICT DO NOTHING';
    }
  }
  if (/INSERT\s+OR\s+REPLACE\s+INTO\s+settings/i.test(s)) {
    s = s.replace(/INSERT\s+OR\s+REPLACE\s+INTO\s+settings/gi, 'INSERT INTO settings');
    if (!/ON\s+CONFLICT/i.test(s)) {
      s += ' ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value';
    }
  }
  let idx = 1;
  s = s.replace(/\?/g, () => `$${idx++}`);
  return s;
}

// Helper for promise-based queries
function run(sql, params = []) {
  if (isPostgres) {
    const adapted = adaptSql(sql);
    return pgPool.query(adapted, params).then(res => ({
      lastID: null,
      changes: res.rowCount
    }));
  }
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  if (isPostgres) {
    const adapted = adaptSql(sql);
    return pgPool.query(adapted, params).then(res => res.rows[0] || null);
  }
  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  if (isPostgres) {
    const adapted = adaptSql(sql);
    return pgPool.query(adapted, params).then(res => res.rows || []);
  }
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

const backupPath = path.join(__dirname, 'users_backup.json');

async function syncUsersBackup() {
  try {
    const users = await all(`SELECT * FROM users`);
    if (users && users.length > 0) {
      fs.writeFileSync(backupPath, JSON.stringify(users, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('[Backup] syncUsersBackup error:', err.message);
  }
}

async function restoreUsersFromBackup() {
  try {
    if (!fs.existsSync(backupPath)) return;
    const count = await get('SELECT COUNT(*) AS total FROM users');
    if (count && count.total > 0) return; // Database already contains users

    const raw = fs.readFileSync(backupPath, 'utf8');
    const users = JSON.parse(raw);
    if (!Array.isArray(users)) return;

    for (const u of users) {
      await run(
        `INSERT OR IGNORE INTO users (id, username, nickname, avatar, bio, pin_code, online, last_seen, is_verified, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        [u.id, u.username, u.nickname, u.avatar, u.bio, u.pin_code, u.last_seen, u.is_verified || 0, u.created_at || new Date().toISOString()]
      );
      await run(`INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES ('moon_lounge', ?)`, [u.id]);
    }
    console.log(`[Backup] Successfully restored ${users.length} users from backup!`);
  } catch (err) {
    console.error('[Backup] restoreUsersFromBackup error:', err.message);
  }
}

// Initialize tables
async function initDatabase() {
  await run(`PRAGMA journal_mode = WAL;`);

  // Users table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      nickname TEXT NOT NULL,
      avatar TEXT,
      bio TEXT DEFAULT 'MoonApp kullanıcısı 🌙',
      online INTEGER DEFAULT 0,
      last_seen INTEGER,
      pin_code TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Rooms table
  await run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL, /* 'group' or 'direct' */
      avatar TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Room members
  await run(`
    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT,
      user_id TEXT,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (room_id, user_id)
    )
  `);

  // Messages table
  await run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_avatar TEXT,
      content TEXT,
      type TEXT DEFAULT 'text', /* 'text', 'image', 'audio', 'file', 'location' */
      file_url TEXT,
      file_name TEXT,
      file_size INTEGER,
      duration REAL,
      status TEXT DEFAULT 'sent', /* 'sent', 'delivered', 'read' */
      timestamp INTEGER NOT NULL,
      reply_to_id TEXT DEFAULT NULL,
      reply_to_text TEXT DEFAULT NULL,
      reply_to_sender TEXT DEFAULT NULL,
      is_edited INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Message reactions
  await run(`
    CREATE TABLE IF NOT EXISTS message_reactions (
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      reaction TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (message_id, user_id)
    )
  `);

  // Stories / Status table (24h ephemeral)
  await run(`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_avatar TEXT,
      type TEXT DEFAULT 'text', /* 'text' or 'image' */
      content TEXT,
      media_url TEXT,
      bg_color TEXT DEFAULT '#00a884',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    )
  `);

  // Story views
  await run(`
    CREATE TABLE IF NOT EXISTS story_views (
      story_id TEXT NOT NULL,
      viewer_id TEXT NOT NULL,
      viewer_name TEXT NOT NULL,
      viewer_avatar TEXT,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (story_id, viewer_id)
    )
  `);

  // Hidden messages per user (Delete for me / Özümdən sil)
  await run(`
    CREATE TABLE IF NOT EXISTS hidden_messages (
      user_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, message_id)
    )
  `);

  // Ensure migrations for existing databases
  try { await run(`ALTER TABLE messages ADD COLUMN reply_to_id TEXT DEFAULT NULL;`); } catch(e){}
  try { await run(`ALTER TABLE messages ADD COLUMN reply_to_text TEXT DEFAULT NULL;`); } catch(e){}
  try { await run(`ALTER TABLE messages ADD COLUMN reply_to_sender TEXT DEFAULT NULL;`); } catch(e){}
  try { await run(`ALTER TABLE messages ADD COLUMN is_edited INTEGER DEFAULT 0;`); } catch(e){}
  try { await run(`ALTER TABLE messages ADD COLUMN is_view_once INTEGER DEFAULT 0;`); } catch(e){}
  try { await run(`ALTER TABLE messages ADD COLUMN view_once_opened INTEGER DEFAULT 0;`); } catch(e){}
  try { await run(`ALTER TABLE messages ADD COLUMN is_deleted_for_everyone INTEGER DEFAULT 0;`); } catch(e){}
  try { await run(`ALTER TABLE users ADD COLUMN pin_code TEXT DEFAULT NULL;`); } catch(e){}
  try { await run(`ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0;`); } catch(e){}
  try { await run(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;`); } catch(e){}
  try { await run(`ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;`); } catch(e){}
  try { await run(`ALTER TABLE rooms ADD COLUMN user1_id TEXT DEFAULT NULL;`); } catch(e){}
  try { await run(`ALTER TABLE rooms ADD COLUMN user2_id TEXT DEFAULT NULL;`); } catch(e){}

  // Restore users from persistent backup if database was freshly created/wiped
  await restoreUsersFromBackup();

  // Auto-repair any direct rooms so both users are always mapped and in room_members
  try {
    const directRooms = await all(`SELECT id, user1_id, user2_id FROM rooms WHERE type = 'direct'`);
    const allUsers = await all(`SELECT id FROM users`);
    for (const r of directRooms) {
      let u1 = r.user1_id;
      let u2 = r.user2_id;
      if (!u1 || !u2) {
        const matched = allUsers.filter(u => r.id.includes(u.id));
        if (matched.length >= 2) {
          u1 = matched[0].id;
          u2 = matched[1].id;
          await run(`UPDATE rooms SET user1_id = ?, user2_id = ? WHERE id = ?`, [u1, u2, r.id]);
        }
      }
      if (u1) await run(`INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)`, [r.id, u1]);
      if (u2) await run(`INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)`, [r.id, u2]);
    }
  } catch(e) {
    console.error('Room repair error:', e);
  }

  // Settings table for customization
  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  await run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('app_title', 'WhatsApp Web - MoonApp')`);
  await run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_password', 'admin123')`);
  await run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('broadcast_banner', '')`);

  // Hidden / Archived rooms per user
  await run(`
    CREATE TABLE IF NOT EXISTS hidden_rooms (
      user_id TEXT,
      room_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, room_id)
    )
  `);

  // Hidden / Blocked users per user
  await run(`
    CREATE TABLE IF NOT EXISTS hidden_users (
      user_id TEXT,
      hidden_user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, hidden_user_id)
    )
  `);

  // Create default Moon Lounge group room if it doesn't exist
  const lounge = await get('SELECT id FROM rooms WHERE id = ?', ['moon_lounge']);
  if (!lounge) {
    await run(
      `INSERT INTO rooms (id, name, type, avatar, description)
       VALUES (?, ?, ?, ?, ?)`,
      [
        'moon_lounge',
        'Moon Ümumi Söhbət',
        'group',
        '/logo.png',
        'MoonApp rəsmi ümumi söhbət otağı. Hər kəs burada yaza bilər!'
      ]
    );
    console.log('Default "moon_lounge" room created.');
  }

  // Update room name and avatar if already exists
  await run(`UPDATE rooms SET name = 'Moon Ümumi Söhbət', avatar = '/logo.png', description = 'MoonApp rəsmi ümumi söhbət otağı. Hər kəs burada yaza bilər!' WHERE id = 'moon_lounge'`);

  // Clean up any remaining bot entries if exists
  await run(`DELETE FROM users WHERE id = 'moonbot'`);
  await run(`DELETE FROM room_members WHERE user_id = 'moonbot'`);
  await run(`DELETE FROM rooms WHERE id LIKE '%moonbot%'`);
  await run(`DELETE FROM messages WHERE sender_id = 'moonbot' OR room_id LIKE '%moonbot%'`);

  await syncUsersBackup();

  console.log('SQLite database initialized successfully.');
}

// User methods
async function upsertUser({ id, username, nickname, avatar, bio, pin_code }) {
  id = id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const existing = await get('SELECT * FROM users WHERE username = ?', [username]);
  const now = Date.now();

  if (existing) {
    // If user has a pin_code set in database, verify it!
    if (existing.pin_code) {
      if (!pin_code || String(pin_code).trim() !== String(existing.pin_code).trim()) {
        throw new Error('PİN kod yalnışdır! Zəhmət olmasa hesabınızın düzgün 4 rəqəmli PİN kodunu daxil edin.');
      }
    } else {
      if (!pin_code || String(pin_code).trim().length < 4) {
        throw new Error('Hesabınızı qorumaq üçün ən azı 4 rəqəmli PİN kod daxil edin.');
      }
      await run('UPDATE users SET pin_code = ? WHERE id = ?', [String(pin_code).trim(), existing.id]);
    }

    await run(
      `UPDATE users 
       SET nickname = COALESCE(?, nickname),
           avatar = COALESCE(?, avatar),
           bio = COALESCE(?, bio),
           online = 1,
           last_seen = ?
       WHERE id = ?`,
      [nickname, avatar, bio, now, existing.id]
    );
    // Make sure user is in lounge
    await run(
      `INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES ('moon_lounge', ?)`,
      [existing.id]
    );
    await syncUsersBackup();
    return await get('SELECT * FROM users WHERE id = ?', [existing.id]);
  } else {
    // New user registration requires at least 4 digit PIN
    if (!pin_code || String(pin_code).trim().length < 4) {
      throw new Error('Yeni hesab qeydiyyatı üçün ən azı 4 rəqəmli təhlükəsizlik PİN kodu təyin etməlisiniz!');
    }
    const safePin = String(pin_code).trim();
    await run(
      `INSERT INTO users (id, username, nickname, avatar, bio, pin_code, online, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [id, username, nickname || username, avatar || '/logo.png', bio || 'MoonApp istifadəçisi', safePin, now]
    );
    await run(
      `INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES ('moon_lounge', ?)`,
      [id]
    );
    await syncUsersBackup();
    return await get('SELECT * FROM users WHERE id = ?', [id]);
  }
}

async function updateUserProfile(id, { nickname, avatar, bio }) {
  await run(
    `UPDATE users 
     SET nickname = COALESCE(?, nickname),
         avatar = COALESCE(?, avatar),
         bio = COALESCE(?, bio)
     WHERE id = ?`,
    [nickname, avatar, bio, id]
  );
  await syncUsersBackup();
  return await get('SELECT * FROM users WHERE id = ?', [id]);
}

async function getUser(id) {
  return await get('SELECT * FROM users WHERE id = ?', [id]);
}

async function getUserByUsername(username) {
  return await get('SELECT * FROM users WHERE username = ?', [username]);
}

async function setUserOnline(id, isOnline) {
  return await run('UPDATE users SET online = ?, last_seen = ? WHERE id = ?', [
    isOnline ? 1 : 0,
    Date.now(),
    id
  ]);
}

async function getAllUsers(excludeId = null, showHidden = false) {
  if (excludeId) {
    const hiddenCondition = showHidden 
      ? `AND id IN (SELECT hidden_user_id FROM hidden_users WHERE user_id = ?)`
      : `AND id NOT IN (SELECT hidden_user_id FROM hidden_users WHERE user_id = ?)`;
    return await all(
      `SELECT id, username, nickname, avatar, bio, online, last_seen, is_verified,
       (SELECT COUNT(*) FROM hidden_users WHERE user_id = ? AND hidden_user_id = users.id) AS is_hidden
       FROM users 
       WHERE id != ? ${hiddenCondition} 
       ORDER BY online DESC, nickname ASC`,
      [excludeId, excludeId, excludeId]
    );
  }
  return await all('SELECT id, username, nickname, avatar, bio, online, last_seen, is_verified, 0 AS is_hidden FROM users ORDER BY online DESC, nickname ASC');
}

async function hideUser(userId, targetUserId) {
  await run('INSERT OR IGNORE INTO hidden_users (user_id, hidden_user_id) VALUES (?, ?)', [userId, targetUserId]);
  const [uA, uB] = [userId, targetUserId].sort();
  const roomId = `dm_${uA}_${uB}`;
  await hideRoom(userId, roomId);
  return true;
}

async function unhideUser(userId, targetUserId) {
  await run('DELETE FROM hidden_users WHERE user_id = ? AND hidden_user_id = ?', [userId, targetUserId]);
  const [uA, uB] = [userId, targetUserId].sort();
  const roomId = `dm_${uA}_${uB}`;
  await unhideRoom(userId, roomId);
  return true;
}

// Direct Room Creation or Fetch
async function getOrCreateDirectRoom(userAId, userBId) {
  if (userAId === userBId) throw new Error("Özünüzlə şəxsi söhbət başlada bilməzsiniz.");

  const [uA, uB] = [userAId, userBId].sort();
  const roomId = `dm_${uA}_${uB}`;

  const existing = await get('SELECT * FROM rooms WHERE id = ?', [roomId]);
  const userA = await getUser(userAId);
  const userB = await getUser(userBId);

  if (!existing) {
    await run(
      `INSERT INTO rooms (id, name, type, avatar, description, user1_id, user2_id)
       VALUES (?, ?, 'direct', ?, ?, ?, ?)`,
      [
        roomId,
        `${userA?.nickname || userA?.username || 'İstifadəçi'} & ${userB?.nickname || userB?.username || 'İstifadəçi'}`,
        '💬',
        'Şəxsi Söhbət',
        uA,
        uB
      ]
    );

    // If one of them is MoonBot, add welcoming first message
    if (userAId === 'moonbot' || userBId === 'moonbot') {
      const targetUser = userAId === 'moonbot' ? userB : userA;
      await run(
        `INSERT OR IGNORE INTO messages (
          id, room_id, sender_id, sender_name, sender_avatar, 
          content, type, status, timestamp
        ) VALUES (?, ?, 'moonbot', '🌙 MoonBot', '🤖', ?, 'text', 'read', ?)`,
        [
          `msg_welcome_${roomId}`,
          roomId,
          `Salam ${targetUser?.nickname || targetUser?.username || ''}! 🌙 Mən MoonBot. MoonApp-a xoş gəlmisiniz!`,
          Date.now()
        ]
      );
    }
  } else {
    if (!existing.user1_id || !existing.user2_id) {
      await run(`UPDATE rooms SET user1_id = ?, user2_id = ? WHERE id = ?`, [uA, uB, roomId]);
    }
  }

  // Always ensure BOTH users are active members in room_members
  await run(`INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)`, [roomId, userAId]);
  await run(`INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)`, [roomId, userBId]);

  // Unhide the room for the requesting user
  await unhideRoom(userAId, roomId);

  const targetUser = userB;
  return {
    id: roomId,
    name: targetUser ? (targetUser.nickname || targetUser.username) : 'İstifadəçi',
    type: 'direct',
    avatar: targetUser ? (targetUser.avatar || '/logo.png') : '/logo.png',
    display_name: targetUser ? (targetUser.nickname || targetUser.username) : 'İstifadəçi',
    display_avatar: targetUser ? (targetUser.avatar || '/logo.png') : '/logo.png',
    other_user_id: userBId,
    other_user_online: targetUser ? (targetUser.online || 0) : 0,
    other_user_verified: targetUser ? (targetUser.is_verified || 0) : 0,
    other_user_last_seen: targetUser ? targetUser.last_seen : null,
    unread_count: 0,
    is_hidden: 0,
    created_at: existing ? existing.created_at : new Date().toISOString()
  };
}

// Get user rooms with last message and hidden state
async function getUserRooms(userId, showHidden = false) {
  const hiddenCondition = showHidden 
    ? `AND r.id IN (SELECT room_id FROM hidden_rooms WHERE user_id = ?)`
    : `AND r.id NOT IN (SELECT room_id FROM hidden_rooms WHERE user_id = ?)`;

  const sql = `
    SELECT 
      r.id,
      r.type,
      r.created_at,
      CASE 
        WHEN r.type = 'direct' THEN COALESCE(other_u.nickname, other_u.username, r.name, 'İstifadəçi')
        ELSE r.name
      END AS display_name,
      CASE 
        WHEN r.id = 'moon_lounge' THEN '/logo.png'
        WHEN r.type = 'direct' THEN COALESCE(other_u.avatar, '/logo.png')
        ELSE COALESCE(r.avatar, '/logo.png')
      END AS display_avatar,
      CASE 
        WHEN other_u.id = 'moonbot' THEN 1
        WHEN r.type = 'direct' THEN other_u.online
        ELSE NULL
      END AS other_user_online,
      other_u.id AS other_user_id,
      COALESCE(other_u.is_verified, 0) AS other_user_verified,
      COALESCE(other_u.is_admin, 0) AS other_user_is_admin,
      other_u.last_seen AS other_user_last_seen,
      (
        SELECT content FROM messages 
        WHERE room_id = r.id 
        ORDER BY timestamp DESC LIMIT 1
      ) AS last_message_content,
      (
        SELECT type FROM messages 
        WHERE room_id = r.id 
        ORDER BY timestamp DESC LIMIT 1
      ) AS last_message_type,
      (
        SELECT timestamp FROM messages 
        WHERE room_id = r.id 
        ORDER BY timestamp DESC LIMIT 1
      ) AS last_message_time,
      (
        SELECT sender_name FROM messages 
        WHERE room_id = r.id 
        ORDER BY timestamp DESC LIMIT 1
      ) AS last_message_sender,
      (
        SELECT COUNT(*) FROM messages 
        WHERE room_id = r.id AND sender_id != ? AND status != 'read'
      ) AS unread_count,
      (
        SELECT COUNT(*) FROM hidden_rooms 
        WHERE user_id = ? AND room_id = r.id
      ) AS is_hidden
    FROM rooms r
    JOIN room_members m ON r.id = m.room_id
    LEFT JOIN room_members other_m ON r.id = other_m.room_id AND other_m.user_id != ? AND r.type = 'direct'
    LEFT JOIN users other_u ON other_u.id = (
      CASE 
        WHEN r.type = 'direct' THEN 
          COALESCE(
            CASE WHEN r.user1_id = ? THEN r.user2_id WHEN r.user2_id = ? THEN r.user1_id ELSE NULL END,
            other_m.user_id
          )
        ELSE NULL 
      END
    )
    WHERE m.user_id = ?
    ${hiddenCondition}
    GROUP BY r.id
    ORDER BY COALESCE(last_message_time, 0) DESC, r.created_at DESC
  `;

  return await all(sql, [userId, userId, userId, userId, userId, userId, userId]);
}

// Delete a single message
async function deleteMessage(messageId) {
  const msg = await get('SELECT * FROM messages WHERE id = ?', [messageId]);
  if (!msg) return null;
  await run('DELETE FROM messages WHERE id = ?', [messageId]);
  return msg;
}

// Clear all messages in a room
async function clearRoomMessages(roomId) {
  await run('DELETE FROM messages WHERE room_id = ?', [roomId]);
  return true;
}

// Hide / Archive a room for user
async function hideRoom(userId, roomId) {
  await run('INSERT OR IGNORE INTO hidden_rooms (user_id, room_id) VALUES (?, ?)', [userId, roomId]);
  return true;
}

// Unhide a room
async function unhideRoom(userId, roomId) {
  await run('DELETE FROM hidden_rooms WHERE user_id = ? AND room_id = ?', [userId, roomId]);
  return true;
}

// Delete room for user (clears messages & hides room, preserving integrity)
async function deleteRoomForUser(userId, roomId) {
  if (roomId === 'moon_lounge') {
    await hideRoom(userId, roomId);
    return true;
  }
  await run('DELETE FROM messages WHERE room_id = ?', [roomId]);
  await hideRoom(userId, roomId);
  return true;
}

// Save message
async function saveMessage(msg) {
  // If direct room, guarantee both users are members and unhidden
  if (msg.roomId && msg.roomId.startsWith('dm_')) {
    const parts = msg.roomId.replace('dm_', '').split('_');
    if (parts.length >= 2) {
      const u1 = parts[0];
      const u2 = parts.slice(1).join('_');
      await run(`INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)`, [msg.roomId, u1]);
      await run(`INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)`, [msg.roomId, u2]);
      await unhideRoom(u1, msg.roomId);
      await unhideRoom(u2, msg.roomId);
    }
  }

  await run(
    `INSERT INTO messages (
      id, room_id, sender_id, sender_name, sender_avatar, 
      content, type, file_url, file_name, file_size, duration, status, timestamp,
      reply_to_id, reply_to_text, reply_to_sender, is_edited,
      is_view_once, view_once_opened, is_deleted_for_everyone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      msg.id,
      msg.roomId,
      msg.senderId,
      msg.senderName,
      msg.senderAvatar || '👤',
      msg.content || '',
      msg.type || 'text',
      msg.fileUrl || null,
      msg.fileName || null,
      msg.fileSize || null,
      msg.duration || null,
      msg.status || 'sent',
      msg.timestamp || Date.now(),
      msg.replyToId || null,
      msg.replyToText || null,
      msg.replyToSender || null,
      0,
      msg.isViewOnce ? 1 : 0,
      0,
      0
    ]
  );
  const msgRow = await get('SELECT * FROM messages WHERE id = ?', [msg.id]);
  const senderUser = await getUser(msg.senderId);
  return {
    ...msgRow,
    sender_verified: senderUser ? (senderUser.is_verified || 0) : 0
  };
}

// Edit message content
async function editMessage(messageId, userId, newContent) {
  const msg = await get('SELECT * FROM messages WHERE id = ?', [messageId]);
  if (!msg) throw new Error('Mesaj tapılmadı.');
  if (msg.sender_id !== userId) throw new Error('Yalnız öz mesajınızı redaktə edə bilərsiniz.');

  await run(
    `UPDATE messages SET content = ?, is_edited = 1 WHERE id = ?`,
    [newContent, messageId]
  );
  return await get('SELECT * FROM messages WHERE id = ?', [messageId]);
}

// Toggle emoji reaction
async function toggleReaction(messageId, userId, userName, reaction) {
  const existing = await get(
    `SELECT * FROM message_reactions WHERE message_id = ? AND user_id = ?`,
    [messageId, userId]
  );

  if (existing) {
    if (existing.reaction === reaction) {
      // Remove reaction
      await run(
        `DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?`,
        [messageId, userId]
      );
    } else {
      // Update reaction
      await run(
        `UPDATE message_reactions SET reaction = ? WHERE message_id = ? AND user_id = ?`,
        [reaction, messageId, userId]
      );
    }
  } else {
    // Add reaction
    await run(
      `INSERT INTO message_reactions (message_id, user_id, user_name, reaction) VALUES (?, ?, ?, ?)`,
      [messageId, userId, userName, reaction]
    );
  }

  // Return all reactions for this message
  return await getMessageReactions(messageId);
}

// Get reactions for a single message
async function getMessageReactions(messageId) {
  return await all(
    `SELECT reaction, user_id, user_name FROM message_reactions WHERE message_id = ?`,
    [messageId]
  );
}

// Get all reactions for messages in a room
async function getRoomReactions(roomId) {
  return await all(
    `SELECT mr.message_id, mr.reaction, mr.user_id, mr.user_name
     FROM message_reactions mr
     JOIN messages m ON mr.message_id = m.id
     WHERE m.room_id = ?`,
    [roomId]
  );
}

// Set PIN code for user
async function setUserPin(userId, pinCode) {
  await run(`UPDATE users SET pin_code = ? WHERE id = ?`, [pinCode, userId]);
  return true;
}

// Verify PIN code for user
async function verifyUserPin(userId, inputPin) {
  const user = await get(`SELECT pin_code FROM users WHERE id = ?`, [userId]);
  if (!user || !user.pin_code) {
    // If no pin is set yet, any or first set can be considered valid
    return { hasPin: false };
  }
  return { hasPin: true, isValid: user.pin_code === inputPin };
}

// Get messages for a room with reaction data
async function getRoomMessages(roomId, limit = 150, currentUserId = null) {
  let sql = `
    SELECT m.*, u.is_verified AS sender_verified, COALESCE(u.is_admin, 0) AS sender_is_admin
    FROM messages m 
    LEFT JOIN users u ON m.sender_id = u.id 
    WHERE m.room_id = ?
  `;
  const params = [roomId];
  if (currentUserId) {
    sql += ` AND m.id NOT IN (SELECT message_id FROM hidden_messages WHERE user_id = ?)`;
    params.push(currentUserId);
  }
  sql += ` ORDER BY m.timestamp ASC LIMIT ?`;
  params.push(limit);

  const messages = await all(sql, params);

  if (messages.length === 0) return [];

  const reactions = await getRoomReactions(roomId);
  const reactionsMap = {};
  reactions.forEach((r) => {
    if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = [];
    reactionsMap[r.message_id].push({ reaction: r.reaction, userId: r.user_id, userName: r.user_name });
  });

  return messages.map((m) => ({
    ...m,
    reactions: reactionsMap[m.id] || []
  }));
}

// Mark messages as read
async function markRoomMessagesRead(roomId, currentUserId) {
  return await run(
    `UPDATE messages 
     SET status = 'read' 
     WHERE room_id = ? AND sender_id != ? AND status != 'read'`,
    [roomId, currentUserId]
  );
}

async function getRoomMemberIds(roomId) {
  const members = await all('SELECT user_id FROM room_members WHERE room_id = ?', [roomId]);
  return members.map(m => m.user_id);
}

// ADMIN PANEL HELPERS
async function setUserVerified(userId, isVerified) {
  await run('UPDATE users SET is_verified = ? WHERE id = ?', [isVerified ? 1 : 0, userId]);
  await syncUsersBackup();
  return await getUser(userId);
}

async function setUserAdmin(userId, isAdmin) {
  await run('UPDATE users SET is_admin = ? WHERE id = ?', [isAdmin ? 1 : 0, userId]);
  await syncUsersBackup();
  return await getUser(userId);
}

async function getSetting(key, defaultValue = '') {
  const row = await get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : defaultValue;
}

async function setSetting(key, value) {
  await run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
  return true;
}

async function getAllSettings() {
  const rows = await all('SELECT key, value FROM settings');
  const res = {};
  rows.forEach(r => { res[r.key] = r.value; });
  return res;
}

async function deleteUser(userId) {
  // Find all direct rooms where this user is or was a participant
  const directRooms = await all(
    `SELECT id FROM rooms WHERE type = 'direct' AND id LIKE ?`,
    [`%${userId}%`]
  );
  for (const r of directRooms) {
    await run('DELETE FROM messages WHERE room_id = ?', [r.id]);
    await run('DELETE FROM room_members WHERE room_id = ?', [r.id]);
    await run('DELETE FROM hidden_rooms WHERE room_id = ?', [r.id]);
    await run('DELETE FROM rooms WHERE id = ?', [r.id]);
  }

  // Delete all messages sent by this user anywhere
  await run('DELETE FROM messages WHERE sender_id = ?', [userId]);
  // Delete all room memberships for this user
  await run('DELETE FROM room_members WHERE user_id = ?', [userId]);
  // Delete hidden/blocked associations
  await run('DELETE FROM hidden_users WHERE user_id = ? OR hidden_user_id = ?', [userId, userId]);
  await run('DELETE FROM hidden_rooms WHERE user_id = ?', [userId]);
  // Finally delete user record
  await run('DELETE FROM users WHERE id = ?', [userId]);
  await syncUsersBackup();
  return true;
}

async function getAdminStats() {
  const usersCount = await get('SELECT COUNT(*) AS total FROM users');
  const messagesCount = await get('SELECT COUNT(*) AS total FROM messages');
  const onlineCount = await get('SELECT COUNT(*) AS total FROM users WHERE online = 1');
  const verifiedCount = await get('SELECT COUNT(*) AS total FROM users WHERE is_verified = 1');
  const roomsCount = await get('SELECT COUNT(*) AS total FROM rooms');
  const uCount = usersCount ? usersCount.total : 0;
  const mCount = messagesCount ? messagesCount.total : 0;
  const oCount = onlineCount ? onlineCount.total : 0;
  const vCount = verifiedCount ? verifiedCount.total : 0;
  const rCount = roomsCount ? roomsCount.total : 0;
  return {
    totalUsers: uCount,
    totalMessages: mCount,
    onlineUsers: oCount,
    verifiedUsers: vCount,
    totalRooms: rCount,
    total_users: uCount,
    total_messages: mCount,
    online_users: oCount,
    verified_users: vCount,
    total_rooms: rCount
  };
}

async function getAllUsersForAdmin() {
  try {
    return await all(`
      SELECT u.id, u.username, u.nickname, u.avatar, u.online, u.last_seen, COALESCE(u.is_verified, 0) AS is_verified,
             COALESCE(u.is_admin, 0) AS is_admin,
             COALESCE(u.created_at, CURRENT_TIMESTAMP) AS created_at,
             (SELECT COUNT(*) FROM messages WHERE sender_id = u.id) AS message_count
      FROM users u
      ORDER BY u.created_at DESC
    `);
  } catch (err) {
    return await all(`
      SELECT u.id, u.username, u.nickname, u.avatar, u.online, u.last_seen, COALESCE(u.is_verified, 0) AS is_verified,
             COALESCE(u.is_admin, 0) AS is_admin,
             CURRENT_TIMESTAMP AS created_at,
             (SELECT COUNT(*) FROM messages WHERE sender_id = u.id) AS message_count
      FROM users u
      ORDER BY u.online DESC, u.nickname ASC
    `);
  }
}

// STORIES (STATUS) METHODS
async function createStory({ id, userId, userName, userAvatar, type = 'text', content = '', mediaUrl = null, bgColor = '#00a884', durationHours = 24 }) {
  id = id || `story_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
  await run(
    `INSERT INTO stories (id, user_id, user_name, user_avatar, type, content, media_url, bg_color, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, userName, userAvatar, type, content, mediaUrl, bgColor, expiresAt]
  );
  return await get(`SELECT * FROM stories WHERE id = ?`, [id]);
}

async function getActiveStories(viewerUserId = null) {
  const stories = await all(
    `SELECT s.*,
            (SELECT COUNT(*) FROM story_views WHERE story_id = s.id) AS views_count
     FROM stories s
     WHERE s.expires_at > CURRENT_TIMESTAMP
     ORDER BY s.created_at ASC`
  );

  const userStoriesMap = {};
  for (const st of stories) {
    if (!userStoriesMap[st.user_id]) {
      const u = await getUser(st.user_id);
      userStoriesMap[st.user_id] = {
        user_id: st.user_id,
        user_name: u ? (u.nickname || u.username) : st.user_name,
        user_avatar: u ? u.avatar : st.user_avatar,
        stories: [],
        has_unviewed: false
      };
    }
    let isViewed = false;
    if (viewerUserId) {
      const view = await get('SELECT 1 FROM story_views WHERE story_id = ? AND viewer_id = ?', [st.id, viewerUserId]);
      isViewed = !!view;
    }
    st.is_viewed = isViewed;
    if (!isViewed && viewerUserId && st.user_id !== viewerUserId) {
      userStoriesMap[st.user_id].has_unviewed = true;
    }
    userStoriesMap[st.user_id].stories.push(st);
  }

  return Object.values(userStoriesMap);
}

async function viewStory({ storyId, viewerId, viewerName, viewerAvatar }) {
  await run(
    `INSERT OR IGNORE INTO story_views (story_id, viewer_id, viewer_name, viewer_avatar)
     VALUES (?, ?, ?, ?)`,
    [storyId, viewerId, viewerName, viewerAvatar]
  );
  return await all(`SELECT * FROM story_views WHERE story_id = ? ORDER BY viewed_at DESC`, [storyId]);
}

async function getStoryViewers(storyId) {
  return await all(`SELECT * FROM story_views WHERE story_id = ? ORDER BY viewed_at DESC`, [storyId]);
}

async function deleteStory(storyId, userId) {
  const story = await get('SELECT * FROM stories WHERE id = ?', [storyId]);
  if (!story) return false;
  if (story.user_id !== userId) throw new Error('Yalnız öz statusunuzu silə bilərsiniz.');
  await run('DELETE FROM story_views WHERE story_id = ?', [storyId]);
  await run('DELETE FROM stories WHERE id = ?', [storyId]);
  return true;
}

// MESSAGE DELETION & VIEW ONCE METHODS
async function deleteMessageForMe(userId, messageId) {
  await run('INSERT OR IGNORE INTO hidden_messages (user_id, message_id) VALUES (?, ?)', [userId, messageId]);
  return true;
}

async function deleteMessageForEveryone(messageId, userId) {
  const msg = await get('SELECT * FROM messages WHERE id = ?', [messageId]);
  if (!msg) throw new Error('Mesaj tapılmadı.');
  if (msg.sender_id !== userId) throw new Error('Yalnız öz göndərdiyiniz mesajı hamıdan silə bilərsiniz.');
  await run(
    `UPDATE messages 
     SET content = '🚫 Bu mesaj silindi', 
         is_deleted_for_everyone = 1, 
         file_url = NULL, 
         file_name = NULL, 
         type = 'text' 
     WHERE id = ?`,
    [messageId]
  );
  return await get('SELECT * FROM messages WHERE id = ?', [messageId]);
}

async function openViewOnceMessage(messageId, userId) {
  const msg = await get('SELECT * FROM messages WHERE id = ?', [messageId]);
  if (!msg) throw new Error('Mesaj tapılmadı.');
  if (msg.is_view_once !== 1) return msg;

  await run('UPDATE messages SET view_once_opened = 1 WHERE id = ?', [messageId]);
  return await get('SELECT * FROM messages WHERE id = ?', [messageId]);
}

module.exports = {
  initDatabase,
  upsertUser,
  getUser,
  getUserByUsername,
  setUserOnline,
  getAllUsers,
  getOrCreateDirectRoom,
  getUserRooms,
  saveMessage,
  editMessage,
  toggleReaction,
  getMessageReactions,
  setUserPin,
  verifyUserPin,
  getRoomMessages,
  markRoomMessagesRead,
  getRoomMemberIds,
  updateUserProfile,
  deleteMessage,
  clearRoomMessages,
  hideRoom,
  unhideRoom,
  deleteRoomForUser,
  hideUser,
  unhideUser,
  setUserVerified,
  setUserAdmin,
  getSetting,
  setSetting,
  getAllSettings,
  deleteUser,
  getAdminStats,
  getAllUsersForAdmin,
  createStory,
  getActiveStories,
  viewStory,
  getStoryViewers,
  deleteStory,
  deleteMessageForMe,
  deleteMessageForEveryone,
  openViewOnceMessage
};

