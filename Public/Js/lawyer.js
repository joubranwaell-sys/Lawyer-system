// ============== المتغيرات العامة ==============
let currentUser = null;
let authToken = null;
let socket = null;
let currentSection = 'dashboard';
let selectedClient = null;
let selectedClientName = '';
let cameraStream = null;
let myClients = [];
let myCases = [];
let myEvents = [];
let myFiles = [];
let currentCaseId = null;

// ============== تهيئة Socket.IO ==============
function initializeSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('✅ متصل بالخادم');
        if (currentUser) {
            socket.emit('register', currentUser.id);
        }
    });
    
    socket.on('new_message', (message) => {
        console.log('📨 رسالة جديدة:', message);
        if (currentSection === 'messages' && selectedClient === message.sender_id) {
            loadMessages(selectedClient);
        }
        showNotification('💬 رسالة جديدة', 'لديك رسالة جديدة من عميل');
        updateUnreadBadge();
    });
    
    socket.on('message_sent', (message) => {
        console.log('✅ تم إرسال الرسالة:', message);
        if (currentSection === 'messages' && selectedClient === message.receiver_id) {
            loadMessages(selectedClient);
        }
    });
    
    socket.on('user_online', (data) => {
        console.log('👤 مستخدم متصل:', data.user_id);
        updateClientStatus(data.user_id, true);
    });
    
    socket.on('user_offline', (data) => {
        console.log('👋 مستخدم غير متصل:', data.user_id);
        updateClientStatus(data.user_id, false);
    });
    
    socket.on('disconnect', () => {
        console.log('❌ انقطع الاتصال بالخادم');
    });
}

// ============== دوال تسجيل الدخول والتسجيل ==============
function showLoginTab() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.querySelectorAll('.tab-button')[0].classList.add('active');
    document.querySelectorAll('.tab-button')[1].classList.remove('active');
}

function showRegisterTab() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
    document.querySelectorAll('.tab-button')[0].classList.remove('active');
    document.querySelectorAll('.tab-button')[1].classList.add('active');
}

// ============== تسجيل الدخول ==============
async function loginLawyer() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const messageDiv = document.getElementById('loginMessage');
    
    if (!email || !password) {
        messageDiv.innerHTML = '<span style="color: #e74c3c; font-weight: bold;">⚠️ يرجى إدخال البريد الإلكتروني وكلمة المرور</span>';
        return;
    }
    
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
            
            // التحقق من أن المستخدم محامٍ
            if (currentUser.role !== 'lawyer') {
                messageDiv.innerHTML = '<span style="color: #e74c3c; font-weight: bold;">⛔ هذه الواجهة مخصصة للمحامين فقط</span>';
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

// ============== تسجيل محامٍ جديد ==============
async function registerLawyer() {
    const fullName = document.getElementById('regFullName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const license = document.getElementById('regLicense').value.trim();
    const specialization = document.getElementById('regSpecialization').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const messageDiv = document.getElementById('registerMessage');
    
    // التحقق من الحقول
    if (!fullName || !email || !phone || !license || !specialization || !password || !confirmPassword) {
        messageDiv.innerHTML = '<span style="color: #e74c3c; font-weight: bold;">⚠️ يرجى ملء جميع الحقول</span>';
        return;
    }
    
    // التحقق من صحة البريد الإلكتروني
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        messageDiv.innerHTML = '<span style="color: #e74c3c; font-weight: bold;">⚠️ يرجى إدخال بريد إلكتروني صحيح</span>';
        return;
    }
    
    // التحقق من كلمة المرور
    if (password.length < 6) {
        messageDiv.innerHTML = '<span style="color: #e74c3c; font-weight: bold;">⚠️ كلمة المرور يجب أن تكون 6 أحرف على الأقل</span>';
        return;
    }
    
    if (password !== confirmPassword) {
        messageDiv.innerHTML = '<span style="color: #e74c3c; font-weight: bold;">⚠️ كلمات المرور غير متطابقة</span>';
        return;
    }
    
    messageDiv.innerHTML = '<span style="color: #3498db;">⏳ جاري التسجيل...</span>';
    
    try {
        const response = await fetch('/api/register/lawyer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password,
                full_name: fullName,
                phone,
                license_number: license,
                specialization
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            messageDiv.innerHTML = '<span style="color: #27ae60; font-weight: bold;">✅ تم التسجيل بنجاح! بانتظار موافقة المبرمج</span>';
            
            setTimeout(() => {
                showLoginTab();
                document.getElementById('loginEmail').value = email;
                document.getElementById('registerMessage').innerHTML = '';
                // تنظيف النموذج
                document.getElementById('regFullName').value = '';
                document.getElementById('regPhone').value = '';
                document.getElementById('regLicense').value = '';
                document.getElementById('regPassword').value = '';
                document.getElementById('regConfirmPassword').value = '';
            }, 3000);
        } else {
            messageDiv.innerHTML = `<span style="color: #e74c3c; font-weight: bold;">${data.error}</span>`;
        }
    } catch (error) {
        console.error('Registration error:', error);
        messageDiv.innerHTML = '<span style="color: #e74c3c; font-weight: bold;">❌ خطأ في الاتصال بالخادم</span>';
    }
}

// ============== عرض لوحة التحكم ==============
function showDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('lawyerDashboard').style.display = 'block';
    
    // تحديث معلومات المستخدم
    document.getElementById('lawyerName').textContent = currentUser.full_name;
    document.getElementById('userAvatar').textContent = currentUser.full_name.charAt(0);
    
    // تحديث حالة الاتصال
    document.getElementById('onlineStatus').classList.add('online');
    document.getElementById('onlineStatus').classList.remove('offline');
    
    // تهيئة Socket.IO
    initializeSocket();
    
    // تحميل جميع البيانات
    loadAllData();
    
    // تحديث دوري
    setInterval(() => {
        loadDashboardData();
    }, 60000);
}

// ============== تحميل جميع البيانات ==============
async function loadAllData() {
    await Promise.all([
        loadDashboardData(),
        loadCases(),
        loadClients(),
        loadEvents(),
        loadFiles()
    ]);
}

// ============== التنقل بين الأقسام ==============
function showSection(section) {
    currentSection = section;
    
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
    
    const activeLink = document.querySelector(`[onclick="showSection('${section}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // تحديث عنوان القسم
    const titles = {
        'dashboard': '📊 لوحة التحكم',
        'cases': '📁 القضايا',
        'clients': '👥 العملاء',
        'calendar': '📅 الأجندة',
        'messages': '💬 الرسائل',
        'files': '📎 الملفات',
        'camera': '📷 الكاميرا',
        'settings': '⚙️ الإعدادات'
    };
    document.getElementById('sectionTitle').textContent = titles[section] || 'لوحة التحكم';
    
    // تحميل بيانات القسم
    switch(section) {
        case 'cases':
            loadCases();
            break;
        case 'clients':
            loadClients();
            break;
        case 'calendar':
            loadEvents();
            break;
        case 'files':
            loadFiles();
            break;
        case 'settings':
            loadSettings();
            break;
        case 'camera':
            startCamera();
            break;
    }
}

// ============== تحميل بيانات لوحة التحكم ==============
async function loadDashboardData() {
    try {
        // تحميل القضايا
        const casesResponse = await fetch('/api/lawyer/cases', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (casesResponse.ok) {
            myCases = await casesResponse.json();
            
            document.getElementById('totalCases').textContent = myCases.length;
            document.getElementById('activeCases').textContent = myCases.filter(c => c.status === 'active').length;
            
            // عرض آخر القضايا
            const recentCases = myCases.slice(0, 5);
            const recentCasesDiv = document.getElementById('recentCases');
            
            if (recentCases.length === 0) {
                recentCasesDiv.innerHTML = '<p style="text-align: center; color: #7f8c8d;">لا توجد قضايا</p>';
            } else {
                recentCasesDiv.innerHTML = recentCases.map(c => `
                    <div class="case-card" onclick="viewCaseDetails(${c.id})" style="cursor: pointer;">
                        <h4>${c.title}</h4>
                        <p><strong>رقم القضية:</strong> ${c.case_number || 'غير محدد'}</p>
                        <p><strong>العميل:</strong> ${c.client_name || 'غير محدد'}</p>
                        <span style="padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; background: ${c.status === 'active' ? '#d4edda' : '#f8d7da'}; color: ${c.status === 'active' ? '#155724' : '#721c24'};">
                            ${c.status === 'active' ? 'نشطة' : 'مغلقة'}
                        </span>
                    </div>
                `).join('');
            }
        }
        
        // تحميل العملاء
        const clientsResponse = await fetch('/api/lawyer/clients', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (clientsResponse.ok) {
            myClients = await clientsResponse.json();
            document.getElementById('totalClients').textContent = myClients.length;
        }
        
        // تحميل أحداث اليوم
        const today = new Date().toISOString().split('T')[0];
        const eventsResponse = await fetch(`/api/lawyer/events?date=${today}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (eventsResponse.ok) {
            const todayEvents = await eventsResponse.json();
            document.getElementById('todayEvents').textContent = todayEvents.length;
        }
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// ============== تحميل القضايا ==============
async function loadCases() {
    try {
        const response = await fetch('/api/lawyer/cases', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            throw new Error('فشل تحميل القضايا');
        }
        
        myCases = await response.json();
        
        const casesList = document.getElementById('casesList');
        
        if (myCases.length === 0) {
            casesList.innerHTML = '<p style="text-align: center; color: #7f8c8d;">لا توجد قضايا. قم بإنشاء قضية جديدة.</p>';
            return;
        }
        
        casesList.innerHTML = myCases.map(c => `
            <div class="case-card" style="border: 1px solid #ddd; border-radius: 10px; padding: 20px; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="margin: 0;">${c.title}</h3>
                    <span style="padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; background: ${c.status === 'active' ? '#d4edda' : '#f8d7da'}; color: ${c.status === 'active' ? '#155724' : '#721c24'};">
                        ${c.status === 'active' ? 'نشطة' : 'مغلقة'}
                    </span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                    <p><strong>رقم القضية:</strong> ${c.case_number || 'غير محدد'}</p>
                    <p><strong>النوع:</strong> ${c.case_type || 'غير محدد'}</p>
                    <p><strong>المحكمة:</strong> ${c.court_name || 'غير محددة'}</p>
                    <p><strong>العميل:</strong> ${c.client_name || 'غير محدد'}</p>
                </div>
                ${c.description ? `<p><strong>الوصف:</strong> ${c.description}</p>` : ''}
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button class="btn btn-sm btn-primary" onclick="viewCaseDetails(${c.id})">👁️ عرض</button>
                    <button class="btn btn-sm btn-success" onclick="editCase(${c.id})">✏️ تعديل</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCase(${c.id})">🗑️ حذف</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading cases:', error);
        document.getElementById('casesList').innerHTML = '<p style="color: red; text-align: center;">فشل تحميل القضايا</p>';
    }
}

// ============== عرض تفاصيل قضية ==============
function viewCaseDetails(caseId) {
    const caseData = myCases.find(c => c.id === caseId);
    if (!caseData) return;
    
    currentCaseId = caseId;
    
    // إنشاء نافذة منبثقة للتفاصيل
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <h2 style="margin-bottom: 20px;">${caseData.title}</h2>
            <div style="margin-bottom: 20px;">
                <p><strong>رقم القضية:</strong> ${caseData.case_number || 'غير محدد'}</p>
                <p><strong>النوع:</strong> ${caseData.case_type || 'غير محدد'}</p>
                <p><strong>المحكمة:</strong> ${caseData.court_name || 'غير محددة'}</p>
                <p><strong>العميل:</strong> ${caseData.client_name || 'غير محدد'}</p>
                <p><strong>الحالة:</strong> ${caseData.status === 'active' ? 'نشطة' : 'مغلقة'}</p>
                <p><strong>تاريخ الإنشاء:</strong> ${new Date(caseData.created_at).toLocaleDateString('ar')}</p>
            </div>
            ${caseData.description ? `
                <div style="margin-bottom: 20px;">
                    <h4>الوصف:</h4>
                    <p>${caseData.description}</p>
                </div>
            ` : ''}
            <button class="btn btn-primary" onclick="this.closest('div[style]').parentElement.remove()">إغلاق</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // إغلاق عند النقر خارج النافذة
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// ============== حذف قضية ==============
async function deleteCase(caseId) {
    if (!confirm('هل أنت متأكد من حذف هذه القضية؟')) return;
    
    try {
        const response = await fetch(`/api/lawyer/delete-case/${caseId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ نجاح', 'تم حذف القضية');
            await loadCases();
            await loadDashboardData();
        }
    } catch (error) {
        console.error('Error deleting case:', error);
        showNotification('❌ خطأ', 'فشل حذف القضية');
    }
}

// ============== إنشاء قضية جديدة ==============
function showNewCaseModal() {
    document.getElementById('newCaseModal').classList.add('active');
    // تحميل العملاء في القائمة المنسدلة
    const caseClientSelect = document.getElementById('caseClient');
    caseClientSelect.innerHTML = '<option value="">اختر العميل</option>' + 
        myClients.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('');
}

async function createCase() {
    const title = document.getElementById('caseTitle').value.trim();
    const caseNumber = document.getElementById('caseNumber').value.trim();
    const caseType = document.getElementById('caseType').value;
    const courtName = document.getElementById('courtName').value.trim();
    const clientId = document.getElementById('caseClient').value;
    const description = document.getElementById('caseDescription').value.trim();
    
    if (!title || !clientId) {
        alert('يرجى إدخال عنوان القضية واختيار العميل');
        return;
    }
    
    try {
        const response = await fetch('/api/lawyer/create-case', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                client_id: clientId,
                title,
                case_number: caseNumber,
                case_type: caseType,
                court_name: courtName,
                description
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('newCaseModal');
            showNotification('✅ نجاح', 'تم إنشاء القضية بنجاح');
            await loadCases();
            await loadDashboardData();
        } else {
            showNotification('❌ خطأ', data.error || 'فشل إنشاء القضية');
        }
    } catch (error) {
        console.error('Error creating case:', error);
        showNotification('❌ خطأ', 'فشل الاتصال بالخادم');
    }
}

// ============== تحميل العملاء ==============
async function loadClients() {
    try {
        const response = await fetch('/api/lawyer/clients', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            throw new Error('فشل تحميل العملاء');
        }
        
        myClients = await response.json();
        
        const clientsList = document.getElementById('clientsList');
        
        if (myClients.length === 0) {
            clientsList.innerHTML = '<p style="text-align: center; color: #7f8c8d;">لا يوجد عملاء. قم بإضافة عميل جديد.</p>';
            return;
        }
        
        clientsList.innerHTML = myClients.map(c => `
            <div class="client-card" style="border: 1px solid #ddd; border-radius: 10px; padding: 15px; display: flex; align-items: center; gap: 15px; cursor: pointer;" onclick="selectClient(${c.id}, '${c.full_name}')">
                <div style="width: 50px; height: 50px; border-radius: 50%; background: #1a237e; color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">
                    ${c.full_name.charAt(0)}
                </div>
                <div style="flex: 1;">
                    <h4 style="margin: 0;">${c.full_name}</h4>
                    <p style="margin: 5px 0; color: #7f8c8d;">${c.email}</p>
                    <p style="margin: 5px 0; color: #7f8c8d;">${c.phone || 'لا يوجد هاتف'}</p>
                </div>
                <div style="text-align: center;">
                    <span class="online-indicator ${c.is_online ? 'online' : 'offline'}" style="width: 10px; height: 10px; border-radius: 50%; display: inline-block; background: ${c.is_online ? '#27ae60' : '#95a5a6'};"></span>
                    <p style="margin: 5px 0; font-size: 12px; color: #7f8c8d;">${c.is_online ? 'متصل' : 'غير متصل'}</p>
                </div>
                <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); openChatWithClient(${c.id}, '${c.full_name}')">💬</button>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading clients:', error);
        document.getElementById('clientsList').innerHTML = '<p style="color: red; text-align: center;">فشل تحميل العملاء</p>';
    }
}

// ============== إضافة عميل ==============
function showAddClientModal() {
    document.getElementById('addClientModal').classList.add('active');
}

async function addClient() {
    const clientEmail = document.getElementById('clientEmail').value.trim();
    
    if (!clientEmail) {
        alert('يرجى إدخال البريد الإلكتروني');
        return;
    }
    
    try {
        const response = await fetch('/api/lawyer/add-client', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ client_email: clientEmail })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('addClientModal');
            document.getElementById('clientEmail').value = '';
            showNotification('✅ نجاح', 'تم إضافة العميل بنجاح');
            await loadClients();
            await loadDashboardData();
        } else {
            showNotification('❌ خطأ', data.error || 'فشل إضافة العميل');
        }
    } catch (error) {
        console.error('Error adding client:', error);
        showNotification('❌ خطأ', 'فشل الاتصال بالخادم');
    }
}

// ============== تحميل الأحداث ==============
async function loadEvents() {
    try {
        const response = await fetch('/api/lawyer/events', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            myEvents = await response.json();
            updateEventsUI();
        }
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

function updateEventsUI() {
    const eventsList = document.getElementById('eventsList');
    
    if (myEvents.length === 0) {
        eventsList.innerHTML = '<p style="text-align: center; color: #7f8c8d;">لا توجد مواعيد قادمة</p>';
        return;
    }
    
    // ترتيب الأحداث حسب التاريخ
    myEvents.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
    
    eventsList.innerHTML = myEvents.map(e => `
        <div style="border: 1px solid #ddd; border-radius: 10px; padding: 15px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h4 style="margin: 0;">${e.title}</h4>
                <p style="margin: 5px 0;"><strong>النوع:</strong> ${e.event_type || 'غير محدد'}</p>
                <p style="margin: 5px 0;"><strong>التاريخ:</strong> ${new Date(e.event_date).toLocaleString('ar')}</p>
                ${e.location ? `<p style="margin: 5px 0;"><strong>المكان:</strong> ${e.location}</p>` : ''}
                ${e.notes ? `<p style="margin: 5px 0;"><strong>ملاحظات:</strong> ${e.notes}</p>` : ''}
            </div>
            <div>
                <span style="padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; background: #d4edda; color: #155724;">
                    ${e.status === 'scheduled' ? 'مجدول' : 'مكتمل'}
                </span>
            </div>
        </div>
    `).join('');
}

// ============== إنشاء موعد جديد ==============
function showNewEventModal() {
    document.getElementById('newEventModal').classList.add('active');
    // تعيين التاريخ الافتراضي
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('eventDate').value = now.toISOString().slice(0, 16);
}

async function createEvent() {
    const title = document.getElementById('eventTitle').value.trim();
    const eventType = document.getElementById('eventType').value;
    const eventDate = document.getElementById('eventDate').value;
    const location = document.getElementById('eventLocation').value.trim();
    const notes = document.getElementById('eventNotes').value.trim();
    
    if (!title || !eventDate) {
        alert('يرجى إدخال عنوان الموعد والتاريخ');
        return;
    }
    
    try {
        const response = await fetch('/api/lawyer/create-event', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title,
                event_type: eventType,
                event_date: eventDate,
                location,
                notes
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('newEventModal');
            showNotification('✅ نجاح', 'تم إضافة الموعد بنجاح');
            await loadEvents();
        } else {
            showNotification('❌ خطأ', data.error || 'فشل إضافة الموعد');
        }
    } catch (error) {
        console.error('Error creating event:', error);
        showNotification('❌ خطأ', 'فشل الاتصال بالخادم');
    }
}

// ============== تحميل الملفات ==============
async function loadFiles() {
    try {
        const response = await fetch('/api/lawyer/files', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            throw new Error('فشل تحميل الملفات');
        }
        
        myFiles = await response.json();
        
        const filesList = document.getElementById('filesList');
        
        if (myFiles.length === 0) {
            filesList.innerHTML = '<p style="text-align: center; color: #7f8c8d;">لا توجد ملفات</p>';
            return;
        }
        
        filesList.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>اسم الملف</th>
                            <th>القضية</th>
                            <th>العميل</th>
                            <th>الحجم</th>
                            <th>تاريخ الرفع</th>
                            <th>إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${myFiles.map(f => `
                            <tr>
                                <td>📄 ${f.file_name}</td>
                                <td>${f.case_title || 'غير مرتبط'}</td>
                                <td>${f.client_name || 'غير محدد'}</td>
                                <td>${(f.file_size / 1024).toFixed(2)} KB</td>
                                <td>${new Date(f.uploaded_at).toLocaleDateString('ar')}</td>
                                <td>
                                    <button class="btn btn-sm btn-primary" onclick="downloadFile(${f.id})">⬇️</button>
                                    <button class="btn btn-sm btn-success" onclick="shareFile(${f.id})">🔗</button>
                                    <button class="btn btn-sm btn-danger" onclick="deleteFile(${f.id})">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading files:', error);
        document.getElementById('filesList').innerHTML = '<p style="color: red; text-align: center;">فشل تحميل الملفات</p>';
    }
}

// ============== رفع الملفات ==============
async function uploadFiles() {
    const fileInput = document.getElementById('fileInput');
    const files = fileInput.files;
    
    if (files.length === 0) return;
    
    for (let file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('case_id', currentCaseId || '');
        
        try {
            const response = await fetch('/api/lawyer/upload-file', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('✅ نجاح', `تم رفع الملف: ${file.name}`);
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            showNotification('❌ خطأ', `فشل رفع الملف: ${file.name}`);
        }
    }
    
    fileInput.value = '';
    await loadFiles();
}

// ============== تحميل ملف ==============
function downloadFile(fileId) {
    window.open(`/api/lawyer/download-file/${fileId}?token=${authToken}`, '_blank');
}

// ============== مشاركة ملف ==============
function shareFile(fileId) {
    const file = myFiles.find(f => f.id === fileId);
    if (!file) return;
    
    // إنشاء نافذة مشاركة
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%;">
            <h3>مشاركة الملف: ${file.file_name}</h3>
            <div class="form-group">
                <label>المشاركة مع:</label>
                <select id="shareWith" class="form-control">
                    <option value="private">خاص فقط</option>
                    <option value="client">العميل المرتبط</option>
                    <option value="all_clients">جميع العملاء</option>
                    <option value="admin">المبرمج</option>
                </select>
            </div>
            <div style="display: flex; gap: 10px; justify-content: end;">
                <button class="btn btn-success" onclick="confirmShare(${fileId})">مشاركة</button>
                <button class="btn btn-danger" onclick="this.closest('div[style]').parentElement.remove()">إلغاء</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

async function confirmShare(fileId) {
    const shareWith = document.getElementById('shareWith').value;
    
    try {
        const response = await fetch(`/api/lawyer/share-file/${fileId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ shared_with: shareWith })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ نجاح', 'تم تحديث مشاركة الملف');
            document.querySelector('div[style*="position: fixed"]')?.