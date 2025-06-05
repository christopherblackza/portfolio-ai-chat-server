// src/supabase/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Use env variable instead of hardcoded

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
