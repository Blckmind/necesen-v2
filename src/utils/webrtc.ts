// Real WebRTC Peer-to-Peer helper for Voice & Video calls
// Handles STUN negotiation, audio/video streams, canvas fallbacks, and track toggles

export interface PeerConnectionConfig {
  onRemoteStream: (stream: MediaStream) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ],
};

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private config: PeerConnectionConfig | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isMakingOffer: boolean = false;
  private canvasAnimationId: number | null = null;

  init(config: PeerConnectionConfig) {
    // If peer connection already exists in an open state, keep it unless cleaned up
    if (this.pc && this.pc.signalingState !== 'closed') {
      this.config = config;
      return;
    }

    this.cleanup();
    this.config = config;
    this.pendingCandidates = [];

    this.pc = new RTCPeerConnection(ICE_SERVERS);

    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.config) {
        this.config.onIceCandidate(event.candidate.toJSON());
      }
    };

    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0] && this.config) {
        this.config.onRemoteStream(event.streams[0]);
      } else if (event.track && this.config) {
        const newStream = new MediaStream([event.track]);
        this.config.onRemoteStream(newStream);
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc && this.config?.onConnectionStateChange) {
        this.config.onConnectionStateChange(this.pc.connectionState);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc && this.config?.onConnectionStateChange) {
        const iceState = this.pc.iceConnectionState;
        if (iceState === 'connected' || iceState === 'completed') {
          this.config.onConnectionStateChange('connected');
        } else if (iceState === 'disconnected' || iceState === 'failed') {
          this.config.onConnectionStateChange('failed');
        }
      }
    };
  }

  // Create a reliable silent/subtle WebAudio stream fallback
  createSilentAudioStream(): MediaStream {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001; // virtually inaudible keepalive
      oscillator.connect(gain);
      const dst = gain.connect(ctx.createMediaStreamDestination()) as any;
      oscillator.start();
      const track = dst.stream.getAudioTracks()[0];
      return new MediaStream([track]);
    } catch {
      return new MediaStream();
    }
  }

  // Create an animated canvas video stream fallback (for camera disabled / denied / testing)
  createCanvasVideoStream(username: string): MediaStream {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return new MediaStream();

      let frame = 0;
      const initials = (username || 'K').slice(0, 2).toUpperCase();

      const draw = () => {
        frame++;
        // Dark futuristic gradient background
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#0c1017');
        grad.addColorStop(1, '#151d28');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Pulsing radar rings
        const cx = canvas.width / 2;
        const cy = canvas.height / 2 - 20;
        const pulse = (Math.sin(frame * 0.05) + 1) / 2;

        ctx.strokeStyle = `rgba(0, 255, 102, ${0.15 + pulse * 0.25})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 70 + pulse * 25, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(0, 168, 132, 0.4)`;
        ctx.beginPath();
        ctx.arc(cx, cy, 60, 0, Math.PI * 2);
        ctx.stroke();

        // Center circle avatar
        ctx.fillStyle = '#1e2430';
        ctx.beginPath();
        ctx.arc(cx, cy, 55, 0, Math.PI * 2);
        ctx.fill();

        // Initials
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, cx, cy);

        // Username and Video Call label
        ctx.fillStyle = '#00ff66';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(username.toUpperCase(), cx, cy + 85);

        ctx.fillStyle = '#8e96a4';
        ctx.font = '12px sans-serif';
        ctx.fillText('Khami Görüntülü Zəng', cx, cy + 110);

        this.canvasAnimationId = requestAnimationFrame(draw);
      };

      draw();

      const stream = (canvas as any).captureStream ? (canvas as any).captureStream(25) : new MediaStream();
      return stream;
    } catch {
      return new MediaStream();
    }
  }

  async setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    if (!this.pc) return;

    const currentTracks = stream.getTracks();
    const senders = this.pc.getSenders();

    for (const track of currentTracks) {
      const existingSender = senders.find((s) => s.track && s.track.kind === track.kind);
      if (existingSender) {
        try {
          await existingSender.replaceTrack(track);
        } catch (e) {
          console.warn('Replace track note:', e);
        }
      } else {
        try {
          this.pc.addTrack(track, stream);
        } catch (e) {
          console.warn('Add track note:', e);
        }
      }
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) return null;
    try {
      this.isMakingOffer = true;
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      if (this.pc.signalingState !== 'stable' && this.pc.signalingState !== 'have-local-offer') {
        // wait or ignore
      }
      await this.pc.setLocalDescription(offer);
      this.isMakingOffer = false;
      return offer;
    } catch (err) {
      console.error('Error creating WebRTC offer:', err);
      this.isMakingOffer = false;
      return null;
    }
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) return null;
    try {
      if (this.pc.signalingState !== 'stable') {
        await Promise.all([
          this.pc.setLocalDescription({ type: 'rollback' } as any).catch(() => {})
        ]);
      }

      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
      await this.flushPendingCandidates();

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      return answer;
    } catch (err) {
      console.error('Error handling WebRTC offer:', err);
      return null;
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    try {
      if (this.pc.signalingState === 'have-local-offer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
        await this.flushPendingCandidates();
      }
    } catch (err) {
      console.error('Error handling WebRTC answer:', err);
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc) return;
    if (!this.pc.remoteDescription || !this.pc.remoteDescription.type) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('Error adding ICE candidate:', err);
    }
  }

  private async flushPendingCandidates() {
    if (!this.pc || !this.pc.remoteDescription) return;
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('Failed to add buffered ICE candidate:', err);
        }
      }
    }
  }

  cleanup() {
    if (this.canvasAnimationId) {
      cancelAnimationFrame(this.canvasAnimationId);
      this.canvasAnimationId = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }
    this.pendingCandidates = [];
    this.config = null;
    this.isMakingOffer = false;
  }
}

export const webrtcManager = new WebRTCManager();
