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
  const inputNormalMode = document.getElementById('inputNormalMode');
  const btnStartVoiceRecord = document.getElementById('btnStartVoiceRecord');
  const voiceRecordingBar = document.getElementById('voiceRecordingBar');
  const btnCancelVoiceRecord = document.getElementById('btnCancelVoiceRecord');
  const btnSendVoiceRecord = document.getElementById('btnSendVoiceRecord');
  const voiceRecTimer = document.getElementById('voiceRecTimer');
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
  const loginPin = document.getElementById('loginPin');

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

  // Helper: Verified Tick Badge (Mavi Tik)
  function getVerifiedBadgeHtml(isVerified) {
    if (!isVerified) return '';
    return `<span class="verified-tick-badge" title="Təsdiqlənmiş Hesab"><svg viewBox="0 0 24 24" fill="#00a884"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg></span>`;
  }

  // Helper: Avatar Element Rendering
  function renderAvatar(avatar, container) {
    if (!container) return;
    container.innerHTML = '';
    if (avatar && (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('/uploads/'))) {
      const img = document.createElement('img');
      img.src = avatar;
      img.alt = 'Avatar';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = 'inherit';
      img.style.display = 'block';
      img.onerror = () => { container.textContent = '🌙'; };
      container.appendChild(img);
    } else {
      container.textContent = avatar || '🌙';
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

  // Helper: Format Duration (seconds to mm:ss)
  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // Active audio player instance tracker
  let activeAudioPlayer = null;
  let activePlayBtn = null;

  function initVoiceMessagePlayer(bubble, fileUrl) {
    const playBtn = bubble.querySelector('.voice-play-btn');
    const progressBar = bubble.querySelector('.voice-track-progress');
    const trackBar = bubble.querySelector('.voice-track-bar');
    const currTimeEl = bubble.querySelector('.curr-time');
    const totalTimeEl = bubble.querySelector('.total-time');
    const playIcon = bubble.querySelector('.play-icon');
    const pauseIcon = bubble.querySelector('.pause-icon');

    if (!playBtn) return;

    const audio = new Audio(fileUrl);

    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        totalTimeEl.textContent = formatDuration(audio.duration);
      }
    });

    audio.addEventListener('timeupdate', () => {
      if (audio.duration) {
        const pct = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = `${pct}%`;
        currTimeEl.textContent = formatDuration(audio.currentTime);
      }
    });

    audio.addEventListener('ended', () => {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      progressBar.style.width = '0%';
      currTimeEl.textContent = '0:00';
      activeAudioPlayer = null;
      activePlayBtn = null;
    });

    playBtn.addEventListener('click', () => {
      if (activeAudioPlayer && activeAudioPlayer !== audio) {
        activeAudioPlayer.pause();
        if (activePlayBtn) {
          activePlayBtn.querySelector('.play-icon').style.display = 'block';
          activePlayBtn.querySelector('.pause-icon').style.display = 'none';
        }
      }

      if (audio.paused) {
        audio.play().then(() => {
          playIcon.style.display = 'none';
          pauseIcon.style.display = 'block';
          activeAudioPlayer = audio;
          activePlayBtn = playBtn;
        }).catch(err => console.error('Audio play error:', err));
      } else {
        audio.pause();
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        activeAudioPlayer = null;
        activePlayBtn = null;
      }
    });

    if (trackBar) {
      trackBar.addEventListener('click', (e) => {
        if (!audio.duration) return;
        const rect = trackBar.getBoundingClientRect();
        const clickPos = (e.clientX - rect.left) / rect.width;
        audio.currentTime = clickPos * audio.duration;
      });
    }
  }

  // Format Status Subtitle
  function formatStatus(isOnline, lastSeen) {
    if (isOnline) return 'onlayn';
    if (!lastSeen) return 'oflayn';
    return `son görünmə: ${formatTime(lastSeen)}`;
  }

  // Fetch Public App Settings (e.g. customized title)
  fetch('/api/settings')
    .then(r => r.json())
    .then(data => {
      if (data && data.app_title) {
        document.title = data.app_title;
      }
    })
    .catch(() => {});

  // Helper to load and save local lists (pinned, muted, favorites, unread overrides)
  function getStoredList(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) { return []; }
  }
  function setStoredList(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch(e) {}
  }
  function showToast(msg) {
    let t = document.getElementById('moonToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'moonToast';
      t.style.position = 'fixed';
      t.style.bottom = '28px';
      t.style.left = '50%';
      t.style.transform = 'translateX(-50%)';
      t.style.background = '#233138';
      t.style.color = '#e9edef';
      t.style.border = '1px solid rgba(255,255,255,0.1)';
      t.style.padding = '10px 22px';
      t.style.borderRadius = '24px';
      t.style.fontSize = '14px';
      t.style.fontWeight = '500';
      t.style.boxShadow = '0 6px 20px rgba(0,0,0,0.6)';
      t.style.zIndex = '9999';
      t.style.transition = 'opacity 0.25s ease';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    t.style.display = 'block';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => { t.style.display = 'none'; }, 250);
    }, 2400);
  }

  // Authentication Flow with 4-digit PIN Protection
  const storedUser = localStorage.getItem('moonapp_user');
  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser);
      if (parsed && parsed.username && parsed.pin_code) {
        loginUser(parsed);
      } else {
        localStorage.removeItem('moonapp_user');
        loginBackdrop.style.display = 'flex';
      }
    } catch (e) {
      localStorage.removeItem('moonapp_user');
      loginBackdrop.style.display = 'flex';
    }
  } else {
    loginBackdrop.style.display = 'flex';
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = loginUsername.value.trim().toLowerCase();
    const pin = loginPin ? loginPin.value.trim() : '';

    if (!username) {
      alert('Zəhmət olmasa istifadəçi adınızı daxil edin.');
      return;
    }
    if (!pin || pin.length < 4) {
      alert('Hesabınızı qorumaq üçün ən azı 4 rəqəmli PİN kod daxil edin!');
      return;
    }

    loginUser({ username, nickname: username, pin_code: pin });
  });

  function loginUser(userData) {
    socket.emit('auth_login', userData, (res) => {
      if (res && res.success) {
        currentUser = res.user;
        currentUser.pin_code = userData.pin_code;
        localStorage.setItem('moonapp_user', JSON.stringify(currentUser));
        loginBackdrop.style.display = 'none';

        // Update My Profile UI
        renderAvatar(currentUser.avatar, myAvatarDisplay);
        myNicknameDisplay.innerHTML = `${escapeHtml(currentUser.nickname || currentUser.username)}${getVerifiedBadgeHtml(currentUser.is_verified)}`;
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
        localStorage.removeItem('moonapp_user');
        loginBackdrop.style.display = 'flex';
        alert(res?.error || 'Giriş uğursuz oldu. İstifadəçi adınızı və PİN kodunuzu yoxlayın.');
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
    const isArchived = currentFilter === 'archived';
    socket.emit('get_rooms', { showHidden: isArchived || showLocked }, (res) => {
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

  // Render Sidebar Chat List with Pinned sorting & Authentic WhatsApp Dropdown Menu
  function renderChatList() {
    chatList.innerHTML = '';
    const query = chatSearchInput.value.trim().toLowerCase();

    let pinnedRooms = getStoredList('moonapp_pinned_rooms');
    let mutedRooms = getStoredList('moonapp_muted_rooms');
    let favoriteRooms = getStoredList('moonapp_fav_rooms');
    let unreadOverrides = getStoredList('moonapp_unread_overrides');

    const filtered = rooms.filter((r) => {
      if (currentFilter === 'direct' && r.type !== 'direct') return false;
      if (currentFilter === 'group' && r.type !== 'group') return false;
      if (currentFilter === 'archived' && r.is_hidden !== 1) return false;
      if (currentFilter !== 'archived' && !showLocked && r.is_hidden === 1) return false;
      if (query) {
        const name = (r.display_name || r.name || '').toLowerCase();
        const lastMsg = (r.last_message_content || '').toLowerCase();
        return name.includes(query) || lastMsg.includes(query);
      }
      return true;
    });

    // Pinned chats appear first, then sorted by last message time
    filtered.sort((a, b) => {
      const aPinned = pinnedRooms.includes(a.id) ? 1 : 0;
      const bPinned = pinnedRooms.includes(b.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      const aTime = a.last_message_time || 0;
      const bTime = b.last_message_time || 0;
      return bTime - aTime;
    });

    if (filtered.length === 0) {
      chatList.innerHTML = `
        <div class="empty-list-msg">
          <p>${currentFilter === 'archived' ? 'Arxivlənmiş söhbət yoxdur' : 'Heç bir söhbət tapılmadı'}</p>
        </div>`;
      return;
    }

    filtered.forEach((room) => {
      const item = document.createElement('div');
      item.className = `chat-list-item ${currentRoom && currentRoom.id === room.id ? 'active' : ''}`;
      item.dataset.roomId = room.id;

      const isDirect = room.type === 'direct';
      const isOnline = isDirect && room.other_user_online === 1;
      const isPinned = pinnedRooms.includes(room.id);
      const isMuted = mutedRooms.includes(room.id);
      const isFav = favoriteRooms.includes(room.id);
      const hasUnread = unreadOverrides.includes(room.id);
      const unreadCount = hasUnread ? (room.unread_count || 1) : (room.unread_count || 0);

      // Last message preview text
      let previewText = room.last_message_content || 'Söhbətə başlayın...';
      if (room.last_message_type === 'image') previewText = '📷 Fotoşəkil';
      else if (room.last_message_type === 'voice' || room.last_message_type === 'audio') previewText = '🎤 Səsli mesaj';
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
            <span class="item-name">${escapeHtml(room.display_name || room.name)}${isDirect ? getVerifiedBadgeHtml(room.other_user_verified) : ''}</span>
            <span class="item-time">${timeStr}</span>
          </div>
          <div class="item-bottom-row">
            <span class="item-preview">${escapeHtml(previewText)}</span>
            <div class="item-badges-group">
              ${isMuted ? `<span class="badge-icon" title="Səssiz"><svg viewBox="0 0 24 24" width="14" height="14" fill="#8696a0"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg></span>` : ''}
              ${isFav ? `<span class="badge-icon" title="Sevimlilər"><svg viewBox="0 0 24 24" width="14" height="14" fill="#eab308"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg></span>` : ''}
              ${isPinned ? `<span class="badge-icon" title="Sancaqlanıb"><svg viewBox="0 0 24 24" width="14" height="14" fill="#8696a0"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg></span>` : ''}
              ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
            </div>
            <button class="chat-item-actions-btn" title="Menyu" data-room-id="${room.id}">
              <svg viewBox="0 0 19 20" width="18" height="18" fill="currentColor"><path d="m3.8 6.7 5.7 5.7 5.7-5.7 1.6 1.6-7.3 7.2-7.3-7.2 1.6-1.6z"/></svg>
            </button>
          </div>
        </div>
      `;

      renderAvatar(room.display_avatar || room.avatar, item.querySelector(`#avatar_${room.id}`));

      // WhatsApp Web Context Menu Trigger
      const chevronBtn = item.querySelector('.chat-item-actions-btn');
      if (chevronBtn) {
        chevronBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const alreadyOpen = item.querySelector('.item-context-dropdown');
          document.querySelectorAll('.item-context-dropdown').forEach(d => d.remove());
          document.querySelectorAll('.chat-list-item.dropdown-active').forEach(i => i.classList.remove('dropdown-active'));

          if (alreadyOpen) return;

          item.classList.add('dropdown-active');

          const isArchivedView = currentFilter === 'archived' || room.is_hidden === 1;
          const dropdown = document.createElement('div');
          dropdown.className = 'item-context-dropdown';
          dropdown.innerHTML = `
            <button class="item-context-option" data-action="${isArchivedView ? 'unarchive' : 'archive'}">
              <div class="item-context-left">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM6.24 5h11.52l.83 1H5.42l.82-1z${isArchivedView ? 'M12 9.5l5.5 5.5H14v2h-4v-2H6.5L12 9.5z' : 'M12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5z'}"/></svg>
                <span>${isArchivedView ? 'Söhbəti arxivdən çıxarın' : 'Söhbəti arxivləşdirin'}</span>
              </div>
            </button>
            <button class="item-context-option" data-action="mute">
              <div class="item-context-left">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
                <span>${isMuted ? 'Səsi açın' : 'Bildirişləri səssiz edin'}</span>
              </div>
              <span class="item-context-arrow">›</span>
            </button>
            <button class="item-context-option" data-action="pin">
              <div class="item-context-left">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                <span>${isPinned ? 'Söhbəti sancaqdan çıxarın' : 'Söhbəti sancaqlayın'}</span>
              </div>
            </button>
            <button class="item-context-option" data-action="unread">
              <div class="item-context-left">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>
                <span>${hasUnread ? 'Oxunmuş kimi işarələyin' : 'Oxunmamış kimi işarələyin'}</span>
              </div>
            </button>
            <button class="item-context-option" data-action="favorite">
              <div class="item-context-left">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></svg>
                <span>${isFav ? 'Sevimlilərdən çıxar' : 'Sevimlilərə əlavə et'}</span>
              </div>
            </button>
            <button class="item-context-option" data-action="list">
              <div class="item-context-left">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
                <span>Siyahıya əlavə edin</span>
              </div>
              <span class="item-context-arrow">›</span>
            </button>
            <div class="item-context-divider"></div>
            ${isDirect ? `
            <button class="item-context-option" data-action="block">
              <div class="item-context-left">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/></svg>
                <span>Bloklayın</span>
              </div>
            </button>` : ''}
            <button class="item-context-option" data-action="clear">
              <div class="item-context-left">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/></svg>
                <span>Söhbəti təmizləyin</span>
              </div>
            </button>
            <button class="item-context-option danger" data-action="delete">
              <div class="item-context-left">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                <span>Söhbəti silin</span>
              </div>
            </button>
          `;

          // Action 1: Archive or Unarchive
          const unarchiveBtn = dropdown.querySelector('[data-action="unarchive"]');
          if (unarchiveBtn) {
            unarchiveBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              dropdown.remove();
              item.classList.remove('dropdown-active');
              socket.emit('unhide_room', { roomId: room.id }, () => {
                showToast('Söhbət arxivdən çıxarıldı');
                fetchRooms();
              });
            });
          }

          const archiveBtn = dropdown.querySelector('[data-action="archive"]');
          if (archiveBtn) {
            archiveBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              dropdown.remove();
              item.classList.remove('dropdown-active');
              socket.emit('hide_room', { roomId: room.id }, () => {
                showToast('Söhbət arxivləşdirildi');
                if (currentRoom && currentRoom.id === room.id) {
                  currentRoom = null;
                  activeChatWrapper.style.display = 'none';
                  emptyChatState.style.display = 'flex';
                  if (window.innerWidth <= 768) {
                    appLayout.classList.remove('chat-open');
                  }
                }
                fetchRooms();
              });
            });
          }

          // Action 2: Mute
          dropdown.querySelector('[data-action="mute"]').addEventListener('click', (ev) => {
            ev.stopPropagation();
            dropdown.remove();
            item.classList.remove('dropdown-active');
            let mList = getStoredList('moonapp_muted_rooms');
            if (mList.includes(room.id)) {
              mList = mList.filter(id => id !== room.id);
              showToast('Bildirişlər aktiv edildi');
            } else {
              mList.push(room.id);
              showToast('Bildirişlər səssiz edildi');
            }
            setStoredList('moonapp_muted_rooms', mList);
            renderChatList();
          });

          // Action 3: Pin
          dropdown.querySelector('[data-action="pin"]').addEventListener('click', (ev) => {
            ev.stopPropagation();
            dropdown.remove();
            item.classList.remove('dropdown-active');
            let pList = getStoredList('moonapp_pinned_rooms');
            if (pList.includes(room.id)) {
              pList = pList.filter(id => id !== room.id);
              showToast('Söhbət sancaqdan çıxarıldı');
            } else {
              pList.push(room.id);
              showToast('Söhbət yuxarı sancaqlanıldı');
            }
            setStoredList('moonapp_pinned_rooms', pList);
            renderChatList();
          });

          // Action 4: Unread
          dropdown.querySelector('[data-action="unread"]').addEventListener('click', (ev) => {
            ev.stopPropagation();
            dropdown.remove();
            item.classList.remove('dropdown-active');
            let uList = getStoredList('moonapp_unread_overrides');
            if (uList.includes(room.id)) {
              uList = uList.filter(id => id !== room.id);
            } else {
              uList.push(room.id);
            }
            setStoredList('moonapp_unread_overrides', uList);
            renderChatList();
          });

          // Action 5: Favorite
          dropdown.querySelector('[data-action="favorite"]').addEventListener('click', (ev) => {
            ev.stopPropagation();
            dropdown.remove();
            item.classList.remove('dropdown-active');
            let fList = getStoredList('moonapp_fav_rooms');
            if (fList.includes(room.id)) {
              fList = fList.filter(id => id !== room.id);
              showToast('Sevimlilərdən çıxarıldı');
            } else {
              fList.push(room.id);
              showToast('Sevimlilərə əlavə edildi');
            }
            setStoredList('moonapp_fav_rooms', fList);
            renderChatList();
          });

          // Action 6: List
          dropdown.querySelector('[data-action="list"]').addEventListener('click', (ev) => {
            ev.stopPropagation();
            dropdown.remove();
            item.classList.remove('dropdown-active');
            showToast('Söhbət fərdi siyahıya əlavə edildi');
          });

          // Action 7: Block (if direct)
          const blockBtn = dropdown.querySelector('[data-action="block"]');
          if (blockBtn) {
            blockBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              dropdown.remove();
              item.classList.remove('dropdown-active');
              if (confirm('Bu istifadəçini bloklamaq istəyirsiniz?')) {
                socket.emit('hide_user', { targetUserId: room.other_user_id }, () => {
                  showToast('İstifadəçi bloklandı');
                  if (currentRoom && currentRoom.id === room.id) {
                    currentRoom = null;
                    activeChatWrapper.style.display = 'none';
                    emptyChatState.style.display = 'flex';
                  }
                  fetchRooms();
                });
              }
            });
          }

          // Action 8: Clear
          dropdown.querySelector('[data-action="clear"]').addEventListener('click', (ev) => {
            ev.stopPropagation();
            dropdown.remove();
            item.classList.remove('dropdown-active');
            if (confirm('Bu söhbətdəki bütün mesajları təmizləmək istəyirsiniz?')) {
              socket.emit('clear_chat', { roomId: room.id }, () => {
                showToast('Mesajlar təmizləndi');
                if (currentRoom && currentRoom.id === room.id) {
                  messagesFlow.innerHTML = '';
                }
                fetchRooms();
              });
            }
          });

          // Action 9: Delete
          dropdown.querySelector('[data-action="delete"]').addEventListener('click', (ev) => {
            ev.stopPropagation();
            dropdown.remove();
            item.classList.remove('dropdown-active');
            if (confirm('Bu söhbəti sol siyahıdan tamamilə silmək istəyirsiniz?')) {
              socket.emit('delete_room', { roomId: room.id }, () => {
                showToast('Söhbət silindi');
                if (currentRoom && currentRoom.id === room.id) {
                  currentRoom = null;
                  activeChatWrapper.style.display = 'none';
                  emptyChatState.style.display = 'flex';
                  if (window.innerWidth <= 768) {
                    appLayout.classList.remove('chat-open');
                  }
                }
                fetchRooms();
              });
            }
          });

          item.appendChild(dropdown);
        });
      }

      item.addEventListener('click', () => {
        document.querySelectorAll('.item-context-dropdown').forEach(d => d.remove());
        document.querySelectorAll('.chat-list-item.dropdown-active').forEach(i => i.classList.remove('dropdown-active'));
        // If unread override was active, remove it
        let uList = getStoredList('moonapp_unread_overrides');
        if (uList.includes(room.id)) {
          setStoredList('moonapp_unread_overrides', uList.filter(id => id !== room.id));
        }
        openRoom(room);
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

    // Mobile view switcher: IMMEDIATELY transition to chat pane
    if (window.innerWidth <= 768) {
      appLayout.classList.add('chat-open');
    }

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
    updateSendMicButtonVisibility();
    setTimeout(() => {
      messageTextInput?.focus();
    }, 120);
  }

  // Update Main Chat Header
  function updateChatHeader() {
    if (!currentRoom) return;
    renderAvatar(currentRoom.display_avatar || currentRoom.avatar, targetChatAvatar);
    
    const isDirect = currentRoom.type === 'direct';
    targetChatName.innerHTML = `${escapeHtml(currentRoom.display_name || currentRoom.name)}${isDirect ? getVerifiedBadgeHtml(currentRoom.other_user_verified) : ''}`;

    if (isDirect) {
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
      fetchRooms();
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
    } else if (msg.type === 'voice' || msg.type === 'audio') {
      contentHtml = `
        <div class="msg-voice-card" id="voice_card_${msg.id}">
          <button class="voice-play-btn" data-audio-src="${msg.file_url}" title="Səsi dinlə">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path class="play-icon" d="M8 5v14l11-7z"/>
              <path class="pause-icon" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" style="display: none;"/>
            </svg>
          </button>
          <div class="voice-track-info">
            <div class="voice-track-bar">
              <div class="voice-track-progress"></div>
            </div>
            <div class="voice-track-time">
              <span class="curr-time">0:00</span>
              <span class="total-time">${formatDuration(msg.duration || 0)}</span>
            </div>
          </div>
        </div>`;
      if (msg.content) {
        contentHtml += `<div class="msg-text-content" style="margin-top: 4px;">${escapeHtml(msg.content)}</div>`;
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
        ${!isMe && currentRoom && currentRoom.type === 'group' ? `<div class="bubble-sender-name">${escapeHtml(msg.sender_name)}${getVerifiedBadgeHtml(msg.sender_verified)}</div>` : ''}
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

    if (msg.type === 'voice' || msg.type === 'audio') {
      initVoiceMessagePlayer(bubble, msg.file_url);
    }

    // Toggle actions on mobile tap
    const bubbleInner = bubble.querySelector('.bubble-inner');
    if (bubbleInner) {
      bubbleInner.addEventListener('click', (e) => {
        if (e.target.closest('.bubble-quick-actions') || e.target.closest('.voice-play-btn') || e.target.closest('.msg-file-card')) return;
        document.querySelectorAll('.bubble-inner.show-actions').forEach(b => {
          if (b !== bubbleInner) b.classList.remove('show-actions');
        });
        bubbleInner.classList.toggle('show-actions');
      });
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

  // Typing Notification & Send/Mic Button Toggle
  messageTextInput.addEventListener('input', () => {
    updateSendMicButtonVisibility();
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

  function updateSendMicButtonVisibility() {
    const hasText = messageTextInput.value.trim().length > 0;
    if (hasText) {
      btnSendMessage.style.display = 'inline-flex';
      btnStartVoiceRecord.style.display = 'none';
    } else {
      btnSendMessage.style.display = 'none';
      btnStartVoiceRecord.style.display = 'inline-flex';
    }
  }

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
        updateSendMicButtonVisibility();
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
    updateSendMicButtonVisibility();
    closeReplyOrEditBanner();
    emojiPalette.style.display = 'none';
  }

  // --- VOICE RECORDING LOGIC (OPTIMIZED FOR MOBILE & DESKTOP) ---
  let mediaRecorder = null;
  let audioChunks = [];
  let recordTimerInterval = null;
  let recordSeconds = 0;
  let voiceRecordingStream = null;
  let chosenVoiceMime = '';

  function getBestVoiceMimeType() {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
      return '';
    }
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4;codecs=mp4a.40.2',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
      'audio/ogg'
    ];
    for (const c of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(c)) return c;
      } catch (e) {}
    }
    return '';
  }

  btnStartVoiceRecord.addEventListener('click', async (e) => {
    if (e) e.preventDefault();
    if (!currentRoom) {
      alert('Zəhmət olmasa əvvəlcə bir söhbət seçin.');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Bu cihaz və ya brauzerdə səs yazma dəstəklənmir.');
      return;
    }

    try {
      voiceRecordingStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (err1) {
      try {
        voiceRecordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err2) {
        alert('Mikrofon xətası: Zəhmət olmasa brauzer parametrlərindən mikrofona icazə verin (' + (err2.message || err1.message) + ')');
        return;
      }
    }

    audioChunks = [];
    chosenVoiceMime = getBestVoiceMimeType();

    try {
      mediaRecorder = chosenVoiceMime 
        ? new MediaRecorder(voiceRecordingStream, { mimeType: chosenVoiceMime })
        : new MediaRecorder(voiceRecordingStream);
    } catch (e1) {
      try {
        mediaRecorder = new MediaRecorder(voiceRecordingStream);
      } catch (e2) {
        alert('Səs yazma başladıla bilmədi: ' + e2.message);
        stopVoiceRecordingCleanup();
        return;
      }
    }

    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        audioChunks.push(ev.data);
      }
    };

    // UI state switch
    inputNormalMode.style.display = 'none';
    voiceRecordingBar.style.display = 'flex';
    recordSeconds = 0;
    voiceRecTimer.textContent = '0:00';

    clearInterval(recordTimerInterval);
    recordTimerInterval = setInterval(() => {
      recordSeconds++;
      const m = Math.floor(recordSeconds / 60);
      const s = Math.floor(recordSeconds % 60);
      voiceRecTimer.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    }, 1000);

    // Request data every 100ms so chunks are continuous
    try {
      mediaRecorder.start(100);
    } catch (e) {
      mediaRecorder.start();
    }
  });

  function stopVoiceRecordingCleanup() {
    clearInterval(recordTimerInterval);
    if (voiceRecordingStream) {
      voiceRecordingStream.getTracks().forEach((track) => track.stop());
      voiceRecordingStream = null;
    }
    inputNormalMode.style.display = 'flex';
    voiceRecordingBar.style.display = 'none';
    updateSendMicButtonVisibility();
  }

  btnCancelVoiceRecord.addEventListener('click', (e) => {
    if (e) e.preventDefault();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.onstop = null;
      try { mediaRecorder.stop(); } catch(err){}
    }
    stopVoiceRecordingCleanup();
  });

  btnSendVoiceRecord.addEventListener('click', async (e) => {
    if (e) e.preventDefault();
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

    const duration = Math.max(recordSeconds, 1);

    // Request in-flight audio data before stopping
    try {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.requestData();
      }
    } catch (err) {}

    mediaRecorder.onstop = async () => {
      stopVoiceRecordingCleanup();

      // Brief delay to allow final ondataavailable event to flush
      await new Promise((r) => setTimeout(r, 80));

      if (audioChunks.length === 0) {
        showToast('Səs yazısı boşdur');
        return;
      }

      const actualMime = mediaRecorder.mimeType || chosenVoiceMime || 'audio/webm';
      let ext = 'webm';
      if (actualMime.includes('mp4') || actualMime.includes('aac')) {
        ext = 'mp4';
      } else if (actualMime.includes('ogg')) {
        ext = 'ogg';
      }

      const audioBlob = new Blob(audioChunks, { type: actualMime });
      const audioFile = new File([audioBlob], `voice_${Date.now()}.${ext}`, { type: audioBlob.type || actualMime });

      const formData = new FormData();
      formData.append('file', audioFile);

      showToast('Səsli mesaj göndərilir...');
      try {
        const resp = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        const data = await resp.json();
        if (data.success && currentRoom) {
          socket.emit('send_message', {
            roomId: currentRoom.id,
            type: 'voice',
            fileUrl: data.fileUrl,
            fileName: 'Səsli mesaj',
            fileSize: data.fileSize,
            duration: duration,
            content: ''
          }, () => {
            MoonAudio.playSentSound();
          });
        } else {
          alert('Səsli mesaj göndərilmədi: ' + (data.error || 'Server xətası'));
        }
      } catch (err) {
        alert('Səsli mesaj yüklənmə xətası: ' + err.message);
      }
    };

    try {
      mediaRecorder.stop();
    } catch (err) {
      console.error('mediaRecorder stop error:', err);
    }
  });

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
    if (!e.target.closest('.chat-item-actions-btn') && !e.target.closest('.item-context-dropdown')) {
      document.querySelectorAll('.item-context-dropdown').forEach(d => d.remove());
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
      showToast('Söhbət arxivləşdirildi');
      fetchRooms();
      currentRoom = null;
      activeChatWrapper.style.display = 'none';
      emptyChatState.style.display = 'flex';
      if (window.innerWidth <= 768) {
        appLayout.classList.remove('chat-open');
      }
    });
  });

  optClearChat.addEventListener('click', () => {
    chatOptionsPopup.style.display = 'none';
    if (!currentRoom) return;
    if (confirm('Bu söhbətdəki bütün mesajları təmizləmək istəyirsiniz?')) {
      socket.emit('clear_chat', { roomId: currentRoom.id }, () => {
        messagesFlow.innerHTML = '';
        showToast('Mesajlar təmizləndi');
      });
    }
  });

  optDeleteChat.addEventListener('click', () => {
    chatOptionsPopup.style.display = 'none';
    if (!currentRoom) return;
    if (confirm('Bu söhbəti tamamilə silmək istəyirsiniz?')) {
      socket.emit('delete_room', { roomId: currentRoom.id }, () => {
        showToast('Söhbət silindi');
        fetchRooms();
        currentRoom = null;
        activeChatWrapper.style.display = 'none';
        emptyChatState.style.display = 'flex';
        if (window.innerWidth <= 768) {
          appLayout.classList.remove('chat-open');
        }
      });
    }
  });

  // Socket Event Listeners for Reliable Real-time Delivery
  socket.on('new_message', (msg) => {
    const isMuted = getStoredList('moonapp_muted_rooms').includes(msg.room_id);
    if (currentRoom && msg.room_id === currentRoom.id) {
      appendMessageBubble(msg);
      scrollToBottom();
      if (currentUser && msg.sender_id !== currentUser.id) {
        socket.emit('mark_read', { roomId: currentRoom.id });
        if (!isMuted) MoonAudio.playReceivedSound();
      }
    } else {
      // Received message in another room
      if (currentUser && msg.sender_id !== currentUser.id) {
        if (!isMuted) MoonAudio.playReceivedSound();
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

  socket.on('user_deleted', ({ userId }) => {
    if (currentUser && currentUser.id === userId) {
      alert('Hesabınız admin tərəfindən silindi.');
      localStorage.removeItem('moonapp_user');
      window.location.reload();
      return;
    }
    if (currentRoom && currentRoom.other_user_id === userId) {
      currentRoom = null;
      activeChatWrapper.style.display = 'none';
      emptyChatState.style.display = 'flex';
      if (window.innerWidth <= 768) {
        appLayout.classList.remove('chat-open');
      }
      showToast('Bu istifadəçi silindi');
    }
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

  socket.on('user_verified_updated', ({ userId, isVerified }) => {
    // Update current user if it's me
    if (currentUser && currentUser.id === userId) {
      currentUser.is_verified = isVerified;
      localStorage.setItem('moonapp_user', JSON.stringify(currentUser));
      myNicknameDisplay.innerHTML = `${escapeHtml(currentUser.nickname || currentUser.username)}${getVerifiedBadgeHtml(currentUser.is_verified)}`;
    }
    // Update rooms list
    rooms.forEach((r) => {
      if (r.other_user_id === userId) {
        r.other_user_verified = isVerified;
      }
    });
    renderChatList();
    if (currentRoom && currentRoom.other_user_id === userId) {
      currentRoom.other_user_verified = isVerified;
      updateChatHeader();
    }
  });

  socket.on('settings_updated', ({ app_title }) => {
    if (app_title) {
      document.title = app_title;
    }
  });

  socket.on('user_deleted', ({ userId }) => {
    if (currentUser && currentUser.id === userId) {
      alert('Hesabınız sistem administratoru tərəfindən silinmişdir.');
      localStorage.removeItem('moonapp_user');
      window.location.reload();
    } else {
      if (currentRoom && currentRoom.other_user_id === userId) {
        currentRoom = null;
        activeChatWrapper.style.display = 'none';
        emptyChatState.style.display = 'flex';
      }
      fetchRooms();
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
          <span class="u-name">${escapeHtml(u.nickname || u.username)}${getVerifiedBadgeHtml(u.is_verified)}</span>
          <span class="u-sub">@${escapeHtml(u.username)} • ${u.online ? '<span style="color:#00a884;">🟢 onlayn</span>' : 'oflayn'}</span>
        </div>
      `;
      renderAvatar(u.avatar, row.querySelector(`#u_avatar_${u.id}`));

      row.addEventListener('click', () => {
        newChatModal.style.display = 'none';
        if (window.innerWidth <= 768) {
          appLayout.classList.add('chat-open');
        }
        socket.emit('open_direct_chat', { targetUserId: u.id }, (res) => {
          if (res && res.success && res.room) {
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

  const btnCancelProfile = document.getElementById('btnCancelProfile');
  if (btnCancelProfile) {
    btnCancelProfile.addEventListener('click', () => {
      profileModal.style.display = 'none';
    });
  }

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
        myNicknameDisplay.innerHTML = `${escapeHtml(currentUser.nickname || currentUser.username)}${getVerifiedBadgeHtml(currentUser.is_verified)}`;
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
