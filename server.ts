import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

// Interface definition for DB storage
interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  isAdmin: boolean;
  isBlocked: boolean;
  createdAt: number;
  lastSeen: number;
  avatar?: string;
  statusMessage?: string;
}

interface StoredGroup {
  id: string; // "group_..."
  name: string;
  avatar?: string;
  description?: string;
  createdBy: string;
  createdAt: number;
  admins: string[];
  members: string[]; // usernames
}

interface StoredMessage {
  id: string;
  sender: string;
  recipient: string;
  isGroup?: boolean;
  groupId?: string;
  isSystem?: boolean;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  content: string;
  mediaUrl?: string;
  duration?: number;
  timestamp: number;
  status: 'sent' | 'delivered' | 'read';
  reactions?: Record<string, string>;
  readBy?: string[];
}

interface StoredCallLog {
  id: string;
  caller: string;
  recipient: string;
  callType: 'voice' | 'video';
  status: 'completed' | 'missed' | 'declined';
  duration?: number;
  timestamp: number;
}

interface DbSchema {
  users: Record<string, StoredUser>;
  groups?: Record<string, StoredGroup>;
  messages: StoredMessage[];
  calls: StoredCallLog[];
}

function ensureDbFile(): DbSchema {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const defaultData: DbSchema = {
      users: {
        khabib: {
          id: 'user_khabib',
          username: 'khabib',
          passwordHash: '200911',
          isAdmin: true,
          isBlocked: false,
          createdAt: Date.now(),
          lastSeen: Date.now()
        }
      },
      groups: {},
      messages: [],
      calls: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
    return defaultData;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.users) parsed.users = {};
    if (!parsed.groups) parsed.groups = {};
    if (!parsed.messages) parsed.messages = [];
    if (!parsed.calls) parsed.calls = [];
    return parsed;
  } catch {
    return { users: {}, groups: {}, messages: [], calls: [] };
  }
}

function saveDb(data: DbSchema) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // Map connected usernames to active WebSockets
  const clients = new Map<string, Set<WebSocket>>();

  const sendToUser = (username: string, payload: any) => {
    const key = (username || '').toLowerCase().trim();
    if (!key) return;
    const sockets = clients.get(key);
    if (sockets) {
      const msg = JSON.stringify(payload);
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(msg);
        }
      }
    }
  };

  const saveAndBroadcastMessage = (msg: any) => {
    if (!msg || !msg.sender || !msg.recipient) return null;

    const senderRaw = (msg.sender || '').trim();
    const recipientRaw = (msg.recipient || '').trim();
    const senderKey = senderRaw.toLowerCase();
    const recipientKey = recipientRaw.toLowerCase();

    if (!senderKey || !recipientKey) return null;

    const db = ensureDbFile();
    const senderCanonical = db.users[senderKey]?.username || senderRaw;

    // Check if recipient is a group
    const isGroup = recipientKey.startsWith('group_') || !!db.groups?.[recipientKey];
    const group = isGroup && db.groups ? db.groups[recipientKey] : null;

    const recipientCanonical = isGroup && group ? group.id : (db.users[recipientKey]?.username || recipientRaw);
    const recipientSockets = !isGroup ? clients.get(recipientKey) : null;
    const isRecipientOnline = !isGroup && !!(recipientSockets && recipientSockets.size > 0);

    const storedMsg: StoredMessage = {
      id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sender: senderCanonical,
      recipient: recipientCanonical,
      isGroup: !!isGroup,
      groupId: isGroup ? recipientCanonical : undefined,
      isSystem: !!msg.isSystem,
      type: msg.type || 'text',
      content: msg.content || '',
      mediaUrl: msg.mediaUrl,
      duration: msg.duration,
      status: isGroup ? 'sent' : (isRecipientOnline ? 'delivered' : 'sent'),
      timestamp: msg.timestamp || Date.now(),
      reactions: msg.reactions || {},
      readBy: [senderCanonical]
    };

    // If an existing placeholder exists with same id, avoid duplicate
    const existingIdx = db.messages.findIndex((m) => m.id === storedMsg.id);
    if (existingIdx !== -1) {
      db.messages[existingIdx] = storedMsg;
    } else {
      db.messages.push(storedMsg);
    }
    saveDb(db);

    if (isGroup && group) {
      // Broadcast to ALL members in this group
      for (const member of group.members) {
        sendToUser(member, {
          type: 'chat_message',
          message: storedMsg,
          group
        });
      }
    } else {
      // 1-on-1: Forward to recipient
      sendToUser(recipientKey, {
        type: 'chat_message',
        message: storedMsg
      });

      // Forward to other sockets of sender (e.g. multiple tabs of same sender)
      const senderSockets = clients.get(senderKey);
      if (senderSockets && senderSockets.size > 0) {
        for (const s of senderSockets) {
          if (s.readyState === WebSocket.OPEN) {
            s.send(JSON.stringify({
              type: 'chat_message',
              message: storedMsg
            }));
          }
        }
      }

      // Send delivery acknowledgment back to sender
      if (isRecipientOnline) {
        sendToUser(senderKey, {
          type: 'message_delivered',
          messageId: storedMsg.id
        });
      }
    }

    return storedMsg;
  };

  const broadcastUserStatus = (username: string, isOnline: boolean) => {
    const payload = JSON.stringify({
      type: 'user_status',
      username,
      isOnline
    });
    for (const [, sockets] of clients.entries()) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    }
  };

  const getOnlineUsernames = (): string[] => {
    const active: string[] = [];
    for (const [uname, sockets] of clients.entries()) {
      let anyOpen = false;
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          anyOpen = true;
          break;
        }
      }
      if (anyOpen) active.push(uname);
    }
    return active;
  };

  // --- REST API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: Date.now() });
  });

  // Login
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'İstifadəçi adı və parol tələb olunur' });
    }

    const db = ensureDbFile();
    const key = username.toLowerCase();
    const user = db.users[key];

    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ error: 'İstifadəçi adı və ya parol yanlışdır' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: 'Hesabınız admin tərəfindən bloklanıb' });
    }

    user.lastSeen = Date.now();
    saveDb(db);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
        lastSeen: user.lastSeen,
        avatar: user.avatar,
        statusMessage: user.statusMessage
      }
    });
  });

  // Register
  app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    const cleanUsername = (username || '').trim();

    if (!cleanUsername || !password) {
      return res.status(400).json({ error: 'Bütün xanaları doldurun' });
    }

    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'İstifadəçi adı ən az 3 simvol olmalıdır' });
    }

    const db = ensureDbFile();
    const key = cleanUsername.toLowerCase();

    if (db.users[key]) {
      return res.status(409).json({ error: 'Bu istifadəçi adı artıq mövcuddur' });
    }

    const isKhabib = key === 'khabib';
    const newUser: StoredUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      username: cleanUsername,
      passwordHash: password,
      isAdmin: isKhabib,
      isBlocked: false,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      avatar: '',
      statusMessage: 'Khami tətbiqindən istifadə edirəm'
    };

    db.users[key] = newUser;
    saveDb(db);

    res.json({
      user: {
        id: newUser.id,
        username: newUser.username,
        isAdmin: newUser.isAdmin,
        isBlocked: newUser.isBlocked,
        createdAt: newUser.createdAt,
        lastSeen: newUser.lastSeen,
        avatar: newUser.avatar,
        statusMessage: newUser.statusMessage
      }
    });
  });

  // Update Profile (Avatar & Status)
  app.post('/api/user/profile', (req, res) => {
    const { username, avatar, statusMessage } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'İstifadəçi adı tələb olunur' });
    }

    const db = ensureDbFile();
    const key = username.toLowerCase();
    const user = db.users[key];

    if (!user) {
      return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
    }

    if (avatar !== undefined) {
      user.avatar = avatar;
    }
    if (statusMessage !== undefined) {
      user.statusMessage = statusMessage.slice(0, 120);
    }

    saveDb(db);

    // Broadcast profile change to all clients so contacts immediately see the new avatar & status
    const broadcastPayload = JSON.stringify({
      type: 'profile_updated',
      username: user.username,
      avatar: user.avatar,
      statusMessage: user.statusMessage
    });

    for (const [, sockets] of clients.entries()) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(broadcastPayload);
        }
      }
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
        lastSeen: user.lastSeen,
        avatar: user.avatar,
        statusMessage: user.statusMessage
      }
    });
  });

  // Change Password / Kod dəyişdirmə
  app.post('/api/user/change-password', (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Bütün xanaları doldurun' });
    }

    if (newPassword.length < 3) {
      return res.status(400).json({ error: 'Yeni parol ən az 3 simvol olmalıdır' });
    }

    const db = ensureDbFile();
    const key = (username || '').toLowerCase().trim();
    const user = db.users[key];

    if (!user) {
      return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
    }

    if (user.passwordHash !== currentPassword) {
      return res.status(401).json({ error: 'Cari parol yanlışdır' });
    }

    user.passwordHash = newPassword;
    saveDb(db);

    res.json({ success: true, message: 'Parol uğurla yeniləndi' });
  });

  // Get user details
  app.get('/api/user/:username', (req, res) => {
    const { username } = req.params;
    const db = ensureDbFile();
    const key = username.toLowerCase();
    const user = db.users[key];

    if (!user) {
      return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
    }

    res.json({
      user: {
        username: user.username,
        isAdmin: user.isAdmin,
        avatar: user.avatar,
        statusMessage: user.statusMessage,
        createdAt: user.createdAt,
        lastSeen: user.lastSeen,
        isOnline: getOnlineUsernames().includes(key)
      }
    });
  });

  // Check user existence (for confidential chat start)
  app.get('/api/user-check/:username', (req, res) => {
    const { username } = req.params;
    const db = ensureDbFile();
    const key = username.toLowerCase();
    const user = db.users[key];

    if (!user) {
      return res.status(404).json({ exists: false, error: 'İstifadəçi tapılmadı' });
    }

    res.json({
      exists: true,
      username: user.username,
      isBlocked: user.isBlocked,
      avatar: user.avatar,
      statusMessage: user.statusMessage
    });
  });

  // Get contact candidates for new chat / new group (recent contacts + all registered users)
  app.get('/api/users/contacts/:username', (req, res) => {
    const { username } = req.params;
    const cleanUser = (username || '').toLowerCase().trim();
    const db = ensureDbFile();

    // 1. Find recent contacts who had 1-on-1 messages with this user
    const recentSet = new Set<string>();
    for (const msg of db.messages) {
      if (msg.isGroup) continue;
      const s = (msg.sender || '').toLowerCase().trim();
      const r = (msg.recipient || '').toLowerCase().trim();
      if (s === cleanUser && r && r !== cleanUser) {
        recentSet.add(r);
      } else if (r === cleanUser && s && s !== cleanUser) {
        recentSet.add(s);
      }
    }

    const onlineList = getOnlineUsernames();

    // Format recent contacts
    const recentContacts = Array.from(recentSet)
      .map((key) => db.users[key])
      .filter((u): u is StoredUser => !!u && !u.isBlocked)
      .map((u) => ({
        username: u.username,
        avatar: u.avatar || '',
        statusMessage: u.statusMessage || '',
        isOnline: onlineList.includes(u.username.toLowerCase())
      }));

    // Format all other registered users (excluding current user and blocked users)
    const allUsers = Object.values(db.users)
      .filter((u) => u.username.toLowerCase() !== cleanUser && !u.isBlocked)
      .map((u) => ({
        username: u.username,
        avatar: u.avatar || '',
        statusMessage: u.statusMessage || '',
        isOnline: onlineList.includes(u.username.toLowerCase())
      }));

    res.json({ recentContacts, allUsers });
  });

  // --- GROUP CHAT ROUTES ---

  // Create new group (restricted to khabib admin)
  app.post('/api/groups', (req, res) => {
    const { name, avatar, description, createdBy, members } = req.body;
    const cleanName = (name || '').trim();
    const cleanCreator = (createdBy || '').trim();
    if (!cleanName || !cleanCreator) {
      return res.status(400).json({ error: 'Qrup adı və yaradıcı tələb olunur' });
    }

    if (cleanCreator.toLowerCase() !== 'khabib') {
      return res.status(403).json({ error: 'Qrup yaratmaq səlahiyyəti yalnız khabib admin hesabına məxsusdur.' });
    }

    const db = ensureDbFile();
    if (!db.groups) db.groups = {};

    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const memberSet = new Set<string>([cleanCreator]);
    if (Array.isArray(members)) {
      for (const m of members) {
        const cleanM = (m || '').trim();
        const userObj = db.users[cleanM.toLowerCase()];
        if (cleanM && userObj) {
          memberSet.add(userObj.username);
        }
      }
    }

    const newGroup: StoredGroup = {
      id: groupId,
      name: cleanName,
      avatar: avatar || '',
      description: (description || '').trim(),
      createdBy: cleanCreator,
      createdAt: Date.now(),
      admins: [cleanCreator],
      members: Array.from(memberSet)
    };

    db.groups[groupId] = newGroup;

    // Add initial system message
    const sysMsg: StoredMessage = {
      id: `sys_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sender: cleanCreator,
      recipient: groupId,
      groupId: groupId,
      isGroup: true,
      isSystem: true,
      type: 'text',
      content: `${cleanCreator} "${cleanName}" qrupunu yaratdı`,
      timestamp: Date.now(),
      status: 'read',
      readBy: [cleanCreator]
    };
    db.messages.push(sysMsg);
    saveDb(db);

    // Broadcast to all members
    for (const mem of newGroup.members) {
      sendToUser(mem, {
        type: 'group_created',
        group: newGroup
      });
      sendToUser(mem, {
        type: 'chat_message',
        message: sysMsg,
        group: newGroup
      });
    }

    res.json({ success: true, group: newGroup });
  });

  // Update group details (avatar, name, description)
  app.post('/api/groups/:groupId/update', (req, res) => {
    const { groupId } = req.params;
    const { username, name, avatar, description } = req.body;
    const db = ensureDbFile();
    const group = db.groups?.[groupId];
    if (!group) {
      return res.status(404).json({ error: 'Qrup tapılmadı' });
    }
    const cleanUser = (username || '').toLowerCase().trim();
    if (!group.members.some((m) => m.toLowerCase() === cleanUser)) {
      return res.status(403).json({ error: 'Bu qrupun üzvü deyilsiniz' });
    }

    let changed = false;
    let changeDescription = '';
    if (name && name.trim() !== group.name) {
      changeDescription = `${username} qrup adını dəyişdi: "${name.trim()}"`;
      group.name = name.trim();
      changed = true;
    }
    if (avatar !== undefined && avatar !== group.avatar) {
      changeDescription = `${username} qrup şəklini yenilədi`;
      group.avatar = avatar;
      changed = true;
    }
    if (description !== undefined && description !== group.description) {
      group.description = description.trim();
      changed = true;
    }

    if (changed) {
      if (changeDescription) {
        const sysMsg: StoredMessage = {
          id: `sys_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          sender: username,
          recipient: groupId,
          groupId: groupId,
          isGroup: true,
          isSystem: true,
          type: 'text',
          content: changeDescription,
          timestamp: Date.now(),
          status: 'read',
          readBy: [username]
        };
        db.messages.push(sysMsg);
      }
      saveDb(db);

      // Broadcast update to all members
      for (const m of group.members) {
        sendToUser(m, {
          type: 'group_updated',
          group
        });
      }
    }

    res.json({ success: true, group });
  });

  // Add members to group
  app.post('/api/groups/:groupId/members', (req, res) => {
    const { groupId } = req.params;
    const { username, newMembers } = req.body;
    const db = ensureDbFile();
    const group = db.groups?.[groupId];
    if (!group) {
      return res.status(404).json({ error: 'Qrup tapılmadı' });
    }
    if (!Array.isArray(newMembers) || newMembers.length === 0) {
      return res.status(400).json({ error: 'Əlavə ediləcək istifadəçi seçilməyib' });
    }

    const added: string[] = [];
    for (const m of newMembers) {
      const cleanM = (m || '').trim();
      const userObj = db.users[cleanM.toLowerCase()];
      if (userObj && !group.members.some((ex) => ex.toLowerCase() === cleanM.toLowerCase())) {
        group.members.push(userObj.username);
        added.push(userObj.username);
      }
    }

    if (added.length > 0) {
      const sysMsg: StoredMessage = {
        id: `sys_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        sender: username,
        recipient: groupId,
        groupId: groupId,
        isGroup: true,
        isSystem: true,
        type: 'text',
        content: `${username} ${added.join(', ')} istifadəçilərini qrupa əlavə etdi`,
        timestamp: Date.now(),
        status: 'read',
        readBy: [username]
      };
      db.messages.push(sysMsg);
      saveDb(db);

      for (const m of group.members) {
        sendToUser(m, {
          type: 'group_updated',
          group
        });
        sendToUser(m, {
          type: 'chat_message',
          message: sysMsg,
          group
        });
      }
    }

    res.json({ success: true, group, added });
  });

  // Leave group
  app.post('/api/groups/:groupId/leave', (req, res) => {
    const { groupId } = req.params;
    const { username } = req.body;
    const db = ensureDbFile();
    const group = db.groups?.[groupId];
    if (!group) {
      return res.status(404).json({ error: 'Qrup tapılmadı' });
    }
    const cleanUser = (username || '').toLowerCase().trim();
    const memberIdx = group.members.findIndex((m) => m.toLowerCase() === cleanUser);
    if (memberIdx !== -1) {
      const leavingUser = group.members[memberIdx];
      group.members.splice(memberIdx, 1);
      group.admins = group.admins.filter((a) => a.toLowerCase() !== cleanUser);

      if (group.admins.length === 0 && group.members.length > 0) {
        group.admins.push(group.members[0]);
      }

      const sysMsg: StoredMessage = {
        id: `sys_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        sender: leavingUser,
        recipient: groupId,
        groupId: groupId,
        isGroup: true,
        isSystem: true,
        type: 'text',
        content: `${leavingUser} qrupdan çıxdı`,
        timestamp: Date.now(),
        status: 'read',
        readBy: []
      };
      db.messages.push(sysMsg);
      saveDb(db);

      for (const m of [...group.members, leavingUser]) {
        sendToUser(m, {
          type: 'group_updated',
          group
        });
      }
    }

    res.json({ success: true });
  });

  // Get conversations for a user (1-on-1 + groups)
  app.get('/api/conversations/:username', (req, res) => {
    const { username } = req.params;
    const cleanUser = (username || '').toLowerCase().trim();
    if (!cleanUser || cleanUser === 'undefined') {
      return res.json({ conversations: [] });
    }
    const db = ensureDbFile();

    // Group 1-on-1 messages by conversation peer
    const conversationMap = new Map<string, { lastMessage: StoredMessage; unreadCount: number }>();

    for (const msg of db.messages) {
      if (msg.isGroup) continue; // groups processed separately below

      const sender = (msg.sender || '').toLowerCase().trim();
      const recipient = (msg.recipient || '').toLowerCase().trim();

      if (sender !== cleanUser && recipient !== cleanUser) {
        continue;
      }

      const peer = sender === cleanUser ? msg.recipient : msg.sender;
      const peerKey = (peer || '').toLowerCase().trim();
      if (!peerKey) continue;

      let conv = conversationMap.get(peerKey);
      if (!conv) {
        conv = { lastMessage: msg, unreadCount: 0 };
        conversationMap.set(peerKey, conv);
      } else {
        if (msg.timestamp > conv.lastMessage.timestamp) {
          conv.lastMessage = msg;
        }
      }

      if (recipient === cleanUser && msg.status !== 'read') {
        conv.unreadCount += 1;
      }
    }

    const conversations: any[] = Array.from(conversationMap.entries()).map(([peerKey, data]) => {
      const peerUser = db.users[peerKey];
      const originalUser = peerUser?.username || peerKey;
      return {
        user: originalUser,
        avatar: peerUser?.avatar,
        statusMessage: peerUser?.statusMessage,
        lastMessage: data.lastMessage,
        unreadCount: data.unreadCount,
        isGroup: false
      };
    });

    // Add groups where user is a member
    if (db.groups) {
      const canonicalUser = db.users[cleanUser]?.username || cleanUser;
      for (const group of Object.values(db.groups)) {
        const isMember = group.members.some((m) => m.toLowerCase() === cleanUser);
        if (!isMember) continue;

        const groupMsgs = db.messages.filter((m) => m.recipient === group.id || m.groupId === group.id);
        const lastMsg = groupMsgs.length > 0 ? groupMsgs[groupMsgs.length - 1] : null;

        let unread = 0;
        for (const m of groupMsgs) {
          if (m.sender.toLowerCase() !== cleanUser) {
            if (!m.readBy || !m.readBy.includes(canonicalUser)) {
              unread++;
            }
          }
        }

        const fallbackMsg: StoredMessage = {
          id: `init_${group.id}`,
          sender: group.createdBy,
          recipient: group.id,
          groupId: group.id,
          isGroup: true,
          isSystem: true,
          type: 'text',
          content: `${group.name} qrupu yaradıldı`,
          timestamp: group.createdAt,
          status: 'read'
        };

        conversations.push({
          user: group.id,
          name: group.name,
          isGroup: true,
          groupData: group,
          avatar: group.avatar,
          statusMessage: `${group.members.length} üzv`,
          lastMessage: lastMsg || fallbackMsg,
          unreadCount: unread
        });
      }
    }

    // Sort by most recent message descending
    conversations.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);

    res.json({ conversations });
  });

  // Send message REST route (guarantees 100% persistence even if WS is blipping)
  app.post('/api/messages', (req, res) => {
    const { message } = req.body;
    if (!message || !message.sender || !message.recipient) {
      return res.status(400).json({ error: 'Mesaj parametrləri tam deyil' });
    }
    const saved = saveAndBroadcastMessage(message);
    if (!saved) {
      return res.status(500).json({ error: 'Mesaj göndərilə bilmədi' });
    }
    res.json({ success: true, message: saved });
  });

  // Get messages between two users (or within a group chat)
  app.get('/api/messages/:user1/:user2', (req, res) => {
    const u1 = (req.params.user1 || '').toLowerCase().trim();
    const u2 = (req.params.user2 || '').toLowerCase().trim();
    if (!u1 || !u2 || u1 === 'undefined' || u2 === 'undefined') {
      return res.json({ messages: [] });
    }
    const db = ensureDbFile();

    // Check if u2 is a group chat
    if (u2.startsWith('group_')) {
      const group = db.groups?.[u2];
      if (!group) {
        return res.json({ messages: [], group: null });
      }

      const isMember = group.members.some((m) => m.toLowerCase() === u1);
      if (!isMember) {
        return res.status(403).json({ error: 'Bu qrupun üzvü deyilsiniz', messages: [] });
      }

      const canonicalU1 = db.users[u1]?.username || u1;
      const groupMessages = db.messages.filter((m) => {
        return (m.recipient && m.recipient.toLowerCase() === u2) || (m.groupId && m.groupId.toLowerCase() === u2);
      });

      // Mark group messages as read by u1
      let updated = false;
      for (const m of groupMessages) {
        if (!m.readBy) m.readBy = [];
        if (!m.readBy.includes(canonicalU1)) {
          m.readBy.push(canonicalU1);
          updated = true;
        }
      }
      if (updated) {
        saveDb(db);
      }

      // Notify caller that unread badges for this group are cleared
      sendToUser(u1, {
        type: 'unread_cleared',
        peer: group.id
      });

      return res.json({ messages: groupMessages, group });
    }

    // 1-on-1 direct conversation
    const conversationMessages = db.messages.filter((m) => {
      if (m.isGroup) return false;
      const s = (m.sender || '').toLowerCase().trim();
      const r = (m.recipient || '').toLowerCase().trim();
      return (s === u1 && r === u2) || (s === u2 && r === u1);
    });

    // Mark messages sent to u1 as read
    let updated = false;
    for (const m of conversationMessages) {
      if (m.recipient.toLowerCase() === u1 && m.status !== 'read') {
        m.status = 'read';
        updated = true;
      }
    }

    if (updated) {
      saveDb(db);
    }

    // Always notify u2 that u1 has seen the messages (turns ticks to blue)
    sendToUser(u2, {
      type: 'messages_read',
      reader: req.params.user1
    });

    // Also notify u1 that messages from u2 are read (instantly clears unread count)
    sendToUser(u1, {
      type: 'unread_cleared',
      peer: req.params.user2
    });

    res.json({ messages: conversationMessages });
  });

  // Delete / Clear conversation
  app.delete('/api/conversation/:user1/:user2', (req, res) => {
    const u1 = req.params.user1.toLowerCase();
    const u2 = req.params.user2.toLowerCase();
    const db = ensureDbFile();

    if (u2.startsWith('group_')) {
      const group = db.groups?.[u2];
      if (group) {
        db.messages = db.messages.filter((m) => m.recipient.toLowerCase() !== u2 && m.groupId?.toLowerCase() !== u2);
        saveDb(db);
        for (const m of group.members) {
          sendToUser(m, { type: 'conversation_deleted', peer: u2 });
        }
      }
      return res.json({ success: true });
    }

    db.messages = db.messages.filter((m) => {
      const s = m.sender.toLowerCase();
      const r = m.recipient.toLowerCase();
      return !((s === u1 && r === u2) || (s === u2 && r === u1));
    });

    saveDb(db);

    // Notify users in real-time
    sendToUser(u1, { type: 'conversation_deleted', peer: req.params.user2 });
    sendToUser(u2, { type: 'conversation_deleted', peer: req.params.user1 });

    res.json({ success: true });
  });

  // Delete single message
  app.delete('/api/message/:id', (req, res) => {
    const { id } = req.params;
    const db = ensureDbFile();
    const idx = db.messages.findIndex((m) => m.id === id);
    if (idx !== -1) {
      const deleted = db.messages[idx];
      db.messages.splice(idx, 1);
      saveDb(db);

      if (deleted.isGroup && deleted.groupId && db.groups?.[deleted.groupId.toLowerCase()]) {
        const group = db.groups[deleted.groupId.toLowerCase()];
        for (const m of group.members) {
          sendToUser(m, { type: 'message_deleted', messageId: id, peer: deleted.groupId });
        }
      } else {
        sendToUser(deleted.sender, { type: 'message_deleted', messageId: id, peer: deleted.recipient });
        sendToUser(deleted.recipient, { type: 'message_deleted', messageId: id, peer: deleted.sender });
      }
    }
    res.json({ success: true });
  });

  // Call Logs: Get calls for a user
  app.get('/api/calls/:username', (req, res) => {
    const user = req.params.username.toLowerCase();
    const db = ensureDbFile();
    const userCalls = (db.calls || []).filter(
      (c) => c.caller.toLowerCase() === user || c.recipient.toLowerCase() === user
    ).sort((a, b) => b.timestamp - a.timestamp);
    res.json(userCalls);
  });

  // Call Logs: Create or update call log
  app.post('/api/calls', (req, res) => {
    const { id, caller, recipient, callType, status, duration, timestamp } = req.body;
    if (!caller || !recipient) {
      return res.status(400).json({ error: 'Caller and recipient required' });
    }
    const db = ensureDbFile();
    if (!db.calls) db.calls = [];

    const callId = id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const existingIdx = db.calls.findIndex((c) => c.id === callId);
    const callRecord: StoredCallLog = {
      id: callId,
      caller,
      recipient,
      callType: callType || 'voice',
      status: status || 'completed',
      duration: duration !== undefined ? duration : 0,
      timestamp: timestamp || Date.now()
    };

    if (existingIdx !== -1) {
      db.calls[existingIdx] = { ...db.calls[existingIdx], ...callRecord };
    } else {
      db.calls.unshift(callRecord);
    }
    saveDb(db);

    sendToUser(caller, { type: 'call_log_updated', call: callRecord });
    sendToUser(recipient, { type: 'call_log_updated', call: callRecord });

    res.json(callRecord);
  });

  // Call Logs: Delete single call log
  app.delete('/api/calls/:id', (req, res) => {
    const { id } = req.params;
    const db = ensureDbFile();
    if (db.calls) {
      const idx = db.calls.findIndex((c) => c.id === id);
      if (idx !== -1) {
        const deleted = db.calls[idx];
        db.calls.splice(idx, 1);
        saveDb(db);
        sendToUser(deleted.caller, { type: 'call_log_updated' });
        sendToUser(deleted.recipient, { type: 'call_log_updated' });
      }
    }
    res.json({ success: true });
  });

  // Call Logs: Clear all calls for a user
  app.delete('/api/calls/clear/:username', (req, res) => {
    const user = req.params.username.toLowerCase();
    const db = ensureDbFile();
    if (db.calls) {
      db.calls = db.calls.filter(
        (c) => c.caller.toLowerCase() !== user && c.recipient.toLowerCase() !== user
      );
      saveDb(db);
      sendToUser(user, { type: 'call_log_updated' });
    }
    res.json({ success: true });
  });

  // Admin: Get all users
  app.get('/api/admin/users', (req, res) => {
    const adminHeader = req.headers['x-admin-user'] as string;
    if (!adminHeader || adminHeader.toLowerCase() !== 'khabib') {
      return res.status(403).json({ error: 'Yalnız khabib istifadəçisi daxil ola bilər' });
    }

    const db = ensureDbFile();
    const onlineList = getOnlineUsernames();

    const usersList = Object.values(db.users).map((u) => ({
      id: u.id,
      username: u.username,
      isAdmin: u.isAdmin,
      isBlocked: u.isBlocked,
      createdAt: u.createdAt,
      lastSeen: u.lastSeen,
      avatar: u.avatar,
      statusMessage: u.statusMessage,
      isOnline: onlineList.includes(u.username.toLowerCase())
    }));

    res.json({ users: usersList });
  });

  // Admin: Toggle block user
  app.post('/api/admin/block-toggle', (req, res) => {
    const adminHeader = req.headers['x-admin-user'] as string;
    if (!adminHeader || adminHeader.toLowerCase() !== 'khabib') {
      return res.status(403).json({ error: 'İcazə verilmədi' });
    }

    const { targetUsername, block } = req.body;
    if (!targetUsername) {
      return res.status(400).json({ error: 'İstifadəçi adı qeyd edilməyib' });
    }
    if (targetUsername.toLowerCase() === 'khabib') {
      return res.status(400).json({ error: 'Admin hesabı bloklana bilməz' });
    }

    const db = ensureDbFile();
    const user = db.users[targetUsername.toLowerCase()];
    if (!user) {
      return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
    }

    user.isBlocked = !!block;
    saveDb(db);

    if (user.isBlocked) {
      sendToUser(targetUsername, { type: 'blocked_by_admin' });
      const sockets = clients.get(targetUsername.toLowerCase());
      if (sockets) {
        for (const ws of sockets) {
          ws.close();
        }
      }
    }

    res.json({ success: true, isBlocked: user.isBlocked });
  });

  // Admin: Delete a user permanently
  app.post('/api/admin/delete-user', (req, res) => {
    const adminHeader = req.headers['x-admin-user'] as string;
    if (!adminHeader || adminHeader.toLowerCase() !== 'khabib') {
      return res.status(403).json({ error: 'İcazə verilmədi' });
    }

    const { targetUsername } = req.body;
    if (!targetUsername) {
      return res.status(400).json({ error: 'İstifadəçi adı qeyd edilməyib' });
    }
    const targetKey = targetUsername.toLowerCase();
    if (targetKey === 'khabib') {
      return res.status(400).json({ error: 'Admin hesabı silinə bilməz' });
    }

    const db = ensureDbFile();
    if (!db.users[targetKey]) {
      return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
    }

    // Disconnect any active sockets for that user
    const sockets = clients.get(targetKey);
    if (sockets) {
      for (const ws of sockets) {
        ws.send(JSON.stringify({ type: 'blocked_by_admin' }));
        ws.close();
      }
      clients.delete(targetKey);
    }

    delete db.users[targetKey];
    // Also remove related messages and calls
    db.messages = db.messages.filter(
      (m) => m.sender.toLowerCase() !== targetKey && m.recipient.toLowerCase() !== targetKey
    );
    if (db.calls) {
      db.calls = db.calls.filter(
        (c) => c.caller.toLowerCase() !== targetKey && c.recipient.toLowerCase() !== targetKey
      );
    }
    saveDb(db);

    res.json({ success: true, message: `${targetUsername} profili uğurla silindi` });
  });

  // Admin: Clear all messages in all chats
  app.post('/api/admin/clear-all-messages', (req, res) => {
    const adminHeader = req.headers['x-admin-user'] as string;
    if (!adminHeader || adminHeader.toLowerCase() !== 'khabib') {
      return res.status(403).json({ error: 'Yalnız khabib istifadəçisi bu əməliyyatı icra edə bilər' });
    }

    const db = ensureDbFile();
    db.messages = [];
    saveDb(db);

    // Broadcast to all connected clients
    const payload = JSON.stringify({
      type: 'all_messages_cleared'
    });

    for (const [, sockets] of clients.entries()) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    }

    res.json({ success: true, message: 'Bütün çat mesajları uğurla təmizləndi' });
  });

  // --- WEBSOCKET REAL-TIME DISPATCHER ---
  wss.on('connection', (ws: WebSocket) => {
    let authUser: string | null = null;

    ws.on('message', (messageRaw: string) => {
      try {
        const data = JSON.parse(messageRaw);
        switch (data.type) {
          case 'auth': {
            const username = (data.username || '').trim();
            if (!username) return;
            const userKey = username.toLowerCase();

            // Purge this socket from ANY previous user accounts in clients map
            for (const [key, set] of clients.entries()) {
              if (key !== userKey && set.has(ws)) {
                set.delete(ws);
                if (set.size === 0) {
                  clients.delete(key);
                }
              }
            }

            authUser = userKey;

            if (!clients.has(userKey)) {
              clients.set(userKey, new Set());
            }
            clients.get(userKey)!.add(ws);

            // Update user's lastSeen in DB
            const db = ensureDbFile();
            if (db.users[userKey]) {
              db.users[userKey].lastSeen = Date.now();
              saveDb(db);
            }

            // Send online users list to connecting socket
            ws.send(JSON.stringify({
              type: 'online_users',
              users: getOnlineUsernames()
            }));

            // Notify everyone of user online
            broadcastUserStatus(username, true);
            break;
          }

          case 'send_message': {
            const msg: StoredMessage = data.message;
            if (msg) {
              saveAndBroadcastMessage(msg);
            }
            break;
          }

          case 'react_message': {
            const { messageId, username, targetUser, emoji } = data;
            const db = ensureDbFile();
            const targetMsg = db.messages.find((m) => m.id === messageId);
            if (targetMsg) {
              if (!targetMsg.reactions) targetMsg.reactions = {};
              targetMsg.reactions[username] = emoji;
              saveDb(db);
            }

            const tKey = (targetUser || '').toLowerCase().trim();
            if (tKey.startsWith('group_') && db.groups?.[tKey]) {
              for (const m of db.groups[tKey].members) {
                sendToUser(m, {
                  type: 'message_reaction',
                  messageId,
                  username,
                  emoji,
                  peer: targetUser
                });
              }
            } else {
              sendToUser(targetUser, {
                type: 'message_reaction',
                messageId,
                username,
                emoji,
                peer: username
              });
            }
            break;
          }

          case 'mark_read': {
            const { sender, targetUser } = data;
            if (!sender || !targetUser) break;
            const sKey = (sender || '').toLowerCase().trim();
            const tKey = (targetUser || '').toLowerCase().trim();
            const db = ensureDbFile();
            let changed = false;
            for (const m of db.messages) {
              const ms = (m.sender || '').toLowerCase().trim();
              const mr = (m.recipient || '').toLowerCase().trim();
              if (ms === tKey && mr === sKey && m.status !== 'read') {
                m.status = 'read';
                changed = true;
              }
            }
            if (changed) {
              saveDb(db);
            }
            // Always notify targetUser (sender of messages) that reader has seen them
            sendToUser(tKey, {
              type: 'messages_read',
              reader: sender
            });
            // Also notify reader so their own unread badge clears immediately
            sendToUser(sKey, {
              type: 'unread_cleared',
              peer: targetUser
            });
            break;
          }

          case 'typing_indicator': {
            const { sender, target, status, isGroup } = data;
            if (!sender || !target) break;
            const sKey = (sender || '').toLowerCase().trim();
            const tKey = (target || '').toLowerCase().trim();
            const db = ensureDbFile();

            const senderCanonical = db.users[sKey]?.username || sender;

            if (isGroup || tKey.startsWith('group_')) {
              const group = db.groups?.[tKey];
              if (group) {
                for (const member of group.members) {
                  const mKey = member.toLowerCase().trim();
                  if (mKey !== sKey) {
                    sendToUser(mKey, {
                      type: 'typing_indicator',
                      sender: senderCanonical,
                      target: group.id,
                      status: status || 'typing',
                      isGroup: true
                    });
                  }
                }
              }
            } else {
              sendToUser(tKey, {
                type: 'typing_indicator',
                sender: senderCanonical,
                target: senderCanonical,
                status: status || 'typing',
                isGroup: false
              });
            }
            break;
          }

          case 'call_signal': {
            const { targetUser, sender } = data;
            const callerIdentity = sender || authUser;
            if (targetUser) {
              sendToUser(targetUser, {
                type: 'call_signal',
                from: callerIdentity,
                ...data
              });
            }
            break;
          }
        }
      } catch (err) {
        console.warn('WS Message Error:', err);
      }
    });

    ws.on('close', () => {
      for (const [key, set] of clients.entries()) {
        if (set.has(ws)) {
          set.delete(ws);
          if (set.size === 0) {
            clients.delete(key);
            const db = ensureDbFile();
            if (db.users[key]) {
              db.users[key].lastSeen = Date.now();
              saveDb(db);
            }
            broadcastUserStatus(key, false);
          }
        }
      }
    });
  });

  // --- VITE MIDDLEWARE OR STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Khami Studios Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
