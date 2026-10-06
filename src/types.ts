export type MediaType = 'text' | 'image' | 'video' | 'audio' | 'file';
export type MessageStatus = 'sent' | 'delivered' | 'seen' | 'read';

export interface GroupChat {
  id: string; // e.g. "group_123456"
  name: string;
  avatar?: string;
  description?: string;
  createdBy: string;
  createdAt: number;
  admins: string[];
  members: string[]; // list of usernames
}

export interface Message {
  id: string;
  sender: string;
  recipient: string;
  content: string;
  text?: string;
  type: MediaType;
  mediaType?: MediaType;
  mediaUrl?: string;
  mediaName?: string;
  duration?: number; // for audio/voice notes in seconds
  timestamp: number;
  status: MessageStatus;
  reactions?: Record<string, string>; // username -> emoji
  isGroup?: boolean;
  groupId?: string;
  senderAvatar?: string;
  isSystem?: boolean;
  readBy?: string[];
}

export interface User {
  id: string;
  username: string;
  avatar?: string;
  statusMessage?: string;
  isBlocked: boolean;
  isAdmin: boolean;
  createdAt: number;
  lastSeen?: number;
  isOnline?: boolean;
}

export interface Conversation {
  user: string;
  username?: string;
  name?: string; // custom display name (for group)
  isGroup?: boolean;
  groupData?: GroupChat;
  avatar?: string;
  statusMessage?: string;
  lastMessage: Message;
  unreadCount: number;
  isOnline?: boolean;
  isTyping?: boolean;
  typingUser?: string;
  typingStatus?: 'typing' | 'recording';
  isBlocked?: boolean;
}

export interface CallSignalPayload {
  type: 'call_init' | 'call_ringing' | 'call_accept' | 'call_decline' | 'call_end' | 'webrtc_offer' | 'webrtc_answer' | 'webrtc_ice';
  from: string;
  to: string;
  callType: 'voice' | 'video' | 'audio';
  sdp?: any;
  candidate?: any;
  reason?: string;
}

export interface ActiveCall {
  targetUser: string;
  callType: 'voice' | 'video' | 'audio';
  isIncoming: boolean;
  status: 'calling' | 'ringing' | 'connected' | 'ended';
  startedAt?: number;
}

export interface CallLog {
  id: string;
  caller: string;
  recipient: string;
  callType: 'voice' | 'video';
  status: 'completed' | 'missed' | 'declined';
  duration?: number; // duration in seconds
  timestamp: number;
}

