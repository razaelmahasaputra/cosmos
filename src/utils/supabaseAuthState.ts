import { SupabaseClient } from '@supabase/supabase-js';
import {
    AuthenticationCreds,
    AuthenticationState,
    BufferJSON,
    initAuthCreds,
    proto,
    SignalDataTypeMap,
    SignalDataSet
} from '@whiskeysockets/baileys';

export interface SupabaseAuthStateOptions {
    tableName?: string;
    sessionCategory?: string;
}

/**
 * Custom authentication state handler for Baileys using Supabase Cloud Database.
 * Stores credentials and session keys in a Supabase table.
 */
export async function useSupabaseAuthState(
    supabase: SupabaseClient,
    sessionCategory: string = 'default',
    tableName: string = 'whatsapp_auth'
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
    const fixId = (id: string): string => `${sessionCategory}_${id.replace(/\//g, '__').replace(/:/g, '-')}`;

    const readData = async (id: string): Promise<any> => {
        try {
            const fullId = fixId(id);
            const { data, error } = await supabase.from(tableName).select('value').eq('id', fullId).maybeSingle();

            if (error || !data || !data.value) {
                return null;
            }

            const rawStr = typeof data.value === 'string' ? data.value : JSON.stringify(data.value);
            return JSON.parse(rawStr, BufferJSON.reviver);
        } catch (err) {
            console.error(`[SupabaseAuth] Error reading key "${id}":`, err);
            return null;
        }
    };

    const writeData = async (id: string, value: any): Promise<void> => {
        try {
            const fullId = fixId(id);
            const serialized = JSON.stringify(value, BufferJSON.replacer);
            const parsedValue = JSON.parse(serialized);

            const { error } = await supabase.from(tableName).upsert({
                id: fullId,
                value: parsedValue,
                updated_at: new Date().toISOString()
            });

            if (error) {
                console.error(`[SupabaseAuth] Error writing key "${id}":`, error);
            }
        } catch (err) {
            console.error(`[SupabaseAuth] Exception writing key "${id}":`, err);
        }
    };

    const removeData = async (id: string): Promise<void> => {
        try {
            const fullId = fixId(id);
            const { error } = await supabase.from(tableName).delete().eq('id', fullId);

            if (error) {
                console.error(`[SupabaseAuth] Error removing key "${id}":`, error);
            }
        } catch (err) {
            console.error(`[SupabaseAuth] Exception removing key "${id}":`, err);
        }
    };

    const creds: AuthenticationCreds = (await readData('creds.json')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
                    const data: { [id: string]: SignalDataTypeMap[T] } = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}.json`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value as SignalDataTypeMap[T];
                        })
                    );
                    return data;
                },
                set: async (data: SignalDataSet) => {
                    const tasks: Promise<void>[] = [];
                    for (const category in data) {
                        const categoryKey = category as keyof SignalDataTypeMap;
                        const categoryData = data[categoryKey];
                        if (!categoryData) continue;
                        for (const id of Object.keys(categoryData)) {
                            const value = categoryData[id];
                            const file = `${category}-${id}.json`;
                            tasks.push(value ? writeData(file, value) : removeData(file));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async (): Promise<void> => {
            await writeData('creds.json', creds);
        }
    };
}
