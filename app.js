require('dotenv').config();
const express = require("express");
const session = require("express-session");
const open = require("open");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 9011;
const ADMIN_PASS = process.env.ADMIN_PASS || "Konfirmasi"; // .env

// ================== SETUP ==================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false, // Better security
  cookie: { 
    maxAge: 8 * 60 * 60 * 1000,
    httpOnly: true, // Prevent XSS
    secure: process.env.NODE_ENV === 'production' // HTTPS only in production
  }
}));

// ================== ROUTES ==================
app.use('/', require('./routes/auth'));
app.use('/buyers', require('./routes/buyers'));
app.use('/blacklist', require('./routes/blacklist'));
app.use('/stock', require('./routes/stock'));
app.use('/faq', require('./routes/faq'));
app.use('/sop', require('./routes/sop'));
app.use('/promo', require('./routes/promo'));
app.use('/produk', require('./routes/produk'));
app.use('/claim', require('./routes/claim'));
app.use('/moderator', require('./routes/moderator'));
app.use('/texts', require('./routes/texts'));

// ================== API ENDPOINTS ==================
// Dashboard Orders API
app.get('/api/dashboard-orders', requireLogin, async (req, res) => {
  try {
    const [buyers, claims] = await Promise.all([
      loadJson("buyers.json"),
      loadJson("log_claim.json")
    ]);
    
    // Generate last 7 days data
    const last7Days = [];
    const orderCounts = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Count orders for this date
      const dayOrders = Array.isArray(buyers) ? 
        buyers.filter(buyer => 
          buyer.data && buyer.data.some(transaction => 
            transaction.dateGiven === dateStr
          )
        ).length : 0;
      
      last7Days.push(date.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }));
      orderCounts.push(dayOrders);
    }
    
    res.json({
      labels: last7Days,
      orders: orderCounts
    });
  } catch (error) {
    console.error('Dashboard orders API error:', error);
    res.json({
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      orders: [0, 0, 0, 0, 0, 0, 0]
    });
  }
});

// Learning Stats API
app.get('/api/learning-stats', requireLogin, async (req, res) => {
  try {
    const { learningManager } = require('./lib/learningManager');
    const stats = await learningManager.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Learning stats API error:', error);
    res.json({ error: 'Failed to load learning stats' });
  }
});

// Attendance API
app.get('/api/attendance/today', requireLogin, async (req, res) => {
  try {
    const { attendanceManager } = require('./lib/attendanceManager');
    const data = await attendanceManager.getAttendanceData();
    res.json(data);
  } catch (error) {
    console.error('Attendance API error:', error);
    res.json({ error: 'Failed to load attendance data' });
  }
});

app.get('/api/attendance/summary', requireLogin, async (req, res) => {
  try {
    const { attendanceManager } = require('./lib/attendanceManager');
    const { startDate, endDate } = req.query;
    const summary = await attendanceManager.getAttendanceSummary(startDate, endDate);
    res.json(summary);
  } catch (error) {
    console.error('Attendance summary API error:', error);
    res.json({ error: 'Failed to load attendance summary' });
  }
});

// Business Intelligence API
app.get('/api/business-insights', requireLogin, async (req, res) => {
  try {
    const { businessIntelligence } = require('./lib/businessIntelligence');
    const insights = await businessIntelligence.getInsightsData();
    res.json(insights);
  } catch (error) {
    console.error('Business insights API error:', error);
    res.json({ error: 'Failed to load business insights' });
  }
});

app.get('/api/business-alerts', requireLogin, async (req, res) => {
  try {
    const { businessIntelligence } = require('./lib/businessIntelligence');
    const alerts = await businessIntelligence.getAlertsData();
    res.json(alerts);
  } catch (error) {
    console.error('Business alerts API error:', error);
    res.json({ error: 'Failed to load business alerts' });
  }
});

// Customer Insights API (for admin when handling customer)
app.get('/api/customer-insights/:customerNumber', requireLogin, async (req, res) => {
  try {
    const { conversationContext } = require('./lib/conversationContext');
    const customerNumber = req.params.customerNumber;
    const insights = conversationContext.getCustomerInsights(customerNumber + '@s.whatsapp.net');
    res.json(insights);
  } catch (error) {
    console.error('Customer insights API error:', error);
    res.json({ error: 'Failed to load customer insights' });
  }
});

// Admin Templates API
app.get('/api/admin-templates', requireLogin, async (req, res) => {
  try {
    const { adminTemplates } = require('./lib/adminTemplates');
    const templates = adminTemplates.getAllTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Admin templates API error:', error);
    res.json({ error: 'Failed to load admin templates' });
  }
});

app.get('/api/admin-templates/suggestions/:customerNumber', requireLogin, async (req, res) => {
  try {
    const { adminTemplates } = require('./lib/adminTemplates');
    const customerNumber = req.params.customerNumber;
    const suggestions = await adminTemplates.getSuggestedTemplates(customerNumber + '@s.whatsapp.net');
    res.json(suggestions);
  } catch (error) {
    console.error('Template suggestions API error:', error);
    res.json({ error: 'Failed to load template suggestions' });
  }
});

// Quick Templates Dashboard
app.get('/templates', requireLogin, async (req, res) => {
  try {
    const toast = req.session.toast || null;
    delete req.session.toast;
    
    res.render('admin_templates', { 
      toast: toast,
      user: req.session.user || { username: 'Admin', role: 'admin' }
    });
  } catch (error) {
    console.error('Templates page error:', error);
    res.status(500).render('404');
  }
});

// Attendance Dashboard Page (Owner Only)
app.get('/attendance', requireLogin, async (req, res) => {
  try {
    // Only owner (admin role) can access attendance dashboard
    if (req.session.user?.role !== 'admin') {
      return res.status(403).render('404');
    }
    
    const toast = req.session.toast || null;
    delete req.session.toast;
    
    res.render('attendance', { 
      toast: toast,
      user: req.session.user || { username: 'Admin', role: 'admin' }
    });
  } catch (error) {
    console.error('Attendance page error:', error);
    res.status(500).render('404');
  }
});

// Analytics routes
app.get('/analytics/:category', requireLogin, async (req, res) => {
  try {
    const category = req.params.category;
    const validCategories = ['traffic', 'users', 'products', 'claims', 'business', 'marketing', 'technical', 'security', 'intelligence', 'customer_service'];
    
    if (!validCategories.includes(category)) {
      return res.status(400).render('404');
    }
    
    const toast = req.session.toast || null;
    delete req.session.toast;
    
    res.render('analytics', { 
      category: category,
      toast: toast,
      user: req.session.user || { username: 'Admin', role: 'admin' }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).render('404');
  }
});

// API endpoint for analytics data
app.get('/api/analytics/:category', requireLogin, async (req, res) => {
  try {
    const category = req.params.category;
    const validCategories = ['traffic', 'users', 'products', 'claims', 'business', 'marketing', 'technical', 'security', 'intelligence', 'customer_service'];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    
    // Try to load analytics manager
    let analytics = {};
    try {
      const { analyticsManager } = require('./lib/analyticsManager');
      if (analyticsManager && analyticsManager.getAnalyticsByCategory) {
        analytics = analyticsManager.getAnalyticsByCategory(category);
      } else {
        analytics = { message: 'Analytics data is being collected', category: category };
      }
    } catch (importError) {
      console.log('Analytics manager not available:', importError.message);
      analytics = { message: 'Analytics system is initializing', category: category };
    }
    
    res.json(analytics);
  } catch (error) {
    console.error('Analytics API error:', error);
    res.status(500).json({ error: 'Failed to load analytics data' });
  }
});

// ================== HELPERS ==================
// --- Helper: login required ---
function requireLogin(req, res, next) {
  if (req.session && req.session.isLoggedIn) return next();
  res.redirect("/login");
}

// --- Helper: show toast ---
function setToast(req, type, msg) {
  req.session.toast = { type, msg };
}

// --- Helper: load JSON file ---
async function loadJson(file) {
  try {
    const content = await fs.readFile(path.join(__dirname, "data", file), "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading ${file}:`, error.message);
    return [];
  }
}

// --- Helper: save JSON file ---
async function saveJson(file, data) {
  try {
    await fs.writeFile(path.join(__dirname, "data", file), JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error(`Error saving ${file}:`, error.message);
    return false;
  }
}

// --- Helper: produk ---
const produkDir = path.join(__dirname, "data/produk");
async function listProdukFiles() {
  try {
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

// ================== MAIN ROUTES ==================

// --- DASHBOARD ---
app.get(["/dashboard"], requireLogin, async (req, res) => {
  try {
    // Basic file stats
    const [produk, promo, faq, sop, claim] = await Promise.all([
      listProdukFiles(),
      loadJson("promo.json"),
      loadJson("faq.json"),
      loadJson("sop.json"),
      loadJson("log_claim.json")
    ]);
    
    // Combine basic stats with advanced analytics
    const basicStats = {
      produk: produk.length,
      promo: Array.isArray(promo) ? promo.length : 0,
      faq: Array.isArray(faq) ? faq.length : 0,
      sop: Array.isArray(sop) ? sop.length : 0,
      claim: Array.isArray(claim) ? claim.length : 0
    };
    
    // Always include analytics categories for dashboard display
    const stats = {
      ...basicStats,
      // Always show analytics categories
      categories: ['traffic', 'users', 'products', 'claims', 'business', 'marketing', 'technical', 'security', 'intelligence', 'customer_service']
    };
    
    console.log('Dashboard stats:', stats); // Debug log
    
    const toast = req.session.toast || null;
    delete req.session.toast;
    
    // Support both old and new auth system
    const user = req.session.user || { username: 'Admin', role: 'admin' };
    
    res.render("dashboard", { stats, toast, user });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    const toast = { type: "error", msg: "Gagal memuat dashboard" };
    const user = req.session.user || { username: 'Admin', role: 'admin' };
    res.render("dashboard", { stats: {}, toast, user });
  }
});

// --- CLAIM REPLACE ---
app.get("/claims-replace", requireLogin, async (req, res) => {
  try {
    let claimsReplace = await loadJson("claimsReplace.json");
    if (!Array.isArray(claimsReplace)) claimsReplace = [];
    const toast = req.session.toast || null;
    delete req.session.toast;
    res.render("claims_replace", { claimsReplace, toast });
  } catch (error) {
    console.error('Error loading claims replace:', error);
    const toast = { type: "error", msg: "Gagal memuat data claims replace" };
    res.render("claims_replace", { claimsReplace: [], toast });
  }
});

app.post("/claims-replace/resolve", requireLogin, async (req, res) => {
  try {
    const { index } = req.body;
    let claimsReplace = await loadJson("claimsReplace.json");
    if (!Array.isArray(claimsReplace)) claimsReplace = [];
    if (claimsReplace[index]) {
      claimsReplace[index].status = "RESOLVED";
      await saveJson("claimsReplace.json", claimsReplace);
      setToast(req, "success", "Claim ditandai selesai.");
    } else {
      setToast(req, "error", "Claim tidak ditemukan.");
    }
    res.redirect("/claims-replace");
  } catch (error) {
    console.error('Error resolving claims replace:', error);
    setToast(req, "error", "Gagal memproses claim.");
    res.redirect("/claims-replace");
  }
});

// --- CLAIM RESET ---
app.get("/claims-reset", requireLogin, async (req, res) => {
  try {
    let claimsReset = await loadJson("claimsReset.json");
    if (!Array.isArray(claimsReset)) claimsReset = [];
    const toast = req.session.toast || null;
    delete req.session.toast;
    res.render("claims_reset", { claimsReset, toast });
  } catch (error) {
    console.error('Error loading claims reset:', error);
    const toast = { type: "error", msg: "Gagal memuat data claims reset" };
    res.render("claims_reset", { claimsReset: [], toast });
  }
});

app.post("/claims-reset/mark", requireLogin, async (req, res) => {
  try {
    const { index } = req.body;
    let claimsReset = await loadJson("claimsReset.json");
    if (!Array.isArray(claimsReset)) claimsReset = [];
    if (claimsReset[index]) {
      claimsReset[index].done = true;
      await saveJson("claimsReset.json", claimsReset);
      setToast(req, "success", "Reset ditandai selesai.");
    } else {
      setToast(req, "error", "Reset tidak ditemukan.");
    }
    res.redirect("/claims-reset");
  } catch (error) {
    console.error('Error marking claims reset:', error);
    setToast(req, "error", "Gagal memproses reset.");
    res.redirect("/claims-reset");
  }
});

// ========== 404 ==========
app.use((req, res) => {
  res.status(404).render("404");
});

// ========== ERROR HANDLER ==========
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).render("404");
});

// ========== START ==========
(async () => {
  try {
    await fs.mkdir(produkDir, { recursive: true });
    app.listen(PORT, () => {
      console.log(`Admin Panel running on http://localhost:${PORT}/login`);
      // open(`http://localhost:${PORT}/login`); // Boleh dihapus kalau di VPS
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
})();
