const fs = require('fs').promises;
const path = require('path');
const stringSimilarity = require('string-similarity');
const CONSTANTS = require('./constants');

// Daftar produk & threshold fuzzy
const produkList = ['netflix', 'disney', 'canva', 'youtube', 'spotify', 'prime', 'vidio'];

async function searchHargaProdukTXT(message) {
  const msg = message.toLowerCase();
  let match = null;

  // Cek fuzzy match
  const { ratings, bestMatch } = stringSimilarity.findBestMatch(msg, produkList);
  
  if (bestMatch.rating >= 0.6) { // Use standard threshold
    match = bestMatch.target;
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
