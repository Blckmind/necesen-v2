import React, { useState } from 'react';
import { 
  Phone, 
  Video, 
  PhoneMissed, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Trash2, 
  Search, 
  PhoneCall, 
  UserPlus,
  Clock
} from 'lucide-react';
import { CallLog, User } from '../types';

interface CallLogsListProps {
  currentUser: User;
  callLogs: CallLog[];
  onStartCall: (targetUser: string, callType: 'voice' | 'video') => void;
  onDeleteCallLog: (callId: string) => void;
  onClearAllCallLogs: () => void;
  onOpenNewCallModal: () => void;
}

export const CallLogsList: React.FC<CallLogsListProps> = ({
  currentUser,
  callLogs,
  onStartCall,
  onDeleteCallLog,
  onClearAllCallLogs,
  onOpenNewCallModal
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [callToDelete, setCallToDelete] = useState<string | null>(null);

  const filteredLogs = callLogs.filter((log) => {
    const peer = log.caller.toLowerCase() === currentUser.username.toLowerCase()
      ? log.recipient
      : log.caller;
    return peer.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const formatCallTime = (time: number) => {
    const d = new Date(time);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const timeStr = d.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Bugün, ${timeStr}`;
    }
    if (isYesterday) {
      return `Dünən, ${timeStr}`;
    }
    return `${d.toLocaleDateString('az-AZ', { day: 'numeric', month: 'short' })}, ${timeStr}`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `(${secs} san)`;
    return `(${mins} dəq ${secs} san)`;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#111217]">
      {/* Search & Actions Bar */}
      <div className="p-3 border-b border-zinc-800/80 bg-[#12131a] flex items-center gap-2">
        <div className="relative flex-1">
          <input
            id="calls-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zənglərdə axtar..."
            className="w-full h-9 pl-9 pr-4 rounded-xl bg-[#1b1c24] border border-zinc-700/80 text-xs font-mono-tech text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-all"
          />
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
        </div>

        {/* Clear all calls button */}
        {callLogs.length > 0 && (
          <button
            id="clear-all-calls-btn"
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="p-2 rounded-xl bg-[#1b1c24] border border-zinc-700/80 text-zinc-400 hover:text-red-400 hover:border-red-800 transition-colors cursor-pointer shrink-0"
            title="Bütün zəngləri təmizlə"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {/* New call button */}
        <button
          id="new-call-btn"
          type="button"
          onClick={onOpenNewCallModal}
          className="p-2 rounded-xl bg-[#1b1c24] border border-zinc-700/80 text-[#00ff66] hover:bg-emerald-950/40 hover:border-[#00ff66] transition-colors cursor-pointer shrink-0"
          title="Yeni zəng et"
        >
          <PhoneCall className="w-4 h-4" />
        </button>
      </div>

      {/* Call Logs List */}
      <div 
        id="call-logs-container"
        className="flex-1 overflow-y-auto divide-y divide-zinc-800/40 select-none"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-zinc-500">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-3 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
              <Phone className="w-7 h-7 text-[#00ff66]" />
            </div>
            <p className="text-sm font-mono-tech text-zinc-200 font-bold mb-1">
              Zəng qeydi yoxdur
            </p>
            <p className="text-xs font-mono-tech text-zinc-500 max-w-[220px] mb-5">
              Etibar etdiyiniz şəxslərlə səsli və video zənglər burada görünəcək.
            </p>
            <button
              onClick={onOpenNewCallModal}
              className="px-4 py-2.5 rounded-xl neon-btn-green text-xs font-mono-tech font-bold uppercase cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-950/40"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Zəng başlat
            </button>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isOutgoing = log.caller.toLowerCase() === currentUser.username.toLowerCase();
            const peer = isOutgoing ? log.recipient : log.caller;
            const isMissed = log.status === 'missed' || log.status === 'declined';
            const isVideo = log.callType === 'video';

            return (
              <div
                key={log.id}
                id={`call-log-item-${log.id}`}
                className="w-full p-3.5 flex items-center justify-between hover:bg-[#161722] transition-colors group"
              >
                {/* User avatar + Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center font-bold text-xs text-white uppercase shrink-0 shadow-xs">
                    {peer.slice(0, 2)}
                  </div>

                  <div className="flex flex-col min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-montserrat font-bold text-xs truncate ${
                        isMissed && !isOutgoing ? 'text-red-400' : 'text-white'
                      }`}>
                        {peer}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-mono-tech text-zinc-400">
                      {/* Direction Icon */}
                      {isOutgoing ? (
                        <ArrowUpRight className="w-3.5 h-3.5 text-[#00ff66] shrink-0" />
                      ) : isMissed ? (
                        <PhoneMissed className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      ) : (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-[#00ff66] shrink-0" />
                      )}

                      {/* Call status / details */}
                      <span className={`${
                        isMissed && !isOutgoing ? 'text-red-400' : 'text-zinc-400'
                      }`}>
                        {isOutgoing ? 'Gedən' : isMissed ? 'Cavabsız' : 'Gələn'} {isVideo ? 'video' : 'səsli'}
                      </span>

                      {log.duration ? (
                        <span className="text-zinc-500 text-[10px]">
                          {formatDuration(log.duration)}
                        </span>
                      ) : null}

                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-500 text-[10px]">
                        {formatCallTime(log.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Dial Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onStartCall(peer, 'voice')}
                    className="p-2 rounded-lg text-zinc-400 hover:text-[#00ff66] hover:bg-[#00ff66]/10 transition-colors cursor-pointer"
                    title={`${peer} ilə səsli zəng`}
                  >
                    <Phone className="w-4 h-4 text-[#00ff66]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onStartCall(peer, 'video')}
                    className="p-2 rounded-lg text-zinc-400 hover:text-[#00ff66] hover:bg-[#00ff66]/10 transition-colors cursor-pointer"
                    title={`${peer} ilə video zəng`}
                  >
                    <Video className="w-4 h-4 text-[#00ff66]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCallToDelete(log.id)}
                    className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer opacity-70 group-hover:opacity-100"
                    title="Qeydi sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div 
          id="clear-calls-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          onClick={() => setShowClearConfirm(false)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl bg-[#14151e] border border-zinc-800 p-6 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-3 shadow-[0_0_16px_rgba(239,68,68,0.2)]">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white font-montserrat mb-2">
              Bütün zəng qeydləri silinsin?
            </h3>
            <p className="text-xs text-zinc-400 font-sans mb-5">
              Bütün gələn və gedən zəng tarixçəniz tamamilə təmizlənəcək.
            </p>
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-mono-tech font-bold text-zinc-300 transition-colors cursor-pointer"
              >
                Ləğv et
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowClearConfirm(false);
                  onClearAllCallLogs();
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-mono-tech font-bold text-white transition-colors cursor-pointer shadow-lg shadow-red-600/30"
              >
                Bəli, təmizlə
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Call Confirmation Modal */}
      {callToDelete && (
        <div 
          id="delete-single-call-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          onClick={() => setCallToDelete(null)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl bg-[#14151e] border border-zinc-800 p-6 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white font-montserrat mb-2">
              Bu zəng qeydini silmək istəyirsiniz?
            </h3>
            <div className="flex items-center gap-3 w-full mt-4">
              <button
                type="button"
                onClick={() => setCallToDelete(null)}
                className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-mono-tech font-bold text-zinc-300 transition-colors cursor-pointer"
              >
                Ləğv et
              </button>
              <button
                type="button"
                onClick={() => {
                  if (callToDelete) {
                    onDeleteCallLog(callToDelete);
                    setCallToDelete(null);
                  }
                }}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-mono-tech font-bold text-white transition-colors cursor-pointer"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
