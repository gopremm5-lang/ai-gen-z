/*
⚠️ PERINGATAN:
Script ini **TIDAK BOLEH DIPERJUALBELIKAN** dalam bentuk apa pun!

╔══════════════════════════════════════════════╗
║                🛠️ INFORMASI SCRIPT           ║
╠══════════════════════════════════════════════╣
║ 📦 Version   : 1.0.5
║ 👨‍💻 Developer  : Azhari Creative              ║
║ 🌐 Website    : https://autoresbot.com       ║
║ 💻 GitHub     : github.com/autoresbot/resbot-ai
╚══════════════════════════════════════════════╝

📌 Mulai 11 April 2025,
Script **Autoresbot** resmi menjadi **Open Source** dan dapat digunakan secara gratis:
🔗 https://autoresbot.com
*/

require('dotenv').config();
const moment = require("moment-timezone");

// Environment configuration with fallbacks
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const config = {
    // Environment
    NODE_ENV            : NODE_ENV,
    isProduction        : isProduction,
    
    // Core Settings
    AutoUpdate          : process.env.AUTO_UPDATE || 'off',
    API_KEY             : process.env.API_KEY || 'betataster1', 
    GEMINI_API_KEY      : process.env.GEMINI_API_KEY || '', // Remove hardcoded API key for security
    
    // Bot Configuration
    phone_number_bot    : process.env.BOT_PHONE || '6281391414396',
    type_connection     : process.env.CONNECTION_TYPE || 'qr', // qr atau pairing
    bot_destination     : process.env.BOT_DESTINATION || 'private', // group, private, both
    name_bot            : process.env.BOT_NAME || 'Resbot Ai',
    
    // Owner Information
    owner_name          : process.env.OWNER_NAME || 'Bold',
    owner_number        : process.env.OWNER_NUMBER || '6289512822345',
    owner_website       : process.env.OWNER_WEBSITE || 'profil.boldstore.my.id',
    
    // System Settings
    version             : global.version,
    rate_limit          : parseInt(process.env.RATE_LIMIT) || (isProduction ? 1000 : 300), // ms
    total_limit         : parseInt(process.env.DAILY_LIMIT) || (isProduction ? 500 : 100),
    
    // Sticker Settings
    sticker_packname    : process.env.STICKER_PACK || 'Bold',
    sticker_author      : process.env.STICKER_AUTHOR || `Date: ${moment.tz('Asia/Jakarta').format('DD/MM/YY')}\\Owner 0895-1282-2345`,
    notification        : {
        limit           : 'Hai kak, Limit harian anda sudah habis silakan tunggu besok ya atau berlangganan premium untuk menikmati fitur tanpa limit',
        reset           : 'Dialog berhasil dihapus. Semua percakapan kita telah di-reset dan siap memulai dari awal!',
        ig              : 'kirimkan link instagramnya ya kak',
        fb              : 'kirimkan link facebooknya ya kak',
        tt              : 'kirimkan link tiktoknya ya kak',
        waiting         : 'Hai kak mohon tunggu beberapa saat lagi ya, proses sebelumnya belum selesai',
        qc_help         : 'Tulis textnya ya kak, misal *qc halo*',
        only_owner      : '_❗Perintah Ini Hanya Bisa Digunakan Oleh Owner !_'
        
    },
    success             : {
        hd : 'Ini kak hasil gambarnya, Maaf kalau masih blur',
    },
    error               : {
       FILE_TOO_LARGE : `File terlalu besar. Maksimal ukuran file adalah 99 Mb`,
       THROW          : '_Ada masalah saat terhubung ke server_',
       PLAY_ERROR     : 'Yahh Gagal, Sepertinya ada masalah saat mendowload audio',
       HD_ERROR       : 'Yahh Gagal, Mohon maaf kak, tidak bisa hd in gambar',
       IMAGE_ERROR    : 'Yahh Gagal, Mohon maaf kak, tidak bisa carikan kamu gambar',
       qc             : 'Yah gagal bikin qc nya kak'
    }
}; 

module.exports = config;