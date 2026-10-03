import { create } from 'zustand';
import { OutboundTunnelStatus, SystemConnectionStatus, VlanStatus } from '../types/system';

interface SystemStoreState {
  connection: SystemConnectionStatus;
  tunnels: OutboundTunnelStatus[];
  vlans: VlanStatus[];

  // Actions
  simulateTunnelVerification: (targetRegistry: string) => Promise<boolean>;
  setBackendStatus: (online: boolean) => void;
  setWsStatus: (connected: boolean, reconnecting?: boolean) => void;
  setStaleData: (isStale: boolean) => void;
}

const INITIAL_TUNNELS: OutboundTunnelStatus[] = [
  {
    id: 'tun-natid',
    name: 'National Identity Verification Gate',
    targetRegistry: 'National ID DB',
    state: 'CLOSED',
    direction: 'OUTBOUND_ONLY',
    activeRequests: 0,
    uptimeSeconds: 86400,
    lastVerifiedAt: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 'tun-pass',
    name: 'ICAO PKD Passport Validation Tunnel',
    targetRegistry: 'Passport Global System',
    state: 'CLOSED',
    direction: 'OUTBOUND_ONLY',
    activeRequests: 0,
    uptimeSeconds: 86400,
    lastVerifiedAt: new Date(Date.now() - 360000).toISOString(),
  },
  {
    id: 'tun-veh',
    name: 'Transport Authority Vehicle Plate Tunnel',
    targetRegistry: 'Vehicle License DB',
    state: 'CLOSED',
    direction: 'OUTBOUND_ONLY',
    activeRequests: 0,
    uptimeSeconds: 86400,
    lastVerifiedAt: new Date(Date.now() - 600000).toISOString(),
  },
];

const INITIAL_VLANS: VlanStatus[] = [
  {
    vlan: 10,
    name: 'VLAN 10: CCTV & Video Streams',
    subnet: '10.10.0.0/16',
    description: '500 Hikvision 8MP 4K Streams with Edge Analytics',
    deviceCount: 500,
    onlineCount: 494,
    bandwidthMbps: 3820,
    packetLossPercent: 0.02,
  },
  {
    vlan: 20,
    name: 'VLAN 20: Access Control & Terminals',
    subnet: '10.20.0.0/20',
    description: '100 Door Controllers, Turnstiles & MinMoe Face Units',
    deviceCount: 100,
    onlineCount: 99,
    bandwidthMbps: 45,
    packetLossPercent: 0.0,
  },
  {
    vlan: 30,
    name: 'VLAN 30: Otis Compass Elevators',
    subnet: '10.30.0.0/24',
    description: '8 High-Speed Destination Dispatch Elevator Cars',
    deviceCount: 8,
    onlineCount: 8,
    bandwidthMbps: 12,
    packetLossPercent: 0.0,
  },
  {
    vlan: 40,
    name: 'VLAN 40: Dell AI Nodes & SAN Storage',
    subnet: '10.40.0.0/20',
    description: '3 PowerEdge AI Nodes (12 A100 GPUs) & 1.1 PB SAN Fabric',
    deviceCount: 24,
    onlineCount: 24,
    bandwidthMbps: 8400,
    packetLossPercent: 0.01,
  },
];

export const useSystemStore = create<SystemStoreState>((set, get) => ({
  connection: {
    backendOnline: true,
    backendLatencyMs: 4,
    wsConnected: true,
    wsReconnecting: false,
    lastHeartbeat: new Date().toISOString(),
    isStaleData: false,
    activeVlan: 'VLAN 20 (Sec-Mgmt)',
    encryptionMode: 'TLS_1_3_AIRGAP_LAN',
  },
  tunnels: INITIAL_TUNNELS,
  vlans: INITIAL_VLANS,

  simulateTunnelVerification: async (targetRegistry: string) => {
    // 1. OPENING
    set({
      tunnels: get().tunnels.map((t) =>
        t.targetRegistry === targetRegistry
          ? { ...t, state: 'OPENING', activeRequests: t.activeRequests + 1 }
          : t
      ),
    });

    await new Promise((res) => setTimeout(res, 600));

    // 2. VERIFYING
    set({
      tunnels: get().tunnels.map((t) =>
        t.targetRegistry === targetRegistry ? { ...t, state: 'VERIFYING' } : t
      ),
    });

    await new Promise((res) => setTimeout(res, 900));

    // 3. CLOSED (Strict Outbound Security: Never left open!)
    set({
      tunnels: get().tunnels.map((t) =>
        t.targetRegistry === targetRegistry
          ? {
              ...t,
              state: 'CLOSED',
              activeRequests: Math.max(0, t.activeRequests - 1),
              lastVerifiedAt: new Date().toISOString(),
            }
          : t
      ),
    });

    return true;
  },

  setBackendStatus: (online: boolean) => {
    set((state) => ({
      connection: { ...state.connection, backendOnline: online },
    }));
  },

  setWsStatus: (connected: boolean, reconnecting = false) => {
    set((state) => ({
      connection: {
        ...state.connection,
        wsConnected: connected,
        wsReconnecting: reconnecting,
      },
    }));
  },

  setStaleData: (isStale: boolean) => {
    set((state) => ({
      connection: { ...state.connection, isStaleData: isStale },
    }));
  },
}));
