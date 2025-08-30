const express = require('express');
const router = express.Router();
const { loadJson, saveJson } = require("../lib/dataLoader");

// Helper: login required
function requireLogin(req, res, next) {
  if (req.session && req.session.isLoggedIn) return next();
  res.redirect("/login");
}

// Helper: set toast
function setToast(req, type, msg) {
  req.session.toast = { type, msg };
}

// Promo page
router.get('/', requireLogin, async (req, res) => {
  try {
    const promo = await loadJson("promo.json") || [];
    const toast = req.session.toast || null;
    delete req.session.toast;
    
    res.render("promo", { promo, toast });
  } catch (error) {
    console.error('Error loading promo data:', error);
    const toast = { type: "error", msg: "Gagal memuat data promo" };
    res.render("promo", { promo: [], toast });
  }
});

// Save promo
router.post('/save', requireLogin, async (req, res) => {
  try {
    let { idx, banner, active } = req.body;
    
    if (!banner) {
      setToast(req, "error", "Banner promo wajib diisi.");
      return res.redirect("/promo");
    }
    
    let promo = await loadJson("promo.json") || [];
    if (!Array.isArray(promo)) promo = [];
    
    const promoData = {
      banner: banner.trim(),
      active: !!active
    };
    
    if (idx === "" || idx === undefined) {
      // Tambah baru
      promo.push(promoData);
      setToast(req, "success", "Promo berhasil ditambahkan.");
    } else {
      // Update existing
      if (promo[idx]) {
        promo[idx] = promoData;
        setToast(req, "success", "Promo berhasil diperbarui.");
      } else {
        setToast(req, "error", "Promo tidak ditemukan.");
        return res.redirect("/promo");
      }
    }
    
    await saveJson("promo.json", promo);
    res.redirect("/promo");
  } catch (error) {
    console.error('Error saving promo:', error);
    setToast(req, "error", "Gagal menyimpan promo.");
    res.redirect("/promo");
  }
});

// Delete promo
router.post('/delete', requireLogin, async (req, res) => {
  try {
    const { idx } = req.body;
    let promo = await loadJson("promo.json") || [];
    
    if (promo[idx]) {
      promo.splice(idx, 1);
      await saveJson("promo.json", promo);
      setToast(req, "success", "Promo berhasil dihapus.");
    } else {
      setToast(req, "error", "Promo tidak ditemukan.");
    }
    
    res.redirect("/promo");
  } catch (error) {
    console.error('Error deleting promo:', error);
    setToast(req, "error", "Gagal menghapus promo.");
    res.redirect("/promo");
  }
});

// Toggle promo status
router.post('/toggle', requireLogin, async (req, res) => {
  try {
    const { idx } = req.body;
    let promo = await loadJson("promo.json") || [];
    
    if (promo[idx]) {
      promo[idx].active = !promo[idx].active;
      await saveJson("promo.json", promo);
      const status = promo[idx].active ? "diaktifkan" : "dinonaktifkan";
      setToast(req, "success", `Promo berhasil ${status}.`);
    } else {
      setToast(req, "error", "Promo tidak ditemukan.");
    }
    
    res.redirect("/promo");
  } catch (error) {
    console.error('Error toggling promo:', error);
    setToast(req, "error", "Gagal mengubah status promo.");
    res.redirect("/promo");
  }
});

module.exports = router;
