import React, { useState } from 'react';
import { Phone, Video, X, Search, PhoneCall, AlertCircle } from 'lucide-react';
import { Conversation } from '../types';

interface NewCallModalProps {
  currentUser: string;
  isOpen: boolean;
  conversations: Conversation[];
  onClose: () => void;
  onStartCall: (targetUser: string, callType: 'voice' | 'video') => void;
}

export const NewCallModal: React.FC<NewCallModalProps> = ({
  currentUser,
  isOpen,
  conversations,
  onClose,
  onStartCall
}) => {
  const [searchUsername, setSearchUsername] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleDial = async (target: string, callType: 'voice' | 'video') => {
    const trimmed = target.trim();
    if (!trimmed) {
      setError('İstifadəçi adı daxil edin');
      return;
    }
    if (trimmed.toLowerCase() === currentUser.toLowerCase()) {
      setError('Özünüzə zəng edə bilməzsiniz');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/user-check/${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok || !data.exists) {
        throw new Error('İstifadəçi tapılmadı');
      }
      if (data.isBlocked) {
        throw new Error('İstifadəçi bloklanıb');
      }
      onStartCall(data.username, callType);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Xəta baş verdi');
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = conversations.filter((c) =>
    c.user.toLowerCase().includes(searchUsername.toLowerCase())
  );

  return (
    <div 
      id="new-call-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm rounded-2xl bg-[#14151e] border border-zinc-800 p-5 shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00ff66]/10 border border-[#00ff66]/30 flex items-center justify-center text-[#00ff66]">
              <PhoneCall className="w-4 h-4" />
            </div>
            <h3 className="font-montserrat font-bold text-sm text-white">
              Yeni Zəng
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search / Direct input */}
        <div className="relative mb-3">
          <input
            id="dial-user-input"
            type="text"
            value={searchUsername}
            onChange={(e) => {
              setSearchUsername(e.target.value);
              setError('');
            }}
            placeholder="İstifadəçi adı daxil edin..."
            className="w-full h-10 pl-9 pr-24 rounded-xl bg-[#1b1c24] border border-zinc-700 text-xs font-mono-tech text-white placeholder-zinc-500 focus:outline-none focus:border-[#00ff66] transition-colors"
          />
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3 pointer-events-none" />

          {/* Quick Call buttons inside input when username typed */}
          {searchUsername.trim() && (
            <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleDial(searchUsername, 'voice')}
                disabled={loading}
                className="p-1.5 rounded-lg bg-[#00ff66]/20 text-[#00ff66] hover:bg-[#00ff66]/30 transition-colors cursor-pointer"
                title="Səsli zəng"
              >
                <Phone className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDial(searchUsername, 'video')}
                disabled={loading}
                className="p-1.5 rounded-lg bg-[#00ff66]/20 text-[#00ff66] hover:bg-[#00ff66]/30 transition-colors cursor-pointer"
                title="Video zəng"
              >
                <Video className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-3 p-2 rounded-lg bg-red-950/40 border border-red-800/80 text-red-400 text-xs font-mono-tech flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Contacts list */}
        <p className="text-[11px] font-mono-tech text-zinc-400 mb-2 uppercase tracking-wider">
          Əlaqələr
        </p>
        <div className="max-h-60 overflow-y-auto divide-y divide-zinc-800/40 rounded-xl bg-[#101117] border border-zinc-800/80">
          {filteredContacts.length === 0 ? (
            <div className="p-4 text-center text-xs font-mono-tech text-zinc-500">
              {searchUsername ? 'Uyğun istifadəçi tapılmadı' : 'Hələ əlaqə yoxdur'}
            </div>
          ) : (
            filteredContacts.map((c) => (
              <div
                key={c.user}
                className="p-2.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-white uppercase shrink-0">
                    {c.user.slice(0, 2)}
                  </div>
                  <span className="font-montserrat font-bold text-xs text-white truncate">
                    {c.user}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDial(c.user, 'voice')}
                    className="p-2 rounded-lg text-zinc-400 hover:text-[#00ff66] hover:bg-[#00ff66]/10 transition-colors cursor-pointer"
                    title={`${c.user} ilə səsli zəng`}
                  >
                    <Phone className="w-4 h-4 text-[#00ff66]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDial(c.user, 'video')}
                    className="p-2 rounded-lg text-zinc-400 hover:text-[#00ff66] hover:bg-[#00ff66]/10 transition-colors cursor-pointer"
                    title={`${c.user} ilə video zəng`}
                  >
                    <Video className="w-4 h-4 text-[#00ff66]" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
