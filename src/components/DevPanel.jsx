import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const sections = {
  items: {
    label: 'Items',
    fields: [
      'id', 'name', 'slot', 'description',
      'damage', 'delay', 'haste_bonus',
      'hp_bonus', 'mana_bonus', 'str_bonus', 'sta_bonus', 'agi_bonus', 'dex_bonus', 'int_bonus', 'wis_bonus', 'cha_bonus',
      'ac_bonus'
    ]
  },
  camps: {
    label: 'Camps',
    fields: ['id', 'zone_id', 'name', 'tier', 'notes']
  },
  mob_templates: {
    label: 'Mob Templates',
    fields: ['id', 'name', 'hp', 'damage', 'xp', 'is_named', 'tags', 'ac', 'mr', 'fr', 'cr', 'pr', 'dr']
  },
  skills: {
    label: 'Skills',
    fields: ['id', 'name', 'type', 'description', 'cooldown_seconds', 'required_level', 'tags']
  },
  mob_pool_members: {
    label: 'Mob Pool Members',
    fields: ['pool_id', 'mob_id', 'weight']
  },
  zone_spawns: {
    label: 'Zone Spawns',
    fields: ['id', 'zone_id', 'camp_id', 'pool_id']
  },
  loot_tables: {
    label: 'Loot Tables',
    fields: ['id', 'name']
  },
  loot_table_entries: {
    label: 'Loot Table Entries',
    fields: ['loot_table_id', 'item_id', 'drop_chance', 'min_qty', 'max_qty']
  }
};

const canWrite = (role) => ['admin', 'dev', 'helper'].includes(role);

export default function DevPanel({ userRole }) {
  const [section, setSection] = useState('items');
  const [form, setForm] = useState({});
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const fields = useMemo(() => sections[section]?.fields || [], [section]);

  useEffect(() => {
    if (!canWrite(userRole)) return;
    refresh();
    setForm({});
    setSelectedId(null);
  }, [section, userRole]);

  const refresh = async () => {
    setLoading(true);
    setStatus('');
    try {
      const { data, error } = await supabase.from(section).select('*').limit(50);
      if (error) throw error;
      setRows(data || []);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submit = async (action) => {
    if (!canWrite(userRole)) return;
    setStatus('Working...');
    try {
      const payload = { ...form };
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '') delete payload[k];
      });
      const body = JSON.stringify({
        target: section,
        action,
        payload
      });
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !sessionData?.session?.access_token) {
        setStatus('No session token');
        return;
      }

      const endpoint = import.meta.env.VITE_ADMIN_PROXY_URL || '/.netlify/functions/admin-proxy';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body
      });
      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (_e) {
        json = null;
      }
      if (!res.ok) {
        const msg = json?.error || json?.message || text || 'Request failed';
        setStatus(`Error ${res.status}: ${msg}`);
        return;
      }
      setStatus('OK');
      setForm({});
      setSelectedId(null);
      refresh();
    } catch (err) {
      setStatus(err.message);
    }
  };

  if (!canWrite(userRole)) return null;

  return (
    <div className="bg-slate-800 border-2 border-green-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-green-300">Dev Panel</h2>
        <div className="text-sm text-gray-300">Role: {userRole}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        {Object.entries(sections).map(([key, info]) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`px-3 py-2 rounded text-sm font-semibold ${
              section === key ? 'bg-green-700 text-white' : 'bg-slate-700 text-gray-200'
            }`}
          >
            {info.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 text-sm text-gray-200 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {fields.map((f) => (
            <div key={f} className="flex flex-col">
              <label className="text-xs text-gray-400">{f}</label>
              <input
                className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs"
                value={form[f] ?? ''}
                onChange={(e) => setForm({ ...form, [f]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            onClick={() => {
              setForm({});
              setSelectedId(null);
              setStatus('Cleared');
            }}
            className="bg-slate-600 hover:bg-slate-500 text-white font-semibold px-4 py-2 rounded"
          >
            New
          </button>
          <button
            onClick={() => {
              if (!selectedId) return;
              const cloned = { ...form };
              delete cloned.id;
              setForm(cloned);
              setSelectedId(null);
              setStatus('Cloned (id cleared)');
            }}
            className="bg-slate-600 hover:bg-slate-500 text-white font-semibold px-4 py-2 rounded"
          >
            Clone (clear id)
          </button>
          <button
            onClick={() => submit('upsert')}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded"
          >
            Save/Upsert
          </button>
          <button
            onClick={() => submit('delete')}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded"
          >
            Delete (by id)
          </button>
          <button
            onClick={refresh}
            className="bg-slate-600 hover:bg-slate-500 text-white font-semibold px-4 py-2 rounded"
          >
            Refresh
          </button>
        </div>
        {status && <div className="text-xs text-gray-300">Status: {status}</div>}
      </div>

      <div className="text-xs text-gray-300">
        <div className="font-semibold mb-1">Current {sections[section]?.label} (first 50)</div>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-auto bg-slate-900 border border-slate-700 p-2 rounded">
            {rows.map((r) => (
              <div
                key={r.id || JSON.stringify(r)}
                className={`p-2 rounded cursor-pointer ${selectedId === r.id ? 'bg-slate-700 border border-green-600' : 'bg-slate-800 border border-slate-700'}`}
                onClick={() => {
                  setForm(r);
                  setSelectedId(r.id || null);
                  setStatus(`Loaded ${r.id || ''}`);
                }}
              >
                <div className="font-semibold text-white">{r.name || r.id || '(no name)'}</div>
                <div className="text-gray-400">{r.id || ''}</div>
              </div>
            ))}
            {!rows.length && <div className="text-gray-500">No rows.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
