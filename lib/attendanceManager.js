/**
 * ATTENDANCE MANAGER
 * Sistem absensi untuk MODERATOR (admin yang handle customer) via WhatsApp
 * 
 * Role Structure:
 * - MODERATOR (role: "moderator") = Admin yang handle customer → PAKAI ATTENDANCE
 * - ADMIN (role: "admin") = Owner → MONITOR ATTENDANCE via dashboard
 * 
 * Features:
 * - Moderator absen via WhatsApp: mulai, istirahat, masuk, close
 * - Owner monitor via web dashboard
 * - Notifikasi real-time ke owner
 * - Analytics jam kerja moderator
 */

const { loadJson, saveJson } = require('./dataLoader');
const moment = require('moment-timezone');

class AttendanceManager {
    constructor() {
        const config = require('../config');
        this.ownerNumber = config.owner_number; // Owner number dari config
        this.attendanceStates = {
            MULAI: 'mulai',
            ISTIRAHAT: 'istirahat', 
            MASUK: 'masuk',
            CLOSE: 'close'
        };
    }

    /**
     * HANDLE ATTENDANCE COMMANDS via WhatsApp
     */
    async handleAttendanceCommand(content, sock, sender, remoteJid, message, isModerator) {
        // Only moderators (actual admins) can use attendance
        // Owner doesn't need attendance tracking
        if (!isModerator) {
            return null; // Only for moderators (admins yang handle customer)
        }

        const lowerContent = content.toLowerCase().trim();
        const adminNumber = sender.split('@')[0];
        
        // Attendance commands
        if (['mulai', 'start', 'masuk kerja'].includes(lowerContent)) {
            return await this.clockIn(adminNumber, sock, sender, remoteJid, message);
        }
        
        if (['istirahat', 'break', 'rest'].includes(lowerContent)) {
            return await this.takeBreak(adminNumber, sock, sender, remoteJid, message);
        }
        
        if (['masuk', 'back', 'kembali', 'masuk lagi'].includes(lowerContent)) {
            return await this.backFromBreak(adminNumber, sock, sender, remoteJid, message);
        }
        
        if (['close', 'selesai', 'pulang', 'off'].includes(lowerContent)) {
            return await this.clockOut(adminNumber, sock, sender, remoteJid, message);
        }
        
        if (['status absen', 'absen status', 'my status'].includes(lowerContent)) {
            return await this.getMyStatus(adminNumber, sock, sender, remoteJid, message);
        }
        
        return null; // Not an attendance command
    }

    /**
     * CLOCK IN - Mulai kerja
     */
    async clockIn(adminNumber, sock, sender, remoteJid, message) {
        try {
            const now = moment.tz('Asia/Jakarta');
            const today = now.format('YYYY-MM-DD');
            const time = now.format('HH:mm:ss');
            
            // Load today's attendance
            let attendance = await this.loadTodayAttendance(today);
            
            // Check if already clocked in
            const existingRecord = attendance.find(record => 
                record.adminNumber === adminNumber && !record.clockOut
            );
            
            if (existingRecord) {
                return await sock.sendMessage(remoteJid, {
                    text: `⚠️ Kak sudah absen masuk hari ini!\n\n` +
                          `🕐 Masuk: ${existingRecord.clockIn}\n` +
                          `📊 Status: ${existingRecord.currentStatus}\n\n` +
                          `Ketik 'status absen' untuk lihat detail`
                }, { quoted: message });
            }
            
            // Get moderator info (yang sebenarnya adalah admin customer service)
            const adminInfo = await this.getModeratorInfo(adminNumber);
            
            // Create new attendance record
            const newRecord = {
                id: Date.now(),
                adminNumber: adminNumber,
                adminName: adminInfo.name,
                date: today,
                clockIn: time,
                clockOut: null,
                breaks: [],
                currentStatus: this.attendanceStates.MULAI,
                totalWorkTime: 0,
                totalBreakTime: 0
            };
            
            attendance.push(newRecord);
            await this.saveAttendance(today, attendance);
            
            // Send response to admin
            const response = `✅ *ABSEN MASUK BERHASIL*\n\n` +
                           `👤 *Admin:* ${adminInfo.name}\n` +
                           `📅 *Tanggal:* ${now.format('DD/MM/YYYY')}\n` +
                           `🕐 *Jam Masuk:* ${time} WIB\n` +
                           `📊 *Status:* Aktif\n\n` +
                           `Selamat bekerja! Semangat hari ini ya! 💪\n\n` +
                           `💡 *Commands:*\n` +
                           `• istirahat - Mulai break\n` +
                           `• close - Selesai kerja`;
            
            await sock.sendMessage(remoteJid, { text: response }, { quoted: message });
            
            // Notify owner
            await this.notifyOwner(sock, 'CLOCK_IN', {
                adminName: adminInfo.name,
                adminNumber: adminNumber,
                time: time,
                date: today
            });
            
            return true;
            
        } catch (error) {
            console.error('Error in clock in:', error);
            return await sock.sendMessage(remoteJid, {
                text: `❌ Gagal absen masuk: ${error.message}`
            }, { quoted: message });
        }
    }

    /**
     * TAKE BREAK - Mulai istirahat
     */
    async takeBreak(adminNumber, sock, sender, remoteJid, message) {
        try {
            const now = moment.tz('Asia/Jakarta');
            const today = now.format('YYYY-MM-DD');
            const time = now.format('HH:mm:ss');
            
            let attendance = await this.loadTodayAttendance(today);
            const record = attendance.find(r => r.adminNumber === adminNumber && !r.clockOut);
            
            if (!record) {
                return await sock.sendMessage(remoteJid, {
                    text: `❌ Belum absen masuk hari ini!\n\nKetik 'mulai' untuk absen masuk dulu ya`
                }, { quoted: message });
            }
            
            if (record.currentStatus === this.attendanceStates.ISTIRAHAT) {
                return await sock.sendMessage(remoteJid, {
                    text: `⚠️ Sudah dalam status istirahat!\n\n` +
                          `🕐 Mulai istirahat: ${record.breaks[record.breaks.length - 1]?.start}\n` +
                          `Ketik 'masuk' untuk kembali kerja`
                }, { quoted: message });
            }
            
            // Add break record
            record.breaks.push({
                start: time,
                end: null
            });
            record.currentStatus = this.attendanceStates.ISTIRAHAT;
            
            await this.saveAttendance(today, attendance);
            
            const response = `🍽️ *MULAI ISTIRAHAT*\n\n` +
                           `👤 *Admin:* ${record.adminName}\n` +
                           `🕐 *Jam Istirahat:* ${time} WIB\n` +
                           `📊 *Status:* Istirahat\n\n` +
                           `Selamat istirahat! Jangan lupa makan ya! 😊\n\n` +
                           `Ketik 'masuk' kalau sudah selesai istirahat`;
            
            return await sock.sendMessage(remoteJid, { text: response }, { quoted: message });
            
        } catch (error) {
            console.error('Error in take break:', error);
            return await sock.sendMessage(remoteJid, {
                text: `❌ Gagal istirahat: ${error.message}`
            }, { quoted: message });
        }
    }

    /**
     * BACK FROM BREAK - Kembali dari istirahat
     */
    async backFromBreak(adminNumber, sock, sender, remoteJid, message) {
        try {
            const now = moment.tz('Asia/Jakarta');
            const today = now.format('YYYY-MM-DD');
            const time = now.format('HH:mm:ss');
            
            let attendance = await this.loadTodayAttendance(today);
            const record = attendance.find(r => r.adminNumber === adminNumber && !r.clockOut);
            
            if (!record) {
                return await sock.sendMessage(remoteJid, {
                    text: `❌ Belum absen masuk hari ini!`
                }, { quoted: message });
            }
            
            if (record.currentStatus !== this.attendanceStates.ISTIRAHAT) {
                return await sock.sendMessage(remoteJid, {
                    text: `⚠️ Tidak dalam status istirahat!\n\nStatus saat ini: ${record.currentStatus}`
                }, { quoted: message });
            }
            
            // End current break
            const currentBreak = record.breaks[record.breaks.length - 1];
            if (currentBreak && !currentBreak.end) {
                currentBreak.end = time;
                
                // Calculate break duration
                const breakStart = moment.tz(`${today} ${currentBreak.start}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Jakarta');
                const breakEnd = moment.tz(`${today} ${currentBreak.end}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Jakarta');
                const breakDuration = breakEnd.diff(breakStart, 'minutes');
                currentBreak.duration = breakDuration;
            }
            
            record.currentStatus = this.attendanceStates.MASUK;
            await this.saveAttendance(today, attendance);
            
            const breakDuration = currentBreak?.duration || 0;
            const response = `💪 *KEMBALI KERJA*\n\n` +
                           `👤 *Admin:* ${record.adminName}\n` +
                           `🕐 *Selesai Istirahat:* ${time} WIB\n` +
                           `⏱️ *Durasi Istirahat:* ${breakDuration} menit\n` +
                           `📊 *Status:* Aktif Kembali\n\n` +
                           `Welcome back! Semangat lanjut kerja ya! 🚀`;
            
            return await sock.sendMessage(remoteJid, { text: response }, { quoted: message });
            
        } catch (error) {
            console.error('Error in back from break:', error);
            return await sock.sendMessage(remoteJid, {
                text: `❌ Gagal masuk kembali: ${error.message}`
            }, { quoted: message });
        }
    }

    /**
     * CLOCK OUT - Selesai kerja
     */
    async clockOut(adminNumber, sock, sender, remoteJid, message) {
        try {
            const now = moment.tz('Asia/Jakarta');
            const today = now.format('YYYY-MM-DD');
            const time = now.format('HH:mm:ss');
            
            let attendance = await this.loadTodayAttendance(today);
            const record = attendance.find(r => r.adminNumber === adminNumber && !r.clockOut);
            
            if (!record) {
                return await sock.sendMessage(remoteJid, {
                    text: `❌ Belum absen masuk hari ini atau sudah close!`
                }, { quoted: message });
            }
            
            // End any ongoing break
            if (record.currentStatus === this.attendanceStates.ISTIRAHAT) {
                const currentBreak = record.breaks[record.breaks.length - 1];
                if (currentBreak && !currentBreak.end) {
                    currentBreak.end = time;
                    const breakStart = moment.tz(`${today} ${currentBreak.start}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Jakarta');
                    const breakEnd = moment.tz(`${today} ${currentBreak.end}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Jakarta');
                    currentBreak.duration = breakEnd.diff(breakStart, 'minutes');
                }
            }
            
            // Calculate total work time
            const clockInTime = moment.tz(`${today} ${record.clockIn}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Jakarta');
            const clockOutTime = moment.tz(`${today} ${time}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Jakarta');
            const totalMinutes = clockOutTime.diff(clockInTime, 'minutes');
            
            // Calculate total break time
            const totalBreakTime = record.breaks.reduce((total, br) => total + (br.duration || 0), 0);
            const effectiveWorkTime = totalMinutes - totalBreakTime;
            
            // Update record
            record.clockOut = time;
            record.currentStatus = this.attendanceStates.CLOSE;
            record.totalWorkTime = effectiveWorkTime;
            record.totalBreakTime = totalBreakTime;
            
            await this.saveAttendance(today, attendance);
            
            const workHours = Math.floor(effectiveWorkTime / 60);
            const workMinutes = effectiveWorkTime % 60;
            
            const response = `🏁 *SELESAI KERJA*\n\n` +
                           `👤 *Admin:* ${record.adminName}\n` +
                           `📅 *Tanggal:* ${now.format('DD/MM/YYYY')}\n` +
                           `🕐 *Jam Masuk:* ${record.clockIn} WIB\n` +
                           `🕐 *Jam Keluar:* ${time} WIB\n` +
                           `⏱️ *Total Kerja:* ${workHours}j ${workMinutes}m\n` +
                           `🍽️ *Total Istirahat:* ${totalBreakTime} menit\n` +
                           `📊 *Status:* Selesai\n\n` +
                           `Terima kasih atas kerja kerasnya hari ini! 🙏\n` +
                           `Istirahat yang cukup ya! 😊`;
            
            await sock.sendMessage(remoteJid, { text: response }, { quoted: message });
            
            // Notify owner
            await this.notifyOwner(sock, 'CLOCK_OUT', {
                adminName: record.adminName,
                adminNumber: adminNumber,
                clockIn: record.clockIn,
                clockOut: time,
                totalWorkTime: effectiveWorkTime,
                totalBreakTime: totalBreakTime,
                date: today
            });
            
            return true;
            
        } catch (error) {
            console.error('Error in clock out:', error);
            return await sock.sendMessage(remoteJid, {
                text: `❌ Gagal close: ${error.message}`
            }, { quoted: message });
        }
    }

    /**
     * GET MY STATUS - Lihat status absensi saat ini
     */
    async getMyStatus(adminNumber, sock, sender, remoteJid, message) {
        try {
            const now = moment.tz('Asia/Jakarta');
            const today = now.format('YYYY-MM-DD');
            
            const attendance = await this.loadTodayAttendance(today);
            const record = attendance.find(r => r.adminNumber === adminNumber);
            
            if (!record) {
                return await sock.sendMessage(remoteJid, {
                    text: `📋 *STATUS ABSENSI*\n\n` +
                          `📅 *Tanggal:* ${now.format('DD/MM/YYYY')}\n` +
                          `📊 *Status:* Belum absen masuk\n\n` +
                          `Ketik 'mulai' untuk absen masuk ya!`
                }, { quoted: message });
            }
            
            // Calculate current work time
            let currentWorkTime = 0;
            if (record.clockIn && !record.clockOut) {
                const clockInTime = moment.tz(`${today} ${record.clockIn}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Jakarta');
                const currentTime = now;
                currentWorkTime = currentTime.diff(clockInTime, 'minutes');
                
                // Subtract break time
                const completedBreaks = record.breaks.filter(br => br.end).reduce((total, br) => total + br.duration, 0);
                currentWorkTime -= completedBreaks;
                
                // Subtract current break if any
                if (record.currentStatus === this.attendanceStates.ISTIRAHAT) {
                    const currentBreak = record.breaks[record.breaks.length - 1];
                    if (currentBreak && !currentBreak.end) {
                        const breakStart = moment.tz(`${today} ${currentBreak.start}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Jakarta');
                        const currentBreakTime = now.diff(breakStart, 'minutes');
                        currentWorkTime -= currentBreakTime;
                    }
                }
            }
            
            const workHours = Math.floor(Math.max(0, currentWorkTime) / 60);
            const workMinutes = Math.max(0, currentWorkTime) % 60;
            
            const statusEmoji = {
                [this.attendanceStates.MULAI]: '💪',
                [this.attendanceStates.ISTIRAHAT]: '🍽️',
                [this.attendanceStates.MASUK]: '💪',
                [this.attendanceStates.CLOSE]: '🏁'
            };
            
            const response = `📋 *STATUS ABSENSI HARI INI*\n\n` +
                           `👤 *Admin:* ${record.adminName}\n` +
                           `📅 *Tanggal:* ${now.format('DD/MM/YYYY')}\n` +
                           `🕐 *Jam Masuk:* ${record.clockIn} WIB\n` +
                           `${record.clockOut ? `🕐 *Jam Keluar:* ${record.clockOut} WIB\n` : ''}` +
                           `📊 *Status:* ${statusEmoji[record.currentStatus]} ${record.currentStatus.toUpperCase()}\n` +
                           `⏱️ *Kerja Efektif:* ${workHours}j ${workMinutes}m\n` +
                           `🍽️ *Total Break:* ${record.breaks.filter(br => br.end).reduce((total, br) => total + br.duration, 0)} menit\n\n` +
                           `${record.currentStatus === this.attendanceStates.ISTIRAHAT ? 
                             'Sedang istirahat. Ketik "masuk" untuk kembali kerja' : 
                             record.currentStatus === this.attendanceStates.CLOSE ? 
                             'Sudah selesai kerja hari ini' : 
                             'Sedang aktif bekerja. Semangat!'}`;
            
            return await sock.sendMessage(remoteJid, { text: response }, { quoted: message });
            
        } catch (error) {
            console.error('Error getting status:', error);
            return await sock.sendMessage(remoteJid, {
                text: `❌ Gagal cek status: ${error.message}`
            }, { quoted: message });
        }
    }

    /**
     * NOTIFY OWNER - Kirim notifikasi ke owner
     */
    async notifyOwner(sock, eventType, data) {
        try {
            const ownerJid = `${this.ownerNumber}@s.whatsapp.net`;
            const now = moment.tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm');
            
            let notificationText = '';
            
            switch (eventType) {
                case 'CLOCK_IN':
                    notificationText = `🔔 *NOTIFIKASI ABSENSI*\n\n` +
                                     `✅ Admin masuk kerja\n` +
                                     `👤 *Nama:* ${data.adminName}\n` +
                                     `📱 *Nomor:* ${data.adminNumber}\n` +
                                     `🕐 *Jam:* ${data.time} WIB\n` +
                                     `📅 *Tanggal:* ${data.date}\n\n` +
                                     `Admin siap melayani customer! 💪`;
                    break;
                    
                case 'CLOCK_OUT':
                    const workHours = Math.floor(data.totalWorkTime / 60);
                    const workMinutes = data.totalWorkTime % 60;
                    
                    notificationText = `🔔 *NOTIFIKASI ABSENSI*\n\n` +
                                     `🏁 Admin selesai kerja\n` +
                                     `👤 *Nama:* ${data.adminName}\n` +
                                     `📱 *Nomor:* ${data.adminNumber}\n` +
                                     `🕐 *Masuk:* ${data.clockIn} WIB\n` +
                                     `🕐 *Keluar:* ${data.clockOut} WIB\n` +
                                     `⏱️ *Total Kerja:* ${workHours}j ${workMinutes}m\n` +
                                     `🍽️ *Total Break:* ${data.totalBreakTime}m\n\n` +
                                     `Terima kasih ${data.adminName}! 🙏`;
                    break;
                    
                case 'LONG_BREAK':
                    notificationText = `⚠️ *ALERT ABSENSI*\n\n` +
                                     `🍽️ Admin istirahat lama\n` +
                                     `👤 *Nama:* ${data.adminName}\n` +
                                     `⏱️ *Durasi:* ${data.duration} menit\n\n` +
                                     `Mungkin perlu dicek?`;
                    break;
            }
            
            if (notificationText) {
                await sock.sendMessage(ownerJid, { text: notificationText });
            }
            
        } catch (error) {
            console.warn('Error notifying owner:', error);
        }
    }

    /**
     * DATA MANAGEMENT
     */
    async loadTodayAttendance(date) {
        try {
            const filename = `attendance_${date}.json`;
            return await loadJson(`attendance/${filename}`) || [];
        } catch (error) {
            return [];
        }
    }

    async saveAttendance(date, data) {
        try {
            const filename = `attendance_${date}.json`;
            return await saveJson(`attendance/${filename}`, data);
        } catch (error) {
            console.error('Error saving attendance:', error);
            return false;
        }
    }

    async getModeratorInfo(adminNumber) {
        try {
            // Cari di daftar moderator (yang sebenarnya adalah admin customer service)
            const moderators = await loadJson('moderators.json') || [];
            const moderator = moderators.find(mod => mod.number === adminNumber);
            
            if (moderator) {
                return { name: moderator.name, role: 'moderator', id: moderator.id };
            }
            
            // Fallback jika tidak ditemukan
            return { name: `CS Admin ${adminNumber.slice(-4)}`, role: 'moderator', id: null };
        } catch (error) {
            return { name: `CS Admin ${adminNumber.slice(-4)}`, role: 'moderator', id: null };
        }
    }

    /**
     * GET ATTENDANCE DATA for dashboard
     */
    async getAttendanceData(date = null) {
        try {
            const targetDate = date || moment.tz('Asia/Jakarta').format('YYYY-MM-DD');
            return await this.loadTodayAttendance(targetDate);
        } catch (error) {
            console.error('Error getting attendance data:', error);
            return [];
        }
    }

    /**
     * GET ATTENDANCE SUMMARY for dashboard
     */
    async getAttendanceSummary(startDate = null, endDate = null) {
        try {
            const start = startDate || moment.tz('Asia/Jakarta').subtract(7, 'days').format('YYYY-MM-DD');
            const end = endDate || moment.tz('Asia/Jakarta').format('YYYY-MM-DD');
            
            const summary = {
                totalDays: 0,
                adminStats: {},
                dailyStats: {}
            };
            
            // Load data for date range
            const current = moment.tz(start, 'YYYY-MM-DD', 'Asia/Jakarta');
            const endMoment = moment.tz(end, 'YYYY-MM-DD', 'Asia/Jakarta');
            
            while (current.isSameOrBefore(endMoment)) {
                const dateStr = current.format('YYYY-MM-DD');
                const dayData = await this.loadTodayAttendance(dateStr);
                
                summary.dailyStats[dateStr] = {
                    totalAdmins: dayData.length,
                    totalWorkTime: dayData.reduce((total, record) => total + (record.totalWorkTime || 0), 0),
                    avgWorkTime: dayData.length > 0 ? Math.round(dayData.reduce((total, record) => total + (record.totalWorkTime || 0), 0) / dayData.length) : 0
                };
                
                // Per admin stats
                for (const record of dayData) {
                    if (!summary.adminStats[record.adminNumber]) {
                        summary.adminStats[record.adminNumber] = {
                            name: record.adminName,
                            totalDays: 0,
                            totalWorkTime: 0,
                            avgWorkTime: 0
                        };
                    }
                    
                    summary.adminStats[record.adminNumber].totalDays++;
                    summary.adminStats[record.adminNumber].totalWorkTime += record.totalWorkTime || 0;
                }
                
                current.add(1, 'day');
                summary.totalDays++;
            }
            
            // Calculate averages
            for (const adminNumber in summary.adminStats) {
                const adminStat = summary.adminStats[adminNumber];
                adminStat.avgWorkTime = adminStat.totalDays > 0 ? 
                    Math.round(adminStat.totalWorkTime / adminStat.totalDays) : 0;
            }
            
            return summary;
        } catch (error) {
            console.error('Error getting attendance summary:', error);
            return {};
        }
    }
}

// Create singleton instance
const attendanceManager = new AttendanceManager();

module.exports = { AttendanceManager, attendanceManager };