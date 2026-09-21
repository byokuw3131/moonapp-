// MoonApp 2.0 - WhatsApp Web Client Controller
// 100% Reliable Real-time Messaging & Modern WhatsApp Web Dark Aesthetics

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // Application State
  let currentUser = null;
  let currentRoom = null;
  let rooms = [];
  let currentFilter = 'all';
  let showLocked = false;
  let replyContext = null;
  let editContext = null;
  let typingTimer = null;
  let isTyping = false;

  // WebRTC Call State
  let peerConnection = null;
  let localStream = null;
  let currentCallTarget = null;
  let currentCallType = 'voice'; // 'voice' or 'video'
  let callTimerInterval = null;
  let callStartTime = null;

  let iceCandidateQueue = [];

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' }
    ]
  };

  // DOM Elements
  const appLayout = document.getElementById('appLayout');
  const sidebar = document.getElementById('sidebar');
  const chatList = document.getElementById('chatList');
  const chatSearchInput = document.getElementById('chatSearchInput');
  const filterPills = document.querySelectorAll('.filter-pill');
  const lockedBanner = document.getElementById('lockedBanner');
  const btnExitLocked = document.getElementById('btnExitLocked');

  // Sidebar Header
  const btnOpenMyProfile = document.getElementById('btnOpenMyProfile');
  const myAvatarDisplay = document.getElementById('myAvatarDisplay');
  const myNicknameDisplay = document.getElementById('myNicknameDisplay');
  const myUsernameDisplay = document.getElementById('myUsernameDisplay');
  const btnToggleLocked = document.getElementById('btnToggleLocked');
  const btnNewChat = document.getElementById('btnNewChat');
  const btnLogout = document.getElementById('btnLogout');

  // Main Chat Pane
  const emptyChatState = document.getElementById('emptyChatState');
  const activeChatWrapper = document.getElementById('activeChatWrapper');
  const btnMobileBack = document.getElementById('btnMobileBack');
  const targetChatAvatar = document.getElementById('targetChatAvatar');
  const targetChatName = document.getElementById('targetChatName');
  const targetChatStatus = document.getElementById('targetChatStatus');
  const btnVoiceCall = document.getElementById('btnVoiceCall');
  const btnVideoCall = document.getElementById('btnVideoCall');
  const btnChatMenuTrigger = document.getElementById('btnChatMenuTrigger');
  const chatOptionsPopup = document.getElementById('chatOptionsPopup');
  const optHideChat = document.getElementById('optHideChat');
  const optClearChat = document.getElementById('optClearChat');
  const optDeleteChat = document.getElementById('optDeleteChat');

  // Messaging
  const messagesFlow = document.getElementById('messagesFlow');
  const replyEditBanner = document.getElementById('replyEditBanner');
  const bannerTitle = document.getElementById('bannerTitle');
  const bannerSnippet = document.getElementById('bannerSnippet');
  const btnCloseBanner = document.getElementById('btnCloseBanner');

  const btnToggleEmoji = document.getElementById('btnToggleEmoji');
  const btnToggleAttach = document.getElementById('btnToggleAttach');
  const messageTextInput = document.getElementById('messageTextInput');
  const btnSendMessage = document.getElementById('btnSendMessage');
  const emojiPalette = document.getElementById('emojiPalette');
  const emojiPaletteGrid = document.getElementById('emojiPaletteGrid');
  const attachmentsPopover = document.getElementById('attachmentsPopover');
  const btnAttachPhoto = document.getElementById('btnAttachPhoto');
  const btnAttachDoc = document.getElementById('btnAttachDoc');
  const btnAttachLocation = document.getElementById('btnAttachLocation');
  const imageFileInput = document.getElementById('imageFileInput');
  const generalFileInput = document.getElementById('generalFileInput');

  // Modals
  const loginBackdrop = document.getElementById('loginBackdrop');
  const loginForm = document.getElementById('loginForm');
  const loginUsername = document.getElementById('loginUsername');

  const newChatModal = document.getElementById('newChatModal');
  const btnCloseNewChat = document.getElementById('btnCloseNewChat');
  const userSearchFilter = document.getElementById('userSearchFilter');
  const newChatUsersList = document.getElementById('newChatUsersList');

  const profileModal = document.getElementById('profileModal');
  const btnCloseProfile = document.getElementById('btnCloseProfile');
  const profileForm = document.getElementById('profileForm');
  const editAvatarBox = document.getElementById('editAvatarBox');
  const btnSelectNewPic = document.getElementById('btnSelectNewPic');
  const avatarFileInput = document.getElementById('avatarFileInput');
  const editNickInput = document.getElementById('editNickInput');
  const editBioInput = document.getElementById('editBioInput');

  const pinModal = document.getElementById('pinModal');
  const btnClosePin = document.getElementById('btnClosePin');
  const pinInputVal = document.getElementById('pinInputVal');
  const pinErrMsg = document.getElementById('pinErrMsg');
  const btnCheckPin = document.getElementById('btnCheckPin');

  // Calls DOM
  const callOverlay = document.getElementById('callOverlay');
  const videoScreens = document.getElementById('videoScreens');
  const remoteVideoEl = document.getElementById('remoteVideoEl');
  const localVideoEl = document.getElementById('localVideoEl');
  const audioCallerDisplay = document.getElementById('audioCallerDisplay');
  const callCardAvatar = document.getElementById('callCardAvatar');
  const callCardName = document.getElementById('callCardName');
  const callCardState = document.getElementById('callCardState');
  const callClock = document.getElementById('callClock');
  const btnMuteAudio = document.getElementById('btnMuteAudio');
  const btnToggleCam = document.getElementById('btnToggleCam');
  const btnEndActiveCall = document.getElementById('btnEndActiveCall');
  const remoteAudioOutput = document.getElementById('remoteAudioOutput');

  const incomingCallBackdrop = document.getElementById('incomingCallBackdrop');
  const incAvatar = document.getElementById('incAvatar');
  const incCallerName = document.getElementById('incCallerName');
  const incCallType = document.getElementById('incCallType');
  const btnRejectIncoming = document.getElementById('btnRejectIncoming');
  const btnAcceptIncoming = document.getElementById('btnAcceptIncoming');

  let incomingCallData = null;

  // Common Emojis
  const EMOJI_LIST = [
    '😊', '😂', '🤣', '❤️', '😍', '👍', '🔥', '🎉',
    '🙏', '✨', '🚀', '👏', '🥳', '😎', '😢', '🥺',
    '💯', '💬', '🌙', '👌', '🤝', '😉', '🥰', '🤔',
    '😅', '🙌', '💪', '🌹', '⚡', '⭐', '🎈', '🤩'
  ];

  function initEmojiPalette() {
    emojiPaletteGrid.innerHTML = '';
    EMOJI_LIST.forEach((emoji) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'emoji-btn';
      btn.textContent = emoji;
      btn.addEventListener('click', () => {
        messageTextInput.value += emoji;
        messageTextInput.focus();
      });
      emojiPaletteGrid.appendChild(btn);
    });
  }
  initEmojiPalette();

  // Helper: Avatar Element Rendering
  function renderAvatar(avatar, container) {
    if (!container) return;
    container.innerHTML = '';
    if (avatar && (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('/uploads/'))) {
      const img = document.createElement('img');
      img.src = avatar;
      img.alt = 'Avatar';
      img.onerror = () => { container.textContent = '👤'; };
      container.appendChild(img);
    } else {
      container.textContent = avatar || '👤';
    }
  }

  // Helper: Format Time
  function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return timeStr;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Dünən ${timeStr}`;
    }
    return `${date.toLocaleDateString('az-AZ', { day: '2-digit', month: '2-digit' })} ${timeStr}`;
  }

  // Format Status Subtitle
  function formatStatus(isOnline, lastSeen) {
    if (isOnline) return 'onlayn';
    if (!lastSeen) return 'oflayn';
    return `son görünmə: ${formatTime(lastSeen)}`;
  }

  // Authentication Flow
  const storedUser = localStorage.getItem('moonapp_user');
  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser);
      loginUser(parsed);
    } catch (e) {
      loginBackdrop.style.display = 'flex';
    }
  } else {
    loginBackdrop.style.display = 'flex';
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = loginUsername.value.trim().toLowerCase();
    if (!username) return;

    loginUser({ username, nickname: username });
  });

  function loginUser(userData) {
    socket.emit('auth_login', userData, (res) => {
      if (res && res.success) {
        currentUser = res.user;
        localStorage.setItem('moonapp_user', JSON.stringify(currentUser));
        loginBackdrop.style.display = 'none';

        // Update My Profile UI
        renderAvatar(currentUser.avatar, myAvatarDisplay);
        myNicknameDisplay.textContent = currentUser.nickname || currentUser.username;
        myUsernameDisplay.textContent = `@${currentUser.username}`;

        // Load rooms
        rooms = res.rooms || [];
        renderChatList();

        // Auto open Lounge room if no chat selected
        if (!currentRoom) {
          const lounge = rooms.find((r) => r.id === 'moon_lounge');
          if (lounge) openRoom(lounge);
        }
      } else {
        alert(res?.error || 'Giriş uğursuz oldu');
      }
    });
  }

  btnLogout.addEventListener('click', () => {
    if (confirm('Hesabdan çıxmaq istədiyinizə əminsiniz?')) {
      localStorage.removeItem('moonapp_user');
      window.location.reload();
    }
  });

  // Load Rooms from Server
  function fetchRooms() {
    if (!currentUser) return;
    socket.emit('get_rooms', { showHidden: showLocked }, (res) => {
      if (res && res.rooms) {
        rooms = res.rooms;
        renderChatList();
        // If current active room updated, refresh header
        if (currentRoom) {
          const updated = rooms.find((r) => r.id === currentRoom.id);
          if (updated) {
            currentRoom = updated;
            updateChatHeader();
          }
        }
      }
    });
  }

  // Render Sidebar Chat List
  function renderChatList() {
    chatList.innerHTML = '';
    const query = chatSearchInput.value.trim().toLowerCase();

    const filtered = rooms.filter((r) => {
      if (currentFilter === 'direct' && r.type !== 'direct') return false;
      if (currentFilter === 'group' && r.type !== 'group') return false;
      if (query) {
        const name = (r.display_name || r.name || '').toLowerCase();
        const lastMsg = (r.last_message_content || '').toLowerCase();
        return name.includes(query) || lastMsg.includes(query);
      }
      return true;
    });

    if (filtered.length === 0) {
      chatList.innerHTML = `
        <div class="empty-list-msg">
          <p>Heç bir söhbət tapılmadı</p>
        </div>`;
      return;
    }

    filtered.forEach((room) => {
      const item = document.createElement('div');
      item.className = `chat-list-item ${currentRoom && currentRoom.id === room.id ? 'active' : ''}`;
      item.dataset.roomId = room.id;

      const isDirect = room.type === 'direct';
      const isOnline = isDirect && room.other_user_online === 1;

      // Last message preview text
      let previewText = room.last_message_content || 'Söhbətə başlayın...';
      if (room.last_message_type === 'image') previewText = '📷 Fotoşəkil';
      else if (room.last_message_type === 'file') previewText = '📄 Fayl';
      else if (room.last_message_type === 'location') previewText = '📍 Məkan';

      const timeStr = formatTime(room.last_message_time || room.created_at);

      item.innerHTML = `
        <div class="item-avatar-box">
          <div class="avatar-box" id="avatar_${room.id}"></div>
          ${isDirect ? `<span class="online-indicator ${isOnline ? 'online' : ''}"></span>` : ''}
        </div>
        <div class="item-body">
          <div class="item-top-row">
            <span class="item-name">${escapeHtml(room.display_name || room.name)}</span>
            <span class="item-time">${timeStr}</span>
          </div>
          <div class="item-bottom-row">
            <span class="item-preview">${escapeHtml(previewText)}</span>
            ${room.unread_count > 0 ? `<span class="unread-badge">${room.unread_count}</span>` : ''}
          </div>
        </div>
      `;

      renderAvatar(room.display_avatar || room.avatar, item.querySelector(`#avatar_${room.id}`));

      item.addEventListener('click', () => {
        openRoom(room);
        // Mobile view switcher
        if (window.innerWidth <= 768) {
          appLayout.classList.add('chat-open');
        }
      });

      chatList.appendChild(item);
    });
  }

  // Open Room and Load Messages
  function openRoom(room) {
    currentRoom = room;
    renderChatList();
    updateChatHeader();

    emptyChatState.style.display = 'none';
    activeChatWrapper.style.display = 'flex';

    // Clear and load messages
    messagesFlow.innerHTML = `
      <div class="system-bubble-notice">
        <span>🔒 Mesajlar ucdan-uca şifrələnmişdir. Kənar şəxslər oxuya bilməz.</span>
      </div>`;

    socket.emit('join_room', { roomId: room.id }, (res) => {
      if (res && res.messages) {
        res.messages.forEach((msg) => appendMessageBubble(msg));
        scrollToBottom();
      }
    });

    // Reset unread count locally
    room.unread_count = 0;
    renderChatList();
    closeReplyOrEditBanner();
    messageTextInput.focus();
  }

  // Update Main Chat Header
  function updateChatHeader() {
    if (!currentRoom) return;
    renderAvatar(currentRoom.display_avatar || currentRoom.avatar, targetChatAvatar);
    targetChatName.textContent = currentRoom.display_name || currentRoom.name;

    if (currentRoom.type === 'direct') {
      const isOnline = currentRoom.other_user_online === 1;
      targetChatStatus.textContent = formatStatus(isOnline, currentRoom.other_user_last_seen);
      targetChatStatus.className = `chat-status-text ${isOnline ? 'online' : ''}`;
      btnVoiceCall.style.display = 'inline-flex';
      btnVideoCall.style.display = 'inline-flex';
    } else {
      targetChatStatus.textContent = 'Qrup söhbəti';
      targetChatStatus.className = 'chat-status-text';
      btnVoiceCall.style.display = 'none';
      btnVideoCall.style.display = 'none';
    }
  }

  // Mobile Back Button
  btnMobileBack.addEventListener('click', () => {
    appLayout.classList.remove('chat-open');
  });

  // Filter Pills Handling
  filterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      filterPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.dataset.filter;
      renderChatList();
    });
  });

  chatSearchInput.addEventListener('input', () => {
    renderChatList();
  });

  // Append Message Bubble to Stream
  function appendMessageBubble(msg) {
    const isMe = currentUser && msg.sender_id === currentUser.id;
    const bubble = document.createElement('div');
    bubble.className = `msg-row ${isMe ? 'outgoing' : 'incoming'}`;
    bubble.id = `msg_${msg.id}`;

    // Reply quote snippet
    let replySnippetHtml = '';
    if (msg.reply_to_text) {
      replySnippetHtml = `
        <div class="msg-quote-box">
          <div class="quote-sender">${escapeHtml(msg.reply_to_sender || 'Mesaj')}</div>
          <div class="quote-text">${escapeHtml(msg.reply_to_text)}</div>
        </div>`;
    }

    // Message Content by Type
    let contentHtml = '';
    if (msg.type === 'image') {
      contentHtml = `
        <div class="msg-image-wrap">
          <img src="${msg.file_url}" alt="Fotoşəkil" loading="lazy" onclick="window.open('${msg.file_url}', '_blank')">
        </div>`;
      if (msg.content) {
        contentHtml += `<div class="msg-text-content">${escapeHtml(msg.content)}</div>`;
      }
    } else if (msg.type === 'file') {
      contentHtml = `
        <a href="${msg.file_url}" target="_blank" download="${msg.file_name || 'fayl'}" class="msg-file-card">
          <span class="file-icon">📁</span>
          <div class="file-details">
            <span class="file-name">${escapeHtml(msg.file_name || 'Fayl')}</span>
            <span class="file-size">${formatFileSize(msg.file_size)}</span>
          </div>
        </a>`;
      if (msg.content) {
        contentHtml += `<div class="msg-text-content">${escapeHtml(msg.content)}</div>`;
      }
    } else if (msg.type === 'location') {
      contentHtml = `
        <a href="${msg.content}" target="_blank" class="msg-file-card location">
          <span class="file-icon">📍</span>
          <div class="file-details">
            <span class="file-name">Məkan Paylaşıldı</span>
            <span class="file-size">Xəritədə baxmaq üçün toxunun</span>
          </div>
        </a>`;
    } else {
      contentHtml = `<div class="msg-text-content">${escapeHtml(msg.content)}</div>`;
    }

    // Status Tick
    let tickHtml = '';
    if (isMe) {
      const isRead = msg.status === 'read';
      tickHtml = `
        <span class="msg-tick ${isRead ? 'read' : ''}">
          <svg viewBox="0 0 16 11" width="16" height="11" fill="currentColor">
            <path d="M15.01 3.316l-8.03 8.03a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 011.06-1.06l3.71 3.71 7.5-7.5a.75.75 0 011.06 1.06z"/>
            ${isRead ? `<path d="M11.01 3.316l-8.03 8.03a.75.75 0 01-1.06 0L.98 10.406a.75.75 0 011.06-1.06l.94.94 7.5-7.5a.75.75 0 011.06 1.06z"/>` : ''}
          </svg>
        </span>`;
    }

    // Bubble Actions Button
    bubble.innerHTML = `
      <div class="bubble-inner">
        ${!isMe && currentRoom && currentRoom.type === 'group' ? `<div class="bubble-sender-name">${escapeHtml(msg.sender_name)}</div>` : ''}
        ${replySnippetHtml}
        ${contentHtml}
        <div class="msg-meta-row">
          ${msg.is_edited ? `<span class="edited-tag">(redaktə edildi)</span>` : ''}
          <span class="msg-time">${formatTime(msg.timestamp)}</span>
          ${tickHtml}
        </div>
        <div class="reactions-strip" id="reactions_${msg.id}"></div>
        <div class="bubble-quick-actions">
          <button class="action-mini-btn" title="Cavabla" data-action="reply">↩️</button>
          <button class="action-mini-btn" title="Reaksiya" data-action="react">❤️</button>
          ${isMe ? `<button class="action-mini-btn" title="Redaktə et" data-action="edit">✏️</button>` : ''}
          ${isMe ? `<button class="action-mini-btn danger" title="Sil" data-action="delete">🗑️</button>` : ''}
        </div>
      </div>
    `;

    // Render reactions if any
    renderReactions(msg.id, msg.reactions, bubble.querySelector(`#reactions_${msg.id}`));

    // Event listeners on bubble actions
    bubble.querySelector('[data-action="reply"]').addEventListener('click', () => {
      openReplyBanner(msg);
    });

    bubble.querySelector('[data-action="react"]').addEventListener('click', () => {
      socket.emit('toggle_reaction', { messageId: msg.id, reaction: '❤️', roomId: msg.room_id });
    });

    if (isMe) {
      const editBtn = bubble.querySelector('[data-action="edit"]');
      if (editBtn && msg.type === 'text') {
        editBtn.addEventListener('click', () => {
          openEditBanner(msg);
        });
      }
      const delBtn = bubble.querySelector('[data-action="delete"]');
      if (delBtn) {
        delBtn.addEventListener('click', () => {
          if (confirm('Bu mesajı silmək istəyirsiniz?')) {
            socket.emit('delete_message', { messageId: msg.id, roomId: msg.room_id });
          }
        });
      }
    }

    messagesFlow.appendChild(bubble);
  }

  function renderReactions(messageId, reactions, container) {
    if (!container) return;
    container.innerHTML = '';
    if (!reactions || reactions.length === 0) return;

    // Group reactions by emoji
    const map = {};
    reactions.forEach((r) => {
      map[r.reaction] = (map[r.reaction] || 0) + 1;
    });

    Object.keys(map).forEach((emoji) => {
      const pill = document.createElement('span');
      pill.className = 'reaction-pill';
      pill.textContent = `${emoji} ${map[emoji] > 1 ? map[emoji] : ''}`;
      pill.addEventListener('click', () => {
        socket.emit('toggle_reaction', { messageId, reaction: emoji, roomId: currentRoom.id });
      });
      container.appendChild(pill);
    });
  }

  function scrollToBottom() {
    messagesFlow.scrollTop = messagesFlow.scrollHeight;
  }

  // Reply / Edit Banner UI
  function openReplyBanner(msg) {
    replyContext = msg;
    editContext = null;
    bannerTitle.textContent = `Cavab: ${msg.sender_name}`;
    bannerSnippet.textContent = msg.content || (msg.type === 'image' ? '📷 Fotoşəkil' : '📄 Fayl');
    replyEditBanner.style.display = 'flex';
    messageTextInput.focus();
  }

  function openEditBanner(msg) {
    editContext = msg;
    replyContext = null;
    bannerTitle.textContent = 'Mesajı redaktə edin';
    bannerSnippet.textContent = msg.content;
    messageTextInput.value = msg.content;
    replyEditBanner.style.display = 'flex';
    messageTextInput.focus();
  }

  function closeReplyOrEditBanner() {
    replyContext = null;
    editContext = null;
    replyEditBanner.style.display = 'none';
  }

  btnCloseBanner.addEventListener('click', closeReplyOrEditBanner);

  // Sending Messages
  btnSendMessage.addEventListener('click', handleSendMessage);
  messageTextInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // Typing Notification
  messageTextInput.addEventListener('input', () => {
    if (!currentRoom) return;
    if (!isTyping) {
      isTyping = true;
      socket.emit('typing', { roomId: currentRoom.id });
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      isTyping = false;
      socket.emit('stop_typing', { roomId: currentRoom.id });
    }, 1500);
  });

  function handleSendMessage() {
    const text = messageTextInput.value.trim();
    if (!text || !currentRoom) return;

    if (editContext) {
      // Edit existing message
      socket.emit('edit_message', {
        messageId: editContext.id,
        newContent: text,
        roomId: currentRoom.id
      }, (res) => {
        if (res && res.error) alert(res.error);
        closeReplyOrEditBanner();
        messageTextInput.value = '';
      });
      return;
    }

    // Send new text message
    const payload = {
      roomId: currentRoom.id,
      content: text,
      type: 'text',
      replyToId: replyContext ? replyContext.id : null,
      replyToText: replyContext ? (replyContext.content || 'Fayl') : null,
      replyToSender: replyContext ? replyContext.sender_name : null
    };

    socket.emit('send_message', payload, (res) => {
      if (res && res.error) {
        alert(res.error);
      } else {
        MoonAudio.playSentSound();
      }
    });

    messageTextInput.value = '';
    closeReplyOrEditBanner();
    emojiPalette.style.display = 'none';
  }

  // Toggle Emoji & Attachments Menus
  btnToggleEmoji.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPalette.style.display = emojiPalette.style.display === 'flex' ? 'none' : 'flex';
    attachmentsPopover.style.display = 'none';
  });

  btnToggleAttach.addEventListener('click', (e) => {
    e.stopPropagation();
    attachmentsPopover.style.display = attachmentsPopover.style.display === 'flex' ? 'none' : 'flex';
    emojiPalette.style.display = 'none';
  });

  document.addEventListener('click', (e) => {
    if (!emojiPalette.contains(e.target) && e.target !== btnToggleEmoji) {
      emojiPalette.style.display = 'none';
    }
    if (!attachmentsPopover.contains(e.target) && e.target !== btnToggleAttach) {
      attachmentsPopover.style.display = 'none';
    }
    if (!chatOptionsPopup.contains(e.target) && e.target !== btnChatMenuTrigger) {
      chatOptionsPopup.style.display = 'none';
    }
  });

  // Attachments Handling
  btnAttachPhoto.addEventListener('click', () => {
    attachmentsPopover.style.display = 'none';
    imageFileInput.click();
  });

  btnAttachDoc.addEventListener('click', () => {
    attachmentsPopover.style.display = 'none';
    generalFileInput.click();
  });

  btnAttachLocation.addEventListener('click', () => {
    attachmentsPopover.style.display = 'none';
    if (!navigator.geolocation) {
      alert('Brauzeriniz məkan təyini dəstəkləmir.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const url = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
        socket.emit('send_message', {
          roomId: currentRoom.id,
          content: url,
          type: 'location'
        }, () => MoonAudio.playSentSound());
      },
      (err) => alert('Məkan icazəsi alınmadı: ' + err.message)
    );
  });

  imageFileInput.addEventListener('change', () => uploadAndSendFile(imageFileInput.files[0], 'image'));
  generalFileInput.addEventListener('change', () => uploadAndSendFile(generalFileInput.files[0], 'file'));

  function uploadAndSendFile(file, type) {
    if (!file || !currentRoom) return;
    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          socket.emit('send_message', {
            roomId: currentRoom.id,
            type: type,
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileSize: data.fileSize,
            content: ''
          }, () => MoonAudio.playSentSound());
        } else {
          alert('Yükləmə xətası: ' + data.error);
        }
      })
      .catch((e) => alert('Yükləmə xətası: ' + e.message));
  }

  // Chat Menu Dropdown Actions
  btnChatMenuTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    chatOptionsPopup.style.display = chatOptionsPopup.style.display === 'flex' ? 'none' : 'flex';
  });

  optHideChat.addEventListener('click', () => {
    chatOptionsPopup.style.display = 'none';
    if (!currentRoom) return;
    socket.emit('hide_room', { roomId: currentRoom.id }, () => {
      fetchRooms();
      currentRoom = null;
      activeChatWrapper.style.display = 'none';
      emptyChatState.style.display = 'flex';
    });
  });

  optClearChat.addEventListener('click', () => {
    chatOptionsPopup.style.display = 'none';
    if (!currentRoom) return;
    if (confirm('Bu söhbətdəki bütün mesajları təmizləmək istəyirsiniz?')) {
      socket.emit('clear_chat', { roomId: currentRoom.id }, () => {
        messagesFlow.innerHTML = '';
      });
    }
  });

  optDeleteChat.addEventListener('click', () => {
    chatOptionsPopup.style.display = 'none';
    if (!currentRoom) return;
    if (confirm('Bu söhbəti tamamilə silmək istəyirsiniz?')) {
      socket.emit('delete_room', { roomId: currentRoom.id }, () => {
        fetchRooms();
        currentRoom = null;
        activeChatWrapper.style.display = 'none';
        emptyChatState.style.display = 'flex';
      });
    }
  });

  // Socket Event Listeners for Reliable Real-time Delivery
  socket.on('new_message', (msg) => {
    if (currentRoom && msg.room_id === currentRoom.id) {
      appendMessageBubble(msg);
      scrollToBottom();
      if (currentUser && msg.sender_id !== currentUser.id) {
        socket.emit('mark_read', { roomId: currentRoom.id });
        MoonAudio.playReceivedSound();
      }
    } else {
      // Received message in another room
      if (currentUser && msg.sender_id !== currentUser.id) {
        MoonAudio.playReceivedSound();
      }
      fetchRooms();
    }
  });

  socket.on('direct_message_notify', ({ roomId, message }) => {
    // If not on the room, refresh sidebar to guarantee receipt and update preview/unread count
    if (!currentRoom || currentRoom.id !== roomId) {
      fetchRooms();
    }
  });

  socket.on('room_added', () => {
    fetchRooms();
  });

  socket.on('update_room_preview', () => {
    fetchRooms();
  });

  socket.on('messages_read_receipt', ({ roomId }) => {
    if (currentRoom && currentRoom.id === roomId) {
      document.querySelectorAll('.msg-row.outgoing .msg-tick').forEach((tick) => {
        tick.classList.add('read');
      });
    }
  });

  socket.on('message_deleted', ({ messageId }) => {
    const el = document.getElementById(`msg_${messageId}`);
    if (el) el.remove();
  });

  socket.on('message_edited', ({ message }) => {
    const el = document.getElementById(`msg_${message.id}`);
    if (el) {
      const textEl = el.querySelector('.msg-text-content');
      if (textEl) textEl.textContent = message.content;
      const metaEl = el.querySelector('.msg-meta-row');
      if (metaEl && !metaEl.querySelector('.edited-tag')) {
        const tag = document.createElement('span');
        tag.className = 'edited-tag';
        tag.textContent = '(redaktə edildi)';
        metaEl.prepend(tag);
      }
    }
  });

  socket.on('reaction_updated', ({ messageId, reactions }) => {
    const container = document.getElementById(`reactions_${messageId}`);
    if (container) renderReactions(messageId, reactions, container);
  });

  socket.on('user_presence', ({ userId, online, lastSeen }) => {
    // Update rooms list
    rooms.forEach((r) => {
      if (r.other_user_id === userId) {
        r.other_user_online = online;
        r.other_user_last_seen = lastSeen;
      }
    });
    renderChatList();
    if (currentRoom && currentRoom.other_user_id === userId) {
      currentRoom.other_user_online = online;
      currentRoom.other_user_last_seen = lastSeen;
      updateChatHeader();
    }
  });

  socket.on('user_typing', ({ roomId, nickname }) => {
    if (currentRoom && currentRoom.id === roomId) {
      targetChatStatus.textContent = `${nickname} yazır...`;
      targetChatStatus.className = 'chat-status-text online';
    }
  });

  socket.on('user_stop_typing', ({ roomId }) => {
    if (currentRoom && currentRoom.id === roomId) {
      updateChatHeader();
    }
  });

  // New Chat Modal
  btnNewChat.addEventListener('click', () => {
    newChatModal.style.display = 'flex';
    loadUsersList();
  });

  btnCloseNewChat.addEventListener('click', () => {
    newChatModal.style.display = 'none';
  });

  function loadUsersList() {
    socket.emit('get_users', { showHidden: showLocked }, (res) => {
      if (res && res.users) {
        renderUsersModal(res.users);
      }
    });
  }

  function renderUsersModal(users) {
    newChatUsersList.innerHTML = '';
    const query = userSearchFilter.value.trim().toLowerCase();
    const filtered = users.filter((u) => {
      if (currentUser && u.id === currentUser.id) return false;
      if (query) {
        return (u.nickname || '').toLowerCase().includes(query) || (u.username || '').toLowerCase().includes(query);
      }
      return true;
    });

    if (filtered.length === 0) {
      newChatUsersList.innerHTML = '<p class="empty-list-msg">İstifadəçi tapılmadı</p>';
      return;
    }

    filtered.forEach((u) => {
      const row = document.createElement('div');
      row.className = 'user-row-item';
      row.innerHTML = `
        <div class="item-avatar-box">
          <div class="avatar-box" id="u_avatar_${u.id}"></div>
        </div>
        <div class="user-row-info">
          <span class="u-name">${escapeHtml(u.nickname || u.username)}</span>
          <span class="u-sub">@${escapeHtml(u.username)} • ${u.online ? '<span style="color:#00a884;">🟢 onlayn</span>' : 'oflayn'}</span>
        </div>
      `;
      renderAvatar(u.avatar, row.querySelector(`#u_avatar_${u.id}`));

      row.addEventListener('click', () => {
        newChatModal.style.display = 'none';
        socket.emit('open_direct_chat', { targetUserId: u.id }, (res) => {
          if (res && res.success) {
            fetchRooms();
            openRoom(res.room);
          }
        });
      });

      newChatUsersList.appendChild(row);
    });
  }

  userSearchFilter.addEventListener('input', loadUsersList);

  // Profile Edit Modal
  btnOpenMyProfile.addEventListener('click', () => {
    if (!currentUser) return;
    profileModal.style.display = 'flex';
    editNickInput.value = currentUser.nickname || '';
    editBioInput.value = currentUser.bio || '';
    renderAvatar(currentUser.avatar, editAvatarBox);
  });

  btnCloseProfile.addEventListener('click', () => {
    profileModal.style.display = 'none';
  });

  btnSelectNewPic.addEventListener('click', () => avatarFileInput.click());

  avatarFileInput.addEventListener('change', () => {
    const file = avatarFileInput.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/upload', { method: 'POST', body: formData })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          currentUser.avatar = data.fileUrl;
          renderAvatar(data.fileUrl, editAvatarBox);
        }
      });
  });

  profileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nickname = editNickInput.value.trim();
    const bio = editBioInput.value.trim();

    socket.emit('update_profile', { nickname, bio, avatar: currentUser.avatar }, (res) => {
      if (res && res.success) {
        currentUser = res.user;
        localStorage.setItem('moonapp_user', JSON.stringify(currentUser));
        renderAvatar(currentUser.avatar, myAvatarDisplay);
        myNicknameDisplay.textContent = currentUser.nickname;
        profileModal.style.display = 'none';
      }
    });
  });

  // Locked / Hidden Chats (PIN Protected)
  btnToggleLocked.addEventListener('click', () => {
    if (showLocked) {
      exitLockedMode();
    } else {
      pinModal.style.display = 'flex';
      pinInputVal.value = '';
      pinErrMsg.style.display = 'none';
      pinInputVal.focus();
    }
  });

  btnClosePin.addEventListener('click', () => {
    pinModal.style.display = 'none';
  });

  btnCheckPin.addEventListener('click', handlePinVerification);
  pinInputVal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlePinVerification();
  });

  function handlePinVerification() {
    const pin = pinInputVal.value.trim();
    if (!pin) return;
    socket.emit('verify_pin', { pin }, (res) => {
      if (res && res.isValid) {
        showLocked = true;
        pinModal.style.display = 'none';
        lockedBanner.style.display = 'flex';
        fetchRooms();
      } else {
        pinErrMsg.style.display = 'block';
      }
    });
  }

  function exitLockedMode() {
    showLocked = false;
    lockedBanner.style.display = 'none';
    fetchRooms();
  }

  btnExitLocked.addEventListener('click', exitLockedMode);

  // WebRTC Real-Time Calling System (Voice & Video)
  btnVoiceCall.addEventListener('click', () => initiateCall('voice'));
  btnVideoCall.addEventListener('click', () => initiateCall('video'));

  async function initiateCall(type) {
    if (!currentRoom || currentRoom.type !== 'direct') return;
    const targetUserId = currentRoom.other_user_id;
    if (!targetUserId) return;

    currentCallTarget = targetUserId;
    currentCallType = type;

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });
    } catch (err) {
      alert('Mikrofon və ya Kamera icazəsi tələb olunur: ' + err.message);
      return;
    }

    showCallOverlay(currentRoom.display_name, currentRoom.display_avatar, 'Zəng edilir...');
    MoonAudio.startOutgoingRing();

    createPeerConnection();
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    if (type === 'video') {
      videoScreens.style.display = 'flex';
      audioCallerDisplay.style.display = 'none';
      localVideoEl.srcObject = localStream;
      btnToggleCam.style.display = 'inline-flex';
    } else {
      videoScreens.style.display = 'none';
      audioCallerDisplay.style.display = 'flex';
      btnToggleCam.style.display = 'none';
    }

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('call_user', {
      targetUserId,
      offer,
      callType: type
    });
  }

  function createPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.onicecandidate = (e) => {
      if (e.candidate && currentCallTarget) {
        socket.emit('ice_candidate', {
          targetUserId: currentCallTarget,
          candidate: e.candidate
        });
      }
    };

    peerConnection.ontrack = (e) => {
      console.log('[WebRTC] Track received:', e.track.kind);
      const stream = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]);

      if (currentCallType === 'video' && remoteVideoEl) {
        remoteVideoEl.srcObject = stream;
        remoteVideoEl.play().catch((err) => console.warn('remoteVideo play err:', err));
      }

      if (remoteAudioOutput) {
        remoteAudioOutput.srcObject = stream;
        remoteAudioOutput.play().catch((err) => console.warn('remoteAudio play err:', err));
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        callCardState.textContent = 'Danışıq davam edir...';
        startCallClock();
      } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
        endCallCleanup();
      }
    };
  }

  async function processQueuedIceCandidates() {
    if (!peerConnection || !peerConnection.remoteDescription) return;
    while (iceCandidateQueue.length > 0) {
      const cand = iceCandidateQueue.shift();
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn('Queued ICE error:', e);
      }
    }
  }

  function showCallOverlay(name, avatar, state) {
    callOverlay.style.display = 'flex';
    callCardName.textContent = name;
    renderAvatar(avatar, callCardAvatar);
    callCardState.textContent = state;
    callClock.textContent = '00:00';
  }

  function startCallClock() {
    callStartTime = Date.now();
    clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      callClock.textContent = `${m}:${s}`;
    }, 1000);
  }

  function endCallCleanup() {
    MoonAudio.stopRinging();
    clearInterval(callTimerInterval);
    iceCandidateQueue = [];
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
    if (remoteVideoEl) remoteVideoEl.srcObject = null;
    if (localVideoEl) localVideoEl.srcObject = null;
    if (remoteAudioOutput) remoteAudioOutput.srcObject = null;
    callOverlay.style.display = 'none';
    incomingCallBackdrop.style.display = 'none';
    incomingCallData = null;
    currentCallTarget = null;
  }

  btnEndActiveCall.addEventListener('click', () => {
    if (currentCallTarget) {
      socket.emit('end_call', { targetUserId: currentCallTarget });
    }
    endCallCleanup();
  });

  btnMuteAudio.addEventListener('click', () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        btnMuteAudio.textContent = audioTrack.enabled ? '🎤' : '🔇';
      }
    }
  });

  btnToggleCam.addEventListener('click', () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        btnToggleCam.textContent = videoTrack.enabled ? '📹' : '📷⃠';
      }
    }
  });

  // Incoming Call Signals
  socket.on('incoming_call', ({ fromUserId, callerName, callerAvatar, offer, callType }) => {
    incomingCallData = { fromUserId, callerName, callerAvatar, offer, callType };
    incCallerName.textContent = callerName;
    renderAvatar(callerAvatar, incAvatar);
    incCallType.textContent = callType === 'video' ? 'Görüntülü zəng edir...' : 'Səsli zəng edir...';
    incomingCallBackdrop.style.display = 'flex';
    MoonAudio.startIncomingRing();
  });

  btnRejectIncoming.addEventListener('click', () => {
    if (incomingCallData) {
      socket.emit('reject_call', { targetUserId: incomingCallData.fromUserId });
    }
    endCallCleanup();
  });

  btnAcceptIncoming.addEventListener('click', async () => {
    if (!incomingCallData) return;
    MoonAudio.stopRinging();
    incomingCallBackdrop.style.display = 'none';

    currentCallTarget = incomingCallData.fromUserId;
    currentCallType = incomingCallData.callType;

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: currentCallType === 'video'
      });
    } catch (err) {
      alert('Media icazəsi tələb olunur: ' + err.message);
      endCallCleanup();
      return;
    }

    showCallOverlay(incomingCallData.callerName, incomingCallData.callerAvatar, 'Danışıq davam edir...');

    createPeerConnection();
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    if (currentCallType === 'video') {
      videoScreens.style.display = 'flex';
      audioCallerDisplay.style.display = 'none';
      localVideoEl.srcObject = localStream;
      btnToggleCam.style.display = 'inline-flex';
    } else {
      videoScreens.style.display = 'none';
      audioCallerDisplay.style.display = 'flex';
      btnToggleCam.style.display = 'none';
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));
    await processQueuedIceCandidates();
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('accept_call', {
      targetUserId: incomingCallData.fromUserId,
      answer
    });
  });

  socket.on('call_accepted', async ({ answer }) => {
    MoonAudio.stopRinging();
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      await processQueuedIceCandidates();
      callCardState.textContent = 'Danışıq davam edir...';
      startCallClock();
    }
  });

  socket.on('call_rejected', () => {
    alert('Zəng rədd edildi.');
    endCallCleanup();
  });

  socket.on('call_ended', () => {
    endCallCleanup();
  });

  socket.on('ice_candidate', async ({ candidate }) => {
    if (!candidate) return;
    if (peerConnection && peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('ICE Candidate error:', e);
      }
    } else {
      iceCandidateQueue.push(candidate);
    }
  });

  // Utilities
  function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
});
