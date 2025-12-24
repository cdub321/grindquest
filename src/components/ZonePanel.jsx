import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import '../App.css';

export default function ZonePanel({
  zones,
  currentZoneId,
  onZoneChange,
  availableZoneIds,
  camps = [],
  currentCampId,
  onCampChange,
  mobDistance,
  campArea,
  zoneArea,
  characterName = 'Player',
  userId = 'anon'
}) {
  const currentZone = zones[currentZoneId] || { name: 'Unknown', connections: [], levelRange: null };
  const biomeColors = {
    forest: '#8bc34a',
    desert: '#e0c080',
    snow: '#c8e2ff',
    swamp: '#7da87a',
    dungeon: '#d6c18a',
    city: '#ffd56a',
    plains: '#b4e197',
    mountain: '#c5b7a0',
    default: '#e2e8f0'
  };
  const zoneEntries = availableZoneIds.map((id) => [id, zones[id]]).filter(([, zone]) => zone);
  const totalCampArea = camps.reduce(
    (sum, camp) => sum + Number(camp.camp_area ?? camp.campArea ?? 0),
    0
  );
  const campDistance = (() => {
    if (!camps.length) return 0;
    const leftover = Math.max(0, Number(zoneArea ?? 0) - totalCampArea);
    return Math.round(leftover / camps.length);
  })();

  const [bgUrl, setBgUrl] = useState('/stone-ui/zonepanelbacks/stock.png');
  const bgTokenRef = useRef(0);

  // Background art loader with variant fallback
  useEffect(() => {
    const token = Date.now() + Math.random();
    bgTokenRef.current = token;
    const zoneId = currentZoneId || 'stock';
    const zoneCandidates = [zoneId, `${zoneId}1`, `${zoneId}2`, `${zoneId}3`, `${zoneId}4`];
    const stockCandidates = ['stock', 'stock1', 'stock2', 'stock3', 'stock4'];

    const tryList = (list, fallbackList) => {
      if (!list.length) {
        if (fallbackList) {
          tryList(fallbackList, null);
          return;
        }
        if (bgTokenRef.current === token) setBgUrl('/stone-ui/zonepanelbacks/stock.png');
        return;
      }
      const [candidate, ...rest] = list;
      const img = new Image();
      img.onload = () => {
        if (bgTokenRef.current !== token) return;
        setBgUrl(`/stone-ui/zonepanelbacks/${candidate}.png`);
      };
      img.onerror = () => {
        tryList(rest, fallbackList);
      };
      img.src = `/stone-ui/zonepanelbacks/${candidate}.png`;
    };

    tryList(zoneCandidates, stockCandidates);
  }, [currentZoneId]);

  // Zone chat state
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [zoneUsers, setZoneUsers] = useState([]);
  const chatRef = useRef(null);
  const channelRef = useRef(null);
  const [hoverHub, setHoverHub] = useState(null);

  useEffect(() => {
    if (!currentZoneId || !supabase) return undefined;

    const channelName = `zone_chat:${currentZoneId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: userId || characterName || 'anon' }
      }
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).map((entries) => entries[0]?.user || 'Unknown');
        setZoneUsers(users);
      })
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        if (!payload) return;
        setMessages((prev) => [...prev.slice(-99), payload]);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user: characterName || 'Player' });
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [characterName, currentZoneId, userId]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || !currentZoneId) return;
    setChatInput('');
    const payload = {
      user: characterName || 'Player',
      text,
      ts: Date.now()
    };
    const channel = channelRef.current || supabase.channel(`zone_chat:${currentZoneId}`);
    // Broadcast to the current zone channel; relies on Supabase realtime (no table needed)
    await channel.send({
      type: 'broadcast',
      event: 'message',
      payload
    });
  };

  // Connected zones visual: simple pill list as primary, dropdown as backup
  const connectedEntries = (currentZone.connections || []).map((id) => [id, zones[id]]).filter(([, z]) => z);

  const hubNodes = (() => {
    const currentCamp = camps.find((c) => `${c.id}` === `${currentCampId}`);
    const campConnections = (currentCamp?.connections || []).map((id) => `${id}`);
    const isZoneLineCamp =
      campConnections.includes('zoneline') ||
      currentCamp?.zone_line ||
      currentCamp?.is_zone_line ||
      currentCamp?.isZoneLine ||
      currentCamp?.type === 'zoneline';
    const filteredCampConnections = campConnections.filter((id) => id !== 'zoneline');
    const otherCamps = camps.filter(
      (c) => `${c.id}` !== `${currentCampId}` && filteredCampConnections.includes(`${c.id}`)
    );
    const zoneLineNodes = isZoneLineCamp
      ? connectedEntries.map(([id, zone]) => ({
          id: `zone-${id}`,
          label: zone.name || id,
          type: 'zone'
        }))
      : [];
    const spokeCount = otherCamps.length + zoneLineNodes.length;
    const radius = 110;
    const nodes = [];
    let idx = 0;
    otherCamps.forEach((camp) => {
      const angle = (2 * Math.PI * idx) / Math.max(1, spokeCount);
      nodes.push({
        id: `camp-${camp.id}`,
        label: camp.name || camp.id,
        type: 'camp',
        campId: camp.id,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        data: camp
      });
      idx += 1;
    });
    zoneLineNodes.forEach((node) => {
      const angle = (2 * Math.PI * idx) / Math.max(1, spokeCount);
      nodes.push({
        ...node,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      });
      idx += 1;
    });
    return nodes;
  })();

  const biomeColor = biomeColors[currentZone.biome] || biomeColors.default;

  return (
    <div
      className="relative overflow-hidden border-2 rounded-lg"
      style={{ minHeight: 640, borderColor: biomeColor }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(12,19,31,0.55), rgba(12,19,31,0.78)), url('${bgUrl}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          height: '75%'
        }}
      />
      <div className="relative p-4 space-y-4 z-10 pb-72" style={{ minHeight: '75%' }}>

        <div className="relative w-full h-64 flex items-center justify-center overflow-visible">
          {/* Center hub */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-2 text-xs text-white bg-blue-800/80 border border-blue-500 rounded-full text-center shadow"
          >
            {currentCampId ? (camps.find((c) => `${c.id}` === `${currentCampId}`)?.name || 'Current') : 'No camp'}
          </div>
          {/* Hubs */}
          {hubNodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onMouseEnter={() => setHoverHub(node)}
              onMouseLeave={() => setHoverHub(null)}
              onClick={() => {
                if (node.type === 'camp') onCampChange(node.campId);
                if (node.type === 'zone') {
                  const targetId = node.id.replace('zone-', '');
                  onZoneChange(targetId);
                }
              }}
              className={`absolute px-2 py-1 text-[11px] rounded-full border shadow ${
                node.type === 'camp'
                  ? 'bg-emerald-800/80 border-emerald-500 text-white hover:border-emerald-300'
                  : 'bg-purple-800/80 border-purple-400 text-white hover:border-purple-300'
              }`}
              style={{
                left: `calc(50% + ${node.x}px)`,
                top: `calc(50% + ${node.y}px)`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              {node.label}
            </button>
          ))}
          {hoverHub && (
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 translate-y-full bg-slate-900/90 text-xs text-gray-100 border border-blue-900 rounded p-2 w-64 shadow-lg pointer-events-none">
              <div className="font-semibold text-blue-200 mb-1">{hoverHub.label}</div>
              {hoverHub.type === 'camp' && (
                <>
                  <div>Area: {Number(hoverHub.data?.camp_area ?? hoverHub.data?.campArea ?? 0)}</div>
                  <div>XP mod: {Number(hoverHub.data?.camp_xp_mod ?? hoverHub.data?.xp_mod ?? 1)}</div>
                </>
              )}
              {hoverHub.type === 'zone' && (
                <div className="text-gray-300">Zone line</div>
              )}
            </div>
          )}
        </div>

      </div>

      <div className="absolute inset-x-0 bottom-0 z-20">
          <div
            className="rounded-t-lg p-3 flex flex-col"
            style={{
              borderTop: `2px solid ${biomeColor}`,
              backgroundImage: "var(--bg-stone-tex)",
              backgroundSize: 'cover',
              backgroundColor: 'rgba(0,0,0,0.75)'
            }}
          >
            <div className="text-xs text-gray-200 mb-2">
              Zone: {currentZone.name} · Zone area: {Number.isFinite(zoneArea) ? zoneArea : '—'} · Camp area: {Number.isFinite(campArea) ? campArea : '—'}
            </div>
            <div className="flex gap-3">
              <div className="flex-1 flex flex-col">
                <div
                  ref={chatRef}
                  className="flex-1 min-h-[140px] max-h-48 overflow-y-auto bg-slate-800/60 rounded p-2 space-y-1 text-sm text-gray-100"
                >
                  {messages.length === 0 && <div className="text-xs text-gray-400">No messages</div>}
                  {messages.map((m, idx) => (
                    <div key={`${m.ts || idx}-${m.user}`}>
                      <span className="text-blue-300 mr-2">{m.user}:</span>
                      <span>{m.text}</span>
                    </div>
                  ))}
                </div>
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendChat();
                  }}
                >
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 bg-slate-800/70 rounded px-2 py-1 text-white text-sm"
                    placeholder="Send a message..."
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 rounded bg-blue-700 text-white text-sm border border-blue-500 hover:bg-blue-600"
                  >
                    Send
                  </button>
                </form>
              </div>
              <div
                className="w-44 bg-slate-800/60 rounded p-2"
              >
                <div className="text-xs text-blue-200 mb-1">In Zone</div>
                <div className="space-y-1 text-xs text-gray-100">
                  {zoneUsers.length === 0 && <div className="text-[11px] text-gray-400">Nobody here yet</div>}
                  {zoneUsers.map((u, idx) => (
                    <div key={`${u}-${idx}`} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                      <span>{u}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
