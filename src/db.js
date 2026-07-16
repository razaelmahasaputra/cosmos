import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function addGroup(jid) {
    if (!supabase) return false;
    try {
        const { error } = await supabase.from('whitelisted_groups').upsert([{ jid }]);
        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Error adding group:', err);
        return false;
    }
}

export async function isGroupWhitelisted(jid) {
    if (!supabase) return true; // If no DB configured, allow all for testing
    try {
        const { data, error } = await supabase.from('whitelisted_groups').select('jid').eq('jid', jid).single();
        if (error) return false;
        return !!data;
    } catch {
        return false;
    }
}
