import React from 'react';
import { Car } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

export const GateAnprPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div>
          <h1 className="text-xl font-bold font-mono text-foreground tracking-tight">
            GATE & AUTOMATIC NUMBER PLATE RECOGNITION (ANPR)
          </h1>
          <p className="text-xs text-muted-foreground">
            Perimeter vehicle barriers, optical plate ingestion & instant blacklist match engine
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status="online" label="4 BARRIERS ACTIVE" />
        </div>
      </div>

      {/* Live Read Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-bold font-mono text-foreground mb-3 flex items-center justify-between">
            <span>PERIMETER ENTRY: GATE 01 NORTH (ANPR-CAM-01)</span>
            <span className="text-xs text-emerald-400 font-mono">LIVE STREAM 30 FPS</span>
          </h2>

          <div className="h-72 bg-black rounded-lg border border-border flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
            <div className="text-center font-mono text-xs text-muted-foreground">
              <Car className="w-16 h-16 mx-auto mb-2 text-primary/40" />
              <span>HIKVISION 8MP ANPR OCR STREAM (VLAN 10)</span>
            </div>

            {/* Bounding Box Simulation */}
            <div className="absolute bottom-6 left-6 p-3 bg-black/90 border border-emerald-500 rounded text-left font-mono">
              <div className="text-[10px] text-muted-foreground">RECOGNIZED PLATE:</div>
              <div className="text-xl font-extrabold text-emerald-400 tracking-wider">RAD 418 B</div>
              <div className="text-[10px] text-emerald-300 mt-0.5">MATCH: PRE-REGISTERED VISITOR</div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold rounded">
                Raise North Barrier
              </button>
              <button className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold rounded">
                Lower Barrier / Interlock
              </button>
            </div>
            <span className="text-xs font-mono text-muted-foreground">BARRIER: OPEN (AUTO)</span>
          </div>
        </div>

        {/* Recent Vehicle Log */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase text-foreground mb-3">
              Recent Plate Ingestion Feed
            </h3>
            <div className="space-y-2 font-mono text-xs">
              <div className="p-2.5 rounded bg-background border border-border flex items-center justify-between">
                <div>
                  <div className="font-bold text-foreground">RAD 418 B</div>
                  <div className="text-[10px] text-muted-foreground">Toyota RAV4 • Gate 01</div>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/70 text-emerald-300 border border-emerald-800">
                  ALLOWED
                </span>
              </div>

              <div className="p-2.5 rounded bg-background border border-rose-900/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-rose-400">RAC 990 K</div>
                  <div className="text-[10px] text-muted-foreground">Mercedes Sedan • Gate 02</div>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800 animate-pulse">
                  BLACKLIST
                </span>
              </div>
            </div>
          </div>

          <button className="w-full mt-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-mono text-xs rounded transition-colors">
            Search Vehicle Log History
          </button>
        </div>
      </div>
    </div>
  );
};
