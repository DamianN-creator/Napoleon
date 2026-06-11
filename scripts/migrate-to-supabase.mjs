import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY (correr con --env-file=.env.local)');
  process.exit(1);
}

const [, , backupPath] = process.argv;
if (!backupPath) {
  console.error('Uso: node --env-file=.env.local scripts/migrate-to-supabase.mjs <napoleon-backup-....json>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Mirrors TABLE_MAP in src/components/Settings.tsx
const TABLE_MAP = {
  'pizzeria-products': { type: 'table', table: 'products' },
  'pizzeria-orders': { type: 'table', table: 'orders' },
  'pizzeria-customers': { type: 'table', table: 'customers' },
  'pizzeria-cadetes': { type: 'table', table: 'cadetes' },
  'pizzeria-reports': { type: 'table', table: 'daily_reports' },
  'pizzeria-cash-shifts': { type: 'table', table: 'cash_shifts' },
  'pizzeria-completed-orders': { type: 'table', table: 'completed_orders' },
  'pizzeria-raw-materials': { type: 'table', table: 'raw_materials' },
  'pizzeria-stock-movements': { type: 'table', table: 'stock_movements' },
  'pizzeria-sub-products': { type: 'table', table: 'sub_products' },
  'pizzeria-extras': { type: 'table', table: 'extras' },
  'pizzeria-order-number': { type: 'setting', settingKey: 'currentOrderNumber' },
};

const backup = JSON.parse(readFileSync(backupPath, 'utf-8'));

for (const [key, raw] of Object.entries(backup)) {
  const cfg = TABLE_MAP[key];
  if (!cfg) {
    console.log(`Saltando clave desconocida: ${key}`);
    continue;
  }

  if (cfg.type === 'table') {
    const items = JSON.parse(raw);
    if (!Array.isArray(items) || items.length === 0) {
      console.log(`${cfg.table}: 0 registros`);
      continue;
    }
    const rows = items.map(item => ({ id: item.id, data: item, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from(cfg.table).upsert(rows);
    if (error) {
      console.error(`Error en ${cfg.table}:`, error.message);
    } else {
      console.log(`${cfg.table}: ${rows.length} registros migrados`);
    }
  } else {
    const value = JSON.parse(raw);
    const { error } = await supabase.from('app_settings').upsert({ key: cfg.settingKey, value, updated_at: new Date().toISOString() });
    if (error) {
      console.error(`Error en app_settings.${cfg.settingKey}:`, error.message);
    } else {
      console.log(`app_settings.${cfg.settingKey}: ${value}`);
    }
  }
}

console.log('Migración completa.');
