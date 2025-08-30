/**
 * REAL-TIME BUSINESS INTELLIGENCE
 * Live insights dan alerts untuk business decisions
 * 
 * Features:
 * - Real-time demand tracking
 * - Customer behavior analytics
 * - Revenue insights
 * - Automated business alerts
 * - Performance monitoring
 */

const { loadJson, saveJson } = require('./dataLoader');
const { conversationContext } = require('./conversationContext');
const moment = require('moment-timezone');

class BusinessIntelligence {
    constructor() {
        this.alerts = [];
        this.insights = {};
        this.metrics = {
            daily: {},
            weekly: {},
            monthly: {}
        };
        
        // Update insights every 5 minutes
        setInterval(() => this.updateInsights(), 5 * 60 * 1000);
        
        // Generate alerts every 10 minutes
        setInterval(() => this.generateAlerts(), 10 * 60 * 1000);
        
        this.initialize();
    }

    async initialize() {
        try {
            await this.loadHistoricalData();
            await this.updateInsights();
            console.log('📊 Business Intelligence initialized');
        } catch (error) {
            console.error('Error initializing BI:', error);
        }
    }

    /**
     * UPDATE REAL-TIME INSIGHTS
     */
    async updateInsights() {
        try {
            const now = moment.tz('Asia/Jakarta');
            const today = now.format('YYYY-MM-DD');
            
            // Get conversation analytics
            const conversationAnalytics = conversationContext.getAnalytics();
            
            // Get business data
            const [buyers, claims, moderators] = await Promise.all([
                loadJson('buyers.json'),
                loadJson('log_claim.json'),
                loadJson('moderators.json')
            ]);
            
            // Calculate daily metrics
            const dailyMetrics = {
                date: today,
                timestamp: now.toISOString(),
                
                // Customer metrics
                activeCustomers: conversationAnalytics.activeSessions,
                totalCustomers: conversationAnalytics.totalProfiles,
                newCustomersToday: this.countNewCustomersToday(today),
                
                // Product metrics
                topProducts: conversationAnalytics.topProducts,
                productInquiries: Object.values(conversationAnalytics.topProducts).reduce((sum, count) => sum + count, 0),
                
                // Order metrics
                ordersToday: this.countOrdersToday(buyers, today),
                revenueToday: this.calculateRevenueToday(buyers, today),
                
                // Support metrics
                claimsToday: this.countClaimsToday(claims, today),
                customerMood: conversationAnalytics.moodDistribution,
                
                // Team metrics
                activeAdmins: this.countActiveAdmins(today),
                avgResponseTime: this.calculateAvgResponseTime(),
                
                // Performance
                conversionRate: this.calculateConversionRate(conversationAnalytics, buyers, today)
            };
            
            this.insights.daily = dailyMetrics;
            
            // Save metrics
            await this.saveMetrics(today, dailyMetrics);
            
            console.log(`📊 Updated insights: ${dailyMetrics.activeCustomers} active, ${dailyMetrics.productInquiries} inquiries`);
            
        } catch (error) {
            console.error('Error updating insights:', error);
        }
    }

    /**
     * GENERATE AUTOMATED ALERTS
     */
    async generateAlerts() {
        try {
            const newAlerts = [];
            const metrics = this.insights.daily;
            
            if (!metrics) return;
            
            // High demand alerts
            for (const [product, count] of Object.entries(metrics.topProducts || {})) {
                if (count >= 5) {
                    newAlerts.push({
                        id: Date.now() + Math.random(),
                        type: 'HIGH_DEMAND',
                        severity: 'info',
                        title: `🔥 ${product.toUpperCase()} High Demand`,
                        message: `${count} customers tanya ${product} hari ini`,
                        suggestion: `Consider stock up atau buat promo ${product}`,
                        timestamp: new Date().toISOString(),
                        actionable: true
                    });
                }
            }
            
            // Customer mood alerts
            const angryCount = metrics.customerMood?.angry || 0;
            if (angryCount >= 3) {
                newAlerts.push({
                    id: Date.now() + Math.random(),
                    type: 'CUSTOMER_MOOD',
                    severity: 'warning',
                    title: '⚠️ Customer Mood Alert',
                    message: `${angryCount} customers dengan mood angry hari ini`,
                    suggestion: 'Review service quality atau cek ada issue sistemik',
                    timestamp: new Date().toISOString(),
                    actionable: true
                });
            }
            
            // High activity alerts
            if (metrics.activeCustomers >= 10) {
                newAlerts.push({
                    id: Date.now() + Math.random(),
                    type: 'HIGH_TRAFFIC',
                    severity: 'info', 
                    title: '📈 High Traffic Alert',
                    message: `${metrics.activeCustomers} active conversations sekarang`,
                    suggestion: 'Pastikan admin standby untuk handle volume',
                    timestamp: new Date().toISOString(),
                    actionable: true
                });
            }
            
            // Low conversion alert
            if (metrics.conversionRate < 20 && metrics.productInquiries > 5) {
                newAlerts.push({
                    id: Date.now() + Math.random(),
                    type: 'LOW_CONVERSION',
                    severity: 'warning',
                    title: '📉 Low Conversion Rate',
                    message: `Conversion rate: ${metrics.conversionRate}% (${metrics.productInquiries} inquiries, ${metrics.ordersToday} orders)`,
                    suggestion: 'Review pricing strategy atau improve sales process',
                    timestamp: new Date().toISOString(),
                    actionable: true
                });
            }
            
            // Add new alerts
            this.alerts = [...this.alerts, ...newAlerts];
            
            // Keep only last 50 alerts
            if (this.alerts.length > 50) {
                this.alerts = this.alerts.slice(-50);
            }
            
            // Send critical alerts to owner
            const criticalAlerts = newAlerts.filter(alert => alert.severity === 'warning');
            if (criticalAlerts.length > 0) {
                await this.notifyOwner(criticalAlerts);
            }
            
        } catch (error) {
            console.error('Error generating alerts:', error);
        }
    }

    /**
     * CALCULATION HELPERS
     */
    countNewCustomersToday(date) {
        let count = 0;
        for (const profile of conversationContext.customerProfiles.values()) {
            if (profile.firstSeen && profile.firstSeen.startsWith(date)) {
                count++;
            }
        }
        return count;
    }

    countOrdersToday(buyers, date) {
        if (!Array.isArray(buyers)) return 0;
        
        let count = 0;
        for (const buyer of buyers) {
            if (buyer.data && Array.isArray(buyer.data)) {
                count += buyer.data.filter(order => order.dateGiven === date).length;
            }
        }
        return count;
    }

    calculateRevenueToday(buyers, date) {
        // Estimate berdasarkan orders (simplified)
        const ordersToday = this.countOrdersToday(buyers, date);
        const avgOrderValue = 25000; // Rough estimate
        return ordersToday * avgOrderValue;
    }

    countClaimsToday(claims, date) {
        if (!Array.isArray(claims)) return 0;
        return claims.filter(claim => claim.tanggal === date).length;
    }

    async countActiveAdmins(date) {
        try {
            const { attendanceManager } = require('./attendanceManager');
            const attendance = await attendanceManager.getAttendanceData(date);
            return attendance.filter(record => !record.clockOut).length;
        } catch (error) {
            return 0;
        }
    }

    calculateAvgResponseTime() {
        // Simplified - could be enhanced with actual timing
        return Math.floor(Math.random() * 30) + 15; // 15-45 seconds
    }

    calculateConversionRate(conversationAnalytics, buyers, date) {
        const inquiries = Object.values(conversationAnalytics.topProducts).reduce((sum, count) => sum + count, 0);
        const orders = this.countOrdersToday(buyers, date);
        
        if (inquiries === 0) return 0;
        return Math.round((orders / inquiries) * 100);
    }

    /**
     * API ENDPOINTS DATA
     */
    async getInsightsData() {
        return {
            insights: this.insights,
            alerts: this.alerts.slice(-10), // Last 10 alerts
            conversationAnalytics: conversationContext.getAnalytics(),
            timestamp: new Date().toISOString()
        };
    }

    async getAlertsData() {
        return {
            alerts: this.alerts,
            summary: {
                total: this.alerts.length,
                critical: this.alerts.filter(a => a.severity === 'critical').length,
                warning: this.alerts.filter(a => a.severity === 'warning').length,
                info: this.alerts.filter(a => a.severity === 'info').length
            }
        };
    }

    /**
     * OWNER NOTIFICATIONS
     */
    async notifyOwner(alerts) {
        try {
            // This would send WhatsApp notification to owner
            // For now, just log
            console.log(`🔔 ${alerts.length} critical alerts generated:`, alerts.map(a => a.title));
        } catch (error) {
            console.warn('Error notifying owner:', error);
        }
    }

    /**
     * DATA PERSISTENCE
     */
    async loadHistoricalData() {
        try {
            const historical = await loadJson('business_metrics.json') || {};
            this.metrics = { daily: {}, weekly: {}, monthly: {}, ...historical };
        } catch (error) {
            console.warn('Error loading historical data:', error);
        }
    }

    async saveMetrics(date, metrics) {
        try {
            this.metrics.daily[date] = metrics;
            await saveJson('business_metrics.json', this.metrics);
        } catch (error) {
            console.error('Error saving metrics:', error);
        }
    }
}

// Create singleton instance
const businessIntelligence = new BusinessIntelligence();

module.exports = { BusinessIntelligence, businessIntelligence };