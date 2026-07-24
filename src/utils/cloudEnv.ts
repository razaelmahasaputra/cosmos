import { prisma } from '#/db.js';

/**
 * Dynamically loads environment variables stored in local SQLite 'AppConfig' table into process.env.
 */
export async function loadEnvFromSupabase(): Promise<number> {
    try {
        const data = await prisma.appConfig.findMany();

        let loadedCount = 0;
        for (const row of data) {
            if (row.key && row.value !== undefined) {
                process.env[row.key] = row.value;
                loadedCount++;
            }
        }

        if (loadedCount > 0) {
            console.log(`[CloudEnv] Successfully loaded ${loadedCount} environment variable(s) from local database.`);
        }
        return loadedCount;
    } catch (err) {
        console.error('[CloudEnv] Error loading environment variables from local database:', err);
        return 0;
    }
}

