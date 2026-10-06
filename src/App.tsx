import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Message, Conversation, ActiveCall, CallLog, GroupChat } from './types';
import { SplashScreen } from './components/SplashScreen';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { CallModal } from './components/CallModal';
import { NewChatModal } from './components/NewChatModal';
import { NewCallModal } from './components/NewCallModal';
import { NewGroupModal } from './components/NewGroupModal';
import { GroupInfoModal } from './components/GroupInfoModal';
import { AdminModal } from './components/AdminModal';
import { ProfileModal } from './components/ProfileModal';
import { MediaLightbox } from './components/MediaLightbox';
import { KhamiLogo } from './components/KhamiLogo';
import { soundManager } from './utils/audio';
import { webrtcManager } from './utils/webrtc';

export default function App() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('khami_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatUser, setActiveChatUser] = useState<string | null>(null);
  const [activeGroupData, setActiveGroupData] = useState<GroupChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'calls'>('chats');
  const [typingMap, setTypingMap] = useState<Record<string, { username: string; status: 'typing' | 'recording'; timer: any }>>({});

  // Modals
  const [isNewChatOpen, setIsNewChatOpen] = useState<boolean>(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState<boolean>(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState<boolean>(false);
  const [isNewCallOpen, setIsNewCallOpen] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  // Partner Profile (avatar & status & lastSeen)
  const [partnerProfile, setPartnerProfile] = useState<{ avatar?: string; statusMessage?: string; lastSeen?: number }>({});

  // WebSocket Ref & Call ID Ref
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const currentCallIdRef = useRef<string | null>(null);
  const activeChatUserRef = useRef<string | null>(null);
  activeChatUserRef.current = activeChatUser;
  const activeChatTokenRef = useRef<number>(0);
  const conversationsTokenRef = useRef<number>(0);
  const currentUserRef = useRef<User | null>(null);
  currentUserRef.current = currentUser;

  // Load conversations list for current user
  const fetchConversations = useCallback(async (username: string) => {
    if (!username) return;
    const token = ++conversationsTokenRef.current;
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(username)}`);
      if (res.ok) {
        const data = await res.json();
        if (
          token === conversationsTokenRef.current &&
          currentUserRef.current?.username.toLowerCase() === username.toLowerCase()
        ) {
          setConversations(data.conversations || []);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch conversations:', err);
    }
  }, []);

  // Load call history logs for current user
  const fetchCallLogs = useCallback(async (username: string) => {
    try {
      const res = await fetch(`/api/calls/${encodeURIComponent(username)}`);
      if (res.ok) {
        const data = await res.json();
        setCallLogs(data || []);
      }
    } catch (err) {
      console.warn('Failed to fetch call logs:', err);
    }
  }, []);

  // Delete single call log
  const handleDeleteCallLog = async (callId: string) => {
    try {
      const res = await fetch(`/api/calls/${encodeURIComponent(callId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setCallLogs((prev) => prev.filter((c) => c.id !== callId));
      }
    } catch (err) {
      console.warn('Failed to delete call log:', err);
    }
  };

  // Clear all call logs for user
  const handleClearAllCallLogs = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/calls/clear/${encodeURIComponent(currentUser.username)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setCallLogs([]);
      }
    } catch (err) {
      console.warn('Failed to clear call logs:', err);
    }
  };

  // Load chat messages with atomic sequence token
  const fetchMessages = useCallback(async (user1: string, user2: string) => {
    if (!user1 || !user2) return;
    const reqToken = ++activeChatTokenRef.current;
    try {
      const res = await fetch(`/api/messages/${encodeURIComponent(user1)}/${encodeURIComponent(user2)}`);
      if (res.ok) {
        const data = await res.json();
        // Strict guard against race conditions:
        // 1. Token must match current activeChatToken
        // 2. Active user must match user1
        // 3. activeChatUserRef must match user2
        if (
          reqToken === activeChatTokenRef.current &&
          currentUserRef.current?.username.toLowerCase() === user1.toLowerCase() &&
          activeChatUserRef.current?.toLowerCase() === user2.toLowerCase()
        ) {
          const u1 = user1.toLowerCase().trim();
          const u2 = user2.toLowerCase().trim();
          const isGroupChat = u2.startsWith('group_');

          if (isGroupChat) {
            if (data.group) {
              setActiveGroupData(data.group);
            }
          }

          const cleanMsgs = (data.messages || []).filter((m: Message) => {
            if (isGroupChat) {
              return (
                (m.recipient && m.recipient.toLowerCase() === u2) ||
                (m.groupId && m.groupId.toLowerCase() === u2)
              );
            }
            const s = (m.sender || '').toLowerCase().trim();
            const r = (m.recipient || '').toLowerCase().trim();
            return (s === u1 && r === u2) || (s === u2 && r === u1);
          });
          cleanMsgs.sort((a: Message, b: Message) => a.timestamp - b.timestamp);
          setMessages(cleanMsgs);

          // Clear local unread badge count immediately for this chat
          setConversations((prev) =>
            prev.map((c) =>
              c.user.toLowerCase() === u2 ? { ...c, unreadCount: 0 } : c
            )
          );
        }

        // Mark messages as read via WS
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'mark_read',
            sender: user1,
            targetUser: user2
          }));
        }
      }
    } catch (err) {
      console.warn('Failed to fetch messages:', err);
    }
  }, []);

  // Initialize and maintain WebSocket connection
  const connectWebSocket = useCallback((user: User) => {
    // If an existing socket is connected or connecting, close it first so we cleanly re-authenticate
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Authenticate socket session
      ws.send(JSON.stringify({
        type: 'auth',
        username: user.username
      }));
      // Fetch initial data
      fetchConversations(user.username);
      fetchCallLogs(user.username);
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'online_users':
            setOnlineUsers(data.users || []);
            break;

          case 'user_status':
            setOnlineUsers((prev) => {
              const lower = data.username.toLowerCase();
              if (data.isOnline) {
                return prev.includes(lower) ? prev : [...prev, lower];
              } else {
                return prev.filter((u) => u !== lower);
              }
            });
            break;

          case 'chat_message': {
            const newMsg: Message = data.message;
            if (!newMsg || !newMsg.sender || !newMsg.recipient) break;

            const myNameLower = user.username.toLowerCase();
            const senderLower = (newMsg.sender || '').toLowerCase();
            const recipientLower = (newMsg.recipient || '').toLowerCase();
            const isGroupMsg = !!newMsg.isGroup || recipientLower.startsWith('group_');

            // Strict user isolation check:
            // For 1-on-1: sender or recipient must be currently logged in user
            // For groups: data.group must contain user OR newMsg.recipient must be in group
            if (!isGroupMsg) {
              if (senderLower !== myNameLower && recipientLower !== myNameLower) {
                break;
              }
            } else {
              if (data.group && !data.group.members.some((m: string) => m.toLowerCase() === myNameLower)) {
                break;
              }
            }

            // Play incoming sound only if I am not the sender
            if (senderLower !== myNameLower) {
              soundManager.playMessageReceived();

              // Trigger vibration on phone / mobile device
              if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                try {
                  navigator.vibrate([200, 100, 200]);
                } catch {}
              }

              // Send system / mobile notification to lockscreen or desktop
              const isNotOnThisChat = !activeChatUserRef.current || activeChatUserRef.current.toLowerCase() !== (isGroupMsg ? recipientLower : senderLower);
              const isDocHidden = typeof document !== 'undefined' && (document.hidden || !document.hasFocus());

              if ((isNotOnThisChat || isDocHidden) && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                const title = isGroupMsg ? `${data.group?.name || 'Qrup'} • ${newMsg.sender}` : `Khami • ${newMsg.sender}`;
                const bodyText = newMsg.type === 'text' 
                  ? newMsg.content 
                  : (newMsg.type === 'image' ? '📷 Şəkil göndərdi' : (newMsg.type === 'video' ? '🎥 Video göndərdi' : (newMsg.type === 'audio' ? '🎤 Səsli mesaj göndərdi' : '📎 Fayl göndərdi')));

                try {
                  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.ready.then((reg) => {
                      reg.showNotification(title, {
                        body: bodyText,
                        icon: '/favicon.ico',
                        badge: '/favicon.ico',
                        tag: `msg-${newMsg.sender}`,
                        renotify: true
                      } as any);
                    }).catch(() => {
                      new Notification(title, { body: bodyText, icon: '/favicon.ico' });
                    });
                  } else {
                    new Notification(title, { body: bodyText, icon: '/favicon.ico' });
                  }
                } catch {}
              }
            }

            const currentPeer = activeChatUserRef.current;
            if (currentPeer) {
              const curPeerLower = currentPeer.toLowerCase();

              const isForThisChat = isGroupMsg
                ? (curPeerLower === recipientLower || curPeerLower === (newMsg.groupId || '').toLowerCase())
                : (
                    (senderLower === curPeerLower && recipientLower === myNameLower) ||
                    (senderLower === myNameLower && recipientLower === curPeerLower)
                  );

              if (isForThisChat) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === newMsg.id)) {
                    return prev.map((m) => m.id === newMsg.id ? newMsg : m);
                  }
                  const updated = [...prev, newMsg];
                  updated.sort((a, b) => a.timestamp - b.timestamp);
                  return updated;
                });

                // Auto mark as read if chat is open with this peer
                if (senderLower === curPeerLower && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'mark_read',
                    sender: user.username,
                    targetUser: currentPeer
                  }));
                }
              }
            }

            // Refresh conversations list
            fetchConversations(user.username);
            break;
          }

          case 'group_created':
          case 'group_updated': {
            fetchConversations(user.username);
            if (data.group && activeChatUserRef.current?.toLowerCase() === data.group.id.toLowerCase()) {
              setActiveGroupData(data.group);
              setPartnerProfile({
                avatar: data.group.avatar,
                statusMessage: `${data.group.members.length} üzv`
              });
            }
            break;
          }

          case 'typing_indicator': {
            const { sender, target, status, isGroup } = data;
            if (!sender || !target) break;

            const sLower = (sender || '').toLowerCase().trim();
            const tLower = (target || '').toLowerCase().trim();
            const myNameLower = user.username.toLowerCase();

            // Ignore our own typing reflections
            if (sLower === myNameLower) break;

            // Chat key for indexing
            const chatKey = isGroup ? tLower : sLower;

            if (status === 'stopped') {
              setTypingMap((prev) => {
                const next = { ...prev };
                if (next[chatKey]?.timer) clearTimeout(next[chatKey].timer);
                delete next[chatKey];
                return next;
              });

              setConversations((prev) =>
                prev.map((c) =>
                  c.user.toLowerCase() === chatKey
                    ? { ...c, isTyping: false, typingStatus: undefined, typingUser: undefined }
                    : c
                )
              );
            } else {
              // 'typing' or 'recording'
              setTypingMap((prev) => {
                if (prev[chatKey]?.timer) clearTimeout(prev[chatKey].timer);
                const timer = setTimeout(() => {
                  setTypingMap((p) => {
                    const n = { ...p };
                    delete n[chatKey];
                    return n;
                  });
                  setConversations((convs) =>
                    convs.map((c) =>
                      c.user.toLowerCase() === chatKey
                        ? { ...c, isTyping: false, typingStatus: undefined, typingUser: undefined }
                        : c
                    )
                  );
                }, 3500);

                return {
                  ...prev,
                  [chatKey]: {
                    username: sender,
                    status: status as 'typing' | 'recording',
                    timer
                  }
                };
              });

              setConversations((prev) =>
                prev.map((c) =>
                  c.user.toLowerCase() === chatKey
                    ? {
                        ...c,
                        isTyping: true,
                        typingStatus: status as 'typing' | 'recording',
                        typingUser: isGroup ? sender : undefined
                      }
                    : c
                )
              );
            }
            break;
          }

          case 'message_delivered': {
            setMessages((prev) =>
              prev.map((m) => (m.id === data.messageId ? { ...m, status: 'delivered' } : m))
            );
            break;
          }

          case 'messages_read': {
            const readerLower = (data.reader || '').toLowerCase().trim();
            setMessages((prev) =>
              prev.map((m) =>
                m.recipient.toLowerCase().trim() === readerLower ? { ...m, status: 'read' } : m
              )
            );
            // Also update status in conversations list
            setConversations((prev) =>
              prev.map((c) => {
                if (c.user.toLowerCase().trim() === readerLower && c.lastMessage) {
                  return {
                    ...c,
                    lastMessage: {
                      ...c.lastMessage,
                      status: 'read'
                    }
                  };
                }
                return c;
              })
            );
            break;
          }

          case 'unread_cleared': {
            const peerLower = (data.peer || '').toLowerCase().trim();
            setConversations((prev) =>
              prev.map((c) =>
                c.user.toLowerCase().trim() === peerLower ? { ...c, unreadCount: 0 } : c
              )
            );
            break;
          }

          case 'message_reaction': {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === data.messageId) {
                  return {
                    ...m,
                    reactions: {
                      ...(m.reactions || {}),
                      [data.username]: data.emoji
                    }
                  };
                }
                return m;
              })
            );
            break;
          }

          case 'call_signal': {
            const { signalType, from, callType, payload, callId, sender } = data;
            const callerName = from || sender;

            if (signalType === 'call_request') {
              // Incoming call prompt
              currentCallIdRef.current = callId || `call_${Date.now()}`;
              setActiveCall({
                targetUser: callerName,
                callType: callType || 'voice',
                isIncoming: true,
                status: 'ringing'
              });
            } else if (signalType === 'call_accepted') {
              // Remote peer accepted call
              setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));
              fetchCallLogs(user.username);
              // As caller, initiate WebRTC offer now that peer has answered
              setTimeout(async () => {
                const offer = await webrtcManager.createOffer();
                if (offer && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'call_signal',
                    sender: user.username,
                    targetUser: callerName,
                    signalType: 'webrtc_offer',
                    payload: { offer }
                  }));
                }
              }, 250);
            } else if (signalType === 'call_rejected') {
              soundManager.stopRingback();
              soundManager.playCallEnd();
              webrtcManager.cleanup();
              setActiveCall(null);
              currentCallIdRef.current = null;
              fetchCallLogs(user.username);
              alert(`${callerName} zəngi rədd etdi.`);
            } else if (signalType === 'call_ended') {
              soundManager.stopRinging();
              soundManager.stopRingback();
              soundManager.playCallEnd();
              webrtcManager.cleanup();
              setActiveCall(null);
              currentCallIdRef.current = null;
              fetchCallLogs(user.username);
            } else if (signalType === 'webrtc_offer') {
              if (payload?.offer) {
                const answer = await webrtcManager.handleOffer(payload.offer);
                if (answer && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'call_signal',
                    sender: user.username,
                    targetUser: callerName,
                    signalType: 'webrtc_answer',
                    payload: { answer }
                  }));
                }
              }
            } else if (signalType === 'webrtc_answer') {
              if (payload?.answer) {
                await webrtcManager.handleAnswer(payload.answer);
              }
            } else if (signalType === 'webrtc_ice') {
              if (payload?.candidate) {
                await webrtcManager.addIceCandidate(payload.candidate);
              }
            }
            break;
          }

          case 'call_log_updated': {
            fetchCallLogs(user.username);
            break;
          }

          case 'blocked_by_admin': {
            alert('Hesabınız admin tərəfindən bloklandı.');
            handleLogout();
            break;
          }

          case 'all_messages_cleared': {
            setMessages([]);
            fetchConversations(user.username);
            break;
          }

          case 'conversation_deleted': {
            fetchConversations(user.username);
            if (activeChatUser && data.peer && activeChatUser.toLowerCase() === data.peer.toLowerCase()) {
              setMessages([]);
              setActiveChatUser(null);
            }
            break;
          }

          case 'message_deleted': {
            setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
            fetchConversations(user.username);
            break;
          }

          case 'profile_updated': {
            // Live update conversation partner's avatar and status
            setConversations((prev) =>
              prev.map((c) =>
                c.user.toLowerCase() === data.username.toLowerCase()
                  ? { ...c, avatar: data.avatar, statusMessage: data.statusMessage }
                  : c
              )
            );
            // If it's current user's profile, update current user state
            setCurrentUser((prev) => {
              if (prev && prev.username.toLowerCase() === data.username.toLowerCase()) {
                const updated = { ...prev, avatar: data.avatar, statusMessage: data.statusMessage };
                localStorage.setItem('khami_user', JSON.stringify(updated));
                return updated;
              }
              return prev;
            });
            break;
          }
        }
      } catch (err) {
        console.warn('WS message parse error:', err);
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      // Auto-reconnect after 2 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        if (currentUser) {
          connectWebSocket(currentUser);
        }
      }, 2000);
    };
  }, [currentUser, fetchConversations]);

  // Connect WebSocket and fetch conversations on user login
  useEffect(() => {
    if (currentUser) {
      connectWebSocket(currentUser);
      fetchConversations(currentUser.username);
    }
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [currentUser, connectWebSocket, fetchConversations]);

  // Fetch messages when activeChatUser changes
  useEffect(() => {
    if (currentUser && activeChatUser) {
      fetchMessages(currentUser.username, activeChatUser);
    }
  }, [currentUser, activeChatUser, fetchMessages]);

  // Fetch partner profile (avatar, status, lastSeen) when activeChatUser changes
  useEffect(() => {
    if (!activeChatUser) {
      setPartnerProfile({});
      setActiveGroupData(null);
      return;
    }

    if (activeChatUser.startsWith('group_')) {
      const currentConv = conversations.find(
        (c) => c.user.toLowerCase() === activeChatUser.toLowerCase()
      );
      if (currentConv?.groupData) {
        setActiveGroupData(currentConv.groupData);
        setPartnerProfile({
          avatar: currentConv.groupData.avatar,
          statusMessage: `${currentConv.groupData.members.length} üzv`
        });
      }
      return;
    } else {
      setActiveGroupData(null);
    }

    const currentConv = conversations.find(
      (c) => c.user.toLowerCase() === activeChatUser.toLowerCase()
    );
    if (currentConv) {
      setPartnerProfile((prev) => ({
        ...prev,
        avatar: currentConv.avatar,
        statusMessage: currentConv.statusMessage
      }));
    }

    fetch(`/api/user/${encodeURIComponent(activeChatUser)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setPartnerProfile({
            avatar: data.user.avatar,
            statusMessage: data.user.statusMessage,
            lastSeen: data.user.lastSeen
          });
        }
      })
      .catch(() => {});
  }, [activeChatUser, conversations]);

  // Dynamic Document Title with Unread Count Badge (e.g. "(2) necəsən")
  useEffect(() => {
    const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) necəsən - Mesaj Platforması`;
    } else {
      document.title = 'necəsən - Mesaj Platforması';
    }
  }, [conversations]);

  // Automatically request Notification permission on phone and desktop
  useEffect(() => {
    if (!currentUser || typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'default') return;

    const requestPerm = () => {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    };

    // Attempt direct request immediately
    try {
      Notification.requestPermission().catch(() => {});
    } catch {}

    // Attach to first user gesture (touch/click) for strict mobile browsers
    window.addEventListener('touchstart', requestPerm, { once: true });
    window.addEventListener('click', requestPerm, { once: true });

    return () => {
      window.removeEventListener('touchstart', requestPerm);
      window.removeEventListener('click', requestPerm);
    };
  }, [currentUser]);

  // Handle Login or Registration Success
  const handleAuthSuccess = (user: User) => {
    activeChatTokenRef.current++;
    conversationsTokenRef.current++;
    activeChatUserRef.current = null;
    currentUserRef.current = user;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    setActiveChatUser(null);
    setMessages([]);
    setConversations([]);
    setCallLogs([]);
    setPartnerProfile({});
    setActiveCall(null);
    setCurrentUser(user);
    try {
      localStorage.setItem('khami_user', JSON.stringify(user));
    } catch {}
  };

  // Handle Logout
  const handleLogout = () => {
    activeChatTokenRef.current++;
    conversationsTokenRef.current++;
    activeChatUserRef.current = null;
    currentUserRef.current = null;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    setCurrentUser(null);
    setActiveChatUser(null);
    setMessages([]);
    setConversations([]);
    setCallLogs([]);
    setPartnerProfile({});
    setActiveCall(null);
    try {
      localStorage.removeItem('khami_user');
      sessionStorage.clear();
    } catch {}
  };

  // Send Message
  const handleSendMessage = (
    content: string,
    type: 'text' | 'image' | 'video' | 'audio' | 'file' = 'text',
    mediaUrl?: string,
    duration?: number
  ) => {
    if (!currentUser || !activeChatUser) return;
    const currentPeer = activeChatUser;
    const currentSender = currentUser.username;
    soundManager.playMessageSent();

    const isGroup = currentPeer.startsWith('group_');

    const tempMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sender: currentSender,
      recipient: currentPeer,
      isGroup,
      groupId: isGroup ? currentPeer : undefined,
      type,
      content,
      mediaUrl,
      duration,
      timestamp: Date.now(),
      status: 'sent'
    };

    // Optimistically append to message list ONLY if user is still on this conversation
    setMessages((prev) => {
      if (activeChatUserRef.current?.toLowerCase() !== currentPeer.toLowerCase()) {
        return prev;
      }
      return [...prev, tempMessage];
    });

    // Also update conversations lastMessage immediately so sidebar reflects it
    setConversations((prev) => {
      const peerKey = currentPeer.toLowerCase();
      const existing = prev.find((c) => c.user.toLowerCase() === peerKey);
      if (existing) {
        return prev.map((c) =>
          c.user.toLowerCase() === peerKey
            ? { ...c, lastMessage: tempMessage }
            : c
        );
      } else {
        return [
          {
            user: currentPeer,
            name: isGroup ? activeGroupData?.name : undefined,
            isGroup,
            groupData: activeGroupData || undefined,
            avatar: isGroup ? activeGroupData?.avatar : partnerProfile.avatar,
            statusMessage: isGroup ? `${activeGroupData?.members.length || 0} üzv` : partnerProfile.statusMessage,
            lastMessage: tempMessage,
            unreadCount: 0
          },
          ...prev
        ];
      }
    });

    // 1. Send via WebSocket if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'send_message',
        message: tempMessage
      }));
    }

    // 2. Also send via HTTP POST /api/messages for guaranteed database persistence
    fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: tempMessage })
    }).catch(() => {});
  };

  // Emit live typing or audio recording state
  const handleEmitTyping = useCallback((status: 'typing' | 'recording' | 'stopped') => {
    if (!currentUser || !activeChatUser) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const isGroup = activeChatUser.startsWith('group_');
      wsRef.current.send(JSON.stringify({
        type: 'typing_indicator',
        sender: currentUser.username,
        target: activeChatUser,
        status,
        isGroup
      }));
    }
  }, [currentUser, activeChatUser]);

  // React to Message
  const handleReactMessage = (messageId: string, emoji: string) => {
    if (!currentUser || !activeChatUser) return;

    // Optimistically update local message reaction
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === messageId) {
          return {
            ...m,
            reactions: {
              ...(m.reactions || {}),
              [currentUser.username]: emoji
            }
          };
        }
        return m;
      })
    );

    // Send reaction via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'react_message',
        messageId,
        username: currentUser.username,
        targetUser: activeChatUser,
        emoji
      }));
    }
  };

  // Delete Conversation
  const handleDeleteConversation = async (targetUser: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/conversation/${encodeURIComponent(currentUser.username)}/${encodeURIComponent(targetUser)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.user.toLowerCase() !== targetUser.toLowerCase()));
        if (activeChatUser?.toLowerCase() === targetUser.toLowerCase()) {
          setActiveChatUser(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.warn('Failed to delete conversation:', err);
    }
  };

  // Delete Individual Message
  const handleDeleteMessage = async (messageId: string) => {
    try {
      const res = await fetch(`/api/message/${encodeURIComponent(messageId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        if (currentUser) {
          fetchConversations(currentUser.username);
        }
      }
    } catch (err) {
      console.warn('Failed to delete message:', err);
    }
  };

  // Select active chat handler with clean message isolation
  const handleSelectChat = (userToSelect: string | null) => {
    activeChatTokenRef.current++;
    if (!userToSelect) {
      activeChatUserRef.current = null;
      setActiveChatUser(null);
      setMessages([]);
      return;
    }
    if (activeChatUser?.toLowerCase() === userToSelect.toLowerCase()) return;
    activeChatUserRef.current = userToSelect;
    setMessages([]); // immediately wipe messages to eliminate any cross-mixing
    setActiveChatUser(userToSelect);
    if (currentUser) {
      fetchConversations(currentUser.username);
    }
  };

  // Start Voice or Video Call
  const handleStartCall = (callType: 'voice' | 'video', targetUserOverride?: string) => {
    const target = targetUserOverride || activeChatUser;
    if (!currentUser || !target) return;

    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    currentCallIdRef.current = callId;

    setActiveCall({
      targetUser: target,
      callType,
      isIncoming: false,
      status: 'calling'
    });

    // Save call log initiated
    fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: callId,
        caller: currentUser.username,
        recipient: target,
        callType,
        status: 'missed',
        duration: 0,
        timestamp: Date.now()
      })
    }).catch(() => {});

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'call_signal',
        sender: currentUser.username,
        targetUser: target,
        callType,
        signalType: 'call_request',
        callId
      }));
    }
  };

  // Accept Incoming Call
  const handleAcceptCall = () => {
    if (!currentUser || !activeCall) return;

    setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));

    if (currentCallIdRef.current) {
      fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentCallIdRef.current,
          caller: activeCall.isIncoming ? activeCall.targetUser : currentUser.username,
          recipient: activeCall.isIncoming ? currentUser.username : activeCall.targetUser,
          callType: activeCall.callType,
          status: 'completed',
          duration: 0,
          timestamp: Date.now()
        })
      }).catch(() => {});
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'call_signal',
        sender: currentUser.username,
        targetUser: activeCall.targetUser,
        signalType: 'call_accepted',
        callId: currentCallIdRef.current
      }));
    }
  };

  // Decline Incoming Call
  const handleDeclineCall = () => {
    if (!currentUser || !activeCall) return;

    if (currentCallIdRef.current) {
      fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentCallIdRef.current,
          caller: activeCall.targetUser,
          recipient: currentUser.username,
          callType: activeCall.callType,
          status: 'declined',
          duration: 0,
          timestamp: Date.now()
        })
      }).catch(() => {});
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'call_signal',
        sender: currentUser.username,
        targetUser: activeCall.targetUser,
        signalType: 'call_rejected',
        callId: currentCallIdRef.current
      }));
    }
    soundManager.stopRinging();
    setActiveCall(null);
    currentCallIdRef.current = null;
    fetchCallLogs(currentUser.username);
  };

  // End Active Call
  const handleEndCall = (duration?: number) => {
    if (!currentUser || !activeCall) return;

    if (currentCallIdRef.current) {
      const isConnected = activeCall.status === 'connected';
      fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentCallIdRef.current,
          caller: activeCall.isIncoming ? activeCall.targetUser : currentUser.username,
          recipient: activeCall.isIncoming ? currentUser.username : activeCall.targetUser,
          callType: activeCall.callType,
          status: isConnected ? 'completed' : (activeCall.isIncoming ? 'missed' : 'declined'),
          duration: duration || 0,
          timestamp: Date.now()
        })
      }).catch(() => {});
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'call_signal',
        sender: currentUser.username,
        targetUser: activeCall.targetUser,
        signalType: 'call_ended',
        callDuration: duration || 0,
        callId: currentCallIdRef.current
      }));
    }
    soundManager.stopRinging();
    soundManager.stopRingback();
    soundManager.playCallEnd();
    setActiveCall(null);
    currentCallIdRef.current = null;
    fetchCallLogs(currentUser.username);
  };

  // Send WebRTC Signaling payload
  const handleSendCallSignal = (signalType: string, payload?: any) => {
    if (!currentUser || !activeCall) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'call_signal',
        sender: currentUser.username,
        targetUser: activeCall.targetUser,
        signalType,
        payload
      }));
    }
  };

  // 1. Splash Screen
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  // 2. Authentication Screen if not logged in
  if (!currentUser) {
    return <AuthScreen onSuccess={handleAuthSuccess} />;
  }

  // 3. Main Messenger Dashboard Layout
  return (
    <div id="khami-messenger-app" className="h-full w-full flex bg-[#08080b] text-[#e4e4e7] overflow-hidden select-none">
      {/* Sidebar: hidden on mobile when a chat is open */}
      <div className={`h-full shrink-0 ${activeChatUser ? 'hidden md:flex md:w-80 lg:w-96' : 'flex w-full md:w-80 lg:w-96'}`}>
        <Sidebar
          currentUser={currentUser}
          conversations={conversations}
          activeChatUser={activeChatUser}
          onlineUsers={onlineUsers}
          callLogs={callLogs}
          activeTab={sidebarTab}
          onChangeTab={setSidebarTab}
          onSelectChat={(user) => handleSelectChat(user)}
          onOpenNewChat={() => setIsNewChatOpen(true)}
          onOpenNewGroup={() => {
            if (currentUser.username.toLowerCase() === 'khabib') {
              setIsNewGroupOpen(true);
            }
          }}
          onOpenAdmin={() => setIsAdminOpen(true)}
          onOpenProfile={() => setIsProfileOpen(true)}
          onLogout={handleLogout}
          onDeleteConversation={handleDeleteConversation}
          onStartCall={(targetUser, callType) => handleStartCall(callType, targetUser)}
          onDeleteCallLog={handleDeleteCallLog}
          onClearAllCallLogs={handleClearAllCallLogs}
          onOpenNewCallModal={() => setIsNewCallOpen(true)}
        />
      </div>

      {/* Main Chat Viewport */}
      <div className={`flex-1 h-full min-w-0 flex flex-col ${!activeChatUser ? 'hidden md:flex' : 'flex w-full md:w-auto'}`}>
        {activeChatUser ? (
          <ChatWindow
            currentUser={currentUser}
            activeChatUser={activeChatUser}
            isGroup={activeChatUser.startsWith('group_')}
            groupData={activeGroupData}
            targetUserAvatar={partnerProfile.avatar}
            targetUserStatus={partnerProfile.statusMessage}
            targetLastSeen={partnerProfile.lastSeen}
            messages={messages}
            isTargetOnline={onlineUsers.includes(activeChatUser.toLowerCase())}
            typingState={activeChatUser ? typingMap[activeChatUser.toLowerCase()] || null : null}
            onEmitTyping={handleEmitTyping}
            onSendMessage={handleSendMessage}
            onReactMessage={handleReactMessage}
            onStartCall={handleStartCall}
            onBackToList={() => handleSelectChat(null)}
            onOpenMediaLightbox={(url, type) => setLightboxMedia({ url, type })}
            onDeleteConversation={() => handleDeleteConversation(activeChatUser)}
            onDeleteMessage={handleDeleteMessage}
            onOpenGroupInfo={() => setIsGroupInfoOpen(true)}
          />
        ) : (
          /* Empty Chat Splash Placeholder */
          <div className="flex-1 h-full hidden md:flex flex-col items-center justify-center p-8 text-center bg-[#0e0f14] select-none border-l border-zinc-800/80">
            <div className="mb-6 opacity-30">
              <KhamiLogo className="w-24 h-24" strokeWidth={4} />
            </div>
            <h3 className="text-xl font-bold font-montserrat tracking-widest text-white uppercase mb-2">
              Khami Mesaj Platforması
            </h3>
            <p className="text-xs text-zinc-500 font-mono-tech max-w-sm leading-relaxed mb-6">
              Söhbət seçin və ya yuxarıdakı <strong className="text-white">+</strong> düyməsinə klikləyərək yeni təhlükəsiz söhbət başladın
            </p>
            <button
              onClick={() => setIsNewChatOpen(true)}
              className="px-5 py-2.5 rounded-lg neon-btn-green font-mono-tech text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Yeni Söhbət Başlat
            </button>
          </div>
        )}
      </div>

      {/* Call Modal for Voice and Video */}
      {activeCall && (
        <CallModal
          currentUser={currentUser.username}
          activeCall={activeCall}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
          onEndCall={handleEndCall}
          onSendSignal={handleSendCallSignal}
        />
      )}

      {/* New Chat Modal */}
      <NewChatModal
        currentUser={currentUser.username}
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onSelectUser={(user) => {
          handleSelectChat(user);
        }}
      />

      {/* New Group Modal (WhatsApp style) */}
      <NewGroupModal
        currentUser={currentUser.username}
        isOpen={isNewGroupOpen}
        onClose={() => setIsNewGroupOpen(false)}
        onGroupCreated={(group) => {
          handleSelectChat(group.id);
          setActiveGroupData(group);
          fetchConversations(currentUser.username);
        }}
      />

      {/* Group Info Modal (WhatsApp style) */}
      <GroupInfoModal
        currentUser={currentUser.username}
        isOpen={isGroupInfoOpen}
        group={activeGroupData}
        onClose={() => setIsGroupInfoOpen(false)}
        onUpdateGroup={(updatedGroup) => {
          setActiveGroupData(updatedGroup);
          fetchConversations(currentUser.username);
        }}
        onLeaveGroup={(groupId) => {
          handleSelectChat(null);
          setActiveGroupData(null);
          fetchConversations(currentUser.username);
        }}
      />

      {/* New Call Modal */}
      <NewCallModal
        currentUser={currentUser.username}
        isOpen={isNewCallOpen}
        conversations={conversations}
        onClose={() => setIsNewCallOpen(false)}
        onStartCall={(targetUser, callType) => {
          handleStartCall(callType, targetUser);
        }}
      />

      {/* Admin Panel Modal */}
      <AdminModal
        currentUser={currentUser.username}
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onOpenChat={(targetUsername) => {
          handleSelectChat(targetUsername);
        }}
      />

      {/* Profile Settings Modal */}
      {isProfileOpen && (
        <ProfileModal
          currentUser={currentUser}
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          onLogout={handleLogout}
          onUpdateProfile={(updatedUser) => {
            setCurrentUser(updatedUser);
            try {
              localStorage.setItem('khami_user', JSON.stringify(updatedUser));
            } catch {}
            fetchConversations(updatedUser.username);
          }}
        />
      )}

      {/* Media Lightbox Viewer */}
      <MediaLightbox
        mediaUrl={lightboxMedia?.url || null}
        mediaType={lightboxMedia?.type || null}
        onClose={() => setLightboxMedia(null)}
      />
    </div>
  );
}
