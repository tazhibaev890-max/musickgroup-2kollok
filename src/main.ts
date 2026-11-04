import './style.css';

const API = 'https://inai-col3.fishrungames.com';
// JWT variant: access token is short-lived; refresh token is kept for this browser tab.
const app = document.querySelector<HTMLDivElement>('#app')!;

type Profile = {
  first_name: string;
  specialization: string;
  specialization_display: string;
  bio: string;
  fee: string;
};
type User = { id: number; username: string; profile: Profile };
type Specialization = { value: string; label: string };
type ApiError = { detail?: string; [field: string]: unknown };

let accessToken = '';
let refreshToken = sessionStorage.getItem('band_refresh_token') ?? '';
let currentUser: User | null = null;
let specializations: Specialization[] = [
  { value: 'vocals', label: 'Вокал' }, { value: 'guitar', label: 'Гитара' },
  { value: 'bass', label: 'Бас-гитара' }, { value: 'drums', label: 'Ударные' },
  { value: 'keys', label: 'Клавишные' }, { value: 'other', label: 'Другое' },
];

async function request<T>(path: string, init: RequestInit = {}, authenticated = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (authenticated && accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  if (response.status === 401 && authenticated) {
    const refreshed = await refreshAccess();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${accessToken}`);
      const retry = await fetch(`${API}${path}`, { ...init, headers });
      if (retry.ok) return retry.status === 204 ? undefined as T : await retry.json() as T;
      throw await readError(retry);
    }
  }
  if (!response.ok) throw await readError(response);
  return response.status === 204 ? undefined as T : await response.json() as T;
}

async function readError(response: Response): Promise<Error> {
  let data: ApiError = {};
  try { data = await response.json() as ApiError; } catch { /* response has no JSON body */ }
  const detail = data.detail ?? Object.entries(data).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(' ') : String(value)}`).join('\n');
  return new Error(detail || `Ошибка запроса (${response.status})`);
}

async function refreshAccess(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const result = await request<{ access: string; refresh?: string }>('/api/token/refresh/', {
      method: 'POST', body: JSON.stringify({ refresh: refreshToken }),
    });
    accessToken = result.access;
    if (result.refresh) saveRefreshToken(result.refresh);
    return Boolean(accessToken);
  } catch {
    clearSession();
    return false;
  }
}

function saveRefreshToken(token: string): void {
  refreshToken = token;
  sessionStorage.setItem('band_refresh_token', token);
}

function clearSession(): void {
  accessToken = '';
  refreshToken = '';
  currentUser = null;
  sessionStorage.removeItem('band_refresh_token');
}

function escapeHtml(value: unknown = ''): string {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

function showMessage(message: string, kind: 'error' | 'success' | 'info' = 'info'): void {
  const box = document.querySelector<HTMLElement>('#notice');
  if (!box) return;
  box.textContent = message;
  box.className = `notice notice--${kind}`;
  box.hidden = false;
}

function setBusy(form: HTMLFormElement, busy: boolean): void {
  form.querySelectorAll<HTMLButtonElement>('button[type="submit"]').forEach((button) => {
    button.disabled = busy;
    button.dataset.label ??= button.textContent ?? '';
    button.textContent = busy ? 'Подождите…' : button.dataset.label;
  });
}

function renderAuth(mode: 'login' | 'register' = 'login'): void {
  const registering = mode === 'register';
  app.innerHTML = `
    <main class="auth-layout">
      <section class="brand-panel">
        <a class="wordmark" href="#" aria-label="Состав, на главную"><span class="wordmark__icon">С</span> СОСТАВ<span class="wordmark__dot">.</span></a>
        <div class="brand-copy"><p class="eyebrow">МУЗЫКА СОБИРАЕТ НАС</p><h1>Каждый звук<br>имеет <em>своё место.</em></h1><p class="brand-text">Личный кабинет музыканта. Настройте свой профиль и оставайтесь на связи с группой.</p></div>
        <div class="sound-wave" aria-hidden="true">${Array.from({ length: 42 }, (_, i) => `<i style="--h:${12 + ((i * 31 + i * i * 7) % 70)}px"></i>`).join('')}</div>
        <p class="brand-foot">РЕПЕТИРУЕМ. СОЗДАЁМ. ЗВУЧИМ.</p>
      </section>
      <section class="auth-panel">
        <div class="auth-top"><span class="status-dot"></span> КАБИНЕТ УЧАСТНИКА</div>
        <div class="auth-card">
          <p class="eyebrow">${registering ? 'НОВЫЙ УЧАСТНИК' : 'С РАДОСТЬЮ СНОВА'}</p>
          <h2>${registering ? 'Присоединиться' : 'С возвращением'}</h2>
          <p class="subheading">${registering ? 'Создайте аккаунт, чтобы заявить о себе.' : 'Войдите в свой аккаунт и настройте профиль.'}</p>
          <div id="notice" class="notice" role="status" hidden></div>
          <form id="auth-form" class="form-stack">
            <label class="field"><span>Имя пользователя</span><input name="username" autocomplete="username" minlength="1" maxlength="150" placeholder="например, alex_music" required></label>
            <label class="field"><span>Пароль</span><input name="password" type="password" autocomplete="${registering ? 'new-password' : 'current-password'}" minlength="${registering ? '6' : '1'}" placeholder="${registering ? 'Не менее 6 символов' : 'Введите пароль'}" required></label>
            <button class="button button--primary" type="submit">${registering ? 'Создать аккаунт' : 'Войти'} <span aria-hidden="true">↗</span></button>
          </form>
          <p class="switch-mode">${registering ? 'Уже есть аккаунт?' : 'Впервые здесь?'} <button class="text-button" id="switch-mode" type="button">${registering ? 'Войти' : 'Создать аккаунт'}</button></p>
        </div>
        <p class="auth-legal">ЛИЧНЫЙ КАБИНЕТ МУЗЫКАНТА <span>·</span> 2026</p>
      </section>
    </main>`;

  document.querySelector<HTMLButtonElement>('#switch-mode')!.addEventListener('click', () => renderAuth(registering ? 'login' : 'register'));
  document.querySelector<HTMLFormElement>('#auth-form')!.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    setBusy(form, true);
    try {
      const result = await request<{ access: string; refresh: string; user?: User }>(registering ? '/api/register/' : '/api/login/', {
        method: 'POST', body: JSON.stringify({ username: data.get('username'), password: data.get('password') }),
      });
      accessToken = result.access;
      if (!result.refresh) throw new Error('Сервер не вернул refresh-токен.');
      saveRefreshToken(result.refresh);
      currentUser = result.user ?? await request<User>('/api/profile/', {}, true);
      await loadSpecializations();
      renderProfile();
      showMessage(registering ? 'Аккаунт создан. Добро пожаловать!' : 'Вы вошли в аккаунт.', 'success');
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Не удалось выполнить запрос.', 'error');
      setBusy(form, false);
    }
  });
}

async function loadSpecializations(): Promise<void> {
  try { specializations = await request<Specialization[]>('/api/specializations/'); } catch { /* keep documented fallback list */ }
}

function renderProfile(): void {
  if (!currentUser) return renderAuth();
  const profile = currentUser.profile;
  const options = specializations.map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === profile.specialization ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
  const initials = (profile.first_name || currentUser.username).slice(0, 1).toUpperCase();
  app.innerHTML = `
    <main class="dashboard">
      <header class="topbar"><a class="wordmark wordmark--dark" href="#"><span class="wordmark__icon">С</span> СОСТАВ<span class="wordmark__dot">.</span></a><div class="topbar__right"><span class="online-label"><i></i> В СЕТИ</span><button class="logout-button" id="logout" type="button">Выйти <span aria-hidden="true">↗</span></button></div></header>
      <section class="profile-hero"><div><p class="eyebrow">ЛИЧНЫЙ КАБИНЕТ / УЧАСТНИК</p><h1>Мой <em>профиль.</em></h1><p class="hero-copy">Расскажите группе о себе и своём звучании.</p></div><div class="hero-mark" aria-hidden="true">♫</div></section>
      <section class="profile-grid">
        <aside class="identity-card"><div class="avatar">${escapeHtml(initials)}</div><span class="member-tag"><i></i> УЧАСТНИК ГРУППЫ</span><h2>${escapeHtml(profile.first_name || currentUser.username)}</h2><p class="identity-user">@${escapeHtml(currentUser.username)}</p><div class="identity-divider"></div><p class="member-number">УЧАСТНИК № <strong>${String(currentUser.id).padStart(3, '0')}</strong></p><p class="identity-note">Ваш профиль виден организаторам группы.</p></aside>
        <section class="edit-card"><div class="card-heading"><div><p class="eyebrow">ВАША ИНФОРМАЦИЯ</p><h2>Данные профиля</h2></div><span class="edit-icon" aria-hidden="true">✳</span></div>
          <div id="notice" class="notice" role="status" hidden></div>
          <form id="profile-form" class="profile-form">
            <label class="field"><span>Имя</span><input name="first_name" maxlength="100" value="${escapeHtml(profile.first_name)}" placeholder="Как к вам обращаться"></label>
            <label class="field"><span>Имя пользователя</span><input value="${escapeHtml(currentUser.username)}" disabled><small>Имя пользователя нельзя изменить</small></label>
            <label class="field"><span>Специализация</span><select name="specialization" required>${options}</select></label>
            <label class="field"><span>Гонорар за выступление</span><div class="input-suffix"><input name="fee" inputmode="decimal" pattern="^-?\\d{0,8}(?:\\.\\d{0,2})?$" value="${escapeHtml(profile.fee)}" placeholder="0.00"><span>сом</span></div></label>
            <label class="field field--wide"><span>О себе</span><textarea name="bio" rows="4" placeholder="Расскажите о своём опыте, инструментах и музыке…">${escapeHtml(profile.bio)}</textarea></label>
            <div class="form-actions"><p>Изменения сохраняются в вашем профиле.</p><button class="button button--primary" type="submit">Сохранить изменения <span aria-hidden="true">↗</span></button></div>
          </form>
        </section>
      </section>
      <footer class="page-footer"><span>СОСТАВ. ЛИЧНЫЙ КАБИНЕТ МУЗЫКАНТА</span><span>НАСТРАИВАЙТЕ ПРОФИЛЬ · ЗВУЧИТЕ ВМЕСТЕ</span></footer>
    </main>`;

  document.querySelector<HTMLButtonElement>('#logout')!.addEventListener('click', async () => {
    const button = document.querySelector<HTMLButtonElement>('#logout')!;
    button.disabled = true;
    try {
      await request('/api/logout/', { method: 'POST', body: JSON.stringify({ refresh: refreshToken }) }, true);
    } catch { /* clear local session even when the refresh token has expired */ }
    clearSession();
    renderAuth();
    showMessage('Вы вышли из аккаунта.', 'success');
  });

  document.querySelector<HTMLFormElement>('#profile-form')!.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const payload = Object.fromEntries(['first_name', 'specialization', 'bio', 'fee']
      .map((key) => [key, String(data.get(key) ?? '').trim()] as const)
      .filter(([key, value]) => key !== 'fee' || value !== ''));
    setBusy(form, true);
    try {
      const result = await request<User>('/api/profile/', { method: 'PATCH', body: JSON.stringify(payload) }, true);
      currentUser = result;
      renderProfile();
      showMessage('Профиль сохранён.', 'success');
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Не удалось сохранить профиль.', 'error');
      setBusy(form, false);
    }
  });
}

async function start(): Promise<void> {
  const hasSession = await refreshAccess();
  if (!hasSession) return renderAuth();
  try {
    currentUser = await request<User>('/api/profile/', {}, true);
    await loadSpecializations();
    renderProfile();
  } catch {
    clearSession();
    renderAuth();
  }
}

void start();

