const { ResponseFilter } = require('./responseFilter');
const { GEMINI_TEXT } = require('./gemini');
const { loadJson, saveJson } = require('./dataLoader');
const { botLaws } = require('./botLaws');

class SmartFallback {
    constructor(learningManager) {
        this.learningManager = learningManager;
        this.responseFilter = new ResponseFilter();
        this.unknownCases = [];
        this.learningQueue = [];
        this.initializeSystem();
    }

    async initializeSystem() {
        await this.responseFilter.loadExistingData();
        await this.loadUnknownCases();
    }

    async loadUnknownCases() {
        try {
            this.unknownCases = await loadJson('../learning/unknown_cases.json') || [];
            this.learningQueue = await loadJson('../learning/learning_queue.json') || [];
        } catch (error) {
            console.error('Error loading unknown cases:', error);
            this.unknownCases = [];
            this.learningQueue = [];
        }
    }

    async handleUnknownCase(message, sender, context = {}) {
        try {
            console.log(`🤔 Unknown case detected: "${message}"`);
            
            // Step 1: Check if we've seen similar case before
            const similarCase = await this.findSimilarCase(message);
            // STANDARDIZED CONFIDENCE THRESHOLD: 0.6
            if (similarCase && similarCase.confidence > 0.6) {
                console.log(`📚 Found similar case with confidence: ${similarCase.confidence}`);
                return {
                    text: similarCase.response,
                    confidence: similarCase.confidence,
                    source: 'learned_similar_case'
                };
            }

            // Step 2: Use Gemini but with business context
            const contextualPrompt = this.buildContextualPrompt(message, context);
            const geminiResponse = await GEMINI_TEXT(sender, contextualPrompt);
            
            if (!geminiResponse) {
                return {
                    text: "Maaf, saya perlu bantuan untuk menjawab pertanyaan ini. Mohon hubungi admin untuk bantuan lebih lanjut.",
                    confidence: 0.2,
                    source: 'fallback_error'
                };
            }

            // Step 3: LAWS VALIDATION - Check Gemini response against bot laws
            const lawValidation = botLaws.validateAction('response', geminiResponse, {
                originalQuestion: message,
                source: 'gemini_smart_fallback',
                sender: sender
            });

            if (!lawValidation.allowed) {
                console.error(`🚨 Gemini response blocked by Bot Laws: ${lawValidation.blockReason}`);
                
                // Store violation but don't learn from it
                await this.storeUnknownCase(message, geminiResponse, {
                    shouldLearn: false,
                    reason: 'bot_laws_violation',
                    analysis: { lawViolations: lawValidation.violations }
                }, sender);

                return {
                    text: `Maaf, saya tidak dapat memberikan jawaban yang sesuai untuk pertanyaan ini. Tim kami akan review dan meningkatkan response. Mohon hubungi admin untuk bantuan langsung.`,
                    confidence: 0.1,
                    source: 'laws_blocked_fallback',
                    learned: false,
                    lawViolations: lawValidation.violations
                };
            }

            // Step 4: Filter and analyze Gemini response (if laws passed)
            const filterResult = await this.responseFilter.filterGeminiResponse(
                message, 
                geminiResponse, 
                { sender, context }
            );

            // Step 5: Store unknown case for analysis
            await this.storeUnknownCase(message, geminiResponse, filterResult, sender);

            // Step 6: Learn if suitable AND laws compliant
            // STANDARDIZED CONFIDENCE THRESHOLD: 0.6
            if (filterResult.shouldLearn && filterResult.confidence > 0.6) {
                await this.queueForLearning(message, filterResult.processedResponse, filterResult);
                console.log(`✅ Queued for learning: "${message}"`);
                
                return {
                    text: filterResult.processedResponse,
                    confidence: filterResult.confidence,
                    source: 'smart_gemini_filtered',
                    learned: true,
                    lawsCompliant: true
                };
            } else {
                console.log(`⚠️ Not suitable for learning: ${filterResult.reason}`);
                
                return {
                    text: geminiResponse, // Use original if filtering failed
                    confidence: 0.3,
                    source: 'gemini_unfiltered',
                    learned: false,
                    filterReason: filterResult.reason,
                    lawsCompliant: true
                };
            }

        } catch (error) {
            console.error('Error in smart fallback:', error);
            return {
                text: "Maaf, terjadi kesalahan sistem. Mohon coba lagi atau hubungi admin untuk bantuan.",
                confidence: 0.1,
                source: 'fallback_error'
            };
        }
    }

    buildContextualPrompt(message, context) {
        const vylozzoneContext = `
Context: Anda adalah customer service resmi Vylozzone, marketplace digital terpercaya untuk aplikasi premium.

IDENTITAS BISNIS:
• Vylozzone - Digital marketplace untuk aplikasi premium & streaming accounts
• Produk: Netflix, Spotify, Disney+, YouTube Premium, Canva, CapCut, ChatGPT, dll
• Target: User Indonesia yang butuh akses aplikasi premium dengan harga terjangkau

KEBIJAKAN GARANSI & LAYANAN:
• Streaming accounts (Netflix, Spotify, Disney+): Garansi 30 hari full
• Aplikasi premium (Canva, CapCut): Garansi 7 hari  
• SMM services: Garansi sesuai package yang dipilih
• Pengiriman: Maksimal 1x24 jam setelah pembayaran confirmed
• Support: Via WhatsApp chat 24/7 dengan tim CS

PROSEDUR CLAIM GARANSI:
• Customer kirim nomor order + screenshot kendala/error
• Tim CS review sesuai SOP dalam 1x24 jam
• Replace/refund sesuai ketentuan garansi
• Alternatif: Direct chat admin di wa.me/6289630375723

METODE PEMBAYARAN:
• QRIS (semua e-wallet: Dana, OVO, GoPay, ShopeePay)
• Transfer Bank: BCA, BRI, Mandiri, BNI
• E-wallet direct: Dana, OVO, GoPay

TONE & STYLE GUIDELINES:
• Gunakan "Kak" untuk menyapa customer (friendly Indonesian style)
• Selalu minta "nomor order dan screenshot" untuk troubleshooting
• Jangan sarankan upgrade/restart/clear cache kecuali spesifik relevan
• Fokus pada solusi bisnis Vylozzone, bukan solusi teknis generik
• Professional namun ramah, solution-oriented

Pertanyaan customer: "${message}"

INSTRUKSI RESPONSE:
Berikan jawaban yang spesifik untuk bisnis Vylozzone, professional, dan actionable. Jika customer ada masalah, selalu minta nomor order + screenshot untuk follow-up. Jangan berikan solusi template generik.`;

        return vylozzoneContext;
    }

    async findSimilarCase(message) {
        try {
            const similarities = [];
            
            for (const case_ of this.unknownCases) {
                if (case_.learned && case_.response) {
                    const similarity = this.calculateSimilarity(message, case_.message);
                    if (similarity > 0.6) {
                        similarities.push({
                            ...case_,
                            confidence: similarity
                        });
                    }
                }
            }

            // Return best match
            if (similarities.length > 0) {
                similarities.sort((a, b) => b.confidence - a.confidence);
                return similarities[0];
            }

            return null;
        } catch (error) {
            console.error('Error finding similar case:', error);
            return null;
        }
    }

    calculateSimilarity(text1, text2) {
        try {
            // Use different similarity algorithms
            const tokens1 = text1.toLowerCase().split(' ');
            const tokens2 = text2.toLowerCase().split(' ');
            
            // Jaccard similarity
            const intersection = tokens1.filter(token => tokens2.includes(token));
            const union = [...new Set([...tokens1, ...tokens2])];
            const jaccard = intersection.length / union.length;
            
            // Basic word overlap
            const overlap = intersection.length / Math.max(tokens1.length, tokens2.length);
            
            // Combined score
            return (jaccard * 0.6) + (overlap * 0.4);
        } catch (error) {
            return 0;
        }
    }

    async storeUnknownCase(message, geminiResponse, filterResult, sender) {
        try {
            const unknownCase = {
                id: Date.now(),
                message: message,
                geminiResponse: geminiResponse,
                filteredResponse: filterResult.processedResponse,
                filterAnalysis: filterResult.analysis,
                suitable: filterResult.shouldLearn,
                confidence: filterResult.confidence,
                sender: sender,
                timestamp: new Date().toISOString(),
                learned: false
            };

            this.unknownCases.push(unknownCase);
            
            // Keep only last 200 cases
            if (this.unknownCases.length > 200) {
                this.unknownCases = this.unknownCases.slice(-200);
            }

            await saveJson('../learning/unknown_cases.json', this.unknownCases);
        } catch (error) {
            console.error('Error storing unknown case:', error);
        }
    }

    async queueForLearning(message, response, filterResult) {
        try {
            const learningItem = {
                id: Date.now(),
                input: message,
                response: response,
                confidence: filterResult.confidence,
                source: 'smart_fallback',
                filterAnalysis: filterResult.analysis,
                timestamp: new Date().toISOString(),
                status: 'queued'
            };

            this.learningQueue.push(learningItem);
            await saveJson('../learning/learning_queue.json', this.learningQueue);

            // Auto-learn if high confidence
            if (filterResult.confidence > 0.7) {
                await this.processLearningQueue(learningItem.id);
            }
        } catch (error) {
            console.error('Error queuing for learning:', error);
        }
    }

    async processLearningQueue(specificId = null) {
        try {
            const itemsToProcess = specificId 
                ? this.learningQueue.filter(item => item.id === specificId)
                : this.learningQueue.filter(item => item.status === 'queued' && item.confidence > 0.6);

            for (const item of itemsToProcess) {
                // Learn with the learning manager
                await this.learningManager.nlpProcessor.learnFromOwner(
                    item.input,
                    item.response,
                    {
                        source: 'smart_fallback',
                        confidence: item.confidence,
                        originalGemini: true,
                        filtered: true
                    }
                );

                // Mark as processed
                item.status = 'learned';
                item.learnedAt = new Date().toISOString();

                // Update unknown cases
                const unknownCase = this.unknownCases.find(uc => 
                    uc.message === item.input && !uc.learned
                );
                if (unknownCase) {
                    unknownCase.learned = true;
                    unknownCase.response = item.response;
                }

                console.log(`🎓 Auto-learned from smart fallback: "${item.input}"`);
            }

            await saveJson('../learning/learning_queue.json', this.learningQueue);
            await saveJson('../learning/unknown_cases.json', this.unknownCases);

        } catch (error) {
            console.error('Error processing learning queue:', error);
        }
    }

    // Owner command to review and approve learning queue
    async handleOwnerReview(command, sender) {
        const ownerNumber = require('../config').owner_number;
        const senderNumber = sender.split('@')[0];
        
        if (senderNumber !== ownerNumber) {
            return 'Perintah ini hanya bisa digunakan oleh owner.';
        }

        const cmd = command.toLowerCase().trim();

        if (cmd === 'review queue' || cmd === 'cek queue') {
            return await this.showLearningQueue();
        }

        if (cmd.startsWith('approve ')) {
            const id = parseInt(cmd.replace('approve ', ''));
            return await this.approveQueueItem(id);
        }

        if (cmd.startsWith('reject ')) {
            const id = parseInt(cmd.replace('reject ', ''));
            return await this.rejectQueueItem(id);
        }

        if (cmd === 'unknown cases' || cmd === 'cases') {
            return await this.showUnknownCases();
        }

        if (cmd === 'auto learn') {
            await this.processLearningQueue();
            return 'Auto-learning dijalankan untuk item dengan confidence > 0.6';
        }

        return null;
    }

    async showLearningQueue() {
        const pending = this.learningQueue.filter(item => item.status === 'queued');
        
        if (pending.length === 0) {
            return '📋 Queue pembelajaran kosong. Semua response telah diproses.';
        }

        let message = `📋 *LEARNING QUEUE* (${pending.length} pending)\n\n`;
        
        pending.slice(0, 5).forEach((item, index) => {
            message += `${index + 1}. ID: ${item.id}\n`;
            message += `   📝 Input: "${item.input}"\n`;
            message += `   💬 Response: "${item.response.substring(0, 100)}..."\n`;
            message += `   📊 Confidence: ${(item.confidence * 100).toFixed(1)}%\n`;
            message += `   ⏰ ${new Date(item.timestamp).toLocaleString('id-ID')}\n\n`;
        });

        if (pending.length > 5) {
            message += `... dan ${pending.length - 5} item lainnya\n\n`;
        }

        message += `📝 Commands:\n`;
        message += `• approve [id] - Setujui pembelajaran\n`;
        message += `• reject [id] - Tolak pembelajaran\n`;
        message += `• auto learn - Auto-learn confidence > 60%`;

        return message;
    }

    async approveQueueItem(id) {
        const item = this.learningQueue.find(i => i.id === id);
        if (!item) {
            return `❌ Item dengan ID ${id} tidak ditemukan.`;
        }

        if (item.status === 'learned') {
            return `⚠️ Item ID ${id} sudah dipelajari sebelumnya.`;
        }

        await this.processLearningQueue(id);
        return `✅ Item ID ${id} berhasil dipelajari!\n\nInput: "${item.input}"\nResponse: "${item.response}"`;
    }

    async rejectQueueItem(id) {
        const item = this.learningQueue.find(i => i.id === id);
        if (!item) {
            return `❌ Item dengan ID ${id} tidak ditemukan.`;
        }

        item.status = 'rejected';
        item.rejectedAt = new Date().toISOString();
        
        await saveJson('../learning/learning_queue.json', this.learningQueue);
        return `❌ Item ID ${id} ditolak dan tidak akan dipelajari.`;
    }

    async showUnknownCases() {
        const recent = this.unknownCases.slice(-10);
        
        if (recent.length === 0) {
            return '📂 Belum ada unknown cases yang tercatat.';
        }

        let message = `📂 *UNKNOWN CASES* (${this.unknownCases.length} total)\n\n`;
        
        recent.forEach((case_, index) => {
            const status = case_.learned ? '✅ Learned' : 
                          case_.suitable ? '⏳ Pending' : '❌ Filtered';
            
            message += `${index + 1}. ${status}\n`;
            message += `   📝 "${case_.message}"\n`;
            message += `   📊 Confidence: ${(case_.confidence * 100).toFixed(1)}%\n`;
            message += `   ⏰ ${new Date(case_.timestamp).toLocaleString('id-ID')}\n\n`;
        });

        const learned = this.unknownCases.filter(c => c.learned).length;
        const pending = this.unknownCases.filter(c => c.suitable && !c.learned).length;
        
        message += `📈 Stats: ${learned} learned, ${pending} pending`;

        return message;
    }

    getStats() {
        const total = this.unknownCases.length;
        const learned = this.unknownCases.filter(c => c.learned).length;
        const suitable = this.unknownCases.filter(c => c.suitable).length;
        const queued = this.learningQueue.filter(q => q.status === 'queued').length;
        
        return {
            totalUnknownCases: total,
            learnedCases: learned,
            suitableCases: suitable,
            queuedForLearning: queued,
            learningRate: total > 0 ? (learned / total * 100).toFixed(1) + '%' : '0%'
        };
    }
}

module.exports = { SmartFallback };
