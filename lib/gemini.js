const config = require('../config');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

function getWaktuWIB() {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wibTime = new Date(utcTime + (7 * 60 * 60 * 1000));
    const hari = wibTime.getDate();
    const bulanIndex = wibTime.getMonth();
    const tahun = wibTime.getFullYear();
    const jam = wibTime.getHours().toString().padStart(2, '0');
    const menit = wibTime.getMinutes().toString().padStart(2, '0');
    const namaBulan = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${hari} ${namaBulan[bulanIndex]} ${tahun} jam ${jam}:${menit} WIB`;
}

global.conversationHistories = {};

async function loadPrompt(file) {
    const filepath = path.join(__dirname, `../prompt/${file}`);
    const raw = await fs.readFile(filepath, 'utf8');
    return raw.replace('@NOW', getWaktuWIB());
}

async function GEMINI_TEXT(id_user, prompt, role = 'cs') {
    // Input validation
    if (!id_user || typeof id_user !== 'string') {
        console.error('GEMINI_TEXT: Invalid id_user provided');
        return 'Terjadi kesalahan sistem. Silakan coba lagi.';
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        console.error('GEMINI_TEXT: Invalid prompt provided');
        return 'Mohon kirim pesan yang valid.';
    }

    // Check API key
    if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY.trim() === '') {
        console.error('GEMINI_TEXT: API key not configured');
        const panduan = 'https://youtu.be/02oGg3-3a-s?si=ElXoKafRCG9B-7XD';
        return `API key Gemini belum dikonfigurasi. Silakan setup API key terlebih dahulu.\n\n${panduan}`;
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${config.GEMINI_API_KEY}`;

    try {
        // Initialize conversation history safely
        if (!global.conversationHistories) {
            global.conversationHistories = {};
        }
        
        if (!conversationHistories[id_user]) {
            conversationHistories[id_user] = [];
        }

        // Load context with error handling
        let initialContext;
        try {
            initialContext = await loadPrompt(`context-${role}.txt`);
        } catch (contextError) {
            console.error('Error loading context:', contextError.message);
            initialContext = 'Anda adalah customer service yang membantu pelanggan dengan ramah dan profesional.';
        }

        // Sanitize prompt
        const sanitizedPrompt = prompt.trim().substring(0, 2000); // Limit prompt length
        const fullPrompt = `${initialContext}\n${conversationHistories[id_user].join('\n')}\nUser: ${sanitizedPrompt}\nAI:`;

        const requestBody = {
            contents: [
                {
                    role: "user",
                    parts: [{ text: fullPrompt }]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
            }
        };

        // Add timeout to axios request
        const response = await axios.post(API_URL, requestBody, {
            timeout: 30000, // 30 seconds timeout
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Validate response structure
        if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
            throw new Error('Invalid response structure from Gemini API');
        }

        const candidate = response.data.candidates[0];
        
        // Check for content filtering
        if (candidate.finishReason === 'SAFETY') {
            console.warn('Content filtered by Gemini safety filters');
            return 'Maaf, saya tidak dapat memproses permintaan tersebut. Mohon ajukan pertanyaan lain.';
        }

        if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
            throw new Error('No content in Gemini response');
        }

        const responseText = candidate.content.parts[0].text;

        if (!responseText || responseText.trim().length === 0) {
            throw new Error('Empty response from Gemini');
        }

        // Update conversation history safely
        try {
            conversationHistories[id_user].push('User: ' + sanitizedPrompt);
            conversationHistories[id_user].push('AI: ' + responseText);
            
            // Keep only last 10 exchanges to prevent memory issues
            if (conversationHistories[id_user].length > 20) {
                conversationHistories[id_user] = conversationHistories[id_user].slice(-20);
            }
        } catch (historyError) {
            console.error('Error updating conversation history:', historyError.message);
            // Continue without updating history
        }

        return responseText.trim();

    } catch (error) {
        console.error('Error generating AI content:', error.message || error);

        const panduan = 'https://youtu.be/02oGg3-3a-s?si=ElXoKafRCG9B-7XD';
        const pesan_ERROR = `Jika melihat error ini, berarti apikey gemini terkena limit karena pengguna yang terlalu banyak. Silakan gunakan apikey gemini pribadi.\n\n${panduan}`;

        // Handle specific error types
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            return 'Koneksi timeout. Silakan coba lagi dalam beberapa saat.';
        }

        if (error.response) {
            const status = error.response.status;
            const statusText = error.response.statusText;
            
            switch (status) {
                case 400:
                    console.error('Bad request to Gemini API:', error.response.data);
                    return 'Terjadi kesalahan dalam permintaan. Silakan coba lagi.';
                case 401:
                    return `API key tidak valid. Silakan periksa konfigurasi API key.\n\n${panduan}`;
                case 403:
                    return `Jika melihat error ini, berarti apikey gemini masih kosong atau kena limit karena pengguna yang terlalu banyak. Silakan gunakan apikey gemini pribadi.\n\n${panduan}`;
                case 429:
                    return pesan_ERROR;
                case 500:
                case 502:
                case 503:
                    return 'Server Gemini sedang bermasalah. Silakan coba lagi dalam beberapa menit.';
                default:
                    console.error(`Gemini API error ${status}:`, statusText);
                    return `Terjadi kesalahan server (${status}). Silakan coba lagi nanti.`;
            }
        }

        if (error.message?.includes('Too Many Requests') || error.message?.includes('status code 429')) {
            return pesan_ERROR;
        }

        if (error.message?.includes('Network Error') || error.code === 'ENOTFOUND') {
            return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
        }

        // Generic error fallback
        return 'Terjadi kesalahan pada sistem AI. Silakan coba lagi nanti atau hubungi admin jika masalah berlanjut.';
    }
}

module.exports = { GEMINI_TEXT };
