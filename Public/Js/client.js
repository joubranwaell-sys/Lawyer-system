// ============== المتغيرات العامة ==============
let currentUser = null;
let authToken = null;
let socket = null;
let selectedLawyer = null;
let cameraStream = null;
let currentSection = 'dashboard';
let myLawyer = null;
let myCases = [];
let myConsultations = [];
let myFiles = [];

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
        if (currentSection === 'messages' && selectedLawyer === message.sender_id) {
            loadMessages(selectedLawyer);
        }
        showNotification('💬 رسالة جديدة', 'لديك رسالة جديدة من المحامي');
    });
    
    socket.on('message_sent', (message) => {
        console.log('✅ تم إرسال الرسالة:', message);
        if (currentSection === 'messages' && selectedLawyer === message.receiver_id) {
            loadMessages(selectedLawyer);
        }
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
async function loginClient() {
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
            
            // التحقق من أن المستخدم عميل
            if (currentUser.role !== 'client') {
                messageDiv.innerHTML = '<span style="color: #e74c3c; font-weight: bold;">⛔ هذه الواجهة مخصصة للعملاء فقط</span>';
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

// ============== تسجيل عميل جديد ==============
async function registerClient() {
    const fullName = document.getElementById('regFullName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const messageDiv = document.getElementById('registerMessage');
    
    // التحقق من الحقول
    if (!fullName || !email || !phone || !password || !confirmPassword) {
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
        const response = await fetch('/api/register/client', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password,
                full_name: fullName,
                phone
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            messageDiv.innerHTML = '<span style="color: #27ae60; font-weight: bold;">✅ تم التسجيل بنجاح!</span>';
            
            setTimeout(() => {
                showLoginTab();
                document.getElementById('loginEmail').value = email;
                document.getElementById('registerMessage').innerHTML = '';
                // تنظيف النموذج
                document.getElementById('regFullName').value = '';
                document.getElementById('regPhone').value = '';
                document.getElementById('regPassword').value = '';
                document.getElementById('regConfirmPassword').value = '';
            }, 2000);
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
    document.getElementById('clientDashboard').style.display = 'block';
    
    // تحديث معلومات المستخدم
    document.getElementById('clientName').textContent = currentUser.full_name;
    document.getElementById('userAvatar').textContent = currentUser.full_name.charAt(0);
    
    // تهيئة Socket.IO
    initializeSocket();
    
    // تحميل البيانات
    loadAllData();
}

// ============== تحميل جميع البيانات ==============
async function loadAllData() {
    await Promise.all([
        loadMyLawyer(),
        loadMyCases(),
        loadMyConsultations(),
        loadMyFiles(),
        loadDashboardStats()
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
        'consultations': '📋 الاستشارات',
        'messages': '💬 الرسائل',
        'files': '📎 الملفات',
        'camera': '📷 الكاميرا'
    };
    document.getElementById('sectionTitle').textContent = titles[section] || 'لوحة التحكم';
    
    // تحميل بيانات القسم
    switch(section) {
        case 'consultations':
            loadMyConsultations();
            break;
        case 'files':
            loadMyFiles();
            break;
        case 'messages':
            if (selectedLawyer) {
                loadMessages(selectedLawyer);
            }
            break;
        case 'camera':
            startCamera();
            break;
    }
}

// ============== تحميل بيانات المحامي الخاص ==============
async function loadMyLawyer() {
    try {
        const response = await fetch('/api/client/my-lawyer', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            myLawyer = data.lawyer;
            selectedLawyer = myLawyer?.id || null;
            
            // تحديث واجهة المحامي
            const lawyerInfoDiv = document.getElementById('myLawyerInfo');
            if (lawyerInfoDiv && myLawyer) {
                lawyerInfoDiv.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 15px; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                        <div style="width: 60px; height: 60px; border-radius: 50%; background: #1a237e; color: white; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold;">
                            ${myLawyer.full_name.charAt(0)}
                        </div>
                        <div>
                            <h3 style="margin: 0;">${myLawyer.full_name}</h3>
                            <p style="margin: 5px 0; color: #7f8c8d;">${myLawyer.specialization || 'محامٍ'}</p>
                            <p style="margin: 5px 0; color: #7f8c8d;">${myLawyer.email}</p>
                        </div>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading lawyer:', error);
    }
}

// ============== تحميل القضايا ==============
async function loadMyCases() {
    try {
        const response = await fetch('/api/client/cases', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            myCases = await response.json();
            updateCasesUI();
        }
    } catch (error) {
        console.error('Error loading cases:', error);
    }
}

function updateCasesUI() {
    const casesContainer = document.getElementById('myCasesList');
    if (!casesContainer) return;
    
    if (myCases.length === 0) {
        casesContainer.innerHTML = '<p style="text-align: center; color: #7f8c8d;">لا توجد قضايا</p>';
        return;
    }
    
    casesContainer.innerHTML = myCases.map(c => `
        <div style="border: 1px solid #ddd; border-radius: 10px; padding: 15px; margin-bottom: 10px;">
            <h4 style="margin: 0 0 10px 0;">${c.title}</h4>
            <p style="margin: 5px 0;"><strong>رقم القضية:</strong> ${c.case_number || 'غير محدد'}</p>
            <p style="margin: 5px 0;"><strong>النوع:</strong> ${c.case_type || 'غير محدد'}</p>
            <p style="margin: 5px 0;"><strong>المحكمة:</strong> ${c.court_name || 'غير محددة'}</p>
            <span style="padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; background: ${c.status === 'active' ? '#d4edda' : '#f8d7da'}; color: ${c.status === 'active' ? '#155724' : '#721c24'};">
                ${c.status === 'active' ? 'نشطة' : 'مغلقة'}
            </span>
        </div>
    `).join('');
}

// ============== تحميل الاستشارات ==============
async function loadMyConsultations() {
    try {
        const response = await fetch('/api/client/consultations', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            myConsultations = await response.json();
            updateConsultationsUI();
        }
    } catch (error) {
        console.error('Error loading consultations:', error);
    }
}

function updateConsultationsUI() {
    const consultationsList = document.getElementById('consultationsList');
    if (!consultationsList) return;
    
    if (myConsultations.length === 0) {
        consultationsList.innerHTML = '<p style="text-align: center; color: #7f8c8d;">لا توجد استشارات</p>';
        return;
    }
    
    consultationsList.innerHTML = myConsultations.map(c => `
        <div class="consultation-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h4 style="margin: 0;">${c.subject}</h4>
                <span class="consultation-status status-${c.status}">
                    ${getConsultationStatusText(c.status)}
                </span>
            </div>
            <p style="margin: 5px 0;"><strong>النوع:</strong> ${c.consultation_type || 'غير محدد'}</p>
            <p style="margin: 5px 0;"><strong>الوصف:</strong> ${c.description || 'لا يوجد وصف'}</p>
            <p style="margin: 5px 0; color: #7f8c8d; font-size: 12px;">
                تاريخ الطلب: ${new Date(c.created_at).toLocaleDateString('ar')}
            </p>
        </div>
    `).join('');
}

function getConsultationStatusText(status) {
    switch(status) {
        case 'pending': return 'قيد المراجعة';
        case 'accepted': return 'مقبولة';
        case 'rejected': return 'مرفوضة';
        case 'completed': return 'مكتملة';
        default: return 'غير معروف';
    }
}

// ============== تحميل الملفات ==============
async function loadMyFiles() {
    try {
        const response = await fetch('/api/client/files', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            myFiles = await response.json();
            updateFilesUI();
        }
    } catch (error) {
        console.error('Error loading files:', error);
    }
}

function updateFilesUI() {
    const filesList = document.getElementById('filesList');
    if (!filesList) return;
    
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
                        <th>الحجم</th>
                        <th>تاريخ الرفع</th>
                        <th>تحميل</th>
                    </tr>
                </thead>
                <tbody>
                    ${myFiles.map(f => `
                        <tr>
                            <td>📄 ${f.file_name}</td>
                            <td>${f.case_title || 'غير مرتبط'}</td>
                            <td>${(f.file_size / 1024).toFixed(2)} KB</td>
                            <td>${new Date(f.uploaded_at).toLocaleDateString('ar')}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="downloadMyFile(${f.id})">⬇️ تحميل</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function downloadMyFile(fileId) {
    window.open(`/api/client/download-file/${fileId}?token=${authToken}`, '_blank');
}

// ============== تحميل إحصائيات لوحة التحكم ==============
async function loadDashboardStats() {
    try {
        const consultationsCount = myConsultations.length;
        const pendingCount = myConsultations.filter(c => c.status === 'pending').length;
        const casesCount = myCases.length;
        
        document.getElementById('totalConsultations').textContent = consultationsCount;
        document.getElementById('pendingConsultations').textContent = pendingCount;
        document.getElementById('totalCases').textContent = casesCount;
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ============== إرسال استشارة ==============
async function submitConsultation() {
    const type = document.getElementById('consultationType').value;
    const subject = document.getElementById('consultationSubject').value.trim();
    const description = document.getElementById('consultationDescription').value.trim();
    
    if (!type || !subject || !description) {
        showNotification('⚠️ تنبيه', 'يرجى ملء جميع الحقول');
        return;
    }
    
    if (!selectedLawyer) {
        showNotification('⚠️ تنبيه', 'لا يوجد محامٍ مرتبط بك. يرجى التواصل مع محامٍ أولاً');
        return;
    }
    
    try {
        const response = await fetch('/api/client/submit-consultation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                lawyer_id: selectedLawyer,
                consultation_type: type,
                subject: subject,
                description: description
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ نجاح', 'تم إرسال الاستشارة بنجاح');
            
            // تنظيف النموذج
            document.getElementById('consultationSubject').value = '';
            document.getElementById('consultationDescription').value = '';
            
            // إعادة تحميل البيانات
            await loadMyConsultations();
            await loadDashboardStats();
        } else {
            showNotification('❌ خطأ', data.error || 'فشل إرسال الاستشارة');
        }
    } catch (error) {
        console.error('Error submitting consultation:', error);
        showNotification('❌ خطأ', 'فشل الاتصال بالخادم');
    }
}

// ============== دوال الرسائل ==============
async function loadMessages(lawyerId) {
    if (!lawyerId) {
        document.getElementById('chatMessages').innerHTML = '<p style="text-align: center; color: #7f8c8d;">لا يوجد محامٍ للتواصل معه</p>';
        return;
    }
    
    try {
        const response = await fetch(`/api/messages/${lawyerId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            throw new Error('فشل تحميل الرسائل');
        }
        
        const messages = await response.json();
        
        const chatMessages = document.getElementById('chatMessages');
        
        if (messages.length === 0) {
            chatMessages.innerHTML = '<p style="text-align: center; color: #7f8c8d;">لا توجد رسائل. ابدأ المحادثة الآن!</p>';
            return;
        }
        
        chatMessages.innerHTML = messages.map(m => `
            <div class="message ${m.sender_id === currentUser.id ? 'message-sent' : 'message-received'}">
                <p style="margin: 0;">${m.message}</p>
                ${m.file_path ? `<a href="${m.file_path}" target="_blank" style="color: ${m.sender_id === currentUser.id ? '#ffd700' : '#1a237e'};">📎 ملف مرفق</a>` : ''}
                <span class="message-time">${new Date(m.created_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        `).join('');
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function handleMessageKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) {
        return;
    }
    
    if (!selectedLawyer) {
        showNotification('⚠️ تنبيه', 'لا يوجد محامٍ للتواصل معه');
        return;
    }
    
    // إرسال عبر Socket.IO
    socket.emit('send_message', {
        receiver_id: selectedLawyer,
        message: message
    });
    
    // تنظيف الحقل
    messageInput.value = '';
    
    // إعادة تحميل الرسائل بعد لحظة
    setTimeout(() => loadMessages(selectedLawyer), 100);
}

// ============== رفع ملف ==============
async function uploadClientFile(file) {
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/client/upload-file', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ نجاح', 'تم رفع الملف بنجاح');
            await loadMyFiles();
        } else {
            showNotification('❌ خطأ', data.error || 'فشل رفع الملف');
        }
    } catch (error) {
        console.error('Error uploading file:', error);
        showNotification('❌ خطأ', 'فشل الاتصال بالخادم');
    }
}

// ============== دوال الكاميرا ==============
async function startCamera() {
    const video = document.getElementById('cameraPreview');
    if (!video) return;
    
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        video.srcObject = cameraStream;
        video.style.display = 'block';
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        showNotification('❌ خطأ', 'لا يمكن الوصول إلى الكاميرا');
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    
    const video = document.getElementById('cameraPreview');
    if (video) {
        video.style.display = 'none';
    }
}

async function openCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const cameraModal = document.getElementById('cameraModal');
        const video = document.getElementById('modalCameraPreview');
        
        cameraModal.style.display = 'flex';
        video.srcObject = cameraStream;
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        showNotification('❌ خطأ', 'لا يمكن الوصول إلى الكاميرا');
    }
}

function closeCameraModal() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    document.getElementById('cameraModal').style.display = 'none';
}

function captureFromModal() {
    const video = document.getElementById('modalCameraPreview');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // تحويل الصورة إلى ملف
    canvas.toBlob(async (blob) => {
        const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
        await uploadClientFile(file);
        closeCameraModal();
    }, 'image/jpeg');
}

function capturePhoto() {
    const video = document.getElementById('cameraPreview');
    if (!video || !cameraStream) return;
    
    const canvas = document.getElementById('photoCanvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // عرض الصورة الملتقطة
    canvas.toBlob(async (blob) => {
        const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
        await uploadClientFile(file);
        showNotification('✅ نجاح', 'تم التقاط الصورة وحفظها');
    }, 'image/jpeg');
}

// ============== دوال مساعدة ==============
function showNotification(title, message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        background: #1a237e;
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

function logout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        window.location.reload();
    }
}

// ============== إضافة أنماط CSS ==============
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
    
    .message {
        max-width: 70%;
        margin-bottom: 15px;
        padding: 10px 15px;
        border-radius: 15px;
        position: relative;
        word-wrap: break-word;
    }
    
    .message-sent {
        background: #1a237e;
        color: white;
        margin-right: auto;
        border-bottom-left-radius: 5px;
    }
    
    .message-received {
        background: white;
        color: #212121;
        margin-left: auto;
        border: 1px solid #ddd;
        border-bottom-right-radius: 5px;
    }
    
    .message-time {
        font-size: 11px;
        opacity: 0.7;
        margin-top: 5px;
        display: block;
        text-align: left;
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
            
            if (currentUser.role === 'client') {
                showDashboard();
            }
        } catch (error) {
            console.error('Error loading session:', error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
        }
    }
});

// ============== معالجة تغيير حجم النافذة ==============
window.addEventListener('resize', () => {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth > 768 && sidebar) {
        sidebar.classList.remove('active');
    }
});

// ============== تحديث دوري للبيانات ==============
setInterval(() => {
    if (currentUser && currentUser.role === 'client') {
        loadMyCases();
        loadMyConsultations();
    }
}, 60000); // تحديث كل دقيقة