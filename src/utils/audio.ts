// Web Audio API synthesized sound generator for realistic WhatsApp-like alerts & ringtones
class SoundManager {
  private ctx: AudioContext | null = null;
  private ringInterval: any = null;
  private ringbackInterval: any = null;

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Soft WhatsApp message sent tick
  playMessageSent() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Audio playback silenced if not allowed
    }
  }

  // WhatsApp incoming message notification
  playMessageReceived() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.5, ctx.currentTime + 0.07); // E6
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.07);
      osc2.start(ctx.currentTime + 0.07);
      osc2.stop(ctx.currentTime + 0.22);
    } catch {
      // Ignore
    }
  }

  // WhatsApp melodious incoming call ringtone (marimba/chime)
  startRinging() {
    this.stopRinging();
    this.stopRingback();
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const playRingBurst = () => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        // Classic WhatsApp marimba melodic phrase
        const notes = [659.25, 587.33, 523.25, 659.25, 783.99, 659.25];
        notes.forEach((freq, idx) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const startTime = now + (idx * 0.15);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0.12, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(startTime);
          osc.stop(startTime + 0.3);
        });
      };
      playRingBurst();
      this.ringInterval = setInterval(playRingBurst, 2200);
    } catch {
      // Ignore
    }
  }

  stopRinging() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }

  // WhatsApp outgoing dialing ringback tone (Standard 425Hz European phone ringback beep: tuuuut... tuuuut)
  startRingback() {
    this.stopRingback();
    this.stopRinging();
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const playTone = () => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(425, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
        gain.gain.setValueAtTime(0.08, now + 1.1);
        gain.gain.linearRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 1.25);
      };
      playTone();
      this.ringbackInterval = setInterval(playTone, 3000);
    } catch {
      // Ignore
    }
  }

  stopRingback() {
    if (this.ringbackInterval) {
      clearInterval(this.ringbackInterval);
      this.ringbackInterval = null;
    }
  }

  // Call connected chime (Ascending gentle two-tone)
  playCallConnected() {
    this.stopRinging();
    this.stopRingback();
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.15); // C6
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch {
      // Ignore
    }
  }

  // Call ended beep (WhatsApp triple short end tone)
  playCallEnd() {
    this.stopRinging();
    this.stopRingback();
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const beeps = [0, 0.14, 0.28];
      beeps.forEach((delay) => {
        if (!ctx) return;
        const now = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.11);
      });
    } catch {
      // Ignore
    }
  }
}

export const soundManager = new SoundManager();
