import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
};

const jsonResponse = (status, bodyObj) =>
  new Response(JSON.stringify(bodyObj), {
    status,
    headers: corsHeaders
  });

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return new Response('', { status: 200, headers: corsHeaders });
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const authHeader = event.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return jsonResponse(401, { error: 'Missing token' });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return jsonResponse(401, { error: 'Invalid token' });
    const userId = userData.user.id;

    const { data: roleRow, error: roleErr } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    if (roleErr || !roleRow || !['admin', 'dev', 'helper'].includes(roleRow.role)) {
      return jsonResponse(403, { error: 'Forbidden' });
    }

    const payload = JSON.parse(event.body || '{}');
    const { target, action = 'upsert', payload: data } = payload;

    const tableMap = {
      items: 'items',
      mob_templates: 'mob_templates',
      camps: 'camps',
      skills: 'skills',
      mob_loot: 'mob_loot',
      zone_spawns: 'zone_spawns',
      mob_pool_members: 'mob_pool_members',
      loot_tables: 'loot_tables',
      loot_table_entries: 'loot_table_entries'
    };
    const table = tableMap[target];
    if (!table) return jsonResponse(400, { error: 'Unknown target' });

    let res;
    let rows;
    if (action === 'delete') {
      if (!data?.id) return jsonResponse(400, { error: 'Delete requires id' });
      res = await supabase.from(table).delete().eq('id', data.id);
    } else {
      rows = Array.isArray(data) ? data : [data];
      res = await supabase.from(table).upsert(rows);
    }
    if (res.error) return jsonResponse(500, { error: res.error.message });

    return jsonResponse(200, { ok: true, table, action, count: res.count || rows?.length || 0 });
  } catch (err) {
    return jsonResponse(500, { error: err.message });
  }
};
