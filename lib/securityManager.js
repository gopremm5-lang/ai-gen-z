/**
 * SECURITY MANAGER
 * Advanced security hardening & monitoring system
 * 
 * Features:
 * - Data encryption/decryption
 * - Advanced spam detection
 * - Intrusion detection system
 * - Session security
 * - Rate limiting
 * - Security event logging
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { loadJson, saveJson } = require('./dataLoader');

class SecurityManager {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32;
        this.ivLength = 16;
        this.tagLength = 16;
        
        // Security configurations
        this.securityConfig = {
            maxLoginAttempts: 5,
            lockoutDuration: 15 * 60 * 1000, // 15 minutes
            sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
            maxRequestsPerMinute: 60,
            suspiciousActivityThreshold: 10
        };
        
        // Security monitoring
        this.securityEvents = [];
        this.activeThreats = new Map();
        this.rateLimitMap = new Map();
        this.failedAttempts = new Map();
        
        this.startSecurityMonitoring();
    }

    /**
     * ENCRYPTION & DECRYPTION
     */
    
    // Generate encryption key from password
    generateKey(password, salt) {
        return crypto.pbkdf2Sync(password, salt, 100000, this.keyLength, 'sha512');
    }
    
    // Encrypt sensitive data
    encrypt(data, password) {
        try {
            const salt = crypto.randomBytes(32);
            const key = this.generateKey(password, salt);
            const iv = crypto.randomBytes(this.ivLength);
            
            const cipher = crypto.createCipher(this.algorithm, key, iv);
            
            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const tag = cipher.getAuthTag();
            
            return {
                encrypted,
                salt: salt.toString('hex'),
                iv: iv.toString('hex'),
                tag: tag.toString('hex')
            };
        } catch (error) {
            console.error('❌ Encryption failed:', error);
            return null;
        }
    }
    
    // Decrypt sensitive data
    decrypt(encryptedData, password) {
        try {
            const { encrypted, salt, iv, tag } = encryptedData;
            
            const key = this.generateKey(password, Buffer.from(salt, 'hex'));
            const decipher = crypto.createDecipher(
                this.algorithm, 
                key, 
                Buffer.from(iv, 'hex')
            );
            
            decipher.setAuthTag(Buffer.from(tag, 'hex'));
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('❌ Decryption failed:', error);
            return null;
        }
    }
    
    /**
     * SPAM DETECTION SYSTEM
     */
    
    // Advanced spam detection
    detectSpam(message, sender, context = {}) {
        const spamScore = this.calculateSpamScore(message, sender, context);
        const isSpam = spamScore > 0.7;
        
        if (isSpam) {
            this.logSecurityEvent('spam_detected', sender, {
                message: message.substring(0, 100),
                score: spamScore,
                reasons: this.getSpamReasons(message, context)
            });
        }
        
        return {
            isSpam,
            score: spamScore,
            confidence: spamScore > 0.8 ? 'high' : spamScore > 0.5 ? 'medium' : 'low'
        };
    }
    
    calculateSpamScore(message, sender, context) {
        let score = 0;
        const lowerMessage = message.toLowerCase();
        
        // 1. Repetitive content
        if (this.isRepetitive(message)) score += 0.3;
        
        // 2. Excessive caps
        if (this.hasExcessiveCaps(message)) score += 0.2;
        
        // 3. Suspicious patterns
        if (this.hasSuspiciousPatterns(lowerMessage)) score += 0.4;
        
        // 4. Rapid fire messaging
        if (this.isRapidFire(sender)) score += 0.3;
        
        // 5. Known spam phrases
        if (this.containsSpamPhrases(lowerMessage)) score += 0.5;
        
        // 6. Excessive links or mentions
        if (this.hasExcessiveLinks(message)) score += 0.4;
        
        return Math.min(score, 1.0);
    }
    
    isRepetitive(message) {
        const chars = message.split('');
        const uniqueChars = new Set(chars);
        return uniqueChars.size / chars.length < 0.3;
    }
    
    hasExcessiveCaps(message) {
        const caps = message.match(/[A-Z]/g) || [];
        return caps.length / message.length > 0.7;
    }
    
    hasSuspiciousPatterns(message) {
        const suspiciousPatterns = [
            /(.)\1{4,}/g,           // Repeated characters
            /\b\d{4,}\b/g,          // Long numbers
            /[!]{3,}/g,             // Multiple exclamations
            /[?]{3,}/g,             // Multiple questions
            /[.]{4,}/g              // Multiple dots
        ];
        
        return suspiciousPatterns.some(pattern => pattern.test(message));
    }
    
    isRapidFire(sender) {
        const now = Date.now();
        const userRequests = this.rateLimitMap.get(sender) || [];
        
        // Count messages in last minute
        const recentRequests = userRequests.filter(time => now - time < 60000);
        
        return recentRequests.length > 10;
    }
    
    containsSpamPhrases(message) {
        const spamPhrases = [
            'click here', 'free money', 'urgent', 'limited time',
            'act now', 'congratulations', 'winner', 'prize',
            'guaranteed', 'no cost', 'risk free', 'earn money'
        ];
        
        return spamPhrases.some(phrase => message.includes(phrase));
    }
    
    hasExcessiveLinks(message) {
        const linkPattern = /https?:\/\/[^\s]+/g;
        const links = message.match(linkPattern) || [];
        return links.length > 2;
    }
    
    getSpamReasons(message, context) {
        const reasons = [];
        
        if (this.isRepetitive(message)) reasons.push('repetitive_content');
        if (this.hasExcessiveCaps(message)) reasons.push('excessive_caps');
        if (this.hasSuspiciousPatterns(message)) reasons.push('suspicious_patterns');
        if (this.containsSpamPhrases(message)) reasons.push('spam_phrases');
        if (this.hasExcessiveLinks(message)) reasons.push('excessive_links');
        
        return reasons;
    }
    
    /**
     * INTRUSION DETECTION SYSTEM
     */
    
    // Detect suspicious activity
    detectIntrusion(activity, source, context = {}) {
        const threat = this.analyzeThreat(activity, source, context);
        
        if (threat.level >= 3) {
            this.handleThreat(threat);
        }
        
        return threat;
    }
    
    analyzeThreat(activity, source, context) {
        let threatLevel = 0;
        const indicators = [];
        
        // Failed authentication attempts
        if (activity.type === 'failed_auth') {
            threatLevel += 2;
            indicators.push('authentication_failure');
        }
        
        // Unusual access patterns
        if (this.isUnusualAccess(activity, source)) {
            threatLevel += 1;
            indicators.push('unusual_access');
        }
        
        // Rate limit violations
        if (this.isRateLimitViolation(source)) {
            threatLevel += 1;
            indicators.push('rate_limit_violation');
        }
        
        // Suspicious commands
        if (this.isSuspiciousCommand(activity)) {
            threatLevel += 2;
            indicators.push('suspicious_command');
        }
        
        return {
            level: threatLevel,
            indicators,
            source,
            timestamp: Date.now(),
            severity: this.getThreatSeverity(threatLevel)
        };
    }
    
    isUnusualAccess(activity, source) {
        // Check for access from new locations or unusual times
        const hour = new Date().getHours();
        const isOffHours = hour < 6 || hour > 22;
        
        return isOffHours && activity.type === 'admin_access';
    }
    
    isRateLimitViolation(source) {
        const requests = this.rateLimitMap.get(source) || [];
        return requests.length > this.securityConfig.maxRequestsPerMinute;
    }
    
    isSuspiciousCommand(activity) {
        const suspiciousCommands = [
            'reset analytics', 'emergency stop', 'clear memory',
            'delete', 'remove', 'destroy'
        ];
        
        return activity.command && 
               suspiciousCommands.some(cmd => 
                   activity.command.toLowerCase().includes(cmd)
               );
    }
    
    getThreatSeverity(level) {
        if (level >= 4) return 'critical';
        if (level >= 3) return 'high';
        if (level >= 2) return 'medium';
        return 'low';
    }
    
    handleThreat(threat) {
        console.log(`🚨 SECURITY THREAT DETECTED: ${threat.severity.toUpperCase()}`);
        
        // Log the threat
        this.logSecurityEvent('threat_detected', threat.source, threat);
        
        // Add to active threats
        this.activeThreats.set(threat.source, threat);
        
        // Take action based on severity
        if (threat.severity === 'critical') {
            this.lockoutUser(threat.source, 60 * 60 * 1000); // 1 hour
        } else if (threat.severity === 'high') {
            this.lockoutUser(threat.source, 30 * 60 * 1000); // 30 minutes
        }
        
        // Alert owner if configured
        this.alertOwner(threat);
    }
    
    /**
     * RATE LIMITING
     */
    
    checkRateLimit(source, action = 'message') {
        const now = Date.now();
        const userRequests = this.rateLimitMap.get(source) || [];
        
        // Clean old requests
        const validRequests = userRequests.filter(time => now - time < 60000);
        
        // Check limit
        const limit = this.securityConfig.maxRequestsPerMinute;
        if (validRequests.length >= limit) {
            this.logSecurityEvent('rate_limit_exceeded', source, {
                requests: validRequests.length,
                limit,
                action
            });
            
            return {
                allowed: false,
                remaining: 0,
                resetTime: Math.min(...validRequests) + 60000
            };
        }
        
        // Add current request
        validRequests.push(now);
        this.rateLimitMap.set(source, validRequests);
        
        return {
            allowed: true,
            remaining: limit - validRequests.length,
            resetTime: now + 60000
        };
    }
    
    /**
     * SESSION SECURITY
     */
    
    // Generate secure session
    generateSecureSession(userId) {
        const sessionId = crypto.randomBytes(32).toString('hex');
        const expiry = Date.now() + this.securityConfig.sessionTimeout;
        
        return {
            sessionId,
            userId,
            expiry,
            createdAt: Date.now(),
            lastActivity: Date.now()
        };
    }
    
    // Validate session
    validateSession(sessionId, userId) {
        // Implementation would check against stored sessions
        // For now, basic validation
        return sessionId && userId && sessionId.length === 64;
    }
    
    /**
     * SECURITY LOGGING
     */
    
    logSecurityEvent(eventType, source, details) {
        const event = {
            type: eventType,
            source: source,
            timestamp: Date.now(),
            details: details,
            severity: this.getEventSeverity(eventType)
        };
        
        this.securityEvents.push(event);
        
        // Keep only last 1000 events
        if (this.securityEvents.length > 1000) {
            this.securityEvents = this.securityEvents.slice(-1000);
        }
        
        // Log critical events immediately
        if (event.severity === 'critical') {
            console.log(`🚨 CRITICAL SECURITY EVENT: ${eventType} from ${source}`);
        }
    }
    
    getEventSeverity(eventType) {
        const criticalEvents = ['threat_detected', 'intrusion_attempt', 'data_breach'];
        const highEvents = ['spam_detected', 'rate_limit_exceeded', 'failed_auth'];
        
        if (criticalEvents.includes(eventType)) return 'critical';
        if (highEvents.includes(eventType)) return 'high';
        return 'medium';
    }
    
    /**
     * USER LOCKOUT SYSTEM
     */
    
    lockoutUser(userId, duration) {
        const lockout = {
            userId,
            lockedAt: Date.now(),
            expiresAt: Date.now() + duration,
            reason: 'security_violation'
        };
        
        this.failedAttempts.set(userId, lockout);
        
        console.log(`🔒 User ${userId} locked for ${duration / 60000} minutes`);
    }
    
    isUserLockedOut(userId) {
        const lockout = this.failedAttempts.get(userId);
        
        if (!lockout) return false;
        
        if (Date.now() > lockout.expiresAt) {
            this.failedAttempts.delete(userId);
            return false;
        }
        
        return true;
    }
    
    /**
     * MONITORING & ALERTS
     */
    
    startSecurityMonitoring() {
        // Clean up old events every hour
        setInterval(() => {
            this.cleanupSecurityEvents();
        }, 60 * 60 * 1000);
        
        // Check for patterns every 5 minutes
        setInterval(() => {
            this.analyzeSecurityPatterns();
        }, 5 * 60 * 1000);
        
        console.log('🛡️ Security monitoring started');
    }
    
    cleanupSecurityEvents() {
        const oldestAllowed = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        this.securityEvents = this.securityEvents.filter(
            event => event.timestamp > oldestAllowed
        );
    }
    
    analyzeSecurityPatterns() {
        const recentEvents = this.securityEvents.filter(
            event => Date.now() - event.timestamp < 60 * 60 * 1000 // Last hour
        );
        
        // Check for suspicious patterns
        const eventsBySource = {};
        recentEvents.forEach(event => {
            if (!eventsBySource[event.source]) {
                eventsBySource[event.source] = [];
            }
            eventsBySource[event.source].push(event);
        });
        
        // Alert on suspicious activity
        Object.entries(eventsBySource).forEach(([source, events]) => {
            if (events.length > this.securityConfig.suspiciousActivityThreshold) {
                this.handleSuspiciousActivity(source, events);
            }
        });
    }
    
    handleSuspiciousActivity(source, events) {
        console.log(`⚠️ Suspicious activity detected from ${source}: ${events.length} events`);
        
        this.logSecurityEvent('suspicious_activity', source, {
            eventCount: events.length,
            eventTypes: [...new Set(events.map(e => e.type))]
        });
    }
    
    alertOwner(threat) {
        // Implementation would send alert to owner
        // For now, just log
        console.log(`📢 OWNER ALERT: ${threat.severity} threat from ${threat.source}`);
    }
    
    /**
     * OWNER COMMANDS
     */
    
    handleSecurityCommand(command, sender) {
        const config = require('../config');
        const ownerNumber = config.owner_number;
        const senderNumber = sender.split('@')[0];
        
        if (senderNumber !== ownerNumber) {
            return 'Perintah ini hanya bisa digunakan oleh owner.';
        }
        
        const cmd = command.toLowerCase().trim();
        
        if (cmd === 'security status') {
            const activeThreats = Array.from(this.activeThreats.values());
            const recentEvents = this.securityEvents.slice(-10);
            
            return `🛡️ *SECURITY STATUS*

🚨 *Active Threats:* ${activeThreats.length}
${activeThreats.map(t => `• ${t.source}: ${t.severity}`).join('\n') || 'No active threats'}

📊 *Recent Events:* ${recentEvents.length}
${recentEvents.map(e => `• ${e.type}: ${e.source}`).join('\n') || 'No recent events'}

🔒 *Locked Users:* ${this.failedAttempts.size}
📈 *Total Events:* ${this.securityEvents.length}`;
        }
        
        if (cmd === 'security clear') {
            this.activeThreats.clear();
            this.failedAttempts.clear();
            this.securityEvents = [];
            
            return '✅ Security data cleared:\n• Active threats cleared\n• Locked users unlocked\n• Event log cleared';
        }
        
        if (cmd.startsWith('unlock user ')) {
            const userId = cmd.replace('unlock user ', '').trim();
            this.failedAttempts.delete(userId);
            
            return `✅ User ${userId} unlocked successfully`;
        }
        
        return null;
    }
    
    /**
     * SECURE DATA STORAGE
     */
    
    async saveSecureData(filename, data, password) {
        try {
            const encrypted = this.encrypt(data, password);
            if (!encrypted) throw new Error('Encryption failed');
            
            await saveJson(`secure_${filename}`, encrypted);
            return true;
        } catch (error) {
            console.error('❌ Secure save failed:', error);
            return false;
        }
    }
    
    async loadSecureData(filename, password) {
        try {
            const encrypted = await loadJson(`secure_${filename}`);
            if (!encrypted) return null;
            
            return this.decrypt(encrypted, password);
        } catch (error) {
            console.error('❌ Secure load failed:', error);
            return null;
        }
    }
}

// Singleton instance
const securityManager = new SecurityManager();

module.exports = { securityManager };
