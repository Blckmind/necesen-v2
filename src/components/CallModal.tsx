import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  Phone, 
  PhoneOff, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  ShieldCheck,
  SwitchCamera,
  Volume2,
  VolumeX
} from 'lucide-react';
import { ActiveCall } from '../types';
import { soundManager } from '../utils/audio';
import { webrtcManager } from '../utils/webrtc';

interface CallModalProps {
  currentUser: string;
  activeCall: ActiveCall | null;
  onAccept: () => void;
  onDecline: () => void;
  onEndCall: (duration?: number) => void;
  onSendSignal?: (signalType: string, payload?: any) => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  currentUser,
  activeCall,
  onAccept,
  onDecline,
  onEndCall,
  onSendSignal
}) => {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [connectionStatus, setConnectionStatus] = useState<string>('Zəng edilir...');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const durationTimerRef = useRef<any>(null);
  const mediaInitializedRef = useRef<boolean>(false);

  const isVideo = activeCall?.callType === 'video';

  // Manage duration timer and sounds
  useEffect(() => {
    if (!activeCall) {
      soundManager.stopRinging();
      soundManager.stopRingback();
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      return;
    }

    if (activeCall.status === 'connected') {
      soundManager.stopRinging();
      soundManager.stopRingback();
      soundManager.playCallConnected();
      setConnectionStatus('Əlaqə quruldu');
      setCallDuration(0);
      if (!durationTimerRef.current) {
        durationTimerRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
    } else if (activeCall.status === 'ringing') {
      soundManager.startRinging();
      setConnectionStatus('Gələn zəng...');
    } else if (activeCall.status === 'calling') {
      soundManager.startRingback();
      setConnectionStatus('Zəng edilir...');
    }

    return () => {
      soundManager.stopRinging();
      soundManager.stopRingback();
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [activeCall?.status]);

  // Acquire media stream and initialize WebRTC
  const setupMediaAndWebRTC = useCallback(async () => {
    if (!activeCall) return;

    webrtcManager.init({
      onRemoteStream: (remStream) => {
        setRemoteStream(remStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remStream;
        }
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remStream;
          remoteAudioRef.current.play().catch(() => {});
        }
      },
      onIceCandidate: (candidate) => {
        if (onSendSignal && activeCall) {
          onSendSignal('webrtc_ice', { candidate });
        }
      },
      onConnectionStateChange: (state) => {
        if (state === 'connected') {
          setConnectionStatus('Əlaqə quruldu');
        } else if (state === 'connecting') {
          setConnectionStatus('Qoşulur...');
        } else if (state === 'disconnected' || state === 'failed') {
          setConnectionStatus('Əlaqə kəsildi');
        }
      }
    });

    let stream: MediaStream | null = null;
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: isVideo ? { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } : false
    };

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } else {
        throw new Error('getUserMedia not supported');
      }
    } catch (err) {
      console.warn('Media capture warning, activating fallback:', err);
      // If video failed, attempt audio only
      if (isVideo) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const canvasStream = webrtcManager.createCanvasVideoStream(currentUser);
          const combined = new MediaStream([
            ...audioStream.getAudioTracks(),
            ...canvasStream.getVideoTracks()
          ]);
          stream = combined;
        } catch {
          const silentAudio = webrtcManager.createSilentAudioStream();
          const canvasStream = webrtcManager.createCanvasVideoStream(currentUser);
          stream = new MediaStream([
            ...silentAudio.getAudioTracks(),
            ...canvasStream.getVideoTracks()
          ]);
        }
      } else {
        // Voice-only fallback
        stream = webrtcManager.createSilentAudioStream();
      }
    }

    if (stream) {
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      await webrtcManager.setLocalStream(stream);
    }
  }, [activeCall, isVideo, facingMode, currentUser, onSendSignal]);

  // Effect to initiate media when outgoing call begins or when incoming call is accepted
  useEffect(() => {
    if (!activeCall) return;

    if (!activeCall.isIncoming || activeCall.status === 'connected') {
      if (!mediaInitializedRef.current) {
        mediaInitializedRef.current = true;
        setupMediaAndWebRTC();
      }
    }

    return () => {
      // Don't tear down on status toggle within the same call!
      if (!activeCall || activeCall.status === 'ended') {
        mediaInitializedRef.current = false;
        webrtcManager.cleanup();
      }
    };
  }, [activeCall?.status, activeCall?.isIncoming, setupMediaAndWebRTC]);

  // Cleanup on final unmount
  useEffect(() => {
    return () => {
      mediaInitializedRef.current = false;
      webrtcManager.cleanup();
    };
  }, []);

  // Bind local stream to video
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Bind remote stream to audio/video
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // Handle incoming accept click
  const handleAcceptClick = async () => {
    if (!mediaInitializedRef.current) {
      mediaInitializedRef.current = true;
      await setupMediaAndWebRTC();
    }
    onAccept();
  };

  // Toggle Microphone
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  };

  // Toggle Video Track
  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoEnabled;
      });
    }
    setIsVideoEnabled(!isVideoEnabled);
  };

  // Switch camera front/rear on phones
  const switchCamera = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);

    if (navigator.mediaDevices?.getUserMedia && isVideo) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextMode },
          audio: false
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (newVideoTrack && localStream) {
          const oldVideoTrack = localStream.getVideoTracks()[0];
          if (oldVideoTrack) {
            oldVideoTrack.stop();
            localStream.removeTrack(oldVideoTrack);
          }
          localStream.addTrack(newVideoTrack);
          await webrtcManager.setLocalStream(localStream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
          }
        }
      } catch (err) {
        console.warn('Switch camera note:', err);
      }
    }
  };

  // Toggle incoming audio/speaker
  const toggleSpeaker = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !isSpeakerMuted;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !isSpeakerMuted;
    }
    setIsSpeakerMuted(!isSpeakerMuted);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!activeCall) return null;

  // 1. INCOMING CALL SCREEN
  if (activeCall.isIncoming && activeCall.status === 'ringing') {
    return (
      <div 
        id="incoming-call-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg select-none"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-sm bg-[#181a24] border border-zinc-700/80 rounded-3xl p-8 flex flex-col items-center text-center shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative overflow-hidden"
        >
          {/* Animated WhatsApp pulse rings */}
          <div className="relative my-6">
            <div className="absolute -inset-3 rounded-full bg-[#00a884]/25 animate-ping" />
            <div className="w-24 h-24 rounded-full bg-zinc-800 border-3 border-[#00a884] flex items-center justify-center text-3xl font-sans font-bold text-white relative z-10 uppercase shadow-2xl">
              {activeCall.targetUser.slice(0, 2)}
            </div>
          </div>

          <h3 className="text-2xl font-bold text-white mb-1.5 font-sans">
            {activeCall.targetUser}
          </h3>
          <p className="text-sm text-[#00a884] flex items-center gap-1.5 mb-8 font-medium">
            {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            <span>WhatsApp {isVideo ? 'Görüntülü' : 'Səsli'} Zəng...</span>
          </p>

          <div className="flex items-center justify-between gap-8 w-full px-4">
            {/* Decline Button */}
            <div className="flex flex-col items-center gap-2">
              <button
                id="call-decline-btn"
                onClick={onDecline}
                className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 active:scale-90 text-white flex items-center justify-center shadow-lg shadow-red-600/40 transition-transform cursor-pointer"
                title="Rədd et"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              <span className="text-xs text-zinc-400 font-sans">Rədd et</span>
            </div>

            {/* Accept Button */}
            <div className="flex flex-col items-center gap-2">
              <button
                id="call-accept-btn"
                onClick={handleAcceptClick}
                className="w-16 h-16 rounded-full bg-[#00a884] hover:bg-[#009272] active:scale-90 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 transition-transform cursor-pointer animate-bounce"
                title="Cavab ver"
              >
                <Phone className="w-7 h-7" />
              </button>
              <span className="text-xs text-[#00a884] font-bold font-sans">Cavab ver</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // 2. ACTIVE / OUTGOING CALL FULLSCREEN VIEW
  return (
    <div 
      id="active-call-overlay"
      className="fixed inset-0 z-50 bg-[#0d0e14] text-white flex flex-col select-none overflow-hidden"
    >
      {/* Hidden audio element for receiving remote peer sound */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Top Floating WhatsApp Call Header */}
      <div className="p-4 sm:p-6 flex items-center justify-between z-30 bg-gradient-to-b from-black/90 via-black/40 to-transparent">
        <div className="flex items-center gap-2 text-xs font-sans text-zinc-300">
          <ShieldCheck className="w-4 h-4 text-[#00a884]" />
          <span>WhatsApp Şifrəli {isVideo ? 'Görüntülü' : 'Səsli'} Zəng</span>
        </div>
        <div className="text-xs font-mono-tech px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-zinc-700/60 text-[#00a884] font-bold">
          {activeCall.status === 'connected' ? formatDuration(callDuration) : connectionStatus}
        </div>
      </div>

      {/* Main Call Viewport */}
      <div className="flex-1 relative flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        {isVideo ? (
          /* VIDEO CALL VIEWPORT */
          <div className="relative w-full h-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-2xl">
            {/* Remote Video or Avatar placeholder */}
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#181a24] to-[#0d0e14] text-center p-6">
                <div className="w-32 h-32 rounded-full bg-zinc-800 border-3 border-[#00a884]/40 flex items-center justify-center text-5xl font-sans font-bold mb-4 uppercase text-zinc-200 shadow-2xl">
                  {activeCall.targetUser.slice(0, 2)}
                </div>
                <h4 className="text-2xl font-bold font-sans text-white">{activeCall.targetUser}</h4>
                <p className="text-xs text-zinc-400 font-sans mt-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse" />
                  <span>{connectionStatus}</span>
                </p>
              </div>
            )}

            {/* Local Video Picture-in-Picture */}
            <div className="absolute top-4 right-4 w-32 sm:w-44 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-zinc-600 bg-zinc-900 shadow-2xl z-20">
              {localStream && isVideoEnabled ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror scale-x-[-1]"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 text-xs font-sans gap-2">
                  <VideoOff className="w-6 h-6 text-zinc-600" />
                  <span>Kamera bağlıdır</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 text-[10px] font-sans bg-black/70 px-2 py-0.5 rounded-full text-white">
                Siz
              </div>
            </div>
          </div>
        ) : (
          /* VOICE CALL VIEWPORT */
          <div className="flex flex-col items-center text-center max-w-sm px-4">
            <div className="relative mb-6">
              {activeCall.status !== 'connected' && (
                <div className="absolute -inset-4 rounded-full bg-[#00a884]/20 animate-ping" />
              )}
              <div className="w-36 h-36 rounded-full bg-zinc-800 border-4 border-[#00a884] flex items-center justify-center text-5xl font-sans font-bold uppercase shadow-2xl relative z-10 text-white">
                {activeCall.targetUser.slice(0, 2)}
              </div>
            </div>
            <h2 className="text-3xl font-bold font-sans text-white mb-2">
              {activeCall.targetUser}
            </h2>
            <p className="text-sm font-sans text-zinc-400 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${activeCall.status === 'connected' ? 'bg-[#00a884]' : 'bg-amber-400 animate-pulse'}`} />
              <span>{activeCall.status === 'connected' ? formatDuration(callDuration) : connectionStatus}</span>
            </p>
          </div>
        )}
      </div>

      {/* WhatsApp Bottom Call Actions Bar */}
      <div className="p-6 sm:p-8 flex items-center justify-center gap-4 sm:gap-6 bg-gradient-to-t from-black via-zinc-950 to-transparent z-30">
        {/* Speaker Volume Toggle */}
        <button
          id="call-speaker-toggle-btn"
          type="button"
          onClick={toggleSpeaker}
          className={`w-13 h-13 rounded-full border flex items-center justify-center transition-transform active:scale-95 cursor-pointer ${
            isSpeakerMuted
              ? 'bg-zinc-800 border-amber-500/80 text-amber-400'
              : 'bg-zinc-900/90 border-zinc-700 text-white hover:bg-zinc-800'
          }`}
          title={isSpeakerMuted ? 'Dinamiki aç' : 'Dinamiki bağla'}
        >
          {isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        {/* Mute Microphone Toggle */}
        <button
          id="call-mute-btn"
          type="button"
          onClick={toggleMute}
          className={`w-13 h-13 rounded-full border flex items-center justify-center transition-transform active:scale-95 cursor-pointer ${
            isMuted
              ? 'bg-zinc-800 border-red-500/80 text-red-400'
              : 'bg-zinc-900/90 border-zinc-700 text-white hover:bg-zinc-800'
          }`}
          title={isMuted ? 'Mikrofonu aç' : 'Mikrofonu bağla'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Video Camera Toggle (if video call) */}
        {isVideo && (
          <>
            <button
              id="call-camera-toggle-btn"
              type="button"
              onClick={toggleVideo}
              className={`w-13 h-13 rounded-full border flex items-center justify-center transition-transform active:scale-95 cursor-pointer ${
                !isVideoEnabled
                  ? 'bg-zinc-800 border-red-500/80 text-red-400'
                  : 'bg-zinc-900/90 border-zinc-700 text-white hover:bg-zinc-800'
              }`}
              title={isVideoEnabled ? 'Kameranı söndür' : 'Kameranı yandır'}
            >
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            {/* Front/Back camera flip button for phones */}
            <button
              id="call-switch-camera-btn"
              type="button"
              onClick={switchCamera}
              className="w-13 h-13 rounded-full bg-zinc-900/90 border border-zinc-700 text-white hover:bg-zinc-800 flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
              title="Kameranı dəyiş (Ön/Arxa)"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          </>
        )}

        {/* End Call Button */}
        <button
          id="call-end-btn"
          type="button"
          onClick={() => onEndCall(callDuration)}
          className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 active:scale-90 text-white flex items-center justify-center shadow-2xl hover:shadow-red-600/50 transition-transform cursor-pointer"
          title="Zəngi bitir"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
};
