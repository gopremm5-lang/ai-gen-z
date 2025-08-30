const express = require('express');
const router = express.Router();
const fs = require("fs").promises;
const path = require("path");

// Helper: login required
function requireLogin(req, res, next) {
  if (req.session && req.session.isLoggedIn) return next();
  res.redirect("/login");
}

// Helper: set toast
function setToast(req, type, msg) {
  req.session.toast = { type, msg };
}

// Helper: list produk files
const produkDir = path.join(__dirname, "../data/produk");

async function listProdukFiles() {
  try {
    await fs.mkdir(produkDir, { recursive: true });
    const files = await fs.readdir(produkDir);
    return files.filter(f => f.endsWith(".txt")).map(f => f.replace(".txt", ""));
  } catch (error) {
    console.error('Error listing produk files:', error);
    return [];
  }
}

async function loadProdukData() {
  try {
    const files = await listProdukFiles();
    const produk = [];
    
    for (let name of files) {
      let content = "";
      try {
        content = await fs.readFile(path.join(produkDir, name + ".txt"), "utf8");
      } catch (error) {
        console.error(`Error reading ${name}.txt:`, error);
      }
      produk.push({ name, content });
    }
    
    return produk;
  } catch (error) {
    console.error('Error loading produk data:', error);
    return [];
  }
}

// Produk page
router.get('/', requireLogin, async (req, res) => {
  try {
    const produk = await loadProdukData();
    const toast = req.session.toast || null;
    delete req.session.toast;
    
    res.render("produk", { produk, toast });
  } catch (error) {
    console.error('Error loading produk page:', error);
    const toast = { type: "error", msg: "Gagal memuat data produk" };
    res.render("produk", { produk: [], toast });
  }
});

// Save produk
router.post('/save', requireLogin, async (req, res) => {
  try {
    const { produk, content } = req.body;
    
    if (!produk || !content) {
      setToast(req, "error", "Nama produk & konten wajib diisi!");
      return res.redirect("/produk");
    }
    
    // Sanitize filename
    const filename = produk.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filepath = path.join(produkDir, filename + ".txt");
    
    await fs.mkdir(produkDir, { recursive: true });
    await fs.writeFile(filepath, content, "utf8");
    
    setToast(req, "success", "Produk berhasil disimpan.");
    res.redirect("/produk");
  } catch (error) {
    console.error('Error saving produk:', error);
    setToast(req, "error", "Gagal menyimpan produk.");
    res.redirect("/produk");
  }
});

// Delete produk
router.post('/delete', requireLogin, async (req, res) => {
  try {
    const { produk } = req.body;
    
    if (!produk) {
      setToast(req, "error", "Nama produk tidak valid.");
      return res.redirect("/produk");
    }
    
    const filename = produk.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filepath = path.join(produkDir, filename + ".txt");
    
    try {
      await fs.unlink(filepath);
      setToast(req, "success", "Produk berhasil dihapus.");
    } catch (error) {
      if (error.code === 'ENOENT') {
        setToast(req, "error", "File produk tidak ditemukan.");
      } else {
        throw error;
      }
    }
    
    res.redirect("/produk");
  } catch (error) {
    console.error('Error deleting produk:', error);
    setToast(req, "error", "Gagal menghapus produk.");
    res.redirect("/produk");
  }
});

module.exports = router;
