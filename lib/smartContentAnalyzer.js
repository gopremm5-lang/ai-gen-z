/**
 * SMART CONTENT ANALYZER
 * Advanced content parsing untuk extract informasi spesifik dari berbagai sumber
 * 
 * Capabilities:
 * - Extract specific info (harga, garansi, fitur) dari product files
 * - Parse FAQ/SOP untuk jawaban spesifik
 * - Generate human-like responses berdasarkan extracted info
 */

const { loadProdukTxt, loadFAQ, loadSOP, loadJson } = require('./dataLoader');
const natural = require('natural');
const compromise = require('compromise');

class SmartContentAnalyzer {
    constructor() {
        this.infoPatterns = {
            garansi: {
                keywords: ['garansi', 'warranty', 'jaminan', 'hari', 'bulan', 'tahun'],
                patterns: [
                    /garansi\s*:?\s*(\d+)\s*(hari|bulan|tahun)/gi,
                    /warranty\s*:?\s*(\d+)\s*(hari|day|bulan|month)/gi,
                    /(\d+)\s*(hari|bulan|tahun)\s*garansi/gi,
                    /full\s*garansi/gi,
                    /bergaransi\s*(\d+)\s*(hari|bulan)/gi,
                    /✅\s*full\s*garansi/gi,
                    /✅\s*.*garansi/gi,
                    /streaming\s*(\d+)\s*hari/gi,
                    /aplikasi\s*premium\s*(\d+)\s*hari/gi
                ]
            },
            harga: {
                keywords: ['rp', 'harga', 'price', 'biaya', 'tarif'],
                patterns: [
                    /rp\s*(\d+[\d\.,]*)\s*k?/gi,
                    /(\d+[\d\.,]*)\s*k\s*\/?\s*(bulan|hari|tahun)?/gi,
                    /harga\s*:?\s*rp?\s*(\d+[\d\.,]*)/gi,
                    /mulai\s*dari?\s*(\d+[\d\.,]*)\s*k?/gi
                ]
            },
            fitur: {
                keywords: ['fitur', 'feature', 'benefit', 'keunggulan', 'include'],
                patterns: [
                    /✅\s*([^✅\n]+)/gi,
                    /•\s*([^•\n]+)/gi,
                    /\*\s*([^*\n]+)/gi,
                    /support\s+([^.\n]+)/gi
                ]
            },
            durasi: {
                keywords: ['bulan', 'hari', 'tahun', 'durasi', 'periode'],
                patterns: [
                    /(\d+)\s*(bulan|hari|tahun)/gi,
                    /durasi\s*:?\s*(\d+)\s*(bulan|hari)/gi
                ]
            }
        };
    }

    /**
     * MAIN FUNCTION: Extract specific information dan generate human-like response
     */
    async extractAndRespond(query, sources = ['product', 'faq', 'sop']) {
        try {
            const analysis = this.analyzeQuery(query);
            console.log(`🔍 Query analysis:`, analysis);
            
            let extractedInfo = {};
            
            // Search through specified sources
            for (const source of sources) {
                const sourceInfo = await this.searchInSource(source, analysis);
                if (sourceInfo) {
                    extractedInfo = { ...extractedInfo, ...sourceInfo };
                }
            }
            
            // Generate human-like response
            if (Object.keys(extractedInfo).length > 0) {
                return this.generateSmartResponse(analysis, extractedInfo);
            }
            
            return null; // No specific info found
            
        } catch (error) {
            console.error('Error in smart content analysis:', error);
            return null;
        }
    }

    /**
     * ANALYZE USER QUERY - Detect what specific info user wants
     */
    analyzeQuery(query) {
        const lowerQuery = query.toLowerCase();
        const doc = compromise(query);
        
        // Extract entities
        const entities = {
            products: this.extractProductMentions(lowerQuery),
            infoTypes: this.detectInfoTypes(lowerQuery),
            numbers: doc.match('#Value').out('array'),
            timeUnits: lowerQuery.match(/\b(hari|bulan|tahun|day|month|year)\b/g) || []
        };
        
        // Determine primary intent
        const intent = this.determinePrimaryIntent(lowerQuery, entities);
        
        return {
            originalQuery: query,
            entities: entities,
            intent: intent,
            isSpecificQuestion: entities.infoTypes.length > 0,
            confidence: this.calculateQueryConfidence(entities, intent)
        };
    }

    extractProductMentions(query) {
        const products = [
            'netflix', 'disney', 'youtube', 'iqiyi', 'viu', 'wetv', 'vision+', 'vidio', 
            'prime', 'hbo', 'bstation', 'alightmotion', 'chatgpt', 'capcut', 'hbomax'
        ];
        
        return products.filter(product => query.includes(product));
    }

    detectInfoTypes(query) {
        const infoTypes = [];
        
        if (/\b(garansi|warranty|jaminan|berapa\s*hari)\b/.test(query)) {
            infoTypes.push('garansi');
        }
        
        if (/\b(harga|price|berapa|biaya|tarif)\b/.test(query)) {
            infoTypes.push('harga');
        }
        
        if (/\b(fitur|feature|benefit|keunggulan|apa\s*aja)\b/.test(query)) {
            infoTypes.push('fitur');
        }
        
        if (/\b(durasi|lama|periode|berapa\s*(bulan|hari))\b/.test(query)) {
            infoTypes.push('durasi');
        }
        
        return infoTypes;
    }

    determinePrimaryIntent(query, entities) {
        if (entities.infoTypes.includes('garansi')) return 'garansi_inquiry';
        if (entities.infoTypes.includes('harga')) return 'price_inquiry'; 
        if (entities.infoTypes.includes('fitur')) return 'feature_inquiry';
        if (entities.infoTypes.includes('durasi')) return 'duration_inquiry';
        
        return 'general_inquiry';
    }

    calculateQueryConfidence(entities, intent) {
        let confidence = 0.3; // Base confidence
        
        if (entities.products.length > 0) confidence += 0.4;
        if (entities.infoTypes.length > 0) confidence += 0.3;
        if (intent !== 'general_inquiry') confidence += 0.2;
        
        return Math.min(confidence, 1.0);
    }

    /**
     * SEARCH IN SPECIFIC SOURCE
     */
    async searchInSource(source, analysis) {
        switch (source) {
            case 'product':
                return await this.searchInProducts(analysis);
            case 'faq':
                return await this.searchInFAQ(analysis);
            case 'sop':
                return await this.searchInSOP(analysis);
            default:
                return null;
        }
    }

    async searchInProducts(analysis) {
        const results = {};
        
        for (const product of analysis.entities.products) {
            try {
                const productData = await loadProdukTxt(product);
                if (productData) {
                    console.log(`📄 Loading product data for ${product}: ${productData.length} chars`);
                    
                    // Extract specific information
                    for (const infoType of analysis.entities.infoTypes) {
                        const extracted = this.extractFromText(productData, infoType, product);
                        if (extracted && extracted.length > 0) {
                            if (!results[product]) results[product] = {};
                            results[product][infoType] = extracted;
                            console.log(`✅ Extracted ${infoType} for ${product}:`, extracted[0]);
                        } else {
                            console.log(`❌ No ${infoType} found for ${product}`);
                        }
                    }
                }
            } catch (error) {
                console.warn(`Error loading product ${product}:`, error);
            }
        }
        
        return Object.keys(results).length > 0 ? { source: 'product', data: results } : null;
    }

    async searchInFAQ(analysis) {
        try {
            const faqData = await loadFAQ() || [];
            
            for (const faq of faqData) {
                if (faq.answer || faq.response) {
                    const content = faq.answer || (Array.isArray(faq.response) ? faq.response[0] : faq.response);
                    
                    // Check if FAQ content contains info about queried products
                    for (const product of analysis.entities.products) {
                        if (content.toLowerCase().includes(product)) {
                            for (const infoType of analysis.entities.infoTypes) {
                                const extracted = this.extractFromText(content, infoType, product);
                                if (extracted) {
                                    return {
                                        source: 'faq',
                                        data: { [product]: { [infoType]: extracted } },
                                        originalFAQ: faq
                                    };
                                }
                            }
                        }
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.warn('Error searching FAQ:', error);
            return null;
        }
    }

    async searchInSOP(analysis) {
        try {
            const sopData = await loadSOP() || [];
            
            for (const sop of sopData) {
                if (sop.response && Array.isArray(sop.response)) {
                    const content = sop.response[0];
                    
                    for (const product of analysis.entities.products) {
                        if (content.toLowerCase().includes(product)) {
                            for (const infoType of analysis.entities.infoTypes) {
                                const extracted = this.extractFromText(content, infoType, product);
                                if (extracted) {
                                    return {
                                        source: 'sop',
                                        data: { [product]: { [infoType]: extracted } },
                                        originalSOP: sop
                                    };
                                }
                            }
                        }
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.warn('Error searching SOP:', error);
            return null;
        }
    }

    /**
     * EXTRACT SPECIFIC INFO FROM TEXT
     */
    extractFromText(text, infoType, product) {
        const patterns = this.infoPatterns[infoType];
        if (!patterns) return null;
        
        const results = [];
        
        // Try each pattern
        for (const pattern of patterns.patterns) {
            const matches = [...text.matchAll(pattern)];
            for (const match of matches) {
                if (match[1]) {
                    results.push({
                        value: match[1],
                        unit: match[2] || '',
                        fullMatch: match[0],
                        context: this.getContext(text, match.index, 50)
                    });
                }
            }
        }
        
        // For garansi, also look for general statements
        if (infoType === 'garansi' && results.length === 0) {
            if (/full\s*garansi/gi.test(text)) {
                results.push({
                    value: 'Full',
                    unit: 'garansi',
                    fullMatch: 'full garansi',
                    context: 'Full garansi tersedia'
                });
            }
        }
        
        return results.length > 0 ? results : null;
    }

    getContext(text, index, length = 50) {
        const start = Math.max(0, index - length);
        const end = Math.min(text.length, index + length);
        return text.substring(start, end).trim();
    }

    /**
     * GENERATE HUMAN-LIKE RESPONSE
     */
    generateSmartResponse(analysis, extractedInfo) {
        const { entities, intent } = analysis;
        const products = entities.products;
        const infoTypes = entities.infoTypes;
        
        if (products.length === 1 && infoTypes.length === 1) {
            return this.generateSingleProductResponse(products[0], infoTypes[0], extractedInfo);
        }
        
        if (products.length === 1 && infoTypes.length > 1) {
            return this.generateMultiInfoResponse(products[0], infoTypes, extractedInfo);
        }
        
        if (products.length > 1) {
            return this.generateMultiProductResponse(products, infoTypes, extractedInfo);
        }
        
        return this.generateGeneralResponse(analysis, extractedInfo);
    }

    generateSingleProductResponse(product, infoType, extractedInfo) {
        const productData = extractedInfo.product?.data?.[product] || extractedInfo.faq?.data?.[product] || extractedInfo.sop?.data?.[product];
        
        // Special handling for garansi - always try to give specific answer
        if (infoType === 'garansi') {
            // First try to extract from product data
            if (productData && productData[infoType]) {
                const garansiInfo = productData[infoType][0];
                if (garansiInfo?.value === 'Full') {
                    return this.generateGaransiFromFAQ(product);
                }
            } else {
                return this.generateGaransiFromFAQ(product);
            }
        }
        
        if (!productData || !productData[infoType]) {
            return null;
        }
        
        const info = productData[infoType];
        const productName = product.charAt(0).toUpperCase() + product.slice(1);
        
        switch (infoType) {
            case 'garansi':
                if (info[0]?.value === 'Full') {
                    return `${productName} memiliki full garansi, Kak! Jadi kalau ada kendala dalam masa aktif, bisa langsung claim ke admin ya 😊`;
                } else if (info[0]?.value) {
                    return `Garansi ${productName} adalah ${info[0].value} ${info[0].unit}, Kak. Jadi selama periode itu kalau ada masalah bisa langsung claim ya! 😊`;
                }
                break;
                
            case 'harga':
                if (info.length > 1) {
                    const prices = info.slice(0, 3).map(price => `${price.value}${price.unit ? ' ' + price.unit : ''}`);
                    return `Harga ${productName} bervariasi, Kak:\n• ${prices.join('\n• ')}\n\nMau yang mana? Atau butuh info lebih detail? 😊`;
                } else if (info[0]) {
                    return `Harga ${productName} mulai dari ${info[0].value}${info[0].unit ? ' ' + info[0].unit : ''}, Kak! Mau order atau ada yang ditanyakan lagi? 😊`;
                }
                break;
                
            case 'fitur':
                if (info.length > 0) {
                    const features = info.slice(0, 5).map(f => f.value.trim()).filter(f => f.length > 3);
                    return `Fitur ${productName}:\n• ${features.join('\n• ')}\n\nLengkap banget kan, Kak? Mau order? 😊`;
                }
                break;
                
            case 'durasi':
                if (info[0]) {
                    return `Durasi ${productName} tersedia: ${info[0].value} ${info[0].unit}, Kak. Ada pilihan durasi lain juga, mau lihat semua opsi? 😊`;
                }
                break;
        }
        
        return null;
    }

    generateMultiInfoResponse(product, infoTypes, extractedInfo) {
        const productName = product.charAt(0).toUpperCase() + product.slice(1);
        let response = `📋 *INFO ${productName.toUpperCase()}*\n\n`;
        
        const productData = extractedInfo.product?.data?.[product] || extractedInfo.faq?.data?.[product] || extractedInfo.sop?.data?.[product];
        
        if (!productData) return null;
        
        for (const infoType of infoTypes) {
            const info = productData[infoType];
            if (info) {
                switch (infoType) {
                    case 'garansi':
                        response += `🛡️ *Garansi:* ${info[0]?.value === 'Full' ? 'Full garansi' : `${info[0]?.value} ${info[0]?.unit}`}\n`;
                        break;
                    case 'harga':
                        response += `💰 *Harga:* Mulai ${info[0]?.value}${info[0]?.unit ? ' ' + info[0]?.unit : ''}\n`;
                        break;
                    case 'fitur':
                        response += `✨ *Fitur:* ${info.slice(0, 2).map(f => f.value.trim()).join(', ')}\n`;
                        break;
                }
            }
        }
        
        response += `\nAda yang ingin ditanyakan lebih detail, Kak? 😊`;
        return response;
    }

    generateMultiProductResponse(products, infoTypes, extractedInfo) {
        let response = `📊 *PERBANDINGAN ${infoTypes[0]?.toUpperCase() || 'INFO'}*\n\n`;
        
        for (const product of products.slice(0, 3)) {
            const productName = product.charAt(0).toUpperCase() + product.slice(1);
            const productData = extractedInfo.product?.data?.[product] || extractedInfo.faq?.data?.[product];
            
            if (productData) {
                response += `🔸 *${productName}:* `;
                
                for (const infoType of infoTypes) {
                    const info = productData[infoType];
                    if (info && info[0]) {
                        response += `${info[0].value}${info[0].unit ? ' ' + info[0].unit : ''} `;
                    }
                }
                response += '\n';
            }
        }
        
        response += `\nMau info detail salah satu produk? Tinggal sebut nama produknya aja ya! 😊`;
        return response;
    }

    generateGaransiFromFAQ(product) {
        const productName = product.charAt(0).toUpperCase() + product.slice(1);
        
        // Netflix, Disney, YouTube = streaming = 30 hari
        const streamingProducts = ['netflix', 'disney', 'youtube', 'iqiyi', 'viu', 'wetv', 'vision+', 'vidio', 'prime', 'hbo'];
        // CapCut, Alight Motion, ChatGPT = aplikasi = 7 hari  
        const appProducts = ['capcut', 'alightmotion', 'chatgpt', 'bstation'];
        
        if (streamingProducts.includes(product.toLowerCase())) {
            return `Garansi ${productName} adalah 30 hari, Kak! Karena termasuk akun streaming. Jadi kalau ada kendala dalam 30 hari pertama, bisa langsung claim ke admin ya 😊`;
        } else if (appProducts.includes(product.toLowerCase())) {
            return `Garansi ${productName} adalah 7 hari, Kak! Karena termasuk aplikasi premium. Kalau ada masalah dalam 7 hari pertama, langsung chat admin aja ya 😊`;
        } else {
            return `${productName} bergaransi sesuai ketentuan produk, Kak. Untuk info detail garansi, bisa chat admin di wa.me/6289630375723 ya! 😊`;
        }
    }

    generateGeneralResponse(analysis, extractedInfo) {
        // Fallback for complex queries
        return null;
    }

    /**
     * SMART SEARCH - Search across all sources for specific info
     */
    async smartSearch(query) {
        try {
            const analysis = this.analyzeQuery(query);
            
            if (!analysis.isSpecificQuestion || analysis.confidence < 0.5) {
                return null; // Not a specific info question
            }
            
            // Search in order: Product -> FAQ -> SOP (prioritize product data)
            const sources = ['product', 'faq', 'sop'];
            
            for (const source of sources) {
                const result = await this.searchInSource(source, analysis);
                if (result) {
                    const response = this.generateSmartResponse(analysis, { [source]: result });
                    if (response) {
                        return {
                            text: response,
                            confidence: analysis.confidence,
                            source: `smart_${source}`,
                            extractedData: result
                        };
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error in smart search:', error);
            return null;
        }
    }
}

// Create singleton instance
const smartContentAnalyzer = new SmartContentAnalyzer();

module.exports = { SmartContentAnalyzer, smartContentAnalyzer };