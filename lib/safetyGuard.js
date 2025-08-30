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
            'gratis selamanya', 'illegal', 'bajakan', 'crack',
            'kompetitor', 'pesaing', 'scam', 'penipu', 'bohong',
            'gratis', 'free', 'cuma-cuma', 'tanpa bayar'
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
            validation.isSafe = false; // Mark as unsafe for business
            validation.score = 0.1; // Very low score for business violations
            validation.issues.push('business_violation');
            validation.blockedRules = businessViolations;
            this.stats.warnings++;
            this.stats.blocked++;
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
     * VALIDATE USER TEACHING - Special validation for learning inputs
     */
    async validateUserTeaching(sender, input, response, context = {}) {
        try {
            // Validate input
            const inputValidation = await this.validateUserInput(input, null, { 
                ...context, 
                isTeaching: true 
            });
            
            // Validate response
            const responseValidation = await this.validateUserInput(response, null, { 
                ...context, 
                isTeaching: true 
            });
            
            // Combined validation
            const canLearn = inputValidation.isSafe && 
                           inputValidation.isAppropriate && 
                           responseValidation.isSafe && 
                           responseValidation.isAppropriate;
            
            const confidence = Math.min(inputValidation.score, responseValidation.score);
            
            let issues = [...(inputValidation.issues || []), ...(responseValidation.issues || [])];
            let reason = '';
            
            if (!canLearn) {
                if (inputValidation.blockedRules || responseValidation.blockedRules) {
                    reason = 'Melanggar business rules: ' + 
                           [...(inputValidation.blockedRules || []), ...(responseValidation.blockedRules || [])].join(', ');
                } else if (issues.includes('toxic_content')) {
                    reason = 'Mengandung konten toxic atau tidak profesional';
                } else if (issues.includes('business_violation')) {
                    reason = 'Melanggar aturan bisnis Vylozzone';
                } else {
                    reason = 'Konten tidak sesuai standar customer service';
                }
            }
            
            return {
                canLearn: canLearn,
                confidence: confidence,
                reason: reason,
                issues: issues.map(issue => ({ message: issue })),
                inputValidation: inputValidation,
                responseValidation: responseValidation
            };
            
        } catch (error) {
            console.error('Error in validateUserTeaching:', error);
            return {
                canLearn: false,
                confidence: 0,
                reason: 'Error dalam validasi keamanan',
                issues: [{ message: 'validation_error' }]
            };
        }
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
