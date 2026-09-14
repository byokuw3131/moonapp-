// MoonApp Frontend Logic - Azərbaycan Dili & Sürətli İstifadəçi Girişi
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // State
  let currentUser = null;
  let currentRoom = null;
  let rooms = [];
  let typingTimeout = null;
  let isTyping = false;
  let mediaRecorder = null;
  let audioChunks = [];
  let recordTimerInterval = null;
  let recordStartTime = null;

  // Selected avatar state (emoji or upload file URL)
  let currentSelectedAvatar = '🌙';
  let currentEditAvatar = '🌙';

  // DOM Elements
  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('usernameInput');
  const loginAvatarPreview = document.getElementById('loginAvatarPreview');
  const btnLoginUploadPic = document.getElementById('btnLoginUploadPic');
  const loginPicInput = document.getElementById('loginPicInput');
  const avatarChoices = document.querySelectorAll('#avatarChoices .avatar-choice');

  const myAvatarDisplay = document.getElementById('myAvatarDisplay');
  const myNicknameDisplay = document.getElementById('myNicknameDisplay');
  const myStatusText = document.getElementById('myStatusText');
  const currentUserBadge = document.getElementById('currentUserBadge');

  const sidebar = document.getElementById('sidebar');
  const chatList = document.getElementById('chatList');
  const chatSearchInput = document.getElementById('chatSearchInput');
  const filterTabs = document.querySelectorAll('.filter-tab');

  const emptyState = document.getElementById('emptyState');
  const activeChatWrapper = document.getElementById('activeChatWrapper');
  const targetChatAvatar = document.getElementById('targetChatAvatar');
  const targetChatOnlineDot = document.getElementById('targetChatOnlineDot');
  const targetChatTitle = document.getElementById('targetChatTitle');
  const targetChatSubtitle = document.getElementById('targetChatSubtitle');
  const messagesContainer = document.getElementById('messagesContainer');
  const btnMobileBack = document.getElementById('btnMobileBack');

  const messageInput = document.getElementById('messageInput');
  const btnSendMessage = document.getElementById('btnSendMessage');
  const btnToggleEmoji = document.getElementById('btnToggleEmoji');
  const btnToggleAttach = document.getElementById('btnToggleAttach');
  const emojiPicker = document.getElementById('emojiPicker');
  const emojiGrid = document.getElementById('emojiGrid');
  const attachmentMenu = document.getElementById('attachmentMenu');
  const attachImageBtn = document.getElementById('attachImageBtn');
  const attachFileBtn = document.getElementById('attachFileBtn');
  const fileUploadInput = document.getElementById('fileUploadInput');
  const imageUploadInput = document.getElementById('imageUploadInput');

  const btnRecordVoice = document.getElementById('btnRecordVoice');
  const recordingBar = document.getElementById('recordingBar');
  const recordingTimer = document.getElementById('recordingTimer');
  const btnCancelRecord = document.getElementById('btnCancelRecord');
  const btnFinishRecord = document.getElementById('btnFinishRecord');
  const textInputArea = document.getElementById('textInputArea');

  const newChatModal = document.getElementById('newChatModal');
  const btnOpenNewChat = document.getElementById('btnOpenNewChat');
  const btnStartPrompt = document.getElementById('btnStartPrompt');
  const btnCloseNewChatModal = document.getElementById('btnCloseNewChatModal');
  const usersListContainer = document.getElementById('usersListContainer');
  const filterUsersInput = document.getElementById('filterUsersInput');

  const profileModal = document.getElementById('profileModal');
  const btnCloseProfileModal = document.getElementById('btnCloseProfileModal');
  const editProfileForm = document.getElementById('editProfileForm');
  const editAvatarPreview = document.getElementById('editAvatarPreview');
  const btnEditUploadPic = document.getElementById('btnEditUploadPic');
  const editPicInput = document.getElementById('editPicInput');
  const editUsername = document.getElementById('editUsername');
  const editNickname = document.getElementById('editNickname');
  const editBio = document.getElementById('editBio');
  const editAvatarChoices = document.querySelectorAll('#editAvatarChoices .avatar-choice');

  const btnSwitchLounge = document.getElementById('btnSwitchLounge');
  const btnLogout = document.getElementById('btnLogout');

  const imageLightbox = document.getElementById('imageLightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const btnCloseLightbox = document.getElementById('btnCloseLightbox');

  // Helper to render avatar as HTML (image or emoji)
  function renderAvatarHtml(avatar) {
    if (!avatar) return '🌙';
    if (avatar.startsWith('/') || avatar.startsWith('http') || avatar.startsWith('data:')) {
      return `<img src="${avatar}" alt="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    }
    return escapeHtml(avatar);
  }

  // Populate Emoji Grid
  const emojiList = [
    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗',
    '😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟',
    '😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶',
    '😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧',
    '🌙','⭐','✨','🔥','⚡','🚀','❤️','💖','👍','👎','👏','🙌','🤝','🎉','💎','💯','🤖','👀'
  ];

  emojiList.forEach((em) => {
    const el = document.createElement('div');
    el.className = 'emoji-item';
    el.textContent = em;
    el.addEventListener('click', () => {
      insertAtCursor(messageInput, em);
      messageInput.focus();
    });
    emojiGrid.appendChild(el);
  });

  function insertAtCursor(myField, myValue) {
    if (document.selection) {
      myField.focus();
      const sel = document.selection.createRange();
      sel.text = myValue;
    } else if (myField.selectionStart || myField.selectionStart === 0) {
      const startPos = myField.selectionStart;
      const endPos = myField.selectionEnd;
      myField.value = myField.value.substring(0, startPos)
        + myValue
        + myField.value.substring(endPos, myField.value.length);
      myField.selectionStart = startPos + myValue.length;
      myField.selectionEnd = startPos + myValue.length;
    } else {
      myField.value += myValue;
    }
  }

  // Emoji avatar picker in login
  avatarChoices.forEach((ch) => {
    ch.addEventListener('click', () => {
      avatarChoices.forEach((c) => c.classList.remove('selected'));
      ch.classList.add('selected');
      currentSelectedAvatar = ch.dataset.avatar;
      loginAvatarPreview.innerHTML = renderAvatarHtml(currentSelectedAvatar);
    });
  });

  // Photo upload in login modal
  btnLoginUploadPic.addEventListener('click', () => loginPicInput.click());
  loginPicInput.addEventListener('change', async () => {
    if (loginPicInput.files && loginPicInput.files[0]) {
      const file = loginPicInput.files[0];
      const formData = new FormData();
      formData.append('file', file);
      try {
        btnLoginUploadPic.textContent = '⏳ Yüklənir...';
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
          currentSelectedAvatar = data.fileUrl;
          loginAvatarPreview.innerHTML = renderAvatarHtml(currentSelectedAvatar);
          avatarChoices.forEach((c) => c.classList.remove('selected'));
          btnLoginUploadPic.textContent = '✅ Şəkil Seçildi';
        } else {
          alert('Şəkil yüklənmədi: ' + data.error);
          btnLoginUploadPic.textContent = '📁 Cihazdan Şəkil Yüklə';
        }
      } catch (err) {
        alert('Xəta baş verdi: ' + err.message);
        btnLoginUploadPic.textContent = '📁 Cihazdan Şəkil Yüklə';
      }
    }
  });

  // Photo upload in edit profile modal
  btnEditUploadPic.addEventListener('click', () => editPicInput.click());
  editPicInput.addEventListener('change', async () => {
    if (editPicInput.files && editPicInput.files[0]) {
      const file = editPicInput.files[0];
      const formData = new FormData();
      formData.append('file', file);
      try {
        btnEditUploadPic.textContent = '⏳ Yüklənir...';
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
          currentEditAvatar = data.fileUrl;
          editAvatarPreview.innerHTML = renderAvatarHtml(currentEditAvatar);
          editAvatarChoices.forEach((c) => c.classList.remove('selected'));
          btnEditUploadPic.textContent = '✅ Şəkil Seçildi';
        }
      } catch (err) {
        alert('Xəta: ' + err.message);
        btnEditUploadPic.textContent = '📁 Yeni Şəkil Yüklə';
      }
    }
  });

  editAvatarChoices.forEach((ch) => {
    ch.addEventListener('click', () => {
      editAvatarChoices.forEach((c) => c.classList.remove('selected'));
      ch.classList.add('selected');
      currentEditAvatar = ch.dataset.avatar;
      editAvatarPreview.innerHTML = renderAvatarHtml(currentEditAvatar);
    });
  });

  // Check saved session
  const savedUserJson = localStorage.getItem('moonapp_user');
  if (savedUserJson) {
    try {
      const savedUser = JSON.parse(savedUserJson);
      doLogin(savedUser);
    } catch (e) {
      openLoginModal();
    }
  } else {
    openLoginModal();
  }

  function openLoginModal() {
    loginModal.classList.add('open');
  }

  // Simplified Login: Only username required!
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim().toLowerCase();
    if (!username) return;

    doLogin({
      username,
      nickname: username,
      avatar: currentSelectedAvatar || '🌙',
      bio: 'MoonApp istifadəçisi 🌙'
    });
  });

  function doLogin(userData) {
    MoonAudio.init();

    socket.emit('auth_login', userData, (res) => {
      if (res && res.error) {
        alert(res.error);
        openLoginModal();
        return;
      }
      currentUser = res.user;
      localStorage.setItem('moonapp_user', JSON.stringify(currentUser));
      loginModal.classList.remove('open');

      updateMyProfileUI();
      renderRooms(res.rooms || []);

      // Auto select first room (lounge or MoonBot)
      if (res.rooms && res.rooms.length > 0) {
        selectRoom(res.rooms[0]);
      }
    });
  }

  function updateMyProfileUI() {
    if (!currentUser) return;
    myAvatarDisplay.innerHTML = renderAvatarHtml(currentUser.avatar || '🌙');
    myNicknameDisplay.textContent = currentUser.nickname || currentUser.username;
    myStatusText.textContent = currentUser.bio || 'Onlayn';
  }

  // Edit profile
  currentUserBadge.addEventListener('click', () => {
    if (!currentUser) return;
    editUsername.value = currentUser.username;
    editNickname.value = currentUser.nickname;
    editBio.value = currentUser.bio || '';
    currentEditAvatar = currentUser.avatar || '🌙';
    editAvatarPreview.innerHTML = renderAvatarHtml(currentEditAvatar);
    editAvatarChoices.forEach((c) => {
      c.classList.toggle('selected', c.dataset.avatar === currentEditAvatar);
    });
    profileModal.classList.add('open');
  });

  btnCloseProfileModal.addEventListener('click', () => {
    profileModal.classList.remove('open');
  });

  editProfileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const updated = {
      nickname: editNickname.value.trim() || currentUser.username,
      avatar: currentEditAvatar || '🌙',
      bio: editBio.value.trim()
    };

    socket.emit('update_profile', updated, (res) => {
      if (res && res.success) {
        currentUser = res.user;
        localStorage.setItem('moonapp_user', JSON.stringify(currentUser));
        updateMyProfileUI();
        profileModal.classList.remove('open');
        // Refresh rooms
        socket.emit('get_rooms', null, (roomsRes) => {
          if (roomsRes && roomsRes.rooms) renderRooms(roomsRes.rooms);
        });
      } else {
        alert('Yeniləmə xətası: ' + (res?.error || 'Bilinməyən'));
      }
    });
  });

  // Logout
  btnLogout.addEventListener('click', () => {
    if (confirm('MoonApp hesabınızdan çıxmaq istəyirsiniz?')) {
      localStorage.removeItem('moonapp_user');
      window.location.reload();
    }
  });

  // Switch to Lounge
  btnSwitchLounge.addEventListener('click', () => {
    const lounge = rooms.find((r) => r.id === 'moon_lounge');
    if (lounge) {
      selectRoom(lounge);
    } else {
      socket.emit('get_rooms', null, (res) => {
        if (res && res.rooms) {
          rooms = res.rooms;
          renderRooms(rooms);
          const found = rooms.find((r) => r.id === 'moon_lounge');
          if (found) selectRoom(found);
        }
      });
    }
  });

  // Filter Tabs
  let currentFilter = 'all';
  filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      filterTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;

      const showHidden = currentFilter === 'hidden';
      socket.emit('get_rooms', { showHidden }, (res) => {
        if (res && res.rooms) {
          renderRooms(res.rooms);
        }
      });
    });
  });

  // Locked / Hidden Chats Banner in sidebar (Protected with 4-digit PIN)
  let isShowingLockedChats = false;
  const btnToggleLockedChats = document.getElementById('btnToggleLockedChats');
  const lockedChatsAction = document.getElementById('lockedChatsAction');

  const pinModal = document.getElementById('pinModal');
  const pinModalTitle = document.getElementById('pinModalTitle');
  const pinModalDesc = document.getElementById('pinModalDesc');
  const pinInput = document.getElementById('pinInput');
  const pinErrorMsg = document.getElementById('pinErrorMsg');
  const btnSubmitPin = document.getElementById('btnSubmitPin');
  const btnClosePinModal = document.getElementById('btnClosePinModal');

  if (btnClosePinModal) {
    btnClosePinModal.addEventListener('click', () => {
      pinModal.style.display = 'none';
      pinInput.value = '';
      pinErrorMsg.style.display = 'none';
    });
  }

  function openPinModal(onSuccess) {
    pinModal.style.display = 'flex';
    pinInput.value = '';
    pinErrorMsg.style.display = 'none';
    pinInput.focus();

    btnSubmitPin.onclick = () => {
      const pin = pinInput.value.trim();
      if (pin.length !== 4) {
        pinErrorMsg.textContent = '4 rəqəmli kod daxil edin!';
        pinErrorMsg.style.display = 'block';
        return;
      }

      socket.emit('verify_user_pin', { pinCode: pin }, (res) => {
        if (res && res.hasPin === false) {
          // No PIN set yet, set this as new PIN
          socket.emit('set_user_pin', { pinCode: pin }, () => {
            alert('Gizli söhbətlər üçün 4 rəqəmli PİN kodunuz təyin edildi: ' + pin);
            pinModal.style.display = 'none';
            onSuccess();
          });
        } else if (res && res.isValid) {
          pinModal.style.display = 'none';
          onSuccess();
        } else {
          pinErrorMsg.textContent = 'PİN kod yalnışdır!';
          pinErrorMsg.style.display = 'block';
        }
      });
    };
  }

  if (btnToggleLockedChats) {
    btnToggleLockedChats.addEventListener('click', () => {
      if (!isShowingLockedChats) {
        // Need PIN verification to unlock
        openPinModal(() => {
          isShowingLockedChats = true;
          btnToggleLockedChats.classList.add('active');
          if (lockedChatsAction) lockedChatsAction.textContent = 'Bağla ✕';
          filterTabs.forEach((t) => t.classList.remove('active'));

          socket.emit('get_rooms', { showHidden: true }, (res) => {
            if (res && res.rooms) renderRooms(res.rooms);
          });
        });
      } else {
        // Hide again
        isShowingLockedChats = false;
        btnToggleLockedChats.classList.remove('active');
        if (lockedChatsAction) lockedChatsAction.textContent = 'Göstər ›';
        filterTabs.forEach((t) => t.classList.remove('active'));

        socket.emit('get_rooms', { showHidden: false }, (res) => {
          if (res && res.rooms) renderRooms(res.rooms);
        });
      }
    });
  }

  chatSearchInput.addEventListener('input', applyRoomFilters);

  function applyRoomFilters() {
    const query = chatSearchInput.value.toLowerCase().trim();
    const filtered = rooms.filter((r) => {
      if (currentFilter === 'direct' && r.type !== 'direct') return false;
      if (currentFilter === 'group' && r.type !== 'group') return false;
      if (query && !r.display_name.toLowerCase().includes(query)) return false;
      return true;
    });
    renderRoomElements(filtered);
  }

  function renderRooms(newRooms) {
    rooms = newRooms;
    applyRoomFilters();
  }

  function renderRoomElements(roomsToRender) {
    chatList.innerHTML = '';
    if (roomsToRender.length === 0) {
      chatList.innerHTML = `
        <div style="padding: 24px 16px; text-align: center; color: var(--text-secondary); font-size: 13px;">
          ${currentFilter === 'hidden' ? 'Gizlədilmiş söhbət yoxdur.' : 'Söhbət tapılmadı.<br>Yuxarıdakı "+" düyməsinə klikləyərək yeni söhbət başlada bilərsiniz!'}
        </div>
      `;
      return;
    }

    roomsToRender.forEach((r) => {
      const item = document.createElement('div');
      item.className = 'chat-item' + (currentRoom && currentRoom.id === r.id ? ' active' : '');
      item.dataset.roomId = r.id;

      const isBot = r.id.includes('moonbot');
      const isOnline = isBot || (r.type === 'direct' && r.other_user_online === 1);

      let timeStr = '';
      if (r.last_message_time) {
        const d = new Date(r.last_message_time);
        timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      let previewText = 'Hələ mesaj yoxdur';
      if (r.last_message_type === 'image') {
        previewText = '📷 Şəkil';
      } else if (r.last_message_type === 'audio') {
        previewText = '🎤 Səsli Mesaj';
      } else if (r.last_message_type === 'file') {
        previewText = '📎 Fayl';
      } else if (r.last_message_content) {
        previewText = (r.last_message_sender ? r.last_message_sender + ': ' : '') + r.last_message_content;
      }

      const unreadBadge = r.unread_count > 0 ? `<div class="unread-badge">${r.unread_count}</div>` : '';
      const botTag = isBot ? `<span class="bot-tag">BOT</span>` : '';
      const actionBtn = currentFilter === 'hidden' 
        ? `<button class="unhide-btn" onclick="unhideChatRoom('${r.id}', event)">👁️‍🗨️ Çıxar</button>`
        : unreadBadge;

      item.innerHTML = `
        <div class="avatar-wrapper">
          <div class="avatar-img">${renderAvatarHtml(r.display_avatar)}</div>
          ${r.type === 'direct' ? `<div class="online-dot ${isOnline ? '' : 'offline'}"></div>` : ''}
        </div>
        <div class="chat-info">
          <div class="chat-info-top">
            <div class="chat-title">${escapeHtml(r.display_name)} ${botTag}</div>
            <div class="chat-time">${timeStr}</div>
          </div>
          <div class="chat-info-bottom">
            <div class="chat-last-msg">${escapeHtml(previewText)}</div>
            <div style="display: flex; align-items: center; gap: 4px;">
              ${actionBtn}
              <button class="chat-item-menu-btn" title="Seçimlər" onclick="openChatQuickMenu('${r.id}', '${r.other_user_id || ''}', event)">⋮</button>
            </div>
          </div>
        </div>
      `;

      item.addEventListener('click', () => selectRoom(r));
      chatList.appendChild(item);
    });
  }

  // Select Room
  function selectRoom(room) {
    currentRoom = room;
    document.querySelectorAll('.chat-item').forEach((it) => {
      it.classList.toggle('active', it.dataset.roomId === room.id);
    });

    room.unread_count = 0;
    applyRoomFilters();

    emptyState.classList.add('hidden');
    emptyState.style.display = 'none';
    activeChatWrapper.classList.add('active');
    activeChatWrapper.style.display = 'flex';
    sidebar.classList.add('hide-mobile');

    targetChatAvatar.innerHTML = renderAvatarHtml(room.display_avatar);
    
    const isBot = room.id.includes('moonbot');
    targetChatTitle.innerHTML = escapeHtml(room.display_name) + (isBot ? ' <span class="bot-tag">BOT</span>' : '');

    if (room.type === 'direct') {
      targetChatOnlineDot.style.display = 'block';
      const isOnline = isBot || (room.other_user_online === 1);
      targetChatOnlineDot.className = `online-dot ${isOnline ? '' : 'offline'}`;
      targetChatSubtitle.textContent = isOnline ? 'Onlayn' : 'Oflayn';
    } else {
      targetChatOnlineDot.style.display = 'none';
      targetChatSubtitle.textContent = 'Qrup Söhbəti • Hamıya Açıq';
    }

    messagesContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">Mesajlar yüklənir...</div>';

    socket.emit('join_room', { roomId: room.id }, (res) => {
      if (res && res.messages) {
        messagesContainer.innerHTML = '';
        res.messages.forEach((msg) => appendMessage(msg, false));
        scrollToBottom();
      }
    });

    messageInput.focus();
  }

  btnMobileBack.addEventListener('click', () => {
    sidebar.classList.remove('hide-mobile');
  });

  // Append Message
  function appendMessage(msg, shouldScroll = true) {
    const isMine = currentUser && msg.sender_id === currentUser.id;
    const row = document.createElement('div');
    row.className = `message-row ${isMine ? 'outgoing' : 'incoming'}`;
    row.dataset.msgId = msg.id;

    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let checkmarkHtml = '';
    if (isMine) {
      const isRead = msg.status === 'read';
      checkmarkHtml = `
        <span class="check-status ${isRead ? 'read' : ''}" title="${isRead ? 'Oxundu' : 'Çatdırıldı'}">
          ${isRead ? '✓✓' : '✓'}
        </span>
      `;
    }

    let bodyContent = '';

    // If message is a reply to another message
    if (msg.reply_to_text) {
      bodyContent += `
        <div class="message-reply-quote" onclick="scrollToMessage('${msg.reply_to_id}')">
          <div class="quote-sender">${escapeHtml(msg.reply_to_sender || 'İstifadəçi')}</div>
          <div class="quote-text">${escapeHtml(msg.reply_to_text)}</div>
        </div>
      `;
    }

    if (msg.type === 'location') {
      const parts = (msg.content || '').split(',');
      const lat = parts[0] || '0';
      const lon = parts[1] || '0';
      const mapUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
      bodyContent += `
        <div class="location-message-card">
          <div class="location-map-preview"></div>
          <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="location-btn-link">
            📍 Xəritədə Bax (${lat}, ${lon})
          </a>
        </div>
      `;
    } else if (msg.type === 'image' && msg.file_url) {
      bodyContent += `
        <div class="message-image-wrapper" onclick="openLightbox('${msg.file_url}')">
          <img src="${msg.file_url}" alt="Şəkil" loading="lazy">
        </div>
      `;
    } else if (msg.type === 'audio' && msg.file_url) {
      bodyContent += `
        <div class="audio-player">
          <button class="audio-play-btn" onclick="toggleAudio(this, '${msg.file_url}')">▶</button>
          <div class="audio-waveform-bar" onclick="seekAudio(event, this)">
            <div class="audio-progress"></div>
          </div>
          <span class="audio-time">0:00</span>
        </div>
      `;
    } else if (msg.type === 'file' && msg.file_url) {
      const sizeStr = msg.file_size ? `${(msg.file_size / 1024).toFixed(1)} KB` : '';
      bodyContent += `
        <a href="${msg.file_url}" download="${msg.file_name || 'fayl'}" class="file-attachment">
          <span class="file-attachment-icon">📁</span>
          <div class="file-attachment-info">
            <div class="file-attachment-name">${escapeHtml(msg.file_name || 'Fayl')}</div>
            <div class="file-attachment-size">${sizeStr}</div>
          </div>
        </a>
      `;
    }

    if (msg.content && msg.type !== 'location') {
      bodyContent += `<div class="message-text" id="msgText_${msg.id}">${formatMessageText(msg.content)}</div>`;
    }

    // Reactions HTML
    let reactionsHtml = renderReactionsHtml(msg.reactions || [], msg.id);

    const showSenderName = !isMine && currentRoom && currentRoom.type === 'group';
    const editedHtml = msg.is_edited ? `<span class="msg-edited-tag" id="msgEdited_${msg.id}">(redaktə edildi)</span>` : `<span class="msg-edited-tag" id="msgEdited_${msg.id}" style="display:none;">(redaktə edildi)</span>`;

    // Action bar (Reactions, Reply, Edit, Delete)
    const encodedContent = encodeURIComponent(msg.content || '');
    const encodedSender = encodeURIComponent(msg.sender_name || '');
    const editBtnHtml = isMine && msg.type === 'text' ? `
      <button class="msg-act-btn" title="Düzəliş et" onclick="startEditMessage('${msg.id}', '${encodedContent}', event)">✏️</button>
    ` : '';

    const actionsBarHtml = `
      <div class="msg-actions-hover-bar">
        <button class="msg-act-btn" title="Ürək" onclick="quickReact('${msg.id}', '❤️', event)">❤️</button>
        <button class="msg-act-btn" title="Bəyən" onclick="quickReact('${msg.id}', '👍', event)">👍</button>
        <button class="msg-act-btn" title="Gülüş" onclick="quickReact('${msg.id}', '😂', event)">😂</button>
        <button class="msg-act-btn" title="Təəccüb" onclick="quickReact('${msg.id}', '😮', event)">😮</button>
        <button class="msg-act-btn" title="Cavabla" onclick="startReplyMessage('${msg.id}', '${encodedSender}', '${encodedContent}', event)">↩️</button>
        ${editBtnHtml}
        <button class="msg-act-btn" title="Sil" onclick="deleteSingleMessage('${msg.id}', event)">🗑️</button>
      </div>
    `;

    row.innerHTML = `
      <div class="message-bubble">
        ${actionsBarHtml}
        <button class="msg-delete-btn" title="Mesajı Sil" onclick="deleteSingleMessage('${msg.id}', event)">✕</button>
        ${showSenderName ? `<div class="sender-name">${escapeHtml(msg.sender_name)}</div>` : ''}
        ${bodyContent}
        <div class="message-meta">
          <span>${time}</span>
          ${editedHtml}
          ${checkmarkHtml}
        </div>
        <div class="reactions-row" id="reactionsRow_${msg.id}">
          ${reactionsHtml}
        </div>
      </div>
    `;

    messagesContainer.appendChild(row);
    if (shouldScroll) scrollToBottom();
  }

  function renderReactionsHtml(reactions, messageId) {
    if (!reactions || reactions.length === 0) return '';
    const counts = {};
    const myReactions = new Set();

    reactions.forEach((r) => {
      counts[r.reaction] = (counts[r.reaction] || 0) + 1;
      if (currentUser && r.userId === currentUser.id) {
        myReactions.add(r.reaction);
      }
    });

    return Object.entries(counts).map(([em, cnt]) => {
      const isMine = myReactions.has(em);
      return `
        <div class="reaction-pill ${isMine ? 'mine' : ''}" onclick="quickReact('${messageId}', '${em}', event)">
          <span>${em}</span>
          <span class="reaction-count">${cnt > 1 ? cnt : ''}</span>
        </div>
      `;
    }).join('');
  }

  window.scrollToMessage = function(targetMsgId) {
    const el = document.querySelector(`.message-row[data-msg-id="${targetMsgId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'transform 0.3s, background 0.3s';
      el.style.transform = 'scale(1.03)';
      setTimeout(() => el.style.transform = 'none', 600);
    }
  };

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function formatMessageText(text) {
    let escaped = escapeHtml(text);
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return escaped.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-moon); text-decoration: underline;">${url}</a>`);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Send Message
  btnSendMessage.addEventListener('click', sendMessage);

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';

    if (!currentRoom) return;

    if (!isTyping) {
      isTyping = true;
      socket.emit('typing', { roomId: currentRoom.id });
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isTyping = false;
      socket.emit('stop_typing', { roomId: currentRoom.id });
    }, 1500);
  });

  // Reply and Edit states
  let currentReplyMsg = null;
  let currentEditingMsgId = null;

  const replyPreviewBar = document.getElementById('replyPreviewBar');
  const replyPreviewSender = document.getElementById('replyPreviewSender');
  const replyPreviewText = document.getElementById('replyPreviewText');
  const btnCloseReplyPreview = document.getElementById('btnCloseReplyPreview');

  const editPreviewBar = document.getElementById('editPreviewBar');
  const editPreviewText = document.getElementById('editPreviewText');
  const btnCloseEditPreview = document.getElementById('btnCloseEditPreview');

  if (btnCloseReplyPreview) {
    btnCloseReplyPreview.addEventListener('click', cancelReply);
  }
  if (btnCloseEditPreview) {
    btnCloseEditPreview.addEventListener('click', cancelEdit);
  }

  window.startReplyMessage = function(msgId, encodedSender, encodedContent, event) {
    if (event) event.stopPropagation();
    cancelEdit();
    const sender = decodeURIComponent(encodedSender);
    const content = decodeURIComponent(encodedContent);

    currentReplyMsg = { id: msgId, sender, content };
    replyPreviewSender.textContent = sender;
    replyPreviewText.textContent = content;
    replyPreviewBar.style.display = 'flex';
    messageInput.focus();
  };

  function cancelReply() {
    currentReplyMsg = null;
    replyPreviewBar.style.display = 'none';
  }

  window.startEditMessage = function(msgId, encodedContent, event) {
    if (event) event.stopPropagation();
    cancelReply();
    const content = decodeURIComponent(encodedContent);

    currentEditingMsgId = msgId;
    editPreviewText.textContent = content;
    editPreviewBar.style.display = 'flex';
    messageInput.value = content;
    messageInput.focus();
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
  };

  function cancelEdit() {
    currentEditingMsgId = null;
    editPreviewBar.style.display = 'none';
    messageInput.value = '';
    messageInput.style.height = 'auto';
  }

  // Quick Reaction toggle
  window.quickReact = function(messageId, reaction, event) {
    if (event) event.stopPropagation();
    if (!currentRoom) return;
    socket.emit('react_message', { messageId, roomId: currentRoom.id, reaction }, (res) => {
      if (res && res.error) alert(res.error);
    });
  };

  // Location Attachment Button
  const attachLocationBtn = document.getElementById('attachLocationBtn');
  if (attachLocationBtn) {
    attachLocationBtn.addEventListener('click', () => {
      attachmentMenu.classList.remove('open');
      if (!currentRoom) {
        alert('Zəhmət olmasa əvvəlcə bir söhbət seçin!');
        return;
      }

      if (!navigator.geolocation) {
        alert('Cihazınızda və ya brauzerinizdə geolokasiya dəstəklənmir.');
        return;
      }

      attachLocationBtn.innerHTML = '<span class="icon">⏳</span><span>Məkan təyin edilir...</span>';

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          attachLocationBtn.innerHTML = '<span class="icon">📍</span><span>Cari Məkanı Paylaş</span>';
          const lat = pos.coords.latitude.toFixed(6);
          const lon = pos.coords.longitude.toFixed(6);

          const payload = {
            roomId: currentRoom.id,
            content: `${lat},${lon}`,
            type: 'location'
          };

          socket.emit('send_message', payload, (res) => {
            if (res && res.error) alert(res.error);
            else MoonAudio.playSentSound();
          });
        },
        (err) => {
          attachLocationBtn.innerHTML = '<span class="icon">📍</span><span>Cari Məkanı Paylaş</span>';
          alert('Məkan icazəsi alınmadı: ' + err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  // Send Message (handles normal text, reply, and editing)
  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    if (!currentRoom) {
      alert('Zəhmət olmasa əvvəlcə sol siyahıdan bir söhbət seçin!');
      return;
    }

    // IF EDITING EXISTING MESSAGE
    if (currentEditingMsgId) {
      const editId = currentEditingMsgId;
      socket.emit('edit_message', { messageId: editId, roomId: currentRoom.id, newContent: text }, (res) => {
        if (res && res.error) {
          alert(res.error);
          return;
        }
      });
      cancelEdit();
      return;
    }

    // NORMAL SEND OR REPLY SEND
    const payload = {
      roomId: currentRoom.id,
      content: text,
      type: 'text'
    };

    if (currentReplyMsg) {
      payload.replyToId = currentReplyMsg.id;
      payload.replyToSender = currentReplyMsg.sender;
      payload.replyToText = currentReplyMsg.content;
      cancelReply();
    }

    messageInput.value = '';
    messageInput.style.height = 'auto';

    socket.emit('send_message', payload, (res) => {
      if (res && res.error) {
        alert(res.error);
        return;
      }
      MoonAudio.playSentSound();
    });

    if (isTyping) {
      isTyping = false;
      clearTimeout(typingTimeout);
      socket.emit('stop_typing', { roomId: currentRoom.id });
    }
  }

  // Socket Events
  socket.on('new_message', (msg) => {
    if (currentRoom && msg.room_id === currentRoom.id) {
      appendMessage(msg, true);
      if (currentUser && msg.sender_id !== currentUser.id) {
        MoonAudio.playReceivedSound();
        socket.emit('mark_read', { roomId: currentRoom.id });
      }
    } else {
      MoonAudio.playReceivedSound();
      const r = rooms.find((x) => x.id === msg.room_id);
      if (r) {
        r.unread_count = (r.unread_count || 0) + 1;
        applyRoomFilters();
      } else {
        socket.emit('get_rooms', null, (res) => {
          if (res && res.rooms) renderRooms(res.rooms);
        });
      }
    }
  });

  socket.on('update_room_preview', ({ roomId, lastMessage }) => {
    const targetRoom = rooms.find((r) => r.id === roomId);
    if (targetRoom) {
      targetRoom.last_message_content = lastMessage.content;
      targetRoom.last_message_type = lastMessage.type;
      targetRoom.last_message_time = lastMessage.timestamp;
      targetRoom.last_message_sender = lastMessage.sender_name;
      rooms.sort((a, b) => (b.last_message_time || 0) - (a.last_message_time || 0));
      applyRoomFilters();
    }
  });

  socket.on('user_typing', ({ roomId, nickname }) => {
    if (currentRoom && currentRoom.id === roomId) {
      targetChatSubtitle.textContent = `${nickname} yazır...`;
      targetChatSubtitle.classList.add('typing');
    }
  });

  socket.on('user_stop_typing', ({ roomId }) => {
    if (currentRoom && currentRoom.id === roomId) {
      targetChatSubtitle.classList.remove('typing');
      if (currentRoom.type === 'direct') {
        const isBot = currentRoom.id.includes('moonbot');
        const isOnline = isBot || currentRoom.other_user_online === 1;
        targetChatSubtitle.textContent = isOnline ? 'Onlayn' : 'Oflayn';
      } else {
        targetChatSubtitle.textContent = 'Qrup Söhbəti • Hamıya Açıq';
      }
    }
  });

  socket.on('messages_read_receipt', ({ roomId }) => {
    if (currentRoom && currentRoom.id === roomId) {
      document.querySelectorAll('.check-status').forEach((el) => {
        el.className = 'check-status read';
        el.textContent = '✓✓';
      });
    }
  });

  socket.on('user_presence', ({ userId, online }) => {
    rooms.forEach((r) => {
      if (r.type === 'direct' && r.other_user_id === userId) {
        r.other_user_online = online;
      }
    });
    applyRoomFilters();

    if (currentRoom && currentRoom.type === 'direct' && currentRoom.other_user_id === userId) {
      currentRoom.other_user_online = online;
      targetChatOnlineDot.className = `online-dot ${online ? '' : 'offline'}`;
      targetChatSubtitle.textContent = online ? 'Onlayn' : 'Oflayn';
    }
  });

  socket.on('message_edited', ({ messageId, roomId, newContent }) => {
    const textEl = document.getElementById(`msgText_${messageId}`);
    if (textEl) {
      textEl.innerHTML = formatMessageText(newContent);
    }
    const editTag = document.getElementById(`msgEdited_${messageId}`);
    if (editTag) {
      editTag.style.display = 'inline';
    }
  });

  socket.on('message_reaction_updated', ({ messageId, roomId, reactions }) => {
    const reactionsRow = document.getElementById(`reactionsRow_${messageId}`);
    if (reactionsRow) {
      reactionsRow.innerHTML = renderReactionsHtml(reactions, messageId);
    }
  });

  socket.on('message_deleted', ({ messageId }) => {
    const row = document.querySelector(`.message-row[data-msg-id="${messageId}"]`);
    if (row) {
      row.style.transition = 'opacity 0.2s, transform 0.2s';
      row.style.opacity = '0';
      row.style.transform = 'scale(0.9)';
      setTimeout(() => row.remove(), 200);
    }
  });

  socket.on('chat_cleared', ({ roomId }) => {
    if (currentRoom && currentRoom.id === roomId) {
      messagesContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">Söhbət təmizləndi.</div>';
    }
  });

  // Global Delete Message handler
  window.deleteSingleMessage = function(messageId, event) {
    if (event) event.stopPropagation();
    if (!confirm('Bu mesajı silmək istəyirsiniz?')) return;
    if (!currentRoom) return;

    socket.emit('delete_message', { messageId, roomId: currentRoom.id }, (res) => {
      if (res && res.error) alert('Silinmə xətası: ' + res.error);
    });
  };

  // Global Unhide Chat handler
  window.unhideChatRoom = function(roomId, event) {
    if (event) event.stopPropagation();
    socket.emit('unhide_chat', { roomId }, (res) => {
      socket.emit('get_rooms', { showHidden: true }, (roomsRes) => {
        if (roomsRes && roomsRes.rooms) renderRooms(roomsRes.rooms);
      });
    });
  };

  // Chat Options Dropdown Menu (Gizlə / Təmizlə / Sil)
  const btnChatMenu = document.getElementById('btnChatMenu');
  const chatOptionsMenu = document.getElementById('chatOptionsMenu');
  const btnMenuHideChat = document.getElementById('btnMenuHideChat');
  const btnMenuClearChat = document.getElementById('btnMenuClearChat');
  const btnMenuDeleteChat = document.getElementById('btnMenuDeleteChat');

  if (btnChatMenu && chatOptionsMenu) {
    btnChatMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      chatOptionsMenu.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      chatOptionsMenu.classList.remove('open');
    });

    chatOptionsMenu.addEventListener('click', (e) => e.stopPropagation());
  }

  if (btnMenuHideChat) {
    btnMenuHideChat.addEventListener('click', () => {
      if (!currentRoom) return;
      if (chatOptionsMenu) chatOptionsMenu.classList.remove('open');
      if (confirm('Bu söhbəti gizlətmək istəyirsiniz? Yuxarıdakı "Gizli" bölməsindən istədiyiniz vaxt yenidən aça bilərsiniz.')) {
        socket.emit('hide_chat', { roomId: currentRoom.id }, () => {
          socket.emit('get_rooms', { showHidden: false }, (roomsRes) => {
            if (roomsRes && roomsRes.rooms) renderRooms(roomsRes.rooms);
            emptyState.classList.remove('hidden');
            emptyState.style.display = 'flex';
            activeChatWrapper.classList.remove('active');
            activeChatWrapper.style.display = 'none';
            currentRoom = null;
            sidebar.classList.remove('hide-mobile');
          });
        });
      }
    });
  }

  if (btnMenuClearChat) {
    btnMenuClearChat.addEventListener('click', () => {
      if (!currentRoom) return;
      if (chatOptionsMenu) chatOptionsMenu.classList.remove('open');
      if (confirm('Bu söhbətdəki bütün mesajları təmizləmək istəyirsiniz?')) {
        socket.emit('clear_chat', { roomId: currentRoom.id }, () => {
          messagesContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">Bütün mesajlar təmizləndi.</div>';
        });
      }
    });
  }

  if (btnMenuDeleteChat) {
    btnMenuDeleteChat.addEventListener('click', () => {
      if (!currentRoom) return;
      if (chatOptionsMenu) chatOptionsMenu.classList.remove('open');
      if (confirm('Bu söhbəti silmək istəyirsiniz?')) {
        socket.emit('delete_chat', { roomId: currentRoom.id }, () => {
          socket.emit('get_rooms', { showHidden: false }, (roomsRes) => {
            if (roomsRes && roomsRes.rooms) renderRooms(roomsRes.rooms);
            emptyState.classList.remove('hidden');
            emptyState.style.display = 'flex';
            activeChatWrapper.classList.remove('active');
            activeChatWrapper.style.display = 'none';
            currentRoom = null;
            sidebar.classList.remove('hide-mobile');
          });
        });
      }
    });
  }

  // Popover controls
  btnToggleEmoji.addEventListener('click', (e) => {
    e.stopPropagation();
    attachmentMenu.classList.remove('open');
    emojiPicker.classList.toggle('open');
  });

  btnToggleAttach.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.remove('open');
    attachmentMenu.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    emojiPicker.classList.remove('open');
    attachmentMenu.classList.remove('open');
  });

  emojiPicker.addEventListener('click', (e) => e.stopPropagation());
  attachmentMenu.addEventListener('click', (e) => e.stopPropagation());

  // Attachments
  attachImageBtn.addEventListener('click', () => {
    attachmentMenu.classList.remove('open');
    imageUploadInput.click();
  });

  attachFileBtn.addEventListener('click', () => {
    attachmentMenu.classList.remove('open');
    fileUploadInput.click();
  });

  imageUploadInput.addEventListener('change', () => {
    if (imageUploadInput.files && imageUploadInput.files[0]) {
      handleFileUpload(imageUploadInput.files[0], 'image');
      imageUploadInput.value = '';
    }
  });

  fileUploadInput.addEventListener('change', () => {
    if (fileUploadInput.files && fileUploadInput.files[0]) {
      handleFileUpload(fileUploadInput.files[0], 'file');
      fileUploadInput.value = '';
    }
  });

  async function handleFileUpload(file, type) {
    if (!currentRoom) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        socket.emit('send_message', {
          roomId: currentRoom.id,
          content: '',
          type: type,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileSize: data.fileSize
        });
        MoonAudio.playSentSound();
      } else {
        alert('Yükləmə xətası: ' + data.error);
      }
    } catch (err) {
      alert('Yükləmə xətası: ' + err.message);
    }
  }

  // Voice Note Recording
  btnRecordVoice.addEventListener('click', startRecording);
  btnCancelRecord.addEventListener('click', cancelRecording);
  btnFinishRecord.addEventListener('click', finishRecording);

  async function startRecording() {
    if (!currentRoom) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.start();
      recordStartTime = Date.now();

      textInputArea.style.display = 'none';
      btnRecordVoice.style.display = 'none';
      btnSendMessage.style.display = 'none';
      recordingBar.classList.add('active');

      recordTimerInterval = setInterval(() => {
        const diff = Math.floor((Date.now() - recordStartTime) / 1000);
        const mins = String(Math.floor(diff / 60)).padStart(2, '0');
        const secs = String(diff % 60).padStart(2, '0');
        recordingTimer.textContent = `${mins}:${secs}`;
      }, 500);
    } catch (err) {
      alert('Mikrofona icazə verilmədi: ' + err.message);
    }
  }

  function stopRecordingUI() {
    clearInterval(recordTimerInterval);
    recordingBar.classList.remove('active');
    textInputArea.style.display = 'flex';
    btnRecordVoice.style.display = 'flex';
    btnSendMessage.style.display = 'flex';
    recordingTimer.textContent = '00:00';
  }

  function cancelRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    }
    stopRecordingUI();
    audioChunks = [];
  }

  function finishRecording() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      stopRecordingUI();

      if (audioBlob.size < 1000) return;

      const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.success && currentRoom) {
          socket.emit('send_message', {
            roomId: currentRoom.id,
            type: 'audio',
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileSize: data.fileSize
          });
          MoonAudio.playSentSound();
        }
      } catch (err) {
        console.error('Audio upload error:', err);
      }
    };

    mediaRecorder.stop();
  }

  // Audio Playback
  window.toggleAudio = function (btn, url) {
    let audio = btn._audio;
    const waveform = btn.parentElement.querySelector('.audio-progress');
    const timeDisplay = btn.parentElement.querySelector('.audio-time');

    if (!audio) {
      audio = new Audio(url);
      btn._audio = audio;

      audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
          const pct = (audio.currentTime / audio.duration) * 100;
          waveform.style.width = pct + '%';
          const mins = Math.floor(audio.currentTime / 60);
          const secs = String(Math.floor(audio.currentTime % 60)).padStart(2, '0');
          timeDisplay.textContent = `${mins}:${secs}`;
        }
      });

      audio.addEventListener('ended', () => {
        btn.textContent = '▶';
        waveform.style.width = '0%';
        timeDisplay.textContent = '0:00';
      });
    }

    if (audio.paused) {
      audio.play();
      btn.textContent = '⏸';
    } else {
      audio.pause();
      btn.textContent = '▶';
    }
  };

  window.seekAudio = function (event, waveformEl) {
    const btn = waveformEl.parentElement.querySelector('.audio-play-btn');
    if (!btn || !btn._audio || !btn._audio.duration) return;
    const rect = waveformEl.getBoundingClientRect();
    const clickPos = (event.clientX - rect.left) / rect.width;
    btn._audio.currentTime = clickPos * btn._audio.duration;
  };

  // Lightbox
  window.openLightbox = function (url) {
    lightboxImg.src = url;
    imageLightbox.classList.add('open');
  };
  btnCloseLightbox.addEventListener('click', () => {
    imageLightbox.classList.remove('open');
    lightboxImg.src = '';
  });
  imageLightbox.addEventListener('click', (e) => {
    if (e.target === imageLightbox) {
      imageLightbox.classList.remove('open');
      lightboxImg.src = '';
    }
  });

  // New Chat Modal / Users List with MoonBot
  btnOpenNewChat.addEventListener('click', openNewChat);
  btnStartPrompt.addEventListener('click', openNewChat);

  function openNewChat() {
    newChatModal.classList.add('open');
    filterUsersInput.value = '';
    loadUsersList();
  }

  btnCloseNewChatModal.addEventListener('click', () => {
    newChatModal.classList.remove('open');
  });

  filterUsersInput.addEventListener('input', () => {
    const q = filterUsersInput.value.toLowerCase().trim();
    document.querySelectorAll('.modal-user-item').forEach((it) => {
      const name = it.dataset.name.toLowerCase();
      it.style.display = name.includes(q) ? 'flex' : 'none';
    });
  });

  let usersModalShowHidden = false;
  const tabUsersAll = document.getElementById('tabUsersAll');
  const tabUsersHidden = document.getElementById('tabUsersHidden');

  if (tabUsersAll && tabUsersHidden) {
    tabUsersAll.addEventListener('click', () => {
      tabUsersAll.classList.add('active');
      tabUsersHidden.classList.remove('active');
      usersModalShowHidden = false;
      loadUsersList();
    });
    tabUsersHidden.addEventListener('click', () => {
      tabUsersHidden.classList.add('active');
      tabUsersAll.classList.remove('active');
      usersModalShowHidden = true;
      loadUsersList();
    });
  }

  function loadUsersList() {
    usersListContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">İstifadəçilər axtarılır...</p>';

    socket.emit('get_users', { showHidden: usersModalShowHidden }, (res) => {
      const users = (res && res.users) || [];
      if (users.length === 0) {
        usersListContainer.innerHTML = `<p style="text-align: center; color: var(--text-secondary); padding: 20px;">${usersModalShowHidden ? 'Gizlədilmiş istifadəçi yoxdur.' : 'Hələ başqa istifadəçi yoxdur.<br>MoonBot ilə dərhal test söhbəti apara bilərsiniz!'}</p>`;
        return;
      }

      usersListContainer.innerHTML = '';
      users.forEach((u) => {
        const item = document.createElement('div');
        item.className = 'modal-user-item';
        item.dataset.name = `${u.nickname} ${u.username}`;

        const isBot = u.id === 'moonbot';
        const botTag = isBot ? '<span class="bot-tag">BOT</span>' : '';
        const onlineStatusText = isBot || u.online === 1 ? 'Onlayn' : 'Oflayn';

        let buttonsHtml = '';
        if (usersModalShowHidden) {
          buttonsHtml = `<button class="unhide-btn" onclick="unhideUserAction('${u.id}', event)">👁️‍🗨️ Göstər</button>`;
        } else {
          buttonsHtml = `
            <button class="chat-now-btn">Söhbətə Başla</button>
            ${!isBot ? `<button class="hide-user-btn" onclick="hideUserAction('${u.id}', event)" title="İstifadəçini Gizlə">🚫 Gizlə</button>` : ''}
          `;
        }

        item.innerHTML = `
          <div class="modal-user-left">
            <div class="avatar-wrapper">
              <div class="avatar-img">${renderAvatarHtml(u.avatar)}</div>
              <div class="online-dot ${isBot || u.online === 1 ? '' : 'offline'}"></div>
            </div>
            <div>
              <div style="font-weight: 600; font-size: 14px;">${escapeHtml(u.nickname)} ${botTag}</div>
              <div style="font-size: 12px; color: var(--text-secondary);">@${escapeHtml(u.username)} • ${onlineStatusText}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center;">
            ${buttonsHtml}
          </div>
        `;

        const startBtn = item.querySelector('.chat-now-btn');
        if (startBtn) {
          startBtn.addEventListener('click', () => {
            socket.emit('open_direct_chat', { targetUserId: u.id }, (resp) => {
              if (resp && resp.room) {
                newChatModal.classList.remove('open');
                socket.emit('get_rooms', null, (roomsResp) => {
                  if (roomsResp && roomsResp.rooms) {
                    renderRooms(roomsResp.rooms);
                    const selected = roomsResp.rooms.find((r) => r.id === resp.room.id);
                    if (selected) selectRoom(selected);
                  }
                });
              }
            });
          });
        }

        usersListContainer.appendChild(item);
      });
    });
  }

  // Global Hide User handler
  window.hideUserAction = function(targetUserId, event) {
    if (event) event.stopPropagation();
    if (!confirm('Bu istifadəçini və onunla olan söhbəti gizlətmək istəyirsiniz?')) return;
    socket.emit('hide_user', { targetUserId }, () => {
      loadUsersList();
      socket.emit('get_rooms', { showHidden: isShowingLockedChats }, (roomsRes) => {
        if (roomsRes && roomsRes.rooms) renderRooms(roomsRes.rooms);
      });
    });
  };

  // Global Unhide User handler
  window.unhideUserAction = function(targetUserId, event) {
    if (event) event.stopPropagation();
    socket.emit('unhide_user', { targetUserId }, () => {
      loadUsersList();
      socket.emit('get_rooms', { showHidden: isShowingLockedChats }, (roomsRes) => {
        if (roomsRes && roomsRes.rooms) renderRooms(roomsRes.rooms);
      });
    });
  };

  // Global Quick Chat Context Menu in Sidebar
  window.openChatQuickMenu = function(roomId, otherUserId, event) {
    if (event) event.stopPropagation();

    const action = prompt(`Söhbət İdarəetmə Menyusu:
1 - Söhbəti Gizlə (Arxivlə)
2 - İstifadəçini Gizlə
3 - Mesajları Təmizlə
4 - Söhbəti Sil

Nömrəni daxil edin (1, 2, 3 və ya 4):`);

    if (action === '1') {
      socket.emit('hide_chat', { roomId }, () => {
        socket.emit('get_rooms', { showHidden: isShowingLockedChats }, (res) => {
          if (res && res.rooms) renderRooms(res.rooms);
          if (currentRoom && currentRoom.id === roomId) {
            emptyState.classList.remove('hidden');
            emptyState.style.display = 'flex';
            activeChatWrapper.classList.remove('active');
            activeChatWrapper.style.display = 'none';
            currentRoom = null;
          }
        });
      });
    } else if (action === '2' && otherUserId) {
      socket.emit('hide_user', { targetUserId: otherUserId }, () => {
        socket.emit('get_rooms', { showHidden: isShowingLockedChats }, (res) => {
          if (res && res.rooms) renderRooms(res.rooms);
          if (currentRoom && currentRoom.id === roomId) {
            emptyState.classList.remove('hidden');
            emptyState.style.display = 'flex';
            activeChatWrapper.classList.remove('active');
            activeChatWrapper.style.display = 'none';
            currentRoom = null;
          }
        });
      });
    } else if (action === '3') {
      if (confirm('Bu söhbətdəki bütün mesajları təmizləmək istəyirsiniz?')) {
        socket.emit('clear_chat', { roomId }, () => {
          if (currentRoom && currentRoom.id === roomId) messagesContainer.innerHTML = '';
        });
      }
    } else if (action === '4') {
      if (confirm('Bu söhbəti tamamilə silmək istəyirsiniz?')) {
        socket.emit('delete_chat', { roomId }, () => {
          socket.emit('get_rooms', { showHidden: isShowingLockedChats }, (res) => {
            if (res && res.rooms) renderRooms(res.rooms);
            if (currentRoom && currentRoom.id === roomId) {
              emptyState.classList.remove('hidden');
              emptyState.style.display = 'flex';
              activeChatWrapper.classList.remove('active');
              activeChatWrapper.style.display = 'none';
              currentRoom = null;
            }
          });
        });
      }
    }
  };

  // ==========================================================
  // SƏSLİ VƏ GÖRÜNTÜLÜ ZƏNG FUNKSİYASI (WebRTC VOICE & VIDEO)
  // ==========================================================
  const btnHeaderCall = document.getElementById('btnHeaderCall');
  const btnHeaderVideoCall = document.getElementById('btnHeaderVideoCall');
  const incomingCallModal = document.getElementById('incomingCallModal');
  const incomingCallerName = document.getElementById('incomingCallerName');
  const incomingCallAvatar = document.getElementById('incomingCallAvatar');
  const incomingCallSubtitle = document.getElementById('incomingCallSubtitle');
  const btnAcceptCall = document.getElementById('btnAcceptCall');
  const btnRejectCall = document.getElementById('btnRejectCall');

  const activeCallScreenModal = document.getElementById('activeCallScreenModal');
  const activeCallAvatar = document.getElementById('activeCallAvatar');
  const activeCallName = document.getElementById('activeCallName');
  const activeCallStatus = document.getElementById('activeCallStatus');
  const callDurationTimer = document.getElementById('callDurationTimer');
  const btnCallMute = document.getElementById('btnCallMute');
  const btnCallCamera = document.getElementById('btnCallCamera');
  const btnCallEnd = document.getElementById('btnCallEnd');
  const iconMicOn = document.getElementById('iconMicOn');
  const iconMicOff = document.getElementById('iconMicOff');
  const remoteAudio = document.getElementById('remoteAudio');

  const callVideoContainer = document.getElementById('callVideoContainer');
  const callAudioAvatarWrapper = document.getElementById('callAudioAvatarWrapper');
  const remoteVideo = document.getElementById('remoteVideo');
  const localVideo = document.getElementById('localVideo');

  let localStream = null;
  let peerConnection = null;
  let activeCallPartnerId = null;
  let activeCallRoomId = null;
  let activeCallType = 'audio'; // 'audio' or 'video'
  let isCallActive = false;
  let callTimerInterval = null;
  let callSeconds = 0;
  let isMicMuted = false;
  let isCameraOff = false;
  let botSpeechSynthUtterance = null;

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  function updateCallTimerDisplay() {
    callSeconds++;
    const mins = Math.floor(callSeconds / 60).toString().padStart(2, '0');
    const secs = (callSeconds % 60).toString().padStart(2, '0');
    callDurationTimer.textContent = `${mins}:${secs}`;
  }

  function startCallTimer() {
    callSeconds = 0;
    callDurationTimer.textContent = '00:00';
    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval = setInterval(updateCallTimerDisplay, 1000);
  }

  function stopCallTimer() {
    if (callTimerInterval) {
      clearInterval(callTimerInterval);
      callTimerInterval = null;
    }
  }

  // Səsli Zəng Düyməsi
  if (btnHeaderCall) {
    btnHeaderCall.addEventListener('click', () => {
      startOutboundCall('audio');
    });
  }

  // Görüntülü Zəng Düyməsi
  if (btnHeaderVideoCall) {
    btnHeaderVideoCall.addEventListener('click', () => {
      startOutboundCall('video');
    });
  }

  function startOutboundCall(type) {
    if (!currentRoom) {
      alert('Zəhmət olmasa əvvəlcə zəng etmək istədiyiniz söhbəti seçin.');
      return;
    }

    let targetUserId = null;
    let targetName = 'İstifadəçi';
    let targetAvatar = '🌙';

    if (currentRoom.type === 'direct') {
      targetUserId = currentRoom.other_user_id;
      targetName = currentRoom.other_user_name || 'İstifadəçi';
      targetAvatar = currentRoom.other_user_avatar || '🌙';
    } else {
      alert('Zəng hazırda şəxsi (1-ə 1) söhbətlərdə və MoonBot ilə dəstəklənir.');
      return;
    }

    if (!targetUserId) {
      alert('Zəng ediləcək istifadəçi tapılmadı.');
      return;
    }

    initiateCall(targetUserId, targetName, targetAvatar, currentRoom.id, type);
  }

  async function initiateCall(targetUserId, targetName, targetAvatar, roomId, type = 'audio') {
    activeCallType = type;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });
      if (type === 'video' && localVideo) {
        localVideo.srcObject = localStream;
      }
    } catch (err) {
      console.warn('Media icazəsi xətası:', err);
      alert((type === 'video' ? 'Kamera və mikrofona' : 'Mikrofona') + ' icazə verilməlidir: ' + err.message);
      return;
    }

    activeCallPartnerId = targetUserId;
    activeCallRoomId = roomId;

    // Aktiv zəng ekranını tənzimlə
    activeCallAvatar.innerHTML = renderAvatarHtml(targetAvatar);
    activeCallName.textContent = targetName;
    activeCallStatus.textContent = type === 'video' ? 'Görüntülü zəng edilir...' : 'Səsli zəng edilir...';
    callDurationTimer.textContent = '00:00';

    if (type === 'video') {
      callVideoContainer.style.display = 'block';
      callAudioAvatarWrapper.style.display = 'none';
      btnCallCamera.style.display = 'flex';
    } else {
      callVideoContainer.style.display = 'none';
      callAudioAvatarWrapper.style.display = 'flex';
      btnCallCamera.style.display = 'none';
    }

    activeCallScreenModal.style.display = 'flex';
    MoonAudio.startOutgoingRing();

    socket.emit('call_user', { targetUserId, roomId, callType: type }, (res) => {
      if (res && res.error) {
        alert(res.error);
        endCallCleanUp();
      }
    });
  }

  // Gələn zəng (Incoming Call)
  socket.on('incoming_call', ({ callerId, callerName, callerAvatar, roomId, callType = 'audio' }) => {
    if (isCallActive) {
      socket.emit('reject_call', { callerId });
      return;
    }

    activeCallPartnerId = callerId;
    activeCallRoomId = roomId;
    activeCallType = callType;

    incomingCallerName.textContent = callerName;
    incomingCallAvatar.innerHTML = renderAvatarHtml(callerAvatar);
    incomingCallSubtitle.textContent = callType === 'video' ? 'Görüntülü zəng edir...' : 'Səsli zəng edir...';
    incomingCallModal.style.display = 'flex';

    MoonAudio.startIncomingRing();
  });

  // Zəngi qəbul et
  btnAcceptCall.addEventListener('click', async () => {
    MoonAudio.stopRinging();
    incomingCallModal.style.display = 'none';

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: activeCallType === 'video'
      });
      if (activeCallType === 'video' && localVideo) {
        localVideo.srcObject = localStream;
      }
    } catch (err) {
      alert('Media icazəsi alınmadı: ' + err.message);
      socket.emit('reject_call', { callerId: activeCallPartnerId });
      endCallCleanUp();
      return;
    }

    activeCallAvatar.innerHTML = incomingCallAvatar.innerHTML;
    activeCallName.textContent = incomingCallerName.textContent;
    activeCallStatus.textContent = 'Bağlantı qurulur...';

    if (activeCallType === 'video') {
      callVideoContainer.style.display = 'block';
      callAudioAvatarWrapper.style.display = 'none';
      btnCallCamera.style.display = 'flex';
    } else {
      callVideoContainer.style.display = 'none';
      callAudioAvatarWrapper.style.display = 'flex';
      btnCallCamera.style.display = 'none';
    }

    activeCallScreenModal.style.display = 'flex';

    setupWebRTCPeer(false);
    socket.emit('accept_call', { callerId: activeCallPartnerId, callType: activeCallType });
  });

  // Zəngi rədd et
  btnRejectCall.addEventListener('click', () => {
    MoonAudio.stopRinging();
    incomingCallModal.style.display = 'none';
    if (activeCallPartnerId) {
      socket.emit('reject_call', { callerId: activeCallPartnerId });
    }
    endCallCleanUp();
  });

  // Zəng qarşı tərəfdən qəbul edildi
  socket.on('call_accepted', async ({ peerId, peerName, peerAvatar, isBot, callType }) => {
    MoonAudio.stopRinging();
    activeCallStatus.textContent = 'Danışıq gedir';
    isCallActive = true;
    startCallTimer();

    if (callType) activeCallType = callType;

    if (isBot) {
      simulateMoonBotVoice();
      return;
    }

    setupWebRTCPeer(true);
  });

  // Zəng rədd edildi
  socket.on('call_rejected', ({ reason }) => {
    MoonAudio.stopRinging();
    MoonAudio.playEndCallSound();
    activeCallStatus.textContent = reason || 'Zəng rədd edildi';
    setTimeout(() => {
      endCallCleanUp();
    }, 1200);
  });

  // Qarşı tərəf zəngi bitirdi
  socket.on('call_ended', () => {
    MoonAudio.stopRinging();
    MoonAudio.playEndCallSound();
    activeCallStatus.textContent = 'Zəng başa çatdı';
    setTimeout(() => {
      endCallCleanUp();
    }, 1000);
  });

  // Zəngi bitir butonu
  btnCallEnd.addEventListener('click', () => {
    MoonAudio.stopRinging();
    MoonAudio.playEndCallSound();
    if (activeCallPartnerId) {
      socket.emit('end_call', { peerId: activeCallPartnerId });
    }
    endCallCleanUp();
  });

  // Mikrofonu bağla/aç (Mute/Unmute)
  btnCallMute.addEventListener('click', () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        isMicMuted = !audioTrack.enabled;

        if (isMicMuted) {
          btnCallMute.classList.add('muted');
          iconMicOn.style.display = 'none';
          iconMicOff.style.display = 'block';
        } else {
          btnCallMute.classList.remove('muted');
          iconMicOn.style.display = 'block';
          iconMicOff.style.display = 'none';
        }
      }
    }
  });

  // Kameranı aç/bağla
  if (btnCallCamera) {
    btnCallCamera.addEventListener('click', () => {
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = !videoTrack.enabled;
          isCameraOff = !videoTrack.enabled;
          btnCallCamera.classList.toggle('muted', isCameraOff);
        }
      }
    });
  }

  // WebRTC Peer Connection qurulması
  function setupWebRTCPeer(isInitiator) {
    peerConnection = new RTCPeerConnection(rtcConfig);

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    }

    peerConnection.ontrack = (event) => {
      if (activeCallType === 'video' && remoteVideo && event.streams && event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
        remoteVideo.play().catch(e => console.warn('Video play error:', e));
      } else if (remoteAudio && event.streams && event.streams[0]) {
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.play().catch(e => console.warn('Audio play error:', e));
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc_signal', {
          targetUserId: activeCallPartnerId,
          signal: { candidate: event.candidate }
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        activeCallStatus.textContent = 'Danışıq gedir';
      } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
        endCallCleanUp();
      }
    };

    if (isInitiator) {
      peerConnection.createOffer().then((offer) => {
        return peerConnection.setLocalDescription(offer);
      }).then(() => {
        socket.emit('webrtc_signal', {
          targetUserId: activeCallPartnerId,
          signal: { sdp: peerConnection.localDescription }
        });
      }).catch((e) => console.error('Create offer error:', e));
    }
  }

  // WebRTC Siqnalları qəbulu
  socket.on('webrtc_signal', async ({ senderId, signal }) => {
    if (!peerConnection) {
      setupWebRTCPeer(false);
    }

    try {
      if (signal.sdp) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === 'offer') {
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          socket.emit('webrtc_signal', {
            targetUserId: senderId,
            signal: { sdp: peerConnection.localDescription }
          });
        }
      } else if (signal.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (e) {
      console.warn('WebRTC signal handling error:', e);
    }
  });

  // MoonBot Səsli Cavab Simulyasiyası
  function simulateMoonBotVoice() {
    if ('speechSynthesis' in window) {
      const speechPhrases = [
        'Salam! MoonBot ilə səsli əlaqə uğurla yaradıldı. Səsiniz aydın eşidilir! MoonApp zəng sistemi əla işləyir.',
        'Alo! Eşidirəm sizi. Bu bir test zəngidir. Bütün sistemlər normal işləyir!',
        'Salam! Zənginiz üçün təşəkkürlər. MoonApp video və səsli zəng funksiyası aktivdir.'
      ];
      const text = speechPhrases[Math.floor(Math.random() * speechPhrases.length)];
      botSpeechSynthUtterance = new SpeechSynthesisUtterance(text);
      botSpeechSynthUtterance.lang = 'az-AZ';
      botSpeechSynthUtterance.rate = 0.95;
      botSpeechSynthUtterance.pitch = 1.05;
      window.speechSynthesis.speak(botSpeechSynthUtterance);
    }
  }

  // Zəngi təmizləmək və pəncərələri bağlamaq
  function endCallCleanUp() {
    MoonAudio.stopRinging();
    stopCallTimer();

    if (botSpeechSynthUtterance && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      botSpeechSynthUtterance = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStream = null;
    }

    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }

    if (remoteAudio) {
      remoteAudio.srcObject = null;
    }
    if (remoteVideo) {
      remoteVideo.srcObject = null;
    }
    if (localVideo) {
      localVideo.srcObject = null;
    }

    isCallActive = false;
    activeCallPartnerId = null;
    activeCallRoomId = null;
    isMicMuted = false;
    isCameraOff = false;

    if (btnCallMute) {
      btnCallMute.classList.remove('muted');
      if (iconMicOn) iconMicOn.style.display = 'block';
      if (iconMicOff) iconMicOff.style.display = 'none';
    }
    if (btnCallCamera) {
      btnCallCamera.classList.remove('muted');
      btnCallCamera.style.display = 'none';
    }

    incomingCallModal.style.display = 'none';
    activeCallScreenModal.style.display = 'none';
  }
});

