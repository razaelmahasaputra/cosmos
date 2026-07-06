import axios from 'axios';
import { writeLog } from '../logger.js';
export const definition = {
    name: 'web_search',
    description:
        'Mencari informasi terbaru atau real-time dari internet (seperti berita, cuaca terkini yang kompleks, harga, atau fakta spesifik).',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Kata kunci pencarian, misalnya "Harga emas hari ini" atau "Berita terbaru Indonesia".'
            }
        },
        required: ['query']
    }
};

export async function execute({ query }) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return 'Gagal: TAVILY_API_KEY tidak dikonfigurasi di server.';

    try {
        const response = await axios.post('https://api.tavily.com/search', {
            api_key: apiKey,
            query: query,
            search_depth: 'basic',
            include_answer: true,
            max_results: 3
        });

        writeLog('INFO', `[web_search] Success getting results from Tavily`, {
            query,
            resultsCount: response.data.results?.length
        });

        if (response.data && response.data.answer) {
            return `Hasil Pencarian untuk "${query}":\n\n${response.data.answer}`;
        } else if (response.data && response.data.results) {
            const results = response.data.results.map((r) => `- ${r.title}: ${r.content}`).join('\n');
            return `Hasil Pencarian untuk "${query}":\n\n${results}`;
        }

        return 'Tidak ada hasil pencarian yang relevan ditemukan.';
    } catch (error) {
        console.error('[Web Search Tool Error]', error.response?.data || error.message);
        return 'Terjadi kesalahan saat mencari informasi di internet.';
    }
}
