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

// FAQ page
router.get('/', requireLogin, async (req, res) => {
  try {
    const faq = await loadJson("faq.json") || [];
    const toast = req.session.toast || null;
    delete req.session.toast;
    
    res.render("faq", { faq, toast });
  } catch (error) {
    console.error('Error loading FAQ data:', error);
    const toast = { type: "error", msg: "Gagal memuat data FAQ" };
    res.render("faq", { faq: [], toast });
  }
});

// Save FAQ
router.post('/save', requireLogin, async (req, res) => {
  try {
    let { idx, question, answer, keywords } = req.body;
    
    if (!question || !answer) {
      setToast(req, "error", "Pertanyaan dan jawaban wajib diisi.");
      return res.redirect("/faq");
    }
    
    let faq = await loadJson("faq.json") || [];
    if (!Array.isArray(faq)) faq = [];
    
    // Process keywords - convert comma separated to array
    let keywordArray = [];
    if (keywords && keywords.trim()) {
      keywordArray = keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
    }
    // Add question as default keyword if no keywords provided
    if (keywordArray.length === 0) {
      keywordArray = [question.toLowerCase()];
    }
    
    const faqItem = {
      question,
      answer,
      keyword: keywordArray,
      response: [answer] // Support both formats
    };
    
    if (idx === "" || idx === undefined) {
      // Tambah baru
      faq.push(faqItem);
      setToast(req, "success", "FAQ berhasil ditambahkan.");
    } else {
      // Update existing
      if (faq[idx]) {
        faq[idx] = faqItem;
        setToast(req, "success", "FAQ berhasil diperbarui.");
      } else {
        setToast(req, "error", "FAQ tidak ditemukan.");
        return res.redirect("/faq");
      }
    }
    
    await saveJson("faq.json", faq);
    res.redirect("/faq");
  } catch (error) {
    console.error('Error saving FAQ:', error);
    setToast(req, "error", "Gagal menyimpan FAQ.");
    res.redirect("/faq");
  }
});

// Delete FAQ
router.post('/delete', requireLogin, async (req, res) => {
  try {
    const { idx } = req.body;
    let faq = await loadJson("faq.json") || [];
    
    if (faq[idx]) {
      faq.splice(idx, 1);
      await saveJson("faq.json", faq);
      setToast(req, "success", "FAQ berhasil dihapus.");
    } else {
      setToast(req, "error", "FAQ tidak ditemukan.");
    }
    
    res.redirect("/faq");
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    setToast(req, "error", "Gagal menghapus FAQ.");
    res.redirect("/faq");
  }
});

module.exports = router;
