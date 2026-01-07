import { useState } from 'react';
import '../App.css';
import { get_camp_distance, calculate_hub_nodes, get_camp_zone_connections } from '../utils/zoneUtils';

export default function ZonePanel({
  zones,
  current_zone_id,
  on_zone_change,
  available_zone_ids,
  camps = [],
  current_camp_id,
  on_camp_change,
  mob_distance,
  camp_area,
  zone_area,
  character_name = 'Player',
  user_id = 'anon',
  chat_input = '',
  messages = [],
  zone_users = [],
  chat_ref = null,
  set_chat_input = () => {},
  send_chat = () => {},
  handle_chat_submit = () => {},
  bg_url = '/stone-ui/zonepanelbacks/stock.png',
  is_loading_bg = false,
  zone_connections = [] // Array of {from_zone, to_zone} for current zone
}) {
  const currentZone = zones[current_zone_id] || { name: 'Unknown' };
  const biomeColors = {
    forest: '#8bc34a',
    desert: '#e0c080',
    snow: '#c8e2ff',
    swamp: '#7da87a',
    dungeon: '#d6c18a',
    city: '#ffd56a',
    evilcity: '#5a1a5f',
    plains: '#b4e197',
    mountain: '#c5b7a0',
    default: '#e2e8f0'
  };
  const zoneEntries = available_zone_ids.map((id) => [id, zones[id]]).filter(([, zone]) => zone);
  
  // Calculate camp distance using utility
  const campDistance = get_camp_distance(current_zone_id, camps, zone_area);

  const [hoverHub, setHoverHub] = useState(null);

  // Calculate hub nodes using utility
  const currentCamp = camps.find((c) => `${c.id}` === `${current_camp_id}`);
  
  // Get camp-specific zone connections
  const camp_zone_connections = get_camp_zone_connections(currentCamp, zone_connections);
  const connectedZoneIds = camp_zone_connections.map(conn => conn.to_zone);
  
  // Connected zones visual: simple pill list as primary, dropdown as backup
  const connectedEntries = camp_zone_connections.map((conn) => [conn.to_zone, zones[conn.to_zone]]).filter(([, z]) => z);
  
  const hubNodes = calculate_hub_nodes(camps, currentCamp, zone_connections, zones);
  
  // Update hub node labels with zone names
  hubNodes.forEach(node => {
    if (node.type === 'zone' && node.zone_id) {
      const zone = zones[node.zone_id];
      if (zone) {
        node.label = zone.name || node.zone_id;
      }
    }
  });

  const biomeColor = biomeColors[currentZone.biome] || biomeColors.default;

  return (
    <div
      className="relative overflow-hidden border-2 rounded-lg"
      style={{ minHeight: 640, borderColor: biomeColor }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(12,19,31,0.55), rgba(12,19,31,0.78)), url('${bg_url}')`,
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
            {current_camp_id ? (camps.find((c) => `${c.id}` === `${current_camp_id}`)?.name || 'Current') : 'No camp'}
          </div>
          {/* Hubs */}
          {hubNodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onMouseEnter={() => setHoverHub(node)}
              onMouseLeave={() => setHoverHub(null)}
              onClick={() => {
                if (node.type === 'camp') {
                  if (node.camp_id) {
                    on_camp_change(node.camp_id);
                  }
                }
                if (node.type === 'zone') {
                  const targetId = node.id.replace('zone-', '');
                  on_zone_change(targetId);
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
                  <div>Area: {Number(hoverHub.data?.camp_area || 0)}</div>
                  <div>XP mod: {Number(hoverHub.data?.camp_xp_mod || 1)}</div>
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
              Zone: {currentZone.name} · Zone area: {Number.isFinite(zone_area) ? zone_area : '—'} · Camp area: {Number.isFinite(camp_area) ? camp_area : '—'}
            </div>
            <div className="flex gap-3">
              <div className="flex-1 flex flex-col">
                <div
                  ref={chat_ref}
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
                  onSubmit={handle_chat_submit}
                >
                  <input
                    value={chat_input}
                    onChange={(e) => set_chat_input(e.target.value)}
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
                  {zone_users.length === 0 && <div className="text-[11px] text-gray-400">Nobody here yet</div>}
                  {zone_users.map((u, idx) => (
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
