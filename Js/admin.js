// ============== المتغيرات العامة ==============
let currentUser = null;
let authToken = null;
let socket = null;
let onlineUsersCount = 0;
let allLawyers = [];
let allClients = [];
let allFiles = [];

// ============== تهيئة Socket.IO ==============
function initializeSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('✅ متصل بالخادم');
        if (currentUser) {
            socket.emit('register', currentUser.id);
        }
    });
    
    socket.on('user_online', (data) => {
        console.log('مستخدم متصل:', data.user_id);
        onlineUsersCount++;
        updateOnlineCount();
        refreshCurrentSection();
    });
    
    socket.on('user_offline', (data) => {
        console.log('مستخدم غير متصل:', data.user_id);
        onlineUsersCount = Math.max(0, onlineUsersCount - 1);
        updateOnlineCount();
        refreshCurrentSection();
    });
    
    socket.on('disconnect', () => {
        console.log('❌ انقطع الاتصال بالخادم');
    });
}

// ============== تسجيل الدخول ==============
async function loginAdmin() {
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value.trim();
    const messageDiv = document.getElementById('loginMessage');
    
    if (!email || !password) {
        messageDiv.innerHTML = '<span style="color: #e74c3c; font-weight: bold;">⚠️ يرجى إدخال البريد الإلكتروني وكلمة المرور</span>';
        return;
    }
    
    // إظهار حالة التحميل
    messageDiv.innerHTML = '<span style="color: #3498db;">⏳ جاري تسجيل الدخول...</span>';
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            authToken = data.token;
            currentUser = data.user;
            
            // التحقق من أن المستخدم مبرمج
            if (currentUser.role !== 'admin') {
                messageDiv.innerHTML = '<span style="color: #e74c3c; font-weight: bold;">⛔ هذه الواجهة مخصصة للمبرمج فقط</span>';
                return;
            }
            
            // حفظ الجلسة
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            messageDiv.innerHTML = '<span style="color: #27ae60; font-weight: bold;">✅ تم تسجيل الدخول بنجاح</span>';
            
            setTimeout(() => {
                showDashboard();
            }, 1000);
        } else {
            messageDiv.innerHTML = `<span style="color: #e74c3c; font-weight: bold;">${data.error}</span>`;
        }
    } catch (error) {
        console.error('Login error:', error);
        messageDiv.innerHTML = '<span style="color: #e74c3c; font-weight: bold;">❌ خطأ في الاتصال بالخادم</span>';
    }
}

// ============== عرض لوحة التحكم ==============
function showDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    
    // تهيئة Socket.IO
    initializeSocket();
    
    // تحميل جميع البيانات
    loadAllData();
    
    // تحديث كل 30 ثانية
    setInterval(() => {
        loadAllData();
    }, 30000);
}

// ============== تحميل جميع البيانات ==============
async function loadAllData() {
    await Promise.all([
        loadStats(),
        loadLawyers(),
        loadClients(),
        loadFiles(),
        loadMonitoringData()
    ]);
}

// ============== التنقل بين الأقسام ==============
function showSection(section) {
    // إخفاء جميع الأقسام
    document.querySelectorAll('.section').forEach(s => {
        s.classList.add('hidden');
    });
    
    // إظهار القسم المطلوب
    const targetSection = document.getElementById(section + 'Section');
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }
    
    // تحديث القائمة النشطة
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // تحديث القسم النشط
    const activeLink = document.querySelector(`[onclick="showSection('${section}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // تحديث عنوان القسم
    const titles = {
        'dashboard': '📊 لوحة التحكم',
        'lawyers': '👨‍⚖️ إدارة المحامين',
        'clients': '👥 العملاء',
        'monitoring': '📡 مراقبة النظام',
        'files': '📁 الملفات',
        'settings': '⚙️ الإعدادات'
    };
    document.getElementById('sectionTitle').textContent = titles[section] || 'لوحة التحكم';
    
    // تحديث بيانات القسم
    switch(section) {
        case 'lawyers':
            loadLawyers();
            break;
        case 'clients':
            loadClients();
            break;
        case 'monitoring':
            loadMonitoringData();
            break;
        case 'files':
            loadFiles();
            break;
        case 'dashboard':
            loadStats();
            break;
    }
}

// ============== تحميل الإحصائيات ==============
async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            throw new Error('فشل تحميل الإحصائيات');
        }
        
        const stats = await response.json();
        
        // تحديث البطاقات
        document.getElementById('totalLawyers').textContent = stats.total_lawyers || 0;
        document.getElementById('activeLawyers').textContent = stats.active_lawyers || 0;
        document.getElementById('pendingLawyers').textContent = stats.pending_lawyers || 0;
        document.getElementById('totalClients').textContent = stats.total_clients || 0;
        document.getElementById('totalCases').textContent = stats.total_cases || 0;
        document.getElementById('totalFiles').textContent = stats.total_files || 0;
        
        // تحديث عدد المستخدمين المتصلين
        updateOnlineCount();
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ============== إدارة المحامين ==============
async function loadLawyers() {
    try {
        const response = await fetch('/api/admin/lawyers', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            throw new Error('فشل تحميل المحامين');
        }
        
        allLawyers = await response.json();
        
        const lawyersList = document.getElementById('lawyersList');
        
        if (allLawyers.length === 0) {
            lawyersList.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 20px;">لا يوجد محامون مسجلون</p>';
            return;
        }
        
        lawyersList.innerHTML = allLawyers.map(l => `
            <div class="lawyer-card" style="border: 1px solid #ddd; border-radius: 10px; padding: 20px; margin-bottom: 15px; background: white; transition: all 0.3s;">
                <div class="lawyer-info" style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h3 style="margin: 0; color: #2c3e50;">
                            ${l.full_name}
                            <span class="online-dot ${l.is_online ? 'active' : 'inactive'}" style="width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-left: 5px; background: ${l.is_online ? '#27ae60' : '#95a5a6'};"></span>
                        </h3>
                        <span class="status-badge status-${l.status}" style="padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; background: ${getStatusColor(l.status)}; color: white;">
                            ${getStatusText(l.status)}
                        </span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 15px;">
                        <p style="margin: 5px 0;"><strong>📧 البريد:</strong> ${l.email}</p>
                        <p style="margin: 5px 0;"><strong>📱 الهاتف:</strong> ${l.phone || 'غير محدد'}</p>
                        <p style="margin: 5px 0;"><strong>⚖️ التخصص:</strong> ${l.specialization || 'غير محدد'}</p>
                        <p style="margin: 5px 0;"><strong>📋 الترخيص:</strong> ${l.license_number || 'غير محدد'}</p>
                    </div>
                    
                    <div style="display: flex; gap: 10px; font-size: 12px; color: #7f8c8d;">
                        <span>📅 التسجيل: ${new Date(l.created_at).toLocaleDateString('ar')}</span>
                        ${l.last_login ? `<span>🕐 آخر دخول: ${new Date(l.last_login).toLocaleDateString('ar')}</span>` : ''}
                    </div>
                </div>
                
                <div class="lawyer-actions" style="display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
                    ${l.status === 'pending' ? `
                        <button class="btn btn-success btn-sm" onclick="approveLawyer(${l.id})" style="background: #27ae60; color: white; padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer;">
                            ✅ موافقة
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="rejectLawyer(${l.id})" style="background: #e74c3c; color: white; padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer;">
                            ❌ رفض
                        </button>
                    ` : ''}
                    
                    <button class="btn btn-danger btn-sm" onclick="deleteLawyer(${l.id})" style="background: #c0392b; color: white; padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer;">
                        🗑️ حذف
                    </button>
                    
                    ${l.is_online ? `
                        <button class="btn btn-warning btn-sm" onclick="disconnectLawyer(${l.id})" style="background: #f39c12; color: white; padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer;">
                            🔌 قطع الاتصال
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading lawyers:', error);
        document.getElementById('lawyersList').innerHTML = '<p style="color: red; text-align: center;">فشل تحميل البيانات</p>';
    }
}

// ============== الموافقة على محامٍ ==============
async function approveLawyer(lawyerId) {
    const lawyer = allLawyers.find(l => l.id === lawyerId);
    const confirmMessage = lawyer ? 
        `هل أنت متأكد من الموافقة على المحامي:\n${lawyer.full_name}\n${lawyer.email}؟` :
        'هل أنت متأكد من الموافقة على هذا المحامي؟';
    
    if (!confirm(confirmMessage)) return;
    
    try {
        const response = await fetch('/api/admin/approve-lawyer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ lawyer_id: lawyerId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ نجاح', 'تمت الموافقة على المحامي بنجاح');
            await loadLawyers();
            await loadStats();
        } else {
            showNotification('❌ خطأ', data.error || 'فشلت الموافقة');
        }
    } catch (error) {
        console.error('Error approving lawyer:', error);
        showNotification('❌ خطأ', 'فشل الاتصال بالخادم');
    }
}

// ============== رفض محامٍ ==============
async function rejectLawyer(lawyerId) {
    const lawyer = allLawyers.find(l => l.id === lawyerId);
    const confirmMessage = lawyer ? 
        `هل أنت متأكد من رفض المحامي:\n${lawyer.full_name}\n${lawyer.email}؟\n\nسيتم منعه من الدخول للنظام.` :
        'هل أنت متأكد من رفض هذا المحامي؟';
    
    if (!confirm(confirmMessage)) return;
    
    try {
        const response = await fetch('/api/admin/reject-lawyer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ lawyer_id: lawyerId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ نجاح', 'تم رفض المحامي');
            await loadLawyers();
            await loadStats();
        } else {
            showNotification('❌ خطأ', data.error || 'فشل الرفض');
        }
    } catch (error) {
        console.error('Error rejecting lawyer:', error);
        showNotification('❌ خطأ', 'فشل الاتصال بالخادم');
    }
}

// ============== حذف محامٍ ==============
async function deleteLawyer(lawyerId) {
    const lawyer = allLawyers.find(l => l.id === lawyerId);
    const confirmMessage = lawyer ? 
        `⚠️ تحذير!\n\nهل أنت متأكد من حذف المحامي:\n${lawyer.full_name}\n\nسيتم حذف جميع بياناته نهائياً:\n- القضايا\n- الملفات\n- الرسائل\n- العملاء المرتبطين\n\nلا يمكن التراجع عن هذا الإجراء!` :
        'هل أنت متأكد من حذف هذا المحامي؟';
    
    if (!confirm(confirmMessage)) return;
    
    // تأكيد إضافي
    if (!confirm('تأكيد نهائي: هل تريد حقاً حذف هذا المحامي وكل بياناته؟')) return;
    
    try {
        const response = await fetch(`/api/admin/delete-lawyer/${lawyerId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ نجاح', 'تم حذف المحامي وجميع بياناته');
            await loadLawyers();
            await loadStats();
            await loadFiles();
        } else {
            showNotification('❌ خطأ', data.error || 'فشل الحذف');
        }
    } catch (error) {
        console.error('Error deleting lawyer:', error);
        showNotification('❌ خطأ', 'فشل الاتصال بالخادم');
    }
}

// ============== قطع اتصال محامٍ ==============
function disconnectLawyer(lawyerId) {
    if (socket) {
        socket.emit('force_disconnect', { user_id: lawyerId });
        showNotification('🔌 تم', 'تم قطع اتصال المحامي');
    }
}

// ============== إدارة العملاء ==============
async function loadClients() {
    try {
        const response = await fetch('/api/admin/clients', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            // إذا كانت الواجهة غير موجودة، نعرض رسالة
            document.getElementById('clientsTable').innerHTML = '<tr><td colspan="6" style="text-align: center;">لا يمكن تحميل العملاء</td></tr>';
            return;
        }
        
        allClients = await response.json();
        
        const clientsTable = document.getElementById('clientsTable');
        
        if (allClients.length === 0) {
            clientsTable.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #7f8c8d;">لا يوجد عملاء مسجلون</td></tr>';
            return;
        }
        
        clientsTable.innerHTML = allClients.map(c => `
            <tr>
                <td>${c.id}</td>
                <td>${c.full_name}</td>
                <td>${c.email}</td>
                <td>${c.phone || 'غير محدد'}</td>
                <td>
                    <span class="online-dot ${c.is_online ? 'active' : 'inactive'}" style="width: 10px; height: 10px; border-radius: 50%; display: inline-block; background: ${c.is_online ? '#27ae60' : '#95a5a6'};"></span>
                    ${c.is_online ? 'متصل' : 'غير متصل'}
                </td>
                <td>${new Date(c.created_at).toLocaleDateString('ar')}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading clients:', error);
        document.getElementById('clientsTable').innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">فشل تحميل العملاء</td></tr>';
    }
}

// ============== إدارة الملفات ==============
async function loadFiles() {
    try {
        const response = await fetch('/api/admin/files', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            document.getElementById('filesTable').innerHTML = '<tr><td colspan="7" style="text-align: center;">لا يمكن تحميل الملفات</td></tr>';
            return;
        }
        
        allFiles = await response.json();
        
        const filesTable = document.getElementById('filesTable');
        
        if (allFiles.length === 0) {
            filesTable.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #7f8c8d;">لا توجد ملفات</td></tr>';
            return;
        }
        
        filesTable.innerHTML = allFiles.map(f => `
            <tr>
                <td>${f.id}</td>
                <td>📄 ${f.file_name}</td>
                <td>${f.lawyer_name || 'غير محدد'}</td>
                <td>${f.case_title || 'غير مرتبط'}</td>
                <td>${(f.file_size / 1024).toFixed(2)} KB</td>
                <td>${new Date(f.uploaded_at).toLocaleDateString('ar')}</td>
                <td>
                    <button class="btn btn-sm" onclick="downloadFile(${f.id})" style="background: #3498db; color: white; padding: 5px 10px; border: none; border-radius: 3px; cursor: pointer; margin-left: 5px;">
                        ⬇️ تحميل
                    </button>
                    <button class="btn btn-sm" onclick="deleteFile(${f.id})" style="background: #e74c3c; color: white; padding: 5px 10px; border: none; border-radius: 3px; cursor: pointer;">
                        🗑️ حذف
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading files:', error);
        document.getElementById('filesTable').innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">فشل تحميل الملفات</td></tr>';
    }
}

// ============== تحميل ملف ==============
function downloadFile(fileId) {
    window.open(`/api/admin/download-file/${fileId}?token=${authToken}`, '_blank');
}

// ============== حذف ملف ==============
async function deleteFile(fileId) {
    if (!confirm('هل أنت متأكد من حذف هذا الملف؟')) return;
    
    try {
        const response = await fetch(`/api/admin/delete-file/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ نجاح', 'تم حذف الملف');
            await loadFiles();
            await loadStats();
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        showNotification('❌ خطأ', 'فشل حذف الملف');
    }
}

// ============== المراقبة ==============
async function loadMonitoringData() {
    try {
        const response = await fetch('/api/admin/monitoring', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            document.getElementById('monitoringData').innerHTML = '<p style="text-align: center;">لا يمكن تحميل بيانات المراقبة</p>';
            return;
        }
        
        const data = await response.json();
        
        const monitoringDiv = document.getElementById('monitoringData');
        
        monitoringDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 10px;">
                    <h4>📊 إحصائيات فورية</h4>
                    <p>المستخدمون المتصلون: <strong>${onlineUsersCount}</strong></p>
                    <p>المحامون النشطون: <strong>${allLawyers.filter(l => l.is_online).length}</strong></p>
                    <p>إجمالي المحامين: <strong>${allLawyers.length}</strong></p>
                </div>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 10px;">
                    <h4>💬 الرسائل</h4>
                    <p>إجمالي الرسائل: <strong>${data.total_messages || 0}</strong></p>
                    <p>رسائل اليوم: <strong>${data.today_messages || 0}</strong></p>
                </div>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 10px;">
                    <h4>📁 الملفات</h4>
                    <p>إجمالي الملفات: <strong>${allFiles.length}</strong></p>
                    <p>إجمالي الحجم: <strong>${(allFiles.reduce((sum, f) => sum + (f.file_size || 0), 0) / (1024 * 1024)).toFixed(2)} MB</strong></p>
                </div>
            </div>
            
            <div style="margin-top: 20px;">
                <h4>👥 المستخدمون المتصلون الآن</h4>
                <div id="onlineUsersList">
                    ${allLawyers.filter(l => l.is_online).map(l => `
                        <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: #f8f9fa; border-radius: 5px; margin-bottom: 5px;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: #27ae60;"></span>
                            <span><strong>${l.full_name}</strong> - ${l.email}</span>
                        </div>
                    `).join('') || '<p style="color: #7f8c8d;">لا يوجد مستخدمون متصلون</p>'}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading monitoring:', error);
        document.getElementById('monitoringData').innerHTML = '<p style="text-align: center; color: red;">فشل تحميل بيانات المراقبة</p>';
    }
}

// ============== تحديث عدد المتصلين ==============
function updateOnlineCount() {
    const onlineCountElement = document.getElementById('onlineUsers');
    if (onlineCountElement) {
        const onlineLawyers = allLawyers.filter(l => l.is_online).length;
        onlineCountElement.innerHTML = `🟢 ${onlineLawyers} متصل`;
    }
}

// ============== تحديث القسم الحالي ==============
function refreshCurrentSection() {
    const activeSection = document.querySelector('.section:not(.hidden)');
    if (activeSection) {
        const sectionId = activeSection.id.replace('Section', '');
        switch(sectionId) {
            case 'dashboard':
                loadStats();
                break;
            case 'lawyers':
                loadLawyers();
                break;
            case 'clients':
                loadClients();
                break;
            case 'monitoring':
                loadMonitoringData();
                break;
            case 'files':
                loadFiles();
                break;
        }
    }
}

// ============== دوال مساعدة ==============
function getStatusColor(status) {
    switch(status) {
        case 'active': return '#27ae60';
        case 'pending': return '#f39c12';
        case 'rejected': return '#e74c3c';
        default: return '#95a5a6';
    }
}

function getStatusText(status) {
    switch(status) {
        case 'active': return 'نشط';
        case 'pending': return 'بانتظار الموافقة';
        case 'rejected': return 'مرفوض';
        default: return 'غير معروف';
    }
}

function showNotification(title, message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        background: #2c3e50;
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        z-index: 9999;
        animation: slideIn 0.3s ease;
        max-width: 350px;
    `;
    notification.innerHTML = `<strong>${title}</strong><br>${message}`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

function saveSettings() {
    const allowRegistration = document.getElementById('allowRegistration').value;
    const maxFileSize = document.getElementById('maxFileSize').value;
    
    localStorage.setItem('allowRegistration', allowRegistration);
    localStorage.setItem('maxFileSize', maxFileSize);
    
    showNotification('✅ نجاح', 'تم حفظ الإعدادات بنجاح');
}

function logout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        window.location.reload();
    }
}

// ============== إضافة أنماط CSS للأنيميشن ==============
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(-100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(-100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ============== التحقق من الجلسة عند التحميل ==============
window.addEventListener('load', () => {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');
    
    if (savedToken && savedUser) {
        try {
            authToken = savedToken;
            currentUser = JSON.parse(savedUser);
            
            if (currentUser.role === 'admin') {
                showDashboard();
            }
        } catch (error) {
            console.error('Error loading session:', error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
        }
    }
});

// ============== تحديث دوري للبيانات ==============
setInterval(() => {
    if (currentUser && currentUser.role === 'admin') {
        loadStats();
    }
}, 60000); // تحديث كل دقيقة