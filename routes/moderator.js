const express = require('express');
const router = express.Router();
const { loadJson, saveJson } = require("../lib/dataLoader");

// Helper: login required
function requireLogin(req, res, next) {
  if (req.session && req.session.isLoggedIn) return next();
  res.redirect("/login");
}

// Helper: moderator access required
function requireModerator(req, res, next) {
  if (req.session && req.session.isLoggedIn && req.session.user && req.session.user.role === 'moderator') {
    return next();
  }
  res.redirect("/login");
}

// Helper: set toast
function setToast(req, type, msg) {
  req.session.toast = { type, msg };
}

// Moderator Dashboard
router.get('/dashboard', requireModerator, async (req, res) => {
  try {
    const [buyers, claimsReplace, claimsReset, logClaim] = await Promise.all([
      loadJson("buyers.json"),
      loadJson("claimsReplace.json"),
      loadJson("claimsReset.json"),
      loadJson("log_claim.json")
    ]);
    
    const stats = {
      buyers: Array.isArray(buyers) ? buyers.length : 0,
      claimsReplace: Array.isArray(claimsReplace) ? claimsReplace.filter(c => c.status === 'pending').length : 0,
      claimsReset: Array.isArray(claimsReset) ? claimsReset.filter(c => c.status === 'pending').length : 0,
      totalClaims: Array.isArray(logClaim) ? logClaim.length : 0
    };
    
    const toast = req.session.toast || null;
    delete req.session.toast;
    
    res.render("moderator_dashboard", { stats, toast, user: req.session.user });
  } catch (error) {
    console.error('Error loading moderator dashboard:', error);
    const toast = { type: "error", msg: "Gagal memuat dashboard moderator" };
    res.render("moderator_dashboard", { stats: {}, toast, user: req.session.user });
  }
});

// Moderator Buyers Management
router.get('/buyers', requireModerator, async (req, res) => {
  try {
    let buyers = await loadJson("buyers.json");
    if (!Array.isArray(buyers)) buyers = [];
    
    // Sort by date (newest first)
    buyers.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    
    const toast = req.session.toast || null;
    delete req.session.toast;
    
    res.render("moderator_buyers", { buyers, toast, user: req.session.user });
  } catch (error) {
    console.error('Error loading buyers:', error);
    const toast = { type: "error", msg: "Gagal memuat data buyers" };
    res.render("moderator_buyers", { buyers: [], toast, user: req.session.user });
  }
});

// Moderator Claims Management
router.get('/claims', requireModerator, async (req, res) => {
  try {
    const [claimsReplace, claimsReset] = await Promise.all([
      loadJson("claimsReplace.json"),
      loadJson("claimsReset.json")
    ]);
    
    const allClaims = [
      ...(Array.isArray(claimsReplace) ? claimsReplace.map(c => ({...c, type: 'replace'})) : []),
      ...(Array.isArray(claimsReset) ? claimsReset.map(c => ({...c, type: 'reset'})) : [])
    ];
    
    // Sort by date (newest first)
    allClaims.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    
    const toast = req.session.toast || null;
    delete req.session.toast;
    
    res.render("moderator_claims", { claims: allClaims, toast, user: req.session.user });
  } catch (error) {
    console.error('Error loading claims:', error);
    const toast = { type: "error", msg: "Gagal memuat data claims" };
    res.render("moderator_claims", { claims: [], toast, user: req.session.user });
  }
});

// Resolve Claim
router.post('/claims/resolve', requireModerator, async (req, res) => {
  try {
    const { claimId, claimType } = req.body;
    
    const fileName = claimType === 'replace' ? 'claimsReplace.json' : 'claimsReset.json';
    const claims = await loadJson(fileName);
    
    const claimIndex = claims.findIndex(c => c.id == claimId);
    if (claimIndex !== -1) {
      claims[claimIndex].status = 'resolved';
      claims[claimIndex].resolvedBy = req.session.user.username;
      claims[claimIndex].resolvedDate = new Date().toISOString();
      
      await saveJson(fileName, claims);
      setToast(req, "success", "Claim berhasil diselesaikan.");
    } else {
      setToast(req, "error", "Claim tidak ditemukan.");
    }
    
    res.redirect("/moderator/claims");
  } catch (error) {
    console.error('Error resolving claim:', error);
    setToast(req, "error", "Gagal menyelesaikan claim.");
    res.redirect("/moderator/claims");
  }
});

// Add Buyer (via form)
router.post('/buyers/add', requireModerator, async (req, res) => {
  try {
    const { nama, produk, harga } = req.body;
    
    if (!nama || !produk || !harga) {
      setToast(req, "error", "Semua field harus diisi.");
      return res.redirect("/moderator/buyers");
    }
    
    const buyerData = {
      id: Date.now(),
      nama: nama,
      produk: produk,
      harga: parseInt(harga),
      tanggal: new Date().toISOString(),
      admin: req.session.user.username,
      status: 'completed'
    };
    
    const buyers = await loadJson('buyers.json');
    buyers.push(buyerData);
    await saveJson('buyers.json', buyers);
    
    setToast(req, "success", "Buyer berhasil ditambahkan.");
    res.redirect("/moderator/buyers");
  } catch (error) {
    console.error('Error adding buyer:', error);
    setToast(req, "error", "Gagal menambahkan buyer.");
    res.redirect("/moderator/buyers");
  }
});

module.exports = router;
