import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Camera, 
  Trash2, 
  Check, 
  User as UserIcon, 
  ShieldCheck, 
  Loader2,
  KeyRound,
  LogOut,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { User } from '../types';

interface ProfileModalProps {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onUpdateProfile: (updatedUser: User) => void;
  onLogout: () => void;
}

const STATUS_PRESETS = [
  'Khami tətbiqindən istifadə edirəm',
  'Mövcudam və danışa bilərəm',
  'Məşğulam, yalnız vacib mesajlar',
  'İşdəyəm / Görüşdəyəm',
  'Dərsdəyəm',
  'Gizli və təhlükəsiz rabitə'
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onUpdateProfile,
  onLogout
}) => {
  const [avatar, setAvatar] = useState<string>(currentUser.avatar || '');
  const [statusMessage, setStatusMessage] = useState<string>(
    currentUser.statusMessage || 'Khami tətbiqindən istifadə edirəm'
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [passwordLoading, setPasswordLoading] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string>('');
  const [passwordSuccess, setPasswordSuccess] = useState<string>('');
  const [confirmLogout, setConfirmLogout] = useState<boolean>(false);

  if (!isOpen) return null;

  // Compress & resize image to light and crisp base64
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Zəhmət olmasa şəkil faylı seçin (PNG, JPG, WebP)');
      return;
    }

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
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setAvatar(compressedDataUrl);
          setError('');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          avatar,
          statusMessage
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Profil yenilənə bilmədi');
      }

      const data = await res.json();
      if (data.user) {
        onUpdateProfile(data.user);
        setIsSuccess(true);
        setTimeout(() => {
          setIsSuccess(false);
          onClose();
        }, 1100);
      }
    } catch (err: any) {
      setError(err.message || 'Profil yenilənərkən xəta baş verdi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('Bütün xanaları doldurun');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Yeni parol və təkrarı uyğun gəlmir');
      return;
    }
    if (newPassword.length < 3) {
      setPasswordError('Yeni parol ən az 3 simvol olmalıdır');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          currentPassword,
          newPassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Parol dəyişdirilə bilmədi');

      setPasswordSuccess('Parolunuz uğurla yeniləndi!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (err: any) {
      setPasswordError(err.message || 'Xəta baş verdi');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div 
        id="profile-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          id="profile-modal-container"
          initial={{ scale: 0.92, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-[#13141c] border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-5 py-4 bg-[#181924] border-b border-zinc-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#00ff66]/10 border border-[#00ff66]/30 flex items-center justify-center text-[#00ff66]">
                <UserIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-montserrat text-white uppercase tracking-wider">
                  Profil Tənzimləmələri
                </h3>
                <p className="text-[11px] font-mono-tech text-zinc-400">
                  Profil, parol və təhlükəsizlik
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-6">
            {error && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-xs font-mono-tech text-red-300">
                {error}
              </div>
            )}

            {/* Avatar Section */}
            <div className="flex flex-col items-center justify-center text-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative group cursor-pointer rounded-full focus:outline-none transition-transform active:scale-95"
                title="Qalereyadan şəkil seçmək üçün klikləyin"
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt={currentUser.username}
                    className="w-28 h-28 rounded-full object-cover border-4 border-[#00ff66] shadow-[0_0_24px_rgba(0,255,102,0.3)] group-hover:brightness-105 transition-all"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-zinc-800 border-4 border-zinc-700 group-hover:border-[#00ff66] flex flex-col items-center justify-center text-white transition-colors shadow-inner">
                    <UserIcon className="w-10 h-10 text-zinc-400 group-hover:text-[#00ff66] transition-colors mb-1" />
                    <span className="text-xs font-mono-tech text-zinc-400 group-hover:text-white uppercase font-bold">
                      {currentUser.username}
                    </span>
                  </div>
                )}

                <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#00a884] border-2 border-[#13141c] flex items-center justify-center text-white shadow-lg group-hover:scale-110 group-hover:bg-[#00ff66] group-hover:text-black transition-all">
                  <Camera className="w-3.5 h-3.5" />
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {avatar && (
                <button
                  type="button"
                  onClick={() => setAvatar('')}
                  className="mt-2.5 px-3 py-1 rounded-lg bg-zinc-900/90 hover:bg-red-950/60 border border-zinc-800 hover:border-red-800 text-xs font-mono-tech text-zinc-400 hover:text-red-300 flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Mövcud şəkli sil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Şəkli Sil</span>
                </button>
              )}
            </div>

            {/* Profile Form (Username, Bio, Save) */}
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono-tech text-zinc-400">
                  İstifadəçi Adı
                </label>
                <div className="w-full h-10 px-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-sm font-sans text-white flex items-center justify-between">
                  <span className="font-bold">{currentUser.username}</span>
                  {currentUser.isAdmin && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-[#00ff66] border border-emerald-800 font-mono-tech flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      ADMIN
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono-tech text-zinc-400">
                  Status / Haqqında
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={statusMessage}
                  onChange={(e) => setStatusMessage(e.target.value)}
                  placeholder="Statusunuzu qeyd edin..."
                  className="w-full h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-sans text-white placeholder-zinc-500 focus:outline-none focus:border-[#00ff66] transition-colors"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {STATUS_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setStatusMessage(preset)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-sans bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 rounded-xl bg-[#00a884] hover:bg-[#008f6f] active:scale-[0.98] text-white font-mono-tech text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Yadda saxlanılır...</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Profil Yeniləndi!</span>
                  </>
                ) : (
                  <span>Profil Məlumatlarını Yadda Saxla</span>
                )}
              </button>
            </form>

            {/* PASSWORD CHANGE (KODU DƏYİŞ) SECTION */}
            <div className="rounded-xl border border-zinc-800 bg-[#161722] overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPasswordSection(!showPasswordSection)}
                className="w-full p-3.5 flex items-center justify-between text-left hover:bg-zinc-800/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold font-montserrat text-white uppercase tracking-wider">
                      Kodu (Parolu) Dəyiş
                    </h4>
                    <p className="text-[10px] text-zinc-400 font-mono-tech">
                      Hesabınızın təhlükəsizlik kodunu yeniləyin
                    </p>
                  </div>
                </div>
                {showPasswordSection ? (
                  <ChevronUp className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                )}
              </button>

              <AnimatePresence>
                {showPasswordSection && (
                  <motion.form
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    onSubmit={handleChangePassword}
                    className="p-4 pt-1 space-y-3 border-t border-zinc-800/60"
                  >
                    {passwordError && (
                      <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800 text-xs font-mono-tech text-red-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                        <span>{passwordError}</span>
                      </div>
                    )}
                    {passwordSuccess && (
                      <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-700 text-xs font-mono-tech text-[#00ff66] flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00ff66]" />
                        <span>{passwordSuccess}</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[11px] font-mono-tech text-zinc-400">
                        Cari Parol
                      </label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="İndiki parolunuz"
                        className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-mono-tech text-white focus:outline-none focus:border-amber-400 transition-colors"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-mono-tech text-zinc-400">
                        Yeni Parol
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Yeni parol təyin edin"
                        className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-mono-tech text-white focus:outline-none focus:border-amber-400 transition-colors"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-mono-tech text-zinc-400">
                        Yeni Parolun Təkrarı
                      </label>
                      <input
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Yeni parolu təkrarlayın"
                        className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-mono-tech text-white focus:outline-none focus:border-amber-400 transition-colors"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="w-full h-9 rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-black font-mono-tech text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-2"
                    >
                      {passwordLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                      ) : (
                        <KeyRound className="w-3.5 h-3.5 text-black" />
                      )}
                      <span>Parolu Yenilə</span>
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            {/* LOGOUT BUTTON (PROFİLDƏN ÇIXIŞ) */}
            <div className="pt-2 border-t border-zinc-800/80">
              {confirmLogout ? (
                <div className="p-3 rounded-xl bg-red-950/70 border border-red-800 space-y-2">
                  <p className="text-[11px] font-mono-tech text-red-300 text-center font-bold">
                    Hesabınızdan çıxmaq istədiyinizə əminsiniz?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id="confirm-logout-yes"
                      type="button"
                      onClick={() => {
                        onClose();
                        onLogout();
                      }}
                      className="py-2 px-3 rounded-lg bg-red-600 hover:bg-red-700 active:scale-95 text-white font-mono-tech text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Bəli, Çıx</span>
                    </button>
                    <button
                      id="confirm-logout-no"
                      type="button"
                      onClick={() => setConfirmLogout(false)}
                      className="py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 font-mono-tech text-xs font-bold transition-all cursor-pointer"
                    >
                      İmtina
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  id="profile-logout-btn"
                  type="button"
                  onClick={() => setConfirmLogout(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-900/60 hover:border-red-700 text-red-300 hover:text-white font-mono-tech text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98]"
                >
                  <LogOut className="w-4 h-4 text-red-400" />
                  <span>Hesabdan Çıx</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
