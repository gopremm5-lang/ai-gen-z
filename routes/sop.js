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

// SOP page
router.get('/', requireLogin, async (req, res) => {
  try {
    const sop = await loadJson("sop.json") || [];
    const toast = req.session.toast || null;
    delete req.session.toast;
    
    res.render("sop", { sop, toast });
  } catch (error) {
    console.error('Error loading SOP data:', error);
    const toast = { type: "error", msg: "Gagal memuat data SOP" };
    res.render("sop", { sop: [], toast });
  }
});

// Save SOP
router.post('/save', requireLogin, async (req, res) => {
  try {
    let { idx, trigger, response } = req.body;
    
    if (!trigger || !response) {
      setToast(req, "error", "Trigger dan response wajib diisi.");
      return res.redirect("/sop");
    }
    
    let sop = await loadJson("sop.json") || [];
    if (!Array.isArray(sop)) sop = [];
    
    // Process trigger - split by comma and clean up
    const triggerArray = trigger.split(",").map(t => t.trim()).filter(t => t.length > 0);
    const responseArray = Array.isArray(response) ? response : [response];
    
    const sopData = {
      trigger: triggerArray,
      response: responseArray
    };
    
    if (idx === "" || idx === undefined) {
      // Tambah baru
      sop.push(sopData);
      setToast(req, "success", "SOP berhasil ditambahkan.");
    } else {
      // Update existing
      if (sop[idx]) {
        sop[idx] = sopData;
        setToast(req, "success", "SOP berhasil diperbarui.");
      } else {
        setToast(req, "error", "SOP tidak ditemukan.");
        return res.redirect("/sop");
      }
    }
    
    await saveJson("sop.json", sop);
    res.redirect("/sop");
  } catch (error) {
    console.error('Error saving SOP:', error);
    setToast(req, "error", "Gagal menyimpan SOP.");
    res.redirect("/sop");
  }
});

// Delete SOP
router.post('/delete', requireLogin, async (req, res) => {
  try {
    const { idx } = req.body;
    let sop = await loadJson("sop.json") || [];
    
    if (sop[idx]) {
      sop.splice(idx, 1);
      await saveJson("sop.json", sop);
      setToast(req, "success", "SOP berhasil dihapus.");
    } else {
      setToast(req, "error", "SOP tidak ditemukan.");
    }
    
    res.redirect("/sop");
  } catch (error) {
    console.error('Error deleting SOP:', error);
    setToast(req, "error", "Gagal menghapus SOP.");
    res.redirect("/sop");
  }
});

module.exports = router;
