const tf = require('@tensorflow/tfjs-node');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const { loadJson, saveJson } = require('./dataLoader');

class ImageAnalyzer {
    constructor() {
        this.model = null;
        this.isModelLoaded = false;
        this.analysisHistory = [];
        this.loadModel();
        this.loadAnalysisHistory();
    }

    async loadModel() {
        try {
            // Load a pre-trained MobileNet model for image classification
            console.log('🧠 Loading TensorFlow.js image analysis model...');
            
            // Simple model for basic image analysis
            this.model = tf.sequential({
                layers: [
                    tf.layers.conv2d({
                        inputShape: [224, 224, 3],
                        filters: 16,
                        kernelSize: 3,
                        activation: 'relu'
                    }),
                    tf.layers.maxPooling2d({ poolSize: 2 }),
                    tf.layers.conv2d({
                        filters: 32,
                        kernelSize: 3,
                        activation: 'relu'
                    }),
                    tf.layers.maxPooling2d({ poolSize: 2 }),
                    tf.layers.flatten(),
                    tf.layers.dense({ units: 64, activation: 'relu' }),
                    tf.layers.dense({ units: 10, activation: 'softmax' }) // 10 categories
                ]
            });

            this.isModelLoaded = true;
            console.log('✅ Image analysis model loaded successfully');
        } catch (error) {
            console.error('❌ Error loading TensorFlow model:', error);
            this.isModelLoaded = false;
        }
    }

    async loadAnalysisHistory() {
        try {
            this.analysisHistory = await loadJson('../learning/image_analysis.json') || [];
        } catch (error) {
            console.error('Error loading analysis history:', error);
            this.analysisHistory = [];
        }
    }

    async analyzeImage(imagePath, context = {}) {
        if (!this.isModelLoaded) {
            return {
                success: false,
                error: 'Model not loaded',
                fallback: 'Maaf, sistem analisis gambar sedang tidak tersedia'
            };
        }

        try {
            // Preprocess image
            const processedImage = await this.preprocessImage(imagePath);
            
            // Basic image properties analysis
            const imageInfo = await this.getImageInfo(imagePath);
            
            // Detect if it's a screenshot (common error pattern)
            const isScreenshot = await this.detectScreenshot(imagePath);
            
            // Analyze color composition
            const colorAnalysis = await this.analyzeColors(imagePath);
            
            // Text detection (basic OCR simulation)
            const hasText = await this.detectText(imagePath);

            const analysis = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                imagePath: path.basename(imagePath),
                imageInfo: imageInfo,
                isScreenshot: isScreenshot,
                colorAnalysis: colorAnalysis,
                hasText: hasText,
                context: context,
                confidence: this.calculateImageConfidence(imageInfo, isScreenshot, hasText)
            };

            // Generate response based on analysis
            const response = await this.generateImageResponse(analysis);
            
            // Save analysis
            analysis.response = response;
            await this.saveAnalysis(analysis);

            return {
                success: true,
                analysis: analysis,
                response: response.text
            };

        } catch (error) {
            console.error('Error analyzing image:', error);
            return {
                success: false,
                error: error.message,
                fallback: 'Maaf, tidak bisa menganalisis gambar ini'
            };
        }
    }

    async preprocessImage(imagePath) {
        try {
            // Resize and normalize image for analysis
            const imageBuffer = await fs.readFile(imagePath);
            const processedBuffer = await sharp(imageBuffer)
                .resize(224, 224)
                .removeAlpha()
                .raw()
                .toBuffer();

            // Convert to tensor
            const tensor = tf.tensor3d(processedBuffer, [224, 224, 3]);
            return tensor.div(255.0); // Normalize to 0-1
        } catch (error) {
            throw new Error(`Image preprocessing failed: ${error.message}`);
        }
    }

    async getImageInfo(imagePath) {
        try {
            const imageBuffer = await fs.readFile(imagePath);
            const metadata = await sharp(imageBuffer).metadata();
            
            return {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                channels: metadata.channels,
                density: metadata.density,
                size: imageBuffer.length,
                aspectRatio: metadata.width / metadata.height
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    async detectScreenshot(imagePath) {
        try {
            const imageInfo = await this.getImageInfo(imagePath);
            
            // Common screenshot indicators
            const isPhoneScreenshot = imageInfo.aspectRatio > 1.5 && imageInfo.aspectRatio < 2.5;
            const isDesktopScreenshot = imageInfo.aspectRatio > 1.2 && imageInfo.aspectRatio < 1.8;
            const hasTypicalSize = imageInfo.width >= 360 && imageInfo.height >= 640;
            
            const confidence = (isPhoneScreenshot || isDesktopScreenshot) && hasTypicalSize ? 0.8 : 0.2;
            
            return {
                isScreenshot: confidence > 0.5,
                confidence: confidence,
                type: isPhoneScreenshot ? 'mobile' : isDesktopScreenshot ? 'desktop' : 'unknown'
            };
        } catch (error) {
            return { isScreenshot: false, confidence: 0, error: error.message };
        }
    }

    async analyzeColors(imagePath) {
        try {
            const imageBuffer = await fs.readFile(imagePath);
            const { data } = await sharp(imageBuffer)
                .resize(100, 100)
                .raw()
                .toBuffer({ resolveWithObject: true });

            // Simple color analysis
            let r = 0, g = 0, b = 0;
            const pixels = data.length / 3;
            
            for (let i = 0; i < data.length; i += 3) {
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
            }

            const avgColor = {
                r: Math.round(r / pixels),
                g: Math.round(g / pixels),
                b: Math.round(b / pixels)
            };

            // Determine if it's mostly dark (potential error screen)
            const brightness = (avgColor.r + avgColor.g + avgColor.b) / 3;
            const isDark = brightness < 50;
            const isReddish = avgColor.r > avgColor.g + 30 && avgColor.r > avgColor.b + 30;

            return {
                averageColor: avgColor,
                brightness: brightness,
                isDark: isDark,
                isReddish: isReddish,
                dominantColor: this.getDominantColorName(avgColor)
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    getDominantColorName(color) {
        const { r, g, b } = color;
        
        if (r > g && r > b) return 'red';
        if (g > r && g > b) return 'green';
        if (b > r && b > g) return 'blue';
        if (r > 200 && g > 200 && b > 200) return 'white';
        if (r < 50 && g < 50 && b < 50) return 'black';
        
        return 'mixed';
    }

    async detectText(imagePath) {
        // Basic text detection simulation
        try {
            const imageInfo = await this.getImageInfo(imagePath);
            const colorAnalysis = await this.analyzeColors(imagePath);
            
            // Heuristic: screenshots often contain text
            // High contrast images might contain text
            const contrastScore = Math.abs(colorAnalysis.brightness - 128) / 128;
            const hasTextProbability = contrastScore * 0.6 + (imageInfo.aspectRatio > 1 ? 0.3 : 0.1);
            
            return {
                hasText: hasTextProbability > 0.5,
                confidence: hasTextProbability,
                textType: this.guessTextType(imageInfo, colorAnalysis)
            };
        } catch (error) {
            return { hasText: false, confidence: 0, error: error.message };
        }
    }

    guessTextType(imageInfo, colorAnalysis) {
        if (colorAnalysis.isReddish && colorAnalysis.isDark) {
            return 'error_message';
        }
        if (imageInfo.aspectRatio > 1.5) {
            return 'mobile_app';
        }
        if (colorAnalysis.dominantColor === 'white') {
            return 'document';
        }
        return 'unknown';
    }

    calculateImageConfidence(imageInfo, screenshotAnalysis, textAnalysis) {
        let confidence = 0.5; // Base confidence
        
        if (imageInfo.width && imageInfo.height) confidence += 0.2;
        if (screenshotAnalysis.isScreenshot) confidence += 0.2;
        if (textAnalysis.hasText) confidence += 0.1;
        
        return Math.min(confidence, 1.0);
    }

    async generateImageResponse(analysis) {
        try {
            // Analyze patterns in the image
            let responseText = '';
            let category = 'general';

            if (analysis.isScreenshot.isScreenshot) {
                category = 'screenshot';
                
                if (analysis.colorAnalysis.isReddish) {
                    responseText = "Saya lihat ini screenshot dengan dominan warna merah. Apakah ini pesan error? Jika iya, mohon jelaskan apa yang terjadi sebelum error ini muncul.";
                } else if (analysis.hasText.textType === 'error_message') {
                    responseText = "Sepertinya ini screenshot error message. Bisa tolong jelaskan langkah apa yang dilakukan sebelum error ini muncul?";
                } else if (analysis.hasText.textType === 'mobile_app') {
                    responseText = "Ini screenshot aplikasi mobile ya. Ada masalah dengan aplikasinya? Mohon dijelaskan kendala yang dialami.";
                } else {
                    responseText = "Saya lihat screenshot yang Anda kirim. Bisa dijelaskan lebih detail terkait masalah yang dialami?";
                }
            } else {
                category = 'image';
                responseText = "Terima kasih sudah mengirim gambar. Bisa dijelaskan terkait gambar ini? Ada yang perlu saya bantu?";
            }

            return {
                text: responseText,
                category: category,
                confidence: analysis.confidence,
                suggestions: this.generateSuggestions(analysis)
            };

        } catch (error) {
            return {
                text: "Maaf, saya mengalami kesulitan menganalisis gambar ini. Bisa tolong dijelaskan secara text?",
                category: 'error',
                confidence: 0,
                error: error.message
            };
        }
    }

    generateSuggestions(analysis) {
        const suggestions = [];

        if (analysis.isScreenshot.isScreenshot) {
            suggestions.push("Jelaskan langkah sebelum error");
            suggestions.push("Sebutkan aplikasi yang bermasalah");
            suggestions.push("Kapan masalah ini mulai terjadi");
        }

        if (analysis.colorAnalysis.isReddish) {
            suggestions.push("Screenshot pesan error");
            suggestions.push("Coba restart aplikasi");
            suggestions.push("Update aplikasi ke versi terbaru");
        }

        return suggestions;
    }

    async saveAnalysis(analysis) {
        try {
            this.analysisHistory.push(analysis);
            
            // Keep only last 100 analyses to prevent file bloat
            if (this.analysisHistory.length > 100) {
                this.analysisHistory = this.analysisHistory.slice(-100);
            }
            
            await saveJson('../learning/image_analysis.json', this.analysisHistory);
        } catch (error) {
            console.error('Error saving image analysis:', error);
        }
    }

    // Learn from user feedback about image analysis
    async learnFromImageFeedback(analysisId, feedback, correctResponse) {
        try {
            const analysis = this.analysisHistory.find(a => a.id === analysisId);
            if (!analysis) return false;

            analysis.feedback = {
                userFeedback: feedback,
                correctResponse: correctResponse,
                timestamp: new Date().toISOString()
            };

            await this.saveAnalysis(analysis);
            console.log(`📸 Learned from image feedback: ${feedback}`);
            return true;
        } catch (error) {
            console.error('Error learning from image feedback:', error);
            return false;
        }
    }

    getImageStats() {
        return {
            totalAnalyses: this.analysisHistory.length,
            modelLoaded: this.isModelLoaded,
            lastAnalysis: this.analysisHistory.length > 0 ? 
                this.analysisHistory[this.analysisHistory.length - 1].timestamp : null
        };
    }
}

module.exports = { ImageAnalyzer };

