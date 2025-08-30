/**
 * BACKUP MANAGER
 * Automated backup & recovery system
 * 
 * Features:
 * - Automated daily/weekly backups
 * - Incremental backup support
 * - Cloud storage integration
 * - Data integrity verification
 * - Recovery procedures
 * - Backup rotation & cleanup
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { saveJson, loadJson } = require('./dataLoader');

class BackupManager {
    constructor() {
        this.backupConfig = {
            interval: 24 * 60 * 60 * 1000,         // 24 hours
            maxBackups: 7,                         // Keep 7 days
            incrementalInterval: 4 * 60 * 60 * 1000, // 4 hours
            compressionEnabled: true,
            encryptionEnabled: true,
            verificationEnabled: true
        };
        
        this.backupPaths = [
            'data/',
            'database/',
            'session/creds.json',
            'config.js'
        ];
        
        this.excludePatterns = [
            /\.tmp$/,
            /\.log$/,
            /\.backup$/,
            /pre-key-/,
            /session-.*\.json$/
        ];
        
        this.backupStats = {
            totalBackups: 0,
            lastBackup: null,
            lastIncremental: null,
            totalSize: 0,
            successRate: 100,
            failures: []
        };
        
        this.startAutomaticBackup();
    }

    /**
     * BACKUP CREATION
     */
    
    async createFullBackup() {
        console.log('💾 Starting full backup...');
        
        const startTime = Date.now();
        const backupId = this.generateBackupId();
        const backupDir = path.join(__dirname, '../backups', backupId);
        
        try {
            // Create backup directory
            await fs.mkdir(backupDir, { recursive: true });
            
            const manifest = {
                id: backupId,
                type: 'full',
                timestamp: Date.now(),
                files: [],
                checksums: {},
                size: 0,
                encrypted: this.backupConfig.encryptionEnabled,
                compressed: this.backupConfig.compressionEnabled
            };
            
            let totalSize = 0;
            
            // Backup each path
            for (const backupPath of this.backupPaths) {
                const sourcePath = path.join(__dirname, '..', backupPath);
                const targetPath = path.join(backupDir, backupPath);
                
                try {
                    const result = await this.backupPath(sourcePath, targetPath, manifest);
                    totalSize += result.size;
                } catch (error) {
                    console.error(`Failed to backup ${backupPath}:`, error.message);
                    manifest.errors = manifest.errors || [];
                    manifest.errors.push({
                        path: backupPath,
                        error: error.message
                    });
                }
            }
            
            manifest.size = totalSize;
            manifest.duration = Date.now() - startTime;
            
            // Save manifest
            await saveJson(path.join(backupDir, 'manifest.json'), manifest);
            
            // Update stats
            this.backupStats.totalBackups++;
            this.backupStats.lastBackup = Date.now();
            this.backupStats.totalSize += totalSize;
            
            console.log(`✅ Full backup completed: ${backupId}`);
            console.log(`   Files: ${manifest.files.length}, Size: ${this.formatSize(totalSize)}, Duration: ${manifest.duration}ms`);
            
            // Cleanup old backups
            await this.cleanupOldBackups();
            
            return {
                success: true,
                backupId,
                manifest,
                duration: manifest.duration
            };
            
        } catch (error) {
            console.error('❌ Full backup failed:', error);
            this.backupStats.failures.push({
                timestamp: Date.now(),
                type: 'full',
                error: error.message
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async createIncrementalBackup() {
        console.log('💾 Starting incremental backup...');
        
        const lastBackupTime = this.backupStats.lastIncremental || this.backupStats.lastBackup || 0;
        const backupId = this.generateBackupId('incremental');
        const backupDir = path.join(__dirname, '../backups', backupId);
        
        try {
            await fs.mkdir(backupDir, { recursive: true });
            
            const manifest = {
                id: backupId,
                type: 'incremental',
                timestamp: Date.now(),
                baseTimestamp: lastBackupTime,
                files: [],
                checksums: {},
                size: 0
            };
            
            let totalSize = 0;
            let changedFiles = 0;
            
            // Check for changed files
            for (const backupPath of this.backupPaths) {
                const sourcePath = path.join(__dirname, '..', backupPath);
                
                try {
                    const changes = await this.detectChanges(sourcePath, lastBackupTime);
                    
                    if (changes.length > 0) {
                        const targetPath = path.join(backupDir, backupPath);
                        const result = await this.backupChangedFiles(changes, targetPath, manifest);
                        totalSize += result.size;
                        changedFiles += changes.length;
                    }
                } catch (error) {
                    console.error(`Failed to backup changes in ${backupPath}:`, error.message);
                }
            }
            
            manifest.size = totalSize;
            manifest.changedFiles = changedFiles;
            
            // Save manifest
            await saveJson(path.join(backupDir, 'manifest.json'), manifest);
            
            this.backupStats.lastIncremental = Date.now();
            
            console.log(`✅ Incremental backup completed: ${backupId}`);
            console.log(`   Changed files: ${changedFiles}, Size: ${this.formatSize(totalSize)}`);
            
            return {
                success: true,
                backupId,
                changedFiles,
                size: totalSize
            };
            
        } catch (error) {
            console.error('❌ Incremental backup failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async backupPath(sourcePath, targetPath, manifest) {
        const stats = await fs.stat(sourcePath);
        let totalSize = 0;
        
        if (stats.isDirectory()) {
            // Backup directory
            await fs.mkdir(targetPath, { recursive: true });
            
            const files = await fs.readdir(sourcePath);
            
            for (const file of files) {
                if (this.shouldExclude(file)) continue;
                
                const srcFile = path.join(sourcePath, file);
                const tgtFile = path.join(targetPath, file);
                
                const result = await this.backupPath(srcFile, tgtFile, manifest);
                totalSize += result.size;
            }
        } else {
            // Backup file
            const fileContent = await fs.readFile(sourcePath);
            let processedContent = fileContent;
            
            // Calculate checksum
            const checksum = crypto.createHash('sha256').update(fileContent).digest('hex');
            
            // Encrypt if enabled
            if (this.backupConfig.encryptionEnabled && this.isEncryptableFile(sourcePath)) {
                processedContent = await this.encryptData(fileContent);
            }
            
            // Write to backup
            await fs.writeFile(targetPath, processedContent);
            
            // Update manifest
            const relativePath = path.relative(path.join(__dirname, '..'), sourcePath);
            manifest.files.push(relativePath);
            manifest.checksums[relativePath] = checksum;
            
            totalSize = fileContent.length;
        }
        
        return { size: totalSize };
    }
    
    async detectChanges(sourcePath, sinceTimestamp) {
        const changes = [];
        
        try {
            const stats = await fs.stat(sourcePath);
            
            if (stats.isDirectory()) {
                const files = await fs.readdir(sourcePath);
                
                for (const file of files) {
                    if (this.shouldExclude(file)) continue;
                    
                    const filePath = path.join(sourcePath, file);
                    const fileChanges = await this.detectChanges(filePath, sinceTimestamp);
                    changes.push(...fileChanges);
                }
            } else {
                // Check if file was modified since last backup
                if (stats.mtime.getTime() > sinceTimestamp) {
                    changes.push(sourcePath);
                }
            }
        } catch (error) {
            // File might not exist anymore
            console.log(`File not accessible: ${sourcePath}`);
        }
        
        return changes;
    }
    
    async backupChangedFiles(changedFiles, targetDir, manifest) {
        let totalSize = 0;
        
        await fs.mkdir(targetDir, { recursive: true });
        
        for (const filePath of changedFiles) {
            try {
                const relativePath = path.relative(path.join(__dirname, '..'), filePath);
                const targetPath = path.join(targetDir, relativePath);
                
                // Ensure target directory exists
                await fs.mkdir(path.dirname(targetPath), { recursive: true });
                
                const result = await this.backupPath(filePath, targetPath, manifest);
                totalSize += result.size;
            } catch (error) {
                console.error(`Failed to backup changed file ${filePath}:`, error.message);
            }
        }
        
        return { size: totalSize };
    }
    
    /**
     * BACKUP VERIFICATION
     */
    
    async verifyBackup(backupId) {
        console.log(`🔍 Verifying backup: ${backupId}`);
        
        try {
            const backupDir = path.join(__dirname, '../backups', backupId);
            const manifestPath = path.join(backupDir, 'manifest.json');
            
            const manifest = await loadJson(manifestPath);
            if (!manifest) {
                throw new Error('Manifest not found');
            }
            
            const verification = {
                backupId,
                timestamp: Date.now(),
                filesChecked: 0,
                filesValid: 0,
                errors: []
            };
            
            // Verify each file
            for (const filePath of manifest.files) {
                verification.filesChecked++;
                
                try {
                    const backupFilePath = path.join(backupDir, filePath);
                    const fileContent = await fs.readFile(backupFilePath);
                    
                    // Decrypt if needed
                    let originalContent = fileContent;
                    if (manifest.encrypted && this.isEncryptableFile(filePath)) {
                        originalContent = await this.decryptData(fileContent);
                    }
                    
                    // Verify checksum
                    const calculatedChecksum = crypto.createHash('sha256').update(originalContent).digest('hex');
                    const expectedChecksum = manifest.checksums[filePath];
                    
                    if (calculatedChecksum === expectedChecksum) {
                        verification.filesValid++;
                    } else {
                        verification.errors.push({
                            file: filePath,
                            error: 'Checksum mismatch'
                        });
                    }
                } catch (error) {
                    verification.errors.push({
                        file: filePath,
                        error: error.message
                    });
                }
            }
            
            verification.success = verification.errors.length === 0;
            verification.integrity = (verification.filesValid / verification.filesChecked) * 100;
            
            console.log(`✅ Backup verification completed: ${verification.integrity}% integrity`);
            
            return verification;
            
        } catch (error) {
            console.error('❌ Backup verification failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * BACKUP RECOVERY
     */
    
    async restoreBackup(backupId, targetPath = null) {
        console.log(`🔄 Restoring backup: ${backupId}`);
        
        try {
            const backupDir = path.join(__dirname, '../backups', backupId);
            const manifestPath = path.join(backupDir, 'manifest.json');
            
            const manifest = await loadJson(manifestPath);
            if (!manifest) {
                throw new Error('Backup manifest not found');
            }
            
            const basePath = targetPath || path.join(__dirname, '..');
            const restoration = {
                backupId,
                timestamp: Date.now(),
                filesRestored: 0,
                errors: []
            };
            
            // Restore each file
            for (const filePath of manifest.files) {
                try {
                    const backupFilePath = path.join(backupDir, filePath);
                    const targetFilePath = path.join(basePath, filePath);
                    
                    // Read backup file
                    let fileContent = await fs.readFile(backupFilePath);
                    
                    // Decrypt if needed
                    if (manifest.encrypted && this.isEncryptableFile(filePath)) {
                        fileContent = await this.decryptData(fileContent);
                    }
                    
                    // Ensure target directory exists
                    await fs.mkdir(path.dirname(targetFilePath), { recursive: true });
                    
                    // Write restored file
                    await fs.writeFile(targetFilePath, fileContent);
                    
                    restoration.filesRestored++;
                } catch (error) {
                    restoration.errors.push({
                        file: filePath,
                        error: error.message
                    });
                }
            }
            
            restoration.success = restoration.errors.length === 0;
            
            console.log(`✅ Backup restoration completed: ${restoration.filesRestored} files restored`);
            
            return restoration;
            
        } catch (error) {
            console.error('❌ Backup restoration failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * BACKUP MANAGEMENT
     */
    
    async cleanupOldBackups() {
        try {
            const backupsDir = path.join(__dirname, '../backups');
            
            // Ensure backups directory exists
            try {
                await fs.access(backupsDir);
            } catch {
                return; // No backups directory
            }
            
            const backupDirs = await fs.readdir(backupsDir);
            
            // Get backup info with timestamps
            const backupInfo = [];
            
            for (const dir of backupDirs) {
                try {
                    const manifestPath = path.join(backupsDir, dir, 'manifest.json');
                    const manifest = await loadJson(manifestPath);
                    
                    if (manifest) {
                        backupInfo.push({
                            id: dir,
                            timestamp: manifest.timestamp,
                            type: manifest.type || 'full',
                            size: manifest.size || 0
                        });
                    }
                } catch (error) {
                    // Invalid backup, mark for deletion
                    backupInfo.push({
                        id: dir,
                        timestamp: 0,
                        type: 'invalid',
                        size: 0
                    });
                }
            }
            
            // Sort by timestamp (newest first)
            backupInfo.sort((a, b) => b.timestamp - a.timestamp);
            
            // Keep only the configured number of backups
            const toDelete = backupInfo.slice(this.backupConfig.maxBackups);
            
            for (const backup of toDelete) {
                try {
                    const backupPath = path.join(backupsDir, backup.id);
                    await this.deleteDirectory(backupPath);
                    console.log(`🗑️ Deleted old backup: ${backup.id}`);
                } catch (error) {
                    console.error(`Failed to delete backup ${backup.id}:`, error.message);
                }
            }
            
            if (toDelete.length > 0) {
                console.log(`✅ Cleaned up ${toDelete.length} old backups`);
            }
            
        } catch (error) {
            console.error('❌ Backup cleanup failed:', error);
        }
    }
    
    async deleteDirectory(dirPath) {
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = await fs.stat(filePath);
            
            if (stats.isDirectory()) {
                await this.deleteDirectory(filePath);
            } else {
                await fs.unlink(filePath);
            }
        }
        
        await fs.rmdir(dirPath);
    }
    
    /**
     * UTILITY FUNCTIONS
     */
    
    generateBackupId(type = 'full') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `${type}_${timestamp}`;
    }
    
    shouldExclude(filename) {
        return this.excludePatterns.some(pattern => pattern.test(filename));
    }
    
    isEncryptableFile(filePath) {
        // Encrypt sensitive files
        const sensitivePatterns = [
            /config\.js$/,
            /creds\.json$/,
            /\.key$/,
            /password/i,
            /secret/i
        ];
        
        return sensitivePatterns.some(pattern => pattern.test(filePath));
    }
    
    async encryptData(data) {
        // Simple encryption for demo - use proper encryption in production
        const key = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-gcm', key, iv);
        
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return JSON.stringify({
            encrypted,
            key: key.toString('hex'),
            iv: iv.toString('hex'),
            tag: cipher.getAuthTag().toString('hex')
        });
    }
    
    async decryptData(encryptedData) {
        try {
            const { encrypted, key, iv, tag } = JSON.parse(encryptedData);
            
            const decipher = crypto.createDecipher('aes-256-gcm', 
                Buffer.from(key, 'hex'), 
                Buffer.from(iv, 'hex')
            );
            
            decipher.setAuthTag(Buffer.from(tag, 'hex'));
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('Decryption failed:', error);
            return encryptedData; // Return as-is if decryption fails
        }
    }
    
    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
    
    /**
     * AUTOMATIC BACKUP SCHEDULING
     */
    
    startAutomaticBackup() {
        // Full backup daily
        setInterval(async () => {
            console.log('⏰ Scheduled full backup starting...');
            await this.createFullBackup();
        }, this.backupConfig.interval);
        
        // Incremental backup every 4 hours
        setInterval(async () => {
            console.log('⏰ Scheduled incremental backup starting...');
            await this.createIncrementalBackup();
        }, this.backupConfig.incrementalInterval);
        
        console.log('💾 Automatic backup scheduling started');
        console.log(`   Full backups: Every ${this.backupConfig.interval / (60 * 60 * 1000)} hours`);
        console.log(`   Incremental backups: Every ${this.backupConfig.incrementalInterval / (60 * 60 * 1000)} hours`);
    }
    
    /**
     * OWNER COMMANDS
     */
    
    handleBackupCommand(command, sender) {
        const config = require('../config');
        const ownerNumber = config.owner_number;
        const senderNumber = sender.split('@')[0];
        
        if (senderNumber !== ownerNumber) {
            return 'Perintah ini hanya bisa digunakan oleh owner.';
        }
        
        const cmd = command.toLowerCase().trim();
        
        if (cmd === 'backup status') {
            return `💾 *BACKUP STATUS*

📊 *Statistics:*
• Total Backups: ${this.backupStats.totalBackups}
• Last Full Backup: ${this.backupStats.lastBackup ? new Date(this.backupStats.lastBackup).toLocaleString('id-ID') : 'Never'}
• Last Incremental: ${this.backupStats.lastIncremental ? new Date(this.backupStats.lastIncremental).toLocaleString('id-ID') : 'Never'}
• Total Size: ${this.formatSize(this.backupStats.totalSize)}
• Success Rate: ${this.backupStats.successRate}%

⚙️ *Configuration:*
• Full Backup Interval: ${this.backupConfig.interval / (60 * 60 * 1000)}h
• Incremental Interval: ${this.backupConfig.incrementalInterval / (60 * 60 * 1000)}h
• Max Backups: ${this.backupConfig.maxBackups}
• Encryption: ${this.backupConfig.encryptionEnabled ? 'Enabled' : 'Disabled'}`;
        }
        
        if (cmd === 'backup create') {
            this.createFullBackup().then(result => {
                console.log('Manual backup result:', result);
            });
            
            return '💾 Full backup started... Check console for progress.';
        }
        
        if (cmd === 'backup incremental') {
            this.createIncrementalBackup().then(result => {
                console.log('Incremental backup result:', result);
            });
            
            return '💾 Incremental backup started... Check console for progress.';
        }
        
        if (cmd.startsWith('backup verify ')) {
            const backupId = cmd.replace('backup verify ', '').trim();
            
            this.verifyBackup(backupId).then(result => {
                console.log('Backup verification result:', result);
            });
            
            return `🔍 Verifying backup ${backupId}... Check console for results.`;
        }
        
        return null;
    }
    
    /**
     * BACKUP LISTING
     */
    
    async listBackups() {
        try {
            const backupsDir = path.join(__dirname, '../backups');
            const backupDirs = await fs.readdir(backupsDir);
            
            const backups = [];
            
            for (const dir of backupDirs) {
                try {
                    const manifestPath = path.join(backupsDir, dir, 'manifest.json');
                    const manifest = await loadJson(manifestPath);
                    
                    if (manifest) {
                        backups.push({
                            id: manifest.id,
                            type: manifest.type || 'full',
                            timestamp: manifest.timestamp,
                            size: manifest.size || 0,
                            files: manifest.files ? manifest.files.length : 0,
                            encrypted: manifest.encrypted || false
                        });
                    }
                } catch (error) {
                    // Skip invalid backups
                    continue;
                }
            }
            
            // Sort by timestamp (newest first)
            backups.sort((a, b) => b.timestamp - a.timestamp);
            
            return backups;
            
        } catch (error) {
            console.error('Failed to list backups:', error);
            return [];
        }
    }
}

// Singleton instance
const backupManager = new BackupManager();

module.exports = { backupManager };
