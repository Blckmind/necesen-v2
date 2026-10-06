import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, UserPlus, X, Shield, AlertCircle } from 'lucide-react';

interface NewChatModalProps {
  currentUser: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (username: string) => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onSelectUser
}) => {
  const [targetUsername, setTargetUsername] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleSearchAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const target = targetUsername.trim();
    if (!target) {
      setError('İstifadəçi adı daxil edin');
      return;
    }

    if (target.toLowerCase() === currentUser.toLowerCase()) {
      setError('Özünüzlə söhbət başlada bilməzsiniz');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/user-check/${encodeURIComponent(target)}`);
      const data = await res.json();

      if (!res.ok || !data.exists) {
        throw new Error('Bu adda istifadəçi tapılmadı. Zəhmət olmasa tam və dəqiq istifadəçi adını yoxlayın.');
      }

      if (data.isBlocked) {
        throw new Error('Bu istifadəçinin hesabı bloklanıb.');
      }

      // Success! Open conversation
      onSelectUser(data.username);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Axtarış zamanı xəta baş verdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="new-chat-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#0d0d11] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#00ff66]">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-mono-tech text-white">
                Yeni Söhbət Başlat
              </h3>
              <p className="text-[11px] text-zinc-500 font-mono-tech">
                Məxfi axtarış rejimi
              </p>
            </div>
          </div>
          <button
            id="new-chat-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Privacy Note */}
        <div className="px-6 py-3 bg-zinc-900/40 border-b border-zinc-800/50 flex items-start gap-2.5 text-xs text-zinc-400 font-mono-tech">
          <Shield className="w-4 h-4 text-[#00ff66] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Məxfilik prinsipi: Sistemdə ümumi istifadəçi siyahısı yoxdur. Yazışmaq üçün qarşı tərəfin <strong>tam istifadəçi adını</strong> dəqiq daxil etməlisiniz.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSearchAndStart} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs font-mono-tech flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label 
              htmlFor="target-user-search-input"
              className="block text-xs font-mono-tech text-zinc-300"
            >
              Qarşı tərəfin dəqiq istifadəçi adı
            </label>
            <div className="relative">
              <input
                id="target-user-search-input"
                type="text"
                autoFocus
                value={targetUsername}
                onChange={(e) => {
                  setTargetUsername(e.target.value);
                  setError('');
                }}
                placeholder="İstifadəçi adı daxil edin..."
                className="w-full h-11 px-4 pr-10 rounded-lg bg-[#141419] border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono-tech text-sm transition-all"
              />
              <Search className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-mono-tech cursor-pointer transition-colors"
            >
              Ləğv et
            </button>
            <button
              id="start-chat-btn"
              type="submit"
              disabled={loading || !targetUsername.trim()}
              className="px-5 py-2 rounded-lg neon-btn-green text-xs font-mono-tech font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40 flex items-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Söhbətə başla</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
