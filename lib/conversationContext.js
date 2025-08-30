/**
 * SMART CONVERSATION CONTEXT
 * Remember customer interactions dan provide contextual responses
 * 
 * Features:
 * - Track customer conversation history
 * - Remember products yang ditanyakan
 * - Context-aware responses
 * - Smart follow-up suggestions
 * - Customer preference learning
 */

const { loadJson, saveJson } = require('./dataLoader');
const moment = require('moment-timezone');

class ConversationContext {
    constructor() {
        this.customerSessions = new Map(); // In-memory untuk session aktif
        this.customerProfiles = new Map(); // Long-term customer data
        this.loadCustomerProfiles();
        
        // Context categories
        this.contextTypes = {
            PRODUCT_INQUIRY: 'product_inquiry',
            PRICE_CHECK: 'price_check', 
            GARANSI_QUESTION: 'garansi_question',
            PROBLEM_REPORT: 'problem_report',
            ORDER_INTENT: 'order_intent',
            GENERAL_CHAT: 'general_chat'
        };
        
        // Session timeout (30 menit)
        this.sessionTimeout = 30 * 60 * 1000;
        
        // Cleanup expired sessions every 10 minutes
        setInterval(() => this.cleanupExpiredSessions(), 10 * 60 * 1000);
    }

    /**
     * TRACK CUSTOMER INTERACTION
     */
    async trackInteraction(customerNumber, message, response, context = {}) {
        try {
            const now = moment.tz('Asia/Jakarta');
            const sessionKey = customerNumber.split('@')[0];
            
            // Get or create session
            let session = this.customerSessions.get(sessionKey) || {
                customerNumber: sessionKey,
                startTime: now.toISOString(),
                lastActivity: now.toISOString(),
                interactions: [],
                currentContext: null,
                interestedProducts: [],
                customerMood: 'neutral',
                orderIntent: false
            };
            
            // Analyze interaction
            const interactionAnalysis = this.analyzeInteraction(message, response, context);
            
            // Update session
            session.lastActivity = now.toISOString();
            session.interactions.push({
                timestamp: now.toISOString(),
                message: message,
                response: response,
                analysis: interactionAnalysis
            });
            
            // Update context
            if (interactionAnalysis.contextType) {
                session.currentContext = interactionAnalysis.contextType;
            }
            
            // Track interested products
            if (interactionAnalysis.products && interactionAnalysis.products.length > 0) {
                for (const product of interactionAnalysis.products) {
                    if (!session.interestedProducts.includes(product)) {
                        session.interestedProducts.push(product);
                    }
                }
            }
            
            // Update mood
            if (interactionAnalysis.mood && interactionAnalysis.mood !== 'neutral') {
                session.customerMood = interactionAnalysis.mood;
            }
            
            // Detect order intent
            if (interactionAnalysis.hasOrderIntent) {
                session.orderIntent = true;
            }
            
            // Keep only last 10 interactions per session
            if (session.interactions.length > 10) {
                session.interactions = session.interactions.slice(-10);
            }
            
            // Save session
            this.customerSessions.set(sessionKey, session);
            
            // Update long-term profile
            await this.updateCustomerProfile(sessionKey, session);
            
            return session;
            
        } catch (error) {
            console.error('Error tracking interaction:', error);
            return null;
        }
    }

    /**
     * ANALYZE INTERACTION CONTENT
     */
    analyzeInteraction(message, response, context) {
        const lowerMessage = message.toLowerCase();
        const analysis = {
            contextType: null,
            products: [],
            mood: 'neutral',
            hasOrderIntent: false,
            topics: []
        };
        
        // Detect context type
        if (lowerMessage.includes('harga') || lowerMessage.includes('berapa')) {
            analysis.contextType = this.contextTypes.PRICE_CHECK;
        } else if (lowerMessage.includes('garansi') || lowerMessage.includes('warranty')) {
            analysis.contextType = this.contextTypes.GARANSI_QUESTION;
        } else if (lowerMessage.includes('error') || lowerMessage.includes('masalah') || lowerMessage.includes('tidak bisa')) {
            analysis.contextType = this.contextTypes.PROBLEM_REPORT;
        } else if (lowerMessage.includes('mau') || lowerMessage.includes('order') || lowerMessage.includes('beli')) {
            analysis.contextType = this.contextTypes.ORDER_INTENT;
            analysis.hasOrderIntent = true;
        } else if (lowerMessage.includes('info') || lowerMessage.includes('detail') || lowerMessage.includes('fitur')) {
            analysis.contextType = this.contextTypes.PRODUCT_INQUIRY;
        } else {
            analysis.contextType = this.contextTypes.GENERAL_CHAT;
        }
        
        // Extract mentioned products
        const productKeywords = [
            'netflix', 'disney', 'youtube', 'iqiyi', 'viu', 'wetv', 'vision+', 'vidio', 
            'prime', 'hbo', 'bstation', 'alightmotion', 'chatgpt', 'capcut'
        ];
        
        analysis.products = productKeywords.filter(product => lowerMessage.includes(product));
        
        // Detect mood
        if (lowerMessage.includes('marah') || lowerMessage.includes('kesel') || lowerMessage.includes('lama banget')) {
            analysis.mood = 'angry';
        } else if (lowerMessage.includes('makasih') || lowerMessage.includes('bagus') || lowerMessage.includes('mantap')) {
            analysis.mood = 'positive';
        } else if (lowerMessage.includes('bingung') || lowerMessage.includes('tidak paham')) {
            analysis.mood = 'confused';
        }
        
        return analysis;
    }

    /**
     * GET CONTEXTUAL RESPONSE
     */
    async getContextualResponse(customerNumber, message) {
        try {
            const sessionKey = customerNumber.split('@')[0];
            const session = this.customerSessions.get(sessionKey);
            
            if (!session) {
                return null; // No context available
            }
            
            const lowerMessage = message.toLowerCase();
            
            // Context-aware responses
            
            // 1. Returning customer dengan interested products
            if (session.interestedProducts.length > 0) {
                const lastProduct = session.interestedProducts[session.interestedProducts.length - 1];
                
                if (lowerMessage.includes('halo') || lowerMessage.includes('hai')) {
                    return `Halo lagi! 😊 Kak yang kemarin tanya tentang ${lastProduct} ya? Ada yang mau ditanyakan lagi atau mau lihat produk lain?`;
                }
                
                if (lowerMessage.includes('info') && !session.interestedProducts.some(p => lowerMessage.includes(p))) {
                    return `Info produk yang mana, Kak? Kemarin kan udah lihat ${session.interestedProducts.join(', ')}. Mau lanjut yang itu atau cari yang lain? 😊`;
                }
            }
            
            // 2. Customer dengan order intent sebelumnya
            if (session.orderIntent && (lowerMessage.includes('halo') || lowerMessage.includes('hai'))) {
                return `Halo! 😊 Kemarin kayaknya udah tertarik mau order ya? Ada yang mau ditanyakan lagi atau siap lanjut ke admin untuk proses pembayaran?`;
            }
            
            // 3. Customer dengan mood history
            if (session.customerMood === 'angry' && lowerMessage.includes('halo')) {
                return `Halo, Kak! 😊 Semoga masalah kemarin sudah teratasi ya? Ada yang bisa saya bantu hari ini?`;
            }
            
            // 4. Frequent customer
            if (session.interactions.length >= 5) {
                if (lowerMessage.includes('halo') || lowerMessage.includes('hai')) {
                    return `Halo lagi, Kak! 😊 Udah langganan nih chat sama saya hehe. Ada yang bisa dibantu hari ini?`;
                }
            }
            
            return null; // No specific context response
            
        } catch (error) {
            console.error('Error getting contextual response:', error);
            return null;
        }
    }

    /**
     * UPDATE CUSTOMER PROFILE (Long-term)
     */
    async updateCustomerProfile(customerNumber, session) {
        try {
            let profile = this.customerProfiles.get(customerNumber) || {
                customerNumber: customerNumber,
                firstSeen: session.startTime,
                totalInteractions: 0,
                favoriteProducts: {},
                commonQuestions: {},
                averageMood: 'neutral',
                orderHistory: [],
                lastSeen: null
            };
            
            // Update stats
            profile.totalInteractions += session.interactions.length;
            profile.lastSeen = session.lastActivity;
            
            // Update favorite products
            for (const product of session.interestedProducts) {
                profile.favoriteProducts[product] = (profile.favoriteProducts[product] || 0) + 1;
            }
            
            // Update common question types
            for (const interaction of session.interactions) {
                const contextType = interaction.analysis?.contextType;
                if (contextType) {
                    profile.commonQuestions[contextType] = (profile.commonQuestions[contextType] || 0) + 1;
                }
            }
            
            this.customerProfiles.set(customerNumber, profile);
            
            // Save to persistent storage (every 10 interactions)
            if (profile.totalInteractions % 10 === 0) {
                await this.saveCustomerProfiles();
            }
            
        } catch (error) {
            console.error('Error updating customer profile:', error);
        }
    }

    /**
     * GET CUSTOMER INSIGHTS for admin
     */
    getCustomerInsights(customerNumber) {
        const sessionKey = customerNumber.split('@')[0];
        const session = this.customerSessions.get(sessionKey);
        const profile = this.customerProfiles.get(sessionKey);
        
        if (!session && !profile) {
            return { type: 'new_customer', insights: [] };
        }
        
        const insights = [];
        
        // Session insights
        if (session) {
            if (session.orderIntent) {
                insights.push('🎯 Customer shows order intent');
            }
            if (session.interestedProducts.length > 0) {
                insights.push(`📱 Interested in: ${session.interestedProducts.join(', ')}`);
            }
            if (session.customerMood !== 'neutral') {
                insights.push(`😊 Mood: ${session.customerMood}`);
            }
            if (session.interactions.length >= 5) {
                insights.push('💬 Active conversation (5+ messages)');
            }
        }
        
        // Profile insights
        if (profile) {
            if (profile.totalInteractions > 20) {
                insights.push('⭐ Frequent customer');
            }
            
            const topProduct = Object.keys(profile.favoriteProducts).reduce((a, b) => 
                profile.favoriteProducts[a] > profile.favoriteProducts[b] ? a : b, null);
            
            if (topProduct) {
                insights.push(`🔥 Most interested: ${topProduct}`);
            }
            
            const daysSinceFirst = moment().diff(moment(profile.firstSeen), 'days');
            if (daysSinceFirst > 30) {
                insights.push(`📅 Customer since ${daysSinceFirst} days ago`);
            }
        }
        
        return {
            type: profile ? 'returning_customer' : 'active_session',
            insights: insights,
            session: session,
            profile: profile
        };
    }

    /**
     * DATA PERSISTENCE
     */
    async loadCustomerProfiles() {
        try {
            const profiles = await loadJson('customer_profiles.json') || {};
            this.customerProfiles = new Map(Object.entries(profiles));
            console.log(`📊 Loaded ${this.customerProfiles.size} customer profiles`);
        } catch (error) {
            console.warn('Error loading customer profiles:', error);
            this.customerProfiles = new Map();
        }
    }

    async saveCustomerProfiles() {
        try {
            const profilesObj = Object.fromEntries(this.customerProfiles);
            await saveJson('customer_profiles.json', profilesObj);
            console.log(`💾 Saved ${this.customerProfiles.size} customer profiles`);
        } catch (error) {
            console.error('Error saving customer profiles:', error);
        }
    }

    /**
     * SESSION MANAGEMENT
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, session] of this.customerSessions.entries()) {
            const lastActivity = new Date(session.lastActivity).getTime();
            if (now - lastActivity > this.sessionTimeout) {
                this.customerSessions.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} expired conversation sessions`);
        }
    }

    /**
     * GET ANALYTICS DATA
     */
    getAnalytics() {
        const analytics = {
            activeSessions: this.customerSessions.size,
            totalProfiles: this.customerProfiles.size,
            topProducts: {},
            commonContexts: {},
            moodDistribution: {},
            averageInteractionsPerCustomer: 0
        };
        
        // Analyze active sessions
        for (const session of this.customerSessions.values()) {
            // Count products
            for (const product of session.interestedProducts) {
                analytics.topProducts[product] = (analytics.topProducts[product] || 0) + 1;
            }
            
            // Count contexts
            if (session.currentContext) {
                analytics.commonContexts[session.currentContext] = (analytics.commonContexts[session.currentContext] || 0) + 1;
            }
            
            // Count moods
            analytics.moodDistribution[session.customerMood] = (analytics.moodDistribution[session.customerMood] || 0) + 1;
        }
        
        // Calculate averages
        if (this.customerProfiles.size > 0) {
            const totalInteractions = Array.from(this.customerProfiles.values())
                .reduce((sum, profile) => sum + profile.totalInteractions, 0);
            analytics.averageInteractionsPerCustomer = Math.round(totalInteractions / this.customerProfiles.size);
        }
        
        return analytics;
    }

    /**
     * GENERATE BUSINESS ALERTS
     */
    generateBusinessAlerts() {
        const alerts = [];
        const analytics = this.getAnalytics();
        
        // High demand alert
        for (const [product, count] of Object.entries(analytics.topProducts)) {
            if (count >= 5) { // 5+ customers tanya produk yang sama
                alerts.push({
                    type: 'HIGH_DEMAND',
                    severity: 'INFO',
                    message: `🔥 ${product.toUpperCase()} demand tinggi! ${count} customers tanya hari ini`,
                    actionable: true,
                    suggestion: `Consider stock up atau promo ${product}`
                });
            }
        }
        
        // Customer mood alert
        const angryCustomers = analytics.moodDistribution.angry || 0;
        if (angryCustomers >= 3) {
            alerts.push({
                type: 'CUSTOMER_MOOD',
                severity: 'WARNING', 
                message: `⚠️ ${angryCustomers} customers dengan mood angry hari ini`,
                actionable: true,
                suggestion: 'Review customer service quality atau ada issue sistemik?'
            });
        }
        
        // High activity alert
        if (analytics.activeSessions >= 10) {
            alerts.push({
                type: 'HIGH_ACTIVITY',
                severity: 'INFO',
                message: `📈 Traffic tinggi! ${analytics.activeSessions} active conversations`,
                actionable: true,
                suggestion: 'Pastikan admin siap handle increased volume'
            });
        }
        
        return alerts;
    }
}

// Create singleton instance
const conversationContext = new ConversationContext();

module.exports = { ConversationContext, conversationContext };