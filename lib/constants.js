/**
 * UNIFIED CONSTANTS
 * Centralized configuration for confidence thresholds and system parameters
 */

const CONFIDENCE_THRESHOLDS = {
    // Standardized confidence thresholds across all modules
    HIGH_CONFIDENCE: 0.8,        // For owner teaching, exact matches
    MEDIUM_CONFIDENCE: 0.6,      // For learned responses, product matches  
    LOW_CONFIDENCE: 0.4,         // For fallback responses, general queries
    MINIMUM_CONFIDENCE: 0.2,     // Below this = reject/fallback
    
    // Specific use cases
    PRODUCT_MATCH: 0.6,          // Product fuzzy matching
    FAQ_MATCH: 0.6,              // FAQ similarity matching
    LEARNING_THRESHOLD: 0.6,     // Minimum for auto-learning
    HYBRID_ROUTING: 0.4,         // Hybrid handler routing
    AI_AUTO_LEARN: 0.8           // AI response auto-learning
};

const SYSTEM_LIMITS = {
    // Rate limiting
    RATE_LIMIT_MS: 1000,
    DAILY_MESSAGE_LIMIT: 500,
    
    // Memory management
    MAX_CONVERSATION_HISTORY: 20,
    MAX_KNOWLEDGE_BASE_ENTRIES: 10000,
    MAX_LEARNING_QUEUE: 1000,
    
    // File sizes
    MAX_FILE_SIZE: 99 * 1024 * 1024, // 99MB
    MAX_PROMPT_LENGTH: 2000,
    
    // Cache settings
    CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
    MAX_CACHE_ENTRIES: 1000
};

const PRODUCT_KEYWORDS = [
    'netflix', 'spotify', 'disney', 'canva', 'capcut', 'youtube', 'iqiyi', 
    'viu', 'wetv', 'vision+', 'vidio', 'prime', 'hbo', 'bstation', 
    'alightmotion', 'chatgpt', 'remini', 'picsart'
];

const INTENT_PATTERNS = {
    greeting: ['halo', 'hai', 'selamat', 'pagi', 'siang', 'malam'],
    ordering: ['beli', 'order', 'pesan', 'mau', 'pengen', 'butuh'],
    problem: ['error', 'masalah', 'gagal', 'tidak', 'gak', 'rusak', 'broken'],
    info: ['info', 'informasi', 'detail', 'spek', 'fitur', 'apa', 'bagaimana'],
    payment: ['bayar', 'transfer', 'dana', 'ovo', 'gopay', 'qris', 'harga'],
    complaint: ['kecewa', 'marah', 'lambat', 'lama', 'buruk', 'jelek'],
    thanks: ['terima', 'kasih', 'makasih', 'thanks', 'thx'],
    goodbye: ['bye', 'dadah', 'sampai', 'jumpa']
};

const RESPONSE_TEMPLATES = {
    SYSTEM_ERROR: "Maaf, terjadi kesalahan sistem. Mohon coba lagi atau hubungi admin untuk bantuan.",
    INVALID_INPUT: "Mohon kirim pesan yang valid ya, Kak 😊",
    RATE_LIMITED: "Hai kak, mohon tunggu sebentar ya. Terlalu banyak pesan dalam waktu singkat.",
    LEARNING_BLOCKED: "🛡️ Pembelajaran ditolak untuk keamanan bisnis.",
    AI_UNAVAILABLE: "Maaf, sistem AI sedang tidak tersedia. Silakan coba lagi nanti.",
    OWNER_ONLY: "❗ Perintah ini hanya bisa digunakan oleh Owner!"
};

const ERROR_CODES = {
    // System errors
    SYSTEM_ERROR: 1000,
    RATE_LIMITED: 1001,
    INVALID_INPUT: 1002,
    VALIDATION_ERROR: 1003,
    
    // Learning errors
    LEARNING_BLOCKED: 2000,
    KNOWLEDGE_BASE_FULL: 2001,
    UNSAFE_CONTENT: 2002,
    
    // AI errors
    AI_UNAVAILABLE: 3000,
    API_KEY_INVALID: 3001,
    QUOTA_EXCEEDED: 3002
};

const LEARNING_CONFIG = {
    // Auto-learning settings
    AUTO_LEARN_ENABLED: true,
    MIN_CONFIDENCE_FOR_AUTO_LEARN: 0.8,
    MAX_AUTO_LEARN_PER_HOUR: 50,
    
    // Manual review settings
    REQUIRE_REVIEW_BELOW_CONFIDENCE: 0.7,
    AUTO_APPROVE_OWNER_TEACHING: true,
    
    // Quality control
    MIN_MESSAGE_LENGTH: 3,
    MAX_MESSAGE_LENGTH: 1000,
    PROFANITY_CHECK_ENABLED: true,
    
    // Performance
    BATCH_LEARNING_SIZE: 10,
    LEARNING_QUEUE_PROCESS_INTERVAL: 60000 // 1 minute
};

module.exports = {
    CONFIDENCE_THRESHOLDS,
    SYSTEM_LIMITS,
    PRODUCT_KEYWORDS,
    INTENT_PATTERNS,
    RESPONSE_TEMPLATES,
    ERROR_CODES,
    LEARNING_CONFIG
};