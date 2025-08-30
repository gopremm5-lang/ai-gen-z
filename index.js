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

global.version = '1.0.5'
const config        = require('./config');
const path          = require('path')
const fs            = require('fs');
const chalk         = require('chalk');
const { writeLog } = require('./lib/log');
const serializeMessage = require('./lib/serializeMessage');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('baileys');
const { processMessage }        = require('./lib/ai');
const { Boom }                  = require("@hapi/boom");
const qrcode                    = require('qrcode-terminal');
const pino                      = require("pino");
const lastMessageTime           = {};
const logger                    = pino({ level: "silent" });
const { addUser, getUser } = require('./lib/users');
const { clearDirectory, logWithTime } = require('./lib/utils');


const EventEmitter = require('events');

const eventBus = new EventEmitter();
const store = {
    contacts: {}
};



clearDirectory('./tmp');



async function checkAndUpdate() {
    if (config.AutoUpdate == 'on') {
      const { cloneOrUpdateRepo } = require('./lib/cekUpdate');
      await cloneOrUpdateRepo(); // Menunggu hingga cloneOrUpdateRepo selesai
    }
    await connectToWhatsApp();
}

async function connectToWhatsApp() {
    try {
        if (global.sock && global.sock.user && global.sock.ws && global.sock.ws.readyState === 1) {
            console.log(chalk.yellow("⚠️ Bot sudah terkoneksi dan aktif. Tidak membuat koneksi baru."));
            return global.sock;
        }

    const sessionDir = path.join(process.cwd(), 'session');

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: logger,
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    global.sock = sock; 

    if (!sock.authState.creds.registered && config.type_connection.toLowerCase() == 'pairing') {
        const phoneNumber = config.phone_number_bot;
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        await delay(4000);
        const code = await sock.requestPairingCode(phoneNumber.trim());
        console.log(chalk.blue('PHONE NUMBER: '), chalk.yellow(phoneNumber));
        console.log(chalk.blue('CODE PAIRING: '), chalk.yellow(code));
    }

    sock.ev.on('creds.update', saveCreds);


    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }
    fs.chmodSync(sessionDir, 0o755);
    fs.readdir(sessionDir, (err, files) => {
        if (err) {return;}
        files.forEach(file => {
            const filePath = path.join(sessionDir, file);
            fs.chmod(filePath, 0o644, (err) => {  
                if (err) {console.error('Error changing file permissions:', err);
                } 
            });
        });
    });

    sock.ev.on('contacts.update', (contacts) => { // UPDATE KONTAK
        contacts.forEach(contact => {
            store.contacts[contact.id] = contact;
        });
        eventBus.emit('contactsUpdated', store.contacts);

    });

    sock.ev.on('messages.upsert', async (m) => { // CHAT MASUK
        try { 
            // Validate message structure
            if (!m || !m.messages || !Array.isArray(m.messages)) {
                console.warn('Invalid message structure received');
                return;
            }

            const result = serializeMessage(m, sock);
            if(!result) {
                //console.log(JSON.stringify(m, null, 2))
                return
            }

            const { isGroup, content, messageType, message, isQuoted, pushName, sender, remoteJid } = result;

            // Validate required fields
            if (!sender || !remoteJid) {
                console.warn('Missing required message fields');
                return;
            }

            if (remoteJid == "status@broadcast") {
                return false;
            }

            // Handle Destination with validation
            try {
                const destination = config.bot_destination ? config.bot_destination.toLowerCase() : 'both';

                if (
                    (isGroup && destination === 'private') || 
                    (!isGroup && destination === 'group')
                ) {
                    return;
                }
            } catch (destError) {
                console.warn('Error checking destination:', destError.message);
                // Continue processing
            }

            // Safe content handling
            const safeContent = content || '';
            let truncatedContent = safeContent;
            if (safeContent.length > 10) {
                truncatedContent = safeContent.substring(0, 10) + '...';
            }
            
            // Rate limiting with validation
            try {
                const currentTime = Date.now();
                const rateLimit = config.rate_limit || 1000;
                
                if (safeContent && lastMessageTime[remoteJid] && (currentTime - lastMessageTime[remoteJid] < rateLimit)) {
                    console.log(chalk.redBright(`Rate limit : ${truncatedContent} - ${remoteJid}`));
                    return; 
                }
                
                if(safeContent) {
                    lastMessageTime[remoteJid] = currentTime;
                    try {
                        logWithTime(pushName || 'Unknown', truncatedContent);
                    } catch (logError) {
                        console.warn('Error logging message:', logError.message);
                    }
                }
            } catch (rateLimitError) {
                console.warn('Error in rate limiting:', rateLimitError.message);
                // Continue processing
            }
           
            // Log File with error handling
            try {
                writeLog('INFO', `${remoteJid}: ${safeContent}`);
            } catch (logError) {
                console.warn('Error writing log:', logError.message);
            }

            // Cek Users with validation
            try {
                const userReady = getUser(sender);
                if (!userReady) {
                    addUser(sender, -1);
                }
            } catch (userError) {
                console.warn('Error handling user:', userError.message);
                // Continue processing
            }

            /* --------------------- Send Message ---------------------- */
            try {
                if (safeContent || messageType) {
                    await processMessage(safeContent, sock, sender, remoteJid, message, messageType, pushName, isQuoted);
                }
            } catch (error) {
                console.error("Terjadi kesalahan saat memproses pesan:", error.message);
                
                // Send error message to user if possible
                try {
                    if (sock && sock.sendMessage) {
                        await sock.sendMessage(remoteJid, { 
                            text: "Maaf, terjadi kesalahan sistem. Silakan coba lagi nanti." 
                        }, { quoted: message });
                    }
                } catch (sendError) {
                    console.error("Error sending error message:", sendError.message);
                }
            }
        } catch (error) {
            console.log(chalk.redBright(`Error dalam message upsert: ${error.message}`));
            
            // Log detailed error for debugging
            writeLog('ERROR', `Message upsert error: ${error.message}`);
        }
    });


    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
    
        // Tampilkan QR jika tipe koneksi menggunakan QR
        if (qr != null && config.type_connection.toLowerCase() === 'qr') {
            console.log(chalk.yellowBright(`Menampilkan QR`));
            qrcode.generate(qr, { small: true }, (qrcodeStr) => {
                console.log(qrcodeStr);
            });
        }
    
        // Jika koneksi terbuka
        if (connection === 'open') {

            global.sock = sock; 
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            await sock.sendMessage(`${config.phone_number_bot}@s.whatsapp.net`, { text: "Bot Connected" });
      
            console.log(chalk.greenBright(`✅ KONEKSI TERHUBUNG`));
            return;
        }
    
        // Jika koneksi tertutup
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
    
            switch (reason) {
                case DisconnectReason.badSession:
                    console.log(chalk.redBright(`Bad Session File, Start Again ...`));
                    return await connectToWhatsApp();
    
                case DisconnectReason.connectionClosed:
                    console.log(chalk.redBright(`Connection closed, reconnecting...`));
                    return await connectToWhatsApp();
    
                case DisconnectReason.connectionLost:
                    console.log(chalk.redBright(`Connection lost from server, reconnecting...`));
                    return await connectToWhatsApp();
    
                case DisconnectReason.connectionReplaced:
                    console.log(chalk.redBright(`Connection replaced by another session. Please restart bot.`));
                    return await connectToWhatsApp();
    
                case DisconnectReason.loggedOut:
                    console.log(chalk.redBright(`Perangkat logout. Silakan scan ulang.`));
                    break;
    
                case DisconnectReason.restartRequired:
                    console.log(chalk.redBright(`Restart required. Restarting...`));
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    return await connectToWhatsApp();
    
                case DisconnectReason.timedOut:
                    console.log(chalk.redBright(`Connection timed out. Reconnecting...`));
                    return await connectToWhatsApp();
    
                default:
                    console.log(chalk.redBright(`Unknown disconnect reason: ${reason} | ${connection}`));
                    return await connectToWhatsApp();
            }
        }
    });
    

    return sock;
    
    } catch (error) {
        console.error(chalk.red('❌ Error in connectToWhatsApp:'), error.message);
        writeLog('ERROR', `Connection failed: ${error.message}`);
        
        // Retry after 5 seconds
        console.log(chalk.yellow('🔄 Retrying connection in 5 seconds...'));
        await new Promise(resolve => setTimeout(resolve, 5000));
        return await connectToWhatsApp();
    }
}

// Global error handlers
process.on('uncaughtException', (error) => {
    console.error(chalk.red('❌ Uncaught Exception:'), error);
    writeLog('ERROR', `Uncaught Exception: ${error.message}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('❌ Unhandled Rejection at:'), promise, 'reason:', reason);
    writeLog('ERROR', `Unhandled Rejection: ${reason}`);
});

process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Received SIGINT. Graceful shutdown...'));
    if (global.sock) {
        global.sock.end();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n🛑 Received SIGTERM. Graceful shutdown...'));
    if (global.sock) {
        global.sock.end();
    }
    process.exit(0);
});

checkAndUpdate().catch(error => {
    console.error(chalk.red('❌ Failed to start bot:'), error);
    process.exit(1);
});
