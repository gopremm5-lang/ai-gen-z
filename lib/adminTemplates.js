/**
 * ADMIN QUICK RESPONSE TEMPLATES
 * Pre-defined templates untuk speed up admin responses
 * 
 * Features:
 * - Quick templates untuk common scenarios
 * - Dynamic variables untuk personalization
 * - Context-aware suggestions
 * - Template categories
 */

const { textManager } = require('./textManager');
const { conversationContext } = require('./conversationContext');

class AdminTemplates {
    constructor() {
        this.templates = {
            // PAYMENT CONFIRMATION
            payment: {
                confirmed: "✅ *PEMBAYARAN DITERIMA*\n\n👤 *Customer:* {customerName}\n💰 *Nominal:* Rp {amount}\n📱 *Produk:* {product}\n⏰ *Durasi:* {duration}\n\n📧 Akun akan dikirim ke email dalam 5-10 menit ya, Kak!\n\nTerima kasih sudah order di Vylozzone! 🙏",
                
                pending: "⏳ *PEMBAYARAN SEDANG DICEK*\n\n👤 *Customer:* {customerName}\n💰 *Nominal:* Rp {amount}\n📱 *Produk:* {product}\n\nTransfer sedang kami verifikasi. Mohon tunggu 5-10 menit ya, Kak!\n\nJika ada pertanyaan, langsung chat aja 😊",
                
                invalid: "❌ *PEMBAYARAN BELUM SESUAI*\n\n👤 *Customer:* {customerName}\n⚠️ *Issue:* {issue}\n\nMohon cek kembali:\n• Nominal transfer: Rp {correctAmount}\n• Rekening tujuan: {accountNumber}\n• Waktu transfer max 30 menit\n\nSilakan transfer ulang atau hubungi admin jika ada kendala 😊"
            },
            
            // ORDER PROCESSING
            order: {
                received: "📋 *ORDER DITERIMA*\n\n👤 *Customer:* {customerName}\n📱 *Produk:* {product}\n⏰ *Durasi:* {duration}\n💰 *Total:* Rp {amount}\n\n💳 *Pembayaran via:*\n{paymentMethods}\n\nSetelah transfer, kirim screenshot bukti ya, Kak!",
                
                processing: "⚙️ *ORDER SEDANG DIPROSES*\n\n👤 *Customer:* {customerName}\n📱 *Produk:* {product}\n\nPembayaran sudah kami terima ✅\nAkun sedang diproses dan akan dikirim dalam 5-10 menit.\n\nMohon tunggu ya, Kak! 😊",
                
                completed: "🎉 *ORDER SELESAI*\n\n👤 *Customer:* {customerName}\n📱 *Produk:* {product}\n📧 *Email:* {email}\n🔑 *Password:* {password}\n⏰ *Durasi:* {duration}\n🛡️ *Garansi:* {warranty}\n\nSelamat menikmati! Jika ada kendala, langsung chat ya 😊"
            },
            
            // CUSTOMER SUPPORT
            support: {
                troubleshooting: "🔧 *TROUBLESHOOTING*\n\n👤 *Customer:* {customerName}\n📱 *Produk:* {product}\n❗ *Masalah:* {issue}\n\nSolusi yang bisa dicoba:\n{solutions}\n\nJika masih bermasalah, kirim screenshot error ya, Kak!",
                
                escalation: "🚨 *ESCALATION TO TECHNICAL*\n\n👤 *Customer:* {customerName}\n📱 *Produk:* {product}\n❗ *Issue:* {issue}\n\nMasalah ini butuh penanganan khusus. Tim technical kami akan handle dalam 1x24 jam.\n\nMohon sabar ya, Kak! Update akan kami berikan segera 🙏",
                
                satisfaction: "😊 *FOLLOW-UP SATISFACTION*\n\n👤 *Customer:* {customerName}\n📱 *Produk:* {product}\n\nHai Kak! Gimana pengalaman pakai {product}? Semua lancar?\n\nKalau ada feedback atau kendala, langsung bilang aja ya! 😊"
            },
            
            // GARANSI & CLAIMS
            garansi: {
                claim_received: "🛡️ *CLAIM GARANSI DITERIMA*\n\n👤 *Customer:* {customerName}\n📱 *Produk:* {product}\n❗ *Masalah:* {issue}\n📅 *Tanggal Order:* {orderDate}\n\nClaim sedang kami review. Proses maksimal 1x24 jam.\n\nUpdate akan kami berikan segera ya, Kak! 🙏",
                
                claim_approved: "✅ *CLAIM GARANSI DISETUJUI*\n\n👤 *Customer:* {customerName}\n📱 *Produk:* {product}\n🔄 *Solusi:* {solution}\n\n{solutionDetails}\n\nMohon coba solusi di atas ya, Kak! Jika masih bermasalah, langsung chat lagi 😊",
                
                replacement: "🔄 *REPLACEMENT ACCOUNT*\n\n👤 *Customer:* {customerName}\n📱 *Produk:* {product}\n📧 *Email Baru:* {newEmail}\n🔑 *Password Baru:* {newPassword}\n\nAkun replacement sudah siap! Garansi di-extend sesuai sisa waktu ya, Kak 😊"
            },
            
            // GENERAL RESPONSES
            general: {
                greeting: "Halo, {customerName}! 😊\n\nAda yang bisa dibantu hari ini?",
                thanks: "Sama-sama, {customerName}! 😊\n\nSenang bisa membantu. Jangan ragu chat lagi kalau ada pertanyaan ya!",
                goodbye: "Terima kasih sudah menghubungi Vylozzone, {customerName}! 🙏\n\nSemoga harinya menyenangkan! 😊"
            }
        };
    }

    /**
     * GET TEMPLATE by category and type
     */
    getTemplate(category, type, variables = {}) {
        try {
            const template = this.templates[category]?.[type];
            
            if (!template) {
                console.warn(`Template not found: ${category}.${type}`);
                return null;
            }
            
            // Replace variables
            let processedTemplate = template;
            for (const [key, value] of Object.entries(variables)) {
                processedTemplate = processedTemplate.replace(new RegExp(`{${key}}`, 'g'), value);
            }
            
            return processedTemplate;
        } catch (error) {
            console.error('Error getting template:', error);
            return null;
        }
    }

    /**
     * GET SUGGESTED TEMPLATES based on context
     */
    async getSuggestedTemplates(customerNumber, context = {}) {
        try {
            const suggestions = [];
            
            // Get customer insights
            const customerInsights = conversationContext.getCustomerInsights(customerNumber);
            
            // Suggest based on customer context
            if (customerInsights.insights.includes('🎯 Customer shows order intent')) {
                suggestions.push({
                    category: 'order',
                    type: 'received',
                    title: '📋 Order Received Template',
                    description: 'Customer siap order - use order received template'
                });
            }
            
            if (customerInsights.insights.includes('😊 Mood: angry')) {
                suggestions.push({
                    category: 'support',
                    type: 'escalation', 
                    title: '🚨 Escalation Template',
                    description: 'Customer angry - consider escalation'
                });
            }
            
            if (customerInsights.type === 'returning_customer') {
                suggestions.push({
                    category: 'general',
                    type: 'greeting',
                    title: '👋 Personal Greeting',
                    description: 'Returning customer - use personal greeting'
                });
            }
            
            // Default suggestions
            if (suggestions.length === 0) {
                suggestions.push(
                    {
                        category: 'payment',
                        type: 'confirmed',
                        title: '✅ Payment Confirmed',
                        description: 'Konfirmasi pembayaran diterima'
                    },
                    {
                        category: 'order',
                        type: 'processing',
                        title: '⚙️ Order Processing',
                        description: 'Order sedang diproses'
                    },
                    {
                        category: 'support',
                        type: 'troubleshooting',
                        title: '🔧 Troubleshooting',
                        description: 'Bantuan troubleshooting'
                    }
                );
            }
            
            return suggestions;
        } catch (error) {
            console.error('Error getting suggested templates:', error);
            return [];
        }
    }

    /**
     * GET ALL TEMPLATES for dashboard
     */
    getAllTemplates() {
        const categorizedTemplates = [];
        
        for (const [category, categoryTemplates] of Object.entries(this.templates)) {
            for (const [type, template] of Object.entries(categoryTemplates)) {
                categorizedTemplates.push({
                    category: category,
                    type: type,
                    title: `${category.toUpperCase()} - ${type.replace(/_/g, ' ').toUpperCase()}`,
                    template: template,
                    variables: this.extractVariables(template)
                });
            }
        }
        
        return categorizedTemplates;
    }

    /**
     * EXTRACT VARIABLES from template
     */
    extractVariables(template) {
        const variables = [];
        const matches = template.match(/{([^}]+)}/g);
        
        if (matches) {
            for (const match of matches) {
                const variable = match.replace(/[{}]/g, '');
                if (!variables.includes(variable)) {
                    variables.push(variable);
                }
            }
        }
        
        return variables;
    }

    /**
     * ADD CUSTOM TEMPLATE
     */
    async addCustomTemplate(category, type, template) {
        try {
            if (!this.templates[category]) {
                this.templates[category] = {};
            }
            
            this.templates[category][type] = template;
            
            // Save to persistent storage
            await this.saveTemplates();
            
            console.log(`📝 Added custom template: ${category}.${type}`);
            return true;
        } catch (error) {
            console.error('Error adding custom template:', error);
            return false;
        }
    }

    /**
     * SAVE/LOAD TEMPLATES
     */
    async saveTemplates() {
        try {
            await saveJson('admin_templates.json', this.templates);
        } catch (error) {
            console.error('Error saving templates:', error);
        }
    }

    async loadCustomTemplates() {
        try {
            const customTemplates = await loadJson('admin_templates.json');
            if (customTemplates && Object.keys(customTemplates).length > 0) {
                this.templates = { ...this.templates, ...customTemplates };
                console.log('📝 Loaded custom admin templates');
            }
        } catch (error) {
            console.warn('No custom templates found, using defaults');
        }
    }
}

// Create singleton instance
const adminTemplates = new AdminTemplates();

// Load custom templates on startup
adminTemplates.loadCustomTemplates();

module.exports = { AdminTemplates, adminTemplates };