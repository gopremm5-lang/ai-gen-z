const fs = require('fs').promises;
const path = require('path');
const fuzz = require('fuzzball');
const CONSTANTS = require('./constants');

// Daftar produk & threshold fuzzy
const produkList = ['netflix', 'disney', 'canva', 'youtube', 'spotify', 'prime', 'vidio'];

async function searchHargaProdukTXT(message) {
  const msg = message.toLowerCase();
  let match = null;

  // Cek fuzzy match
  let best = fuzz.extract(msg, produkList, { scorer: fuzz.ratio, returnObjects: true });
  best = best.filter(x => x.score >= (CONSTANTS.FUZZY_SEARCH.SIMILARITY_THRESHOLD * 100)); // Use constants

  if (best.length > 0) {
    match = best[0].choice;
  } else {
    // fallback simple include
    match = produkList.find(key => msg.includes(key));
  }
  if (match) {
    const filePath = path.join(__dirname, '../data/produk', `${match}.txt`);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content; // Langsung balikin teks yang ada di file!
    } catch (e) {
      return `Info produk *${match}* belum tersedia, Kak.`;
    }
  }
  return null;
}

module.exports = { searchHargaProdukTXT };
