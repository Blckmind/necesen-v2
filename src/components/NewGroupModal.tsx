import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Camera, Search, Check, Plus, AlertCircle, Loader2 } from 'lucide-react';

interface ContactCandidate {
  username: string;
  avatar: string;
  statusMessage: string;
  isOnline: boolean;
}

interface NewGroupModalProps {
  currentUser: string;
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (group: any) => void;
}

export const NewGroupModal: React.FC<NewGroupModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onGroupCreated
}) => {
  const [groupName, setGroupName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [groupAvatar, setGroupAvatar] = useState<string>('');
  const [recentContacts, setRecentContacts] = useState<ContactCandidate[]>([]);
  const [allUsers, setAllUsers] = useState<ContactCandidate[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [searchExact, setSearchExact] = useState<string>('');
  const [loadingContacts, setLoadingContacts] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch contacts on modal open
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    setGroupName('');
    setDescription('');
    setGroupAvatar('');
    setSelectedMembers([]);
    setSearchExact('');
    setError('');

    let isMounted = true;
    setLoadingContacts(true);

    fetch(`/api/users/contacts/${encodeURIComponent(currentUser)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        setRecentContacts(data.recentContacts || []);
        setAllUsers(data.allUsers || []);
      })
      .catch((err) => {
        console.warn('Failed to load contact candidates:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingContacts(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentUser]);

  // Combine all registered users and recent contacts deduplicated
  const combinedUserList = useMemo(() => {
    const map = new Map<string, ContactCandidate>();
    // Recent contacts first
    for (const u of recentContacts) {
      if (u.username.toLowerCase() !== currentUser.toLowerCase()) {
        map.set(u.username.toLowerCase(), u);
      }
    }
    // Then all registered users in platform
    for (const u of allUsers) {
      if (u.username.toLowerCase() !== currentUser.toLowerCase() && !map.has(u.username.toLowerCase())) {
        map.set(u.username.toLowerCase(), u);
      }
    }
    return Array.from(map.values());
  }, [recentContacts, allUsers, currentUser]);

  // Real-time search filter for users
  const filteredUsers = useMemo(() => {
    const q = searchExact.trim().toLowerCase();
    if (!q) return combinedUserList;
    return combinedUserList.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.statusMessage && u.statusMessage.toLowerCase().includes(q))
    );
  }, [combinedUserList, searchExact]);

  if (!isOpen) return null;

  // Handle avatar upload with compression
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 320;
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
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          setGroupAvatar(compressed);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const toggleMember = (username: string) => {
    if (username.toLowerCase() === currentUser.toLowerCase()) return;
    setSelectedMembers((prev) => {
      const exists = prev.some((m) => m.toLowerCase() === username.toLowerCase());
      if (exists) {
        return prev.filter((m) => m.toLowerCase() !== username.toLowerCase());
      } else {
        return [...prev, username];
      }
    });
  };

  const handleAddExactUser = async () => {
    setError('');
    const target = searchExact.trim();
    if (!target) return;

    if (target.toLowerCase() === currentUser.toLowerCase()) {
      setError('Özünüzü üzv kimi əlavə etməyə ehtiyac yoxdur, avtomatik admin olacaqsınız');
      return;
    }

    if (selectedMembers.some((m) => m.toLowerCase() === target.toLowerCase())) {
      setError('Bu istifadəçi artıq seçilib');
      return;
    }

    try {
      const res = await fetch(`/api/user-check/${encodeURIComponent(target)}`);
      const data = await res.json();
      if (!res.ok || !data.exists) {
        setError(`"${target}" adlı istifadəçi tapılmadı`);
        return;
      }
      setSelectedMembers((prev) => [...prev, data.username]);
      setSearchExact('');
    } catch {
      setError('İstifadəçi yoxlanılarkən xəta baş verdi');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (currentUser.toLowerCase() !== 'khabib') {
      setError('Qrup yaratmaq səlahiyyəti yalnız khabib admin hesabına məxsusdur.');
      return;
    }

    const cleanName = groupName.trim();
    if (!cleanName) {
      setError('Zəhmət olmasa qrup adını daxil edin');
      return;
    }

    if (selectedMembers.length === 0) {
      setError('Qrup üçün ən azı 1 digər istifadəçi seçməlisiniz');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          description: description.trim(),
          avatar: groupAvatar,
          createdBy: currentUser,
          members: selectedMembers
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Qrup yaradılarkən xəta baş verdi');
      }

      onGroupCreated(data.group);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Qrup yaradılarkən xəta baş verdi');
    } finally {
      setSubmitting(false);
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
          className="w-full max-w-lg bg-[#0e0f14] border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold font-montserrat text-white tracking-wide">
                  Yeni Qrup Yarat
                </h3>
                <p className="text-[11px] text-zinc-400 font-mono-tech">
                  WhatsApp üslubunda təhlükəsiz qrup söhbəti
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleCreateGroup} className="flex-1 overflow-y-auto p-6 space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Group Profile Photo & Name */}
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-2xl bg-zinc-800/90 border border-dashed border-emerald-500/50 hover:border-emerald-400 flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden group shadow-md"
                >
                  {groupAvatar ? (
                    <img src={groupAvatar} alt="Group" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-emerald-400/80 group-hover:text-emerald-300">
                      <Camera className="w-6 h-6" />
                      <span className="text-[9px] font-mono-tech mt-0.5 font-bold uppercase tracking-wider">Foto</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
              </div>

              <div className="flex-1 space-y-1.5">
                <label className="text-[11px] font-mono-tech text-zinc-400 uppercase tracking-wider font-semibold">
                  Qrup Adı *
                </label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Məs: Dostlar, Layihə Komandası..."
                  maxLength={40}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-white placeholder-zinc-500 text-sm font-montserrat focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono-tech text-zinc-400 uppercase tracking-wider font-semibold">
                Qrup Təsviri (Könüllü)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Qrupun məqsədi və ya mövzusu"
                maxLength={80}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-white placeholder-zinc-500 text-xs font-mono-tech focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Selected Members Chips */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono-tech text-zinc-400 uppercase tracking-wider font-semibold">
                  Seçilmiş Üzvlər ({selectedMembers.length})
                </label>
                <span className="text-[10px] font-mono-tech text-emerald-400">
                  {currentUser} (Siz - Admin)
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-600/40 text-emerald-300 text-xs font-mono-tech">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>{currentUser} (Admin)</span>
                </span>
                {selectedMembers.map((member) => (
                  <span
                    key={member}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-xs font-mono-tech"
                  >
                    <span>{member}</span>
                    <button
                      type="button"
                      onClick={() => toggleMember(member)}
                      className="text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* User Search & Full Registered Users List (Admin khabib can add any user) */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono-tech text-emerald-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>Bütün İstifadəçilər ({filteredUsers.length})</span>
                </label>
                {loadingContacts && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />}
              </div>

              {/* Live search input */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                  <input
                    type="text"
                    value={searchExact}
                    onChange={(e) => setSearchExact(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddExactUser();
                      }
                    }}
                    placeholder="İstifadəçi adı ilə axtarış və ya əlavə..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 text-xs font-mono-tech focus:outline-none focus:border-emerald-500"
                  />
                </div>
                {searchExact.trim() && !filteredUsers.some(u => u.username.toLowerCase() === searchExact.trim().toLowerCase()) && (
                  <button
                    type="button"
                    onClick={handleAddExactUser}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono-tech text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Dəqiq Əlavə Et</span>
                  </button>
                )}
              </div>

              {filteredUsers.length === 0 && !loadingContacts ? (
                <div className="p-3 text-center rounded-xl bg-zinc-900/40 border border-zinc-800/60">
                  <p className="text-xs text-zinc-400 font-mono-tech">
                    "{searchExact}" adına uyğun istifadəçi tapılmadı.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {filteredUsers.map((contact) => {
                    const isSelected = selectedMembers.some(
                      (m) => m.toLowerCase() === contact.username.toLowerCase()
                    );
                    return (
                      <div
                        key={contact.username}
                        onClick={() => toggleMember(contact.username)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-xs'
                            : 'bg-zinc-900/70 border-zinc-800 hover:bg-zinc-800/80 hover:border-zinc-700 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                          <div className="relative shrink-0">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-emerald-400 overflow-hidden">
                              {contact.avatar ? (
                                <img src={contact.avatar} alt={contact.username} className="w-full h-full object-cover" />
                              ) : (
                                contact.username.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            {contact.isOnline && (
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00ff66] border-2 border-zinc-900" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold font-montserrat text-white leading-tight truncate flex items-center gap-1.5">
                              <span>{contact.username}</span>
                              {contact.isOnline && (
                                <span className="text-[10px] text-emerald-400 font-normal">onlayn</span>
                              )}
                            </p>
                            <p className="text-[10px] text-zinc-400 font-mono-tech truncate">
                              {contact.statusMessage || 'Khami istifadəçisi'}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                            isSelected
                              ? 'bg-emerald-500 border-emerald-500 text-black'
                              : 'border-zinc-600 bg-zinc-800/80'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="pt-2 border-t border-zinc-800/80 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono-tech text-xs font-bold transition-all cursor-pointer"
              >
                İmtina
              </button>
              <button
                type="submit"
                disabled={submitting || !groupName.trim() || selectedMembers.length === 0}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono-tech text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Qrup Yaradılır...</span>
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    <span>Qrupu Yarat</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
