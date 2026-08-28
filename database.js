const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database(path.join(__dirname, 'lawyer_system.db'));

function initializeDatabase() {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                full_name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'lawyer',
                phone TEXT,
                license_number TEXT,
                specialization TEXT,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME,
                is_online INTEGER DEFAULT 0,
                avatar TEXT
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS lawyer_clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lawyer_id INTEGER NOT NULL,
                client_id INTEGER NOT NULL,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lawyer_id) REFERENCES users(id),
                FOREIGN KEY (client_id) REFERENCES users(id)
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS cases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lawyer_id INTEGER NOT NULL,
                client_id INTEGER NOT NULL,
                case_number TEXT,
                case_type TEXT,
                court_name TEXT,
                status TEXT DEFAULT 'active',
                title TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lawyer_id) REFERENCES users(id),
                FOREIGN KEY (client_id) REFERENCES users(id)
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id INTEGER,
                lawyer_id INTEGER NOT NULL,
                client_id INTEGER,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT,
                file_size INTEGER,
                description TEXT,
                shared_with TEXT,
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (case_id) REFERENCES cases(id),
                FOREIGN KEY (lawyer_id) REFERENCES users(id),
                FOREIGN KEY (client_id) REFERENCES users(id)
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER,
                room_id TEXT,
                message TEXT,
                file_path TEXT,
                is_read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users(id)
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lawyer_id INTEGER NOT NULL,
                client_id INTEGER,
                case_id INTEGER,
                title TEXT NOT NULL,
                event_type TEXT,
                event_date DATETIME NOT NULL,
                location TEXT,
                notes TEXT,
                status TEXT DEFAULT 'scheduled',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lawyer_id) REFERENCES users(id),
                FOREIGN KEY (client_id) REFERENCES users(id),
                FOREIGN KEY (case_id) REFERENCES cases(id)
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS consultations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lawyer_id INTEGER NOT NULL,
                client_id INTEGER NOT NULL,
                subject TEXT NOT NULL,
                description TEXT,
                consultation_type TEXT,
                status TEXT DEFAULT 'pending',
                preferred_date DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lawyer_id) REFERENCES users(id),
                FOREIGN KEY (client_id) REFERENCES users(id)
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS chat_rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_name TEXT NOT NULL,
                room_type TEXT DEFAULT 'private',
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT,
                is_read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        const adminEmail = 'admin@lawyer-system.com';
        const adminPassword = 'admin123456';
        
        db.get('SELECT id FROM users WHERE email = ? AND role = ?', [adminEmail, 'admin'], (err, row) => {
            if (!row) {
                const hashedPassword = bcrypt.hashSync(adminPassword, 10);
                db.run(`
                    INSERT INTO users (email, password, full_name, role, status)
                    VALUES (?, ?, ?, ?, ?)
                `, [adminEmail, hashedPassword, 'مبرمج النظام', 'admin', 'active'], (err) => {
                    if (err) {
                        console.error('Error creating admin:', err);
                    } else {
                        console.log('✅ تم إنشاء حساب المبرمج الرئيسي');
                        console.log('📧 البريد:', adminEmail);
                        console.log('🔑 كلمة المرور:', adminPassword);
                    }
                });
            }
        });
    });
}

module.exports = { db, initializeDatabase };