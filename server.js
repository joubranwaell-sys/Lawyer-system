const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { db, initializeDatabase } = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const JWT_SECRET = 'lawyer_system_secret_key_2024';
const PORT = process.env.PORT || 3000;

// ==========================================
// ✉️ إعدادات البريد الحقيقي - عدّل هنا فقط
// ==========================================
const YOUR_GMAIL = 'joubranwaell@gmail.com';      // ✏️ ضع بريدك الحقيقي
const YOUR_APP_PASSWORD = 'ygzjxsctpoyproti';  // ✏️ ضع كلمة مرور التطبيق
const ADMIN_EMAIL = 'joubranwaell@gmail.com';     // ✏️ ضع بريد المبرمج

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: YOUR_GMAIL,
        pass: YOUR_APP_PASSWORD
    }
});

async function sendRealEmail(to, subject, text) {
    try {
        const mailOptions = {
            from: YOUR_GMAIL,
            to: to,
            subject: subject,
            text: text,
            html: `
                <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; padding: 20px; background: #f5f5f5;">
                    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #1a237e; border-bottom: 3px solid #ffd700; padding-bottom: 10px;">⚖️ نظام إدارة المحامين</h2>
                        <div style="margin-top: 20px; font-size: 16px; line-height: 1.8;">
                            ${text.replace(/\n/g, '<br>')}
                        </div>
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">
                            هذه رسالة تلقائية من نظام إدارة المحامين
                        </div>
                    </div>
                </div>
            `
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ تم إرسال البريد:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ خطأ في إرسال البريد:', error);
        return { success: false, error: error.message };
    }
}
// ==========================================

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

initializeDatabase();

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'غير مصرح بالوصول' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'انتهت صلاحية الجلسة' });
        }
        req.user = user;
        next();
    });
}

// ============== تسجيل محامٍ جديد ==============
app.post('/api/register/lawyer', async (req, res) => {
    try {
        const { email, password, full_name, phone, license_number, specialization } = req.body;
        
        db.get('SELECT id FROM users WHERE email = ?', [email], async (err, existing) => {
            if (existing) {
                return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
            }
            
            const hashedPassword = await bcrypt.hash(password, 10);
            
            db.run(`
                INSERT INTO users (email, password, full_name, phone, license_number, specialization, role, status)
                VALUES (?, ?, ?, ?, ?, ?, 'lawyer', 'pending')
            `, [email, hashedPassword, full_name, phone, license_number, specialization], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'خطأ في التسجيل' });
                }
                
                db.run(`
                    INSERT INTO notifications (user_id, type, title, message)
                    SELECT id, 'new_registration', 'محامٍ جديد بانتظار الموافقة', ?
                    FROM users WHERE role = 'admin'
                `, [`${full_name} بانتظار الموافقة`]);
                
                // إرسال بريد ترحيبي حقيقي للمحامي
                sendRealEmail(
                    email,
                    '🎉 تم استلام طلب اشتراكك',
                    `مرحباً ${full_name}،\n\nتم استلام طلب اشتراكك في نظام إدارة المحامين بنجاح.\n\nطلبك الآن قيد المراجعة من قبل إدارة النظام.\n\nسنرسل لك بريداً إلكترونياً فور الموافقة على طلبك.\n\nبيانات التسجيل:\n- الاسم: ${full_name}\n- البريد: ${email}\n- التخصص: ${specialization}\n\nمع تحياتنا،\nفريق نظام إدارة المحامين`
                );
                
                // إشعار المبرمج عبر البريد
                sendRealEmail(
                    ADMIN_EMAIL,
                    '🔔 محامٍ جديد بانتظار الموافقة',
                    `مرحباً،\n\nتم تسجيل محامٍ جديد في النظام بانتظار موافقتك.\n\nالاسم: ${full_name}\nالبريد: ${email}\nالتخصص: ${specialization}\nرقم الترخيص: ${license_number}\n\nيرجى الدخول إلى لوحة التحكم للموافقة أو الرفض.`
                );
                
                res.json({ 
                    success: true, 
                    message: 'تم التسجيل بنجاح، بانتظار موافقة المبرمج',
                    user_id: this.lastID
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ============== تسجيل عميل ==============
app.post('/api/register/client', async (req, res) => {
    try {
        const { email, password, full_name, phone } = req.body;
        
        db.get('SELECT id FROM users WHERE email = ?', [email], async (err, existing) => {
            if (existing) {
                return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
            }
            
            const hashedPassword = await bcrypt.hash(password, 10);
            
            db.run(`
                INSERT INTO users (email, password, full_name, phone, role, status)
                VALUES (?, ?, ?, ?, 'client', 'active')
            `, [email, hashedPassword, full_name, phone], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'خطأ في التسجيل' });
                }
                
                // إرسال بريد ترحيبي حقيقي للعميل
                sendRealEmail(
                    email,
                    '🎉 مرحباً بك في نظام إدارة المحامين',
                    `مرحباً ${full_name}،\n\nتم إنشاء حسابك في نظام إدارة المحامين بنجاح.\n\nيمكنك الآن:\n- التواصل مع محاميك\n- طلب استشارات قانونية\n- متابعة قضاياك\n- مشاركة الملفات\n\nرابط الدخول: http://localhost:3000/client.html\n\nمع تحياتنا،\nفريق نظام إدارة المحامين`
                );
                
                res.json({ 
                    success: true, 
                    message: 'تم التسجيل بنجاح',
                    user_id: this.lastID
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ============== تسجيل الدخول ==============
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (!user) {
            return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
        }
        
        if (user.status === 'rejected') {
            return res.status(403).json({ error: 'تم رفض طلبك من قبل المبرمج' });
        }
        
        if (user.status === 'pending' && user.role === 'lawyer') {
            return res.status(403).json({ error: 'حسابك بانتظار موافقة المبرمج' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
        }
        
        db.run('UPDATE users SET is_online = 1, last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                status: user.status,
                specialization: user.specialization
            }
        });
    });
});

// ============== قائمة المحامين للمبرمج ==============
app.get('/api/admin/lawyers', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
    }
    
    db.all(`
        SELECT id, email, full_name, phone, license_number, specialization, 
               status, is_online, created_at, last_login
        FROM users WHERE role = 'lawyer'
        ORDER BY created_at DESC
    `, (err, lawyers) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في جلب البيانات' });
        }
        res.json(lawyers);
    });
});

// ============== الموافقة على محامٍ ==============
app.post('/api/admin/approve-lawyer', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
    }
    
    const { lawyer_id } = req.body;
    
    db.run('UPDATE users SET status = ? WHERE id = ? AND role = ?', ['active', lawyer_id, 'lawyer'], (err) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الموافقة' });
        }
        
        db.get('SELECT email, full_name FROM users WHERE id = ?', [lawyer_id], (err, lawyer) => {
            if (lawyer) {
                db.run(`
                    INSERT INTO notifications (user_id, type, title, message)
                    VALUES (?, 'approval', 'تم تفعيل حسابك', 'مبروك! تم تفعيل حسابك في النظام')
                `, [lawyer_id]);
                
                // إرسال بريد حقيقي بالموافقة
                sendRealEmail(
                    lawyer.email,
                    '✅ تم تفعيل حسابك في نظام إدارة المحامين',
                    `مرحباً ${lawyer.full_name}،\n\nنفيدك بأنه تم تفعيل حسابك في نظام إدارة المحامين.\n\nيمكنك الآن تسجيل الدخول والبدء في استخدام النظام.\n\nرابط الدخول: http://localhost:3000/lawyer.html\n\nمع تحياتنا،\nفريق نظام إدارة المحامين`
                );
            }
        });
        
        res.json({ success: true, message: 'تم تفعيل حساب المحامي' });
    });
});

// ============== رفض محامٍ ==============
app.post('/api/admin/reject-lawyer', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
    }
    
    const { lawyer_id } = req.body;
    
    db.run('UPDATE users SET status = ? WHERE id = ? AND role = ?', ['rejected', lawyer_id, 'lawyer'], (err) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الرفض' });
        }
        
        db.run(`
            INSERT INTO notifications (user_id, type, title, message)
            VALUES (?, 'rejection', 'تم رفض طلبك', 'نأسف، تم رفض طلب اشتراكك في النظام')
        `, [lawyer_id]);
        
        // إرسال بريد حقيقي بالرفض
        db.get('SELECT email, full_name FROM users WHERE id = ?', [lawyer_id], (err, lawyer) => {
            if (lawyer) {
                sendRealEmail(
                    lawyer.email,
                    '❌ بخصوص طلب انضمامك لنظام إدارة المحامين',
                    `مرحباً ${lawyer.full_name}،\n\nنشكرك على اهتمامك بالانضمام إلى نظام إدارة المحامين.\n\nنأسف لإبلاغك بأنه تم رفض طلب اشتراكك.\n\nإذا كان لديك أي استفسار، يمكنك التواصل معنا.\n\nمع تحياتنا،\nفريق نظام إدارة المحامين`
                );
            }
        });
        
        res.json({ success: true, message: 'تم رفض المحامي' });
    });
});

// ============== حذف محامٍ ==============
app.delete('/api/admin/delete-lawyer/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
    }
    
    const lawyerId = req.params.id;
    
    db.serialize(() => {
        db.run('DELETE FROM files WHERE lawyer_id = ?', [lawyerId]);
        db.run('DELETE FROM cases WHERE lawyer_id = ?', [lawyerId]);
        db.run('DELETE FROM events WHERE lawyer_id = ?', [lawyerId]);
        db.run('DELETE FROM consultations WHERE lawyer_id = ?', [lawyerId]);
        db.run('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?', [lawyerId, lawyerId]);
        db.run('DELETE FROM lawyer_clients WHERE lawyer_id = ?', [lawyerId]);
        db.run('DELETE FROM notifications WHERE user_id = ?', [lawyerId]);
        db.run('DELETE FROM users WHERE id = ? AND role = ?', [lawyerId, 'lawyer'], (err) => {
            if (err) {
                return res.status(500).json({ error: 'خطأ في الحذف' });
            }
            res.json({ success: true, message: 'تم حذف المحامي وكل بياناته' });
        });
    });
});

// ============== إحصائيات عامة ==============
app.get('/api/admin/stats', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
    }
    
    db.serialize(() => {
        const stats = {};
        
        db.get('SELECT COUNT(*) as total_lawyers FROM users WHERE role = ?', ['lawyer'], (err, row) => {
            stats.total_lawyers = row?.total_lawyers || 0;
            db.get('SELECT COUNT(*) as active_lawyers FROM users WHERE role = ? AND status = ?', ['lawyer', 'active'], (err, row) => {
                stats.active_lawyers = row?.active_lawyers || 0;
                db.get('SELECT COUNT(*) as pending_lawyers FROM users WHERE role = ? AND status = ?', ['lawyer', 'pending'], (err, row) => {
                    stats.pending_lawyers = row?.pending_lawyers || 0;
                    db.get('SELECT COUNT(*) as total_clients FROM users WHERE role = ?', ['client'], (err, row) => {
                        stats.total_clients = row?.total_clients || 0;
                        db.get('SELECT COUNT(*) as total_cases FROM cases', [], (err, row) => {
                            stats.total_cases = row?.['COUNT(*)'] || 0;
                            db.get('SELECT COUNT(*) as total_files FROM files', [], (err, row) => {
                                stats.total_files = row?.['COUNT(*)'] || 0;
                                db.get('SELECT COUNT(*) as total_messages FROM messages', [], (err, row) => {
                                    stats.total_messages = row?.['COUNT(*)'] || 0;
                                    res.json(stats);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// ============== عملاء المحامي ==============
app.get('/api/lawyer/clients', authenticateToken, (req, res) => {
    const lawyerId = req.user.id;
    
    db.all(`
        SELECT u.id, u.email, u.full_name, u.phone, u.is_online, lc.status, lc.created_at
        FROM lawyer_clients lc
        JOIN users u ON lc.client_id = u.id
        WHERE lc.lawyer_id = ? AND lc.status = 'active'
        ORDER BY lc.created_at DESC
    `, [lawyerId], (err, clients) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في جلب العملاء' });
        }
        res.json(clients);
    });
});

// ============== إضافة عميل ==============
app.post('/api/lawyer/add-client', authenticateToken, (req, res) => {
    const lawyerId = req.user.id;
    const { client_email } = req.body;
    
    db.get('SELECT id, full_name FROM users WHERE email = ? AND role = ?', [client_email, 'client'], (err, client) => {
        if (!client) {
            return res.status(404).json({ error: 'العميل غير موجود، يجب أن يسجل أولاً' });
        }
        
        db.get('SELECT id FROM lawyer_clients WHERE lawyer_id = ? AND client_id = ?', [lawyerId, client.id], (err, existing) => {
            if (existing) {
                return res.status(400).json({ error: 'هذا العميل مرتبط بك بالفعل' });
            }
            
            db.run(`
                INSERT INTO lawyer_clients (lawyer_id, client_id)
                VALUES (?, ?)
            `, [lawyerId, client.id], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'خطأ في إضافة العميل' });
                }
                
                db.run(`
                    INSERT INTO notifications (user_id, type, title, message)
                    VALUES (?, 'new_client', 'عميل جديد', 'تم إضافتك كعميل لدى محامٍ')
                `, [client.id]);
                
                // إرسال بريد حقيقي للعميل
                sendRealEmail(
                    client_email,
                    '👋 تم إضافتك كعميل لدى محامٍ',
                    `مرحباً ${client.full_name}،\n\nتم إضافتك كعميل في نظام إدارة المحامين.\n\nيمكنك الآن التواصل مع محاميك ومتابعة قضاياك.\n\nرابط الدخول: http://localhost:3000/client.html\n\nمع تحياتنا،\nفريق نظام إدارة المحامين`
                );
                
                res.json({ success: true, message: 'تم إضافة العميل بنجاح' });
            });
        });
    });
});

// ============== قضايا المحامي ==============
app.get('/api/lawyer/cases', authenticateToken, (req, res) => {
    const lawyerId = req.user.id;
    
    db.all(`
        SELECT c.*, u.full_name as client_name
        FROM cases c
        JOIN users u ON c.client_id = u.id
        WHERE c.lawyer_id = ?
        ORDER BY c.updated_at DESC
    `, [lawyerId], (err, cases) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في جلب القضايا' });
        }
        res.json(cases);
    });
});

// ============== إنشاء قضية ==============
app.post('/api/lawyer/create-case', authenticateToken, (req, res) => {
    const lawyerId = req.user.id;
    const { client_id, title, case_number, case_type, court_name, description } = req.body;
    
    db.run(`
        INSERT INTO cases (lawyer_id, client_id, title, case_number, case_type, court_name, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [lawyerId, client_id, title, case_number, case_type, court_name, description], function(err) {
        if (err) {
            return res.status(500).json({ error: 'خطأ في إنشاء القضية' });
        }
        
        res.json({ success: true, message: 'تم إنشاء القضية', case_id: this.lastID });
    });
});

// ============== رفع ملف ==============
app.post('/api/lawyer/upload-file', authenticateToken, upload.single('file'), (req, res) => {
    const lawyerId = req.user.id;
    const { case_id, description, shared_with } = req.body;
    
    if (!req.file) {
        return res.status(400).json({ error: 'لم يتم اختيار ملف' });
    }
    
    db.run(`
        INSERT INTO files (case_id, lawyer_id, file_name, file_path, file_type, file_size, description, shared_with)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        case_id, 
        lawyerId, 
        req.file.originalname,
        req.file.path,
        req.file.mimetype,
        req.file.size,
        description,
        shared_with || 'private'
    ], function(err) {
        if (err) {
            return res.status(500).json({ error: 'خطأ في رفع الملف' });
        }
        
        res.json({ 
            success: true, 
            message: 'تم رفع الملف بنجاح',
            file_id: this.lastID
        });
    });
});

// ============== ملفات المحامي ==============
app.get('/api/lawyer/files', authenticateToken, (req, res) => {
    const lawyerId = req.user.id;
    
    db.all(`
        SELECT f.*, c.title as case_title, u.full_name as client_name
        FROM files f
        LEFT JOIN cases c ON f.case_id = c.id
        LEFT JOIN users u ON f.client_id = u.id
        WHERE f.lawyer_id = ?
        ORDER BY f.uploaded_at DESC
    `, [lawyerId], (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في جلب الملفات' });
        }
        res.json(files);
    });
});

// ============== الرسائل ==============
app.get('/api/messages/:userId', authenticateToken, (req, res) => {
    const currentUser = req.user.id;
    const otherUser = req.params.userId;
    
    db.all(`
        SELECT * FROM messages
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at ASC
    `, [currentUser, otherUser, otherUser, currentUser], (err, messages) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في جلب الرسائل' });
        }
        
        db.run('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?', [otherUser, currentUser]);
        
        res.json(messages);
    });
});

app.post('/api/messages', authenticateToken, (req, res) => {
    const senderId = req.user.id;
    const { receiver_id, message, file_path } = req.body;
    
    db.run(`
        INSERT INTO messages (sender_id, receiver_id, message, file_path)
        VALUES (?, ?, ?, ?)
    `, [senderId, receiver_id, message, file_path], function(err) {
        if (err) {
            return res.status(500).json({ error: 'خطأ في إرسال الرسالة' });
        }
        
        res.json({ 
            success: true, 
            message: 'تم إرسال الرسالة',
            message_id: this.lastID
        });
    });
});

// ============== Socket.IO ==============
io.on('connection', (socket) => {
    console.log('👤 مستخدم متصل:', socket.id);
    
    socket.on('register', (userId) => {
        socket.userId = userId;
        socket.join(`user_${userId}`);
        
        db.run('UPDATE users SET is_online = 1 WHERE id = ?', [userId]);
        
        io.emit('user_online', { user_id: userId, socket_id: socket.id });
    });
    
    socket.on('send_message', (data) => {
        const { receiver_id, message } = data;
        
        db.run(`
            INSERT INTO messages (sender_id, receiver_id, message)
            VALUES (?, ?, ?)
        `, [socket.userId, receiver_id, message], function(err) {
            if (!err) {
                const messageData = {
                    id: this.lastID,
                    sender_id: socket.userId,
                    receiver_id: receiver_id,
                    message: message,
                    created_at: new Date().toISOString()
                };
                
                io.to(`user_${receiver_id}`).emit('new_message', messageData);
                socket.emit('message_sent', messageData);
            }
        });
    });
    
    socket.on('join_room', (roomId) => {
        socket.join(`room_${roomId}`);
        console.log(`👥 مستخدم ${socket.userId} انضم للغرفة ${roomId}`);
    });
    
    socket.on('leave_room', (roomId) => {
        socket.leave(`room_${roomId}`);
    });
    
    socket.on('send_room_message', (data) => {
        const { room_id, message } = data;
        
        db.run(`
            INSERT INTO messages (sender_id, room_id, message)
            VALUES (?, ?, ?)
        `, [socket.userId, room_id, message], function(err) {
            if (!err) {
                const messageData = {
                    id: this.lastID,
                    sender_id: socket.userId,
                    room_id: room_id,
                    message: message,
                    created_at: new Date().toISOString()
                };
                
                io.to(`room_${room_id}`).emit('new_room_message', messageData);
            }
        });
    });
    
    socket.on('disconnect', () => {
        console.log('👋 مستخدم قطع الاتصال:', socket.id);
        
        if (socket.userId) {
            db.run('UPDATE users SET is_online = 0 WHERE id = ?', [socket.userId]);
            io.emit('user_offline', { user_id: socket.userId });
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 النظام يعمل على المنفذ ${PORT}`);
    console.log(`👨‍💼 لوحة المبرمج: http://localhost:${PORT}/admin.html`);
    console.log(`⚖️ واجهة المحامي: http://localhost:${PORT}/lawyer.html`);
    console.log(`👤 واجهة العميل: http://localhost:${PORT}/client.html`);
});