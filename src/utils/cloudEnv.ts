import { supabase } from '#/db.js';

/**
 * Dynamically loads environment variables stored in Supabase 'app_config' table into process.env.
 * Allows managing bot environment variables centrally in Supabase Cloud.
 */
export async function loadEnvFromSupabase(): Promise<number> {
    if (!supabase) return 0;
    try {
        const { data, error } = await supabase.from('app_config').select('key, value');
        if (error || !data) {
            // Table might not exist yet or no rows found
            return 0;
        }

        let loadedCount = 0;
        for (const row of data) {
            if (row.key && row.value !== undefined) {
                process.env[row.key] = row.value;
                loadedCount++;
            }
        }

        if (loadedCount > 0) {
            console.log(`[CloudEnv] Successfully loaded ${loadedCount} environment variable(s) from Supabase cloud.`);
        }
        return loadedCount;
    } catch (err) {
        console.error('[CloudEnv] Error loading environment variables from Supabase:', err);
        return 0;
    }
}
