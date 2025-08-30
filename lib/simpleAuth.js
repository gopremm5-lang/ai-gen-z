const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SimpleAuth {
    constructor() {
        this.usersFile = path.join(__dirname, '../data/users.json');
        this.initUsers();
    }

    async initUsers() {
        try {
            await fs.access(this.usersFile);
        } catch {
            // Create default users file
            const defaultUsers = {
                "admin": {
                    password: this.hashPassword("admin123"),
                    role: "admin",
                    permissions: ["dashboard.*", "users.*", "stock.*", "faq.*", "sop.*", "promo.*", "produk.*", "claim.*", "buyers.*", "blacklist.*"]
                },
                "moderator": {
                    password: this.hashPassword("mod123"),
                    role: "moderator", 
                    permissions: ["dashboard.read", "stock.read", "faq.*", "sop.*", "promo.read", "produk.read", "claim.read"]
                }
            };
            await fs.writeFile(this.usersFile, JSON.stringify(defaultUsers, null, 2));
        }
    }

    hashPassword(password) {
        return crypto.createHash('sha256').update(password).digest('hex');
    }

    async getUsers() {
        try {
            const data = await fs.readFile(this.usersFile, 'utf8');
            return JSON.parse(data);
        } catch {
            return {};
        }
    }

    async validateUser(username, password) {
        const users = await this.getUsers();
        const user = users[username];
        
        if (!user) return null;
        
        const hashedPassword = this.hashPassword(password);
        if (user.password === hashedPassword) {
            return {
                username,
                role: user.role,
                permissions: user.permissions
            };
        }
        return null;
    }

    hasPermission(userPermissions, requiredPermission) {
        if (!userPermissions) return false;
        
        return userPermissions.some(permission => {
            if (permission === '*') return true;
            if (permission.endsWith('.*')) {
                const prefix = permission.slice(0, -2);
                return requiredPermission.startsWith(prefix);
            }
            return permission === requiredPermission;
        });
    }

    async addUser(username, password, role = 'moderator') {
        const users = await this.getUsers();
        const permissions = role === 'admin' 
            ? ["dashboard.*", "users.*", "stock.*", "faq.*", "sop.*", "promo.*", "produk.*", "claim.*", "buyers.*", "blacklist.*"]
            : ["dashboard.read", "stock.read", "faq.*", "sop.*", "promo.read", "produk.read", "claim.read"];
            
        users[username] = {
            password: this.hashPassword(password),
            role,
            permissions
        };
        
        await fs.writeFile(this.usersFile, JSON.stringify(users, null, 2));
        return true;
    }

    async changePassword(username, newPassword) {
        const users = await this.getUsers();
        if (users[username]) {
            users[username].password = this.hashPassword(newPassword);
            await fs.writeFile(this.usersFile, JSON.stringify(users, null, 2));
            return true;
        }
        return false;
    }
}

const authInstance = new SimpleAuth();

// Export functions yang dibutuhkan oleh routes/auth_new.js
async function authenticateUser(username, password) {
    return await authInstance.validateUser(username, password);
}

function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    res.redirect('/login');
}

function requireRole(role) {
    return (req, res, next) => {
        if (req.session && req.session.user && req.session.user.role === role) {
            return next();
        }
        res.status(403).json({ error: 'Access denied' });
    };
}

function hashPassword(password) {
    return authInstance.hashPassword(password);
}

module.exports = {
    authenticateUser,
    requireAuth,
    requireRole,
    hashPassword,
    // Export instance untuk backward compatibility
    instance: authInstance
};
