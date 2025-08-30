const express = require('express');
const router = express.Router();
const { textManager } = require('../lib/textManager');

// Helper: require owner login (admin role = owner)
function requireOwner(req, res, next) {
  if (req.session && req.session.isLoggedIn && req.session.user?.role === 'admin') {
    return next();
  }
  res.status(403).render('404');
}

// Helper: set toast
function setToast(req, type, msg) {
  req.session.toast = { type, msg };
}

// Text Editor Dashboard (Owner Only)
router.get('/', requireOwner, async (req, res) => {
  try {
    const allTexts = await textManager.getAllTexts();
    const usageStats = await textManager.getUsageStats();
    
    const toast = req.session.toast || null;
    delete req.session.toast;
    
    res.render('text_editor', { 
      allTexts: allTexts,
      usageStats: usageStats,
      toast: toast,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error loading text editor:', error);
    const toast = { type: "error", msg: "Gagal memuat text editor" };
    res.render('text_editor', { 
      allTexts: { categories: {}, texts: {} }, 
      usageStats: { totalTexts: 0, categoryCounts: {} },
      toast: toast,
      user: req.session.user
    });
  }
});

// Update Text
router.post('/update', requireOwner, async (req, res) => {
  try {
    const { category, key, text } = req.body;
    
    if (!category || !key || !text) {
      setToast(req, "error", "Category, key, dan text wajib diisi!");
      return res.redirect("/texts");
    }
    
    // Validate text
    const validation = textManager.validateText(text);
    if (!validation.isValid) {
      setToast(req, "error", `Validasi gagal: ${validation.issues.join(', ')}`);
      return res.redirect("/texts");
    }
    
    // Update text
    const success = await textManager.updateText(category, key, text);
    
    if (success) {
      // Hot reload texts
      await textManager.hotReload();
      setToast(req, "success", `Text ${category}.${key} berhasil diupdate!`);
    } else {
      setToast(req, "error", "Gagal mengupdate text");
    }
    
    res.redirect("/texts");
  } catch (error) {
    console.error('Error updating text:', error);
    setToast(req, "error", "Terjadi kesalahan saat mengupdate text");
    res.redirect("/texts");
  }
});

// Add New Text
router.post('/add', requireOwner, async (req, res) => {
  try {
    const { category, key, text } = req.body;
    
    if (!category || !key || !text) {
      setToast(req, "error", "Semua field wajib diisi!");
      return res.redirect("/texts");
    }
    
    // Validate text
    const validation = textManager.validateText(text);
    if (!validation.isValid) {
      setToast(req, "error", `Validasi gagal: ${validation.issues.join(', ')}`);
      return res.redirect("/texts");
    }
    
    // Add new text
    const success = await textManager.updateText(category, key, text);
    
    if (success) {
      await textManager.hotReload();
      setToast(req, "success", `Text baru ${category}.${key} berhasil ditambahkan!`);
    } else {
      setToast(req, "error", "Gagal menambahkan text baru");
    }
    
    res.redirect("/texts");
  } catch (error) {
    console.error('Error adding text:', error);
    setToast(req, "error", "Terjadi kesalahan saat menambahkan text");
    res.redirect("/texts");
  }
});

// Search Texts
router.get('/search', requireOwner, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.json([]);
    }
    
    const results = textManager.searchTexts(q.trim());
    res.json(results);
  } catch (error) {
    console.error('Error searching texts:', error);
    res.json([]);
  }
});

// Reset to Defaults
router.post('/reset', requireOwner, async (req, res) => {
  try {
    // Backup current texts first
    const backupFile = await textManager.backupTexts();
    
    // Reset to defaults
    const success = await textManager.resetToDefaults();
    
    if (success) {
      await textManager.hotReload();
      setToast(req, "success", `Text direset ke default! Backup disimpan: ${backupFile}`);
    } else {
      setToast(req, "error", "Gagal reset text");
    }
    
    res.redirect("/texts");
  } catch (error) {
    console.error('Error resetting texts:', error);
    setToast(req, "error", "Terjadi kesalahan saat reset text");
    res.redirect("/texts");
  }
});

// Hot Reload
router.post('/reload', requireOwner, async (req, res) => {
  try {
    const success = await textManager.hotReload();
    
    if (success) {
      setToast(req, "success", "Text berhasil di-reload!");
    } else {
      setToast(req, "error", "Gagal reload text");
    }
    
    res.redirect("/texts");
  } catch (error) {
    console.error('Error reloading texts:', error);
    setToast(req, "error", "Terjadi kesalahan saat reload text");
    res.redirect("/texts");
  }
});

module.exports = router;