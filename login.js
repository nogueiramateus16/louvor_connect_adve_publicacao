(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const views = ['loading', 'login', 'reset', 'logged'];
  const show = view => views.forEach(id => $(id).classList.toggle('hidden', id !== view));
  const showMessage = (text, kind = 'error') => {
    $('message').textContent = text;
    $('message').className = kind;
  };
  const clearMessage = () => $('message').classList.add('hidden');

  const cfg = window.LOUVOR_SUPABASE;
  if (!cfg?.url?.startsWith('https://') || !cfg?.publishableKey?.startsWith('sb_publishable_') || !window.supabase?.createClient) {
    $('loading').querySelector('h2').textContent = 'Acesso indisponível';
    showMessage('Não foi possível iniciar a conexão. Recarregue a página ou fale com o administrador.');
    return;
  }

  // Supabase may remove the fragment while it initializes the email-link session.
  const url = new URL(location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const linkType = fragment.get('type');
  const callbackToken = fragment.get('access_token');
  const hasLinkError = ['error', 'error_code', 'error_description'].some(
    key => fragment.has(key) || url.searchParams.has(key)
  );
  const isEmailCallback = hasLinkError || callbackToken !== null || fragment.has('refresh_token') ||
    url.searchParams.has('code') || url.searchParams.has('type') || linkType !== null;
  const isPasswordLink = !hasLinkError && Boolean(callbackToken && fragment.get('refresh_token')) &&
    (linkType === 'recovery' || linkType === 'invite');

  const api = window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: { flowType: 'implicit', detectSessionInUrl: isPasswordLink }
  });
  const loginUrl = new URL('./login.html', url).href;
  const expiredLinkMessage = 'Este link é inválido ou expirou. Solicite outro em “Esqueci minha senha”.';
  const connectionMessage = 'Não foi possível concluir a operação. Verifique a conexão e tente novamente.';
  let provisional = null;
  let passwordUserId = null;
  let roleRequest = 0;

  async function renderUser(user) {
    const request = ++roleRequest;
    $('userEmail').textContent = user.email || 'Conta autenticada';
    $('userRole').textContent = 'Verificando autorização…';
    $('leaderTools').classList.add('hidden');
    $('issuedCode').textContent = '';
    show('logged');

    let role = 'Não foi possível confirmar a função';
    try {
      const { data, error } = await api.from('lideres')
        .select('usuario_id')
        .eq('usuario_id', user.id)
        .maybeSingle();
      if (!error) role = data ? 'Líder autorizado' : 'Integrante (sem permissão de líder)';
    } catch {
      // Keep the status distinct from a confirmed lack of leader access.
    }
    if (request === roleRequest) {
      $('userRole').textContent = role;
      $('leaderTools').classList.toggle('hidden', role !== 'Líder autorizado');
    }
  }

  function backToLogin() {
    provisional = null;
    $('issuedCode').textContent = '';
    passwordUserId = null;
    ++roleRequest;
    $('resetForm').reset();
    $('password').value = '';
    show('login');
  }

  async function withButton(button, operation) {
    clearMessage();
    button.disabled = true;
    try {
      await operation();
    } catch {
      showMessage(connectionMessage);
    } finally {
      button.disabled = false;
    }
  }

  function rateLimited(error) {
    return error.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error.code);
  }

  $('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    await withButton($('loginButton'), async () => {
      const code = $('password').value.trim();
      if (/^ADVE-[0-9a-f]{32}$/.test(code)) {
        provisional = { email: $('email').value.trim(), codigo: code };
        $('password').value = '';
        $('resetTitle').textContent = 'Criar minha senha';
        show('reset');
        $('newPassword').focus();
        return;
      }
      const { data, error } = await api.auth.signInWithPassword({
        email: $('email').value.trim(),
        password: $('password').value
      });
      if (error) {
        const message = {
          invalid_credentials: 'E-mail ou senha incorretos. Use “Esqueci minha senha” para recuperar o acesso.',
          email_not_confirmed: 'Confirme seu e-mail antes de entrar.'
        }[error.code];
        showMessage(rateLimited(error) ? 'Muitas tentativas. Aguarde alguns minutos.' : message || connectionMessage);
        return;
      }
      $('password').value = '';
      await renderUser(data.user);
    });
  });

  $('forgotButton').addEventListener('click', async () => {
    const field = $('email');
    if (!field.reportValidity()) return;
    await withButton($('forgotButton'), async () => {
      const { error } = await api.auth.resetPasswordForEmail(field.value.trim(), { redirectTo: loginUrl });
      if (error) {
        showMessage(rateLimited(error) ? 'Aguarde alguns minutos antes de solicitar outro link.' :
          'Não foi possível enviar o link. Tente novamente ou fale com o administrador.');
        return;
      }
      showMessage('Se a conta puder receber e-mails, o link chegará em instantes. Confira também a pasta de spam.', 'success');
    });
  });

  $('resetForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!passwordUserId && !provisional) return;
    const password = $('newPassword').value;
    if (password.length < 12 || password !== $('confirmPassword').value) {
      showMessage('Use pelo menos 12 caracteres e digite a mesma senha nos dois campos.');
      return;
    }

    await withButton($('resetButton'), async () => {
      if (provisional) {
        const { error } = await api.functions.invoke('trocar-provisoria', {
          body: { ...provisional, senha: password }
        });
        if (error) {
          const status = error.context?.status;
          if (status === 403 || status === 409) backToLogin();
          showMessage(status === 403 ? 'Código inválido ou expirado. Solicite outro.' :
            status === 409 ? 'A senha não foi salva. Solicite outra provisória.' :
            status === 400 ? 'Use uma nova senha de 12 a 72 bytes, sem o prefixo ADVE-.' : connectionMessage);
          return;
        }
        backToLogin();
        showMessage('Senha definida. Entre com sua nova senha.', 'success');
        return;
      }
      const { data: { user }, error: sessionError } = await api.auth.getUser();
      if (sessionError || !user || user.id !== passwordUserId) {
        backToLogin();
        showMessage(expiredLinkMessage);
        return;
      }
      const { data, error } = await api.auth.updateUser({ password });
      if (error) {
        showMessage(error.code === 'same_password' ? 'Escolha uma senha diferente da anterior.' :
          error.code === 'weak_password' ? 'Escolha uma senha mais forte.' :
          'Não foi possível salvar a senha. Se necessário, solicite um novo link.');
        return;
      }
      passwordUserId = null;
      $('resetForm').reset();
      await renderUser(data.user);
      showMessage('Nova senha salva com sucesso.', 'success');
    });
  });

  $('issueForm').addEventListener('submit', async event => {
    event.preventDefault();
    $('issuedCode').textContent = '';
    await withButton($('issueButton'), async () => {
      const { data, error } = await api.rpc('emitir_provisoria', { destino: $('memberEmail').value.trim() });
      if (error) {
        showMessage('Confira se o e-mail pertence a um integrante confirmado.');
        return;
      }
      $('issuedCode').textContent = data;
      showMessage('Entregue o código ao integrante em particular. Validade de 30 minutos.', 'success');
    });
  });

  $('logoutButton').addEventListener('click', async () => {
    await withButton($('logoutButton'), async () => {
      const { error } = await api.auth.signOut({ scope: 'local' });
      if (error) {
        showMessage(connectionMessage);
        return;
      }
      backToLogin();
      showMessage('Você saiu da conta.', 'success');
    });
  });

  api.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') backToLogin();
  });

  async function initialize() {
    try {
      const { data: { session }, error } = await api.auth.getSession();
      if (isEmailCallback) {
        history.replaceState(history.state, '', url.pathname);
        // A saved session from an earlier visit must never authorize a failed link.
        if (error || !isPasswordLink || session?.access_token !== callbackToken) {
          backToLogin();
          showMessage(expiredLinkMessage);
          return;
        }
      }

      if (error || !session) {
        show('login');
        return;
      }
      const { data: { user }, error: userError } = await api.auth.getUser();
      if (userError || !user) {
        backToLogin();
        showMessage(isEmailCallback ? expiredLinkMessage : connectionMessage);
        return;
      }
      if (isPasswordLink) {
        passwordUserId = user.id;
        $('resetTitle').textContent = linkType === 'invite' ? 'Ativar conta e criar senha' : 'Redefinir senha';
        show('reset');
        $('newPassword').focus();
        return;
      }
      await renderUser(user);
    } catch {
      backToLogin();
      showMessage(connectionMessage);
    }
  }

  void initialize();
})();
