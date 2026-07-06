import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function saveMessage(jid, role, content) {
    if (!supabase) return;
    try {
        const { error } = await supabase.from('messages').insert([{ jid, role, content }]);

        if (error) throw error;
    } catch (err) {
        console.error('Error saving message to Supabase:', err);
    }
}

export async function getHistory(jid, limit = 10) {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('role, content')
            .eq('jid', jid)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data.reverse();
    } catch (err) {
        console.error('Error fetching history:', err);
        return [];
    }
}

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
