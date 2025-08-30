const { loadJson, saveJson } = require('./dataLoader');
const config = require('../config');

// Helper untuk cek apakah user adalah owner
function isOwner(sender) {
  const number = sender.split('@')[0];
  return number === config.owner_number;
}

// Helper untuk cek apakah user adalah moderator
async function isModerator(sender) {
  try {
    const moderators = await loadJson('moderators.json');
    const number = sender.split('@')[0];
    return moderators.some(mod => mod.number === number && mod.active);
  } catch {
    return false;
  }
}

// Helper untuk cek apakah user adalah admin (owner atau moderator)
async function isAdmin(sender) {
  return isOwner(sender) || await isModerator(sender);
}

// Tambah moderator baru (hanya owner)
async function addModerator(number, name, addedBy) {
  try {
    let moderators = await loadJson('moderators.json');
    if (!Array.isArray(moderators)) moderators = [];
    
    // Cek apakah sudah ada
    const exists = moderators.some(mod => mod.number === number);
    if (exists) {
      throw new Error('Moderator dengan nomor ini sudah ada');
    }
    
    const newMod = {
      id: Date.now(),
      number: number,
      name: name,
      addedBy: addedBy,
      addedDate: new Date().toISOString(),
      active: true
    };
    
    moderators.push(newMod);
    await saveJson('moderators.json', moderators);
    
    return newMod;
  } catch (error) {
    throw error;
  }
}

// List semua moderator
async function listModerators() {
  try {
    const moderators = await loadJson('moderators.json');
    return Array.isArray(moderators) ? moderators : [];
  } catch {
    return [];
  }
}

// Hapus moderator (hanya owner)
async function removeModerator(number) {
  try {
    let moderators = await loadJson('moderators.json');
    if (!Array.isArray(moderators)) moderators = [];
    
    const index = moderators.findIndex(mod => mod.number === number);
    if (index === -1) {
      throw new Error('Moderator tidak ditemukan');
    }
    
    const removed = moderators.splice(index, 1)[0];
    await saveJson('moderators.json', moderators);
    
    return removed;
  } catch (error) {
    throw error;
  }
}

// Toggle status moderator (hanya owner)
async function toggleModeratorStatus(number) {
  try {
    let moderators = await loadJson('moderators.json');
    if (!Array.isArray(moderators)) moderators = [];
    
    const mod = moderators.find(m => m.number === number);
    if (!mod) {
      throw new Error('Moderator tidak ditemukan');
    }
    
    mod.active = !mod.active;
    await saveJson('moderators.json', moderators);
    
    return mod;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  isOwner,
  isModerator,
  isAdmin,
  addModerator,
  listModerators,
  removeModerator,
  toggleModeratorStatus
};
