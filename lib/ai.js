const config = require('../config');
const { getSession, resetSession } = require("./session");
const { checkLimit, getUser } = require("./users");
const { displayMenu } = require('./utils');
const { GEMINI_TEXT } = require("./gemini");
const { handleUserMessage } = require('./hybridHandler');
const { loadJson, saveJson } = require('./dataLoader');
const { learningManager } = require('./learningManager');
const { imageHandler } = require('./imageHandler');
const { botLaws } = require('./botLaws');
const { responseRouter } = require('./responseRouter');

// Helper validasi JID (opsional, jika mau kirim pesan manual ke JID WA)
function isValidJid(jid) {
  return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us');
}

// Helper untuk cek apakah user adalah admin/owner
function isOwner(sender) {
  const number = sender.split('@')[0];
  return number === config.owner_number;
}

// Helper untuk cek apakah user adalah moderator
async function isModerator(sender) {
  try {
    const moderators = await loadJson('moderators.json');
    const number = sender.split('@')[0];
    return moderators.some(mod => mod.number === number && mod.active);
  } catch {
    return false;
  }
}

// Helper untuk cek apakah user adalah admin (owner atau moderator)
async function isAdmin(sender) {
  return isOwner(sender) || await isModerator(sender);
}

// Handler untuk admin commands
async function handleAdminCommands(content, sock, sender, remoteJid, message) {
  const lowerContent = content.toLowerCase().trim();
  const args = content.split(' ');
  
  // Command: Add Buyer Report (format yang diperbaiki)
  if (lowerContent.startsWith('addbuyer ')) {
    if (args.length < 8) {
      return await sock.sendMessage(remoteJid, { 
        text: `Format: addbuyer [user] [apk] [email] [durasi] [dateGiven] [exp] [invite]\nContoh: addbuyer John netflix john@mail.com 30 2025-08-15 2025-09-15 INV123\n\nAPK tersedia: netflix, spotify, canva, capcut, disney, youtube, iqiyi, viu, wetv, vision+, vidio, prime, hbo, bstation, alightmotion, chatgpt, remini, picsart` 
      }, { quoted: message });
    }
    
    const [, user, apk, email, durasi, dateGiven, exp, invite] = args;
    
    // Validasi APK (sesuai dengan file produk yang ada)
    const VALID_APK = [
      "netflix", "spotify", "canva", "capcut", "disney", "youtube", "iqiyi", "viu", "wetv", 
      "vision+", "vidio", "prime", "hbo", "bstation", "alightmotion", "chatgpt", "remini", "picsart"
    ];
    
    const apkNorm = apk.trim().toLowerCase();
    if (!VALID_APK.includes(apkNorm)) {
      return await sock.sendMessage(remoteJid, { 
        text: `❌ APK tidak valid!\n\nAPK yang tersedia:\n${VALID_APK.join(', ')}` 
      }, { quoted: message });
    }
    
    try {
      // Load buyers data sesuai struktur yang ada
      let buyersData = await loadJson("buyers.json");
      if (!Array.isArray(buyersData)) buyersData = [];
      
      // Cari user existing
      let userIndex = buyersData.findIndex(b => b.user === user);
      
      // Data transaksi baru
      const transaksi = {
        apk: apkNorm,
        email,
        durasi: durasi + " hari", // Format durasi dalam hari
        dateGiven,
        exp,
        invite
      };
      
      if (userIndex === -1) {
        // User baru
        buyersData.push({
          user,
          statistik: {
            [apkNorm]: {
              total: 1,
              rincian: { [transaksi.durasi]: 1 }
            }
          },
          data: [transaksi]
        });
      } else {
        // User sudah ada
        buyersData[userIndex].data.push(transaksi);
        
        // Update statistik
        if (!buyersData[userIndex].statistik[apkNorm]) {
          buyersData[userIndex].statistik[apkNorm] = { total: 0, rincian: {} };
        }
        buyersData[userIndex].statistik[apkNorm].total += 1;
        if (!buyersData[userIndex].statistik[apkNorm].rincian[transaksi.durasi]) {
          buyersData[userIndex].statistik[apkNorm].rincian[transaksi.durasi] = 0;
        }
        buyersData[userIndex].statistik[apkNorm].rincian[transaksi.durasi] += 1;
      }
      
      // Simpan data
      await saveJson("buyers.json", buyersData);
      
      return await sock.sendMessage(remoteJid, { 
        text: `✅ *Buyer berhasil ditambahkan!*\n\n👤 *User:* ${user}\n📱 *APK:* ${apkNorm}\n📧 *Email:* ${email}\n⏰ *Durasi:* ${transaksi.durasi}\n📅 *Diberikan:* ${dateGiven}\n⚠️ *Expired:* ${exp}\n🎫 *Invite:* ${invite}` 
      }, { quoted: message });
      
    } catch (error) {
      console.error('Error adding buyer:', error);
      return await sock.sendMessage(remoteJid, { 
        text: `❌ Gagal menambahkan buyer: ${error.message}` 
      }, { quoted: message });
    }
  }
  
  // Command: Add Claim Garansi (format yang diperbaiki)
  if (lowerContent.startsWith('addclaim ')) {
    if (args.length < 5) {
      return await sock.sendMessage(remoteJid, { 
        text: `Format: addclaim [user] [apk] [masalah] [replace|reset]\nContoh: addclaim John netflix "tidak bisa login" replace` 
      }, { quoted: message });
    }
    
    const [, user, apk, ...rest] = args;
    const lastArg = rest[rest.length - 1];
    const type = lastArg.toLowerCase();
    const masalah = rest.slice(0, -1).join(' ').replace(/"/g, '');
    
    if (!['replace', 'reset'].includes(type)) {
      return await sock.sendMessage(remoteJid, { 
        text: `❌ Type claim harus 'replace' atau 'reset'!` 
      }, { quoted: message });
    }
    
    try {
      const fileName = type === 'replace' ? 'claimsReplace.json' : 'claimsReset.json';
      let claimsData = await loadJson(fileName);
      if (!Array.isArray(claimsData)) claimsData = [];
      
      const newClaim = {
        user,
        apk: apk.toLowerCase(),
        masalah,
        tanggal: new Date().toISOString().split('T')[0],
        status: type === 'replace' ? 'PENDING' : undefined,
        done: type === 'reset' ? false : undefined
      };
      
      claimsData.push(newClaim);
      await saveJson(fileName, claimsData);
      
      // Log ke claim history
      let logClaim = await loadJson('log_claim.json');
      if (!Array.isArray(logClaim)) logClaim = [];
      logClaim.push({
        ...newClaim,
        id: Date.now(),
        admin: sender.split('@')[0],
        type: type
      });
      await saveJson('log_claim.json', logClaim);
      
      return await sock.sendMessage(remoteJid, { 
        text: `✅ *Claim ${type} berhasil ditambahkan!*\n\n👤 *User:* ${user}\n📱 *APK:* ${apk}\n❗ *Masalah:* ${masalah}\n📅 *Tanggal:* ${newClaim.tanggal}\n🔄 *Type:* ${type.toUpperCase()}` 
      }, { quoted: message });
      
    } catch (error) {
      console.error('Error adding claim:', error);
      return await sock.sendMessage(remoteJid, { 
        text: `❌ Gagal menambahkan claim: ${error.message}` 
      }, { quoted: message });
    }
  }
  
  // Command: Add Moderator (Owner only)
  if (lowerContent.startsWith('addmod ') && isOwner(sender)) {
    if (args.length < 3) {
      return await sock.sendMessage(remoteJid, { 
        text: `Format: addmod [nomor] [nama]\nContoh: addmod 628123456789 "Admin John"` 
      }, { quoted: message });
    }
    
    const nomor = args[1];
    const nama = args.slice(2).join(' ').replace(/"/g, '');
    
    try {
      let moderators = await loadJson('moderators.json');
      if (!Array.isArray(moderators)) moderators = [];
      
      // Cek apakah sudah ada
      const exists = moderators.some(mod => mod.number === nomor);
      if (exists) {
        return await sock.sendMessage(remoteJid, { 
          text: `❌ Moderator dengan nomor ${nomor} sudah ada!` 
        }, { quoted: message });
      }
      
      const newMod = {
        id: Date.now(),
        number: nomor,
        name: nama,
        addedBy: sender.split('@')[0],
        addedDate: new Date().toISOString(),
        active: true
      };
      
      moderators.push(newMod);
      await saveJson('moderators.json', moderators);
      
      return await sock.sendMessage(remoteJid, { 
        text: `✅ Moderator berhasil ditambahkan:\n📱 Nomor: ${nomor}\n👤 Nama: ${nama}\n📅 Tanggal: ${new Date().toLocaleDateString('id-ID')}` 
      }, { quoted: message });
    } catch (error) {
      return await sock.sendMessage(remoteJid, { 
        text: `❌ Gagal menambahkan moderator: ${error.message}` 
      }, { quoted: message });
    }
  }
  
  // Command: List Moderators (Owner only)
  if (lowerContent === 'listmod' && isOwner(sender)) {
    try {
      const moderators = await loadJson('moderators.json');
      if (!Array.isArray(moderators) || moderators.length === 0) {
        return await sock.sendMessage(remoteJid, { 
          text: `📋 *DAFTAR MODERATOR*\n\nBelum ada moderator yang terdaftar.` 
        }, { quoted: message });
      }
      
      let modList = `📋 *DAFTAR MODERATOR*\n\n`;
      moderators.forEach((mod, index) => {
        const status = mod.active ? '🟢 Aktif' : '🔴 Nonaktif';
        const addedDate = new Date(mod.addedDate).toLocaleDateString('id-ID');
        modList += `${index + 1}. *${mod.name}*\n`;
        modList += `   📱 ${mod.number}\n`;
        modList += `   ${status}\n`;
        modList += `   📅 ${addedDate}\n\n`;
      });
      
      modList += `Total: ${moderators.length} moderator`;
      
      return await sock.sendMessage(remoteJid, { text: modList }, { quoted: message });
    } catch (error) {
      return await sock.sendMessage(remoteJid, { 
        text: `❌ Gagal memuat daftar moderator: ${error.message}` 
      }, { quoted: message });
    }
  }
  
  // Command: Remove Moderator (Owner only)
  if (lowerContent.startsWith('delmod ') && isOwner(sender)) {
    if (args.length < 2) {
      return await sock.sendMessage(remoteJid, { 
        text: `Format: delmod [nomor]\nContoh: delmod 628123456789` 
      }, { quoted: message });
    }
    
    const nomor = args[1];
    
    try {
      let moderators = await loadJson('moderators.json');
      if (!Array.isArray(moderators)) moderators = [];
      
      const index = moderators.findIndex(mod => mod.number === nomor);
      if (index === -1) {
        return await sock.sendMessage(remoteJid, { 
          text: `❌ Moderator dengan nomor ${nomor} tidak ditemukan!` 
        }, { quoted: message });
      }
      
      const removed = moderators.splice(index, 1)[0];
      await saveJson('moderators.json', moderators);
      
      return await sock.sendMessage(remoteJid, { 
        text: `✅ Moderator berhasil dihapus:\n👤 ${removed.name}\n📱 ${removed.number}` 
      }, { quoted: message });
    } catch (error) {
      return await sock.sendMessage(remoteJid, { 
        text: `❌ Gagal menghapus moderator: ${error.message}` 
      }, { quoted: message });
    }
  }
  
  // Command: List Admin Commands
  if (lowerContent === 'adminhelp' || lowerContent === 'adminmenu') {
    const adminMenu = `
🔧 *ADMIN COMMANDS*

📊 *Data Management:*
• addbuyer [user] [apk] [email] [durasi] [dateGiven] [exp] [invite]
• addclaim [user] [apk] [masalah] [replace/reset]

👥 *User Management:* ${isOwner(sender) ? `
• addmod [nomor] [nama]
• listmod
• delmod [nomor]` : ''}

🧠 *Learning Commands:*
• learning stats - Statistik pembelajaran bot
• learning help - Cara mengajari bot

📋 *Info Commands:*
• adminhelp - Menu ini

💡 *Contoh:*
• addbuyer John netflix john@mail.com 30 2025-08-15 2025-09-15 INV123
• addclaim Jane spotify "error login" replace
${isOwner(sender) ? '• addmod 628123456789 "Admin Sarah"' : ''}

📱 *APK yang tersedia:*
netflix, spotify, canva, capcut, disney, youtube, iqiyi, viu, wetv, vision+, vidio, prime, hbo, bstation, alightmotion, chatgpt, remini, picsart

🎓 *Cara mengajari bot:*
"jangan nanya balik saat ada yang tanya cara bayar, bilang pembayaran via QRIS, Dana, OVO"
    `;
    
    return await sock.sendMessage(remoteJid, { text: adminMenu.trim() }, { quoted: message });
  }
  
  return null; // Tidak ada command yang cocok
}


// --- Handler utama processMessage ---
async function processMessage(content, sock, sender, remoteJid, message, messageType, pushName, isQuoted) {
  // Step 1: Basic validations
  const user = getUser(sender);
  const userLimit = checkLimit(user);
  const isUserAdmin = await isAdmin(sender);

  // Step 2: Check user limits (unless admin)
  if (!userLimit && !isUserAdmin) {
    return await sock.sendMessage(remoteJid, { text: config.notification.limit }, { quoted: message });
  }

  // Step 3: Handle session reset
  if (content.toLowerCase().trim() === 'reset') {
    resetSession(sender);
    return await sock.sendMessage(remoteJid, { text: config.notification.reset }, { quoted: message });
  }

  // Step 4: Route through Unified Response Router
  console.log(`🎯 Routing message: "${content.substring(0, 50)}..." from ${sender.split('@')[0]}`);
  
  try {
    return await responseRouter.routeMessage(
      content, sender, remoteJid, message, messageType, pushName, isQuoted, sock
    );
  } catch (error) {
    console.error('❌ Response router error:', error);
    
    // Emergency fallback
    const emergencyResponse = "Maaf, terjadi kesalahan sistem. Mohon coba lagi atau hubungi admin untuk bantuan.";
    return await sock.sendMessage(remoteJid, { text: emergencyResponse }, { quoted: message });
  }
}

module.exports = { processMessage };
