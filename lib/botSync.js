const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { loadJson, saveJson } = require('./dataLoader');

class BotSync {
  constructor() {
    this.webhookUrl = process.env.BOT_WEBHOOK_URL || 'https://api.telegram.org/bot';
    this.botToken = process.env.BOT_TOKEN;
    this.chatId = process.env.BOT_CHAT_ID;
    this.syncInterval = 5 * 60 * 1000; // 5 menit
  }

  // Kirim notifikasi ke bot
  async sendNotification(message, priority = 'normal') {
    if (!this.botToken || !this.chatId) {
      console.log('Bot not configured, skipping notification');
      return false;
    }

    const formattedMessage = this.formatMessage(message, priority);
    
    try {
      const response = await axios.post(
        `${this.webhookUrl}${this.botToken}/sendMessage`,
        {
          chat_id: this.chatId,
          text: formattedMessage,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        }
      );
      
      return response.data.ok;
    } catch (error) {
      console.error('Bot notification failed:', error.message);
      return false;
    }
  }

  // Format pesan untuk bot
  formatMessage(message, priority) {
    const icons = {
      high: '🔴',
      normal: '🟡',
      low: '🟢'
    };

    const timestamp = new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta'
    });

    return `${icons[priority]} <b>${message.title || 'Notification'}</b>\n\n` +
           `${message.body || message}\n\n` +
           `<i>${timestamp}</i>`;
  }

  // Sync buyer loyalty updates
  async syncBuyerLoyalty(buyerId, oldLevel, newLevel, score) {
    const message = {
      title: 'Buyer Level Up!',
      body: `Buyer ${buyerId} naik level dari ${oldLevel} ke ${newLevel} (Score: ${score})`
    };
    
    return await this.sendNotification(message, 'normal');
  }

  // Sync stock expired alerts
  async syncStockExpired(product, sku, expiredDate) {
    const message = {
      title: 'Stock Expired Alert',
      body: `Stock ${product} (${sku}) expired pada ${expiredDate} dan telah direset ke 0`
    };
    
    return await this.sendNotification(message, 'high');
  }

  // Sync claim issues
  async syncClaimIssue(claimId, buyerId, issueType, message) {
    const notification = {
      title: 'Claim Issue Alert',
      body: `Claim #${claimId} dari buyer ${buyerId} ada masalah: ${issueType} - ${message}`
    };
    
    return await this.sendNotification(notification, 'high');
  }

  // Sync new orders
  async syncNewOrder(orderId, buyerId, product, amount) {
    const message = {
      title: 'New Order',
      body: `Order baru #${orderId} dari ${buyerId}: ${product} - Rp ${amount.toLocaleString()}`
    };
    
    return await this.sendNotification(message, 'low');
  }

  // Sync daily summary
  async sendDailySummary() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Load data untuk summary
    const [buyers, stock, claims, notifications] = await Promise.all([
      loadJson('buyers.json'),
      loadJson('stock.json'),
      loadJson('claims.json'),
      loadJson('notifications.json')
    ]);

    const summary = {
      date: today,
      buyers: {
        total: buyers?.length || 0,
        vip: buyers?.filter(b => b.loyalty?.level === 'VIP').length || 0,
        royal: buyers?.filter(b => b.loyalty?.level === 'Royal').length || 0
      },
      stock: {
        total: stock?.length || 0,
        expired: stock?.filter(s => s.expired && new Date(s.expired) <= now).length || 0
      },
      claims: {
        total: claims?.length || 0,
        pending: claims?.filter(c => c.status === 'pending').length || 0
      }
    };

    const message = {
      title: 'Daily Summary',
      body: `📊 Summary ${today}:\n` +
            `• Buyers: ${summary.buyers.total} (VIP: ${summary.buyers.vip}, Royal: ${summary.buyers.royal})\n` +
            `• Stock: ${summary.stock.total} items (${summary.stock.expired} expired)\n` +
            `• Claims: ${summary.claims.total} (${summary.claims.pending} pending)`
    };

    return await this.sendNotification(message, 'low');
  }

  // Setup auto-sync
  startAutoSync() {
    // Jalankan daily summary setiap hari jam 9 pagi
    setInterval(async () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      if (hours === 9 && minutes === 0) {
        await this.sendDailySummary();
      }
    }, 60 * 1000); // Cek setiap menit

    // Jalankan juga saat startup
    console.log('Bot sync started');
  }

  // Test bot connection
  async testConnection() {
    const testMessage = {
      title: 'Bot Test',
      body: 'Bot connection test successful!'
    };
    
    return await this.sendNotification(testMessage, 'low');
  }

  // Handle webhook updates
  async handleWebhookUpdate(update) {
    const { type, data } = update;
    
    switch (type) {
      case 'buyer_level_up':
        return await this.syncBuyerLoyalty(data.buyerId, data.oldLevel, data.newLevel, data.score);
      
      case 'stock_expired':
        return await this.syncStockExpired(data.product, data.sku, data.expiredDate);
      
      case 'claim_issue':
        return await this.syncClaimIssue(data.claimId, data.buyerId, data.issueType, data.message);
      
      case 'new_order':
        return await this.syncNewOrder(data.orderId, data.buyerId, data.product, data.amount);
      
      default:
        console.log('Unknown webhook type:', type);
        return false;
    }
  }
}

module.exports = new BotSync();
