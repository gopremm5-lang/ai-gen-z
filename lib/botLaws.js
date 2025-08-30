/**
 * VYLOZZONE BOT FUNDAMENTAL LAWS
 * Terinspirasi dari Three Laws of Robotics (Isaac Asimov)
 * 
 * Laws ini HARDCODED dan tidak dapat diubah atau dilanggar dalam kondisi apapun
 * Semua response dan learning harus mematuhi laws ini
 */

const config = require('../config');

class BotLaws {
    constructor() {
        // FUNDAMENTAL LAWS - TIDAK DAPAT DIUBAH ATAU DITIMPA
        this.FUNDAMENTAL_LAWS = Object.freeze({
            // LAW #1: BUSINESS INTEGRITY (Paling Tinggi)
            FIRST_LAW: {
                priority: 1,
                name: "BUSINESS_INTEGRITY",
                description: "Bot tidak boleh memberikan informasi yang merugikan bisnis Vylozzone atau menyesatkan customer",
                rules: Object.freeze([
                    "TIDAK BOLEH menyebutkan kompetitor atau recommend tempat lain",
                    "TIDAK BOLEH memberikan info garansi yang salah",
                    "TIDAK BOLEH memberikan info harga yang salah", 
                    "TIDAK BOLEH mengatakan produk gratis/illegal/bajakan",
                    "TIDAK BOLEH memberikan informasi yang bisa merugikan reputasi bisnis",
                    "HARUS selalu minta nomor order + screenshot untuk troubleshooting",
                    "HARUS menggunakan tone profesional CS"
                ]),
                violations: [],
                immutable: true
            },

            // LAW #2: USER SAFETY & RESPECT (Kedua)  
            SECOND_LAW: {
                priority: 2,
                name: "USER_SAFETY_RESPECT",
                description: "Bot harus membantu user dengan hormat dan tidak memberikan konten toxic/harmful",
                rules: Object.freeze([
                    "TIDAK BOLEH menggunakan kata kasar, toxic, atau offensive",
                    "TIDAK BOLEH memberikan informasi yang menyesatkan user",
                    "TIDAK BOLEH mengabaikan pertanyaan user yang legitimate",
                    "HARUS selalu sopan dan profesional",
                    "HARUS memberikan bantuan yang konstruktif",
                    "TIDAK BOLEH diskriminasi berdasarkan apapun"
                ]),
                violations: [],
                immutable: true
            },

            // LAW #3: LEARNING COMPLIANCE (Ketiga)
            THIRD_LAW: {
                priority: 3, 
                name: "LEARNING_COMPLIANCE",
                description: "Bot harus belajar dan improve, tapi tidak boleh melanggar Law #1 dan #2",
                rules: Object.freeze([
                    "HANYA belajar dari input yang mematuhi Law #1 dan #2",
                    "HARUS selalu validate input sebelum learning", 
                    "TIDAK BOLEH belajar dari toxic/unprofessional inputs",
                    "HARUS prioritaskan official FAQ/SOP daripada user teaching",
                    "HARUS maintain consistency dengan business rules",
                    "BOLEH menolak learning yang melanggar fundamental laws"
                ]),
                violations: [],
                immutable: true
            }
        });

        // ENFORCEMENT MECHANISMS
        this.enforcementLevel = 'STRICT'; // STRICT, MODERATE, PERMISSIVE
        this.violationLog = [];
        this.emergencyStop = false;
    }

    /**
     * MASTER VALIDATION FUNCTION
     * Checks if any action violates fundamental laws
     * Returns: { allowed: boolean, violations: [], blockReason: string }
     */
    validateAction(action, content, context = {}) {
        const result = {
            allowed: true,
            violations: [],
            blockReason: null,
            lawsApplied: [],
            severity: 'none'
        };

        try {
            // Emergency stop check
            if (this.emergencyStop) {
                return {
                    allowed: false,
                    violations: ['EMERGENCY_STOP_ACTIVE'],
                    blockReason: 'Emergency stop is active - all actions blocked',
                    severity: 'critical'
                };
            }

            // Check each law in priority order
            for (const [lawKey, law] of Object.entries(this.FUNDAMENTAL_LAWS)) {
                const lawViolation = this.checkLawViolation(law, action, content, context);
                
                if (lawViolation.violated) {
                    result.allowed = false;
                    result.violations.push({
                        law: law.name,
                        priority: law.priority,
                        rule: lawViolation.rule,
                        reason: lawViolation.reason,
                        severity: lawViolation.severity
                    });
                    
                    result.severity = this.getMaxSeverity(result.severity, lawViolation.severity);
                    
                    // Log violation
                    this.logViolation(law.name, lawViolation, action, content, context);
                    
                    // For First Law violations, immediately block
                    if (law.priority === 1) {
                        result.blockReason = `FIRST LAW VIOLATION: ${lawViolation.reason}`;
                        break;
                    }
                }
                
                result.lawsApplied.push(law.name);
            }

            // Set block reason if not already set
            if (!result.allowed && !result.blockReason) {
                const highestPriorityViolation = result.violations.reduce((highest, current) => 
                    current.priority < highest.priority ? current : highest
                );
                result.blockReason = `LAW VIOLATION: ${highestPriorityViolation.reason}`;
            }

            return result;

        } catch (error) {
            console.error('Error in law validation:', error);
            // Fail-safe: block action if validation fails
            return {
                allowed: false,
                violations: ['VALIDATION_ERROR'],
                blockReason: 'Law validation system error - action blocked for safety',
                severity: 'critical'
            };
        }
    }

    checkLawViolation(law, action, content, context) {
        let violation = {
            violated: false,
            rule: null,
            reason: null,
            severity: 'low'
        };

        const lowerContent = (content || '').toLowerCase();

        switch (law.name) {
            case 'BUSINESS_INTEGRITY':
                violation = this.checkBusinessIntegrityLaw(lowerContent, action, context);
                break;
                
            case 'USER_SAFETY_RESPECT':
                violation = this.checkUserSafetyLaw(lowerContent, action, context);
                break;
                
            case 'LEARNING_COMPLIANCE':
                violation = this.checkLearningComplianceLaw(lowerContent, action, context);
                break;
        }

        return violation;
    }

    checkBusinessIntegrityLaw(content, action, context) {
        const violation = { violated: false, rule: null, reason: null, severity: 'high' };

        // Check kompetitor mentions
        const competitors = [
            'netflix ori', 'spotify official', 'disney resmi', 'youtube premium ori',
            'beli di tempat lain', 'lebih murah di', 'mending di', 'jangan beli disini',
            'recommend tempat lain', 'coba tempat lain'
        ];
        
        for (const competitor of competitors) {
            if (content.includes(competitor)) {
                violation.violated = true;
                violation.rule = 'NO_COMPETITOR_MENTION';
                violation.reason = `Mentions competitor or alternative: "${competitor}"`;
                violation.severity = 'critical';
                return violation;
            }
        }

        // Check wrong guarantee info
        const wrongGaransi = [
            'garansi selamanya', 'unlimited garansi', 'garansi gratis',
            'tanpa garansi', 'no warranty', 'resiko sendiri'
        ];
        
        for (const wrong of wrongGaransi) {
            if (content.includes(wrong)) {
                violation.violated = true;
                violation.rule = 'ACCURATE_GUARANTEE_INFO';
                violation.reason = `Wrong guarantee information: "${wrong}"`;
                violation.severity = 'critical';
                return violation;
            }
        }

        // Check wrong pricing info - dengan konteks yang lebih spesifik
        const wrongPricingPatterns = [
            'gratis', 'tanpa bayar', 'tidak perlu bayar', 'bayar 0', 'harga 0',
            'free download', 'free trial selamanya', 'unlimited free'
        ];
        
        for (const wrong of wrongPricingPatterns) {
            if (content.includes(wrong)) {
                // SKIP jika "free" adalah bagian dari "free bonus" atau promosi yang legitimate
                if (wrong === 'free' && (content.includes('free bonus') || content.includes('bonus free'))) {
                    continue;
                }
                
                violation.violated = true;
                violation.rule = 'ACCURATE_PRICING_INFO';
                violation.reason = `Wrong pricing information: "${wrong}"`;
                violation.severity = 'critical';
                return violation;
            }
        }

        // Check illegal/piracy mentions
        const illegalTerms = ['bajakan', 'crack', 'mod', 'ilegal', 'piracy'];
        for (const term of illegalTerms) {
            if (content.includes(term)) {
                violation.violated = true;
                violation.rule = 'NO_ILLEGAL_CONTENT';
                violation.reason = `Mentions illegal/piracy content: "${term}"`;
                violation.severity = 'critical';
                return violation;
            }
        }

        // Check if troubleshooting without asking for order + screenshot
        const troubleshootingContext = ['error', 'masalah', 'gagal', 'tidak bisa', 'kendala'];
        const hasTroubleshooting = troubleshootingContext.some(ctx => content.includes(ctx));
        
        // HANYA check troubleshooting untuk response yang memang menangani masalah
        // SKIP untuk greeting, produk info, atau response umum
        const isGreeting = ['hai', 'halo', 'hello', 'selamat', 'assalamualaikum'].some(greeting => content.includes(greeting));
        const isProductInfo = ['harga', 'info', 'paket', 'garansi', 'fitur'].some(info => content.includes(info));
        const isGeneralResponse = content.length < 50; // Response pendek kemungkinan bukan troubleshooting
        
        if (hasTroubleshooting && action === 'response' && !isGreeting && !isProductInfo && !isGeneralResponse) {
            const hasOrderRequest = content.includes('nomor order') || content.includes('screenshot');
            if (!hasOrderRequest) {
                violation.violated = true;
                violation.rule = 'REQUIRE_ORDER_SCREENSHOT';
                violation.reason = 'Troubleshooting response missing order number + screenshot request';
                violation.severity = 'medium';
                return violation;
            }
        }

        return violation;
    }

    checkUserSafetyLaw(content, action, context) {
        const violation = { violated: false, rule: null, reason: null, severity: 'medium' };

        // Check toxic language with word boundary detection
        const toxicWords = [
            'anjing', 'babi', 'bangsat', 'brengsek', 'kontol', 'memek', 'tai', 
            'shit', 'fuck', 'damn', 'bodoh', 'idiot', 'stupid', 'tolol', 
            'goblok', 'dungu', 'bego'
        ];

        for (const toxic of toxicWords) {
            // Use word boundary regex to avoid false positives
            const regex = new RegExp(`\\b${toxic}\\b`, 'i');
            if (regex.test(content)) {
                violation.violated = true;
                violation.rule = 'NO_TOXIC_LANGUAGE';
                violation.reason = `Contains toxic language: "${toxic}"`;
                violation.severity = 'critical';
                return violation;
            }
        }

        // Check unprofessional language
        const unprofessionalWords = [
            'males', 'gabut', 'santai aja', 'cuek aja', 'terserah aja', 'bodo amat',
            'gak tau', 'ga tau', 'entahlah', 'mungkin aja'
        ];

        for (const unprof of unprofessionalWords) {
            if (content.includes(unprof)) {
                violation.violated = true;
                violation.rule = 'PROFESSIONAL_TONE_REQUIRED';
                violation.reason = `Unprofessional language: "${unprof}"`;
                violation.severity = 'medium';
                return violation;
            }
        }

        // Check misleading information
        const misleadingPhrases = [
            'bohong', 'nipu', 'scam', 'penipu', 'maling',
            'tidak ada jaminan', 'tanpa kepastian'
        ];

        for (const misleading of misleadingPhrases) {
            if (content.includes(misleading)) {
                violation.violated = true;
                violation.rule = 'NO_MISLEADING_INFO';
                violation.reason = `Potentially misleading: "${misleading}"`;
                violation.severity = 'high';
                return violation;
            }
        }

        return violation;
    }

    checkLearningComplianceLaw(content, action, context) {
        const violation = { violated: false, rule: null, reason: null, severity: 'low' };

        // Only check if action is learning-related
        if (!['learn', 'teach', 'training'].includes(action)) {
            return violation;
        }

        // Check if learning from toxic content
        const businessViolation = this.checkBusinessIntegrityLaw(content, action, context);
        const safetyViolation = this.checkUserSafetyLaw(content, action, context);

        if (businessViolation.violated) {
            violation.violated = true;
            violation.rule = 'NO_LEARNING_FROM_BUSINESS_VIOLATIONS';
            violation.reason = `Cannot learn from content that violates business integrity: ${businessViolation.reason}`;
            violation.severity = 'high';
            return violation;
        }

        if (safetyViolation.violated) {
            violation.violated = true;
            violation.rule = 'NO_LEARNING_FROM_UNSAFE_CONTENT';
            violation.reason = `Cannot learn from unsafe content: ${safetyViolation.reason}`;
            violation.severity = 'high';
            return violation;
        }

        // Check if contradicts official FAQ/SOP
        if (context.contradictsFaqSop) {
            violation.violated = true;
            violation.rule = 'NO_CONTRADICTION_WITH_OFFICIAL';
            violation.reason = 'Learning content contradicts official FAQ/SOP';
            violation.severity = 'medium';
            return violation;
        }

        return violation;
    }

    getMaxSeverity(current, new_) {
        const severityLevels = { 'none': 0, 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
        const currentLevel = severityLevels[current] || 0;
        const newLevel = severityLevels[new_] || 0;
        
        const maxLevel = Math.max(currentLevel, newLevel);
        return Object.keys(severityLevels).find(key => severityLevels[key] === maxLevel);
    }

    logViolation(lawName, violation, action, content, context) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            law: lawName,
            violation: violation,
            action: action,
            content: content.substring(0, 200), // Limit content length in log
            context: context,
            id: Date.now()
        };

        this.violationLog.push(logEntry);

        // Keep only last 1000 violations
        if (this.violationLog.length > 1000) {
            this.violationLog = this.violationLog.slice(-1000);
        }

        // Log to console for immediate visibility
        console.error(`🚨 BOT LAW VIOLATION [${lawName}]: ${violation.reason}`);
        
        // Critical violations should be immediately reported
        if (violation.severity === 'critical') {
            console.error(`🔴 CRITICAL VIOLATION - Immediate intervention required!`);
            // Here you could send alert to owner/admin
        }
    }

    // HARDCODED VALIDATION FUNCTIONS THAT CANNOT BE BYPASSED

    /**
     * ABSOLUTE VALIDATION - Cannot be overridden or bypassed
     * This is the final gatekeeper for all bot actions
     */
    absoluteValidation(action, content, context = {}) {
        // This function runs even if other validations are disabled
        const criticalChecks = [
            // Business integrity checks that can NEVER be bypassed
            () => {
                const lowerContent = (content || '').toLowerCase();
                const criticalViolations = [
                    'netflix ori', 'spotify official', 'beli di tempat lain',
                    'gratis', 'bajakan', 'ilegal', 'crack'
                ];
                
                for (const violation of criticalViolations) {
                    if (lowerContent.includes(violation)) {
                        return {
                            block: true,
                            reason: `ABSOLUTE BLOCK: Critical business violation detected: "${violation}"`
                        };
                    }
                }
                return { block: false };
            },
            
            // Safety checks that can NEVER be bypassed
            () => {
                const lowerContent = (content || '').toLowerCase();
                const toxicWords = ['anjing', 'babi', 'bangsat', 'fuck', 'shit'];
                
                for (const toxic of toxicWords) {
                    if (lowerContent.includes(toxic)) {
                        return {
                            block: true,
                            reason: `ABSOLUTE BLOCK: Toxic content detected: "${toxic}"`
                        };
                    }
                }
                return { block: false };
            }
        ];

        // Run all critical checks
        for (const check of criticalChecks) {
            const result = check();
            if (result.block) {
                this.emergencyLog(result.reason, content, context);
                return {
                    allowed: false,
                    reason: result.reason,
                    bypassable: false,
                    absolute: true
                };
            }
        }

        return { allowed: true, absolute: true };
    }

    emergencyLog(reason, content, context) {
        const emergencyEntry = {
            timestamp: new Date().toISOString(),
            type: 'ABSOLUTE_BLOCK',
            reason: reason,
            content: content,
            context: context,
            severity: 'EMERGENCY'
        };

        console.error(`🚨🚨🚨 EMERGENCY BLOCK: ${reason}`);
        // In production, this should alert admin immediately
    }

    // Owner commands for law management (very limited)
    handleOwnerLawCommand(command, sender) {
        const ownerNumber = config.owner_number;
        const senderNumber = sender.split('@')[0];
        
        if (senderNumber !== ownerNumber) {
            return 'Perintah law management hanya untuk owner.';
        }

        const cmd = command.toLowerCase().trim();

        if (cmd === 'law status') {
            return this.getLawStatus();
        }

        if (cmd === 'violation log') {
            return this.getViolationLog();
        }

        if (cmd === 'emergency stop') {
            this.emergencyStop = true;
            return '🚨 EMERGENCY STOP ACTIVATED - All bot actions blocked!';
        }

        if (cmd === 'emergency resume') {
            this.emergencyStop = false;
            return '✅ Emergency stop deactivated - Bot operations resumed.';
        }

        // Laws themselves CANNOT be modified - they are immutable
        if (cmd.includes('modify law') || cmd.includes('change law')) {
            return '❌ FUNDAMENTAL LAWS CANNOT BE MODIFIED - They are hardcoded and immutable for safety.';
        }

        return null;
    }

    getLawStatus() {
        const lawsStatus = Object.entries(this.FUNDAMENTAL_LAWS).map(([key, law]) => {
            return `${law.priority}. ${law.name}\n   ${law.description}\n   Rules: ${law.rules.length}\n   Status: ✅ ACTIVE & IMMUTABLE`;
        }).join('\n\n');

        const stats = {
            totalViolations: this.violationLog.length,
            criticalViolations: this.violationLog.filter(v => v.violation.severity === 'critical').length,
            emergencyStop: this.emergencyStop
        };

        return `🤖 BOT FUNDAMENTAL LAWS STATUS\n\n${lawsStatus}\n\n📊 VIOLATION STATS:\n• Total: ${stats.totalViolations}\n• Critical: ${stats.criticalViolations}\n• Emergency Stop: ${stats.emergencyStop ? '🔴 ACTIVE' : '🟢 INACTIVE'}`;
    }

    getViolationLog() {
        const recentViolations = this.violationLog.slice(-10);
        
        if (recentViolations.length === 0) {
            return '✅ No law violations recorded.';
        }

        let log = '📋 RECENT LAW VIOLATIONS:\n\n';
        recentViolations.forEach((entry, index) => {
            log += `${index + 1}. ${entry.law} (${entry.violation.severity})\n`;
            log += `   Reason: ${entry.violation.reason}\n`;
            log += `   Time: ${new Date(entry.timestamp).toLocaleString('id-ID')}\n\n`;
        });

        return log;
    }

    getStats() {
        return {
            totalLaws: Object.keys(this.FUNDAMENTAL_LAWS).length,
            violations: this.violationLog.length,
            emergencyStop: this.emergencyStop,
            enforcementLevel: this.enforcementLevel
        };
    }
}

// Export singleton instance
const botLaws = new BotLaws();

module.exports = { BotLaws, botLaws };
