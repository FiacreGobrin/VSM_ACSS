import React, { useState, useEffect } from 'react';
import {
  QrCode,
  FileText,
  UserCheck,
  Camera,
  Maximize2,
  Minimize2,
  ArrowRight,
  Shield,
  Building,
} from 'lucide-react';
import { TunnelStateBadge } from '../components/common/TunnelStateBadge';
import { useSystemStore } from '../stores/systemStore';

export const KioskPage: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [idleSeconds, setIdleSeconds] = useState(60);
  const [kioskStep, setKioskStep] = useState<'welcome' | 'scan' | 'verify' | 'badge'>('welcome');
  const { simulateTunnelVerification } = useSystemStore();

  // Kiosk auto-reset timer (60s countdown)
  useEffect(() => {
    const timer = setInterval(() => {
      setIdleSeconds((prev) => {
        if (prev <= 1) {
          setKioskStep('welcome');
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    const resetTimer = () => setIdleSeconds(60);
    window.addEventListener('touchstart', resetTimer);
    window.addEventListener('click', resetTimer);

    return () => {
      clearInterval(timer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleStartCheckin = async () => {
    setKioskStep('scan');
  };

  const handleScanComplete = async () => {
    setKioskStep('verify');
    await simulateTunnelVerification('National ID DB');
    setKioskStep('badge');
  };

  return (
    <div className="min-h-[85vh] bg-background border border-border rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden select-none bg-grid-tactical">
      {/* Top Kiosk Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/20 text-primary rounded-xl border border-primary/40">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-mono text-foreground">
              SOVEREIGN TOWER • SELF-SERVICE KIOSK
            </h2>
            <p className="text-xs text-muted-foreground">Touch-Optimized Air-Gapped Visitor Enclave</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-mono text-muted-foreground hidden sm:block">
            Auto-Reset: <span className="text-primary font-bold">{idleSeconds}s</span>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg transition-colors"
            title="Toggle Fullscreen Kiosk Mode"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Touch Area */}
      <div className="my-auto py-8 max-w-2xl mx-auto w-full text-center">
        {kioskStep === 'welcome' && (
          <div className="space-y-6 animate-in zoom-in-95">
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-full w-24 h-24 mx-auto flex items-center justify-center text-primary shadow-glow-primary">
              <Shield className="w-12 h-12" />
            </div>

            <div>
              <h1 className="text-3xl font-extrabold text-foreground font-mono">
                WELCOME TO SOVEREIGN TOWER
              </h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Please present your appointment QR pass or government-issued National ID / Passport
                to initiate touch check-in.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <button
                type="button"
                onClick={handleStartCheckin}
                className="p-6 bg-card hover:bg-primary/10 border-2 border-border hover:border-primary rounded-2xl flex flex-col items-center gap-3 transition-all text-foreground group"
              >
                <div className="p-3 rounded-full bg-secondary text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <QrCode className="w-8 h-8" />
                </div>
                <span className="font-mono font-bold text-sm">I HAVE A PRE-REGISTERED QR CODE</span>
                <span className="text-xs text-muted-foreground font-sans">
                  Tap to open optical pass scanner
                </span>
              </button>

              <button
                type="button"
                onClick={handleStartCheckin}
                className="p-6 bg-card hover:bg-primary/10 border-2 border-border hover:border-primary rounded-2xl flex flex-col items-center gap-3 transition-all text-foreground group"
              >
                <div className="p-3 rounded-full bg-secondary text-cyan-400 group-hover:bg-cyan-500 group-hover:text-black transition-colors">
                  <FileText className="w-8 h-8" />
                </div>
                <span className="font-mono font-bold text-sm">SCAN NATIONAL ID / PASSPORT</span>
                <span className="text-xs text-muted-foreground font-sans">
                  Tap to insert document into slot
                </span>
              </button>
            </div>
          </div>
        )}

        {kioskStep === 'scan' && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-bold font-mono text-foreground">
              INSERT DOCUMENT OR ALIGN QR CODE
            </h2>
            <p className="text-xs text-muted-foreground">
              Place passport photo page or National ID chip down onto the optical glass reader.
            </p>

            <div className="h-64 border-2 border-dashed border-primary/50 rounded-2xl bg-card/60 flex flex-col items-center justify-center p-6 relative">
              <div className="w-3/4 h-1 bg-primary animate-pulse absolute top-10" />
              <Camera className="w-12 h-12 text-primary/60 mb-3" />
              <span className="font-mono text-xs text-muted-foreground">
                OPTICAL SCANNER HARDWARE READY (VLAN 20)
              </span>

              <button
                type="button"
                onClick={handleScanComplete}
                className="mt-6 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-mono font-bold rounded-xl text-sm shadow-glow-primary transition-all flex items-center gap-2"
              >
                <span>SIMULATE DOCUMENT INSERTED</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setKioskStep('welcome')}
              className="text-xs font-mono text-muted-foreground hover:text-foreground"
            >
              ← Cancel & Return to Welcome Screen
            </button>
          </div>
        )}

        {kioskStep === 'verify' && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-bold font-mono text-foreground">
              CRYPTOGRAPHIC REGISTRY VALIDATION
            </h2>
            <p className="text-xs text-muted-foreground">
              Validating document validity via Outbound-Only Registry Tunnel...
            </p>

            <div className="p-6 bg-card border border-border rounded-2xl max-w-md mx-auto">
              <TunnelStateBadge state="VERIFYING" registryName="National ID DB" />
              <div className="mt-4 text-xs font-mono text-cyan-400 animate-pulse">
                Querying Government Registry Hash...
              </div>
            </div>
          </div>
        )}

        {kioskStep === 'badge' && (
          <div className="space-y-6 animate-in zoom-in-95">
            <div className="p-3 bg-emerald-950/70 border border-emerald-800 text-emerald-300 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
              <UserCheck className="w-8 h-8 text-emerald-400" />
            </div>

            <div>
              <h2 className="text-2xl font-bold font-mono text-emerald-400">
                CHECK-IN VERIFIED & APPROVED
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Your temporary electronic RFID badge is printing now below.
              </p>
            </div>

            <div className="p-4 bg-card border border-border rounded-xl font-mono text-xs max-w-sm mx-auto text-left space-y-1.5">
              <div>Visitor: <span className="text-foreground font-bold">Jean-Paul Gasana</span></div>
              <div>Host: <span className="text-foreground">Eng. Patrick Habimana</span></div>
              <div>Destination: <span className="text-primary font-bold">Floor 04 (Data Center)</span></div>
              <div>Elevator Assignment: <span className="text-amber-400 font-bold">Proceed to Car B</span></div>
            </div>

            <button
              type="button"
              onClick={() => setKioskStep('welcome')}
              className="px-6 py-3 bg-secondary hover:bg-secondary/80 text-foreground font-mono text-xs font-bold rounded-xl transition-colors"
            >
              Finish & Reset Kiosk
            </button>
          </div>
        )}
      </div>

      {/* Kiosk Footer */}
      <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-muted-foreground gap-2">
        <span>SECURITY ENCLAVE TERMINAL #KSK-04</span>
        <div className="flex items-center gap-2">
          <span>LANG: EN / RW / FR</span>
          <span>•</span>
          <span>EMERGENCY CALL: EXT 9911</span>
        </div>
      </div>
    </div>
  );
};
