import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Camera, Edit2, Check, UserPlus, LogOut, Shield, AlertCircle, Loader2, Search, Plus } from 'lucide-react';
import { GroupChat } from '../types';

interface CandidateUser {
  username: string;
  avatar: string;
  statusMessage: string;
  isOnline: boolean;
}

interface GroupInfoModalProps {
  currentUser: string;
  isOpen: boolean;
  group: GroupChat | null;
  onClose: () => void;
  onUpdateGroup: (updatedGroup: GroupChat) => void;
  onLeaveGroup: (groupId: string) => void;
}

export const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
  currentUser,
  isOpen,
  group,
  onClose,
  onUpdateGroup,
  onLeaveGroup
}) => {
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [isEditingDesc, setIsEditingDesc] = useState<boolean>(false);
  const [newDesc, setNewDesc] = useState<string>('');
  const [newMemberUsername, setNewMemberUsername] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [confirmLeave, setConfirmLeave] = useState<boolean>(false);

  // All registered platform users candidate list
  const [candidateUsers, setCandidateUsers] = useState<CandidateUser[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(false);
  const [candidateFilter, setCandidateFilter] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load all registered users when modal opens
  useEffect(() => {
    if (!isOpen || !group) return;
    setLoadingCandidates(true);
    fetch(`/api/users/contacts/${encodeURIComponent(currentUser)}`)
      .then((res) => res.json())
      .then((data) => {
        const all: CandidateUser[] = data.allUsers || [];
        setCandidateUsers(all);
      })
      .catch((err) => {
        console.warn('Failed to load candidate users:', err);
      })
      .finally(() => setLoadingCandidates(false));
  }, [isOpen, group?.id, currentUser]);

  // Candidates who are not yet members of this group
  const nonMemberCandidates = useMemo(() => {
    if (!group) return [];
    const memberLower = new Set(group.members.map((m) => m.toLowerCase()));
    const notInGroup = candidateUsers.filter((u) => !memberLower.has(u.username.toLowerCase()));
    const q = candidateFilter.trim().toLowerCase();
    if (!q) return notInGroup;
    return notInGroup.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.statusMessage && u.statusMessage.toLowerCase().includes(q))
    );
  }, [candidateUsers, group?.members, candidateFilter]);

  if (!isOpen || !group) return null;

  const isAdmin = group.admins.some((a) => a.toLowerCase() === currentUser.toLowerCase());

  // Handle avatar upload
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 360;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);

          // Save to server
          fetch(`/api/groups/${encodeURIComponent(group.id)}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: currentUser,
              avatar: compressed
            })
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.success && data.group) {
                onUpdateGroup(data.group);
              }
            })
            .catch(() => {
              setError('Qrup şəkli yenilənə bilmədi');
            });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveName = async () => {
    const clean = newName.trim();
    if (!clean || clean === group.name) {
      setIsEditingName(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(group.id)}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser,
          name: clean
        })
      });
      const data = await res.json();
      if (res.ok && data.group) {
        onUpdateGroup(data.group);
        setIsEditingName(false);
      } else {
        setError(data.error || 'Qrup adı yenilənmədi');
      }
    } catch {
      setError('Qrup adı yenilənərkən xəta baş verdi');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDesc = async () => {
    const clean = newDesc.trim();
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(group.id)}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser,
          description: clean
        })
      });
      const data = await res.json();
      if (res.ok && data.group) {
        onUpdateGroup(data.group);
        setIsEditingDesc(false);
      } else {
        setError(data.error || 'Təsvir yenilənmədi');
      }
    } catch {
      setError('Təsvir yenilənərkən xəta baş verdi');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const target = newMemberUsername.trim();
    if (!target) return;

    if (group.members.some((m) => m.toLowerCase() === target.toLowerCase())) {
      setError('Bu istifadəçi artıq qrup üzvüdür');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(group.id)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser,
          newMembers: [target]
        })
      });
      const data = await res.json();
      if (res.ok && data.group) {
        if (data.added && data.added.length > 0) {
          onUpdateGroup(data.group);
          setNewMemberUsername('');
        } else {
          setError(`"${target}" adlı istifadəçi tapılmadı`);
        }
      } else {
        setError(data.error || 'Üzv əlavə edilə bilmədi');
      }
    } catch {
      setError('Üzv əlavə edilərkən xəta baş verdi');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAddMember = async (target: string) => {
    if (!group || !target) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(group.id)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser,
          newMembers: [target]
        })
      });
      const data = await res.json();
      if (res.ok && data.group) {
        onUpdateGroup(data.group);
      } else {
        setError(data.error || 'Üzv əlavə edilə bilmədi');
      }
    } catch {
      setError('Üzv əlavə edilərkən xəta baş verdi');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(group.id)}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser
        })
      });
      if (res.ok) {
        onLeaveGroup(group.id);
        onClose();
      }
    } catch {
      setError('Qrupdan çıxarkən xəta baş verdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md bg-[#0e0f14] border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
            <h3 className="text-sm font-bold font-montserrat text-white tracking-wide uppercase">
              Qrup Məlumatı
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {error && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Group Profile Picture Section (WhatsApp style) */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-zinc-800 border-2 border-emerald-500/50 flex items-center justify-center overflow-hidden shadow-xl">
                  {group.avatar ? (
                    <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-10 h-10 text-emerald-400" />
                  )}
                </div>
                {/* Camera upload button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Qrup profil şəklini dəyiş"
                  className="absolute bottom-0 right-0 p-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-transform active:scale-95 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
              </div>

              {/* Group Name Editing */}
              <div className="w-full">
                {isEditingName ? (
                  <div className="flex items-center gap-2 justify-center">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      maxLength={40}
                      autoFocus
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-emerald-500 text-white text-base font-bold text-center focus:outline-none"
                    />
                    <button
                      onClick={handleSaveName}
                      className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <h2 className="text-lg font-bold font-montserrat text-white tracking-wide">
                      {group.name}
                    </h2>
                    <button
                      onClick={() => {
                        setNewName(group.name);
                        setIsEditingName(true);
                      }}
                      className="text-zinc-500 hover:text-emerald-400 transition-colors p-1 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-zinc-400 font-mono-tech mt-0.5">
                  Qrup • {group.members.length} üzv
                </p>
              </div>

              {/* Group Description */}
              <div className="w-full bg-zinc-900/60 rounded-xl p-3 border border-zinc-800 text-left">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono-tech uppercase tracking-wider text-zinc-400 font-bold">
                    Qrup Təsviri
                  </span>
                  {!isEditingDesc && (
                    <button
                      onClick={() => {
                        setNewDesc(group.description || '');
                        setIsEditingDesc(true);
                      }}
                      className="text-zinc-500 hover:text-emerald-400 transition-colors p-0.5 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {isEditingDesc ? (
                  <div className="space-y-2 mt-1">
                    <textarea
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      maxLength={120}
                      rows={2}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-emerald-500 text-white text-xs font-mono-tech focus:outline-none"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setIsEditingDesc(false)}
                        className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 text-xs font-mono-tech cursor-pointer"
                      >
                        İmtina
                      </button>
                      <button
                        onClick={handleSaveDesc}
                        className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs font-mono-tech font-bold cursor-pointer"
                      >
                        Yadda Saxla
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-300 font-mono-tech">
                    {group.description || 'Təsvir əlavə edilməyib'}
                  </p>
                )}
              </div>
            </div>

            {/* Add Member (WhatsApp style - List of all registered users not yet in group) */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono-tech text-emerald-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Qrupa Yeni Üzv Əlavə Et ({nonMemberCandidates.length} namizəd)</span>
                </label>
                {loadingCandidates && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />}
              </div>

              {/* Search or type exact username */}
              <form onSubmit={handleAddMember} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                  <input
                    type="text"
                    value={candidateFilter}
                    onChange={(e) => {
                      setCandidateFilter(e.target.value);
                      setNewMemberUsername(e.target.value);
                    }}
                    placeholder="İstifadəçi adı axtar və ya daxil et..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 text-xs font-mono-tech focus:outline-none focus:border-emerald-500"
                  />
                </div>
                {candidateFilter.trim() && !nonMemberCandidates.some(u => u.username.toLowerCase() === candidateFilter.trim().toLowerCase()) && (
                  <button
                    type="submit"
                    disabled={loading || !candidateFilter.trim()}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-mono-tech font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-md shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Dəqiq Əlavə Et</span>
                  </button>
                )}
              </form>

              {/* Scrollable list of non-member candidates to add with 1 click */}
              {nonMemberCandidates.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {nonMemberCandidates.map((cand) => (
                    <div
                      key={cand.username}
                      className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                        <div className="relative shrink-0">
                          <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-emerald-400 overflow-hidden">
                            {cand.avatar ? (
                              <img src={cand.avatar} alt={cand.username} className="w-full h-full object-cover" />
                            ) : (
                              cand.username.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          {cand.isOnline && (
                            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#00ff66] border border-zinc-900" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold font-montserrat text-white leading-tight truncate flex items-center gap-1.5">
                            <span>{cand.username}</span>
                            {cand.isOnline && (
                              <span className="text-[10px] text-emerald-400 font-normal">onlayn</span>
                            )}
                          </p>
                          <p className="text-[10px] text-zinc-400 font-mono-tech truncate">
                            {cand.statusMessage || 'Khami istifadəçisi'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleQuickAddMember(cand.username)}
                        disabled={loading}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-[11px] font-mono-tech font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Əlavə Et</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Members List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono-tech text-zinc-400 uppercase tracking-wider font-bold">
                  Üzvlər Siyahısı ({group.members.length})
                </span>
                <span className="text-[10px] font-mono-tech text-zinc-500">
                  Yaradıldı: {new Date(group.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {group.members.map((member) => {
                  const isMemberAdmin = group.admins.some((a) => a.toLowerCase() === member.toLowerCase());
                  const isMe = member.toLowerCase() === currentUser.toLowerCase();

                  return (
                    <div
                      key={member}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-emerald-400">
                          {member.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold font-montserrat text-white">
                              {member}
                            </span>
                            {isMe && (
                              <span className="text-[10px] font-mono-tech text-emerald-400 font-bold">
                                (Siz)
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono-tech">
                            {isMemberAdmin ? 'Qrup İnzibatçısı' : 'Üzv'}
                          </span>
                        </div>
                      </div>

                      {isMemberAdmin && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono-tech font-bold">
                          <Shield className="w-3 h-3" />
                          <span>Admin</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leave Group Action */}
            <div className="pt-3 border-t border-zinc-800/80">
              {confirmLeave ? (
                <div className="p-3 rounded-xl bg-red-950/70 border border-red-800 space-y-2">
                  <p className="text-[11px] font-mono-tech text-red-200 text-center font-bold">
                    Qrupdan çıxmaq istədiyinizdən əminsiniz?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleLeaveGroup}
                      disabled={loading}
                      className="py-2 px-3 rounded-lg bg-red-600 hover:bg-red-700 active:scale-95 text-white font-mono-tech text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Bəli, Çıx</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmLeave(false)}
                      className="py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono-tech text-xs font-bold transition-all cursor-pointer"
                    >
                      İmtina
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmLeave(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-900/60 hover:border-red-700 text-red-300 hover:text-white font-mono-tech text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98]"
                >
                  <LogOut className="w-4 h-4 text-red-400" />
                  <span>Qrupdan Çıx</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
