const fs = require('fs').promises;
const path = require('path');
const stringSimilarity = require('string-similarity');
const { loadProdukTxt, loadFAQ, loadSOP, loadPromo, getProductInfo } = require('./dataLoader');
const { smartContentAnalyzer } = require('./smartContentAnalyzer');
const { advancedContentReader } = require('./advancedContentReader');

// Deteksi intent untuk produk - lebih fleksibel dan kontekstual
function detectProductIntent(msg) {
  const lower = msg.toLowerCase();
  
  // Check if specific product is mentioned - ONLY products that actually exist
  const productKeywords = [
    'netflix', 'disney', 'youtube', 'iqiyi', 'viu', 'wetv', 'vision+', 'vidio', 
    'prime', 'hbo', 'bstation', 'alightmotion', 'chatgpt', 'capcut'
  ];
  
  const hasProductMention = productKeywords.some(product => lower.includes(product));
  if (hasProductMention) {
    // If product is mentioned, always allow - even with problem keywords
    // "kenapa netflix mahal?" should return Netflix info
    return true;
  }
  
  // Keywords yang menunjukkan user INGIN info produk
  const productIntents = [
    'info', 'detail', 'spek', 'fitur', 'apa itu', 'tentang', 'deskripsi',
    'mau', 'pengen', 'butuh', 'cari', 'ada gak', 'ada tidak', 'ada ga',
    'jual', 'tersedia', 'ready', 'stock', 'beli', 'order', 'pesan',
    'rekomendasi', 'suggest', 'pilihan', 'varian', 'tipe', 'jenis',
    'harga', 'berapa', 'biaya' // Allow price questions for products
  ];
  
  const hasProductIntent = productIntents.some(intent => lower.includes(intent));
  
  // Only block if it's clearly non-product AND no product mention
  const clearlyNonProduct = [
    'login', 'masuk', 'akses', 'password', 'username', 'email', 'akun saya',
    'error', 'gagal', 'tidak bisa', 'gak bisa', 'masalah', 'kendala', 'trouble',
    'proses', 'status', 'sudah sampai', 'kapan selesai', 'belum sampai'
  ];
  
  const isNonProduct = clearlyNonProduct.some(intent => lower.includes(intent)) && !hasProductIntent;
  
  return !isNonProduct;
}

// Enhanced fuzzy search dengan smart parsing
async function fuzzySearchProduk(msg) {
  const input = msg.toLowerCase();
  
  // Step 1: Deteksi intent - apakah user benar-benar ingin info produk?
  const hasProductIntent = detectProductIntent(msg);
  
  // Step 2: Deteksi specific info request
  const infoType = detectInfoType(msg);
  
  // Debug logging (bisa dimatikan di production)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[PRODUCT INTENT] "${msg}" -> Intent: ${hasProductIntent}, InfoType: ${infoType}`);
  }
  
  const produkDir = path.join(__dirname, '../data/produk');
  let produkNames = [];

  // Baca nama semua produk (file txt)
  try {
    const files = await fs.readdir(produkDir);
    produkNames = files.filter(f => f.endsWith('.txt')).map(f => f.replace('.txt', ''));
  } catch {
    return null;
  }

  // Step 3: Hard match dengan prioritas tinggi untuk produk yang disebutkan langsung
  for (const name of produkNames) {
    if (input.includes(name.toLowerCase())) {
      // PRIORITAS TINGGI: Jika nama produk disebutkan, langsung return data produk
      // Tidak peduli intent detection untuk menghindari false negative
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[PRODUCT MATCH] Hard match found: "${name}" with info type: "${infoType}"`);
      }
      
      // Use smart parser to get specific info
      const smartResponse = await getProductInfo(name, infoType);
      if (smartResponse && smartResponse.trim() && !smartResponse.includes('tidak ditemukan')) {
        return smartResponse;
      }
    }
  }

  // Step 4: Enhanced fuzzy search dengan validasi yang lebih ketat
  if (produkNames.length) {
    const { ratings, bestMatch } = stringSimilarity.findBestMatch(input, produkNames);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[FUZZY SEARCH] Best match: "${bestMatch.target}" (${(bestMatch.rating * 100).toFixed(1)}%)`);
    }
    
    // VALIDASI KETAT: Cek apakah match benar-benar masuk akal
    const isValidMatch = validateFuzzyMatch(input, bestMatch.target, bestMatch.rating);
    
    // STANDARDIZED CONFIDENCE THRESHOLD: 0.6 across all modules
    if (isValidMatch && bestMatch.rating > 0.6) {
      const smartResponse = await getProductInfo(bestMatch.target, infoType);
      if (smartResponse && smartResponse.trim() && !smartResponse.includes('tidak ditemukan')) {
        return smartResponse;
      }
    }
    
    // Untuk rating sedang, butuh validasi ekstra ketat
    if (isValidMatch && bestMatch.rating > 0.5) {
      const words = input.split(' ');
      const productWords = bestMatch.target.toLowerCase().split(' ');
      const matchingWords = productWords.filter(pw => 
        words.some(w => w.includes(pw) || pw.includes(w))
      );
      
      const wordMatchRatio = matchingWords.length / productWords.length;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[WORD MATCH] "${bestMatch.target}" word ratio: ${(wordMatchRatio * 100).toFixed(1)}%`);
      }
      
      // Jika >50% kata produk cocok DAN ada kesamaan karakter, return data produk
      if (wordMatchRatio > 0.5 && hasCharacterSimilarity(input, bestMatch.target)) {
        const smartResponse = await getProductInfo(bestMatch.target, infoType);
        if (smartResponse && smartResponse.trim() && !smartResponse.includes('tidak ditemukan')) {
          return smartResponse;
        }
      }
    }
  }
  
  return null;
}

// Deteksi jenis info yang diminta user
function detectInfoType(msg) {
  const lower = msg.toLowerCase();
  
  // Deteksi garansi
  if (lower.includes('garansi') || lower.includes('warranty') || lower.includes('jaminan')) {
    return 'garansi';
  }
  
  // Deteksi harga/paket
  if (lower.includes('harga') || lower.includes('price') || lower.includes('berapa') || 
      lower.includes('biaya') || lower.includes('paket') || lower.includes('package')) {
    return 'harga';
  }
  
  // Deteksi fitur
  if (lower.includes('fitur') || lower.includes('feature') || lower.includes('spek') || 
      lower.includes('benefit') || lower.includes('keunggulan')) {
    return 'fitur';
  }
  
  // Deteksi info lengkap
  if (lower.includes('info lengkap') || lower.includes('detail') || lower.includes('semua') ||
      lower.includes('full info') || lower.includes('penjelasan')) {
    return 'full';
  }
  
  // Default: return harga (paling sering ditanya + include closing question)
  return 'harga';
}

// Validasi fuzzy match untuk mencegah false positive
function validateFuzzyMatch(input, target, rating) {
  const inputLower = input.toLowerCase();
  const targetLower = target.toLowerCase();
  
  // Rule 1: Jika input sangat pendek (1-2 karakter), butuh similarity tinggi
  if (input.length <= 2 && rating < 0.8) {
    return false;
  }
  
  // Rule 2: Cek apakah ada karakter awal yang sama
  const inputFirstChar = inputLower.charAt(0);
  const targetFirstChar = targetLower.charAt(0);
  
  if (inputFirstChar !== targetFirstChar && rating < 0.7) {
    return false;
  }
  
  // Rule 3: Untuk produk yang mirip seperti "canva" vs "capcut", butuh validasi ketat
  const confusingPairs = [
    ['canva', 'capcut'],
    ['netflix', 'wetv'],
    ['spotify', 'disney'],
    ['youtube', 'prime']
  ];
  
  for (const [prod1, prod2] of confusingPairs) {
    if ((inputLower.includes(prod1) && targetLower.includes(prod2)) ||
        (inputLower.includes(prod2) && targetLower.includes(prod1))) {
      // Jika input jelas menyebutkan satu produk, jangan match ke produk lain
      if (inputLower === prod1 || inputLower === prod2) {
        return inputLower === targetLower;
      }
      // Butuh similarity sangat tinggi untuk produk yang membingungkan
      return rating > 0.8;
    }
  }
  
  // Rule 4: Jika ada substring yang cocok, lebih permisif
  if (inputLower.includes(targetLower) || targetLower.includes(inputLower)) {
    return rating > 0.3;
  }
  
  return true; // Default: allow match
}

// Cek kesamaan karakter untuk validasi tambahan
function hasCharacterSimilarity(input, target) {
  const inputLower = input.toLowerCase();
  const targetLower = target.toLowerCase();
  
  // Hitung berapa banyak karakter yang sama
  const inputChars = new Set(inputLower.split(''));
  const targetChars = new Set(targetLower.split(''));
  
  const commonChars = [...inputChars].filter(char => targetChars.has(char));
  const similarity = commonChars.length / Math.max(inputChars.size, targetChars.size);
  
  return similarity > 0.4; // Minimal 40% karakter yang sama
}

// Fuzzy Mood Detector
const keywordsMood = {
  marah: ["gak dapet", "kecewa", "kesel", "parah", "anjing", "kok lama", "udah nunggu", "masih belum", "gak jelas", "ga kelar2", "bosen", "sampe kapan", "kapan akun", "error terus", "gimana sih", "kok susah", "coba cek lagi", "udah capek", "ngaco", "payah", "tolol"],
  positif: ["makasih", "thanks", "terima kasih", "oke kak", "cepat banget", "mantap", "sip", "lancar", "puas", "good job"],
  oot: ["curhat", "ngopi yuk", "iseng aja", "nongkrong", "gabut", "temenin aku", "ngobrol yuk", "main yuk", "ngomongin lain", "bukan order", "topik lain"]
};

function detectMood(msg) {
  const lower = msg.toLowerCase();
  for (const mood in keywordsMood) {
    if (keywordsMood[mood].some(k => lower.includes(k))) return mood;
  }
  if (/(kenapa|kok|kapan)/.test(lower) && /(dikirim|masuk|proses|error|gagal|akun)/.test(lower)) return 'marah';
  return "netral";
}

// Fuzzy FAQ/SOP Handler
function fuzzyMatch(msg, arr, field = 'keyword') {
  try {
    // Validasi input
    if (!msg || typeof msg !== 'string') {
      console.warn('fuzzyMatch: invalid msg', typeof msg);
      return null;
    }
    
    if (!arr || !Array.isArray(arr)) {
      console.warn('fuzzyMatch: arr is not array', typeof arr);
      return null;
    }

    if (arr.length === 0) {
      return null;
    }

    const input = msg.toLowerCase().trim();
    if (input.length === 0) {
      return null;
    }

    let maxSim = 0, bestRes = null;
    
    for (const item of arr) {
      try {
        // CRITICAL FIX: Check if item and item[field] exist and are iterable
        if (!item || typeof item !== 'object') {
          continue; // Skip invalid items
        }

        if (!item[field]) {
          continue; // Skip item jika field tidak ada
        }
        
        // Handle different data types - Support both FAQ and SOP format
        let keywords = [];
        if (Array.isArray(item[field])) {
          keywords = item[field].filter(kw => kw && typeof kw === 'string');
        } else if (typeof item[field] === 'string') {
          keywords = [item[field]]; // Convert string to array
        } else {
          console.warn(`fuzzyMatch: item[${field}] is not string or array:`, typeof item[field]);
          continue;
        }
        
        if (keywords.length === 0) {
          continue;
        }
        
        // Safe iteration
        for (const kw of keywords) {
          try {
            if (!kw || typeof kw !== 'string') continue;
            
            const kwLower = kw.toLowerCase().trim();
            if (kwLower.length === 0) continue;
            
            // Hard match first (more reliable)
            if (input.includes(kwLower) || kwLower.includes(input)) {
              return item;
            }
            
            // Fuzzy match with safety check
            const sim = stringSimilarity.compareTwoStrings(input, kwLower);
            if (sim > maxSim && sim > 0.1) { // Minimum threshold to avoid noise
              maxSim = sim;
              bestRes = item;
            }
          } catch (kwError) {
            console.warn('Error processing keyword:', kwError.message);
            continue;
          }
        }
      } catch (itemError) {
        console.warn('Error processing item in fuzzyMatch:', itemError.message);
        continue;
      }
    }
    
    // STANDARDIZED CONFIDENCE THRESHOLD: 0.6
    return (maxSim > 0.6) ? bestRes : null;
  } catch (error) {
    console.error('fuzzyMatch error:', error.message);
    return null;
  }
}

// Handler utama dengan prioritas yang lebih cerdas
async function handleUserMessage(msg, sender) {
  try {
    // Input validation
    if (!msg || typeof msg !== 'string') {
      console.warn('handleUserMessage: Invalid message input');
      return "Mohon kirim pesan yang valid ya, Kak 😊";
    }

    if (!sender || typeof sender !== 'string') {
      console.warn('handleUserMessage: Invalid sender input');
      return "Terjadi kesalahan sistem. Silakan coba lagi.";
    }

    const trimmedMsg = msg.trim();
    if (trimmedMsg.length === 0) {
      return "Mohon kirim pesan yang valid ya, Kak 😊";
    }

    const lowerMsg = trimmedMsg.toLowerCase();

    // 0. Handle basic interactions FIRST
    // Greeting
    if (['halo', 'hai', 'hello', 'hi', 'selamat pagi', 'selamat siang', 'selamat malam'].some(greeting => lowerMsg.includes(greeting))) {
      return "Halo! Selamat datang di Vylozzone 😊\n\nAda yang bisa saya bantu terkait produk digital kami? Ketik 'menu' untuk melihat daftar produk atau langsung tanya aja ya!";
    }

    // Thanks/appreciation
    if (['makasih', 'terima kasih', 'thanks', 'thank you', 'thx'].some(thanks => lowerMsg.includes(thanks))) {
      return "Sama-sama, Kak! 😊 Senang bisa membantu. Ada yang lain yang bisa saya bantu?";
    }

    // Product catalog inquiry
    if (lowerMsg.includes('produk apa aja') || lowerMsg.includes('ada produk apa') || lowerMsg.includes('list produk') || lowerMsg === 'menu') {
      return `🛍️ *PRODUK VYLOZZONE*

📺 *Streaming:*
• Netflix (mulai 15k)
• Disney+ (mulai 17k) 
• YouTube Premium (mulai 5k)
• Prime Video, HBO Max
• iQIYI, VIU, WeTV, Vision+, Vidio

🎨 *Aplikasi:*
• CapCut Pro
• Alight Motion
• ChatGPT Plus
• BStation

Mau info detail produk mana, Kak? Tinggal ketik nama produknya aja ya! 😊`;
    }

    // General price inquiry - fix product keywords reference
    const existingProducts = [
      'netflix', 'disney', 'youtube', 'iqiyi', 'viu', 'wetv', 'vision+', 'vidio', 
      'prime', 'hbo', 'bstation', 'alightmotion', 'chatgpt', 'capcut'
    ];
    
    if (lowerMsg.includes('harga semua') || lowerMsg.includes('berapa harga semua') || (lowerMsg.includes('harga') && lowerMsg.includes('produk') && !existingProducts.some(p => lowerMsg.includes(p)))) {
      return "Harga produk Vylozzone bervariasi, Kak:\n\n📺 Streaming: 5k - 150k/bulan\n🎨 Aplikasi: 15k - 50k/bulan\n\nUntuk harga detail, sebutkan produk spesifik yang diminati ya! Contoh: 'netflix harga' atau 'youtube berapa?' 😊";
    }

    // Handle missing products
    if (lowerMsg.includes('spotify')) {
      return "Maaf Kak, untuk saat ini Spotify belum tersedia di Vylozzone. Produk music streaming yang ada: YouTube Premium (include YouTube Music). Mau info YouTube Premium?";
    }

    if (lowerMsg.includes('canva')) {
      return "Maaf Kak, untuk saat ini Canva belum tersedia. Alternatif design apps yang ada: CapCut Pro untuk video editing. Mau info CapCut Pro?";
    }

    // Discount/promo inquiry
    if (lowerMsg.includes('diskon') || lowerMsg.includes('discount') || (lowerMsg.includes('bisa') && lowerMsg.includes('murah'))) {
      return "Untuk info promo dan diskon terbaru, Kak bisa langsung chat admin di wa.me/6289630375723 ya! Admin akan kasih penawaran terbaik sesuai budget Kak 😊";
    }

    // Handle multiple products in one query
    const mentionedProducts = existingProducts.filter(product => lowerMsg.includes(product));
    if (mentionedProducts.length > 1) {
      if (lowerMsg.includes('harga') || lowerMsg.includes('berapa')) {
        let multiProductResponse = `📊 *PERBANDINGAN HARGA*\n\n`;
        for (const product of mentionedProducts.slice(0, 3)) { // Limit to 3 products
          multiProductResponse += `🔸 ${product.toUpperCase()}: Chat admin untuk harga detail\n`;
        }
        multiProductResponse += `\nUntuk info lengkap semua produk, chat admin di wa.me/6289630375723 ya! 😊`;
        return multiProductResponse;
      }
      
      if (lowerMsg.includes('bagus') || lowerMsg.includes('recommend') || lowerMsg.includes('pilih')) {
        return `🤔 Mau bandingin ${mentionedProducts.join(', ')}?\n\nSetiap produk punya keunggulan masing-masing. Untuk rekomendasi yang sesuai kebutuhan Kak, langsung chat admin di wa.me/6289630375723 ya! Admin akan kasih saran terbaik 😊`;
      }
    }

    // 1. Mood detector - prioritas tertinggi untuk handling emosi
    try {
      const mood = detectMood(trimmedMsg);
      if (mood === "marah")
        return "Maaf atas kendala yang terjadi, Kak. Mohon kirim nomor order & screenshot error, tim kami bantu follow-up sesuai SOP.";
      if (mood === "oot")
        return "Maaf Kak, CS ini hanya menangani order, kendala, atau info garansi Vylozzone ya 🙏.";
    } catch (moodError) {
      console.warn('Error in mood detection:', moodError.message);
      // Continue with other handlers
    }

    // 1.5. ADVANCED CONTENT READING - Like human reading and answering
    try {
      const naturalResponse = await advancedContentReader.readAndAnswer(trimmedMsg);
      if (naturalResponse) {
        console.log(`🧠 Advanced reader generated natural response`);
        return naturalResponse;
      }
    } catch (readerError) {
      console.warn('Error in advanced content reader:', readerError.message);
      // Continue with other handlers
    }

    // 2. FAQ/SOP - prioritas tinggi untuk pertanyaan umum
    try {
      const faqList = await loadFAQ() || [];
      if (Array.isArray(faqList) && faqList.length > 0) {
        const faqRes = fuzzyMatch(trimmedMsg, faqList, 'keyword');
        if (faqRes) {
          // Handle both string and array response
          if (Array.isArray(faqRes.response) && faqRes.response.length > 0) {
            const validResponses = faqRes.response.filter(r => r && typeof r === 'string');
            if (validResponses.length > 0) {
              return validResponses[Math.floor(Math.random() * validResponses.length)];
            }
          } else if (typeof faqRes.response === 'string' && faqRes.response.trim().length > 0) {
            return faqRes.response;
          } else if (faqRes.answer && typeof faqRes.answer === 'string' && faqRes.answer.trim().length > 0) {
            // Support old FAQ format with 'answer' field
            return faqRes.answer;
          }
        }
      }
    } catch (faqError) {
      console.warn('Error in FAQ processing:', faqError.message);
      // Continue with other handlers
    }

    // 3. SOP - untuk prosedur khusus
    try {
      const sopList = await loadSOP() || [];
      if (Array.isArray(sopList) && sopList.length > 0) {
        const sopRes = fuzzyMatch(trimmedMsg, sopList, 'trigger');
        if (sopRes && Array.isArray(sopRes.response) && sopRes.response.length > 0) {
          const validResponses = sopRes.response.filter(r => r && typeof r === 'string');
          if (validResponses.length > 0) {
            return validResponses[Math.floor(Math.random() * validResponses.length)];
          }
        }
      }
    } catch (sopError) {
      console.warn('Error in SOP processing:', sopError.message);
      // Continue with other handlers
    }

    // 4. Promo - untuk pertanyaan promo
    try {
      if (trimmedMsg.toLowerCase().includes("promo")) {
        const promoObj = await loadPromo();
        if (promoObj && promoObj.banner && typeof promoObj.banner === 'string' && promoObj.banner.trim().length > 0) {
          return promoObj.banner;
        }
      }
    } catch (promoError) {
      console.warn('Error in promo processing:', promoError.message);
      // Continue with other handlers
    }

    // 5. Produk - dengan intent detection yang ketat
    try {
      const produkRes = await fuzzySearchProduk(trimmedMsg);
      if (produkRes && typeof produkRes === 'string' && produkRes.trim().length > 0) {
        return produkRes;
      }
    } catch (produkError) {
      console.warn('Error in product processing:', produkError.message);
      // Continue to fallback
    }

    // 6. Handle gibberish atau input tidak jelas
    if (trimmedMsg.length < 3 || !/[a-zA-Z]/.test(trimmedMsg)) {
      return "Bisa dijelaskan lebih jelas, Kak? Saya siap membantu dengan pertanyaan seputar produk Vylozzone 😊";
    }

    // Check if it's a valid Indonesian/English word pattern
    const hasValidWords = /\b(apa|ada|mau|bisa|gimana|bagaimana|kenapa|kapan|dimana|berapa|info|harga|garansi|order|beli)\b/.test(lowerMsg);
    if (!hasValidWords && trimmedMsg.length < 10) {
      return "Maaf, saya kurang paham maksudnya. Bisa dijelaskan lebih detail apa yang Kak butuhkan? 😊";
    }

    // 7. Tidak ketemu: lempar ke AI eksternal
    return null;

  } catch (error) {
    console.error('Error in handleUserMessage:', error.message);
    return "Maaf, terjadi kesalahan sistem. Silakan coba lagi atau hubungi admin untuk bantuan.";
  }
}

module.exports = { handleUserMessage };
