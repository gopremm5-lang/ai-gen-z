/**
 * UNIFIED RESPONSE ROUTER
 * 
 * Single entry point untuk semua response processing
 * Eliminates redundancies dan provides clear priority hierarchy
 */

const { handleUserMessage } = require('./hybridHandler');
const { learningManager } = require('./learningManager');
const { GEMINI_TEXT } = require('./gemini');
const { botLaws } = require('./botLaws');
const { imageHandler } = require('./imageHandler');
const { analyticsManager } = require('./analyticsManager');
const { performanceManager } = require('./performanceManager');
const { securityManager } = require('./securityManager');
const { monitoringManager } = require('./monitoringManager');
const { cleanupManager } = require('./cleanupManager');
const { backupManager } = require('./backupManager');
const CONSTANTS = require('./constants');

class ResponseRouter {
    constructor() {
        this.routingStats = {
            totalRequests: 0,
            routedTo: {
                imageHandler: 0,
                lawCommands: 0,
                learningCommands: 0,
                adminCommands: 0,
                hybridHandler: 0,
                learningSystem: 0,
                geminiFallback: 0,
                safetyBlocked: 0
            },
            avgResponseTime: 0,
            lastActivity: null
        };
        
        this.responseCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * MAIN ROUTING FUNCTION
     * Central point for all message processing
     */
    async routeMessage(input, sender, remoteJid, message, messageType, pushName, isQuoted, sock) {
        const startTime = Date.now();
        this.routingStats.totalRequests++;
        this.routingStats.lastActivity = new Date().toISOString();

        try {
            // STEP 1: Quick validations and preprocessing
            const preprocessResult = await this.preprocessMessage(input, sender, messageType);
            if (preprocessResult.handled) {
                this.updateStats('preprocessing', startTime);
                return preprocessResult.response;
            }

            // STEP 2: Check cache for recent similar queries
            const cacheKey = this.generateCacheKey(input, sender);
            const cachedResponse = this.getCachedResponse(cacheKey);
            if (cachedResponse) {
                console.log('📋 Using cached response');
                return await sock.sendMessage(remoteJid, { text: cachedResponse }, { quoted: message });
            }

            // STEP 3: Route to appropriate handler
            const routingResult = await this.determineRoute(input, sender, messageType, message);
            
            // STEP 4: Process through selected route
            const response = await this.processRoute(routingResult, {
                input, sender, remoteJid, message, messageType, pushName, isQuoted, sock
            });

            // STEP 5: Post-processing and safety checks
            const finalResponse = await this.postProcessResponse(response, input, sender, routingResult.route);

            // STEP 6: Cache response if appropriate
            if (finalResponse.cacheable) {
                this.cacheResponse(cacheKey, finalResponse.text);
            }

            // STEP 7: Track analytics and send response
            this.updateStats(routingResult.route, startTime);
            analyticsManager.trackMessageProcessing(startTime, routingResult.route, true, sender, input);
            analyticsManager.trackMarketingMetrics(input, 'whatsapp');
            
            return await sock.sendMessage(remoteJid, { text: finalResponse.text }, { quoted: message });

        } catch (error) {
            console.error('Error in response router:', error);
            
            // Track error analytics
            this.updateStats('error', startTime);
            analyticsManager.trackMessageProcessing(startTime, 'error', false, sender, input);
            
            // Emergency safe response
            const safeResponse = "Maaf, terjadi kesalahan sistem. Mohon coba lagi atau hubungi admin untuk bantuan.";
            return await sock.sendMessage(remoteJid, { text: safeResponse }, { quoted: message });
        }
    }

    /**
     * PREPROCESSING - Handle quick cases
     */
    async preprocessMessage(input, sender, messageType) {
        // Handle empty or invalid input
        if (!input || input.trim().length === 0) {
            return {
                handled: true,
                response: "Mohon kirim pesan yang valid ya, Kak 😊"
            };
        }

        // Handle very short inputs (likely typos or accidents)
        if (input.trim().length < 2) {
            return {
                handled: true,
                response: "Bisa dijelaskan lebih lengkap, Kak? 😊"
            };
        }

        return { handled: false };
    }

    /**
     * ROUTE DETERMINATION - Decide which handler to use
     */
    async determineRoute(input, sender, messageType, message) {
        const lowerInput = input.toLowerCase().trim();

        // Priority 1: Image messages
        if (messageType === 'imageMessage') {
            return { route: 'imageHandler', priority: 1, confidence: 1.0 };
        }

        // Priority 2: Bot laws commands (owner only)
        if (this.isOwnerCommand(sender, lowerInput, ['law status', 'violation log', 'emergency stop', 'emergency resume'])) {
            return { route: 'lawCommands', priority: 2, confidence: 1.0 };
        }

        // Priority 3: Analytics commands (owner only)
        if (this.isAnalyticsCommand(sender, lowerInput)) {
            return { route: 'analyticsCommands', priority: 3, confidence: 1.0 };
        }

        // Priority 4: Learning management commands
        if (this.isLearningCommand(lowerInput)) {
            return { route: 'learningCommands', priority: 4, confidence: 1.0 };
        }

        // Priority 4: Admin commands
        if (await this.isAdminCommand(sender, lowerInput)) {
            return { route: 'adminCommands', priority: 4, confidence: 1.0 };
        }

        // Priority 5: Basic system commands
        if (this.isSystemCommand(lowerInput)) {
            return { route: 'systemCommands', priority: 5, confidence: 1.0 };
        }

        // Priority 6: Hybrid handler (FAQ/SOP/Product/Mood) - PRIORITAS TINGGI untuk produk
        const hybridConfidence = await this.assessHybridConfidence(input, sender);
        if (hybridConfidence > 0.3) { // Turunkan threshold untuk menangkap lebih banyak query produk
            return { route: 'hybridHandler', priority: 6, confidence: hybridConfidence };
        }

        // Priority 7: Learning system (for learned patterns)
        const learningConfidence = await this.assessLearningConfidence(input, sender);
        if (learningConfidence > 0.6) {
            return { route: 'learningSystem', priority: 7, confidence: learningConfidence };
        }

        // Priority 8: Gemini fallback - HANYA jika tidak ada yang cocok
        return { route: 'geminiFallback', priority: 8, confidence: 0.3 };
    }

    /**
     * ROUTE PROCESSING - Execute the selected route
     */
    async processRoute(routingResult, context) {
        const { input, sender, remoteJid, message, messageType, pushName, isQuoted, sock } = context;

        switch (routingResult.route) {
            case 'imageHandler':
                this.routingStats.routedTo.imageHandler++;
                return await this.handleImageRoute(message, sock, sender, remoteJid, pushName);

            case 'lawCommands':
                this.routingStats.routedTo.lawCommands++;
                return await this.handleLawCommands(input, sender);

            case 'analyticsCommands':
                this.routingStats.routedTo.analyticsCommands = (this.routingStats.routedTo.analyticsCommands || 0) + 1;
                return await this.handleAnalyticsCommands(input, sender);

            case 'learningCommands':
                this.routingStats.routedTo.learningCommands++;
                return await this.handleLearningCommands(input, sender);

            case 'adminCommands':
                this.routingStats.routedTo.adminCommands++;
                return await this.handleAdminCommands(input, sock, sender, remoteJid, message);

            case 'systemCommands':
                return await this.handleSystemCommands(input, sender);

            case 'hybridHandler':
                this.routingStats.routedTo.hybridHandler++;
                return await this.handleHybridRoute(input, sender);

            case 'learningSystem':
                this.routingStats.routedTo.learningSystem++;
                return await this.handleLearningRoute(input, sender, messageType);

            case 'geminiFallback':
                this.routingStats.routedTo.geminiFallback++;
                return await this.handleGeminiRoute(input, sender);

            default:
                throw new Error(`Unknown route: ${routingResult.route}`);
        }
    }

    /**
     * ROUTE HANDLERS
     */
    async handleImageRoute(message, sock, sender, remoteJid, pushName) {
        const result = await imageHandler.handleImageMessage(message, sock, sender, remoteJid, pushName);
        return {
            text: result,
            source: 'imageHandler',
            confidence: 0.9,
            cacheable: false
        };
    }

    async handleLawCommands(input, sender) {
        const result = botLaws.handleOwnerLawCommand(input, sender);
        return {
            text: result,
            source: 'lawCommands',
            confidence: 1.0,
            cacheable: false
        };
    }

    async handleAnalyticsCommands(input, sender) {
        // Try analytics manager first
        let result = analyticsManager.handleOwnerAnalyticsCommand(input, sender);
        if (result) {
            return {
                text: result,
                source: 'analyticsCommands',
                confidence: 1.0,
                cacheable: false
            };
        }
        
        // Try other command handlers
        result = performanceManager.handlePerformanceCommand(input, sender);
        if (result) return { text: result, source: 'performanceCommands', confidence: 1.0, cacheable: false };
        
        result = securityManager.handleSecurityCommand(input, sender);
        if (result) return { text: result, source: 'securityCommands', confidence: 1.0, cacheable: false };
        
        result = monitoringManager.handleMonitoringCommand(input, sender);
        if (result) return { text: result, source: 'monitoringCommands', confidence: 1.0, cacheable: false };
        
        result = cleanupManager.handleCleanupCommand(input, sender);
        if (result) return { text: result, source: 'cleanupCommands', confidence: 1.0, cacheable: false };
        
        result = backupManager.handleBackupCommand(input, sender);
        if (result) return { text: result, source: 'backupCommands', confidence: 1.0, cacheable: false };
        
        return {
            text: 'Analytics command tidak dikenali.',
            source: 'analyticsCommands',
            confidence: 1.0,
            cacheable: false
        };
    }

    async handleLearningCommands(input, sender) {
        const result = await learningManager.handleLearningCommand(input, sender);
        return {
            text: result,
            source: 'learningCommands',
            confidence: 1.0,
            cacheable: false
        };
    }

    async handleAdminCommands(input, sock, sender, remoteJid, message) {
        try {
            // Handle admin commands inline to avoid circular dependency
            const lowerContent = input.toLowerCase().trim();
            const args = input.split(' ');
            
            // Load admin functions dynamically with error handling
            let loadJson, saveJson, config;
            try {
                ({ loadJson, saveJson } = require('./dataLoader'));
                config = require('../config');
            } catch (requireError) {
                console.error('Error loading dependencies in handleAdminCommands:', requireError.message);
                return {
                    text: "Terjadi kesalahan sistem. Silakan coba lagi nanti.",
                    source: 'adminCommands',
                    confidence: 1.0,
                    cacheable: false
                };
            }
            
            const isOwner = (sender) => {
                try {
                    if (!sender || typeof sender !== 'string') return false;
                    const number = sender.split('@')[0];
                    return number === config.owner_number;
                } catch (error) {
                    console.error('Error in isOwner check:', error.message);
                    return false;
                }
            };
            
            const isModerator = async (sender) => {
                try {
                    if (!sender || typeof sender !== 'string') return false;
                    const moderators = await loadJson('moderators.json');
                    if (!Array.isArray(moderators)) return false;
                    const number = sender.split('@')[0];
                    return moderators.some(mod => mod && mod.number === number && mod.active);
                } catch (error) {
                    console.error('Error in isModerator check:', error.message);
                    return false;
                }
            };
            
            // Admin help command
            if (lowerContent === 'adminhelp' || lowerContent === 'adminmenu') {
                const adminMenu = `
🔧 *ADMIN COMMANDS*

📊 *Data Management:*
• addbuyer [user] [apk] [email] [durasi] [dateGiven] [exp] [invite]
• addclaim [user] [apk] [masalah] [replace/reset]

👥 *User Management:* ${isOwner(sender) ? `
• addmod [nomor] [nama]
• listmod
• delmod [nomor]` : ''}

📋 *Info Commands:*
• adminhelp - Menu ini

💡 *Contoh:*
• addbuyer John netflix john@email.com "1 bulan" 2024-01-15 2024-02-15 INV123
• addclaim Jane spotify "error login" replace
${isOwner(sender) ? '• addmod 628123456789 "Admin Sarah"' : ''}

📱 *APK yang tersedia:*
netflix, spotify, canva, capcut, disney, youtube, dll
                `;
                
                return {
                    text: adminMenu.trim(),
                    source: 'adminCommands',
                    confidence: 1.0,
                    cacheable: true
                };
            }
            
            // For other admin commands, return a basic response to avoid complexity
            if (lowerContent.startsWith('addbuyer') || lowerContent.startsWith('addclaim') || 
                lowerContent.startsWith('addmod') || lowerContent.startsWith('listmod') || 
                lowerContent.startsWith('delmod')) {
                
                return {
                    text: "Fitur admin command sedang dalam maintenance. Silakan gunakan web admin panel untuk management data.",
                    source: 'adminCommands',
                    confidence: 1.0,
                    cacheable: false
                };
            }
            
            return {
                text: "Command admin tidak dikenali. Ketik 'adminhelp' untuk melihat daftar command.",
                source: 'adminCommands',
                confidence: 1.0,
                cacheable: false
            };
            
        } catch (error) {
            console.error('Error in handleAdminCommands:', error.message);
            return {
                text: "Terjadi kesalahan dalam memproses command admin. Silakan coba lagi.",
                source: 'adminCommands',
                confidence: 1.0,
                cacheable: false
            };
        }
    }

    async handleSystemCommands(input, sender) {
        const lowerInput = input.toLowerCase().trim();
        const { getUser } = require('./users');
        const { displayMenu } = require('./utils');
        const config = require('../config');

        if (lowerInput === 'menu') {
            const menuText = await displayMenu(sender);
            return {
                text: menuText,
                source: 'systemCommands',
                confidence: 1.0,
                cacheable: true
            };
        }

        if (lowerInput === 'limit') {
            const user = getUser(sender);
            const { checkLimit } = require('./users');
            const userLimit = checkLimit(user);
            const limitText = userLimit ? `_Sisa limit harian Anda:_ ${userLimit}` : `_Admin: Unlimited_`;
            return {
                text: limitText,
                source: 'systemCommands',
                confidence: 1.0,
                cacheable: false
            };
        }

        // Greetings
        const greetings = ['halo', 'hai', 'p', 'bot', 'assalamualaikum', 'halo bot'];
        if (greetings.includes(lowerInput)) {
            const greetingResponses = [
                `Halo Kak! ${config.name_bot} siap bantu order APK atau SMM 😊`,
                `Hai Kak! Ada kendala di web order APK/SMM? Boleh tanya aja ya.`,
                `Selamat datang Kak! CS ${config.name_bot} siap bantu info & kendala Anda.`
            ];
            const greeting = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
            
            return {
                text: greeting,
                source: 'systemCommands',
                confidence: 1.0,
                cacheable: true
            };
        }

        return null;
    }

    async handleHybridRoute(input, sender) {
        const result = await handleUserMessage(input, sender);
        return {
            text: result,
            source: 'hybridHandler',
            confidence: 0.9,
            cacheable: true
        };
    }

    async handleLearningRoute(input, sender, messageType) {
        const result = await learningManager.processMessage(input, sender, messageType);
        return {
            text: result.text,
            source: 'learningSystem',
            confidence: result.confidence,
            cacheable: result.confidence > 0.8
        };
    }

    async handleGeminiRoute(input, sender) {
        const result = await GEMINI_TEXT(sender, input);
        return {
            text: result,
            source: 'geminiFallback',
            confidence: 0.3,
            cacheable: false
        };
    }

    /**
     * POST-PROCESSING - Final safety checks and improvements
     */
    async postProcessResponse(response, originalInput, sender, route) {
        if (!response || !response.text) {
            return {
                text: "Maaf, saya tidak dapat memberikan response yang sesuai. Mohon coba lagi.",
                source: 'error_fallback',
                confidence: 0.1,
                cacheable: false
            };
        }

        // SAFETY CHECK: Validate with Bot Laws
        const lawValidation = botLaws.validateAction('response', response.text, {
            originalQuestion: originalInput,
            source: response.source || route,
            sender: sender
        });

        if (!lawValidation.allowed) {
            console.error(`🚨 Response blocked by Bot Laws: ${lawValidation.blockReason}`);
            this.routingStats.routedTo.safetyBlocked++;
            
            return {
                text: "Maaf, saya perlu bantuan untuk menjawab pertanyaan ini dengan tepat. Mohon hubungi admin untuk bantuan lebih lanjut.",
                source: 'safety_blocked',
                confidence: 0.1,
                cacheable: false
            };
        }

        // Debug tracking removed for production use
        // Source tracking is now only in console logs

        return response;
    }

    /**
     * HELPER FUNCTIONS
     */
    isOwnerCommand(sender, input, commands) {
        const config = require('../config');
        const ownerNumber = config.owner_number;
        const senderNumber = sender.split('@')[0];
        
        return senderNumber === ownerNumber && commands.some(cmd => input.includes(cmd));
    }

    isAnalyticsCommand(sender, input) {
        const config = require('../config');
        const ownerNumber = config.owner_number;
        const senderNumber = sender.split('@')[0];
        
        if (senderNumber !== ownerNumber) return false;
        
        const analyticsCommands = [
            // Analytics
            'dashboard', 'stats', 'traffic', 'users', 'products', 'claims',
            'business', 'marketing', 'technical', 'reset analytics',
            
            // Performance
            'performance stats', 'performance optimize', 'cache clear',
            
            // Security
            'security status', 'security clear', 'unlock user',
            
            // Monitoring
            'monitoring status', 'monitoring alerts', 'monitoring report',
            'resolve alert',
            
            // Cleanup
            'cleanup status', 'cleanup run', 'cleanup memory',
            
            // Backup
            'backup status', 'backup create', 'backup incremental', 'backup verify'
        ];
        
        return analyticsCommands.some(cmd => input.includes(cmd));
    }

    isLearningCommand(input) {
        const learningCommands = [
            'learning stats', 'bot stats', 'reset learning', 'clear memory',
            'learning help', 'teach help', 'review queue', 'cek queue',
            'unknown cases', 'cases', 'auto learn', 'approve', 'reject'
        ];
        
        return learningCommands.some(cmd => input.includes(cmd));
    }

    async isAdminCommand(sender, input) {
        try {
            // Avoid circular dependency by implementing isAdmin logic directly
            const config = require('../config');
            const { loadJson } = require('./dataLoader');
            
            const isOwner = (sender) => {
                try {
                    if (!sender || typeof sender !== 'string') return false;
                    const number = sender.split('@')[0];
                    return number === config.owner_number;
                } catch (error) {
                    console.error('Error in isOwner check:', error.message);
                    return false;
                }
            };
            
            const isModerator = async (sender) => {
                try {
                    if (!sender || typeof sender !== 'string') return false;
                    const moderators = await loadJson('moderators.json');
                    if (!Array.isArray(moderators)) return false;
                    const number = sender.split('@')[0];
                    return moderators.some(mod => mod && mod.number === number && mod.active);
                } catch (error) {
                    console.error('Error in isModerator check:', error.message);
                    return false;
                }
            };
            
            const adminCommands = [
                'addbuyer', 'addclaim', 'addmod', 'listmod', 'delmod', 'adminhelp', 'adminmenu'
            ];
            
            const isUserAdmin = isOwner(sender) || await isModerator(sender);
            return isUserAdmin && adminCommands.some(cmd => input.startsWith(cmd));
        } catch (error) {
            console.error('Error in isAdminCommand:', error.message);
            return false;
        }
    }

    isSystemCommand(input) {
        const systemCommands = ['menu', 'limit', 'halo', 'hai', 'p', 'bot', 'assalamualaikum', 'halo bot'];
        return systemCommands.includes(input);
    }

    async assessHybridConfidence(input, sender) {
        const lowerInput = input.toLowerCase();
        let confidence = 0;
        
        // PRIORITAS TINGGI: Product names - jika ada nama produk, confidence langsung tinggi
        const productNames = [
            'netflix', 'spotify', 'disney', 'youtube', 'canva', 'capcut', 'chatgpt', 
            'prime', 'hbo', 'iqiyi', 'viu', 'wetv', 'vision', 'vidio', 'bstation',
            'alightmotion', 'remini', 'picsart'
        ];
        
        const productMatches = productNames.filter(product => lowerInput.includes(product));
        if (productMatches.length > 0) {
            confidence += 0.8; // Confidence tinggi untuk query produk
        }
        
        // PRIORITAS SEDANG: Product-related keywords
        const productKeywords = [
            'harga', 'price', 'berapa', 'biaya', 'paket', 'garansi', 'warranty',
            'info', 'detail', 'spek', 'fitur', 'ada', 'tersedia', 'ready', 'stock'
        ];
        
        const keywordMatches = productKeywords.filter(keyword => lowerInput.includes(keyword));
        if (keywordMatches.length > 0) {
            confidence += keywordMatches.length * 0.2;
        }
        
        // PRIORITAS RENDAH: General patterns
        const generalPatterns = [
            'promo', 'diskon', 'error', 'masalah', 'gagal', 'tidak bisa'
        ];
        
        const generalMatches = generalPatterns.filter(pattern => lowerInput.includes(pattern));
        if (generalMatches.length > 0) {
            confidence += generalMatches.length * 0.1;
        }
        
        // Cap confidence at 1.0
        return Math.min(confidence, 1.0);
    }

    async assessLearningConfidence(input, sender) {
        // Check if learning system has patterns for this input
        try {
            const analysis = learningManager.nlpProcessor.analyzeIntent(input);
            return analysis.confidence || 0;
        } catch {
            return 0;
        }
    }

    /**
     * CACHING FUNCTIONS
     */
    generateCacheKey(input, sender) {
        const normalizedInput = input.toLowerCase().trim();
        const senderHash = sender.split('@')[0].slice(-4); // Last 4 digits for privacy
        return `${normalizedInput}-${senderHash}`;
    }

    getCachedResponse(cacheKey) {
        const cached = this.responseCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            return cached.response;
        }
        if (cached) {
            this.responseCache.delete(cacheKey);
        }
        return null;
    }

    cacheResponse(cacheKey, response) {
        this.responseCache.set(cacheKey, {
            response: response,
            timestamp: Date.now()
        });
        
        // Clean old cache entries
        if (this.responseCache.size > 1000) {
            const oldestKey = this.responseCache.keys().next().value;
            this.responseCache.delete(oldestKey);
        }
    }

    /**
     * STATISTICS
     */
    updateStats(route, startTime) {
        const duration = Date.now() - startTime;
        const currentAvg = this.routingStats.avgResponseTime;
        const totalRequests = this.routingStats.totalRequests;
        
        // Update running average
        this.routingStats.avgResponseTime = (currentAvg * (totalRequests - 1) + duration) / totalRequests;
    }

    getStats() {
        return {
            ...this.routingStats,
            cacheSize: this.responseCache.size,
            uptime: Date.now() - (this.startTime || Date.now())
        };
    }

    clearCache() {
        this.responseCache.clear();
        console.log('🧹 Response cache cleared');
    }
}

// Export singleton instance
const responseRouter = new ResponseRouter();

module.exports = { ResponseRouter, responseRouter };
