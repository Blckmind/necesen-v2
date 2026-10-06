import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Shield, 
  LogOut, 
  CheckCheck, 
  Check, 
  Trash2, 
  MessageSquarePlus,
  Camera,
  MessageSquare,
  Phone,
  Users,
  Mic
} from 'lucide-react';
import { Conversation, User, CallLog } from '../types';
import { CallLogsList } from './CallLogsList';

interface SidebarProps {
  currentUser: User;
  conversations: Conversation[];
  activeChatUser: string | null;
  onlineUsers: string[];
  callLogs: CallLog[];
  activeTab?: 'chats' | 'calls';
  onChangeTab?: (tab: 'chats' | 'calls') => void;
  onSelectChat: (username: string) => void;
  onOpenNewChat: () => void;
  onOpenNewGroup: () => void;
  onOpenAdmin: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  onDeleteConversation: (username: string) => void;
  onStartCall: (targetUser: string, callType: 'voice' | 'video') => void;
  onDeleteCallLog: (callId: string) => void;
  onClearAllCallLogs: () => void;
  onOpenNewCallModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  conversations,
  activeChatUser,
  onlineUsers,
  callLogs,
  activeTab: externalTab,
  onChangeTab,
  onSelectChat,
  onOpenNewChat,
  onOpenNewGroup,
  onOpenAdmin,
  onOpenProfile,
  onLogout,
  onDeleteConversation,
  onStartCall,
  onDeleteCallLog,
  onClearAllCallLogs,
  onOpenNewCallModal
}) => {
  const [internalTab, setInternalTab] = useState<'chats' | 'calls'>('chats');
  const activeTab = externalTab || internalTab;

  const handleSetTab = (tab: 'chats' | 'calls') => {
    setInternalTab(tab);
    onChangeTab?.(tab);
  };

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [convToDelete, setConvToDelete] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const isAdmin = currentUser.username.toLowerCase() === 'khabib';

  // Filter conversations
  const filtered = conversations.filter((c) =>
    c.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.lastMessage.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unreadTotal = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const hasMissedCalls = callLogs.some(
    (c) => (c.status === 'missed' || c.status === 'declined') && c.caller.toLowerCase() !== currentUser.username.toLowerCase()
  );

  const formatTimestamp = (time: number) => {
    const d = new Date(time);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('az-AZ', { month: 'short', day: 'numeric' });
  };

  // Horizontal swipe gestures to switch between Chats and Calls tabs
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (diff > 50) {
      // Swiped left -> go to Calls
      handleSetTab('calls');
    } else if (diff < -50) {
      // Swiped right -> go to Chats
      handleSetTab('chats');
    }
    setTouchStartX(null);
  };

  return (
    <aside
      id="sidebar-container"
      className="w-full md:w-80 lg:w-96 h-full bg-[#111217] border-r border-zinc-800/80 flex flex-col select-none shrink-0 overflow-hidden"
    >
      {/* 1. TOP BRAND & PROFILE HEADER */}
      <div className="h-16 px-4 bg-[#14151d] border-b border-zinc-800/80 flex items-center justify-between shrink-0">
        <div 
          onClick={onOpenProfile}
          className="flex items-center gap-2.5 cursor-pointer group py-1"
          title="Profil şəkli və statusu dəyiş"
        >
          {/* User Profile Avatar with Camera badge on hover */}
          <div className="relative shrink-0">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.username}
                className="w-9 h-9 rounded-full object-cover border-2 border-[#00ff66]/60 group-hover:border-[#00ff66] transition-all shadow-[0_0_10px_rgba(0,255,102,0.2)]"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-zinc-800 border-2 border-zinc-700 group-hover:border-[#00ff66] flex items-center justify-center font-bold text-xs text-white uppercase transition-colors">
                {currentUser.username.slice(0, 2)}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#00ff66] border-2 border-[#14151d]" />
            <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Camera className="w-3.5 h-3.5 text-[#00ff66]" />
            </div>
          </div>

          <div className="flex flex-col">
            <span className="font-montserrat font-bold text-xs tracking-wider text-white uppercase flex items-center gap-1 group-hover:text-[#00ff66] transition-colors">
              {currentUser.username}
              {isAdmin && (
                <span className="text-[9px] px-1 py-0.2 bg-emerald-950 text-[#00ff66] border border-emerald-800 rounded font-mono-tech">
                  ADMIN
                </span>
              )}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono-tech truncate max-w-[110px]">
              {currentUser.statusMessage || 'Profil şəkli qoy'}
            </span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          {/* Admin panel button if khabib */}
          {isAdmin && (
            <button
              id="sidebar-admin-panel-btn"
              type="button"
              onClick={onOpenAdmin}
              className="p-2 rounded-lg bg-zinc-900 border border-emerald-700/60 text-[#00ff66] hover:bg-emerald-950/60 transition-colors cursor-pointer"
              title="Admin Paneli (khabib)"
            >
              <Shield className="w-4 h-4" />
            </button>
          )}

          {/* New Group Button (Only for khabib admin) */}
          {isAdmin && (
            <button
              id="sidebar-new-group-btn"
              type="button"
              onClick={onOpenNewGroup}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-700/80 text-emerald-400 hover:text-white hover:border-emerald-500 hover:bg-emerald-950/40 transition-colors cursor-pointer"
              title="Yeni Qrup Yarat (Yalnız Admin)"
            >
              <Users className="w-4 h-4" />
            </button>
          )}

          {/* New Chat Button */}
          <button
            id="sidebar-new-chat-btn"
            type="button"
            onClick={onOpenNewChat}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-700/80 text-zinc-300 hover:text-white hover:border-[#00ff66] transition-colors cursor-pointer"
            title="Yeni Söhbət Başlat"
          >
            <Plus className="w-4 h-4 text-[#00ff66]" />
          </button>
        </div>
      </div>

      {/* 2. SLIDING CONTENT AREA (SWIPABLE CHATS & CALLS PAGES) */}
      <div 
        className="flex-1 flex w-[200%] transition-transform duration-300 ease-out h-full overflow-hidden"
        style={{ transform: activeTab === 'chats' ? 'translateX(0%)' : 'translateX(-50%)' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* PAGE 1: CHATS LIST */}
        <div className="w-1/2 h-full flex flex-col overflow-hidden bg-[#111217]">
          {/* Search Conversations */}
          <div className="p-3 border-b border-zinc-800/80 bg-[#12131a]">
            <div className="relative">
              <input
                id="sidebar-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Söhbət axtar..."
                className="w-full h-9 pl-9 pr-4 rounded-xl bg-[#1b1c24] border border-zinc-700/80 text-xs font-mono-tech text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-all"
              />
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Conversations List */}
          <div 
            id="sidebar-conversations-list"
            className="flex-1 overflow-y-auto divide-y divide-zinc-800/40"
          >
            {filtered.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-zinc-500">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
                  <MessageSquarePlus className="w-6 h-6 text-[#00ff66]" />
                </div>
                <p className="text-xs font-mono-tech text-zinc-300 font-bold mb-1">
                  Söhbət tapılmadı
                </p>
                <p className="text-[11px] font-mono-tech text-zinc-500 max-w-[200px] mb-4">
                  Yeni şəxslə yazışmaq üçün yuxarıdakı + düyməsinə klikləyin.
                </p>
                <button
                  onClick={onOpenNewChat}
                  className="px-4 py-2 rounded-lg neon-btn-green text-xs font-mono-tech font-bold uppercase cursor-pointer"
                >
                  Yeni Söhbət
                </button>
              </div>
            ) : (
              filtered.map((conv) => {
                const isSelected = activeChatUser?.toLowerCase() === conv.user.toLowerCase();
                const isOnline = onlineUsers.includes(conv.user.toLowerCase());
                const isSender = conv.lastMessage.sender.toLowerCase() === currentUser.username.toLowerCase();

                return (
                  <div
                    key={conv.user}
                    id={`conversation-item-${conv.user}`}
                    onClick={() => onSelectChat(conv.user)}
                    className={`flex items-center justify-between p-3.5 hover:bg-[#181922] transition-colors cursor-pointer relative group ${
                      isSelected ? 'bg-[#1a1b26] border-l-3 border-[#00ff66]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {/* User or Group Avatar with Online status */}
                      <div className="relative shrink-0">
                        {conv.isGroup ? (
                          conv.avatar ? (
                            <img
                              src={conv.avatar}
                              alt={conv.name || conv.user}
                              className="w-12 h-12 rounded-full object-cover border border-emerald-500/50 shadow-sm"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-emerald-950/70 border border-emerald-500/40 flex items-center justify-center font-sans font-bold text-emerald-400 text-base shadow-sm">
                              <Users className="w-6 h-6" />
                            </div>
                          )
                        ) : conv.avatar ? (
                          <img
                            src={conv.avatar}
                            alt={conv.user}
                            className="w-12 h-12 rounded-full object-cover border border-zinc-700 shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-sans font-bold text-white text-base uppercase">
                            {conv.user.slice(0, 2)}
                          </div>
                        )}
                        {!conv.isGroup && isOnline && (
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#00ff66] border-2 border-[#111217]" />
                        )}
                      </div>

                      {/* Name and Last Message Snippet */}
                      <div className="truncate">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-sans font-bold text-sm text-white truncate flex items-center gap-1.5">
                            {conv.isGroup && (
                              <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            )}
                            <span className="truncate">{conv.name || conv.user}</span>
                            {!conv.isGroup && conv.user.toLowerCase() === 'khabib' && (
                              <span className="px-1 py-0.2 rounded text-[9px] bg-emerald-950 text-[#00ff66] border border-emerald-800 font-mono-tech">
                                ADMIN
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-zinc-400 font-sans truncate">
                          {conv.typingStatus ? (
                            conv.typingStatus === 'recording' ? (
                              <span className="text-[#00ff66] font-semibold flex items-center gap-1.5 truncate">
                                <Mic className="w-3.5 h-3.5 animate-pulse text-[#00ff66] shrink-0" />
                                <span className="truncate">{conv.isGroup && conv.typingUser ? `${conv.typingUser} səs yazır...` : 'səs yazır...'}</span>
                              </span>
                            ) : (
                              <span className="text-[#00ff66] font-semibold flex items-center gap-1.5 truncate">
                                <span className="truncate">{conv.isGroup && conv.typingUser ? `${conv.typingUser} yazır` : 'yazır'}</span>
                                <span className="inline-flex gap-0.5 items-center shrink-0">
                                  <span className="w-1 h-1 rounded-full bg-[#00ff66] animate-bounce [animation-delay:-0.3s]" />
                                  <span className="w-1 h-1 rounded-full bg-[#00ff66] animate-bounce [animation-delay:-0.15s]" />
                                  <span className="w-1 h-1 rounded-full bg-[#00ff66] animate-bounce" />
                                </span>
                              </span>
                            )
                          ) : (
                            <>
                              {isSender && !conv.isGroup && (
                                <span className="shrink-0">
                                  {conv.lastMessage.status === 'read' ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                                  ) : conv.lastMessage.status === 'delivered' ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-zinc-400" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 text-zinc-400" />
                                  )}
                                </span>
                              )}
                              <span className="truncate">
                                {conv.isGroup && !conv.lastMessage.isSystem && (
                                  <strong className="text-zinc-300 font-semibold mr-1">
                                    {isSender ? 'Siz:' : `${conv.lastMessage.sender}:`}
                                  </strong>
                                )}
                                {conv.lastMessage.content}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right timestamp & WhatsApp-style Green Circle Unread badge */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                      <span className={`text-[11px] font-sans ${conv.unreadCount > 0 ? 'text-[#00ff66] font-semibold' : 'text-zinc-400'}`}>
                        {formatTimestamp(conv.lastMessage.timestamp)}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span 
                          id={`unread-badge-${conv.user}`}
                          className="min-w-5 h-5 px-1.5 rounded-full bg-[#00ff66] text-black text-[11px] font-bold font-mono-tech flex items-center justify-center leading-none shadow-[0_0_10px_rgba(0,255,102,0.5)] animate-in zoom-in-75 duration-200"
                        >
                          {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PAGE 2: CALL LOGS (ZƏNGLƏR) */}
        <div className="w-1/2 h-full flex flex-col overflow-hidden bg-[#111217]">
          <CallLogsList
            currentUser={currentUser}
            callLogs={callLogs}
            onStartCall={onStartCall}
            onDeleteCallLog={onDeleteCallLog}
            onClearAllCallLogs={onClearAllCallLogs}
            onOpenNewCallModal={onOpenNewCallModal}
          />
        </div>
      </div>

      {/* 3. WHATSAPP STYLE BOTTOM NAVIGATION: MESAJLAR / ZƏNGLƏR */}
      <div 
        id="sidebar-bottom-tabs"
        className="border-t border-zinc-800/80 bg-[#14151d] p-2 flex items-center justify-around gap-2 shrink-0 z-10 select-none shadow-[0_-4px_16px_rgba(0,0,0,0.3)]"
      >
        <button
          id="tab-messages-btn"
          type="button"
          onClick={() => handleSetTab('chats')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-montserrat text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'chats'
              ? 'bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/40 shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30 border border-transparent'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
            {unreadTotal > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full text-[9px] bg-[#00ff66] text-black font-bold font-mono-tech leading-none">
                {unreadTotal}
              </span>
            )}
          </div>
          <span>Mesajlar</span>
        </button>

        <button
          id="tab-calls-btn"
          type="button"
          onClick={() => handleSetTab('calls')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-montserrat text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'calls'
              ? 'bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/40 shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30 border border-transparent'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <Phone className="w-4 h-4" />
            {callLogs.length > 0 && (
              <span className={`absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full text-[9px] font-bold font-mono-tech leading-none ${
                hasMissedCalls ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-300'
              }`}>
                {callLogs.length}
              </span>
            )}
          </div>
          <span>Zənglər</span>
        </button>
      </div>

      {/* Delete Conversation Confirmation Modal */}
      {convToDelete && (
        <div 
          id="delete-conv-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          onClick={() => setConvToDelete(null)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl bg-[#14151e] border border-zinc-800 p-6 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-4 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white font-montserrat mb-2">
              Yazışmanı silmək istəyirsiniz?
            </h3>
            <p className="text-xs text-zinc-400 font-sans leading-relaxed mb-6">
              <span className="text-white font-semibold font-mono-tech">"{convToDelete}"</span> ilə olan bütün mesajlar və yazışma tarixçəsi silinəcək. Bu əməliyyat geri qaytarılmır.
            </p>
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setConvToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-mono-tech font-bold text-zinc-300 transition-colors cursor-pointer"
              >
                Ləğv et
              </button>
              <button
                id="confirm-delete-conv-btn"
                type="button"
                onClick={() => {
                  if (convToDelete) {
                    onDeleteConversation(convToDelete);
                    setConvToDelete(null);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-mono-tech font-bold text-white transition-colors cursor-pointer shadow-lg shadow-red-600/30"
              >
                Bəli, sil
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
