const fs = require('fs').promises;
const path = require('path');

// Loader TXT untuk file di /data
async function loadTxt(filename) {
  const filePath = path.join(__dirname, '../data', filename);
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

// Loader TXT untuk produk di /data/produk
async function loadProdukTxt(nama) {
  const filePath = path.join(__dirname, '../data/produk', `${nama}.txt`);
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

// Loader JSON universal (untuk data/*.json)
async function loadJson(filename) {
  if (!filename || typeof filename !== 'string') {
    console.error('loadJson: Invalid filename provided');
    return [];
  }

  const filePath = path.join(__dirname, '../data', filename);
  
  try {
    // Ensure data directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Check if file exists first
    try {
      await fs.access(filePath, fs.constants.F_OK);
    } catch (accessErr) {
      console.log(`File ${filename} tidak ditemukan, membuat file kosong`);
      await fs.writeFile(filePath, '[]', 'utf8');
      return [];
    }
    
    const data = await fs.readFile(filePath, 'utf8');
    
    // Handle empty file
    if (!data.trim()) {
      console.log(`File ${filename} kosong, mengembalikan array kosong`);
      return [];
    }
    
    const parsed = JSON.parse(data);
    
    // Validate parsed data
    if (parsed === null || parsed === undefined) {
      console.warn(`File ${filename} berisi null/undefined, mengembalikan array kosong`);
      return [];
    }
    
    return parsed;
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`File ${filename} tidak ditemukan, membuat file baru`);
      try {
        await fs.writeFile(filePath, '[]', 'utf8');
        return [];
      } catch (writeErr) {
        console.error(`Gagal membuat file ${filename}:`, writeErr.message);
        return [];
      }
    } else if (err instanceof SyntaxError) {
      console.error(`File ${filename} memiliki format JSON yang tidak valid:`, err.message);
      // Backup corrupted file
      try {
        const backupPath = filePath + '.corrupted.' + Date.now();
        await fs.copyFile(filePath, backupPath);
        console.log(`File corrupt di-backup ke: ${backupPath}`);
        // Create new empty file
        await fs.writeFile(filePath, '[]', 'utf8');
      } catch (backupErr) {
        console.error(`Gagal backup file corrupt:`, backupErr.message);
      }
      return [];
    } else {
      console.error(`Gagal load file ${filename}:`, err.message);
      return [];
    }
  }
}

// Save JSON universal
async function saveJson(filename, data) {
  if (!filename || typeof filename !== 'string') {
    console.error('saveJson: Invalid filename provided');
    return false;
  }

  if (data === undefined) {
    console.error(`saveJson: Data is undefined for file ${filename}`);
    return false;
  }

  const filePath = path.join(__dirname, '../data', filename);
  
  try {
    // Ensure data directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Validate data before saving
    if (data === null) {
      console.warn(`Data untuk ${filename} adalah null, menyimpan array kosong`);
      data = [];
    }
    
    // Validate data can be stringified
    let jsonString;
    try {
      jsonString = JSON.stringify(data, null, 2);
    } catch (stringifyErr) {
      console.error(`Gagal stringify data untuk ${filename}:`, stringifyErr.message);
      return false;
    }
    
    // Create backup if file exists
    try {
      await fs.access(filePath, fs.constants.F_OK);
      const backupPath = filePath + '.backup';
      await fs.copyFile(filePath, backupPath);
    } catch (backupErr) {
      // File doesn't exist, no backup needed
    }
    
    // Write to temporary file first
    const tempPath = filePath + '.tmp';
    await fs.writeFile(tempPath, jsonString, 'utf8');
    
    // Verify written file
    try {
      const verifyData = await fs.readFile(tempPath, 'utf8');
      JSON.parse(verifyData); // Validate JSON
      
      // Move temp file to final location
      await fs.rename(tempPath, filePath);
      console.log(`File ${filename} berhasil disimpan`);
      return true;
    } catch (verifyErr) {
      console.error(`Gagal verifikasi file ${filename}:`, verifyErr.message);
      // Clean up temp file
      try {
        await fs.unlink(tempPath);
      } catch (cleanupErr) {
        console.error(`Gagal cleanup temp file:`, cleanupErr.message);
      }
      return false;
    }
    
  } catch (err) {
    console.error(`Gagal save file ${filename}:`, err.message);
    return false;
  }
}

// Loader Khusus
async function loadFAQ() {
  try {
    // Prioritas JSON dulu karena struktur lebih konsisten
    const jsonData = await loadJson('faq.json');
    if (jsonData && Array.isArray(jsonData) && jsonData.length > 0) {
      return jsonData;
    }
    
    // Fallback ke TXT, tapi convert ke format array
    const txtData = await loadTxt('faq.txt');
    if (txtData && txtData.trim()) {
      // Convert string ke format array untuk konsistensi
      return [{
        id: 'faq_txt',
        keyword: ['faq', 'bantuan', 'help'],
        response: [txtData.trim()]
      }];
    }
    
    return []; // Return empty array instead of null
  } catch (error) {
    console.error('Error loading FAQ:', error);
    return [];
  }
}

async function loadSOP() {
  try {
    // Prioritas JSON karena struktur sudah benar di sop.json
    const jsonData = await loadJson('sop.json');
    if (jsonData && Array.isArray(jsonData) && jsonData.length > 0) {
      return jsonData;
    }
    
    // Fallback ke TXT, convert ke format array
    const txtData = await loadTxt('sop.txt');
    if (txtData && txtData.trim()) {
      return [{
        id: 'sop_txt',
        kasus: 'general_sop',
        trigger: ['sop', 'prosedur', 'cara'],
        response: [txtData.trim()]
      }];
    }
    
    return []; // Return empty array instead of null
  } catch (error) {
    console.error('Error loading SOP:', error);
    return [];
  }
}

async function loadBlacklist()   { return loadJson('blacklist.json'); }
async function loadPromo()       { return loadJson('promo.json'); }
async function loadLogClaim()    { return loadJson('log_claim.json'); }
async function loadFeedback()    { return loadJson('feedback.json'); }

// Smart Product Parser Functions
class ProductParser {
  static parseProductData(rawText, productName) {
    if (!rawText) return null;
    
    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line);
    
    const parsedData = {
      productName: productName,
      packages: [],
      garansi: null,
      features: [],
      notes: [],
      rawText: rawText
    };
    
    let currentSection = 'header';
    
    for (const line of lines) {
      const cleanLine = line.replace(/[`*]/g, '').trim();
      
      // Skip empty lines and separators
      if (!cleanLine || cleanLine === '---' || cleanLine === '===') continue;
      
      // Detect price patterns
      const pricePattern = /(.+?)\s*:\s*(?:Rp\s*)?(\d+(?:\.\d+)*)\s*[kK]\s*(?:\/?\s*([^(]+?))?(?:\s*\(([^)]+)\))?/i;
      const priceMatch = cleanLine.match(pricePattern);
      
      if (priceMatch) {
        const [, duration, price, perUnit, total] = priceMatch;
        parsedData.packages.push({
          duration: duration.trim(),
          price: `${price}k`,
          perUnit: perUnit ? perUnit.trim() : null,
          total: total ? total.trim() : null,
          originalLine: line
        });
        continue;
      }
      
      // Detect guarantee
      if (cleanLine.toLowerCase().includes('garansi') || cleanLine.toLowerCase().includes('warranty')) {
        if (cleanLine.toLowerCase().includes('full garansi')) {
          parsedData.garansi = 'Full Garansi';
        } else {
          // Extract specific guarantee duration if mentioned
          const garantiMatch = cleanLine.match(/(\d+)\s*(hari|days|bulan|months)/i);
          if (garantiMatch) {
            parsedData.garansi = `${garantiMatch[1]} ${garantiMatch[2]}`;
          } else {
            parsedData.garansi = 'Full Garansi';
          }
        }
        continue;
      }
      
      // Detect features (lines with checkmarks or benefits)
      if (cleanLine.includes('✅') || cleanLine.includes('✓') || cleanLine.startsWith('*') && cleanLine.includes('_')) {
        const feature = cleanLine.replace(/[✅✓*_]/g, '').trim();
        if (feature) parsedData.features.push(feature);
        continue;
      }
      
      // Detect notes
      if (cleanLine.toLowerCase().startsWith('note') || cleanLine.toLowerCase().startsWith('*note') || 
          cleanLine.includes('max') || cleanLine.includes('limit') || cleanLine.includes('device')) {
        parsedData.notes.push(cleanLine.replace(/^\*/, '').trim());
        continue;
      }
    }
    
    return parsedData;
  }
  
  static extractSpecificInfo(parsedData, infoType) {
    if (!parsedData) return null;
    
    switch (infoType.toLowerCase()) {
      case 'garansi':
      case 'warranty':
        return parsedData.garansi || 'Info garansi tidak tersedia';
        
      case 'harga':
      case 'price':
      case 'paket':
        if (parsedData.packages.length === 0) return 'Info harga tidak tersedia';
        return parsedData.packages.map(pkg => 
          `${pkg.duration}: ${pkg.price}${pkg.perUnit ? ` (${pkg.perUnit})` : ''}`
        ).join('\n');
        
      case 'fitur':
      case 'features':
        if (parsedData.features.length === 0) return 'Info fitur tidak tersedia';
        return parsedData.features.map(f => `✅ ${f}`).join('\n');
        
      case 'note':
      case 'catatan':
        if (parsedData.notes.length === 0) return 'Tidak ada catatan khusus';
        return parsedData.notes.join('\n');
        
      case 'full':
      case 'lengkap':
        return parsedData.rawText;
        
      default:
        return null;
    }
  }
  
  static generateClosingQuestion(parsedData) {
    if (!parsedData || parsedData.packages.length === 0) {
      return 'Ada yang bisa saya bantu lagi, Kak?';
    }
    
    const packageOptions = parsedData.packages.map((pkg, index) => 
      `${index + 1}. ${pkg.duration} - ${pkg.price}`
    ).join('\n');
    
    return `Pilihan paket ${parsedData.productName}:\n\n${packageOptions}\n\nPilih yang mana, Kak? 😊`;
  }
}

// Enhanced Product Functions
async function loadAndParseProduct(productName) {
  try {
    const rawData = await loadProdukTxt(productName);
    if (!rawData) return null;
    
    return ProductParser.parseProductData(rawData, productName);
  } catch (error) {
    console.error(`Error parsing product ${productName}:`, error);
    return null;
  }
}

async function getProductInfo(productName, infoType = 'full') {
  try {
    // PRIORITAS: Langsung return raw data untuk mempertahankan format asli
    const rawData = await loadProdukTxt(productName);
    if (!rawData || rawData.trim() === '') {
      return `Data produk ${productName} tidak ditemukan.`;
    }
    
    // Untuk query harga atau info lengkap, return data mentah dengan natural follow-up
    if (['harga', 'price', 'paket', 'full', 'lengkap'].includes(infoType.toLowerCase())) {
      // Bersihkan data sedikit tapi pertahankan format asli
      const cleanedData = rawData
        .replace(/`/g, '') // Hapus backticks
        .replace(/\*\*/g, '*') // Normalize bold formatting
        .trim();
      
      // Generate natural follow-up berdasarkan jenis query
      const naturalFollowUp = generateNaturalFollowUp(productName, infoType, rawData);
      
      return cleanedData + '\n\n' + naturalFollowUp;
    }
    
    // Untuk query spesifik lainnya, coba parse
    const parsedData = ProductParser.parseProductData(rawData, productName);
    if (parsedData) {
      const specificInfo = ProductParser.extractSpecificInfo(parsedData, infoType);
      if (specificInfo && !specificInfo.includes('tidak tersedia')) {
        return specificInfo;
      }
    }
    
    // Fallback: return raw data
    return rawData.trim();
    
  } catch (error) {
    console.error(`Error getting product info:`, error);
    return `Maaf, terjadi kesalahan saat mengambil info ${productName}.`;
  }
}

// Generate natural follow-up after showing product template
function generateNaturalFollowUp(productName, infoType, rawData) {
  const productNameCap = productName.charAt(0).toUpperCase() + productName.slice(1);
  
  // Count available packages/options
  const packageCount = (rawData.match(/Bulan|Hari|Tahun/g) || []).length;
  const hasMultipleOptions = packageCount > 1;
  
  // Generate contextual follow-up berdasarkan produk dan context
  const followUps = [
    // For products with multiple packages - more natural variations
    ...(hasMultipleOptions ? [
      `Ingin paket yang mana, Kak? Ada beberapa pilihan durasi nih 😊`,
      `Mau pilih yang mana? Bisa disesuaikan sama budget dan kebutuhan 😊`,
      `Tertarik sama paket yang mana? Semuanya udah include garansi penuh lho 😊`,
      `Paket mana yang cocok buat Kak? Kalau bingung bisa tanya-tanya dulu 😊`,
      `Dari pilihan di atas, mana yang sesuai budget Kak? 😊`,
      `Ada yang menarik dari paket-paket tersebut? Atau butuh penjelasan lebih detail? 😊`,
      `Pilihan mana yang pas buat Kak? Semua paket berkualitas premium kok 😊`,
      `Kira-kira cocok yang mana ya? Bisa konsultasi dulu kalau masih bingung 😊`
    ] : [
      `Gimana, Kak? Tertarik sama ${productNameCap}? 😊`,
      `Cocok gak sama kebutuhan? Mau order atau ada yang ditanyakan lagi? 😊`,
      `Bagaimana menurut Kak? Harga dan fiturnya sesuai ekspektasi? 😊`,
      `Tertarik untuk order ${productNameCap}? Atau ada yang mau ditanyakan dulu? 😊`
    ]),
    
    // General engaging follow-ups - more conversational
    `Udah ada gambaran? Kalau mau order atau ada pertanyaan tinggal bilang aja ya 😊`,
    `Kalau ada yang kurang jelas atau mau diskusi budget, langsung tanya aja Kak 😊`,
    `Semua paket udah include garansi penuh ya! Mau yang mana atau butuh konsultasi dulu? 😊`,
    `Gimana pendapat Kak? Cocok sama yang dicari atau butuh alternatif lain? 😊`,
    `Ada yang menarik? Atau mau tanya-tanya detail dulu sebelum memutuskan? 😊`,
    `Sesuai gak sama budget dan kebutuhan? Kalau ada pertanyaan langsung aja ya 😊`
  ];
  
  // Weighted selection - prioritize engaging questions for products with multiple options
  if (hasMultipleOptions) {
    // For multi-package products, prioritize "which package" questions
    const multiPackageFollowUps = followUps.slice(0, 8); // First 8 are multi-package specific
    return multiPackageFollowUps[Math.floor(Math.random() * multiPackageFollowUps.length)];
  } else {
    // For single option products, use general engaging questions
    const generalFollowUps = followUps.slice(8); // Last ones are general
    return generalFollowUps[Math.floor(Math.random() * generalFollowUps.length)];
  }
}

// Export
module.exports = {
  loadTxt, loadJson, saveJson,
  loadFAQ, loadSOP, loadProdukTxt,
  loadBlacklist, loadPromo, loadLogClaim, loadFeedback,
  loadAndParseProduct, getProductInfo, ProductParser
};
