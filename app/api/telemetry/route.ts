import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 1. Pull the keys from the secure server environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables.");
}

// 2. Initialize the Supabase client using the master service_role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    // Parse the incoming JSON payload from the frontend page
    const body = await request.json();
    const { endpoint, agent, payload_size, status } = body;

    // 3. Execute the silent write to the database
    const { error } = await supabase
      .from('telemetry_logs')
      .insert([
        {
          agent: agent || 'Unknown Client',
          endpoint: endpoint || '/unknown-route',
          payload_size: payload_size || '0 bytes',
          status: status || '200 OK',
        }
      ]);

    // 4. Handle database rejection
    if (error) {
      console.error('[SUPABASE WRITE ERROR]:', error.message);
      return NextResponse.json({ error: 'Failed to log telemetry' }, { status: 500 });
    }

    // 5. Confirm successful ingestion
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('[API ROUTE ERROR]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}