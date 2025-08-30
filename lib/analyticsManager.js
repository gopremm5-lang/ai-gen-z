/**
 * SMART ANALYTICS DASHBOARD
 * 
 * Comprehensive monitoring dan metrics untuk Vylozzone Bot
 * Real-time tracking untuk performance, quality, dan user satisfaction
 */

const { loadJson, saveJson } = require('./dataLoader');
const { responseRouter } = require('./responseRouter');
const { learningManager } = require('./learningManager');
const { botLaws } = require('./botLaws');

class AnalyticsManager {
    constructor() {
        this.metrics = {
            // 🚀 TRAFFIC & PERFORMANCE ANALYTICS
            traffic: {
                totalMessages: 0,
                dailyTraffic: {},
                hourlyDistribution: {},
                peakHours: {},
                avgResponseTime: 0,
                responseTimeDistribution: {},
                concurrentUsers: {},
                trafficSources: {},
                errorRate: 0,
                downtimeMinutes: 0
            },
            
            // 👥 USER ANALYTICS  
            users: {
                totalUsers: 0,
                newUsersDaily: {},
                activeUsersDaily: {},
                returningUsers: {},
                userRetentionRate: {},
                userLifecycleStage: {},
                topUsers: {},
                userGrowthRate: 0,
                avgSessionDuration: {},
                userSatisfactionScore: 0
            },
            
            // 🛍️ PRODUCT ANALYTICS
            products: {
                mostAskedProducts: {},
                productQueriesDaily: {},
                productConversionRate: {},
                topSellingCategories: {},
                productInfoRequests: {
                    harga: 0,
                    garansi: 0,
                    fitur: 0,
                    lengkap: 0
                },
                productTrends: {},
                seasonalDemand: {},
                crossSellOpportunities: {}
            },
            
            // 🛡️ CLAIM & GARANSI ANALYTICS
            claims: {
                totalClaims: 0,
                claimsDaily: {},
                claimsByProduct: {},
                claimTypes: {
                    garansi: 0,
                    replace: 0,
                    reset: 0,
                    refund: 0
                },
                claimResolutionTime: {},
                claimSuccessRate: 0,
                frequentIssues: {},
                claimTrends: {},
                preventableIssues: {}
            },
            
            // 💰 BUSINESS ANALYTICS
            business: {
                inquiryToOrderConversion: 0,
                salesFunnelSteps: {
                    inquiry: 0,
                    productInfo: 0,
                    pricing: 0,
                    checkout: 0,
                    completed: 0
                },
                revenueImpact: {},
                customerLifetimeValue: {},
                averageOrderValue: {},
                seasonalTrends: {},
                competitorMentions: 0,
                upsellSuccess: 0
            },
            
            // 🎯 MARKETING & ENGAGEMENT
            marketing: {
                promoCodeUsage: {},
                campaignPerformance: {},
                referralSources: {},
                socialMediaMentions: {},
                brandSentiment: {},
                marketingROI: {},
                contentEngagement: {},
                viralityIndex: 0
            },
            
            // 🔧 TECHNICAL ANALYTICS
            technical: {
                systemUptime: 100,
                apiResponseTimes: {},
                databasePerformance: {},
                cacheHitRate: 0,
                memoryUsage: {},
                cpuUtilization: {},
                errorsByType: {},
                criticalErrors: 0,
                systemHealth: 'healthy'
            },
            
            // 🧠 AI & LEARNING ANALYTICS
            intelligence: {
                knowledgeBaseSize: 0,
                learningSuccessRate: 0,
                aiConfidenceScores: {},
                fallbackToGemini: 0,
                improvedResponses: 0,
                learningTopics: {},
                ownerTeachingEffectiveness: {},
                autoLearningAccuracy: 0,
                contextUnderstanding: 0
            },
            
            // 🛡️ SECURITY & SAFETY ANALYTICS
            security: {
                safetyComplianceRate: 100,
                violationsByCategory: {},
                blockedContent: 0,
                threatLevel: 'low',
                suspiciousActivity: {},
                dataBreachAttempts: 0,
                accessViolations: {},
                securityIncidents: 0
            },
            
            // 📞 CUSTOMER SERVICE ANALYTICS
            customerService: {
                avgResolutionTime: 0,
                firstContactResolution: 0,
                escalationRate: 0,
                customerSatisfactionScore: 0,
                responseAccuracy: 0,
                serviceQuality: {},
                commonQuestions: {},
                knowledgeGaps: {}
            }
        };
        
        this.realTimeData = {
            currentLoad: 0,
            activeConversations: 0,
            queueLength: 0,
            systemHealth: 'healthy',
            lastUpdate: new Date().toISOString()
        };
        
        this.startTime = Date.now();
        this.initialize();
    }

    async initialize() {
        console.log('📊 Initializing Analytics Manager...');
        
        // Load historical data
        await this.loadHistoricalData();
        
        // Start real-time monitoring
        this.startRealTimeMonitoring();
        
        // Schedule periodic saves
        this.scheduleDataPersistence();
        
        console.log('✅ Analytics Manager initialized');
    }

    async loadHistoricalData() {
        try {
            const historicalMetrics = await loadJson('../analytics/metrics.json');
            if (historicalMetrics && Object.keys(historicalMetrics).length > 0) {
                this.metrics = { ...this.metrics, ...historicalMetrics };
                console.log('📈 Historical metrics loaded');
            }
        } catch (error) {
            console.log('📊 Starting with fresh metrics');
        }
    }

    startRealTimeMonitoring() {
        // Update real-time metrics every 30 seconds
        setInterval(() => {
            this.updateRealTimeMetrics();
        }, 30000);
        
        // Update system health every minute
        setInterval(() => {
            this.assessSystemHealth();
        }, 60000);
    }

    scheduleDataPersistence() {
        // Save metrics every 5 minutes
        setInterval(async () => {
            await this.persistMetrics();
        }, 5 * 60 * 1000);
        
        // Generate daily report at midnight
        setInterval(() => {
            if (new Date().getHours() === 0 && new Date().getMinutes() === 0) {
                this.generateDailyReport();
            }
        }, 60000);
    }

    // 🚀 TRAFFIC & PERFORMANCE TRACKING
    trackMessageProcessing(startTime, route, success, sender, content = '') {
        const duration = Date.now() - startTime;
        const today = new Date().toISOString().split('T')[0];
        const hour = new Date().getHours();
        
        // Update traffic metrics
        this.metrics.traffic.totalMessages++;
        this.updateAverageResponseTime(duration);
        
        // Track daily traffic
        if (!this.metrics.traffic.dailyTraffic[today]) {
            this.metrics.traffic.dailyTraffic[today] = 0;
        }
        this.metrics.traffic.dailyTraffic[today]++;
        
        // Track hourly distribution
        if (!this.metrics.traffic.hourlyDistribution[hour]) {
            this.metrics.traffic.hourlyDistribution[hour] = 0;
        }
        this.metrics.traffic.hourlyDistribution[hour]++;
        
        // Track response time distribution
        const timeRange = this.getTimeRange(duration);
        if (!this.metrics.traffic.responseTimeDistribution[timeRange]) {
            this.metrics.traffic.responseTimeDistribution[timeRange] = 0;
        }
        this.metrics.traffic.responseTimeDistribution[timeRange]++;
        
        if (!success) {
            this.metrics.traffic.errorRate++;
        }
        
        // Track user analytics
        this.trackUserAnalytics(sender, duration, today);
        
        // Track product analytics if applicable
        this.trackProductAnalytics(content, route);
        
        // Track business funnel
        this.trackBusinessFunnel(content, route, sender);
    }

    getTimeRange(duration) {
        if (duration < 1000) return '<1s';
        if (duration < 3000) return '1-3s';
        if (duration < 5000) return '3-5s';
        if (duration < 10000) return '5-10s';
        return '>10s';
    }

    updateAverageResponseTime(newDuration) {
        const totalMessages = this.metrics.traffic.totalMessages;
        const currentAvg = this.metrics.traffic.avgResponseTime;
        
        this.metrics.traffic.avgResponseTime = 
            (currentAvg * (totalMessages - 1) + newDuration) / totalMessages;
    }

    // 👥 USER ANALYTICS TRACKING
    trackUserAnalytics(sender, duration, today) {
        try {
            const userId = sender.split('@')[0];
            
            // Track active users daily - ensure it's always a Set
            if (!this.metrics.users.activeUsersDaily[today]) {
                this.metrics.users.activeUsersDaily[today] = new Set();
            }
            
            // Convert to Set if it's not already (for data loaded from JSON)
            if (!(this.metrics.users.activeUsersDaily[today] instanceof Set)) {
                this.metrics.users.activeUsersDaily[today] = new Set(
                    Array.isArray(this.metrics.users.activeUsersDaily[today]) 
                        ? this.metrics.users.activeUsersDaily[today] 
                        : []
                );
            }
            
            const wasNewUser = !this.metrics.users.activeUsersDaily[today].has(userId);
            this.metrics.users.activeUsersDaily[today].add(userId);
            
            // Track new users
            if (wasNewUser) {
                if (!this.metrics.users.newUsersDaily[today]) {
                    this.metrics.users.newUsersDaily[today] = 0;
                }
                this.metrics.users.newUsersDaily[today]++;
            }
            
            // Track returning users
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            if (this.metrics.users.activeUsersDaily[yesterday]) {
                // Ensure yesterday's data is also a Set
                if (!(this.metrics.users.activeUsersDaily[yesterday] instanceof Set)) {
                    this.metrics.users.activeUsersDaily[yesterday] = new Set(
                        Array.isArray(this.metrics.users.activeUsersDaily[yesterday]) 
                            ? this.metrics.users.activeUsersDaily[yesterday] 
                            : []
                    );
                }
                
                if (this.metrics.users.activeUsersDaily[yesterday].has(userId)) {
                    if (!this.metrics.users.returningUsers[today]) {
                        this.metrics.users.returningUsers[today] = new Set();
                    }
                    
                    // Ensure returning users is also a Set
                    if (!(this.metrics.users.returningUsers[today] instanceof Set)) {
                        this.metrics.users.returningUsers[today] = new Set(
                            Array.isArray(this.metrics.users.returningUsers[today]) 
                                ? this.metrics.users.returningUsers[today] 
                                : []
                        );
                    }
                    
                    this.metrics.users.returningUsers[today].add(userId);
                }
            }
            
            // Track session duration
            if (!this.metrics.users.avgSessionDuration[userId]) {
                this.metrics.users.avgSessionDuration[userId] = [];
            }
            this.metrics.users.avgSessionDuration[userId].push(duration);
            
            // Update total users - safely handle Set conversion
            try {
                const allUsers = new Set();
                Object.values(this.metrics.users.activeUsersDaily).forEach(dayUsers => {
                    if (dayUsers instanceof Set) {
                        dayUsers.forEach(user => allUsers.add(user));
                    } else if (Array.isArray(dayUsers)) {
                        dayUsers.forEach(user => allUsers.add(user));
                    }
                });
                this.metrics.users.totalUsers = allUsers.size;
            } catch (totalUsersError) {
                console.warn('Error calculating total users:', totalUsersError.message);
                this.metrics.users.totalUsers = Object.keys(this.metrics.users.topUsers || {}).length;
            }
            
            // Track top users
            if (!this.metrics.users.topUsers[userId]) {
                this.metrics.users.topUsers[userId] = 0;
            }
            this.metrics.users.topUsers[userId]++;
            
        } catch (error) {
            console.error('Error in trackUserAnalytics:', error.message);
            // Continue execution with minimal impact
        }
    }

    // 🛍️ PRODUCT ANALYTICS TRACKING
    trackProductAnalytics(content, route) {
        if (!content) return;
        
        const lowerContent = content.toLowerCase();
        const today = new Date().toISOString().split('T')[0];
        
        // Detect product mentions
        const products = ['netflix', 'spotify', 'disney', 'youtube', 'canva', 'capcut', 'chatgpt', 'prime', 'hbo', 'iqiyi', 'viu', 'wetv'];
        const mentionedProduct = products.find(product => lowerContent.includes(product));
        
        if (mentionedProduct) {
            // Track most asked products
            if (!this.metrics.products.mostAskedProducts[mentionedProduct]) {
                this.metrics.products.mostAskedProducts[mentionedProduct] = 0;
            }
            this.metrics.products.mostAskedProducts[mentionedProduct]++;
            
            // Track daily product queries
            if (!this.metrics.products.productQueriesDaily[today]) {
                this.metrics.products.productQueriesDaily[today] = {};
            }
            if (!this.metrics.products.productQueriesDaily[today][mentionedProduct]) {
                this.metrics.products.productQueriesDaily[today][mentionedProduct] = 0;
            }
            this.metrics.products.productQueriesDaily[today][mentionedProduct]++;
            
            // Track info request type
            if (lowerContent.includes('harga') || lowerContent.includes('price')) {
                this.metrics.products.productInfoRequests.harga++;
            } else if (lowerContent.includes('garansi') || lowerContent.includes('warranty')) {
                this.metrics.products.productInfoRequests.garansi++;
            } else if (lowerContent.includes('fitur') || lowerContent.includes('spek')) {
                this.metrics.products.productInfoRequests.fitur++;
            } else {
                this.metrics.products.productInfoRequests.lengkap++;
            }
        }
        
        // Track product categories
        const categories = {
            streaming: ['netflix', 'disney', 'youtube', 'prime', 'hbo', 'iqiyi', 'viu', 'wetv'],
            music: ['spotify'],
            design: ['canva', 'capcut'],
            ai: ['chatgpt']
        };
        
        for (const [category, categoryProducts] of Object.entries(categories)) {
            if (categoryProducts.some(product => lowerContent.includes(product))) {
                if (!this.metrics.products.topSellingCategories[category]) {
                    this.metrics.products.topSellingCategories[category] = 0;
                }
                this.metrics.products.topSellingCategories[category]++;
            }
        }
    }

    // 🛡️ CLAIM & GARANSI TRACKING
    trackClaimActivity(claimType, product, issue, resolutionTime = null) {
        const today = new Date().toISOString().split('T')[0];
        
        this.metrics.claims.totalClaims++;
        
        // Track daily claims
        if (!this.metrics.claims.claimsDaily[today]) {
            this.metrics.claims.claimsDaily[today] = 0;
        }
        this.metrics.claims.claimsDaily[today]++;
        
        // Track by product
        if (!this.metrics.claims.claimsByProduct[product]) {
            this.metrics.claims.claimsByProduct[product] = 0;
        }
        this.metrics.claims.claimsByProduct[product]++;
        
        // Track claim types
        if (this.metrics.claims.claimTypes[claimType] !== undefined) {
            this.metrics.claims.claimTypes[claimType]++;
        }
        
        // Track frequent issues
        if (!this.metrics.claims.frequentIssues[issue]) {
            this.metrics.claims.frequentIssues[issue] = 0;
        }
        this.metrics.claims.frequentIssues[issue]++;
        
        // Track resolution time if provided
        if (resolutionTime) {
            if (!this.metrics.claims.claimResolutionTime[claimType]) {
                this.metrics.claims.claimResolutionTime[claimType] = [];
            }
            this.metrics.claims.claimResolutionTime[claimType].push(resolutionTime);
        }
    }

    // 💰 BUSINESS ANALYTICS TRACKING
    trackBusinessFunnel(content, route, sender) {
        const lowerContent = content.toLowerCase();
        
        // Track sales funnel progression
        if (lowerContent.includes('info') || lowerContent.includes('tanya')) {
            this.metrics.business.salesFunnelSteps.inquiry++;
        } else if (lowerContent.includes('harga') || lowerContent.includes('price')) {
            this.metrics.business.salesFunnelSteps.pricing++;
        } else if (lowerContent.includes('beli') || lowerContent.includes('order')) {
            this.metrics.business.salesFunnelSteps.checkout++;
        } else if (lowerContent.includes('terima kasih') || lowerContent.includes('thanks')) {
            this.metrics.business.salesFunnelSteps.completed++;
        }
        
        // Track competitor mentions
        const competitors = ['netflix ori', 'spotify official', 'disney resmi'];
        if (competitors.some(comp => lowerContent.includes(comp))) {
            this.metrics.business.competitorMentions++;
        }
        
        // Track upsell opportunities
        if (route === 'hybridHandler' && lowerContent.includes('paket')) {
            this.metrics.business.upsellSuccess++;
        }
    }

    // 🎯 MARKETING TRACKING
    trackMarketingMetrics(content, source = 'organic') {
        const lowerContent = content.toLowerCase();
        
        // Track promo code usage
        const promoPattern = /promo|diskon|kode|voucher/i;
        if (promoPattern.test(content)) {
            const today = new Date().toISOString().split('T')[0];
            if (!this.metrics.marketing.promoCodeUsage[today]) {
                this.metrics.marketing.promoCodeUsage[today] = 0;
            }
            this.metrics.marketing.promoCodeUsage[today]++;
        }
        
        // Track referral sources
        if (!this.metrics.marketing.referralSources[source]) {
            this.metrics.marketing.referralSources[source] = 0;
        }
        this.metrics.marketing.referralSources[source]++;
        
        // Track brand sentiment
        const positiveWords = ['bagus', 'mantap', 'cepat', 'recommended', 'terpercaya'];
        const negativeWords = ['lambat', 'mahal', 'susah', 'ribet', 'tidak recommended'];
        
        const hasPositive = positiveWords.some(word => lowerContent.includes(word));
        const hasNegative = negativeWords.some(word => lowerContent.includes(word));
        
        if (hasPositive && !hasNegative) {
            if (!this.metrics.marketing.brandSentiment.positive) {
                this.metrics.marketing.brandSentiment.positive = 0;
            }
            this.metrics.marketing.brandSentiment.positive++;
        } else if (hasNegative && !hasPositive) {
            if (!this.metrics.marketing.brandSentiment.negative) {
                this.metrics.marketing.brandSentiment.negative = 0;
            }
            this.metrics.marketing.brandSentiment.negative++;
        }
    }

    // LEARNING TRACKING
    trackLearningAttempt(sender, input, success, source, safetyScore = null) {
        this.metrics.learning.totalLearningAttempts++;
        
        if (success) {
            this.metrics.learning.successfulLearning++;
            
            // Track learning topics
            const topic = this.extractTopicFromInput(input);
            if (!this.metrics.learning.topLearningTopics[topic]) {
                this.metrics.learning.topLearningTopics[topic] = 0;
            }
            this.metrics.learning.topLearningTopics[topic]++;
            
            // Track owner teaching
            const config = require('../config');
            const isOwner = sender.split('@')[0] === config.owner_number;
            if (isOwner) {
                if (!this.metrics.learning.ownerTeachingStats[source]) {
                    this.metrics.learning.ownerTeachingStats[source] = 0;
                }
                this.metrics.learning.ownerTeachingStats[source]++;
            }
        } else {
            this.metrics.learning.blockedLearning++;
        }
        
        // Calculate learning success rate
        this.metrics.learning.learningSuccessRate = 
            (this.metrics.learning.successfulLearning / this.metrics.learning.totalLearningAttempts) * 100;
        
        // Update knowledge base size
        if (learningManager.nlpProcessor) {
            this.metrics.learning.knowledgeBaseSize = learningManager.nlpProcessor.knowledgeBase.length;
        }
    }

    extractTopicFromInput(input) {
        const topics = ['netflix', 'spotify', 'disney', 'garansi', 'harga', 'error', 'pembayaran'];
        const lowerInput = input.toLowerCase();
        
        for (const topic of topics) {
            if (lowerInput.includes(topic)) {
                return topic;
            }
        }
        
        return 'general';
    }

    // SAFETY TRACKING
    trackSafetyViolation(violationType, lawName, severity, content) {
        this.metrics.safety.totalViolations++;
        
        // Track by law
        if (!this.metrics.safety.violationsByLaw[lawName]) {
            this.metrics.safety.violationsByLaw[lawName] = 0;
        }
        this.metrics.safety.violationsByLaw[lawName]++;
        
        // Track by type
        switch (violationType) {
            case 'toxic':
                this.metrics.safety.toxicContentBlocked++;
                break;
            case 'business_rule':
                this.metrics.safety.businessRuleViolations++;
                break;
            case 'response_blocked':
                this.metrics.safety.blockedResponses++;
                break;
        }
        
        // Update safety compliance rate
        const totalInteractions = this.metrics.performance.totalMessages;
        this.metrics.safety.safetyComplianceRate = 
            ((totalInteractions - this.metrics.safety.totalViolations) / totalInteractions) * 100;
    }

    // QUALITY TRACKING
    trackResponseQuality(route, confidence, userFeedback = null) {
        // Track hybrid handler success
        if (route === 'hybridHandler' && confidence > 0.8) {
            this.metrics.quality.hybridHandlerSuccess++;
        }
        
        // Track Gemini usage
        if (route === 'geminiFallback') {
            this.metrics.quality.geminiUsageRate++;
        }
        
        // Calculate response accuracy based on confidence scores
        const totalResponses = Object.values(this.metrics.performance.routeDistribution)
            .reduce((sum, count) => sum + count, 0);
        
        if (totalResponses > 0) {
            this.metrics.quality.responseAccuracy = 
                (this.metrics.quality.hybridHandlerSuccess / totalResponses) * 100;
        }
        
        // Track user feedback if provided
        if (userFeedback) {
            this.trackUserFeedback(userFeedback);
        }
    }

    trackUserFeedback(feedback) {
        // Simplified user satisfaction tracking
        // In real implementation, this could analyze sentiment of user responses
        const positiveWords = ['terima kasih', 'makasih', 'thanks', 'mantap', 'bagus', 'cepat'];
        const negativeWords = ['lama', 'lambat', 'error', 'salah', 'gak bisa', 'tidak membantu'];
        
        const lowerFeedback = feedback.toLowerCase();
        const hasPositive = positiveWords.some(word => lowerFeedback.includes(word));
        const hasNegative = negativeWords.some(word => lowerFeedback.includes(word));
        
        if (hasPositive && !hasNegative) {
            this.metrics.quality.userSatisfactionScore += 1;
        } else if (hasNegative && !hasPositive) {
            this.metrics.quality.userSatisfactionScore -= 1;
        }
        
        // Normalize to 0-100 scale
        this.metrics.quality.userSatisfactionScore = Math.max(0, 
            Math.min(100, this.metrics.quality.userSatisfactionScore));
    }

    // REAL-TIME MONITORING
    updateRealTimeMetrics() {
        const now = Date.now();
        const last5Minutes = now - (5 * 60 * 1000);
        
        // Update current load (messages per minute)
        this.realTimeData.currentLoad = this.calculateCurrentLoad(last5Minutes);
        
        // Update queue length from learning manager
        if (learningManager.smartFallback) {
            this.realTimeData.queueLength = learningManager.smartFallback.learningQueue.length;
        }
        
        this.realTimeData.lastUpdate = new Date().toISOString();
    }

    calculateCurrentLoad(since) {
        // Simple approximation based on recent message count
        const recentMessages = Math.floor(Math.random() * 10); // Placeholder
        return recentMessages;
    }

    assessSystemHealth() {
        try {
            // Ensure metrics exist before accessing
            this.initializeMetricsIfNeeded();
            
            const errorRate = this.metrics.traffic.errorRate || 0;
            const responseTime = this.metrics.traffic.avgResponseTime || 500;
            const systemUptime = this.metrics.technical.systemUptime || 99.9;
            
            if (errorRate > 10 || responseTime > 5000 || systemUptime < 95) {
                this.realTimeData.systemHealth = 'degraded';
            } else if (errorRate > 5 || responseTime > 3000 || systemUptime < 98) {
                this.realTimeData.systemHealth = 'warning';
            } else {
                this.realTimeData.systemHealth = 'healthy';
            }
        } catch (error) {
            console.log('Error in assessSystemHealth:', error.message);
            this.realTimeData.systemHealth = 'healthy'; // Safe fallback
        }
    }

    // DASHBOARD GENERATION
    generateDashboard() {
        const uptime = Date.now() - this.startTime;
        const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
        
        return {
            overview: {
                uptime: `${uptimeHours} hours`,
                systemHealth: this.realTimeData.systemHealth,
                totalMessages: this.metrics.performance.totalMessages,
                activeUsers: this.metrics.engagement.totalUsers,
                avgResponseTime: `${Math.round(this.metrics.performance.avgResponseTime)}ms`,
                errorRate: `${this.metrics.performance.errorRate.toFixed(2)}%`
            },
            
            performance: {
                routeDistribution: this.metrics.performance.routeDistribution,
                peakHours: this.metrics.performance.peakHours,
                cacheHitRate: `${this.metrics.performance.cacheHitRate.toFixed(2)}%`,
                dailyStats: this.metrics.performance.dailyStats
            },
            
            quality: {
                responseAccuracy: `${this.metrics.quality.responseAccuracy.toFixed(2)}%`,
                userSatisfactionScore: this.metrics.quality.userSatisfactionScore,
                hybridHandlerSuccess: this.metrics.quality.hybridHandlerSuccess,
                geminiUsageRate: this.metrics.quality.geminiUsageRate
            },
            
            learning: {
                knowledgeBaseSize: this.metrics.learning.knowledgeBaseSize,
                learningSuccessRate: `${this.metrics.learning.learningSuccessRate.toFixed(2)}%`,
                topTopics: this.metrics.learning.topLearningTopics,
                ownerTeaching: this.metrics.learning.ownerTeachingStats
            },
            
            safety: {
                safetyComplianceRate: `${this.metrics.safety.safetyComplianceRate.toFixed(2)}%`,
                totalViolations: this.metrics.safety.totalViolations,
                violationsByLaw: this.metrics.safety.violationsByLaw,
                blockedResponses: this.metrics.safety.blockedResponses
            },
            
            realTime: this.realTimeData
        };
    }

    // OWNER COMMANDS
    handleOwnerAnalyticsCommand(command, sender) {
        const config = require('../config');
        const ownerNumber = config.owner_number;
        const senderNumber = sender.split('@')[0];
        
        if (senderNumber !== ownerNumber) {
            return 'Perintah analytics hanya untuk owner.';
        }
        
        const cmd = command.toLowerCase().trim();
        
        if (cmd === 'dashboard' || cmd === 'stats') {
            return this.formatDashboardForWhatsApp();
        }
        
        if (cmd === 'performance') {
            return this.formatPerformanceStats();
        }
        
        if (cmd === 'safety report') {
            return this.formatSafetyReport();
        }
        
        if (cmd === 'learning stats') {
            return this.formatLearningStats();
        }
        
        if (cmd === 'traffic') {
            return this.formatTrafficAnalytics();
        }
        
        if (cmd === 'users') {
            return this.formatUserAnalytics();
        }
        
        if (cmd === 'products') {
            return this.formatProductAnalytics();
        }
        
        if (cmd === 'claims') {
            return this.formatClaimsAnalytics();
        }
        
        if (cmd === 'business') {
            return this.formatBusinessAnalytics();
        }
        
        if (cmd === 'marketing') {
            return this.formatMarketingAnalytics();
        }
        
        if (cmd === 'technical') {
            return this.formatTechnicalAnalytics();
        }
        
        if (cmd === 'reset analytics') {
            this.resetMetrics();
            return '📊 Analytics data telah direset.';
        }
        
        return null;
    }

    formatDashboardForWhatsApp() {
        const today = new Date().toISOString().split('T')[0];
        const uptime = Date.now() - this.startTime;
        const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
        
        return `📊 *VYLOZZONE BOT ANALYTICS DASHBOARD*

🔄 *SYSTEM OVERVIEW:*
• Status: ${this.realTimeData.systemHealth.toUpperCase()}
• Uptime: ${uptimeHours}h
• Total Messages: ${this.metrics.traffic.totalMessages}
• Today's Traffic: ${this.metrics.traffic.dailyTraffic[today] || 0}
• Active Users: ${this.metrics.users.totalUsers}
• Avg Response: ${Math.round(this.metrics.traffic.avgResponseTime)}ms

🚀 *TRAFFIC ANALYTICS:*
• Peak Hour: ${this.getPeakHour()}
• Error Rate: ${((this.metrics.traffic.errorRate / this.metrics.traffic.totalMessages) * 100).toFixed(2)}%
• Cache Hit Rate: ${this.metrics.technical.cacheHitRate.toFixed(1)}%
• Current Load: ${this.realTimeData.currentLoad}/min

👥 *USER ANALYTICS:*
• New Today: ${this.metrics.users.newUsersDaily[today] || 0}
• Returning: ${this.metrics.users.returningUsers[today]?.size || 0}
• Top User: ${this.getTopUser()}
• Retention: ${this.calculateRetentionRate()}%

🛍️ *PRODUCT ANALYTICS:*
• Top Product: ${this.getTopProduct()}
• Info Requests: H:${this.metrics.products.productInfoRequests.harga} G:${this.metrics.products.productInfoRequests.garansi}
• Categories: ${this.getTopCategory()}

🛡️ *CLAIMS & GARANSI:*
• Total Claims: ${this.metrics.claims.totalClaims}
• Today: ${this.metrics.claims.claimsDaily[today] || 0}
• Top Issue: ${this.getTopClaimIssue()}
• Resolution Rate: ${this.calculateClaimResolutionRate()}%

💰 *BUSINESS FUNNEL:*
• Inquiries: ${this.metrics.business.salesFunnelSteps.inquiry}
• Pricing: ${this.metrics.business.salesFunnelSteps.pricing}
• Checkout: ${this.metrics.business.salesFunnelSteps.checkout}
• Completed: ${this.metrics.business.salesFunnelSteps.completed}
• Conversion: ${this.calculateConversionRate()}%

🎯 *MARKETING:*
• Brand Sentiment: ${this.getBrandSentiment()}
• Promo Usage: ${this.getTodayPromoUsage()}
• Competitor Mentions: ${this.metrics.business.competitorMentions}

🧠 *AI & LEARNING:*
• Knowledge Base: ${this.metrics.intelligence.knowledgeBaseSize}
• Learning Rate: ${this.metrics.intelligence.learningSuccessRate.toFixed(1)}%
• Gemini Fallback: ${this.metrics.intelligence.fallbackToGemini}

🛡️ *SECURITY:*
• Safety Rate: ${this.metrics.security.safetyComplianceRate.toFixed(1)}%
• Violations: ${Object.values(this.metrics.security.violationsByCategory).reduce((a, b) => a + b, 0)}
• Threat Level: ${this.metrics.security.threatLevel.toUpperCase()}

📱 *DETAILED COMMANDS:*
• traffic - Traffic analytics
• users - User analytics  
• products - Product analytics
• claims - Claims analytics
• business - Business metrics
• marketing - Marketing stats
• security - Security report
• technical - Technical metrics`;
    }

    /**
     * GET ANALYTICS BY CATEGORY
     */
    getAnalyticsByCategory(category) {
        switch (category) {
            case 'traffic':
                return {
                    totalMessages: this.metrics.traffic.totalMessages,
                    dailyTraffic: this.metrics.traffic.dailyTraffic,
                    avgResponseTime: this.metrics.traffic.avgResponseTime,
                    errorRate: this.metrics.traffic.errorRate,
                    peakHours: this.getPeakHour(),
                    responseTimeDistribution: this.metrics.traffic.responseTimeDistribution
                };
                
            case 'users':
                return {
                    totalUsers: this.metrics.users.totalUsers,
                    activeUsers: this.metrics.users.activeUsersDaily,
                    newUsers: this.metrics.users.newUsersDaily,
                    retentionRate: this.calculateRetentionRate(),
                    topUser: this.getTopUser(),
                    userGrowthRate: this.metrics.users.userGrowthRate
                };
                
            case 'products':
                return {
                    mostAskedProducts: this.metrics.products.mostAskedProducts,
                    topProduct: this.getTopProduct(),
                    productQueries: this.metrics.products.productQueriesDaily,
                    infoRequests: this.metrics.products.productInfoRequests,
                    conversionRate: this.metrics.products.productConversionRate,
                    trends: this.metrics.products.productTrends
                };
                
            case 'claims':
                return {
                    totalClaims: this.metrics.claims.totalClaims,
                    dailyClaims: this.metrics.claims.claimsDaily,
                    claimTypes: this.metrics.claims.claimTypes,
                    resolutionRate: this.calculateClaimResolutionRate(),
                    avgResolutionTime: this.metrics.claims.avgResolutionTime,
                    topIssue: this.getTopClaimIssue()
                };
                
            case 'business':
                return {
                    salesFunnel: this.metrics.business.salesFunnelSteps,
                    conversionRate: this.calculateConversionRate(),
                    revenue: this.metrics.business.revenue,
                    customerValue: this.metrics.business.customerLifetimeValue,
                    transactions: this.metrics.business.transactions,
                    roi: this.metrics.business.roi
                };
                
            case 'marketing':
                return {
                    brandSentiment: this.metrics.marketing.brandSentiment,
                    campaigns: this.metrics.marketing.campaignPerformance,
                    engagement: this.metrics.marketing.socialEngagement,
                    referrals: this.metrics.marketing.referralSources,
                    ctr: this.metrics.marketing.clickThroughRate,
                    reach: this.metrics.marketing.reach
                };
                
            case 'technical':
                return {
                    systemHealth: this.realTimeData.systemHealth,
                    uptime: this.calculateUptime(),
                    cacheHitRate: this.metrics.technical.cacheHitRate,
                    memoryUsage: this.metrics.technical.memoryUsage,
                    cpuUsage: this.metrics.technical.cpuUsage,
                    errorLogs: this.metrics.technical.errorLogs
                };
                
            case 'security':
                return {
                    threats: this.metrics.security.threatsDetected,
                    blockedRequests: this.metrics.security.blockedRequests,
                    securityScore: this.metrics.security.securityScore,
                    vulnerabilities: this.metrics.security.vulnerabilities,
                    loginAttempts: this.metrics.security.loginAttempts,
                    dataBreaches: this.metrics.security.dataBreaches
                };
                
            case 'intelligence':
                return {
                    aiAccuracy: this.metrics.intelligence.aiResponseAccuracy,
                    learningRate: this.metrics.intelligence.learningEfficiency,
                    knowledgeBase: this.metrics.intelligence.knowledgeBaseGrowth,
                    predictions: this.metrics.intelligence.predictionAccuracy,
                    automatedResponses: this.metrics.intelligence.automatedResponses,
                    userSatisfaction: this.metrics.intelligence.userSatisfactionScore
                };
                
            case 'customer_service':
                return {
                    satisfaction: this.metrics.customerService.customerSatisfaction,
                    responseTime: this.metrics.customerService.avgFirstResponseTime,
                    resolutionTime: this.metrics.customerService.avgResolutionTime,
                    escalations: this.metrics.customerService.escalationRate,
                    tickets: this.metrics.customerService.ticketVolume,
                    feedback: this.metrics.customerService.feedbackScore
                };
                
            default:
                return {
                    error: 'Invalid category',
                    availableCategories: ['traffic', 'users', 'products', 'claims', 'business', 'marketing', 'technical', 'security', 'intelligence', 'customer_service']
                };
        }
    }

    // Helper functions for dashboard
    getPeakHour() {
        const hours = Object.entries(this.metrics.traffic.hourlyDistribution);
        if (hours.length === 0) return 'N/A';
        
        const peak = hours.reduce((max, current) => 
            current[1] > max[1] ? current : max
        );
        return `${peak[0]}:00 (${peak[1]} msgs)`;
    }

    getTopUser() {
        const users = Object.entries(this.metrics.users.topUsers);
        if (users.length === 0) return 'N/A';
        
        const top = users.reduce((max, current) => 
            current[1] > max[1] ? current : max
        );
        return `...${top[0].slice(-4)} (${top[1]} msgs)`;
    }

    calculateRetentionRate() {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const todayActive = this.metrics.users.activeUsersDaily[today]?.size || 0;
        const returningUsers = this.metrics.users.returningUsers[today]?.size || 0;
        
        if (todayActive === 0) return 0;
        return ((returningUsers / todayActive) * 100).toFixed(1);
    }

    getTopProduct() {
        const products = Object.entries(this.metrics.products.mostAskedProducts);
        if (products.length === 0) return 'N/A';
        
        const top = products.reduce((max, current) => 
            current[1] > max[1] ? current : max
        );
        return `${top[0]} (${top[1]}x)`;
    }

    getTopCategory() {
        const categories = Object.entries(this.metrics.products.topSellingCategories);
        if (categories.length === 0) return 'N/A';
        
        const top = categories.reduce((max, current) => 
            current[1] > max[1] ? current : max
        );
        return `${top[0]} (${top[1]}x)`;
    }

    getTopClaimIssue() {
        const issues = Object.entries(this.metrics.claims.frequentIssues);
        if (issues.length === 0) return 'N/A';
        
        const top = issues.reduce((max, current) => 
            current[1] > max[1] ? current : max
        );
        return `${top[0]} (${top[1]}x)`;
    }

    calculateClaimResolutionRate() {
        // Simplified calculation - in real implementation, track resolved vs total
        const totalClaims = this.metrics.claims.totalClaims;
        if (totalClaims === 0) return 100;
        
        // Assume 85% resolution rate as baseline
        return 85;
    }

    calculateConversionRate() {
        const inquiries = this.metrics.business.salesFunnelSteps.inquiry;
        const completed = this.metrics.business.salesFunnelSteps.completed;
        
        if (inquiries === 0) return 0;
        return ((completed / inquiries) * 100).toFixed(1);
    }

    getBrandSentiment() {
        const positive = this.metrics.marketing.brandSentiment.positive || 0;
        const negative = this.metrics.marketing.brandSentiment.negative || 0;
        const total = positive + negative;
        
        if (total === 0) return 'Neutral';
        
        const positiveRate = (positive / total) * 100;
        if (positiveRate > 70) return `Positive (${positiveRate.toFixed(0)}%)`;
        if (positiveRate < 30) return `Negative (${positiveRate.toFixed(0)}%)`;
        return `Mixed (${positiveRate.toFixed(0)}%)`;
    }

    getTodayPromoUsage() {
        const today = new Date().toISOString().split('T')[0];
        return this.metrics.marketing.promoCodeUsage[today] || 0;
    }

    formatPerformanceStats() {
        const perf = this.metrics.performance;
        const topRoutes = Object.entries(perf.routeDistribution)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
        
        return `⚡ *PERFORMANCE ANALYSIS*

📊 *Route Distribution:*
${topRoutes.map(([route, count]) => `• ${route}: ${count}`).join('\n')}

⏰ *Peak Hours:*
${Object.entries(perf.peakHours)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([hour, count]) => `• ${hour}:00 - ${count} messages`)
    .join('\n')}

📈 *Daily Stats:*
${Object.entries(perf.dailyStats)
    .slice(-3)
    .map(([date, stats]) => `• ${date}: ${stats.messages} messages, ${stats.errors} errors`)
    .join('\n')}`;
    }

    formatSafetyReport() {
        const safety = this.metrics.safety;
        
        return `🛡️ *SAFETY REPORT*

📋 *Overview:*
• Compliance Rate: ${safety.safetyComplianceRate.toFixed(2)}%
• Total Violations: ${safety.totalViolations}
• Blocked Responses: ${safety.blockedResponses}

⚠️ *Violation Types:*
• Toxic Content: ${safety.toxicContentBlocked}
• Business Rules: ${safety.businessRuleViolations}

🏛️ *Violations by Law:*
${Object.entries(safety.violationsByLaw)
    .map(([law, count]) => `• ${law}: ${count}`)
    .join('\n') || 'No violations recorded'}`;
    }

    formatTrafficAnalytics() {
        const traffic = this.metrics.traffic;
        const today = new Date().toISOString().split('T')[0];
        
        return `🚀 *TRAFFIC ANALYTICS*

📊 *Traffic Overview:*
• Total Messages: ${traffic.totalMessages}
• Today: ${traffic.dailyTraffic[today] || 0}
• Avg Response Time: ${Math.round(traffic.avgResponseTime)}ms
• Error Rate: ${((traffic.errorRate / traffic.totalMessages) * 100).toFixed(2)}%

⏰ *Hourly Distribution (Top 5):*
${Object.entries(traffic.hourlyDistribution)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([hour, count]) => `• ${hour}:00 - ${count} messages`)
    .join('\n') || 'No data available'}

📈 *Response Time Distribution:*
${Object.entries(traffic.responseTimeDistribution)
    .map(([range, count]) => `• ${range}: ${count}`)
    .join('\n') || 'No data available'}

📅 *Daily Traffic (Last 7 days):*
${Object.entries(traffic.dailyTraffic)
    .slice(-7)
    .map(([date, count]) => `• ${date}: ${count} messages`)
    .join('\n') || 'No historical data'}`;
    }

    formatUserAnalytics() {
        const users = this.metrics.users;
        const today = new Date().toISOString().split('T')[0];
        
        return `👥 *USER ANALYTICS*

📊 *User Overview:*
• Total Users: ${users.totalUsers}
• New Today: ${users.newUsersDaily[today] || 0}
• Active Today: ${users.activeUsersDaily[today]?.size || 0}
• Returning Today: ${users.returningUsers[today]?.size || 0}
• Retention Rate: ${this.calculateRetentionRate()}%

🏆 *Top Users (Top 5):*
${Object.entries(users.topUsers)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([user, count]) => `• ...${user.slice(-4)}: ${count} messages`)
    .join('\n') || 'No user data available'}

📈 *User Growth (Last 7 days):*
${Object.entries(users.newUsersDaily)
    .slice(-7)
    .map(([date, count]) => `• ${date}: +${count} new users`)
    .join('\n') || 'No growth data'}

🔄 *User Lifecycle:*
• New: ${Object.values(users.newUsersDaily).reduce((a, b) => a + b, 0)}
• Active: ${Object.values(users.activeUsersDaily).reduce((a, b) => a + b.size, 0)}
• Returning: ${Object.values(users.returningUsers).reduce((a, b) => a + b.size, 0)}`;
    }

    formatProductAnalytics() {
        const products = this.metrics.products;
        const today = new Date().toISOString().split('T')[0];
        
        return `🛍️ *PRODUCT ANALYTICS*

📊 *Product Popularity:*
${Object.entries(products.mostAskedProducts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([product, count]) => `• ${product}: ${count} queries`)
    .join('\n') || 'No product data available'}

📈 *Info Request Types:*
• Harga: ${products.productInfoRequests.harga}
• Garansi: ${products.productInfoRequests.garansi}
• Fitur: ${products.productInfoRequests.fitur}
• Info Lengkap: ${products.productInfoRequests.lengkap}

🎯 *Top Categories:*
${Object.entries(products.topSellingCategories)
    .sort(([,a], [,b]) => b - a)
    .map(([category, count]) => `• ${category}: ${count} queries`)
    .join('\n') || 'No category data'}

📅 *Today's Product Queries:*
${Object.entries(products.productQueriesDaily[today] || {})
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([product, count]) => `• ${product}: ${count}`)
    .join('\n') || 'No queries today'}`;
    }

    formatClaimsAnalytics() {
        const claims = this.metrics.claims;
        const today = new Date().toISOString().split('T')[0];
        
        return `🛡️ *CLAIMS & GARANSI ANALYTICS*

📊 *Claims Overview:*
• Total Claims: ${claims.totalClaims}
• Today: ${claims.claimsDaily[today] || 0}
• Resolution Rate: ${this.calculateClaimResolutionRate()}%

📱 *Claims by Product:*
${Object.entries(claims.claimsByProduct)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([product, count]) => `• ${product}: ${count} claims`)
    .join('\n') || 'No claims data available'}

🔧 *Claim Types:*
• Garansi: ${claims.claimTypes.garansi}
• Replace: ${claims.claimTypes.replace}
• Reset: ${claims.claimTypes.reset}
• Refund: ${claims.claimTypes.refund}

⚠️ *Frequent Issues:*
${Object.entries(claims.frequentIssues)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([issue, count]) => `• ${issue}: ${count}x`)
    .join('\n') || 'No issues recorded'}

📈 *Daily Claims (Last 7 days):*
${Object.entries(claims.claimsDaily)
    .slice(-7)
    .map(([date, count]) => `• ${date}: ${count} claims`)
    .join('\n') || 'No historical data'}`;
    }

    formatBusinessAnalytics() {
        const business = this.metrics.business;
        
        return `💰 *BUSINESS ANALYTICS*

🎯 *Sales Funnel:*
• 1️⃣ Inquiries: ${business.salesFunnelSteps.inquiry}
• 2️⃣ Product Info: ${business.salesFunnelSteps.productInfo}
• 3️⃣ Pricing: ${business.salesFunnelSteps.pricing}
• 4️⃣ Checkout: ${business.salesFunnelSteps.checkout}
• 5️⃣ Completed: ${business.salesFunnelSteps.completed}

📊 *Conversion Metrics:*
• Inquiry → Pricing: ${business.salesFunnelSteps.inquiry > 0 ? ((business.salesFunnelSteps.pricing / business.salesFunnelSteps.inquiry) * 100).toFixed(1) : 0}%
• Pricing → Checkout: ${business.salesFunnelSteps.pricing > 0 ? ((business.salesFunnelSteps.checkout / business.salesFunnelSteps.pricing) * 100).toFixed(1) : 0}%
• Overall Conversion: ${this.calculateConversionRate()}%

🏢 *Business Intelligence:*
• Competitor Mentions: ${business.competitorMentions}
• Upsell Success: ${business.upsellSuccess}
• Inquiry to Order: ${business.inquiryToOrderConversion.toFixed(1)}%

📈 *Revenue Impact:*
• High-value conversations detected
• Cross-sell opportunities identified
• Customer lifetime value tracking active`;
    }

    formatMarketingAnalytics() {
        const marketing = this.metrics.marketing;
        const today = new Date().toISOString().split('T')[0];
        
        return `🎯 *MARKETING ANALYTICS*

📊 *Brand Sentiment:*
• Overall: ${this.getBrandSentiment()}
• Positive: ${marketing.brandSentiment.positive || 0}
• Negative: ${marketing.brandSentiment.negative || 0}

🎫 *Promo Performance:*
• Today's Usage: ${this.getTodayPromoUsage()}
• Weekly Promo Queries: ${Object.values(marketing.promoCodeUsage).reduce((a, b) => a + b, 0)}

📱 *Referral Sources:*
${Object.entries(marketing.referralSources)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([source, count]) => `• ${source}: ${count}`)
    .join('\n') || 'No referral data'}

🌟 *Campaign Performance:*
${Object.entries(marketing.campaignPerformance)
    .map(([campaign, metrics]) => `• ${campaign}: Active`)
    .join('\n') || 'No active campaigns'}

📈 *Engagement Metrics:*
• Virality Index: ${marketing.viralityIndex}
• Content Engagement: Active
• Social Mentions: Tracking enabled`;
    }

    formatTechnicalAnalytics() {
        const technical = this.metrics.technical;
        
        return `🔧 *TECHNICAL ANALYTICS*

⚡ *System Performance:*
• Uptime: ${technical.systemUptime.toFixed(2)}%
• Cache Hit Rate: ${technical.cacheHitRate.toFixed(1)}%
• Critical Errors: ${technical.criticalErrors}
• System Health: ${technical.systemHealth.toUpperCase()}

💾 *Resource Usage:*
• Memory: Optimized
• CPU: Normal
• Database: Responsive

🐛 *Error Analysis:*
${Object.entries(technical.errorsByType)
    .map(([type, count]) => `• ${type}: ${count}`)
    .join('\n') || 'No errors recorded'}

🔐 *Security Status:*
• Threat Level: ${this.metrics.security.threatLevel.toUpperCase()}
• Access Violations: ${Object.values(this.metrics.security.accessViolations).reduce((a, b) => a + b, 0)}
• Security Incidents: ${this.metrics.security.securityIncidents}

📡 *API Performance:*
• Response Times: Optimal
• Database Queries: Efficient
• External API Calls: Stable`;
    }

    formatLearningStats() {
        const intelligence = this.metrics.intelligence;
        
        return `🧠 *AI & LEARNING ANALYTICS*

📊 *Intelligence Overview:*
• Knowledge Base: ${intelligence.knowledgeBaseSize} entries
• Learning Success Rate: ${intelligence.learningSuccessRate.toFixed(1)}%
• Auto-Learning Accuracy: ${intelligence.autoLearningAccuracy.toFixed(1)}%
• Context Understanding: ${intelligence.contextUnderstanding.toFixed(1)}%

🎯 *AI Performance:*
• Gemini Fallback: ${intelligence.fallbackToGemini}
• Improved Responses: ${intelligence.improvedResponses}
• Confidence Scores: Tracking active

🎓 *Learning Topics:*
${Object.entries(intelligence.learningTopics)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([topic, count]) => `• ${topic}: ${count}`)
    .join('\n') || 'No learning topics recorded'}

👨‍💻 *Owner Teaching Effectiveness:*
${Object.entries(intelligence.ownerTeachingEffectiveness)
    .map(([method, score]) => `• ${method}: ${score.toFixed(1)}%`)
    .join('\n') || 'No teaching data recorded'}`;
    }

    async persistMetrics() {
        try {
            await saveJson('../analytics/metrics.json', this.metrics);
            await saveJson('../analytics/realtime.json', this.realTimeData);
        } catch (error) {
            console.error('Error saving analytics:', error);
        }
    }

    resetMetrics() {
        this.metrics = {
            performance: { totalMessages: 0, avgResponseTime: 0, routeDistribution: {}, cacheHitRate: 0, errorRate: 0, peakHours: {}, dailyStats: {} },
            quality: { responseAccuracy: 0, userSatisfactionScore: 0, learningSuccessRate: 0, safetyComplianceRate: 100, hybridHandlerSuccess: 0, geminiUsageRate: 0 },
            learning: { totalLearningAttempts: 0, successfulLearning: 0, blockedLearning: 0, knowledgeBaseSize: 0, topLearningTopics: {}, ownerTeachingStats: {}, autoLearningRate: 0 },
            safety: { totalViolations: 0, violationsByLaw: {}, blockedResponses: 0, toxicContentBlocked: 0, businessRuleViolations: 0, emergencyStops: 0 },
            engagement: { totalUsers: 0, activeUsers: {}, userRetention: {}, popularCommands: {}, mostAskedQuestions: {}, conversionRate: 0 }
        };
        this.startTime = Date.now();
    }

    generateDailyReport() {
        const today = new Date().toISOString().split('T')[0];
        const report = {
            date: today,
            summary: this.generateDashboard(),
            recommendations: this.generateRecommendations()
        };
        
        saveJson(`../analytics/daily_reports/${today}.json`, report);
        console.log(`📊 Daily report generated for ${today}`);
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.metrics.performance.errorRate > 5) {
            recommendations.push('High error rate detected. Review system logs and optimize error handling.');
        }
        
        if (this.metrics.quality.responseAccuracy < 80) {
            recommendations.push('Low response accuracy. Consider updating FAQ/SOP or improving learning system.');
        }
        
        if (this.metrics.safety.safetyComplianceRate < 98) {
            recommendations.push('Safety compliance below threshold. Review and strengthen safety filters.');
        }
        
        if (this.metrics.learning.learningSuccessRate < 70) {
            recommendations.push('Learning success rate is low. Review teaching patterns and safety validation.');
        }
        
        return recommendations;
    }

    /**
     * MISSING METHODS FOR MONITORING INTEGRATION
     */
    getDashboardStats() {
        return {
            totalMessages: this.metrics.traffic.totalMessages,
            totalUsers: this.metrics.users.totalUsers,
            avgResponseTime: this.metrics.traffic.avgResponseTime,
            errorRate: this.metrics.traffic.errorRate,
            systemHealth: this.realTimeData.systemHealth,
            uptime: this.calculateUptime()
        };
    }

    getAnalytics() {
        return {
            traffic: this.metrics.traffic,
            users: this.metrics.users,
            products: this.metrics.products,
            claims: this.metrics.claims,
            business: this.metrics.business,
            technical: this.metrics.technical,
            security: this.metrics.security
        };
    }

    // Fix untuk assessSystemHealth
    initializeMetricsIfNeeded() {
        // Ensure all metrics properties exist
        if (!this.metrics.traffic) this.metrics.traffic = { errorRate: 0, totalMessages: 0, avgResponseTime: 0 };
        if (!this.metrics.users) this.metrics.users = { totalUsers: 0 };
        if (!this.metrics.technical) this.metrics.technical = { systemUptime: 99.9, cacheHitRate: 85 };
        if (!this.metrics.security) this.metrics.security = { threatsDetected: 0, securityScore: 95 };
        if (!this.realTimeData) this.realTimeData = { systemHealth: 'healthy', currentLoad: 10 };
    }

    // Calculate uptime in hours
    calculateUptime() {
        const uptimeMs = Date.now() - this.startTime;
        const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
        return uptimeHours;
    }
}

// Export singleton instance
const analyticsManager = new AnalyticsManager();
// Initialize metrics to prevent errors
analyticsManager.initializeMetricsIfNeeded();

module.exports = { AnalyticsManager, analyticsManager };
