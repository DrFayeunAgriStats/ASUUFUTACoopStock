'use strict';

const workspaceMode = new URLSearchParams(location.search).get('workspace') === '1';
let coopSession;

async function coopRequest(path, { body, authenticate = true } = {}) {
  const { url, publishableKey } = window.coopConfig;
  const headers = { apikey: publishableKey, 'Content-Type': 'application/json' };
  const session = coopSession;
  if (authenticate) headers.Authorization = 'Bearer ' + session.token;
  const response = await fetch(url.replace(/\/$/, '') + path, {
    method: body === undefined ? 'GET' : 'POST',
    cache: 'no-store',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (authenticate && response.status === 401 && session === coopSession) {
    coopSession = undefined;
    showCoopSignIn('Your session expired. Sign in again.');
    throw Error('Your session expired.');
  }
  const payload = await response.json();
  if (!response.ok) {
    if (!authenticate) throw Error('Sign-in failed. Check your email and password.');
    const messages = {
      '42501': 'This account does not have permission for that action.',
      '22023': 'Check the product, quantity and reference.',
      '23514': 'There is insufficient stock for this sale.',
      '23505': 'That transaction reference has already been used.'
    };
    throw Error(messages[payload.code] || 'The workspace request failed. Try again.');
  }
  return payload;
}

async function loadCoopWorkspace() {
  const session = coopSession;
  const snapshot = await coopRequest('/rest/v1/rpc/coop_snapshot', { body: {} });
  if (session !== coopSession) return;
  session.role = snapshot.role;
  state = snapshot;
  $('workspace-badge').textContent = snapshot.role === 'staff' ? 'Store staff' : 'EXCO · Read only';
  $('workspace-footer').textContent = 'Shared cooperative workspace';
  $('workspace-link').hidden = true;
  $('sign-out').hidden = false;
  $('nav').hidden = false;
  render();
}

function showCoopSignIn(message = '') {
  if ($('dialog').open) $('dialog').close();
  state = { products: [], members: [], ledger: [] };
  $('nav').hidden = true;
  $('nav').innerHTML = '';
  $('crumb').textContent = 'Sign in';
  $('toast').textContent = '';
  $('workspace-badge').textContent = 'Restricted workspace';
  $('workspace-footer').textContent = 'Authorised cooperative accounts only';
  $('workspace-link').hidden = false;
  $('workspace-link').href = './';
  $('workspace-link').textContent = 'Back to demo';
  $('sign-out').hidden = true;
  const ready = Boolean(window.coopConfig?.url && window.coopConfig?.publishableKey);
  $('main').innerHTML = '<section class="panel"><div class="panel-head"><h1>Cooperative sign-in</h1></div><div class="empty">' +
    (ready ? '<form id="coop-login"><label>Email<input name="email" type="email" autocomplete="username" required></label>' +
      '<label>Password<input name="password" type="password" autocomplete="current-password" required></label>' +
      '<button class="primary" type="submit">Sign in</button><p class="error" role="alert">' + esc(message) + '</p></form>' :
      '<p>The account service is awaiting configuration.</p>') + '</div></section>';
  $('coop-login')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button');
    submit.disabled = true;
    const { email, password } = Object.fromEntries(new FormData(form));
    try {
      const session = await coopRequest('/auth/v1/token?grant_type=password', {
        authenticate: false, body: { email: email.trim(), password }
      });
      form.reset();
      coopSession = { token: session.access_token };
      page = 'Dashboard';
      filter = '';
      await loadCoopWorkspace();
    } catch (error) {
      coopSession = undefined;
      showCoopSignIn(error.message);
    }
  });
}

async function coopSignOut() {
  const request = coopRequest('/auth/v1/logout?scope=local', { body: {} });
  coopSession = undefined;
  showCoopSignIn();
  try { await request; } catch { /* The token has already been discarded locally. */ }
}
