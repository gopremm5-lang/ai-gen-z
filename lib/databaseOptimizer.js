/**
 * DATABASE OPTIMIZER
 * Optimizes JSON file-based database performance with indexing and caching
 */

const fs = require('fs').promises;
const path = require('path');
const CONSTANTS = require('./constants');

class DatabaseOptimizer {
    constructor() {
        this.indexes = new Map();
        this.cache = new Map();
        this.cacheStats = {
            hits: 0,
            misses: 0,
            writes: 0
        };
        this.lastOptimization = Date.now();
    }

    /**
     * CREATE INDEX FOR FASTER LOOKUPS
     */
    createIndex(filename, fieldName, transformer = null) {
        const indexKey = `${filename}:${fieldName}`;
        
        if (!this.indexes.has(indexKey)) {
            this.indexes.set(indexKey, {
                filename,
                fieldName,
                transformer,
                index: new Map(),
                lastUpdated: 0
            });
        }
        
        return indexKey;
    }

    /**
     * BUILD OR REBUILD INDEX
     */
    async buildIndex(indexKey) {
        const indexConfig = this.indexes.get(indexKey);
        if (!indexConfig) return false;

        try {
            const data = await this.loadJsonFile(indexConfig.filename);
            const index = new Map();
            
            if (Array.isArray(data)) {
                data.forEach((item, idx) => {
                    let keyValue = item[indexConfig.fieldName];
                    
                    if (indexConfig.transformer) {
                        keyValue = indexConfig.transformer(keyValue);
                    }
                    
                    if (keyValue !== undefined) {
                        if (!index.has(keyValue)) {
                            index.set(keyValue, []);
                        }
                        index.get(keyValue).push({ data: item, index: idx });
                    }
                });
            } else if (data.users && Array.isArray(data.users)) {
                // Handle users.json format
                data.users.forEach((item, idx) => {
                    let keyValue = item[indexConfig.fieldName];
                    
                    if (indexConfig.transformer) {
                        keyValue = indexConfig.transformer(keyValue);
                    }
                    
                    if (keyValue !== undefined) {
                        if (!index.has(keyValue)) {
                            index.set(keyValue, []);
                        }
                        index.get(keyValue).push({ data: item, index: idx });
                    }
                });
            }
            
            indexConfig.index = index;
            indexConfig.lastUpdated = Date.now();
            
            console.log(`📊 Index built for ${indexKey}: ${index.size} entries`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to build index ${indexKey}:`, error.message);
            return false;
        }
    }

    /**
     * FIND USING INDEX
     */
    async findByIndex(indexKey, keyValue) {
        const indexConfig = this.indexes.get(indexKey);
        if (!indexConfig) return null;

        // Check if index needs rebuilding
        const fileModTime = await this.getFileModTime(indexConfig.filename);
        if (fileModTime > indexConfig.lastUpdated) {
            await this.buildIndex(indexKey);
        }

        return indexConfig.index.get(keyValue) || [];
    }

    /**
     * CACHED FILE OPERATIONS
     */
    async loadJsonFile(filename, useCache = true) {
        const cacheKey = `file:${filename}`;
        
        if (useCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            const fileModTime = await this.getFileModTime(filename);
            
            if (fileModTime <= cached.timestamp) {
                this.cacheStats.hits++;
                return cached.data;
            }
        }
        
        this.cacheStats.misses++;
        
        try {
            const filePath = this.resolveFilePath(filename);
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            
            if (useCache) {
                this.cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
                
                // Cleanup old cache entries
                if (this.cache.size > CONSTANTS.PERFORMANCE.MAX_CACHE_SIZE) {
                    this.cleanupCache();
                }
            }
            
            return data;
        } catch (error) {
            console.error(`❌ Failed to load ${filename}:`, error.message);
            return null;
        }
    }

    /**
     * SAVE WITH CACHE INVALIDATION
     */
    async saveJsonFile(filename, data) {
        try {
            const filePath = this.resolveFilePath(filename);
            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
            
            // Invalidate cache
            const cacheKey = `file:${filename}`;
            this.cache.delete(cacheKey);
            
            // Invalidate related indexes
            for (const [indexKey, indexConfig] of this.indexes) {
                if (indexConfig.filename === filename) {
                    indexConfig.lastUpdated = 0; // Force rebuild on next access
                }
            }
            
            this.cacheStats.writes++;
            return true;
        } catch (error) {
            console.error(`❌ Failed to save ${filename}:`, error.message);
            return false;
        }
    }

    /**
     * BATCH OPERATIONS
     */
    async batchOperation(operations) {
        const results = [];
        const filesToInvalidate = new Set();
        
        try {
            for (const op of operations) {
                switch (op.type) {
                    case 'read':
                        const data = await this.loadJsonFile(op.filename, op.useCache !== false);
                        results.push({ success: true, data });
                        break;
                        
                    case 'write':
                        const success = await this.saveJsonFile(op.filename, op.data);
                        results.push({ success });
                        filesToInvalidate.add(op.filename);
                        break;
                        
                    case 'find':
                        const found = await this.findByIndex(op.indexKey, op.keyValue);
                        results.push({ success: true, data: found });
                        break;
                        
                    default:
                        results.push({ success: false, error: 'Unknown operation' });
                }
            }
            
            return results;
        } catch (error) {
            console.error('❌ Batch operation failed:', error.message);
            return results;
        }
    }

    /**
     * OPTIMIZATION UTILITIES
     */
    async getFileModTime(filename) {
        try {
            const filePath = this.resolveFilePath(filename);
            const stats = await fs.stat(filePath);
            return stats.mtime.getTime();
        } catch {
            return 0;
        }
    }

    resolveFilePath(filename) {
        // Handle different file locations
        if (filename.includes('/')) {
            return path.join(__dirname, '..', filename);
        } else if (filename.includes('users.json')) {
            return path.join(__dirname, '../database', filename);
        } else {
            return path.join(__dirname, '../data', filename);
        }
    }

    cleanupCache() {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        // Remove oldest 25% of entries
        const toRemove = Math.floor(entries.length * 0.25);
        for (let i = 0; i < toRemove; i++) {
            this.cache.delete(entries[i][0]);
        }
    }

    /**
     * PERFORMANCE MONITORING
     */
    getStats() {
        return {
            cache: {
                size: this.cache.size,
                hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0,
                ...this.cacheStats
            },
            indexes: {
                count: this.indexes.size,
                keys: Array.from(this.indexes.keys())
            },
            lastOptimization: this.lastOptimization
        };
    }

    /**
     * FULL OPTIMIZATION
     */
    async performFullOptimization() {
        console.log('🚀 Starting database optimization...');
        
        try {
            // Rebuild all indexes
            for (const indexKey of this.indexes.keys()) {
                await this.buildIndex(indexKey);
            }
            
            // Clear old cache
            this.cache.clear();
            
            // Reset stats
            this.cacheStats = { hits: 0, misses: 0, writes: 0 };
            this.lastOptimization = Date.now();
            
            console.log('✅ Database optimization completed');
            return true;
        } catch (error) {
            console.error('❌ Database optimization failed:', error.message);
            return false;
        }
    }

    /**
     * INITIALIZE COMMON INDEXES
     */
    initializeIndexes() {
        // Users index by phone number
        this.createIndex('users.json', 'id');
        
        // Stock index by product name
        this.createIndex('stock.json', 'produk');
        
        // FAQ index by keyword
        this.createIndex('faq.json', 'keyword');
        
        // Claims index by user
        this.createIndex('log_claim.json', 'user');
        
        // Build initial indexes
        setTimeout(() => {
            this.performFullOptimization();
        }, 1000);
    }
}

// Export singleton instance
const databaseOptimizer = new DatabaseOptimizer();
databaseOptimizer.initializeIndexes();

module.exports = { databaseOptimizer, DatabaseOptimizer };
