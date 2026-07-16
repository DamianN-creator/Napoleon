import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

async function isShopOpen(): Promise<boolean> {
  const { data, error } = await supabase.from('cash_shifts').select('data');
  if (error || !data) return false;
  return data.some(row => (row.data as { status?: string } | null)?.status === 'open');
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const open = await isShopOpen();

  return new Response(JSON.stringify({ open }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
