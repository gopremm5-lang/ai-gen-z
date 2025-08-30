/**
 * DYNAMIC TEXT MANAGER
 * Sistem untuk manage semua teks bot via web dashboard
 * 
 * Features:
 * - Edit semua response teks via web interface
 * - Kategorisasi teks (greeting, error, success, etc)
 * - Live preview dan testing
 * - Backup dan restore teks
 * - Hot reload tanpa restart bot
 */

const { loadJson, saveJson } = require('./dataLoader');
const fs = require('fs').promises;
const path = require('path');

class TextManager {
    constructor() {
        this.textCategories = {
            GREETING: 'greeting',
            PRODUCT_INFO: 'product_info', 
            ERROR_MESSAGES: 'error_messages',
            SUCCESS_MESSAGES: 'success_messages',
            HELP_COMMANDS: 'help_commands',
            ATTENDANCE: 'attendance',
            ADMIN_RESPONSES: 'admin_responses',
            FALLBACK: 'fallback',
            INTERACTIVE_PROMPTS: 'interactive_prompts'
        };
        
        this.defaultTexts = {};
        this.texts = {};
        this.initializeDefaultTexts();
    }

    /**
     * LOAD DEFAULT TEXTS - Extract semua teks hardcoded
     */
    initializeDefaultTexts() {
        this.defaultTexts = {
            // GREETING & BASIC INTERACTIONS
            greeting: {
                welcome: "Halo! Selamat datang di Vylozzone 😊\n\nAda yang bisa saya bantu terkait produk digital kami? Ketik 'menu' untuk melihat daftar produk atau langsung tanya aja ya!",
                thanks_response: "Sama-sama, Kak! 😊 Senang bisa membantu. Ada yang lain yang bisa saya bantu?",
                clarification_request: "Bisa dijelaskan lebih jelas, Kak? Saya siap membantu dengan pertanyaan seputar produk Vylozzone 😊"
            },

            // PRODUCT INFO RESPONSES
            product_info: {
                spotify_unavailable: "Maaf Kak, untuk saat ini Spotify belum tersedia di Vylozzone. Produk music streaming yang ada: YouTube Premium (include YouTube Music). Mau info YouTube Premium?",
                canva_unavailable: "Maaf Kak, untuk saat ini Canva belum tersedia. Alternatif design apps yang ada: CapCut Pro untuk video editing. Mau info CapCut Pro?",
                product_catalog: "🛍️ *PRODUK VYLOZZONE*\n\n📺 *Streaming:*\n• Netflix (mulai 15k)\n• Disney+ (mulai 17k)\n• YouTube Premium (mulai 5k)\n• Prime Video, HBO Max\n• iQIYI, VIU, WeTV, Vision+, Vidio\n\n🎨 *Aplikasi:*\n• CapCut Pro\n• Alight Motion\n• ChatGPT Plus\n• BStation\n\nMau info detail produk mana, Kak? Tinggal ketik nama produknya aja ya! 😊",
                general_pricing: "Harga produk Vylozzone bervariasi, Kak:\n\n📺 Streaming: 5k - 150k/bulan\n🎨 Aplikasi: 15k - 50k/bulan\n\nUntuk harga detail, sebutkan produk spesifik yang diminati ya! Contoh: 'netflix harga' atau 'youtube berapa?' 😊"
            },

            // ERROR & SYSTEM MESSAGES
            error_messages: {
                system_error: "Maaf, terjadi kesalahan sistem. Silakan coba lagi atau hubungi admin untuk bantuan.",
                invalid_input: "Mohon kirim pesan yang valid ya, Kak 😊",
                no_understanding: "Maaf, saya kurang paham maksudnya. Bisa dijelaskan lebih detail apa yang Kak butuhkan? 😊"
            },

            // SUCCESS MESSAGES
            success_messages: {
                buyer_added: "✅ *BUYER BERHASIL DITAMBAHKAN!*",
                claim_added: "✅ *CLAIM {type} BERHASIL DITAMBAHKAN!*",
                moderator_added: "✅ *MODERATOR BERHASIL DITAMBAHKAN!*"
            },

            // MOOD & SOP RESPONSES
            mood_responses: {
                angry_customer: "Maaf atas kendala yang terjadi, Kak. Mohon kirim nomor order & screenshot error, tim kami bantu follow-up sesuai SOP.",
                out_of_topic: "Maaf Kak, CS ini hanya menangani order, kendala, atau info garansi Vylozzone ya 🙏.",
                discount_inquiry: "Untuk info promo dan diskon terbaru, Kak bisa langsung chat admin di wa.me/6289630375723 ya! Admin akan kasih penawaran terbaik sesuai budget Kak 😊"
            },

            // ATTENDANCE MESSAGES
            attendance: {
                clock_in_success: "✅ *ABSEN MASUK BERHASIL*\n\n👤 *Admin:* {name}\n📅 *Tanggal:* {date}\n🕐 *Jam Masuk:* {time} WIB\n📊 *Status:* Aktif\n\nSelamat bekerja! Semangat hari ini ya! 💪\n\n💡 *Commands:*\n• istirahat - Mulai break\n• close - Selesai kerja",
                break_start: "🍽️ *MULAI ISTIRAHAT*\n\n👤 *Admin:* {name}\n🕐 *Jam Istirahat:* {time} WIB\n📊 *Status:* Istirahat\n\nSelamat istirahat! Jangan lupa makan ya! 😊\n\nKetik 'masuk' kalau sudah selesai istirahat",
                back_from_break: "💪 *KEMBALI KERJA*\n\n👤 *Admin:* {name}\n🕐 *Selesai Istirahat:* {time} WIB\n⏱️ *Durasi Istirahat:* {duration} menit\n📊 *Status:* Aktif Kembali\n\nWelcome back! Semangat lanjut kerja ya! 🚀",
                clock_out_success: "🏁 *SELESAI KERJA*\n\n👤 *Admin:* {name}\n📅 *Tanggal:* {date}\n🕐 *Jam Masuk:* {clockIn} WIB\n🕐 *Jam Keluar:* {clockOut} WIB\n⏱️ *Total Kerja:* {workHours}j {workMinutes}m\n🍽️ *Total Istirahat:* {breakTime} menit\n📊 *Status:* Selesai\n\nTerima kasih atas kerja kerasnya hari ini! 🙏\nIstirahat yang cukup ya! 😊"
            },

            // INTERACTIVE PROMPTS
            interactive_prompts: {
                addbuyer_step1: "🛒 *TAMBAH BUYER BARU*\n\nMari kita input data buyer step by step ya!\n\n📝 *Step 1/7: Nama User*\nSiapa nama buyer yang mau ditambahkan?\n\nContoh: John Doe\nKetik: nama lengkap buyer",
                addclaim_step1: "🛡️ *TAMBAH CLAIM GARANSI*\n\nMari kita input data claim step by step!\n\n📝 *Step 1/4: Nama User*\nSiapa nama user yang mengalami masalah?\n\nContoh: Jane Smith\nKetik: nama user",
                cancel_message: "❌ Perintah dibatalkan. Ketik 'admin menu' untuk melihat menu admin."
            },

            // FOLLOW-UP QUESTIONS (untuk harga template)
            followup_questions: {
                multi_package: [
                    "Ingin paket yang mana, Kak? Ada beberapa pilihan durasi nih 😊",
                    "Mau pilih yang mana? Bisa disesuaikan sama budget dan kebutuhan 😊", 
                    "Tertarik sama paket yang mana? Semuanya udah include garansi penuh lho 😊",
                    "Paket mana yang cocok buat Kak? Kalau bingung bisa tanya-tanya dulu 😊",
                    "Dari pilihan di atas, mana yang sesuai budget Kak? 😊",
                    "Ada yang menarik dari paket-paket tersebut? Atau butuh penjelasan lebih detail? 😊",
                    "Pilihan mana yang pas buat Kak? Semua paket berkualitas premium kok 😊",
                    "Kira-kira cocok yang mana ya? Bisa konsultasi dulu kalau masih bingung 😊"
                ],
                single_package: [
                    "Gimana, Kak? Tertarik sama {product}? 😊",
                    "Cocok gak sama kebutuhan? Mau order atau ada yang ditanyakan lagi? 😊",
                    "Bagaimana menurut Kak? Harga dan fiturnya sesuai ekspektasi? 😊",
                    "Tertarik untuk order {product}? Atau ada yang mau ditanyakan dulu? 😊"
                ],
                general: [
                    "Udah ada gambaran? Kalau mau order atau ada pertanyaan tinggal bilang aja ya 😊",
                    "Kalau ada yang kurang jelas atau mau diskusi budget, langsung tanya aja Kak 😊",
                    "Semua paket udah include garansi penuh ya! Mau yang mana atau butuh konsultasi dulu? 😊",
                    "Gimana pendapat Kak? Cocok sama yang dicari atau butuh alternatif lain? 😊",
                    "Ada yang menarik? Atau mau tanya-tanya detail dulu sebelum memutuskan? 😊",
                    "Sesuai gak sama budget dan kebutuhan? Kalau ada pertanyaan langsung aja ya 😊"
                ]
            }
        };

        // Set initial texts to defaults
        this.texts = { ...this.defaultTexts };
        
        // Load custom texts if exists (async)
        this.loadCustomTexts();
    }

    /**
     * LOAD CUSTOM TEXTS from database
     */
    async loadCustomTexts() {
        try {
            const customTexts = await loadJson('custom_texts.json');
            if (customTexts && Object.keys(customTexts).length > 0) {
                this.texts = { ...this.defaultTexts, ...customTexts };
                console.log('📝 Loaded custom texts from database');
            } else {
                this.texts = this.defaultTexts;
                console.log('📝 Using default texts');
            }
        } catch (error) {
            console.warn('Error loading custom texts, using defaults:', error);
            this.texts = this.defaultTexts;
        }
    }

    /**
     * GET TEXT by category and key
     */
    getText(category, key, variables = {}) {
        try {
            let text = this.texts[category]?.[key];
            
            if (!text) {
                console.warn(`Text not found: ${category}.${key}`);
                return `[TEXT_NOT_FOUND: ${category}.${key}]`;
            }
            
            // Handle array texts (random selection)
            if (Array.isArray(text)) {
                text = text[Math.floor(Math.random() * text.length)];
            }
            
            // Replace variables
            if (variables && Object.keys(variables).length > 0) {
                for (const [key, value] of Object.entries(variables)) {
                    text = text.replace(new RegExp(`{${key}}`, 'g'), value);
                }
            }
            
            return text;
        } catch (error) {
            console.error('Error getting text:', error);
            return '[TEXT_ERROR]';
        }
    }

    /**
     * UPDATE TEXT via dashboard
     */
    async updateText(category, key, newText) {
        try {
            if (!this.texts[category]) {
                this.texts[category] = {};
            }
            
            this.texts[category][key] = newText;
            
            // Save to custom texts file
            await saveJson('custom_texts.json', this.texts);
            
            console.log(`📝 Updated text: ${category}.${key}`);
            return true;
        } catch (error) {
            console.error('Error updating text:', error);
            return false;
        }
    }

    /**
     * GET ALL TEXTS for dashboard editor
     */
    async getAllTexts() {
        try {
            return {
                categories: this.textCategories,
                texts: this.texts,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting all texts:', error);
            return { categories: {}, texts: {}, lastUpdated: null };
        }
    }

    /**
     * RESET TO DEFAULTS
     */
    async resetToDefaults() {
        try {
            this.texts = { ...this.defaultTexts };
            await saveJson('custom_texts.json', this.texts);
            console.log('📝 Reset texts to defaults');
            return true;
        } catch (error) {
            console.error('Error resetting texts:', error);
            return false;
        }
    }

    /**
     * BACKUP CURRENT TEXTS
     */
    async backupTexts() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFilename = `custom_texts_backup_${timestamp}.json`;
            await saveJson(`backups/${backupFilename}`, this.texts);
            console.log(`📝 Backed up texts to: ${backupFilename}`);
            return backupFilename;
        } catch (error) {
            console.error('Error backing up texts:', error);
            return null;
        }
    }

    /**
     * HOT RELOAD - Reload texts without restart
     */
    async hotReload() {
        try {
            await this.loadCustomTexts();
            console.log('🔥 Hot reloaded texts');
            return true;
        } catch (error) {
            console.error('Error hot reloading texts:', error);
            return false;
        }
    }

    /**
     * SEARCH TEXTS - Find texts containing specific keywords
     */
    searchTexts(keyword) {
        const results = [];
        const lowerKeyword = keyword.toLowerCase();
        
        for (const [category, categoryTexts] of Object.entries(this.texts)) {
            for (const [key, text] of Object.entries(categoryTexts)) {
                const textToSearch = Array.isArray(text) ? text.join(' ') : text;
                if (textToSearch.toLowerCase().includes(lowerKeyword)) {
                    results.push({
                        category: category,
                        key: key,
                        text: textToSearch.substring(0, 100) + (textToSearch.length > 100 ? '...' : ''),
                        fullText: text
                    });
                }
            }
        }
        
        return results;
    }

    /**
     * VALIDATE TEXT - Check if text is safe and appropriate
     */
    validateText(text) {
        const issues = [];
        
        // Check for empty text
        if (!text || text.trim().length === 0) {
            issues.push('Teks tidak boleh kosong');
        }
        
        // Check for very long text (over 1000 chars)
        if (text.length > 1000) {
            issues.push('Teks terlalu panjang (max 1000 karakter)');
        }
        
        // Check for potentially harmful content
        const harmfulPatterns = [
            /\b(scam|penipu|bohong)\b/i,
            /\b(kompetitor|pesaing)\b/i,
            /\b(gratis|free|bajakan)\b/i
        ];
        
        for (const pattern of harmfulPatterns) {
            if (pattern.test(text)) {
                issues.push(`Mengandung kata yang tidak sesuai business rules: ${pattern.source}`);
            }
        }
        
        return {
            isValid: issues.length === 0,
            issues: issues
        };
    }

    /**
     * GET USAGE STATISTICS
     */
    async getUsageStats() {
        try {
            // This would track which texts are used most frequently
            // For now, return basic stats
            const stats = {
                totalTexts: 0,
                categoryCounts: {}
            };
            
            for (const [category, categoryTexts] of Object.entries(this.texts)) {
                const count = Object.keys(categoryTexts).length;
                stats.categoryCounts[category] = count;
                stats.totalTexts += count;
            }
            
            return stats;
        } catch (error) {
            console.error('Error getting usage stats:', error);
            return { totalTexts: 0, categoryCounts: {} };
        }
    }
}

// Create singleton instance
const textManager = new TextManager();

module.exports = { TextManager, textManager };