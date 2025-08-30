/**
 * CENTRALIZED CONSTANTS
 * All hardcoded values and configuration constants
 */

const CONSTANTS = {
    // Performance thresholds
    PERFORMANCE: {
        MEMORY_WARNING_MB: 80,
        MEMORY_CRITICAL_MB: 120,
        MEMORY_CLEANUP_MB: 150,
        CACHE_TTL_MS: 300000, // 5 minutes
        RATE_LIMIT_MS: 300,   // 0.3 seconds
        MAX_CACHE_SIZE: 1000,
        CLEANUP_INTERVAL_MS: 3600000, // 1 hour
    },

    // Security settings
    SECURITY: {
        SPAM_SCORE_THRESHOLD: 0.7,
        MAX_SECURITY_EVENTS: 100,
        RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
        MAX_REQUESTS_PER_WINDOW: 10,
        SESSION_TIMEOUT_MS: 28800000, // 8 hours
        MAX_LOGIN_ATTEMPTS: 5,
    },

    // File limits
    FILES: {
        MAX_FILE_SIZE_MB: 99,
        MAX_LOG_SIZE_MB: 10,
        MAX_BACKUP_FILES: 7,
        TEMP_FILE_TTL_MS: 3600000, // 1 hour
        SESSION_FILE_TTL_MS: 86400000, // 24 hours
    },

    // Response sources
    RESPONSE_SOURCES: {
        OWNER_TEACHING: 'owner_teaching',
        LEARNING_SYSTEM: 'learning_system',
        PRODUCT_DATA: 'product_data',
        FAQ_SYSTEM: 'faq_system',
        GEMINI_FALLBACK: 'gemini_fallback',
        SAFETY_BLOCK: 'safety_block',
        UNKNOWN: 'unknown'
    },

    // Confidence levels
    CONFIDENCE: {
        OWNER_TEACHING: 1.0,
        HIGH: 0.8,
        MEDIUM: 0.6,
        LOW: 0.4,
        LEARNING_THRESHOLD: 0.7,
        SAFETY_THRESHOLD: 0.5
    },

    // Error codes
    ERROR_CODES: {
        SYSTEM_ERROR: 1000,
        CONNECTION_ERROR: 1001,
        AUTH_ERROR: 1002,
        VALIDATION_ERROR: 1003,
        SECURITY_VIOLATION: 2000,
        RATE_LIMIT_EXCEEDED: 2001,
        SPAM_DETECTED: 2002,
        CONTENT_BLOCKED: 2003,
        BUSINESS_ERROR: 3000,
        FILE_ERROR: 3001,
        API_ERROR: 3002,
        UNKNOWN_ERROR: 9999
    },

    // Fuzzy search parameters
    FUZZY_SEARCH: {
        SIMILARITY_THRESHOLD: 0.6,
        MAX_RESULTS: 5,
        MIN_QUERY_LENGTH: 3,
        PHONETIC_WEIGHT: 0.3,
        SEMANTIC_WEIGHT: 0.7
    },

    // Monitoring intervals
    MONITORING: {
        HEALTH_CHECK_INTERVAL_MS: 30000,  // 30 seconds
        METRICS_COLLECTION_INTERVAL_MS: 60000, // 1 minute
        ALERT_CHECK_INTERVAL_MS: 15000,   // 15 seconds
        STATS_UPDATE_INTERVAL_MS: 300000, // 5 minutes
    },

    // Analytics categories
    ANALYTICS_CATEGORIES: [
        'traffic', 'users', 'products', 'claims', 'business',
        'marketing', 'technical', 'security', 'intelligence', 'customer_service'
    ],

    // Backup settings
    BACKUP: {
        FULL_BACKUP_INTERVAL_HOURS: 24,
        INCREMENTAL_BACKUP_INTERVAL_HOURS: 6,
        MAX_BACKUP_AGE_DAYS: 30,
        COMPRESSION_LEVEL: 6,
        ENCRYPTION_ALGORITHM: 'aes-256-gcm'
    },

    // WhatsApp specific
    WHATSAPP: {
        MAX_MESSAGE_LENGTH: 4096,
        MAX_CAPTION_LENGTH: 1024,
        TYPING_DELAY_MS: 1000,
        READ_RECEIPT_DELAY_MS: 500,
        MAX_RETRIES: 3,
        RETRY_DELAY_MS: 2000
    },

    // Bot behavior
    BOT_BEHAVIOR: {
        DEFAULT_RESPONSE_DELAY_MS: 500,
        THINKING_TIME_MS: 2000,
        MAX_CONTEXT_MESSAGES: 10,
        CONVERSATION_TIMEOUT_MS: 1800000, // 30 minutes
        LEARNING_QUEUE_SIZE: 100
    },

    // File patterns
    FILE_PATTERNS: {
        EXCLUDES: [
            '*.tmp', '*.temp', '*.log', '*.cache',
            'node_modules/**', '.git/**', 'session/**'
        ],
        SENSITIVE: [
            '*.env', '*.key', '*.pem', '*.p12',
            'config.js', 'database/**', 'session/**'
        ],
        CLEANUP_TARGETS: [
            'tmp/**', '*.tmp', '*.temp', 'logs/*.log'
        ]
    }
};

module.exports = CONSTANTS;