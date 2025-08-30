const fs = require('fs').promises;
const path = require('path');

class RoleManager {
  constructor() {
    this.roles = {
      owner: {
        name: 'Owner',
        permissions: ['all'],
        canEdit: ['produk', 'promo', 'faq', 'sop', 'buyers', 'stock', 'users', 'settings'],
        canView: ['all'],
        canDelete: ['all']
      },
      admin: {
        name: 'Admin',
        permissions: ['view', 'edit_stock', 'edit_claims', 'view_reports'],
        canEdit: ['stock', 'claims', 'notifications'],
        canView: ['dashboard', 'buyers', 'stock', 'claims', 'reports'],
        canDelete: ['claims', 'notifications']
      },
      viewer: {
        name: 'Viewer',
        permissions: ['view'],
        canEdit: [],
        canView: ['dashboard', 'buyers', 'stock', 'reports'],
        canDelete: []
      }
    };
  }

  async getUserRole(userId) {
    try {
      const users = await this.loadUsers();
      const user = users.find(u => u.id === userId);
      return user ? user.role : 'viewer';
    } catch {
      return 'viewer';
    }
  }

  async hasPermission(userId, action, resource) {
    const role = await this.getUserRole(userId);
    const roleConfig = this.roles[role];
    
    if (!roleConfig) return false;
    
    if (roleConfig.permissions.includes('all')) return true;
    
    if (action === 'edit') {
      return roleConfig.canEdit.includes(resource) || roleConfig.canEdit.includes('all');
    }
    
    if (action === 'view') {
      return roleConfig.canView.includes(resource) || roleConfig.canView.includes('all');
    }
    
    if (action === 'delete') {
      return roleConfig.canDelete.includes(resource) || roleConfig.canDelete.includes('all');
    }
    
    return false;
  }

  async loadUsers() {
    try {
      const usersPath = path.join(__dirname, '../database/users.json');
      const data = await fs.readFile(usersPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async saveUsers(users) {
    const usersPath = path.join(__dirname, '../database/users.json');
    await fs.writeFile(usersPath, JSON.stringify(users, null, 2));
  }

  async addUser(userData) {
    const users = await this.loadUsers();
    const newUser = {
      id: userData.id || Date.now().toString(),
      username: userData.username,
      password: userData.password,
      role: userData.role || 'viewer',
      createdAt: new Date().toISOString(),
      lastLogin: null
    };
    
    users.push(newUser);
    await this.saveUsers(users);
    return newUser;
  }

  async updateUser(userId, updates) {
    const users = await this.loadUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) return null;
    
    users[userIndex] = { ...users[userIndex], ...updates };
    await this.saveUsers(users);
    return users[userIndex];
  }

  async getDashboardData(userId) {
    const role = await this.getUserRole(userId);
    const roleConfig = this.roles[role];
    
    return {
      role,
      permissions: roleConfig.permissions,
      canEdit: roleConfig.canEdit,
      canView: roleConfig.canView,
      canDelete: roleConfig.canDelete
    };
  }
}

module.exports = new RoleManager();
