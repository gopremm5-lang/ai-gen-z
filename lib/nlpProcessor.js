const natural = require('natural');
const compromise = require('compromise');
const { loadJson, saveJson } = require('./dataLoader');
const config = require('../config');

// Initialize tokenizer and stemmer
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;
const analyzer = new natural.SentimentAnalyzer('English', stemmer, 'afinn');

// TF-IDF for document similarity
const TfIdf = natural.TfIdf;
const tfidf = new TfIdf();

class NLPProcessor {
    constructor() {
        this.knowledgeBase = [];
        this.patterns = [];
        this.conversations = [];
        this.loadLearningData();
    }

    async loadLearningData() {
        try {
            this.knowledgeBase = await loadJson('../learning/knowledge_base.json') || [];
            this.patterns = await loadJson('../learning/patterns.json') || [];
            this.conversations = await loadJson('../learning/conversations.json') || [];
            
            // Load patterns into TF-IDF
            this.knowledgeBase.forEach(item => {
                if (item.input) {
                    tfidf.addDocument(item.input.toLowerCase());
                }
            });
            
            console.log(`📚 Loaded ${this.knowledgeBase.length} knowledge entries, ${this.patterns.length} patterns`);
        } catch (error) {
            console.error('Error loading learning data:', error);
        }
    }

    // Analyze intent dari message user
    analyzeIntent(message) {
        const doc = compromise(message);
        const tokens = tokenizer.tokenize(message.toLowerCase());
        
        // Extract entities
        const entities = {
            people: doc.people().out('array'),
            places: doc.places().out('array'),
            organizations: doc.organizations().out('array'),
            topics: doc.topics().out('array'),
            verbs: doc.verbs().out('array'),
            nouns: doc.nouns().out('array'),
            adjectives: doc.adjectives().out('array')
        };

        // Detect question type
        const questionWords = ['apa', 'siapa', 'dimana', 'kapan', 'mengapa', 'bagaimana', 'berapa'];
        const isQuestion = questionWords.some(word => 
            tokens.includes(word) || message.includes('?')
        );

        // Detect intent categories
        const intents = this.detectIntentCategories(tokens, entities);

        // Sentiment analysis
        const sentiment = this.analyzeSentiment(tokens);

        const context = {
            hasProductMention: entities.nouns.some(noun => 
                ['netflix', 'spotify', 'disney', 'canva', 'capcut', 'youtube'].includes(noun.toLowerCase())
            ),
            messageLength: message.length
        };

        return {
            message: message,
            tokens: tokens,
            entities: entities,
            isQuestion: isQuestion,
            intents: intents,
            sentiment: sentiment,
            context: context,
            confidence: this.calculateConfidence(intents, context)
        };
    }

    detectIntentCategories(tokens, entities) {
        const intents = [];

        // Intent patterns
        const intentPatterns = {
            greeting: ['halo', 'hai', 'selamat', 'pagi', 'siang', 'malam'],
            ordering: ['beli', 'order', 'pesan', 'mau', 'pengen', 'butuh'],
            problem: ['error', 'masalah', 'gagal', 'tidak', 'gak', 'rusak', 'broken'],
            info: ['info', 'informasi', 'detail', 'spek', 'fitur', 'apa', 'bagaimana'],
            payment: ['bayar', 'transfer', 'dana', 'ovo', 'gopay', 'qris', 'harga'],
            complaint: ['kecewa', 'marah', 'lambat', 'lama', 'buruk', 'jelek'],
            thanks: ['terima', 'kasih', 'makasih', 'thanks', 'thx'],
            goodbye: ['bye', 'dadah', 'sampai', 'jumpa']
        };

        for (const [intent, keywords] of Object.entries(intentPatterns)) {
            const matches = keywords.filter(keyword => 
                tokens.some(token => token.includes(keyword) || keyword.includes(token))
            );
            
            if (matches.length > 0) {
                intents.push({
                    type: intent,
                    confidence: matches.length / keywords.length,
                    keywords: matches
                });
            }
        }

        return intents.sort((a, b) => b.confidence - a.confidence);
    }

    analyzeSentiment(tokens) {
        try {
            const score = analyzer.getSentiment(tokens);
            let label = 'neutral';
            
            if (score > 0.1) label = 'positive';
            else if (score < -0.1) label = 'negative';
            
            return { score, label };
        } catch (error) {
            return { score: 0, label: 'neutral' };
        }
    }

    calculateConfidence(intents, context = {}) {
        if (intents.length === 0) return 0;
        
        // Weighted confidence calculation
        const primaryIntentScore = intents[0].confidence * 0.6;
        
        // Bonus for multiple matching intents
        const multiIntentBonus = intents.length > 1 ? 0.2 : 0;
        
        // Context relevance bonus
        const contextBonus = context.hasProductMention ? 0.1 : 0;
        const lengthBonus = context.messageLength > 10 ? 0.1 : 0;
        
        const totalConfidence = Math.min(
            primaryIntentScore + multiIntentBonus + contextBonus + lengthBonus, 
            1.0
        );
        
        return totalConfidence;
    }

    // Cari response dari knowledge base
    async findResponse(analysis) {
        try {
            // Exact pattern matching first
            const exactMatch = this.findExactPattern(analysis.message);
            if (exactMatch) {
                return {
                    response: exactMatch.response,
                    confidence: 0.95,
                    source: 'exact_pattern'
                };
            }

            // TF-IDF similarity search
            const similarityResult = this.findSimilarDocument(analysis.message);
            if (similarityResult && similarityResult.confidence > 0.6) {
                return {
                    response: similarityResult.response,
                    confidence: similarityResult.confidence,
                    source: 'similarity_search'
                };
            }

            // Intent-based response
            const intentResponse = await this.getIntentBasedResponse(analysis);
            if (intentResponse) {
                return intentResponse;
            }

            return null;
        } catch (error) {
            console.error('Error finding response:', error);
            return null;
        }
    }

    findExactPattern(message) {
        const lowerMessage = message.toLowerCase();
        return this.patterns.find(pattern => {
            return pattern.triggers.some(trigger => 
                lowerMessage.includes(trigger.toLowerCase())
            );
        });
    }

    findSimilarDocument(message) {
        const lowerMessage = message.toLowerCase();
        let bestMatch = null;
        let bestScore = 0;

        this.knowledgeBase.forEach((item, index) => {
            tfidf.tfidfs(lowerMessage, (i, measure) => {
                if (i === index && measure > bestScore) {
                    bestScore = measure;
                    bestMatch = {
                        response: item.response,
                        confidence: Math.min(measure, 1.0)
                    };
                }
            });
        });

        return bestMatch;
    }

    async getIntentBasedResponse(analysis) {
        if (analysis.intents.length === 0) return null;

        const topIntent = analysis.intents[0];
        
        // IMPROVED: Generate more natural, contextual responses
        // Instead of templates, use the actual message context
        const message = analysis.message.toLowerCase();
        const entities = analysis.entities;
        
        // Only use intent-based if no better learned response exists
        // and confidence is lower to encourage learning
        if (topIntent.type === 'greeting' && topIntent.confidence > 0.7) {
            return {
                response: `Halo! Ada yang bisa saya bantu${entities.nouns.length > 0 ? ' terkait ' + entities.nouns[0] : ''}?`,
                confidence: 0.4, // Lower confidence to encourage learning better responses
                source: 'intent_based_contextual'
            };
        }
        
        if (topIntent.type === 'problem' && topIntent.confidence > 0.7) {
            const problemContext = entities.nouns.join(', ') || 'masalah ini';
            return {
                response: `Saya akan bantu selesaikan masalah ${problemContext}. Bisa dijelaskan lebih detail kronologinya?`,
                confidence: 0.4,
                source: 'intent_based_contextual'
            };
        }
        
        // For other intents, return null to encourage learning or hybrid handler
        return null;
    }

    // Learn from owner input (mutlak benar)
    async learnFromOwner(input, expectedResponse, context = {}) {
        const analysis = this.analyzeIntent(input);
        
        const learningData = {
            id: Date.now(),
            input: input,
            response: expectedResponse,
            analysis: analysis,
            context: context,
            source: 'owner_teaching',
            timestamp: new Date().toISOString(),
            confidence: 1.0 // Owner input = 100% confident
        };

        // Add to knowledge base
        this.knowledgeBase.push(learningData);
        await this.saveKnowledgeBase();

        // Create pattern if doesn't exist
        await this.createPattern(input, expectedResponse, analysis);

        // Update TF-IDF
        tfidf.addDocument(input.toLowerCase());

        console.log(`✅ Learned from owner: "${input}" -> "${expectedResponse}"`);
        return true;
    }

    // Learn from user interaction (perlu filtering)
    async learnFromUser(input, feedback, context = {}) {
        const analysis = this.analyzeIntent(input);
        
        // Filter berdasarkan sentiment dan confidence
        if (analysis.sentiment.label === 'negative' || analysis.confidence < 0.5) {
            console.log(`⚠️ Filtered user input: Low confidence or negative sentiment`);
            return false;
        }

        const learningData = {
            id: Date.now(),
            input: input,
            feedback: feedback,
            analysis: analysis,
            context: context,
            source: 'user_interaction',
            timestamp: new Date().toISOString(),
            confidence: analysis.confidence,
            needsReview: true // Perlu review sebelum masuk knowledge base
        };

        // Save to user feedback for review
        const userFeedback = await loadJson('../learning/user_feedback.json') || [];
        userFeedback.push(learningData);
        await saveJson('../learning/user_feedback.json', userFeedback);

        console.log(`📝 Captured user feedback for review`);
        return true;
    }

    async createPattern(input, response, analysis) {
        const pattern = {
            id: Date.now(),
            triggers: [input.toLowerCase()],
            response: response,
            intents: analysis.intents,
            timestamp: new Date().toISOString()
        };

        this.patterns.push(pattern);
        await this.savePatterns();
    }

    async saveKnowledgeBase() {
        await saveJson('../learning/knowledge_base.json', this.knowledgeBase);
    }

    async savePatterns() {
        await saveJson('../learning/patterns.json', this.patterns);
    }

    async saveConversations() {
        await saveJson('../learning/conversations.json', this.conversations);
    }

    // Get learning statistics
    getStats() {
        return {
            knowledgeBase: this.knowledgeBase.length,
            patterns: this.patterns.length,
            conversations: this.conversations.length,
            lastLearned: this.knowledgeBase.length > 0 ? 
                this.knowledgeBase[this.knowledgeBase.length - 1].timestamp : null
        };
    }

    // Reset learning data (owner only)
    async resetLearningData() {
        this.knowledgeBase = [];
        this.patterns = [];
        this.conversations = [];
        
        await this.saveKnowledgeBase();
        await this.savePatterns();
        await this.saveConversations();
        
        console.log('🧠 Learning data reset');
        return true;
    }
}

module.exports = { NLPProcessor };
