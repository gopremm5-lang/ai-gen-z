/**
 * ADVANCED CONTENT READER
 * Membaca dan memahami konten seperti manusia, kemudian generate response natural
 * 
 * Capability: Bot bisa baca data produk/FAQ/SOP dan extract informasi spesifik
 * untuk menjawab pertanyaan user dengan natural language
 */

const { loadProdukTxt, loadFAQ, loadSOP, loadJson } = require('./dataLoader');
const natural = require('natural');

class AdvancedContentReader {
    constructor() {
        // Knowledge base untuk mapping produk ke kategori
        this.productCategories = {
            streaming: ['netflix', 'disney', 'youtube', 'iqiyi', 'viu', 'wetv', 'vision+', 'vidio', 'prime', 'hbo', 'bstation'],
            aplikasi: ['capcut', 'alightmotion', 'chatgpt']
        };
        
        // Garansi rules berdasarkan FAQ
        this.garansiRules = {
            streaming: { durasi: 30, unit: 'hari' },
            aplikasi: { durasi: 7, unit: 'hari' }
        };
    }

    /**
     * MAIN FUNCTION: Baca konten dan jawab pertanyaan spesifik
     */
    async readAndAnswer(query) {
        try {
            const analysis = this.analyzeUserQuery(query);
            console.log(`🧠 Query analysis:`, analysis);
            
            if (!analysis.isSpecific) {
                return null; // Not a specific question
            }
            
            // Read relevant content
            const content = await this.gatherRelevantContent(analysis);
            
            // Generate natural response
            const response = this.generateNaturalResponse(analysis, content);
            
            return response;
            
        } catch (error) {
            console.error('Error in advanced content reader:', error);
            return null;
        }
    }

    /**
     * ANALYZE USER QUERY - Understand what user is asking
     */
    analyzeUserQuery(query) {
        const lowerQuery = query.toLowerCase();
        
        // Extract mentioned products
        const mentionedProducts = [];
        for (const [category, products] of Object.entries(this.productCategories)) {
            for (const product of products) {
                if (lowerQuery.includes(product)) {
                    mentionedProducts.push({ name: product, category: category });
                }
            }
        }
        
        // Detect what specific info is being asked
        const infoType = this.detectSpecificInfoType(lowerQuery);
        
        // Detect question pattern
        const questionPattern = this.detectQuestionPattern(lowerQuery);
        
        return {
            originalQuery: query,
            mentionedProducts: mentionedProducts,
            infoType: infoType,
            questionPattern: questionPattern,
            isSpecific: mentionedProducts.length > 0 && infoType !== null,
            confidence: this.calculateAnalysisConfidence(mentionedProducts, infoType, questionPattern)
        };
    }

    detectSpecificInfoType(query) {
        // Garansi questions - PRIORITY 1
        if (/\b(garansi|warranty)\b.*\b(berapa|lama|hari|bulan)\b/.test(query) || 
            /\b(berapa|lama)\b.*\b(garansi|warranty)\b/.test(query)) {
            return 'garansi';
        }
        
        // Specific price questions - PRIORITY 2
        if (/\b(harga|price)\b.*\b(berapa|murah|mahal)\b/.test(query) ||
            /\b(berapa)\b.*\b(harga|biaya|harganya)\b/.test(query) ||
            /berapa\s*harganya/.test(query)) {
            return 'harga_spesifik';
        }
        
        // Feature questions - PRIORITY 3
        if (/\b(fitur|feature)\b.*\b(apa|ada)\b/.test(query) ||
            /\b(apa)\b.*\b(fitur|keunggulan)\b/.test(query)) {
            return 'fitur';
        }
        
        // Duration questions - PRIORITY 4
        if (/\b(berapa|lama)\b.*\b(bulan|hari|durasi)\b/.test(query) && 
            !query.includes('garansi') && !query.includes('harga')) {
            return 'durasi';
        }
        
        return null;
    }

    detectQuestionPattern(query) {
        if (/^(berapa|lama)/.test(query)) return 'berapa_pattern';
        if (/garansi.*berapa/.test(query)) return 'garansi_berapa';
        if (/harga.*berapa/.test(query)) return 'harga_berapa';
        if (/apa.*fitur/.test(query)) return 'apa_fitur';
        
        return 'general_question';
    }

    calculateAnalysisConfidence(products, infoType, pattern) {
        let confidence = 0.3;
        
        if (products.length > 0) confidence += 0.4;
        if (infoType) confidence += 0.3;
        if (pattern !== 'general_question') confidence += 0.2;
        
        return Math.min(confidence, 1.0);
    }

    /**
     * GATHER RELEVANT CONTENT from multiple sources
     */
    async gatherRelevantContent(analysis) {
        const content = {
            products: {},
            faq: null,
            sop: null
        };
        
        // Read product files
        for (const productInfo of analysis.mentionedProducts) {
            try {
                const productData = await loadProdukTxt(productInfo.name);
                if (productData) {
                    content.products[productInfo.name] = {
                        rawData: productData,
                        category: productInfo.category,
                        parsedInfo: this.parseProductContent(productData, productInfo.name)
                    };
                }
            } catch (error) {
                console.warn(`Error loading ${productInfo.name}:`, error);
            }
        }
        
        // Read FAQ for general policies
        try {
            const faqData = await loadFAQ() || [];
            content.faq = faqData;
        } catch (error) {
            console.warn('Error loading FAQ:', error);
        }
        
        return content;
    }

    /**
     * PARSE PRODUCT CONTENT - Extract structured info from raw text
     */
    parseProductContent(rawData, productName) {
        const parsed = {
            prices: this.extractPrices(rawData),
            features: this.extractFeatures(rawData),
            garansi: this.extractGaransiInfo(rawData),
            packages: this.extractPackages(rawData)
        };
        
        return parsed;
    }

    extractPrices(text) {
        const pricePatterns = [
            /rp\s*(\d+[\d\.,]*)\s*k?\s*[\/]?\s*(bulan|hari|tahun)?/gi,
            /(\d+)\s*k\s*[\/=:]\s*(bulan|hari)?/gi,
            /:\s*rp\s*(\d+[\d\.,]*)/gi
        ];
        
        const prices = [];
        for (const pattern of pricePatterns) {
            const matches = [...text.matchAll(pattern)];
            for (const match of matches) {
                prices.push({
                    amount: match[1],
                    unit: match[2] || 'bulan',
                    context: this.getContext(text, match.index, 30)
                });
            }
        }
        
        return prices;
    }

    extractFeatures(text) {
        const featurePatterns = [
            /✅\s*([^✅\r\n]+)/g,
            /•\s*([^•\r\n]+)/g,
            /_([^_\r\n]+)_/g
        ];
        
        const features = [];
        for (const pattern of featurePatterns) {
            const matches = [...text.matchAll(pattern)];
            for (const match of matches) {
                const feature = match[1].trim();
                if (feature.length > 3 && !feature.match(/^\d+/)) {
                    features.push(feature);
                }
            }
        }
        
        return features;
    }

    extractGaransiInfo(text) {
        // Look for specific garansi mentions
        const garansiPatterns = [
            /garansi\s*(\d+)\s*(hari|day)/gi,
            /(\d+)\s*(hari|day)\s*garansi/gi,
            /full\s*garansi/gi,
            /garansi\s*penuh/gi
        ];
        
        for (const pattern of garansiPatterns) {
            const match = pattern.exec(text);
            if (match) {
                if (match[1]) {
                    return { durasi: match[1], unit: match[2] || 'hari' };
                } else {
                    return { durasi: 'full', unit: 'garansi' };
                }
            }
        }
        
        return null;
    }

    extractPackages(text) {
        const lines = text.split('\n');
        const packages = [];
        
        for (const line of lines) {
            if (line.includes('Bulan') && line.includes('Rp')) {
                packages.push(line.trim());
            }
        }
        
        return packages;
    }

    getContext(text, index, length = 30) {
        const start = Math.max(0, index - length);
        const end = Math.min(text.length, index + length);
        return text.substring(start, end).trim();
    }

    /**
     * GENERATE NATURAL RESPONSE - Like human reading and answering
     */
    generateNaturalResponse(analysis, content) {
        const { mentionedProducts, infoType, questionPattern } = analysis;
        
        if (mentionedProducts.length === 1 && infoType) {
            return this.generateSingleProductAnswer(mentionedProducts[0], infoType, content, analysis);
        }
        
        if (mentionedProducts.length > 1) {
            return this.generateMultiProductAnswer(mentionedProducts, infoType, content);
        }
        
        return null;
    }

    generateSingleProductAnswer(productInfo, infoType, content, analysis) {
        const productName = productInfo.name.charAt(0).toUpperCase() + productInfo.name.slice(1);
        const productContent = content.products[productInfo.name];
        
        if (!productContent) {
            return null;
        }
        
        switch (infoType) {
            case 'garansi':
                // Baca dari knowledge base garansi rules
                const garansiRule = this.garansiRules[productInfo.category];
                if (garansiRule) {
                    return `Garansi ${productName} adalah ${garansiRule.durasi} ${garansiRule.unit}, Kak! Karena ${productName} termasuk kategori ${productInfo.category === 'streaming' ? 'akun streaming' : 'aplikasi premium'}. Jadi kalau ada kendala dalam ${garansiRule.durasi} ${garansiRule.unit} pertama, bisa langsung claim ke admin ya 😊`;
                }
                break;
                
            case 'harga_spesifik':
                const prices = productContent.parsedInfo.prices;
                if (prices.length > 0) {
                    // Find cheapest price
                    const cheapest = prices.reduce((min, price) => 
                        parseInt(price.amount.replace(/\D/g, '')) < parseInt(min.amount.replace(/\D/g, '')) ? price : min
                    );
                    
                    const garansiInfo = this.garansiRules[productInfo.category];
                    
                    if (analysis.originalQuery.includes('murah') || analysis.originalQuery.includes('termurah')) {
                        return `${productName} yang paling murah Rp ${cheapest.amount}k, Kak! Itu untuk paket ${cheapest.unit}an dengan garansi ${garansiInfo?.durasi} ${garansiInfo?.unit}. Worth it banget! Mau order? 😊`;
                    } else {
                        return `Harga ${productName} mulai dari Rp ${cheapest.amount}k per ${cheapest.unit}, Kak! Sudah include garansi ${garansiInfo?.durasi} ${garansiInfo?.unit} juga. Ada beberapa paket, mau lihat yang mana? 😊`;
                    }
                }
                break;
                
            case 'fitur':
                const features = productContent.parsedInfo.features;
                if (features.length > 0) {
                    const topFeatures = features.slice(0, 4);
                    return `Fitur ${productName} antara lain:\n• ${topFeatures.join('\n• ')}\n\nLengkap banget kan, Kak? Cocok buat kebutuhan digital harian! Mau order? 😊`;
                }
                break;
        }
        
        return null;
    }

    generateMultiProductAnswer(products, infoType, content) {
        if (infoType === 'garansi') {
            let response = `Garansi produk yang Kak tanya:\n\n`;
            
            for (const productInfo of products) {
                const garansiRule = this.garansiRules[productInfo.category];
                if (garansiRule) {
                    const productName = productInfo.name.charAt(0).toUpperCase() + productInfo.name.slice(1);
                    response += `🔸 ${productName}: ${garansiRule.durasi} ${garansiRule.unit}\n`;
                }
            }
            
            response += `\nSemua produk bergaransi penuh sesuai kategorinya ya, Kak! Ada yang mau diorder? 😊`;
            return response;
        }
        
        return null;
    }
}

// Create singleton
const advancedContentReader = new AdvancedContentReader();

module.exports = { AdvancedContentReader, advancedContentReader };