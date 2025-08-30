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

// Login Page
router.get(["/", "/login"], (req, res) => {
  if (req.session && req.session.isLoggedIn) {
    // Redirect based on role
    if (req.session.user && req.session.user.role === 'moderator') {
      return res.redirect("/moderator/dashboard");
    }
    return res.redirect("/dashboard");
  }
  
  const toast = req.session.toast || null;
  delete req.session.toast;
  res.render("login", { toast, error: null });
});

// Login Process
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const config = require('../config');
  const ADMIN_PASS = config.isProduction ? process.env.ADMIN_PASS : "Konfirmasi";
  
  try {
    // Check admin login
    if (username === "admin" && password === ADMIN_PASS) {
      req.session.isLoggedIn = true;
      req.session.user = {
        username: "admin",
        role: "admin",
        loginTime: new Date().toISOString()
      };
      setToast(req, "success", "Login berhasil sebagai Admin!");
      return res.redirect("/dashboard");
    }
    
    // Check moderator login
    try {
      const moderators = await loadJson('moderators.json');
      const moderator = moderators.find(mod => 
        mod.number === username && 
        mod.active === true
      );
      
      if (moderator && password === ADMIN_PASS) {
        req.session.isLoggedIn = true;
        req.session.user = {
          username: moderator.name,
          number: moderator.number,
          role: "moderator",
          loginTime: new Date().toISOString()
        };
        setToast(req, "success", `Login berhasil sebagai Moderator: ${moderator.name}!`);
        return res.redirect("/moderator/dashboard");
      }
    } catch (modError) {
      console.log('No moderators file found or error loading:', modError.message);
    }
    
    // Fallback: old login system (password only)
    if (!username && password === ADMIN_PASS) {
      req.session.isLoggedIn = true;
      req.session.user = {
        username: "admin",
        role: "admin",
        loginTime: new Date().toISOString()
      };
      return res.redirect("/dashboard");
    }
    
    // Login failed
    setToast(req, "error", "Username atau password salah!");
    res.render('login', { error: 'Username atau password salah!', toast: null });
    
  } catch (error) {
    console.error('Login error:', error);
    setToast(req, "error", "Terjadi kesalahan saat login.");
    res.render('login', { error: 'Terjadi kesalahan sistem', toast: null });
  }
});

// Logout
router.get("/logout", (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
      }
      res.redirect("/login");
    });
  } catch (error) {
    console.error('Error during logout:', error);
    res.redirect("/login");
  }
});

module.exports = router;
