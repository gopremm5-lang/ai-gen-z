/**
 * INTERACTIVE ADMIN COMMANDS
 * User-friendly admin commands untuk WhatsApp chat
 * 
 * Features:
 * - Step-by-step guided input
 * - Validation dengan feedback yang jelas
 * - Interactive flows yang mudah diikuti
 * - Error handling yang informatif
 */

const { loadJson, saveJson } = require('./dataLoader');
const { attendanceManager } = require('./attendanceManager');

class InteractiveAdminCommands {
    constructor() {
        // Session storage untuk multi-step commands
        this.activeSessions = new Map();
        
        // Valid APK list (sync dengan yang ada di files)
        this.validAPK = [
            'netflix', 'disney', 'youtube', 'iqiyi', 'viu', 'wetv', 'vision+', 'vidio', 
            'prime', 'hbo', 'bstation', 'alightmotion', 'chatgpt', 'capcut'
        ];
    }

    /**
     * HANDLE INTERACTIVE ADMIN COMMANDS
     */
    async handleCommand(content, sock, sender, remoteJid, message, isOwner, isModerator) {
        const lowerContent = content.toLowerCase().trim();
        const sessionKey = `${sender}_${remoteJid}`;
        
        // Check if user has active session
        if (this.activeSessions.has(sessionKey)) {
            return await this.handleSessionInput(content, sock, sender, remoteJid, message, sessionKey);
        }
        
        // Start new interactive commands
        if (lowerContent === 'add buyer' || lowerContent === 'addbuyer') {
            return await this.startAddBuyerFlow(sock, sender, remoteJid, message, sessionKey);
        }
        
        if (lowerContent === 'add claim' || lowerContent === 'addclaim') {
            return await this.startAddClaimFlow(sock, sender, remoteJid, message, sessionKey);
        }
        
        if (lowerContent === 'add mod' || lowerContent === 'addmod') {
            if (!isOwner) {
                return await sock.sendMessage(remoteJid, { 
                    text: "❗ Perintah ini hanya bisa digunakan oleh Owner!" 
                }, { quoted: message });
            }
            return await this.startAddModFlow(sock, sender, remoteJid, message, sessionKey);
        }
        
        // Quick commands (no session needed)
        if (lowerContent === 'list buyers' || lowerContent === 'listbuyers') {
            return await this.showBuyersList(sock, sender, remoteJid, message);
        }
        
        if (lowerContent === 'list claims' || lowerContent === 'listclaims') {
            return await this.showClaimsList(sock, sender, remoteJid, message);
        }
        
        if (lowerContent === 'admin menu' || lowerContent === 'adminmenu') {
            return await this.showInteractiveAdminMenu(sock, sender, remoteJid, message, isOwner);
        }
        
        // Quick stats commands
        if (lowerContent === 'stats' || lowerContent === 'statistik') {
            return await this.showQuickStats(sock, sender, remoteJid, message);
        }
        
        if (lowerContent === 'help admin' || lowerContent === 'admin help') {
            return await this.showAdminHelp(sock, sender, remoteJid, message, isOwner);
        }
        
        // Attendance commands
        const attendanceResponse = await attendanceManager.handleAttendanceCommand(
            content, sock, sender, remoteJid, message, true
        );
        if (attendanceResponse) {
            return attendanceResponse;
        }
        
        return null; // Not an admin command
    }

    /**
     * INTERACTIVE ADD BUYER FLOW
     */
    async startAddBuyerFlow(sock, sender, remoteJid, message, sessionKey) {
        this.activeSessions.set(sessionKey, {
            command: 'addbuyer',
            step: 1,
            data: {},
            startTime: Date.now()
        });
        
        return await sock.sendMessage(remoteJid, {
            text: `🛒 *TAMBAH BUYER BARU*\n\n` +
                  `Mari kita input data buyer step by step ya!\n\n` +
                  `📝 *Step 1/7: Nama User*\n` +
                  `Siapa nama buyer yang mau ditambahkan?\n\n` +
                  `Contoh: John Doe\n` +
                  `Ketik: nama lengkap buyer`
        }, { quoted: message });
    }

    async startAddClaimFlow(sock, sender, remoteJid, message, sessionKey) {
        this.activeSessions.set(sessionKey, {
            command: 'addclaim',
            step: 1,
            data: {},
            startTime: Date.now()
        });
        
        return await sock.sendMessage(remoteJid, {
            text: `🛡️ *TAMBAH CLAIM GARANSI*\n\n` +
                  `Mari kita input data claim step by step!\n\n` +
                  `📝 *Step 1/4: Nama User*\n` +
                  `Siapa nama user yang mengalami masalah?\n\n` +
                  `Contoh: Jane Smith\n` +
                  `Ketik: nama user`
        }, { quoted: message });
    }

    async startAddModFlow(sock, sender, remoteJid, message, sessionKey) {
        this.activeSessions.set(sessionKey, {
            command: 'addmod',
            step: 1,
            data: {},
            startTime: Date.now()
        });
        
        return await sock.sendMessage(remoteJid, {
            text: `👥 *TAMBAH MODERATOR BARU*\n\n` +
                  `📝 *Step 1/2: Nomor WhatsApp*\n` +
                  `Masukkan nomor WhatsApp moderator baru\n\n` +
                  `Format: 628xxxxxxxxx (tanpa +)\n` +
                  `Contoh: 628123456789\n` +
                  `Ketik: nomor moderator`
        }, { quoted: message });
    }

    /**
     * HANDLE SESSION INPUT - Process step-by-step input
     */
    async handleSessionInput(content, sock, sender, remoteJid, message, sessionKey) {
        const session = this.activeSessions.get(sessionKey);
        const trimmedContent = content.trim();
        
        // Cancel command
        if (['cancel', 'batal', 'stop'].includes(trimmedContent.toLowerCase())) {
            this.activeSessions.delete(sessionKey);
            return await sock.sendMessage(remoteJid, {
                text: "❌ Perintah dibatalkan. Ketik 'admin menu' untuk melihat menu admin."
            }, { quoted: message });
        }
        
        switch (session.command) {
            case 'addbuyer':
                return await this.handleAddBuyerStep(session, trimmedContent, sock, sender, remoteJid, message, sessionKey);
            case 'addclaim':
                return await this.handleAddClaimStep(session, trimmedContent, sock, sender, remoteJid, message, sessionKey);
            case 'addmod':
                return await this.handleAddModStep(session, trimmedContent, sock, sender, remoteJid, message, sessionKey);
        }
    }

    async handleAddClaimStep(session, input, sock, sender, remoteJid, message, sessionKey) {
        switch (session.step) {
            case 1: // Nama User
                if (input.length < 2) {
                    return await sock.sendMessage(remoteJid, {
                        text: "❌ Nama terlalu pendek. Masukkan nama user yang bermasalah:"
                    }, { quoted: message });
                }
                session.data.user = input;
                session.step = 2;
                
                return await sock.sendMessage(remoteJid, {
                    text: `✅ User: ${input}\n\n` +
                          `📝 *Step 2/4: Produk*\n` +
                          `Produk apa yang bermasalah?\n\n` +
                          `Contoh: netflix, disney, youtube\n` +
                          `Ketik: nama produk`
                }, { quoted: message });
                
            case 2: // Produk
                const produk = input.toLowerCase();
                session.data.apk = produk;
                session.step = 3;
                
                return await sock.sendMessage(remoteJid, {
                    text: `✅ Produk: ${produk}\n\n` +
                          `📝 *Step 3/4: Deskripsi Masalah*\n` +
                          `Jelaskan masalah yang dialami user\n\n` +
                          `Contoh: "tidak bisa login", "password berubah", "akun terkunci"\n` +
                          `Ketik: deskripsi masalah`
                }, { quoted: message });
                
            case 3: // Masalah
                session.data.masalah = input;
                session.step = 4;
                
                return await sock.sendMessage(remoteJid, {
                    text: `✅ Masalah: ${input}\n\n` +
                          `📝 *Step 4/4: Jenis Claim*\n` +
                          `Pilih jenis penanganan:\n\n` +
                          `🔄 *replace* - Ganti akun baru\n` +
                          `🔧 *reset* - Reset/perbaiki akun existing\n\n` +
                          `Ketik: replace atau reset`
                }, { quoted: message });
                
            case 4: // Jenis Claim
                const jenisClaim = input.toLowerCase();
                if (!['replace', 'reset'].includes(jenisClaim)) {
                    return await sock.sendMessage(remoteJid, {
                        text: "❌ Jenis claim tidak valid!\n\nPilih: replace atau reset"
                    }, { quoted: message });
                }
                session.data.type = jenisClaim;
                
                // Show confirmation
                const confirmText = `📋 *KONFIRMASI CLAIM GARANSI*\n\n` +
                                  `👤 *User:* ${session.data.user}\n` +
                                  `📱 *Produk:* ${session.data.apk}\n` +
                                  `❗ *Masalah:* ${session.data.masalah}\n` +
                                  `🔄 *Jenis:* ${session.data.type.toUpperCase()}\n` +
                                  `📅 *Tanggal:* ${new Date().toISOString().split('T')[0]}\n\n` +
                                  `Konfirmasi data sudah benar?\n` +
                                  `Ketik: *ya* untuk simpan, *tidak* untuk batal`;
                
                session.step = 5;
                return await sock.sendMessage(remoteJid, { text: confirmText }, { quoted: message });
                
            case 5: // Confirmation
                if (['ya', 'yes', 'oke', 'ok', 'benar'].includes(input.toLowerCase())) {
                    return await this.saveClaimData(session.data, sock, sender, remoteJid, message, sessionKey);
                } else {
                    this.activeSessions.delete(sessionKey);
                    return await sock.sendMessage(remoteJid, {
                        text: "❌ Data claim dibatalkan. Ketik 'add claim' untuk mulai lagi."
                    }, { quoted: message });
                }
        }
    }

    async handleAddModStep(session, input, sock, sender, remoteJid, message, sessionKey) {
        switch (session.step) {
            case 1: // Nomor WhatsApp
                if (!this.isValidPhoneNumber(input)) {
                    return await sock.sendMessage(remoteJid, {
                        text: "❌ Format nomor tidak valid!\n\nFormat: 628xxxxxxxxx\nContoh: 628123456789\nKetik ulang:"
                    }, { quoted: message });
                }
                session.data.nomor = input;
                session.step = 2;
                
                return await sock.sendMessage(remoteJid, {
                    text: `✅ Nomor: ${input}\n\n` +
                          `📝 *Step 2/2: Nama Moderator*\n` +
                          `Siapa nama moderator ini?\n\n` +
                          `Contoh: Admin Sarah, CS John\n` +
                          `Ketik: nama moderator`
                }, { quoted: message });
                
            case 2: // Nama
                if (input.length < 2) {
                    return await sock.sendMessage(remoteJid, {
                        text: "❌ Nama terlalu pendek. Masukkan nama lengkap:"
                    }, { quoted: message });
                }
                session.data.nama = input;
                
                // Show confirmation
                const confirmText = `📋 *KONFIRMASI MODERATOR BARU*\n\n` +
                                  `📱 *Nomor:* ${session.data.nomor}\n` +
                                  `👤 *Nama:* ${session.data.nama}\n` +
                                  `📅 *Tanggal:* ${new Date().toLocaleDateString('id-ID')}\n` +
                                  `👑 *Ditambahkan oleh:* Owner\n\n` +
                                  `Konfirmasi data sudah benar?\n` +
                                  `Ketik: *ya* untuk simpan, *tidak* untuk batal`;
                
                session.step = 3;
                return await sock.sendMessage(remoteJid, { text: confirmText }, { quoted: message });
                
            case 3: // Confirmation
                if (['ya', 'yes', 'oke', 'ok', 'benar'].includes(input.toLowerCase())) {
                    return await this.saveModeratorData(session.data, sock, sender, remoteJid, message, sessionKey);
                } else {
                    this.activeSessions.delete(sessionKey);
                    return await sock.sendMessage(remoteJid, {
                        text: "❌ Data moderator dibatalkan. Ketik 'add mod' untuk mulai lagi."
                    }, { quoted: message });
                }
        }
    }

    async handleAddBuyerStep(session, input, sock, sender, remoteJid, message, sessionKey) {
        switch (session.step) {
            case 1: // Nama User
                if (input.length < 2) {
                    return await sock.sendMessage(remoteJid, {
                        text: "❌ Nama terlalu pendek. Masukkan nama lengkap buyer:"
                    }, { quoted: message });
                }
                session.data.user = input;
                session.step = 2;
                
                return await sock.sendMessage(remoteJid, {
                    text: `✅ Nama: ${input}\n\n` +
                          `📝 *Step 2/7: Produk APK*\n` +
                          `Produk apa yang dibeli?\n\n` +
                          `🎯 *Produk tersedia:*\n` +
                          `${this.validAPK.join(', ')}\n\n` +
                          `Ketik: nama produk`
                }, { quoted: message });
                
            case 2: // APK
                const apkNorm = input.toLowerCase();
                if (!this.validAPK.includes(apkNorm)) {
                    return await sock.sendMessage(remoteJid, {
                        text: `❌ Produk tidak valid!\n\n` +
                              `Produk tersedia:\n${this.validAPK.join(', ')}\n\n` +
                              `Ketik ulang nama produk:`
                    }, { quoted: message });
                }
                session.data.apk = apkNorm;
                session.step = 3;
                
                return await sock.sendMessage(remoteJid, {
                    text: `✅ Produk: ${apkNorm}\n\n` +
                          `📝 *Step 3/7: Email*\n` +
                          `Email akun yang diberikan ke buyer?\n\n` +
                          `Contoh: john@gmail.com\n` +
                          `Ketik: email akun`
                }, { quoted: message });
                
            case 3: // Email
                if (!this.isValidEmail(input)) {
                    return await sock.sendMessage(remoteJid, {
                        text: "❌ Format email tidak valid!\n\nContoh: user@gmail.com\nKetik ulang email:"
                    }, { quoted: message });
                }
                session.data.email = input;
                session.step = 4;
                
                return await sock.sendMessage(remoteJid, {
                    text: `✅ Email: ${input}\n\n` +
                          `📝 *Step 4/7: Durasi*\n` +
                          `Berapa hari durasi yang dibeli?\n\n` +
                          `Contoh: 30, 60, 90\n` +
                          `Ketik: angka durasi (hari)`
                }, { quoted: message });
                
            case 4: // Durasi
                const durasi = parseInt(input);
                if (isNaN(durasi) || durasi < 1 || durasi > 365) {
                    return await sock.sendMessage(remoteJid, {
                        text: "❌ Durasi tidak valid!\n\nMasukkan angka 1-365 hari\nContoh: 30\nKetik ulang:"
                    }, { quoted: message });
                }
                session.data.durasi = durasi;
                session.step = 5;
                
                return await sock.sendMessage(remoteJid, {
                    text: `✅ Durasi: ${durasi} hari\n\n` +
                          `📝 *Step 5/7: Tanggal Diberikan*\n` +
                          `Kapan akun diberikan ke buyer?\n\n` +
                          `Format: YYYY-MM-DD\n` +
                          `Contoh: 2025-08-30\n` +
                          `Ketik: tanggal pemberian`
                }, { quoted: message });
                
            case 5: // Date Given
                if (!this.isValidDate(input)) {
                    return await sock.sendMessage(remoteJid, {
                        text: "❌ Format tanggal tidak valid!\n\nFormat: YYYY-MM-DD\nContoh: 2025-08-30\nKetik ulang:"
                    }, { quoted: message });
                }
                session.data.dateGiven = input;
                session.step = 6;
                
                return await sock.sendMessage(remoteJid, {
                    text: `✅ Tanggal diberikan: ${input}\n\n` +
                          `📝 *Step 6/7: Tanggal Expired*\n` +
                          `Kapan akun akan expired?\n\n` +
                          `Format: YYYY-MM-DD\n` +
                          `Contoh: 2025-09-30\n` +
                          `Ketik: tanggal expired`
                }, { quoted: message });
                
            case 6: // Expired Date
                if (!this.isValidDate(input)) {
                    return await sock.sendMessage(remoteJid, {
                        text: "❌ Format tanggal tidak valid!\n\nFormat: YYYY-MM-DD\nContoh: 2025-09-30\nKetik ulang:"
                    }, { quoted: message });
                }
                session.data.exp = input;
                session.step = 7;
                
                return await sock.sendMessage(remoteJid, {
                    text: `✅ Tanggal expired: ${input}\n\n` +
                          `📝 *Step 7/7: Invite Code*\n` +
                          `Kode invite atau referensi (opsional)\n\n` +
                          `Contoh: INV123, REF456\n` +
                          `Ketik: kode invite (atau 'skip' jika tidak ada)`
                }, { quoted: message });
                
            case 7: // Invite Code
                session.data.invite = input === 'skip' ? '-' : input;
                
                // Show confirmation
                const confirmText = `📋 *KONFIRMASI DATA BUYER*\n\n` +
                                  `👤 *User:* ${session.data.user}\n` +
                                  `📱 *Produk:* ${session.data.apk}\n` +
                                  `📧 *Email:* ${session.data.email}\n` +
                                  `⏰ *Durasi:* ${session.data.durasi} hari\n` +
                                  `📅 *Diberikan:* ${session.data.dateGiven}\n` +
                                  `⚠️ *Expired:* ${session.data.exp}\n` +
                                  `🎫 *Invite:* ${session.data.invite}\n\n` +
                                  `Konfirmasi data sudah benar?\n` +
                                  `Ketik: *ya* untuk simpan, *tidak* untuk batal`;
                
                session.step = 8;
                return await sock.sendMessage(remoteJid, { text: confirmText }, { quoted: message });
                
            case 8: // Confirmation
                if (['ya', 'yes', 'oke', 'ok', 'benar'].includes(input.toLowerCase())) {
                    return await this.saveBuyerData(session.data, sock, sender, remoteJid, message, sessionKey);
                } else {
                    this.activeSessions.delete(sessionKey);
                    return await sock.sendMessage(remoteJid, {
                        text: "❌ Data buyer dibatalkan. Ketik 'add buyer' untuk mulai lagi."
                    }, { quoted: message });
                }
        }
    }

    async saveBuyerData(data, sock, sender, remoteJid, message, sessionKey) {
        try {
            // Load existing buyers data
            let buyersData = await loadJson("buyers.json");
            if (!Array.isArray(buyersData)) buyersData = [];
            
            // Create transaction object
            const transaksi = {
                apk: data.apk,
                email: data.email,
                durasi: data.durasi + " hari",
                dateGiven: data.dateGiven,
                exp: data.exp,
                invite: data.invite
            };
            
            // Find existing user or create new
            let userIndex = buyersData.findIndex(b => b.user === data.user);
            
            if (userIndex === -1) {
                // New user
                buyersData.push({
                    user: data.user,
                    statistik: {
                        [data.apk]: {
                            total: 1,
                            rincian: { [transaksi.durasi]: 1 }
                        }
                    },
                    data: [transaksi]
                });
            } else {
                // Existing user
                buyersData[userIndex].data.push(transaksi);
                
                // Update statistics
                if (!buyersData[userIndex].statistik[data.apk]) {
                    buyersData[userIndex].statistik[data.apk] = { total: 0, rincian: {} };
                }
                buyersData[userIndex].statistik[data.apk].total += 1;
                if (!buyersData[userIndex].statistik[data.apk].rincian[transaksi.durasi]) {
                    buyersData[userIndex].statistik[data.apk].rincian[transaksi.durasi] = 0;
                }
                buyersData[userIndex].statistik[data.apk].rincian[transaksi.durasi] += 1;
            }
            
            // Save data
            await saveJson("buyers.json", buyersData);
            
            // Clear session
            this.activeSessions.delete(sessionKey);
            
            return await sock.sendMessage(remoteJid, {
                text: `✅ *BUYER BERHASIL DITAMBAHKAN!*\n\n` +
                      `👤 *User:* ${data.user}\n` +
                      `📱 *Produk:* ${data.apk}\n` +
                      `📧 *Email:* ${data.email}\n` +
                      `⏰ *Durasi:* ${transaksi.durasi}\n` +
                      `📅 *Diberikan:* ${data.dateGiven}\n` +
                      `⚠️ *Expired:* ${data.exp}\n` +
                      `🎫 *Invite:* ${data.invite}\n\n` +
                      `Data sudah tersimpan di database! 🎉`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Error saving buyer data:', error);
            this.activeSessions.delete(sessionKey);
            
            return await sock.sendMessage(remoteJid, {
                text: `❌ Gagal menyimpan data buyer: ${error.message}\n\nSilakan coba lagi dengan ketik 'add buyer'`
            }, { quoted: message });
        }
    }

    /**
     * SHOW INTERACTIVE ADMIN MENU
     */
    async showInteractiveAdminMenu(sock, sender, remoteJid, message, isOwner) {
        const menu = `🔧 *ADMIN COMMANDS (INTERACTIVE)*\n\n` +
                    `📊 *Data Management:*\n` +
                    `• add buyer - Tambah buyer baru (step-by-step)\n` +
                    `• add claim - Tambah claim garansi (guided)\n` +
                    `• list buyers - Lihat daftar buyers\n` +
                    `• list claims - Lihat daftar claims\n\n` +
                    
                    (isOwner ? `👥 *User Management (Owner Only):*\n` +
                              `• add mod - Tambah moderator baru\n` +
                              `• list mod - Lihat daftar moderator\n` +
                              `• del mod - Hapus moderator\n\n` : '') +
                    
                    `🧠 *Learning Commands:*\n` +
                    `• learning stats - Statistik pembelajaran\n` +
                    `• bot stats - Status learning system\n\n` +
                    
                    `💡 *Tips:*\n` +
                    `• Semua command interactive dan step-by-step\n` +
                    `• Ketik 'cancel' kapan saja untuk membatalkan\n` +
                    `• Data otomatis validasi untuk menghindari error\n\n` +
                    
                    `🎓 *Cara mengajari bot:*\n` +
                    `"ajari bot: [pertanyaan] -> [jawaban]"\n` +
                    `Contoh: "ajari bot: cara bayar -> Pembayaran via QRIS/Dana/OVO"`;
        
        return await sock.sendMessage(remoteJid, { text: menu }, { quoted: message });
    }

    async showQuickStats(sock, sender, remoteJid, message) {
        try {
            const [buyers, claims, moderators] = await Promise.all([
                loadJson('buyers.json'),
                loadJson('log_claim.json'), 
                loadJson('moderators.json')
            ]);
            
            const stats = `📊 *QUICK STATS*\n\n` +
                         `👥 *Buyers:* ${Array.isArray(buyers) ? buyers.length : 0}\n` +
                         `🛡️ *Claims:* ${Array.isArray(claims) ? claims.length : 0}\n` +
                         `👨‍💼 *Moderators:* ${Array.isArray(moderators) ? moderators.filter(m => m.active).length : 0}\n` +
                         `📅 *Updated:* ${new Date().toLocaleString('id-ID')}\n\n` +
                         `Ketik 'admin menu' untuk commands lengkap`;
            
            return await sock.sendMessage(remoteJid, { text: stats }, { quoted: message });
        } catch (error) {
            return await sock.sendMessage(remoteJid, {
                text: "❌ Gagal memuat statistik. Coba lagi nanti."
            }, { quoted: message });
        }
    }

    async showAdminHelp(sock, sender, remoteJid, message, isOwner) {
        const help = `🆘 *ADMIN HELP*\n\n` +
                    `🎯 *Quick Commands:*\n` +
                    `• admin menu - Menu lengkap\n` +
                    `• stats - Statistik cepat\n` +
                    `• add buyer - Tambah buyer (interactive)\n` +
                    `• add claim - Tambah claim (interactive)\n` +
                    (isOwner ? `• add mod - Tambah moderator\n` : '') +
                    `• list buyers - Daftar buyers\n` +
                    `• list claims - Daftar claims\n\n` +
                    
                    `⏰ *Attendance Commands:*\n` +
                    `• mulai - Absen masuk kerja\n` +
                    `• istirahat - Mulai break\n` +
                    `• masuk - Kembali dari break\n` +
                    `• close - Selesai kerja\n` +
                    `• status absen - Cek status hari ini\n\n` +
                    
                    `💡 *Tips:*\n` +
                    `• Semua command interactive dan mudah\n` +
                    `• Ketik 'cancel' untuk membatalkan proses\n` +
                    `• Data otomatis tervalidasi\n` +
                    `• Session timeout 10 menit\n\n` +
                    
                    `🎓 *Learning Bot:*\n` +
                    `"ajari bot: [input] -> [response]"\n\n` +
                    `📞 *Emergency:*\n` +
                    `Jika ada masalah, restart bot atau cek dashboard`;
        
        return await sock.sendMessage(remoteJid, { text: help }, { quoted: message });
    }

    async saveClaimData(data, sock, sender, remoteJid, message, sessionKey) {
        try {
            const fileName = data.type === 'replace' ? 'claimsReplace.json' : 'claimsReset.json';
            let claimsData = await loadJson(fileName);
            if (!Array.isArray(claimsData)) claimsData = [];
            
            const newClaim = {
                user: data.user,
                apk: data.apk,
                masalah: data.masalah,
                tanggal: new Date().toISOString().split('T')[0],
                status: data.type === 'replace' ? 'PENDING' : undefined,
                done: data.type === 'reset' ? false : undefined
            };
            
            claimsData.push(newClaim);
            await saveJson(fileName, claimsData);
            
            // Log to claim history
            let logClaim = await loadJson('log_claim.json');
            if (!Array.isArray(logClaim)) logClaim = [];
            logClaim.push({
                ...newClaim,
                id: Date.now(),
                admin: sender.split('@')[0],
                type: data.type
            });
            await saveJson('log_claim.json', logClaim);
            
            this.activeSessions.delete(sessionKey);
            
            return await sock.sendMessage(remoteJid, {
                text: `✅ *CLAIM ${data.type.toUpperCase()} BERHASIL DITAMBAHKAN!*\n\n` +
                      `👤 *User:* ${data.user}\n` +
                      `📱 *Produk:* ${data.apk}\n` +
                      `❗ *Masalah:* ${data.masalah}\n` +
                      `📅 *Tanggal:* ${newClaim.tanggal}\n` +
                      `🔄 *Jenis:* ${data.type.toUpperCase()}\n\n` +
                      `Claim sudah tercatat dan akan diproses! 🎉`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Error saving claim data:', error);
            this.activeSessions.delete(sessionKey);
            
            return await sock.sendMessage(remoteJid, {
                text: `❌ Gagal menyimpan claim: ${error.message}\n\nSilakan coba lagi dengan ketik 'add claim'`
            }, { quoted: message });
        }
    }

    async saveModeratorData(data, sock, sender, remoteJid, message, sessionKey) {
        try {
            let moderators = await loadJson('moderators.json');
            if (!Array.isArray(moderators)) moderators = [];
            
            // Check if already exists
            const exists = moderators.some(mod => mod.number === data.nomor);
            if (exists) {
                this.activeSessions.delete(sessionKey);
                return await sock.sendMessage(remoteJid, {
                    text: `❌ Moderator dengan nomor ${data.nomor} sudah ada!`
                }, { quoted: message });
            }
            
            const newMod = {
                id: Date.now(),
                number: data.nomor,
                name: data.nama,
                addedBy: sender.split('@')[0],
                addedDate: new Date().toISOString(),
                active: true
            };
            
            moderators.push(newMod);
            await saveJson('moderators.json', moderators);
            
            this.activeSessions.delete(sessionKey);
            
            return await sock.sendMessage(remoteJid, {
                text: `✅ *MODERATOR BERHASIL DITAMBAHKAN!*\n\n` +
                      `📱 *Nomor:* ${data.nomor}\n` +
                      `👤 *Nama:* ${data.nama}\n` +
                      `📅 *Tanggal:* ${new Date().toLocaleDateString('id-ID')}\n\n` +
                      `Moderator baru sudah aktif! 🎉`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Error saving moderator data:', error);
            this.activeSessions.delete(sessionKey);
            
            return await sock.sendMessage(remoteJid, {
                text: `❌ Gagal menambahkan moderator: ${error.message}\n\nSilakan coba lagi dengan ketik 'add mod'`
            }, { quoted: message });
        }
    }

    /**
     * UTILITY FUNCTIONS
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isValidDate(dateString) {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateString)) return false;
        
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date) && dateString === date.toISOString().split('T')[0];
    }

    isValidPhoneNumber(phone) {
        const phoneRegex = /^628\d{8,11}$/;
        return phoneRegex.test(phone);
    }

    /**
     * CLEANUP - Remove expired sessions
     */
    cleanupSessions() {
        const now = Date.now();
        const timeout = 10 * 60 * 1000; // 10 minutes
        
        for (const [key, session] of this.activeSessions.entries()) {
            if (now - session.startTime > timeout) {
                this.activeSessions.delete(key);
                console.log(`🧹 Cleaned up expired session: ${key}`);
            }
        }
    }
}

// Create singleton instance
const interactiveAdminCommands = new InteractiveAdminCommands();

// Cleanup expired sessions every 5 minutes
setInterval(() => {
    interactiveAdminCommands.cleanupSessions();
}, 5 * 60 * 1000);

module.exports = { InteractiveAdminCommands, interactiveAdminCommands };