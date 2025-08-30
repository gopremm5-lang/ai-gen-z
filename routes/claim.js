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

// Claim page
router.get('/', requireLogin, async (req, res) => {
  try {
    const claim = await loadJson("log_claim.json") || [];
    const toast = req.session.toast || null;
    delete req.session.toast;
    
    res.render("claim", { claim, toast });
  } catch (error) {
    console.error('Error loading claim data:', error);
    const toast = { type: "error", msg: "Gagal memuat data claim" };
    res.render("claim", { claim: [], toast });
  }
});

// Resolve claim
router.post('/resolve', requireLogin, async (req, res) => {
  try {
    const { idx } = req.body;
    let claim = await loadJson("log_claim.json") || [];
    
    if (claim[idx]) {
      claim[idx].status = "RESOLVED";
      await saveJson("log_claim.json", claim);
      setToast(req, "success", "Claim berhasil di-mark sebagai resolved.");
    } else {
      setToast(req, "error", "Claim tidak ditemukan.");
    }
    
    res.redirect("/claim");
  } catch (error) {
    console.error('Error resolving claim:', error);
    setToast(req, "error", "Gagal memproses claim.");
    res.redirect("/claim");
  }
});

module.exports = router;
