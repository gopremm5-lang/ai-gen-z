const { NLPProcessor } = require('./nlpProcessor');
const { ImageAnalyzer } = require('./imageAnalyzer');
const { SafetyGuard } = require('./safetyGuard');
const { loadJson, saveJson } = require('./dataLoader');
const { handleUserMessage } = require('./hybridHandler');
const config = require('../config');

class LearningManager {
    constructor() {
        this.nlpProcessor = new NLPProcessor();
        this.imageAnalyzer = new ImageAnalyzer();
        this.safetyGuard = new SafetyGuard();
        this.smartFallback = null; // Will be initialized after this object is created
        this.isInitialized = false;
        this.learningMode = true; // Always learning
        this.learningStats = {
            totalInputs: 0,
            safeInputs: 0,
            blockedInputs: 0,
            learningAttempts: 0,
            successfulLearning: 0
        };
        this.initialize();
    }

    async initialize() {
        try {
            console.log('🧠 Initializing Learning Manager...');
            await this.nlpProcessor.loadLearningData();
            
            // Initialize smart fallback (circular dependency fix)
            const { SmartFallback } = require('./smartFallback');
            this.smartFallback = new SmartFallback(this);
            
            this.isInitialized = true;
            console.log('✅ Learning Manager initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing Learning Manager:', error);
        }
    }

    // Main processing function - replaces some Gemini functionality
    async processMessage(message, sender, messageType = 'text', mediaPath = null) {
        try {
            if (!this.isInitialized) {
                return null; // Fall back to Gemini if not ready
            }

            let result = null;

            // Handle different message types
            switch (messageType) {
                case 'imageMessage':
                case 'image':
                    if (mediaPath) {
                        result = await this.processImageMessage(message, mediaPath, sender);
                    }
                    break;
                
                case 'text':
                case 'conversation':
                case 'extendedTextMessage':
                default:
                    result = await this.processTextMessage(message, sender);
                    break;
            }

            // Save conversation for learning
            await this.saveConversation(sender, message, result, messageType);

            return result;

        } catch (error) {
            console.error('Error in learning manager:', error);
            return null; // Fall back to Gemini
        }
    }

    async processTextMessage(message, sender) {
        try {
            // Check if this is owner teaching the bot
            if (this.isOwnerTeaching(message, sender)) {
                return await this.handleOwnerTeaching(message, sender);
            }

            // STEP 1: First try existing hybrid handler (FAQ/SOP/Product/Mood)
            const hybridResponse = await handleUserMessage(message, sender);
            if (hybridResponse) {
                // Learn from successful hybrid response for future
                await this.learnFromSuccessfulResponse(message, hybridResponse, 'hybrid_handler');
                
                return {
                    text: hybridResponse,
                    confidence: 0.9, // High confidence for existing data
                    source: 'hybrid_handler',
                    skipGemini: true // Don't fallback to Gemini
                };
            }

            // STEP 2: Try learned knowledge for new patterns
            const analysis = this.nlpProcessor.analyzeIntent(message);
            const response = await this.nlpProcessor.findResponse(analysis);
            
            if (response && response.confidence > 0.7) {
                // Only use learned response if high confidence
                return {
                    text: response.response,
                    confidence: response.confidence,
                    source: 'local_learning',
                    analysis: analysis
                };
            }

            // STEP 3: If no good response, try smart fallback for unknown cases
            if (this.smartFallback) {
                return await this.smartFallback.handleUnknownCase(message, sender, {
                    messageType: 'text',
                    fromLearningSystem: true
                });
            }

            return null; // No good local response, allow Gemini fallback

        } catch (error) {
            console.error('Error processing text message:', error);
            return null;
        }
    }

    async processImageMessage(message, imagePath, sender) {
        try {
            const imageAnalysis = await this.imageAnalyzer.analyzeImage(imagePath, {
                sender: sender,
                caption: message || ''
            });

            if (imageAnalysis.success) {
                // Learn from image pattern
                await this.learnImagePattern(imagePath, imageAnalysis, sender);

                return {
                    text: imageAnalysis.response,
                    confidence: imageAnalysis.analysis.confidence,
                    source: 'image_analysis',
                    analysis: imageAnalysis.analysis
                };
            }

            return null; // Fall back to Gemini

        } catch (error) {
            console.error('Error processing image message:', error);
            return null;
        }
    }

    // Check if owner is teaching the bot - MORE FLEXIBLE
    isOwnerTeaching(message, sender) {
        const ownerNumber = config.owner_number;
        const senderNumber = sender.split('@')[0];
        
        if (senderNumber !== ownerNumber) return false;

        // Natural teaching patterns - MUCH MORE FLEXIBLE
        const teachingPatterns = [
            'ajari bot', 'ajarin bot', 'teach bot', 'bot learn', 'ingat ini', 'remember',
            'jawaban untuk', 'responnya', 'bilang aja', 'katakan', 'bales dengan',
            'jangan nanya balik', 'jangan tanya balik', 'langsung jawab',
            'responmu jangan', 'jawab langsung', 'bilang begini',
            'kalo ada yang nanya', 'kalau ditanya', 'saat ditanya'
        ];

        return teachingPatterns.some(pattern => 
            message.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    async handleOwnerTeaching(message, sender) {
        try {
            // Update stats
            this.learningStats.totalInputs++;
            this.learningStats.learningAttempts++;

            // Parse teaching command
            const teachingData = this.parseTeachingCommand(message);
            
            if (teachingData) {
                // SAFETY CHECK: Validate teaching content with SafetyGuard
                const safetyValidation = await this.safetyGuard.validateUserTeaching(
                    sender,
                    teachingData.input,
                    teachingData.response,
                    { teachingMethod: teachingData.method }
                );

                if (!safetyValidation.canLearn) {
                    this.learningStats.blockedInputs++;
                    
                    let blockMessage = `🛡️ Pembelajaran ditolak untuk keamanan bisnis.\n\n`;
                    blockMessage += `Alasan: ${safetyValidation.reason}\n\n`;
                    
                    if (safetyValidation.issues.length > 0) {
                        blockMessage += `Issues:\n`;
                        safetyValidation.issues.forEach(issue => {
                            blockMessage += `• ${issue.message}\n`;
                        });
                    }
                    
                    blockMessage += `\nBot hanya menerima pembelajaran yang aman dan sesuai business rules Vylozzone.`;

                    return {
                        text: blockMessage,
                        confidence: 1.0,
                        source: 'safety_blocked'
                    };
                }

                // If safe, proceed with learning
                await this.nlpProcessor.learnFromOwner(
                    teachingData.input,
                    teachingData.response,
                    { 
                        teachingMethod: teachingData.method,
                        safetyScore: safetyValidation.confidence,
                        safetyValidated: true
                    }
                );

                this.learningStats.safeInputs++;
                this.learningStats.successfulLearning++;

                return {
                    text: `✅ Berhasil dipelajari dengan aman!\n\n` +
                          `Input: "${teachingData.input}"\n` +
                          `Response: "${teachingData.response}"\n` +
                          `Safety Score: ${(safetyValidation.confidence * 100).toFixed(1)}%\n\n` +
                          `Bot akan mengingat ini untuk kedepannya.`,
                    confidence: safetyValidation.confidence,
                    source: 'owner_teaching_safe'
                };
            } else {
                return {
                    text: `❌ Format teaching tidak valid.\n\n` +
                          `Contoh yang aman:\n` +
                          `• "ajari bot: halo -> Halo! Ada yang bisa saya bantu?"\n` +
                          `• "ingat ini: cara bayar -> Pembayaran bisa via QRIS, Dana, OVO"\n` +
                          `• "kalo ada yang nanya garansi, bilang sesuai ketentuan produk masing-masing"\n\n` +
                          `⚠️ Hindari:\n` +
                          `• Info garansi/harga yang salah\n` +
                          `• Menyebut kompetitor\n` +
                          `• Bahasa tidak profesional`,
                    confidence: 1.0,
                    source: 'teaching_help'
                };
            }

        } catch (error) {
            console.error('Error handling owner teaching:', error);
            return {
                text: '❌ Terjadi kesalahan saat validasi pembelajaran. Mohon coba lagi.',
                confidence: 1.0,
                source: 'teaching_error'
            };
        }
    }

    parseTeachingCommand(message) {
        // NATURAL parsing - support many flexible formats
        const lower = message.toLowerCase();
        
        // Try different natural patterns
        const patterns = [
            // Standard patterns
            /ajari bot:?\s*(.+?)\s*[->=→]\s*(.+)/i,
            /ajarin bot:?\s*(.+?)\s*[->=→]\s*(.+)/i,
            /teach bot:?\s*(.+?)\s*[->=→]\s*(.+)/i,
            /ingat ini:?\s*(.+?)\s*[->=→]\s*(.+)/i,
            /remember:?\s*(.+?)\s*[->=→]\s*(.+)/i,
            
            // Natural language patterns
            /jawaban untuk\s*["']?(.+?)["']?\s*(adalah|ya|itu)\s*["']?(.+?)["']?$/i,
            /kalo ada yang nanya\s*["']?(.+?)["']?\s*,?\s*(bilang|jawab|respon|katakan)\s*["']?(.+?)["']?$/i,
            /kalau ditanya\s*["']?(.+?)["']?\s*,?\s*(bilang|jawab|respon|katakan)\s*["']?(.+?)["']?$/i,
            /saat ditanya\s*["']?(.+?)["']?\s*,?\s*(bilang|jawab|respon|katakan)\s*["']?(.+?)["']?$/i,
            
            // Direct command patterns
            /jangan nanya balik\s*["']?(.+?)["']?\s*,?\s*(langsung|bilang|jawab)\s*["']?(.+?)["']?$/i,
            /responmu jangan\s*["']?(.+?)["']?\s*,?\s*(tapi|bilang)\s*["']?(.+?)["']?$/i,
            /langsung jawab\s*["']?(.+?)["']?\s*dengan\s*["']?(.+?)["']?$/i,
            /bilang aja\s*["']?(.+?)["']?\s*untuk\s*["']?(.+?)["']?$/i,
            
            // Response correction patterns
            /responnya\s*["']?(.+?)["']?\s*(harusnya|seharusnya|ganti jadi)\s*["']?(.+?)["']?$/i,
            /bales dengan\s*["']?(.+?)["']?\s*untuk\s*["']?(.+?)["']?$/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                let input, response;
                
                // Handle different capture group patterns
                if (match.length === 3) {
                    input = match[1].trim();
                    response = match[2].trim();
                } else if (match.length === 4) {
                    // For patterns with middle word (adalah, bilang, etc)
                    input = match[1].trim();
                    response = match[3].trim();
                } else if (match.length === 5) {
                    // For complex patterns
                    input = match[1].trim();
                    response = match[4].trim();
                }
                
                // Clean up quotes and extra spaces
                if (input && response) {
                    input = input.replace(/^["']|["']$/g, '').trim();
                    response = response.replace(/^["']|["']$/g, '').trim();
                    
                    return {
                        input: input,
                        response: response,
                        method: 'natural_teaching',
                        originalMessage: message
                    };
                }
            }
        }

        return null;
    }

    async learnFromSuccessfulResponse(input, response, source) {
        try {
            // Learn from successful FAQ/SOP/Product responses
            const learningData = {
                id: Date.now(),
                input: input,
                response: response,
                source: source,
                timestamp: new Date().toISOString(),
                confidence: 0.8, // High confidence for existing system responses
                verified: true
            };

            this.nlpProcessor.knowledgeBase.push(learningData);
            await this.nlpProcessor.saveKnowledgeBase();
            
            console.log(`📚 Learned from ${source}: "${input}"`);
        } catch (error) {
            console.error('Error learning from successful response:', error);
        }
    }

    async learnImagePattern(imagePath, analysis, sender) {
        try {
            // Learn common image patterns
            const pattern = {
                id: Date.now(),
                sender: sender,
                imagePath: imagePath,
                analysis: analysis,
                timestamp: new Date().toISOString()
            };

            // Save to learning data
            const imagePatterns = await loadJson('../learning/image_patterns.json') || [];
            imagePatterns.push(pattern);
            
            // Keep only last 50 patterns
            if (imagePatterns.length > 50) {
                imagePatterns.splice(0, imagePatterns.length - 50);
            }
            
            await saveJson('../learning/image_patterns.json', imagePatterns);

        } catch (error) {
            console.error('Error learning image pattern:', error);
        }
    }

    async saveConversation(sender, message, response, messageType) {
        try {
            const conversation = {
                id: Date.now(),
                sender: sender,
                message: message,
                messageType: messageType,
                response: response,
                timestamp: new Date().toISOString()
            };

            const conversations = await loadJson('../learning/conversations.json') || [];
            conversations.push(conversation);
            
            // Keep only last 1000 conversations
            if (conversations.length > 1000) {
                conversations.splice(0, conversations.length - 1000);
            }
            
            await saveJson('../learning/conversations.json', conversations);

        } catch (error) {
            console.error('Error saving conversation:', error);
        }
    }

    // Get learning statistics
    async getStats() {
        try {
            const nlpStats = this.nlpProcessor.getStats();
            const imageStats = this.imageAnalyzer.getImageStats();
            const conversations = await loadJson('../learning/conversations.json') || [];
            
            return {
                nlp: nlpStats,
                images: imageStats,
                conversations: conversations.length,
                initialized: this.isInitialized,
                learningMode: this.learningMode,
                lastActivity: conversations.length > 0 ? 
                    conversations[conversations.length - 1].timestamp : null
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            return { error: error.message };
        }
    }

    // Owner commands for managing learning
    async handleLearningCommand(command, sender) {
        const ownerNumber = config.owner_number;
        const senderNumber = sender.split('@')[0];
        
        if (senderNumber !== ownerNumber) {
            return 'Perintah ini hanya bisa digunakan oleh owner.';
        }

        const lowerCommand = command.toLowerCase().trim();

        // Check smart fallback commands first
        if (this.smartFallback) {
            const fallbackResponse = await this.smartFallback.handleOwnerReview(command, sender);
            if (fallbackResponse) {
                return fallbackResponse;
            }
        }

        if (lowerCommand === 'learning stats' || lowerCommand === 'bot stats') {
            const stats = await this.getStats();
            const fallbackStats = this.smartFallback ? this.smartFallback.getStats() : {};
            
            return `📊 *LEARNING STATISTICS*\n\n` +
                   `🧠 *Knowledge Base:* ${stats.nlp?.knowledgeBase || 0} entries\n` +
                   `🎯 *Patterns:* ${stats.nlp?.patterns || 0} patterns\n` +
                   `💬 *Conversations:* ${stats.conversations || 0} logged\n` +
                   `📸 *Image Analyses:* ${stats.images?.totalAnalyses || 0}\n` +
                   `🤔 *Unknown Cases:* ${fallbackStats.totalUnknownCases || 0}\n` +
                   `📚 *Learned Cases:* ${fallbackStats.learnedCases || 0}\n` +
                   `⏳ *Learning Queue:* ${fallbackStats.queuedForLearning || 0}\n` +
                   `📈 *Learning Rate:* ${fallbackStats.learningRate || '0%'}\n` +
                   `🔄 *Status:* ${stats.initialized ? '✅ Ready' : '❌ Loading'}\n` +
                   `📅 *Last Activity:* ${stats.lastActivity ? new Date(stats.lastActivity).toLocaleString('id-ID') : 'None'}`;
        }

        if (lowerCommand === 'reset learning' || lowerCommand === 'clear memory') {
            await this.nlpProcessor.resetLearningData();
            return '🧠 Learning data telah direset. Bot memulai dari awal.';
        }

        if (lowerCommand === 'learning help' || lowerCommand === 'teach help') {
            return `🎓 *CARA MENGAJARI BOT*\n\n` +
                   `📝 *Format Teaching (Natural):*\n` +
                   `• "jangan nanya balik saat ada yang tanya cara bayar, bilang pembayaran via QRIS, Dana, OVO"\n` +
                   `• "kalo ada yang nanya error, katakan kirim screenshot dan nomor order"\n` +
                   `• "saat ditanya harga netflix, bilang mulai dari 20rb per bulan"\n\n` +
                   `📊 *Commands:*\n` +
                   `• learning stats - Statistik pembelajaran\n` +
                   `• review queue - Lihat antrian pembelajaran\n` +
                   `• unknown cases - Lihat kasus tidak dikenal\n` +
                   `• auto learn - Proses otomatis confidence tinggi\n` +
                   `• approve [id] - Setujui pembelajaran\n` +
                   `• reject [id] - Tolak pembelajaran\n\n` +
                   `💡 *Smart Learning:* Bot otomatis belajar dari Gemini response yang berkualitas dan filter template responses.`;
        }

        return null; // Not a learning command
    }

    // Check if bot can handle this locally (without Gemini)
    canHandleLocally(message, messageType = 'text') {
        if (!this.isInitialized) return false;
        
        // Always try to handle owner teaching locally
        if (this.isOwnerTeaching(message, '')) return true;
        
        // Can handle if we have learned patterns for this type of message
        return this.nlpProcessor.knowledgeBase.length > 10; // Minimum threshold
    }
}

// Create singleton instance
const learningManager = new LearningManager();

module.exports = { LearningManager, learningManager };
