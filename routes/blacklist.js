const express = require('express');
const router = express.Router();
const { loadBlacklist, saveJson } = require('../lib/dataLoader');

router.get("/", async (req, res) => {
  const blacklist = await loadBlacklist() || [];
  const toast = req.session.toast || null;
  delete req.session.toast;
  res.render("blacklist", { blacklist, toast });
});

router.post("/add", async (req, res) => {
  let blacklistList = await loadBlacklist() || [];
  const { user, reason } = req.body;
  blacklistList.push({
    user: user.trim(),
    reason: reason.trim(),
    date: new Date().toISOString()
  });
  await saveJson('blacklist.json', blacklistList);
  req.session.toast = { type: "success", msg: "User berhasil di-blacklist!" };
  res.redirect('/blacklist');
});

router.post("/delete", async (req, res) => {
  let blacklistList = await loadBlacklist() || [];
  blacklistList.splice(req.body.index, 1);
  await saveJson('blacklist.json', blacklistList);
  req.session.toast = { type: "success", msg: "Blacklist dihapus!" };
  res.redirect('/blacklist');
});

module.exports = router;
