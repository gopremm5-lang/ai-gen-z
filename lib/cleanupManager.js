/**
 * CLEANUP MANAGER
 * Automated system cleanup & maintenance
 * 
 * Features:
 * - Session file cleanup
 * - Temporary file management
 * - Log rotation
 * - Database optimization
 * - Memory cleanup
 * - Redundant code removal
 */

const fs = require('fs').promises;
const path = require('path');
const { CONSTANTS } = require('./constants');

class CleanupManager {
    constructor() {
        this.cleanupStats = {
            sessionsDeleted: 0,
            tempFilesDeleted: 0,
            logsRotated: 0,
            memoryFreed: 0,
            lastCleanup: null
        };
        
        this.cleanupSchedule = {
            tempFiles: 30 * 60 * 1000,      // 30 minutes
            sessionFiles: 24 * 60 * 60 * 1000, // 24 hours
            logRotation: 24 * 60 * 60 * 1000,  // 24 hours
            memoryCleanup: 60 * 60 * 1000      // 1 hour
        };
        
        this.startAutomaticCleanup();
    }

    /**
     * SESSION FILE CLEANUP
     */
    
    async cleanupSessionFiles() {
        console.log('🧹 Starting session file cleanup...');
        
        try {
            const sessionDir = path.join(__dirname, '../session');
            const files = await fs.readdir(sessionDir);
            
            let deletedCount = 0;
            const now = Date.now();
            
            for (const file of files) {
                const filePath = path.join(sessionDir, file);
                const stats = await fs.stat(filePath);
                
                // Delete files older than 7 days or temporary pre-keys
                const isOld = now - stats.mtime.getTime() > 7 * 24 * 60 * 60 * 1000;
                const isTemp = file.startsWith('pre-key-') && !file.includes('.json');
                
                if (isOld || isTemp || this.isObsoleteSessionFile(file)) {
                    try {
                        await fs.unlink(filePath);
                        deletedCount++;
                        console.log(`   Deleted: ${file}`);
                    } catch (error) {
                        console.error(`   Failed to delete ${file}:`, error.message);
                    }
                }
            }
            
            this.cleanupStats.sessionsDeleted += deletedCount;
            console.log(`✅ Session cleanup completed: ${deletedCount} files deleted`);
            
            return deletedCount;
        } catch (error) {
            console.error('❌ Session cleanup failed:', error);
            return 0;
        }
    }
    
    isObsoleteSessionFile(filename) {
        // Identify obsolete session patterns
        const obsoletePatterns = [
            /^app-state-sync-key-.*\.json$/,    // Old sync keys
            /^session-.*\.0\.json$/,            // Failed session files
            /^pre-key-[0-9]+\.json$/            // Unused pre-keys
        ];
        
        return obsoletePatterns.some(pattern => pattern.test(filename));
    }
    
    /**
     * TEMPORARY FILE CLEANUP
     */
    
    async cleanupTempFiles() {
        console.log('🧹 Starting temporary file cleanup...');
        
        try {
            const tempDir = path.join(__dirname, '../tmp');
            
            // Ensure tmp directory exists
            try {
                await fs.access(tempDir);
            } catch {
                await fs.mkdir(tempDir, { recursive: true });
                console.log('   Created tmp directory');
                return 0;
            }
            
            const files = await fs.readdir(tempDir);
            let deletedCount = 0;
            const now = Date.now();
            
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                
                try {
                    const stats = await fs.stat(filePath);
                    
                    // Delete files older than 1 hour
                    if (now - stats.mtime.getTime() > 60 * 60 * 1000) {
                        await fs.unlink(filePath);
                        deletedCount++;
                        console.log(`   Deleted temp file: ${file}`);
                    }
                } catch (error) {
                    // File might have been deleted already
                    console.log(`   Skipped ${file}: ${error.message}`);
                }
            }
            
            this.cleanupStats.tempFilesDeleted += deletedCount;
            console.log(`✅ Temp cleanup completed: ${deletedCount} files deleted`);
            
            return deletedCount;
        } catch (error) {
            console.error('❌ Temp cleanup failed:', error);
            return 0;
        }
    }
    
    /**
     * LOG FILE MANAGEMENT
     */
    
    async rotateLogFiles() {
        console.log('🧹 Starting log file rotation...');
        
        try {
            const logFiles = [
                'bot.log',
                'error.log',
                'security.log',
                'performance.log'
            ];
            
            let rotatedCount = 0;
            
            for (const logFile of logFiles) {
                const logPath = path.join(__dirname, '../logs', logFile);
                
                try {
                    const stats = await fs.stat(logPath);
                    const fileSizeMB = stats.size / (1024 * 1024);
                    
                    // Rotate if file is larger than 10MB
                    if (fileSizeMB > 10) {
                        await this.rotateLogFile(logPath);
                        rotatedCount++;
                    }
                } catch (error) {
                    // Log file doesn't exist, skip
                    continue;
                }
            }
            
            this.cleanupStats.logsRotated += rotatedCount;
            console.log(`✅ Log rotation completed: ${rotatedCount} files rotated`);
            
            return rotatedCount;
        } catch (error) {
            console.error('❌ Log rotation failed:', error);
            return 0;
        }
    }
    
    async rotateLogFile(logPath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = `${logPath}.${timestamp}`;
        
        // Move current log to rotated name
        await fs.rename(logPath, rotatedPath);
        
        // Create new empty log file
        await fs.writeFile(logPath, '');
        
        console.log(`   Rotated: ${path.basename(logPath)}`);
        
        // Clean up old rotated logs (keep only last 5)
        await this.cleanupOldRotatedLogs(logPath);
    }
    
    async cleanupOldRotatedLogs(basePath) {
        try {
            const dir = path.dirname(basePath);
            const baseName = path.basename(basePath);
            const files = await fs.readdir(dir);
            
            // Find all rotated versions of this log
            const rotatedFiles = files
                .filter(file => file.startsWith(`${baseName}.`))
                .map(file => ({
                    name: file,
                    path: path.join(dir, file)
                }));
            
            // Sort by modification time (newest first)
            const fileStats = await Promise.all(
                rotatedFiles.map(async (file) => {
                    const stats = await fs.stat(file.path);
                    return { ...file, mtime: stats.mtime };
                })
            );
            
            fileStats.sort((a, b) => b.mtime - a.mtime);
            
            // Delete all but the 5 newest
            for (let i = 5; i < fileStats.length; i++) {
                await fs.unlink(fileStats[i].path);
                console.log(`   Deleted old log: ${fileStats[i].name}`);
            }
        } catch (error) {
            console.error('   Failed to cleanup old logs:', error.message);
        }
    }
    
    /**
     * DATABASE OPTIMIZATION
     */
    
    async optimizeDatabases() {
        console.log('🧹 Starting database optimization...');
        
        try {
            const dataFiles = [
                'data/buyers.json',
                'data/claimsReplace.json',
                'data/claimsReset.json',
                'data/log_claim.json',
                'database/users.json'
            ];
            
            let optimizedCount = 0;
            
            for (const dataFile of dataFiles) {
                const optimized = await this.optimizeDataFile(dataFile);
                if (optimized) optimizedCount++;
            }
            
            console.log(`✅ Database optimization completed: ${optimizedCount} files optimized`);
            
            return optimizedCount;
        } catch (error) {
            console.error('❌ Database optimization failed:', error);
            return 0;
        }
    }
    
    async optimizeDataFile(filePath) {
        try {
            const fullPath = path.join(__dirname, '..', filePath);
            
            // Check if file exists
            try {
                await fs.access(fullPath);
            } catch {
                console.log(`   Skipped ${filePath}: File not found`);
                return false;
            }
            
            // Read and parse JSON
            const data = JSON.parse(await fs.readFile(fullPath, 'utf8'));
            
            // Optimize based on file type
            let optimized = false;
            
            if (Array.isArray(data)) {
                // Remove duplicates and null entries
                const originalLength = data.length;
                const cleaned = data.filter((item, index, self) => {
                    if (!item) return false;
                    if (typeof item === 'object' && item.id) {
                        return self.findIndex(i => i && i.id === item.id) === index;
                    }
                    return true;
                });
                
                if (cleaned.length !== originalLength) {
                    await fs.writeFile(fullPath, JSON.stringify(cleaned, null, 2));
                    console.log(`   Optimized ${filePath}: ${originalLength - cleaned.length} items removed`);
                    optimized = true;
                }
            } else if (typeof data === 'object') {
                // Remove null/undefined values
                const cleaned = Object.fromEntries(
                    Object.entries(data).filter(([key, value]) => 
                        value !== null && value !== undefined && key !== ''
                    )
                );
                
                if (Object.keys(cleaned).length !== Object.keys(data).length) {
                    await fs.writeFile(fullPath, JSON.stringify(cleaned, null, 2));
                    console.log(`   Optimized ${filePath}: Invalid entries removed`);
                    optimized = true;
                }
            }
            
            return optimized;
        } catch (error) {
            console.error(`   Failed to optimize ${filePath}:`, error.message);
            return false;
        }
    }
    
    /**
     * MEMORY CLEANUP
     */
    
    performMemoryCleanup() {
        const memoryUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        const MEMORY_THRESHOLD_MB = 3072; // 3GB threshold
        
        console.log(`🧹 Memory check: ${heapUsedMB}MB used (threshold: ${MEMORY_THRESHOLD_MB}MB)`);
        
        // Only cleanup if memory usage exceeds 3GB
        if (heapUsedMB < MEMORY_THRESHOLD_MB) {
            console.log(`✅ Memory usage within limits, skipping cleanup`);
            return 0;
        }
        
        console.log(`🚨 Memory usage critical: ${heapUsedMB}MB`);
        console.log('🧹 Auto-triggering memory cleanup...');
        
        const before = process.memoryUsage();
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
        
        // Clear require cache for non-core modules
        this.clearRequireCache();
        
        // Clear old conversation histories (keep only recent ones)
        this.cleanupConversationHistories();
        
        const after = process.memoryUsage();
        const freedMB = Math.round((before.heapUsed - after.heapUsed) / 1024 / 1024);
        
        this.cleanupStats.memoryFreed += Math.max(0, freedMB);
        
        console.log(`✅ Memory cleanup completed: ${freedMB}MB freed`);
        console.log(`   Heap: ${Math.round(after.heapUsed / 1024 / 1024)}MB`);
        
        // Check system health after cleanup
        const finalHeapMB = Math.round(after.heapUsed / 1024 / 1024);
        if (finalHeapMB > MEMORY_THRESHOLD_MB * 0.9) {
            console.log('⚠️ Memory still high after cleanup, system may need restart');
        }
        
        return freedMB;
    }
    
    cleanupConversationHistories() {
        try {
            if (global.conversationHistories) {
                const CONVERSATION_RETENTION_DAYS = 456; // 1 year 3 months (15 months)
                const cutoffTime = Date.now() - (CONVERSATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
                
                let cleanedCount = 0;
                const userIds = Object.keys(global.conversationHistories);
                
                for (const userId of userIds) {
                    const conversations = global.conversationHistories[userId];
                    if (Array.isArray(conversations)) {
                        // Keep only conversations from last 15 months, but keep at least 10 recent exchanges
                        const recentConversations = conversations.slice(-20); // Keep last 20 exchanges minimum
                        
                        if (recentConversations.length < conversations.length) {
                            global.conversationHistories[userId] = recentConversations;
                            cleanedCount++;
                        }
                    }
                }
                
                console.log(`   Cleaned ${cleanedCount} conversation histories (retention: ${CONVERSATION_RETENTION_DAYS} days)`);
            }
        } catch (error) {
            console.error('   Failed to cleanup conversation histories:', error.message);
        }
    }
    
    clearRequireCache() {
        const moduleExtensions = ['.json', '.js'];
        const keepModules = [
            'constants',
            'config',
            'package.json'
        ];
        
        Object.keys(require.cache).forEach(modulePath => {
            const isAppModule = modulePath.includes(__dirname);
            const isJsonOrJs = moduleExtensions.some(ext => modulePath.endsWith(ext));
            const shouldKeep = keepModules.some(keep => modulePath.includes(keep));
            
            if (isAppModule && isJsonOrJs && !shouldKeep) {
                delete require.cache[modulePath];
            }
        });
    }
    
    /**
     * REDUNDANT CODE REMOVAL
     */
    
    async removeRedundantFiles() {
        console.log('🧹 Starting redundant file removal...');
        
        try {
            const redundantPatterns = [
                /\.backup$/,
                /\.tmp$/,
                /\.old$/,
                /\~$/,
                /\.bak$/
            ];
            
            let deletedCount = 0;
            
            // Check common directories
            const dirsToCheck = [
                path.join(__dirname, '../data'),
                path.join(__dirname, '../database'),
                path.join(__dirname, '../lib'),
                path.join(__dirname, '../tmp')
            ];
            
            for (const dir of dirsToCheck) {
                try {
                    const files = await fs.readdir(dir);
                    
                    for (const file of files) {
                        const shouldDelete = redundantPatterns.some(pattern => 
                            pattern.test(file)
                        );
                        
                        if (shouldDelete) {
                            const filePath = path.join(dir, file);
                            await fs.unlink(filePath);
                            deletedCount++;
                            console.log(`   Deleted redundant: ${file}`);
                        }
                    }
                } catch (error) {
                    // Directory doesn't exist, skip
                    continue;
                }
            }
            
            console.log(`✅ Redundant file removal completed: ${deletedCount} files deleted`);
            
            return deletedCount;
        } catch (error) {
            console.error('❌ Redundant file removal failed:', error);
            return 0;
        }
    }
    
    /**
     * COMPREHENSIVE CLEANUP
     */
    
    async performFullCleanup() {
        console.log('🧹 Starting comprehensive system cleanup...');
        
        const startTime = Date.now();
        const results = {
            sessions: 0,
            tempFiles: 0,
            logs: 0,
            databases: 0,
            memory: 0,
            redundant: 0
        };
        
        try {
            // Run all cleanup operations
            results.sessions = await this.cleanupSessionFiles();
            results.tempFiles = await this.cleanupTempFiles();
            results.logs = await this.rotateLogFiles();
            results.databases = await this.optimizeDatabases();
            results.memory = this.performMemoryCleanup();
            results.redundant = await this.removeRedundantFiles();
            
            const duration = Date.now() - startTime;
            this.cleanupStats.lastCleanup = new Date().toISOString();
            
            console.log(`✅ Full cleanup completed in ${duration}ms`);
            
            return results;
        } catch (error) {
            console.error('❌ Full cleanup failed:', error);
            return results;
        }
    }
    
    /**
     * AUTOMATIC CLEANUP SCHEDULING
     */
    
    startAutomaticCleanup() {
        // Temp files cleanup every 30 minutes
        setInterval(() => {
            this.cleanupTempFiles();
        }, this.cleanupSchedule.tempFiles);
        
        // Session files cleanup daily
        setInterval(() => {
            this.cleanupSessionFiles();
        }, this.cleanupSchedule.sessionFiles);
        
        // Log rotation daily
        setInterval(() => {
            this.rotateLogFiles();
        }, this.cleanupSchedule.logRotation);
        
        // Memory cleanup hourly
        setInterval(() => {
            this.performMemoryCleanup();
        }, this.cleanupSchedule.memoryCleanup);
        
        console.log('🧹 Automatic cleanup scheduler started');
    }
    
    /**
     * OWNER COMMANDS
     */
    
    handleCleanupCommand(command, sender) {
        const config = require('../config');
        const ownerNumber = config.owner_number;
        const senderNumber = sender.split('@')[0];
        
        if (senderNumber !== ownerNumber) {
            return 'Perintah ini hanya bisa digunakan oleh owner.';
        }
        
        const cmd = command.toLowerCase().trim();
        
        if (cmd === 'cleanup status') {
            return `🧹 *CLEANUP STATUS*

📊 *Cleanup Statistics:*
• Sessions Deleted: ${this.cleanupStats.sessionsDeleted}
• Temp Files Deleted: ${this.cleanupStats.tempFilesDeleted}
• Logs Rotated: ${this.cleanupStats.logsRotated}
• Memory Freed: ${this.cleanupStats.memoryFreed}MB
• Last Cleanup: ${this.cleanupStats.lastCleanup || 'Never'}

⚙️ *Next Scheduled:*
• Temp Files: Every 30 minutes
• Session Files: Every 24 hours
• Log Rotation: Every 24 hours
• Memory Cleanup: Every hour`;
        }
        
        if (cmd === 'cleanup run') {
            this.performFullCleanup().then(results => {
                console.log('Manual cleanup completed:', results);
            });
            
            return '🧹 Full system cleanup started... Check console for progress.';
        }
        
        if (cmd === 'cleanup memory') {
            const freed = this.performMemoryCleanup();
            return `🧹 Memory cleanup completed: ${freed}MB freed`;
        }
        
        return null;
    }
    
    /**
     * CLEANUP STATISTICS
     */
    
    getCleanupStats() {
        return {
            ...this.cleanupStats,
            currentMemory: process.memoryUsage(),
            scheduleStatus: {
                tempFiles: 'Active',
                sessionFiles: 'Active',
                logRotation: 'Active',
                memoryCleanup: 'Active'
            }
        };
    }
}

// Singleton instance
const cleanupManager = new CleanupManager();

module.exports = { cleanupManager };
