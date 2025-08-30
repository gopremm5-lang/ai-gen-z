const fs = require('fs').promises;
const path = require('path');
const { loadJson, saveJson } = require('./dataLoader');

class StockManager {
  constructor() {
    this.stockPath = path.join(__dirname, '../data/stock.json');
    this.expiredPath = path.join(__dirname, '../data/expired.json');
  }

  async loadStock() {
    return await loadJson('stock.json') || [];
  }

  async saveStock(data) {
    await saveJson('stock.json', data);
  }

  async loadExpired() {
    return await loadJson('expired.json') || [];
  }

  async saveExpired(data) {
    await saveJson('expired.json', data);
  }

  // Cek dan reset stock yang expired
  async checkExpiredStock() {
    const stock = await this.loadStock();
    const expired = await this.loadExpired();
    const now = new Date();
    
    let resetCount = 0;
    const updatedStock = [];
    const newExpired = [];

    for (const item of stock) {
      if (item.expired && new Date(item.expired) <= now) {
        // Stock expired - reset ke 0
        const expiredItem = {
          ...item,
          stock: 0,
          expiredAt: new Date().toISOString(),
          resetReason: 'Auto-reset: expired'
        };
        
        newExpired.push(expiredItem);
        resetCount++;
        
        // Buat notifikasi untuk owner/admin
        await this.createNotification({
          type: 'stock_expired',
          product: item.nama,
          sku: item.sku,
          message: `Stock ${item.nama} (${item.sku}) telah expired dan direset ke 0`,
          timestamp: new Date().toISOString()
        });
      } else {
        updatedStock.push(item);
      }
    }

    if (resetCount > 0) {
      await this.saveStock(updatedStock);
      await this.saveExpired([...expired, ...newExpired]);
      
      console.log(`Auto-reset ${resetCount} expired stock items`);
    }

    return {
      resetCount,
      expiredItems: newExpired
    };
  }

  // Schedule auto-check setiap jam
  startAutoReset() {
    // Jalankan setiap jam
    setInterval(async () => {
      try {
        await this.checkExpiredStock();
      } catch (error) {
        console.error('Error in auto-reset:', error);
      }
    }, 60 * 60 * 1000); // 1 jam
    
    // Jalankan juga saat startup
    this.checkExpiredStock();
  }

  // Buat notifikasi untuk stock events
  async createNotification(notification) {
    const notifications = await loadJson('notifications.json') || [];
    notifications.push({
      ...notification,
      id: Date.now().toString(),
      read: false
    });
    
    await saveJson('notifications.json', notifications);
  }

  // Get expired stock report
  async getExpiredReport(days = 7) {
    const expired = await this.loadExpired();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return expired.filter(item => 
      new Date(item.expiredAt) >= cutoffDate
    );
  }

  // Restore stock dari expired
  async restoreExpiredStock(sku, newStock, newExpiredDate) {
    const stock = await this.loadStock();
    const expired = await this.loadExpired();
    
    const expiredIndex = expired.findIndex(e => e.sku === sku);
    if (expiredIndex === -1) return false;
    
    const expiredItem = expired[expiredIndex];
    const stockIndex = stock.findIndex(s => s.sku === sku);
    
    if (stockIndex !== -1) {
      // Update existing stock
      stock[stockIndex].stock = newStock;
      stock[stockIndex].expired = newExpiredDate;
    } else {
      // Add new stock
      stock.push({
        ...expiredItem,
        stock: newStock,
        expired: newExpiredDate
      });
    }
    
    // Remove from expired
    expired.splice(expiredIndex, 1);
    
    await this.saveStock(stock);
    await this.saveExpired(expired);
    
    return true;
  }
}

module.exports = new StockManager();
