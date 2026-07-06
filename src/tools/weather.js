import axios from 'axios';

export const definition = {
    name: 'weather',
    description: 'Mendapatkan informasi cuaca saat ini untuk kota tertentu.',
    parameters: {
        type: 'object',
        properties: {
            city: {
                type: 'string',
                description:
                    'Nama kota yang ingin dicari cuacanya (Gunakan "Jakarta" sebagai default jika pengguna tidak menyebutkan kota).'
            }
        },
        required: ['city']
    }
};

export async function execute({ city = 'Jakarta' }) {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) return 'Gagal: OPENWEATHER_API_KEY tidak dikonfigurasi di server.';

    try {
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
            params: {
                q: city,
                appid: apiKey,
                units: 'metric', // Menggunakan celcius
                lang: 'id' // Bahasa Indonesia
            }
        });

        const data = response.data;
        const weatherDesc = data.weather[0]?.description || 'Tidak diketahui';
        const temp = data.main?.temp;
        const humidity = data.main?.humidity;
        const windSpeed = data.wind?.speed;
        const cityName = data.name;

        return `Cuaca di ${cityName} saat ini: ${weatherDesc}. Suhu: ${temp}°C, Kelembapan: ${humidity}%, Kecepatan Angin: ${windSpeed} m/s.`;
    } catch (error) {
        console.error('[Weather Tool Error]', error.response?.data || error.message);
        return `Gagal mengambil cuaca untuk kota "${city}". Pastikan penulisan nama kota benar.`;
    }
}
