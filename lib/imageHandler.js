const fs = require('fs').promises;
const path = require('path');
const { downloadMediaMessage } = require('baileys');
const { learningManager } = require('./learningManager');

class ImageHandler {
    constructor() {
        this.tempDir = path.join(process.cwd(), 'tmp', 'images');
        this.ensureTempDir();
    }

    async ensureTempDir() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
        } catch (error) {
            console.error('Error creating temp directory:', error);
        }
    }

    async handleImageMessage(message, sock, sender, remoteJid, pushName) {
        try {
            // Download image
            const imagePath = await this.downloadImage(message, sock);
            if (!imagePath) {
                return await sock.sendMessage(remoteJid, { 
                    text: 'Maaf, gagal memproses gambar yang Anda kirim.' 
                }, { quoted: message });
            }

            // Get caption if any
            const caption = message.message?.imageMessage?.caption || '';

            // Process with learning manager
            const response = await learningManager.processMessage(caption, sender, 'imageMessage', imagePath);
            
            let replyText = '';
            if (response && response.confidence > 0.5) {
                replyText = response.text;
            } else {
                // Default image response
                replyText = await this.getDefaultImageResponse(imagePath, caption);
            }

            // Send response
            await sock.sendMessage(remoteJid, { text: replyText }, { quoted: message });

            // Clean up temp file
            await this.cleanupTempFile(imagePath);

        } catch (error) {
            console.error('Error handling image message:', error);
            await sock.sendMessage(remoteJid, { 
                text: 'Maaf, terjadi kesalahan saat memproses gambar. Bisa dijelaskan secara text?' 
            }, { quoted: message });
        }
    }

    async downloadImage(message, sock) {
        try {
            const buffer = await downloadMediaMessage(
                message,
                'buffer',
                {},
                {
                    logger: console,
                    reuploadRequest: sock.updateMediaMessage
                }
            );

            if (!buffer) return null;

            // Generate unique filename
            const filename = `image_${Date.now()}.jpg`;
            const imagePath = path.join(this.tempDir, filename);

            // Save to temp file
            await fs.writeFile(imagePath, buffer);
            
            console.log(`📸 Image saved to: ${imagePath}`);
            return imagePath;

        } catch (error) {
            console.error('Error downloading image:', error);
            return null;
        }
    }

    async getDefaultImageResponse(imagePath, caption) {
        try {
            // Try to analyze with image analyzer
            const analysis = await learningManager.imageAnalyzer.analyzeImage(imagePath, {
                caption: caption
            });

            if (analysis.success) {
                return analysis.response;
            }

            // Fallback responses
            if (caption) {
                return `Saya lihat gambar dengan caption: "${caption}". Bisa dijelaskan lebih detail terkait gambar ini?`;
            } else {
                return 'Terima kasih sudah mengirim gambar. Ada yang perlu saya bantu terkait gambar ini?';
            }

        } catch (error) {
            console.error('Error in default image response:', error);
            return 'Saya sudah menerima gambar Anda. Bisa tolong dijelaskan apa yang perlu saya bantu?';
        }
    }

    async cleanupTempFile(imagePath) {
        try {
            await fs.unlink(imagePath);
            console.log(`🗑️ Cleaned up temp file: ${imagePath}`);
        } catch (error) {
            console.error('Error cleaning up temp file:', error);
        }
    }

    // Clean up old temp files (call periodically)
    async cleanupOldFiles() {
        try {
            const files = await fs.readdir(this.tempDir);
            const now = Date.now();
            const maxAge = 30 * 60 * 1000; // 30 minutes

            for (const file of files) {
                const filePath = path.join(this.tempDir, file);
                const stats = await fs.stat(filePath);
                
                if (now - stats.mtime.getTime() > maxAge) {
                    await fs.unlink(filePath);
                    console.log(`🗑️ Cleaned up old temp file: ${file}`);
                }
            }
        } catch (error) {
            console.error('Error cleaning up old files:', error);
        }
    }
}

// Create singleton instance
const imageHandler = new ImageHandler();

// Schedule cleanup every 30 minutes
setInterval(() => {
    imageHandler.cleanupOldFiles();
}, 30 * 60 * 1000);

module.exports = { ImageHandler, imageHandler };

