import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environmental keys out of our secure .env file
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Establish the secure connection instance
export const supabase = createClient(supabaseUrl, supabaseKey);
