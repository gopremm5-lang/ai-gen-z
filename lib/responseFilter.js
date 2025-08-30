const natural = require('natural');
const compromise = require('compromise');
const { removeStopwords, eng, ind } = require('stopword');
const pos = require('pos');
const franc = require('franc');

class ResponseFilter {
    constructor() {
        this.templatePatterns = [
            // Template phrases yang harus dihindari (BUKAN dari data Vylozzone)
            'silakan upgrade aplikasi',
            'mohon update aplikasi',
            'coba restart aplikasi',
            'hapus cache aplikasi',
            'install ulang aplikasi',
            'hubungi customer service',
            'kirim email ke support',
            'buka pengaturan aplikasi',
            'periksa koneksi internet',
            'pastikan aplikasi terbaru',
            'hubungi developer',
            'update sistem operasi',
            'clear data aplikasi'
        ];
        
        // Load existing FAQ/SOP data to align responses
        this.existingFaqSop = [];
        this.loadExistingData();
        
        this.vylozzoneContext = [
            'vylozzone', 'marketplace', 'digital', 'premium', 'aplikasi', 'streaming',
            'netflix', 'spotify', 'disney', 'order', 'garansi', 'claim', 'pembayaran',
            'qris', 'dana', 'ovo', 'transfer', 'bank', 'akun', 'email', 'password',
            'expired', 'durasi', 'bulan', 'tahun', 'harga', 'promo', 'diskon',
            'screenshot', 'nomor order', 'kronologi', 'kendala', 'profil', 'device',
            'login', 'error', 'otp', 'terkunci', 'replace', 'admin'
        ];
        
        this.qualityIndicators = {
            helpful: ['solusi', 'bantuan', 'caranya', 'langkah', 'prosedur', 'tutorial'],
            specific: ['kirim', 'screenshot', 'nomor order', 'detail', 'kronologi', 'jelaskan'],
            supportive: ['tenang', 'kami bantu', 'akan diproses', 'segera ditangani', 'sampai selesai'],
            professional: ['sesuai sop', 'tim kami', 'kebijakan', 'prosedur'],
            vylozzone_official: ['chat admin', 'langsung chat', 'admin akan', 'tim vylozzone', 'maksimal 1x24 jam']
        };
    }

    async loadExistingData() {
        try {
            const { loadJson } = require('./dataLoader');
            
            // Load FAQ data
            const faqData = await loadJson('../faq.json') || [];
            const sopData = await loadJson('../sop.json') || [];
            
            this.existingFaqSop = [
                ...faqData.map(item => ({
                    type: 'faq',
                    keywords: item.keyword || [],
                    response: item.answer || item.response?.[0] || '',
                    official: true
                })),
                ...sopData.map(item => ({
                    type: 'sop',
                    keywords: item.trigger || [],
                    response: item.response?.[0] || '',
                    official: true
                }))
            ];
            
            console.log(`📚 Loaded ${this.existingFaqSop.length} official FAQ/SOP responses for alignment`);
        } catch (error) {
            console.error('Error loading existing FAQ/SOP data:', error);
            this.existingFaqSop = [];
        }
    }

    // Main filter function
    async filterGeminiResponse(originalQuestion, geminiResponse, context = {}) {
        try {
            const analysis = await this.analyzeResponse(originalQuestion, geminiResponse);
            
            // Check if response is suitable for learning
            const suitability = this.checkSuitabilityForLearning(analysis);
            
            if (suitability.suitable) {
                // Process and improve the response
                const processedResponse = await this.processResponse(geminiResponse, originalQuestion, context);
                
                return {
                    shouldLearn: true,
                    originalResponse: geminiResponse,
                    processedResponse: processedResponse,
                    confidence: suitability.confidence,
                    analysis: analysis,
                    improvements: suitability.improvements
                };
            } else {
                return {
                    shouldLearn: false,
                    originalResponse: geminiResponse,
                    reason: suitability.reason,
                    analysis: analysis
                };
            }
        } catch (error) {
            console.error('Error filtering response:', error);
            return {
                shouldLearn: false,
                originalResponse: geminiResponse,
                reason: 'analysis_error',
                error: error.message
            };
        }
    }

    async analyzeResponse(question, response) {
        const questionDoc = compromise(question);
        const responseDoc = compromise(response);
        
        // Language detection
        const language = franc(response);
        const isIndonesian = language === 'ind' || response.match(/\b(yang|dan|atau|untuk|dengan|pada|dari|ke|di|adalah)\b/g);
        
        // Extract key information
        const analysis = {
            language: isIndonesian ? 'indonesian' : 'other',
            questionTokens: this.extractKeyTokens(question),
            responseTokens: this.extractKeyTokens(response),
            sentiment: this.analyzeSentiment(response),
            isTemplate: this.isTemplateResponse(response),
            isVylozzoneRelated: this.isVylozzoneRelated(response),
            qualityScore: this.calculateQualityScore(response),
            length: response.length,
            entities: {
                question: questionDoc.match('#Person|#Place|#Organization|#Product').out('array'),
                response: responseDoc.match('#Person|#Place|#Organization|#Product').out('array')
            }
        };

        return analysis;
    }

    extractKeyTokens(text) {
        try {
            // Tokenize and clean
            const tokens = natural.WordTokenizer().tokenize(text.toLowerCase());
            
            // Remove stopwords (Indonesian + English)
            const cleanTokens = removeStopwords(tokens, [...ind, ...eng]);
            
            // Stem words
            const stemmed = cleanTokens.map(token => natural.PorterStemmerID.stem(token));
            
            // Filter meaningful tokens
            return stemmed.filter(token => 
                token.length > 2 && 
                !token.match(/^\d+$/) && // No pure numbers
                token.match(/^[a-zA-Z]+$/) // Only letters
            );
        } catch (error) {
            console.error('Error extracting tokens:', error);
            return [];
        }
    }

    analyzeSentiment(text) {
        try {
            const tokens = natural.WordTokenizer().tokenize(text.toLowerCase());
            const analyzer = new natural.SentimentAnalyzer('Indonesian', natural.PorterStemmerID, 'afinn');
            const score = analyzer.getSentiment(tokens);
            
            let label = 'neutral';
            if (score > 0.1) label = 'positive';
            else if (score < -0.1) label = 'negative';
            
            return { score, label };
        } catch (error) {
            return { score: 0, label: 'neutral' };
        }
    }

    isTemplateResponse(response) {
        const lowerResponse = response.toLowerCase();
        
        // Check for template patterns
        const hasTemplatePattern = this.templatePatterns.some(pattern => 
            lowerResponse.includes(pattern.toLowerCase())
        );
        
        // Check for generic phrases
        const genericPhrases = [
            'silakan coba',
            'mohon periksa',
            'harap pastikan',
            'untuk informasi lebih lanjut',
            'jika masalah berlanjut',
            'hubungi tim support'
        ];
        
        const hasGenericPhrase = genericPhrases.some(phrase => 
            lowerResponse.includes(phrase.toLowerCase())
        );
        
        return hasTemplatePattern || hasGenericPhrase;
    }

    isVylozzoneRelated(response) {
        const lowerResponse = response.toLowerCase();
        const contextMatches = this.vylozzoneContext.filter(term => 
            lowerResponse.includes(term.toLowerCase())
        );
        
        return contextMatches.length >= 2; // At least 2 context terms
    }

    calculateQualityScore(response) {
        let score = 0;
        const lowerResponse = response.toLowerCase();
        
        // Check for quality indicators
        Object.entries(this.qualityIndicators).forEach(([category, indicators]) => {
            const matches = indicators.filter(indicator => 
                lowerResponse.includes(indicator.toLowerCase())
            );
            score += matches.length * 0.1; // Each match adds 0.1
        });
        
        // Bonus for specific information
        if (response.match(/\b\d+\b/g)) score += 0.1; // Contains numbers
        if (response.includes('screenshot')) score += 0.1;
        if (response.includes('nomor order')) score += 0.1;
        
        // Penalty for vague responses
        if (response.length < 50) score -= 0.2;
        if (lowerResponse.includes('mungkin') || lowerResponse.includes('kemungkinan')) score -= 0.1;
        
        return Math.max(0, Math.min(1, score)); // Clamp to 0-1
    }

    checkSuitabilityForLearning(analysis) {
        const issues = [];
        let confidence = 0.5;

        // Check language
        if (analysis.language !== 'indonesian') {
            issues.push('not_indonesian');
            confidence -= 0.3;
        }

        // Check if template
        if (analysis.isTemplate) {
            issues.push('template_response');
            confidence -= 0.4;
        }

        // Check context relevance
        if (!analysis.isVylozzoneRelated) {
            issues.push('not_vylozzone_related');
            confidence -= 0.3;
        }

        // Check quality
        if (analysis.qualityScore < 0.3) {
            issues.push('low_quality');
            confidence -= 0.2;
        }

        // Check sentiment
        if (analysis.sentiment.label === 'negative') {
            issues.push('negative_sentiment');
            confidence -= 0.1;
        }

        // Check length (too short or too long)
        if (analysis.length < 30) {
            issues.push('too_short');
            confidence -= 0.1;
        } else if (analysis.length > 500) {
            issues.push('too_long');
            confidence -= 0.1;
        }

        const suitable = confidence > 0.4 && issues.length < 3;

        return {
            suitable: suitable,
            confidence: Math.max(0, confidence),
            issues: issues,
            reason: suitable ? 'suitable_for_learning' : `unsuitable: ${issues.join(', ')}`,
            improvements: this.suggestImprovements(analysis, issues)
        };
    }

    async processResponse(response, originalQuestion, context) {
        try {
            // STEP 1: Check if conflicts with existing FAQ/SOP
            const conflictCheck = await this.checkConflictWithExisting(response, originalQuestion);
            if (conflictCheck.hasConflict) {
                console.log(`⚠️ Response conflicts with existing ${conflictCheck.type}, using official response`);
                return conflictCheck.officialResponse;
            }

            // STEP 2: Remove template phrases (only non-Vylozzone ones)
            let processed = response;
            
            this.templatePatterns.forEach(pattern => {
                const regex = new RegExp(pattern, 'gi');
                processed = processed.replace(regex, '');
            });

            // STEP 3: Clean up extra spaces and formatting
            processed = processed
                .replace(/\s+/g, ' ') // Multiple spaces to single
                .replace(/\.\s*\./g, '.') // Double periods
                .trim();

            // STEP 4: Align with official style if needed
            processed = await this.alignWithOfficialStyle(processed, originalQuestion);

            // STEP 5: Add Vylozzone context if missing (but not conflicting)
            if (!this.isVylozzoneRelated(processed)) {
                processed = this.addVylozzoneContext(processed, originalQuestion);
            }

            // STEP 6: Ensure professional tone consistent with FAQ/SOP
            processed = this.ensureProfessionalTone(processed);

            return processed;
        } catch (error) {
            console.error('Error processing response:', error);
            return response; // Return original if processing fails
        }
    }

    addVylozzoneContext(response, question) {
        // Add context based on question type
        const lowerQuestion = question.toLowerCase();
        
        if (lowerQuestion.includes('error') || lowerQuestion.includes('masalah')) {
            return `${response} Mohon kirim screenshot error dan nomor order untuk kami follow-up sesuai SOP Vylozzone.`;
        }
        
        if (lowerQuestion.includes('bayar') || lowerQuestion.includes('payment')) {
            return `${response} Di Vylozzone, pembayaran bisa via QRIS, Transfer Bank, atau e-wallet.`;
        }
        
        if (lowerQuestion.includes('garansi') || lowerQuestion.includes('claim')) {
            return `${response} Produk Vylozzone bergaransi sesuai ketentuan - streaming 30 hari, aplikasi premium 7 hari.`;
        }
        
        return `${response} Tim Vylozzone siap membantu jika ada kendala lebih lanjut.`;
    }

    ensureProfessionalTone(response) {
        // Replace informal with professional
        const replacements = {
            'gak': 'tidak',
            'ga': 'tidak', 
            'udah': 'sudah',
            'gimana': 'bagaimana',
            'kenapa': 'mengapa',
            'yg': 'yang',
            'dgn': 'dengan',
            'utk': 'untuk'
        };

        let professional = response;
        Object.entries(replacements).forEach(([informal, formal]) => {
            const regex = new RegExp(`\\b${informal}\\b`, 'gi');
            professional = professional.replace(regex, formal);
        });

        return professional;
    }

    suggestImprovements(analysis, issues) {
        const improvements = [];

        if (issues.includes('template_response')) {
            improvements.push('Remove generic template phrases');
        }
        
        if (issues.includes('not_vylozzone_related')) {
            improvements.push('Add Vylozzone-specific context');
        }
        
        if (issues.includes('low_quality')) {
            improvements.push('Add more specific information');
        }
        
        if (issues.includes('too_short')) {
            improvements.push('Provide more detailed response');
        }
        
        if (issues.includes('negative_sentiment')) {
            improvements.push('Use more positive, helpful tone');
        }

        return improvements;
    }

    async checkConflictWithExisting(response, question) {
        try {
            const lowerResponse = response.toLowerCase();
            const lowerQuestion = question.toLowerCase();
            
            // Check if question matches existing FAQ/SOP triggers
            for (const item of this.existingFaqSop) {
                const matchingKeywords = item.keywords.filter(keyword => 
                    lowerQuestion.includes(keyword.toLowerCase())
                );
                
                if (matchingKeywords.length > 0) {
                    // Question matches existing data - check if response conflicts
                    const officialResponse = item.response;
                    const similarity = this.calculateResponseSimilarity(response, officialResponse);
                    
                    if (similarity < 0.3) { // Responses are very different
                        return {
                            hasConflict: true,
                            type: item.type,
                            officialResponse: officialResponse,
                            similarity: similarity
                        };
                    }
                }
            }
            
            return { hasConflict: false };
        } catch (error) {
            console.error('Error checking conflict:', error);
            return { hasConflict: false };
        }
    }

    async alignWithOfficialStyle(response, question) {
        try {
            const lowerQuestion = question.toLowerCase();
            
            // Find similar official responses to mimic style
            const matchingOfficial = this.existingFaqSop.find(item => 
                item.keywords.some(keyword => 
                    lowerQuestion.includes(keyword.toLowerCase())
                )
            );
            
            if (matchingOfficial) {
                const officialStyle = this.extractStylePatterns(matchingOfficial.response);
                return this.applyStylePatterns(response, officialStyle);
            }
            
            return response;
        } catch (error) {
            console.error('Error aligning with official style:', error);
            return response;
        }
    }

    extractStylePatterns(officialResponse) {
        const patterns = {
            greeting: officialResponse.includes('Tenang, Kak') || officialResponse.includes('Kak'),
            helpPhrase: officialResponse.includes('kami bantu') || officialResponse.includes('bantu sampai selesai'),
            requestData: officialResponse.includes('kirim nomor order') && officialResponse.includes('screenshot'),
            adminContact: officialResponse.includes('chat admin') || officialResponse.includes('langsung chat'),
            timeframe: officialResponse.includes('maksimal 1x24 jam'),
            guarantee: officialResponse.includes('sesuai SOP') || officialResponse.includes('garansi')
        };
        
        return patterns;
    }

    applyStylePatterns(response, stylePatterns) {
        let styled = response;
        
        // Apply official greeting style if needed
        if (stylePatterns.greeting && !styled.includes('Kak')) {
            styled = styled.replace(/^/, 'Tenang, Kak. ');
        }
        
        // Ensure official help phrases
        if (stylePatterns.helpPhrase && !styled.includes('kami bantu')) {
            styled = styled + ' Tim kami siap bantu sampai selesai.';
        }
        
        // Ensure data request format matches official style
        if (stylePatterns.requestData && styled.includes('screenshot') && styled.includes('order')) {
            styled = styled.replace(
                /screenshot.*?order/gi,
                'screenshot kendalanya dan nomor order'
            );
        }
        
        return styled.trim();
    }

    calculateResponseSimilarity(response1, response2) {
        try {
            const tokens1 = this.extractKeyTokens(response1);
            const tokens2 = this.extractKeyTokens(response2);
            
            const intersection = tokens1.filter(token => tokens2.includes(token));
            const union = [...new Set([...tokens1, ...tokens2])];
            
            return intersection.length / union.length;
        } catch (error) {
            return 0;
        }
    }

    // Get learning statistics
    getFilterStats() {
        return {
            templatePatterns: this.templatePatterns.length,
            contextTerms: this.vylozzoneContext.length,
            qualityCategories: Object.keys(this.qualityIndicators).length,
            existingFaqSop: this.existingFaqSop.length
        };
    }
}

module.exports = { ResponseFilter };
