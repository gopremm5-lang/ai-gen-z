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

// Stock page
router.get('/', requireLogin, async (req, res) => {
  try {
    const stock = await loadJson("stock.json") || [];
    const toast = req.session.toast || null;
    delete req.session.toast;
    
    res.render("stock", { stock, toast });
  } catch (error) {
    console.error('Error loading stock data:', error);
    const toast = { type: "error", msg: "Gagal memuat data stock" };
    res.render("stock", { stock: [], toast });
  }
});

// Save stock
router.post('/save', requireLogin, async (req, res) => {
  try {
    let { idx, product, quantity, price, status } = req.body;
    
    if (!product || !quantity || !price) {
      setToast(req, "error", "Produk, quantity, dan harga wajib diisi.");
      return res.redirect("/stock");
    }
    
    let stock = await loadJson("stock.json") || [];
    if (!Array.isArray(stock)) stock = [];
    
    const stockData = {
      product: product.trim(),
      quantity: parseInt(quantity) || 0,
      price: parseFloat(price) || 0,
      status: status || 'available',
      lastUpdated: new Date().toISOString()
    };
    
    if (idx === "" || idx === undefined) {
      // Tambah baru
      stock.push(stockData);
      setToast(req, "success", "Stock berhasil ditambahkan.");
    } else {
      // Update existing
      if (stock[idx]) {
        stock[idx] = stockData;
        setToast(req, "success", "Stock berhasil diperbarui.");
      } else {
        setToast(req, "error", "Stock tidak ditemukan.");
        return res.redirect("/stock");
      }
    }
    
    await saveJson("stock.json", stock);
    res.redirect("/stock");
  } catch (error) {
    console.error('Error saving stock:', error);
    setToast(req, "error", "Gagal menyimpan stock.");
    res.redirect("/stock");
  }
});

// Delete stock
router.post('/delete', requireLogin, async (req, res) => {
  try {
    const { idx } = req.body;
    let stock = await loadJson("stock.json") || [];
    
    if (stock[idx]) {
      stock.splice(idx, 1);
      await saveJson("stock.json", stock);
      setToast(req, "success", "Stock berhasil dihapus.");
    } else {
      setToast(req, "error", "Stock tidak ditemukan.");
    }
    
    res.redirect("/stock");
  } catch (error) {
    console.error('Error deleting stock:', error);
    setToast(req, "error", "Gagal menghapus stock.");
    res.redirect("/stock");
  }
});

// Update stock quantity
router.post('/update-quantity', requireLogin, async (req, res) => {
  try {
    const { idx, quantity } = req.body;
    let stock = await loadJson("stock.json") || [];
    
    if (stock[idx]) {
      stock[idx].quantity = parseInt(quantity) || 0;
      stock[idx].lastUpdated = new Date().toISOString();
      await saveJson("stock.json", stock);
      setToast(req, "success", "Quantity stock berhasil diperbarui.");
    } else {
      setToast(req, "error", "Stock tidak ditemukan.");
    }
    
    res.redirect("/stock");
  } catch (error) {
    console.error('Error updating stock quantity:', error);
    setToast(req, "error", "Gagal memperbarui quantity stock.");
    res.redirect("/stock");
  }
});

module.exports = router;
