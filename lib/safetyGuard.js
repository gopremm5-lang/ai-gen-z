/**
 * SAFETY GUARD
 * Content validation and safety checks
 */

const CONSTANTS = require('./constants');

class SafetyGuard {
    constructor() {
        this.toxicPatterns = [
            'anjing', 'bangsat', 'kontol', 'memek', 'tai', 'bego', 'tolol', 'goblok',
            'fuck', 'shit', 'damn', 'asshole', 'bitch', 'bastard'
        ];
        
        this.businessRules = [
            'netflix ori', 'disney ori', 'spotify ori', 'prime ori',
            'beli di tempat lain', 'lebih murah di', 'mending beli',
            'gratis selamanya', 'illegal', 'bajakan', 'crack'
        ];
        
        this.whitelistPhrases = [
            'terima kasih', 'makasih', 'thanks', 'good', 'bagus',
            'mantap', 'oke', 'siap', 'baik'
        ];
        
        this.stats = {
            checks: 0,
            blocked: 0,
            warnings: 0
        };
    }

    /**
     * VALIDATE USER INPUT
     */
    async validateUserInput(content, response = null, context = {}) {
        this.stats.checks++;
        
        const validation = {
            isSafe: true,
            isAppropriate: true,
            score: 1.0,
            issues: [],
            warnings: []
        };

        if (!content) return validation;

        const lowerContent = content.toLowerCase();

        // Check toxic content
        const toxicFound = this.toxicPatterns.filter(pattern => 
            lowerContent.includes(pattern)
        );
        
        if (toxicFound.length > 0) {
            validation.isSafe = false;
            validation.score = 0.2;
            validation.issues.push('toxic_content');
            this.stats.blocked++;
        }

        // Check business rules
        const businessViolations = this.businessRules.filter(rule => 
            lowerContent.includes(rule)
        );
        
        if (businessViolations.length > 0) {
            validation.isAppropriate = false;
            validation.score = Math.min(validation.score, 0.4);
            validation.issues.push('business_violation');
            this.stats.warnings++;
        }

        // Check whitelist (positive content)
        const whitelistFound = this.whitelistPhrases.filter(phrase => 
            lowerContent.includes(phrase)
        );
        
        if (whitelistFound.length > 0) {
            validation.score = Math.min(1.0, validation.score + 0.2);
        }

        return validation;
    }

    /**
     * VALIDATE RESPONSE BEFORE SENDING
     */
    async validateResponse(response, originalQuestion = '', context = {}) {
        return await this.validateUserInput(response, null, { 
            ...context, 
            originalQuestion 
        });
    }

    /**
     * CHECK CONTENT SAFETY
     */
    checkContentSafety(content) {
        const lowerContent = content.toLowerCase();
        const found = this.toxicPatterns.filter(pattern => 
            lowerContent.includes(pattern)
        );
        
        return {
            safe: found.length === 0,
            found: found,
            score: found.length === 0 ? 1.0 : 0.2
        };
    }

    /**
     * GET STATISTICS
     */
    getStats() {
        return {
            toxicPatterns: this.toxicPatterns.length,
            businessRules: this.businessRules.length,
            whitelistPhrases: this.whitelistPhrases.length,
            ...this.stats
        };
    }

    /**
     * SAFE CONTENT SUGGESTIONS
     */
    getSafeAlternative(content) {
        const suggestions = [
            'Mohon menggunakan bahasa yang sopan ya kak 🙏',
            'Ada yang bisa kami bantu dengan produk kami?',
            'Silakan tanyakan tentang layanan kami'
        ];
        
        return suggestions[Math.floor(Math.random() * suggestions.length)];
    }
}

module.exports = { SafetyGuard };
