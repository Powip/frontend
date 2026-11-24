/**
 * Audio de una llamada de WhatsApp en el navegador (Calling API de Meta).
 *
 * Meta no usa trickle ICE: la oferta/respuesta debe llevar los candidatos ya
 * reunidos. Si el navegador no tiene WebRTC, no hay micrófono o el SDP no es
 * válido (llamadas simuladas en local), se usa un SDP de prueba sin audio.
 */

export const SIMULATED_SDP =
  "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=powip-simulado\r\nt=0 0\r\n";

const ICE_GATHER_TIMEOUT_MS = 4000;
/** Si el permiso del micrófono queda sin respuesta, se sigue sin micrófono. */
const MIC_TIMEOUT_MS = 15000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export function webrtcSupported(): boolean {
  return typeof window !== "undefined" && typeof window.RTCPeerConnection === "function";
}

export class WhatsAppAudioCall {
  private pc: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;
  private audio: HTMLAudioElement | null = null;
  /** true si la llamada no tiene audio real (simulada o sin WebRTC). */
  fake = false;

  /** Micrófono de la vendedora (IA en vivo). Null en llamadas simuladas. */
  get localStream(): MediaStream | null {
    return this.fake ? null : this.stream;
  }

  /** Audio del cliente (IA en vivo). Null hasta que llega o en llamadas simuladas. */
  get remoteStream(): MediaStream | null {
    const src = this.audio?.srcObject;
    return !this.fake && src instanceof MediaStream ? src : null;
  }

  /** Llamada entrante: aplica la oferta del cliente y devuelve la respuesta. */
  async answer(offer: string | null | undefined, simulated = false): Promise<string> {
    if (simulated || !offer || !looksLikeSdp(offer) || !webrtcSupported()) return this.fallback();
    try {
      const pc = await this.setup();
      await pc.setRemoteDescription({ type: "offer", sdp: offer });
      await pc.setLocalDescription(await pc.createAnswer());
      return await this.gathered(pc);
    } catch {
      this.close();
      return this.fallback();
    }
  }

  /** Llamada saliente: crea la oferta que se envía a Meta. */
  async offer(simulated: boolean): Promise<string> {
    if (simulated || !webrtcSupported()) return this.fallback();
    try {
      const pc = await this.setup();
      await pc.setLocalDescription(await pc.createOffer({ offerToReceiveAudio: true }));
      return await this.gathered(pc);
    } catch {
      this.close();
      return this.fallback();
    }
  }

  /** Respuesta del cliente para una llamada saliente. false si no se pudo aplicar. */
  async applyAnswer(answer: string | null | undefined): Promise<boolean> {
    if (this.fake || !this.pc || !answer || !looksLikeSdp(answer)) return false;
    if (this.pc.signalingState !== "have-local-offer") return true;
    try {
      await this.pc.setRemoteDescription({ type: "answer", sdp: answer });
      return true;
    } catch {
      return false;
    }
  }

  setMuted(muted: boolean) {
    this.stream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }

  close() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    try {
      this.pc?.close();
    } catch {
      /* ya cerrada */
    }
    this.pc = null;
    if (this.audio) {
      this.audio.srcObject = null;
      this.audio = null;
    }
  }

  private fallback(): string {
    this.fake = true;
    return SIMULATED_SDP;
  }

  private async setup(): Promise<RTCPeerConnection> {
    this.close();
    this.fake = false;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    this.pc = pc;
    try {
      const pending = navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.stream = await withTimeout(pending, MIC_TIMEOUT_MS).catch((err) => {
        // Si el permiso llega tarde, se apaga ese micrófono.
        void pending.then((late) => late.getTracks().forEach((t) => t.stop())).catch(() => undefined);
        throw err;
      });
      this.stream.getTracks().forEach((t) => pc.addTrack(t, this.stream as MediaStream));
    } catch {
      // Sin micrófono: igual se escucha al cliente.
      pc.addTransceiver("audio", { direction: "recvonly" });
    }
    pc.ontrack = (ev) => {
      if (!this.audio) {
        this.audio = new Audio();
        this.audio.autoplay = true;
      }
      this.audio.srcObject = ev.streams[0] ?? new MediaStream([ev.track]);
      void this.audio.play().catch(() => undefined);
    };
    return pc;
  }

  private gathered(pc: RTCPeerConnection): Promise<string> {
    return new Promise((resolve) => {
      const done = () => resolve(pc.localDescription?.sdp ?? SIMULATED_SDP);
      if (pc.iceGatheringState === "complete") return done();
      const timer = setTimeout(done, ICE_GATHER_TIMEOUT_MS);
      pc.addEventListener("icegatheringstatechange", () => {
        if (pc.iceGatheringState === "complete") {
          clearTimeout(timer);
          done();
        }
      });
    });
  }
}

/** Un SDP real empieza con «v=0» y trae al menos una línea m= de audio. */
export function looksLikeSdp(sdp: string): boolean {
  return /^v=0/.test(sdp.trim()) && /\r?\nm=audio /.test(sdp);
}
