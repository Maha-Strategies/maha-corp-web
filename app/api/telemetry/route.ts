import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // 1. Pull the keys at runtime, preventing local build-time crashes
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[TELEMETRY ERROR] Missing Supabase environment variables.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // 2. Initialize the client securely inside the request lifecycle
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Parse the incoming JSON payload
    const body = await request.json();
    const { endpoint, agent, payload_size, status } = body;

    // 4. Execute the silent write to the database
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

    if (error) {
      console.error('[SUPABASE WRITE ERROR]:', error.message);
      return NextResponse.json({ error: 'Failed to log telemetry' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('[API ROUTE ERROR]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}