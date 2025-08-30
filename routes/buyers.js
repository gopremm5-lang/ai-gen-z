const express = require('express');
const router = express.Router();
const { loadJson, saveJson } = require("../lib/dataLoader");

// Daftar APK valid (harus sama dengan dropdown form)
const VALID_APK = [
  "alight motion", "apple music", "bstation", "canva", "capcut", "catchplay", "chatgpt", "disney",
  "get contact", "hbo max", "iqiyi", "netflix", "picsart", "prime vidio", "remini",
  "vidio", "vision+", "viu", "wetv", "youtube"
];

// Helper normalisasi input APK/durasi
function normalisasi(text) {
  if (!text) return '';
  return text.trim().toLowerCase();
}

// Helper: login required
function requireLogin(req, res, next) {
  if (req.session && req.session.isLoggedIn) return next();
  res.redirect("/login");
}

// ====== ROUTE GET (Tampilkan halaman buyers) ======
router.get('/', requireLogin, async (req, res) => {
  try {
    let buyersData = await loadJson("buyers.json");
    if (!Array.isArray(buyersData)) buyersData = [];
    
    const toast = req.session.toast || null;
    delete req.session.toast;
    
    res.render("buyers", { 
      buyers: buyersData, 
      validApk: VALID_APK,
      toast 
    });
  } catch (error) {
    console.error('Error loading buyers page:', error);
    const toast = { type: "error", msg: "Gagal memuat halaman buyers" };
    res.render("buyers", { buyers: [], validApk: VALID_APK, toast });
  }
});

// ====== ROUTE SAVE ======
router.post('/save', async (req, res) => {
  const { user, apk, email, durasi, dateGiven, exp, invite, type, notes, isRoyal } = req.body;

  // Validasi input kosong
  if (!user || !apk || !email || !durasi || !dateGiven || !exp) {
    req.session.toast = { type: "error", msg: "Kolom wajib harus diisi (User, APK, Email, Durasi, Date Given, Exp)." };
    return res.redirect('/buyers');
  }

  // Normalisasi
  const apkNorm = normalisasi(apk);
  const durasiNorm = durasi.trim(); // durasi bisa bebas

  // Validasi APK
  if (!VALID_APK.includes(apkNorm)) {
    req.session.toast = { type: "error", msg: "Kategori APK tidak valid." };
    return res.redirect('/buyers');
  }

  // Validasi durasi
  if (!durasiNorm) {
    req.session.toast = { type: "error", msg: "Durasi tidak boleh kosong." };
    return res.redirect('/buyers');
  }

  // Load buyers.json
  let buyersData = await loadJson("buyers.json");
  if (!Array.isArray(buyersData)) buyersData = [];

  // Cari user
  let idx = buyersData.findIndex(b => b.user === user);

  // Data transaksi baru
  const transaksi = {
    apk: apkNorm,
    email,
    durasi: durasiNorm,
    dateGiven,
    exp,
    invite: invite || '',
    type: type || 'sale', // sale, replace, warranty, upgrade
    notes: notes || '',
    timestamp: new Date().toISOString()
  };

  if (idx === -1) {
    // User baru
    buyersData.push({
      user,
      isRoyal: isRoyal === 'true',
      joinDate: new Date().toISOString().split('T')[0],
      totalTransactions: 1,
      statistik: {
        [apkNorm]: {
          total: 1,
          rincian: { [durasiNorm]: 1 }
        }
      },
      data: [ transaksi ]
    });
  } else {
    // User sudah ada
    buyersData[idx].data.push(transaksi);
    buyersData[idx].totalTransactions = buyersData[idx].data.length;
    
    // Update royal status if needed
    if (isRoyal === 'true') {
      buyersData[idx].isRoyal = true;
    }

    // Update statistik
    if (!buyersData[idx].statistik[apkNorm]) {
      buyersData[idx].statistik[apkNorm] = { total: 0, rincian: {} };
    }
    buyersData[idx].statistik[apkNorm].total += 1;
    if (!buyersData[idx].statistik[apkNorm].rincian[durasiNorm]) {
      buyersData[idx].statistik[apkNorm].rincian[durasiNorm] = 0;
    }
    buyersData[idx].statistik[apkNorm].rincian[durasiNorm] += 1;
  }

  // Simpan file
  await saveJson("buyers.json", buyersData);

  req.session.toast = { type: "success", msg: "Transaksi berhasil ditambahkan." };
  res.redirect('/buyers');
});

// ====== ROUTE DELETE ======
router.post('/delete', requireLogin, async (req, res) => {
  try {
    const { idx } = req.body;
    let buyersData = await loadJson("buyers.json");
    if (!Array.isArray(buyersData)) buyersData = [];
    
    if (idx >= 0 && idx < buyersData.length) {
      buyersData.splice(idx, 1);
      await saveJson("buyers.json", buyersData);
      req.session.toast = { type: "success", msg: "Buyer berhasil dihapus." };
    } else {
      req.session.toast = { type: "error", msg: "Buyer tidak ditemukan." };
    }
    
    res.redirect('/buyers');
  } catch (error) {
    console.error('Error deleting buyer:', error);
    req.session.toast = { type: "error", msg: "Gagal menghapus buyer." };
    res.redirect('/buyers');
  }
});

// ====== ROUTE EDIT ======
router.post('/edit', requireLogin, async (req, res) => {
  try {
    const { idx, user, apk, email, durasi, dateGiven, exp, invite } = req.body;
    
    // Validasi input
    if (!user || !apk || !email || !durasi || !dateGiven || !exp || !invite) {
      req.session.toast = { type: "error", msg: "Semua kolom wajib diisi." };
      return res.redirect('/buyers');
    }
    
    const apkNorm = normalisasi(apk);
    if (!VALID_APK.includes(apkNorm)) {
      req.session.toast = { type: "error", msg: "Kategori APK tidak valid." };
      return res.redirect('/buyers');
    }
    
    let buyersData = await loadJson("buyers.json");
    if (!Array.isArray(buyersData)) buyersData = [];
    
    if (idx >= 0 && idx < buyersData.length) {
      // Update data buyer
      const buyer = buyersData[idx];
      const oldApk = buyer.data[buyer.data.length - 1]?.apk;
      const oldDurasi = buyer.data[buyer.data.length - 1]?.durasi;
      
      // Update transaksi terakhir
      if (buyer.data.length > 0) {
        const lastTransaction = buyer.data[buyer.data.length - 1];
        lastTransaction.apk = apkNorm;
        lastTransaction.email = email;
        lastTransaction.durasi = durasi.trim();
        lastTransaction.dateGiven = dateGiven;
        lastTransaction.exp = exp;
        lastTransaction.invite = invite;
      }
      
      // Update user name
      buyer.user = user;
      
      // Recalculate statistik (simplified - bisa diperbaiki lebih detail)
      buyer.statistik = {};
      buyer.data.forEach(transaksi => {
        const apk = transaksi.apk;
        const dur = transaksi.durasi;
        
        if (!buyer.statistik[apk]) {
          buyer.statistik[apk] = { total: 0, rincian: {} };
        }
        buyer.statistik[apk].total += 1;
        if (!buyer.statistik[apk].rincian[dur]) {
          buyer.statistik[apk].rincian[dur] = 0;
        }
        buyer.statistik[apk].rincian[dur] += 1;
      });
      
      await saveJson("buyers.json", buyersData);
      req.session.toast = { type: "success", msg: "Buyer berhasil diupdate." };
    } else {
      req.session.toast = { type: "error", msg: "Buyer tidak ditemukan." };
    }
    
    res.redirect('/buyers');
  } catch (error) {
    console.error('Error editing buyer:', error);
    req.session.toast = { type: "error", msg: "Gagal mengupdate buyer." };
    res.redirect('/buyers');
  }
});

module.exports = router;
