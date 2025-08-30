/**
 * PERFORMANCE MANAGER
 * Advanced performance optimization & monitoring system
 * 
 * Features:
 * - Memory management & garbage collection
 * - Response caching with TTL
 * - Database query optimization  
 * - Resource monitoring
 * - Auto-cleanup mechanisms
 */

const fs = require('fs').promises;
const { loadJson, saveJson } = require('./dataLoader');

class PerformanceManager {
    constructor() {
        this.cache = new Map();
        this.cacheStats = {
            hits: 0,
            misses: 0,
            entries: 0,
            memoryUsage: 0
        };
        
        this.memoryThresholds = {
            warning: 80 * 1024 * 1024,    // 80MB
            critical: 120 * 1024 * 1024,  // 120MB
            cleanup: 150 * 1024 * 1024    // 150MB
        };
        
        this.queryCache = new Map();
        this.performanceMetrics = {
            responseTime: [],
            memoryUsage: [],
            cacheHitRatio: 0,
            activeConnections: 0,
            errorRate: 0
        };
        
        this.startMonitoring();
    }

    /**
     * ADVANCED CACHING SYSTEM
     */
    
    // Set cache dengan TTL dan priority
    setCache(key, value, ttl = 300000, priority = 1) { // 5 minutes default
        const entry = {
            value,
            timestamp: Date.now(),
            ttl,
            priority,
            hits: 0,
            size: this.calculateSize(value)
        };
        
        this.cache.set(key, entry);
        this.cacheStats.entries++;
        this.cacheStats.memoryUsage += entry.size;
        
        // Auto cleanup if memory threshold exceeded
        if (this.cacheStats.memoryUsage > this.memoryThresholds.warning) {
            this.optimizeCache();
        }
    }
    
    // Get cache dengan auto cleanup
    getCache(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.cacheStats.misses++;
            return null;
        }
        
        // Check TTL
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.cacheStats.entries--;
            this.cacheStats.memoryUsage -= entry.size;
            this.cacheStats.misses++;
            return null;
        }
        
        // Update hit stats
        entry.hits++;
        this.cacheStats.hits++;
        
        return entry.value;
    }
    
    // Intelligent cache optimization
    optimizeCache() {
        console.log('🧹 Optimizing cache...');
        
        const entries = Array.from(this.cache.entries());
        const now = Date.now();
        
        // Sort by priority and age
        entries.sort((a, b) => {
            const [keyA, entryA] = a;
            const [keyB, entryB] = b;
            
            // Expired entries first
            const expiredA = now - entryA.timestamp > entryA.ttl;
            const expiredB = now - entryB.timestamp > entryB.ttl;
            
            if (expiredA && !expiredB) return -1;
            if (!expiredA && expiredB) return 1;
            
            // Then by hit ratio / priority
            const scoreA = entryA.hits / (entryA.priority || 1);
            const scoreB = entryB.hits / (entryB.priority || 1);
            
            return scoreA - scoreB;
        });
        
        // Remove least valuable entries
        const toRemove = Math.floor(entries.length * 0.3); // Remove 30%
        
        for (let i = 0; i < toRemove; i++) {
            const [key, entry] = entries[i];
            this.cache.delete(key);
            this.cacheStats.entries--;
            this.cacheStats.memoryUsage -= entry.size;
        }
        
        console.log(`✅ Cache optimized: Removed ${toRemove} entries`);
    }
    
    /**
     * QUERY OPTIMIZATION
     */
    
    // Optimized data loading with caching
    async optimizedDataLoad(filename, transformer = null) {
        const cacheKey = `data_${filename}`;
        const cached = this.getCache(cacheKey);
        
        if (cached) return cached;
        
        try {
            let data = await loadJson(filename);
            
            if (transformer) {
                data = transformer(data);
            }
            
            // Cache for 10 minutes with high priority
            this.setCache(cacheKey, data, 600000, 3);
            
            return data;
        } catch (error) {
            console.error(`Error loading optimized data ${filename}:`, error);
            return null;
        }
    }
    
    // Batch processing untuk multiple queries
    async batchProcess(operations) {
        const startTime = Date.now();
        const results = await Promise.allSettled(operations);
        const duration = Date.now() - startTime;
        
        this.trackPerformance('batch_process', duration);
        
        return results.map(result => 
            result.status === 'fulfilled' ? result.value : null
        );
    }
    
    /**
     * MEMORY MANAGEMENT
     */
    
    // Force garbage collection if available
    forceGarbageCollection() {
        if (global.gc) {
            console.log('🗑️ Running garbage collection...');
            global.gc();
            console.log('✅ Garbage collection completed');
        }
    }
    
    // Memory monitoring
    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            rss: usage.rss,
            heapTotal: usage.heapTotal,
            heapUsed: usage.heapUsed,
            external: usage.external,
            arrayBuffers: usage.arrayBuffers,
            formatted: {
                rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
                heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`
            }
        };
    }
    
    // Auto memory cleanup
    autoMemoryCleanup() {
        const usage = this.getMemoryUsage();
        
        if (usage.heapUsed > this.memoryThresholds.critical) {
            console.log('⚠️ Critical memory usage detected, cleaning up...');
            
            // Clear old cache entries
            this.optimizeCache();
            
            // Clear old query cache
            this.queryCache.clear();
            
            // Force garbage collection
            this.forceGarbageCollection();
            
            console.log('✅ Memory cleanup completed');
        }
    }
    
    /**
     * PERFORMANCE TRACKING
     */
    
    trackPerformance(operation, duration, success = true) {
        this.performanceMetrics.responseTime.push({
            operation,
            duration,
            timestamp: Date.now(),
            success
        });
        
        // Keep only last 1000 entries
        if (this.performanceMetrics.responseTime.length > 1000) {
            this.performanceMetrics.responseTime = 
                this.performanceMetrics.responseTime.slice(-1000);
        }
        
        // Update cache hit ratio
        const total = this.cacheStats.hits + this.cacheStats.misses;
        this.performanceMetrics.cacheHitRatio = total > 0 ? 
            (this.cacheStats.hits / total) * 100 : 0;
    }
    
    // Performance analytics
    getPerformanceAnalytics() {
        const recentOps = this.performanceMetrics.responseTime.slice(-100);
        const avgResponseTime = recentOps.length > 0 ? 
            recentOps.reduce((sum, op) => sum + op.duration, 0) / recentOps.length : 0;
        
        return {
            averageResponseTime: Math.round(avgResponseTime),
            cacheHitRatio: Math.round(this.performanceMetrics.cacheHitRatio),
            memoryUsage: this.getMemoryUsage(),
            cacheStats: this.cacheStats,
            totalOperations: this.performanceMetrics.responseTime.length,
            recentErrorRate: this.calculateErrorRate(recentOps)
        };
    }
    
    calculateErrorRate(operations) {
        if (operations.length === 0) return 0;
        const errors = operations.filter(op => !op.success).length;
        return Math.round((errors / operations.length) * 100);
    }
    
    /**
     * MONITORING SYSTEM
     */
    
    startMonitoring() {
        // Memory monitoring every minute
        setInterval(() => {
            this.autoMemoryCleanup();
            this.performanceMetrics.memoryUsage.push({
                timestamp: Date.now(),
                ...this.getMemoryUsage()
            });
            
            // Keep only last 60 entries (1 hour)
            if (this.performanceMetrics.memoryUsage.length > 60) {
                this.performanceMetrics.memoryUsage = 
                    this.performanceMetrics.memoryUsage.slice(-60);
            }
        }, 60000);
        
        // Cache cleanup every 5 minutes
        setInterval(() => {
            this.cleanupExpiredCache();
        }, 300000);
        
        console.log('📊 Performance monitoring started');
    }
    
    cleanupExpiredCache() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key);
                this.cacheStats.entries--;
                this.cacheStats.memoryUsage -= entry.size;
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
        }
    }
    
    calculateSize(obj) {
        try {
            return JSON.stringify(obj).length * 2; // Rough estimation
        } catch {
            return 1024; // Default size if calculation fails
        }
    }
    
    /**
     * OWNER COMMANDS
     */
    
    handlePerformanceCommand(command, sender) {
        const config = require('../config');
        const ownerNumber = config.owner_number;
        const senderNumber = sender.split('@')[0];
        
        if (senderNumber !== ownerNumber) {
            return 'Perintah ini hanya bisa digunakan oleh owner.';
        }
        
        const cmd = command.toLowerCase().trim();
        
        if (cmd === 'performance stats') {
            const analytics = this.getPerformanceAnalytics();
            return `🚀 *PERFORMANCE STATISTICS*

⚡ *Response Performance:*
• Avg Response Time: ${analytics.averageResponseTime}ms
• Total Operations: ${analytics.totalOperations}
• Recent Error Rate: ${analytics.recentErrorRate}%

💾 *Memory Usage:*
• RSS: ${analytics.memoryUsage.formatted.rss}
• Heap Used: ${analytics.memoryUsage.formatted.heapUsed}
• Heap Total: ${analytics.memoryUsage.formatted.heapTotal}

🎯 *Cache Performance:*
• Hit Ratio: ${analytics.cacheHitRatio}%
• Cache Entries: ${analytics.cacheStats.entries}
• Cache Hits: ${analytics.cacheStats.hits}
• Cache Misses: ${analytics.cacheStats.misses}
• Memory Usage: ${Math.round(analytics.cacheStats.memoryUsage / 1024)}KB`;
        }
        
        if (cmd === 'performance optimize') {
            this.optimizeCache();
            this.autoMemoryCleanup();
            this.forceGarbageCollection();
            
            return '✅ Performance optimization completed:\n• Cache optimized\n• Memory cleaned\n• Garbage collection performed';
        }
        
        if (cmd === 'cache clear') {
            this.cache.clear();
            this.queryCache.clear();
            this.cacheStats = { hits: 0, misses: 0, entries: 0, memoryUsage: 0 };
            
            return '✅ All caches cleared successfully';
        }
        
        return null;
    }
}

// Singleton instance
const performanceManager = new PerformanceManager();

module.exports = { performanceManager };
