import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export default async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const authHeader = event.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return { statusCode: 401, body: 'Missing token' };

    // verify user from token
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return { statusCode: 401, body: 'Invalid token' };
    const userId = userData.user.id;

    // check role
    const { data: roleRow, error: roleErr } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    if (roleErr || !roleRow || !['admin', 'dev', 'helper'].includes(roleRow.role)) {
      return { statusCode: 403, body: 'Forbidden' };
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
    if (!table) return { statusCode: 400, body: 'Unknown target' };

    let res;
    let rows;
    if (action === 'delete') {
      if (!data?.id) return { statusCode: 400, body: 'Delete requires id' };
      res = await supabase.from(table).delete().eq('id', data.id);
    } else {
      rows = Array.isArray(data) ? data : [data];
      res = await supabase.from(table).upsert(rows);
    }
    if (res.error) return { statusCode: 500, body: res.error.message };

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, table, action, count: res.count || rows?.length || 0 })
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
}
