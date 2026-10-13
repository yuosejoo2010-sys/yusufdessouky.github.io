const loginPanel = document.getElementById('loginPanel');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginStatus = document.getElementById('loginStatus');
const dashboardStatus = document.getElementById('dashboardStatus');
const reviewList = document.getElementById('reviewList');
const statusFilter = document.getElementById('statusFilter');

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.dataset.state = isError ? 'error' : '';
}

async function api(path, options = {}) {
  const response = await fetch(`./api/admin/${path}`, {
    cache: 'no-store',
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'تعذر تنفيذ الطلب.');
  return data;
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  loadReviews();
}

function showLogin(message = '', unavailable = false) {
  dashboard.hidden = true;
  loginPanel.hidden = false;
  loginForm.querySelectorAll('input, button').forEach(control => { control.disabled = unavailable; });
  if (message) setStatus(loginStatus, message, true);
}

function makeButton(label, className, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `button ${className}`;
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

async function updateReview(id, action) {
  try {
    await api('review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action })
    });
    setStatus(dashboardStatus, action === 'approve' ? 'تم قبول الرأي ونشره.' : action === 'reject' ? 'تم رفض الرأي وإخفاؤه.' : 'تم حذف الرسالة نهائيًا.');
    await loadReviews();
  } catch (error) {
    if (/سجّل الدخول|انتهت الجلسة/.test(error.message)) return showLogin(error.message);
    setStatus(dashboardStatus, error.message, true);
  }
}

async function loadReviews() {
  reviewList.replaceChildren();
  setStatus(dashboardStatus, 'جارٍ تحميل الرسائل...');
  try {
    const data = await api(`reviews?status=${encodeURIComponent(statusFilter.value)}`);
    if (!data.reviews.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'لا توجد رسائل في هذه القائمة.';
      reviewList.append(empty);
      setStatus(dashboardStatus, '');
      return;
    }

    data.reviews.forEach(review => {
      const item = document.createElement('article');
      item.className = 'review-item';
      const quote = document.createElement('blockquote');
      quote.textContent = review.message;
      const meta = document.createElement('p');
      meta.className = 'review-meta';
      const date = new Date(review.created_at);
      meta.textContent = `${review.name || 'زائر بدون اسم'} · ${Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ar-EG')}`;
      item.append(quote, meta);

      const actions = document.createElement('div');
      actions.className = 'review-actions';
      if (review.status === 'pending') {
        actions.append(
          makeButton('قبول ونشر', 'approve', () => updateReview(review.id, 'approve')),
          makeButton('رفض', 'reject', () => updateReview(review.id, 'reject'))
        );
      } else if (review.status === 'approved') {
        actions.append(makeButton('إخفاء ورفض', 'reject', () => updateReview(review.id, 'reject')));
      } else {
        actions.append(makeButton('حذف نهائي', 'delete', () => updateReview(review.id, 'delete')));
      }
      item.append(actions);
      reviewList.append(item);
    });
    setStatus(dashboardStatus, `عدد الرسائل: ${data.reviews.length}`);
  } catch (error) {
    if (/سجّل الدخول|انتهت الجلسة/.test(error.message)) return showLogin(error.message);
    setStatus(dashboardStatus, error.message, true);
  }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const password = new FormData(loginForm).get('password');
  const button = loginForm.querySelector('button');
  button.disabled = true;
  setStatus(loginStatus, 'جارٍ التحقق...');
  try {
    await api('login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    loginForm.reset();
    setStatus(loginStatus, '');
    showDashboard();
  } catch (error) {
    setStatus(loginStatus, error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.getElementById('refreshButton').addEventListener('click', loadReviews);
statusFilter.addEventListener('change', loadReviews);
document.getElementById('logoutButton').addEventListener('click', async () => {
  try { await api('logout', { method: 'POST' }); } catch { /* Expired sessions are also cleared by the login screen. */ }
  showLogin('تم تسجيل الخروج.');
});

api(`reviews?status=${encodeURIComponent(statusFilter.value)}`)
  .then(showDashboard)
  .catch(error => {
    if (/سجّل الدخول|انتهت الجلسة/.test(error.message)) return showLogin();
    showLogin('لوحة الإدارة تتاح بعد إعداد Cloudflare Pages وقاعدة D1.', true);
  });
