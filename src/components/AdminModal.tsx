import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, UserX, UserCheck, X, RefreshCw, AlertTriangle, Users, MessageSquare, Trash2, CheckCircle2 } from 'lucide-react';

interface AdminUser {
  id: string;
  username: string;
  isAdmin: boolean;
  isBlocked: boolean;
  createdAt: number;
  lastSeen?: number;
  isOnline: boolean;
  avatar?: string;
  statusMessage?: string;
}

interface AdminModalProps {
  currentUser: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenChat?: (targetUsername: string) => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ currentUser, isOpen, onClose, onOpenChat }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [clearingMessages, setClearingMessages] = useState<boolean>(false);
  const [clearConfirm, setClearConfirm] = useState<boolean>(false);
  const [clearSuccess, setClearSuccess] = useState<string>('');

  const fetchUsers = async () => {
    if (currentUser.toLowerCase() !== 'khabib') return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        headers: {
          'x-admin-user': currentUser
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'İstifadəçiləri yükləmək mümkün olmadı');
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Xəta baş verdi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const handleToggleBlock = async (targetUsername: string, currentBlocked: boolean) => {
    setActionLoading(targetUsername);
    try {
      const res = await fetch('/api/admin/block-toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': currentUser
        },
        body: JSON.stringify({
          targetUsername,
          block: !currentBlocked
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Əməliyyat baş tutmadı');
      
      // Update local list
      setUsers(prev => 
        prev.map(u => (u.username.toLowerCase() === targetUsername.toLowerCase() ? { ...u, isBlocked: !currentBlocked } : u))
      );
    } catch (err: any) {
      alert(err.message || 'Xəta baş verdi');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (targetUsername: string) => {
    if (!window.confirm(`${targetUsername} profilini və bütün məlumatlarını tamamilə silmək istədiyinizdən əminsiniz?`)) return;
    setActionLoading(targetUsername);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': currentUser
        },
        body: JSON.stringify({ targetUsername })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Profil silinmədi');
      setUsers((prev) => prev.filter((u) => u.username.toLowerCase() !== targetUsername.toLowerCase()));
      setClearSuccess(`${targetUsername} profili uğurla silindi`);
      setTimeout(() => setClearSuccess(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Xəta baş verdi');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearAllMessages = async () => {
    setClearingMessages(true);
    setClearSuccess('');
    try {
      const res = await fetch('/api/admin/clear-all-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': currentUser
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Mesajları təmizləmək mümkün olmadı');
      setClearSuccess('Bütün çat mesajları uğurla təmizləndi!');
      setClearConfirm(false);
      setTimeout(() => setClearSuccess(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Xəta baş verdi');
    } finally {
      setClearingMessages(false);
    }
  };

  if (!isOpen) return null;

  const totalUsers = users.length;
  const blockedCount = users.filter(u => u.isBlocked).length;
  const activeCount = totalUsers - blockedCount;

  return (
    <div 
      id="admin-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-[#0d0d11] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#00ff66]" />
            </div>
            <div>
              <h3 className="text-base font-bold font-mono-tech text-white flex items-center gap-2">
                Admin Paneli <span className="text-xs text-[#00ff66] font-normal px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60">khabib</span>
              </h3>
              <p className="text-xs text-zinc-400 font-mono-tech">
                Bütün qeydiyyatdan keçən istifadəçilərin idarə edilməsi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="admin-refresh-btn"
              onClick={fetchUsers}
              disabled={loading}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              title="Yenilə"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#00ff66]' : ''}`} />
            </button>
            <button
              id="admin-close-modal-btn"
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-3 gap-2 px-6 py-3 bg-zinc-900/30 border-b border-zinc-800/40 text-xs font-mono-tech">
          <div className="flex items-center gap-2 text-zinc-300">
            <Users className="w-3.5 h-3.5 text-zinc-400" />
            <span>Toplam: <strong className="text-white">{totalUsers}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Aktiv: <strong>{activeCount}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Bloklanmış: <strong>{blockedCount}</strong></span>
          </div>
        </div>

        {/* Notice */}
        <div className="px-6 py-2.5 bg-amber-950/20 border-b border-amber-900/30 text-[11px] font-mono-tech text-amber-300/80 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>Bloklanan istifadəçi dərhal sistemdən atılır və tətbiqə daxil ola bilmir.</span>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-900 text-red-300 text-xs font-mono-tech">
              {error}
            </div>
          )}

          {loading && users.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-zinc-500 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#00ff66]" />
              <span className="text-xs font-mono-tech">İstifadəçilər yüklənir...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 font-mono-tech text-xs">
              Heç bir istifadəçi tapılmadı
            </div>
          ) : (
            users.map((u) => {
              const isSelf = u.username.toLowerCase() === 'khabib';
              const isBusy = actionLoading === u.username;
              return (
                <div
                  key={u.id}
                  id={`admin-user-row-${u.username}`}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#121217] border border-zinc-800/80 hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt={u.username}
                          className="w-10 h-10 rounded-full object-cover border border-zinc-700 shadow-sm"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-mono-tech font-bold text-sm text-zinc-200 uppercase">
                          {u.username.slice(0, 2)}
                        </div>
                      )}
                      {u.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00ff66] border-2 border-[#121217]" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-tech font-bold text-sm text-white">
                          {u.username}
                        </span>
                        {isSelf && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-tech bg-emerald-950 text-[#00ff66] border border-emerald-800/70">
                            ADMIN
                          </span>
                        )}
                        {u.isBlocked && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-tech bg-red-950 text-red-400 border border-red-800/70">
                            BLOKLANIB
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono-tech text-zinc-400 mt-0.5 flex items-center gap-2">
                        <span>Qeydiyyat: {new Date(u.createdAt).toLocaleDateString('az-AZ')}</span>
                        {u.statusMessage && (
                          <>
                            <span className="text-zinc-600">•</span>
                            <span className="text-zinc-500 italic truncate max-w-[180px]">{u.statusMessage}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {isSelf ? (
                      <span className="text-xs font-mono-tech text-zinc-500 italic px-3 py-1.5">
                        Toxunulmaz (Siz)
                      </span>
                    ) : (
                      <>
                        {/* Direct Message Button for Admin */}
                        <button
                          id={`admin-chat-btn-${u.username}`}
                          onClick={() => {
                            if (onOpenChat) {
                              onOpenChat(u.username);
                            }
                            onClose();
                          }}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-mono-tech font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 text-zinc-200 hover:text-white hover:border-[#00ff66] hover:bg-zinc-800"
                          title={`${u.username} ilə yazış`}
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-[#00ff66]" />
                          <span>Mesaj</span>
                        </button>

                        {/* Block / Unblock Button */}
                        <button
                          id={`admin-block-btn-${u.username}`}
                          onClick={() => handleToggleBlock(u.username, u.isBlocked)}
                          disabled={isBusy}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-mono-tech font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            u.isBlocked
                              ? 'bg-emerald-950/60 border border-emerald-700/60 text-[#00ff66] hover:bg-emerald-900/60'
                              : 'bg-red-950/60 border border-red-800/60 text-red-300 hover:bg-red-900/60'
                          }`}
                        >
                          {isBusy ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : u.isBlocked ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Blokdan çıxar</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              <span>Blokla</span>
                            </>
                          )}
                        </button>

                        {/* Delete User Permanently Button */}
                        <button
                          id={`admin-delete-user-btn-${u.username}`}
                          onClick={() => handleDeleteUser(u.username)}
                          disabled={isBusy}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-mono-tech font-bold transition-all cursor-pointer flex items-center gap-1 bg-red-950/40 border border-red-900/60 text-red-400 hover:bg-red-900/70 hover:text-white"
                          title="Profili tamamilə sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Sil</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Success toast inside modal */}
        {clearSuccess && (
          <div className="mx-6 mb-3 p-3 rounded-xl bg-emerald-950/70 border border-emerald-700/80 text-[#00ff66] text-xs font-mono-tech flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00ff66]" />
            <span>{clearSuccess}</span>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between gap-3 text-xs font-mono-tech text-zinc-500">
          <div className="flex items-center gap-2">
            {!clearConfirm ? (
              <button
                id="admin-clear-all-messages-btn"
                onClick={() => setClearConfirm(true)}
                className="px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-900/60 text-red-400 hover:bg-red-900/60 hover:text-red-200 transition-colors cursor-pointer flex items-center gap-1.5 font-bold"
                title="Bütün istifadəçilərin göndərdiyi mesajları birdəfəlik sil"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bütün çatları təmizlə</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-950/70 border border-red-800 px-2.5 py-1.5 rounded-lg text-red-300">
                <span className="text-[11px] text-red-200">Əminsiniz?</span>
                <button
                  id="admin-confirm-clear-btn"
                  onClick={handleClearAllMessages}
                  disabled={clearingMessages}
                  className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] cursor-pointer disabled:opacity-50"
                >
                  {clearingMessages ? 'Silinir...' : 'Bəli, Hamısını Sil'}
                </button>
                <button
                  onClick={() => setClearConfirm(false)}
                  disabled={clearingMessages}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] cursor-pointer"
                >
                  İmtina
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
          >
            Bağla
          </button>
        </div>
      </motion.div>
    </div>
  );
};
