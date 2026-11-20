'use strict';
const byId = id => document.getElementById(id);
const notify = message => { byId('status').textContent = message; };
const cfg = window.LOUVOR_SUPABASE;
const api = window.supabase?.createClient(cfg.url, cfg.publishableKey);
let user;
let birthdayNotices = [];
let noticesLoaded = false;
let selectedTab;
let loadingNotices = false;
let leader = false;
let members = [], songs = [], scales = [];
function node(tag, value) {
  const el = document.createElement(tag);
  if (value != null) el.textContent = value;
  return el;
}
function tab(id) {
  const button = document.querySelector('[data-tab="' + id + '"]');
  if (!button || button.hidden) return;
  selectedTab = id;
  for (const button of document.querySelectorAll('[data-tab]')) {
    const active = button.dataset.tab === id;
    byId(button.dataset.tab).hidden = !active;
    button.setAttribute('aria-pressed', active);
  }
  if (id === 'chat') void refreshChat();
  if (id === 'notices') {
    renderNotices();
    void loadNotices();
  }
}
function choices(id, rows, label, name) {
  const box = byId(id);
  box.replaceChildren();
  for (const item of rows) {
    const line = node('label'), input = node('input');
    input.type = 'checkbox'; input.name = name; input.value = item.id;
    line.append(input, document.createTextNode(item[label])); box.append(line);
  }
  if (!rows.length) box.textContent = 'Nenhum cadastro disponível.';
}
function edit(form, values) {
  form.reset();
  for (const el of form.elements) {
    if (!el.name || values[el.name] == null) continue;
    if (el.type === 'checkbox') el.checked = values[el.name].includes(el.value);
    else el.value = values[el.name];
  }
  form.closest('details').open = true;
  form.elements.titulo.focus();
}
function cards(id, rows, empty, describe) {
  const list = byId(id);
  list.replaceChildren();
  if (!rows.length) list.textContent = empty;
  for (const row of rows) {
    const card = node('article');
    describe(row, card); list.append(card);
  }
}
function readNoticeIds() {
  try { return new Set(JSON.parse(localStorage.getItem('louvor-avisos:' + user.id) || '[]')); }
  catch { return new Set(); }
}
function renderNotices() {
  if (!noticesLoaded) return;
  const button = document.querySelector('[data-tab="notices"]');
  const read = readNoticeIds();
  const unread = birthdayNotices.filter(item => !read.has(item.id)).length;
  button.textContent = unread && selectedTab !== 'notices' ? 'Notificações (' + unread + ')' : 'Notificações';
  if (selectedTab !== 'notices') return;
  cards('noticeList', birthdayNotices, 'Nenhum aniversário nos últimos sete dias.', (item, card) => {
    const date = item.dia.split('-').reverse().join('/');
    card.append(node('h3', 'Aniversário · ' + date), node('p', item.mensagem));
  });
  try { localStorage.setItem('louvor-avisos:' + user.id, JSON.stringify(birthdayNotices.map(item => item.id))); }
  catch { /* The inbox remains available without local storage. */ }
}
async function loadNotices() {
  if (loadingNotices || !user) return;
  loadingNotices = true;
  try {
    const { data, error } = await api.rpc('avisos_de_aniversario');
    if (error) throw error;
    birthdayNotices = data;
    noticesLoaded = true;
    renderNotices();
  } catch {
    if (!noticesLoaded) byId('noticeList').textContent = 'Avisos indisponíveis nesta tentativa. Abra a aba novamente para atualizar.';
  } finally {
    loadingNotices = false;
  }
}
function editButton(card, fn) {
  if (!leader) return;
  const button = node('button','Editar');
  button.onclick = fn; card.append(button);
}
async function load() {
  const results = await Promise.all([
    api.from('musicos').select('id,nome_completo,email,telefone,funcao_musical,data_nascimento').order('nome_completo'),
    api.from('repertorio').select('*').order('titulo'),
    api.from('escalas').select('*').order('inicio')
  ]);
  if (results.some(result => result.error)) throw Error('Não foi possível carregar os dados do painel. Atualize a página para tentar novamente.');
  [members, songs, scales] = results.map(result => result.data);
  const own = members.find(m => m.id === user.id);
  const profile = byId('profileForm').elements;
  profile.nome.value = own?.nome_completo || '';
  profile.email_informado.value = user.email;
  profile.contato.value = own?.telefone || '';
  profile.nascimento.value = own?.data_nascimento || '';
  profile.nascimento.max = new Date().toLocaleDateString('en-CA');
  if (leader) {
    choices('teamOptions', members, 'nome_completo', 'integrantes');
    choices('songOptions', songs, 'titulo', 'musicas');
    cards('teamList', members, 'Os integrantes aparecem aqui depois de preencherem o cadastro.', (m, card) => {
      card.append(node('h3',m.nome_completo), node('p',[m.email,m.telefone,m.funcao_musical,m.data_nascimento?.split('-').reverse().join('/')].filter(Boolean).join(' · ')));
    });
  }
  cards('songList', songs, 'Nenhuma música cadastrada.', (song, card) => {
    card.append(node('h3',song.titulo),node('p',[song.artista,song.tom,song.notas].filter(Boolean).join(' · ')));
    if (song.trecho) card.append(node('blockquote', song.trecho));
    if (/^https?:\/\//i.test(song.cifra)) {
      const link = node('a','Abrir cifra'); link.href = song.cifra;
      link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(link, node('br'));
    }
    editButton(card, () => edit(byId('songForm'), song));
  });
  cards('scaleList', scales, leader ? 'Nenhuma escala cadastrada.' : 'Você ainda não tem escalas.', (scale, card) => {
    const date = new Date(scale.inicio);
    const titles = scale.musicas.map(id => songs.find(s => s.id === id)?.titulo).filter(Boolean);
    const names = scale.integrantes.map(id => members.find(m => m.id === id)?.nome_completo).filter(Boolean);
    card.append(node('h3',scale.titulo),node('p',date.toLocaleString('pt-BR')),
      node('p',[leader ? names.join(', ') : '',titles.join(' • '),scale.notas].filter(Boolean).join('\n')));
    const chat = node('button', 'Abrir chat do culto');
    chat.onclick = () => { byId('chatScale').value = scale.id; tab('chat'); };
    card.append(chat);
    editButton(card, () => edit(byId('scaleForm'), { ...scale,
      inicio: localDateTime(scale.inicio), termino: localDateTime(scale.termino) }));
  });
  const chooser = byId('chatScale');
  const previous = chooser.value;
  chooser.replaceChildren();
  for (const scale of [...scales].reverse()) {
    const option = node('option', scale.titulo + ' · ' + new Date(scale.inicio).toLocaleDateString('pt-BR'));
    option.value = scale.id;
    chooser.append(option);
  }
  if (scales.some(scale => scale.id === previous)) chooser.value = previous;
  return own;
}
function submit(id, action) {
  const form = byId(id);
  form.onsubmit = async event => {
    event.preventDefault();
    const buttons = [...form.querySelectorAll('[type=submit]')];
    buttons.forEach(b => { b.disabled = true; });
    try { notify(await action(form,new FormData(form),event.submitter)); }
    catch (e) { notify(e.message || 'Operação indisponível. Tente novamente.'); }
    finally { buttons.forEach(b => { b.disabled = false; }); }
  };
}
async function save(table, form, data) {
  const id = data.id;
  delete data.id;
  const query = id ? api.from(table).update(data).eq('id',id) : api.from(table).insert(data);
  const { error } = await query.select('id').single();
  if (error) throw Error('Falha ao salvar. Confira os campos e sua permissão.');
  form.reset(); form.closest('details').open = false;
  await load(); return 'Alterações salvas.';
}
for (const form of [byId('scaleForm'), byId('songForm')]) {
  form.addEventListener('reset', () => { form.elements.id.value = ''; });
}
function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
}
submit('scaleForm', (form, values) => {
  const original = scales.find(scale => scale.id === values.get('id'));
  const originalStart = original && localDateTime(original.inicio) === values.get('inicio');
  const originalEnd = original && localDateTime(original.termino) === values.get('termino');
  const inicio = new Date(originalStart ? original.inicio : values.get('inicio'));
  const termino = values.get('termino') ? new Date(originalEnd ? original.termino : values.get('termino')) : null;
  if (termino && (termino <= inicio || termino - inicio > 86400000)) {
    throw Error('O término precisa ficar até 24 horas depois do início.');
  }
  return save('escalas', form, { ...Object.fromEntries(values), inicio: inicio.toISOString(),
    termino: termino?.toISOString() || null, integrantes: values.getAll('integrantes'),
    musicas: values.getAll('musicas') });
});
submit('songForm',(form, values) => save('repertorio', form, Object.fromEntries(values)));
submit('profileForm',async (form, values) => {
  const { error } = await api.rpc('salvar_meu_cadastro',Object.fromEntries(values));
  if (error) throw Error('Confira os dados e use o e-mail da sua conta.');
  await load(); return 'Cadastro salvo.';
});
let currentInvite = '';
byId('copyInvite').onclick = async () => {
  try { await navigator.clipboard.writeText(currentInvite); notify('Link individual copiado.'); }
  catch { notify('Abra o e-mail preparado para enviar o convite.'); }
};
submit('inviteForm',async (form, values, button) => {
  currentInvite = '';
  byId('delivery').hidden = true;
  byId('compose').removeAttribute('href');
  const email = values.get('email').trim();
  const { data, error } = await api.functions.invoke('convidar-musico',{ body:{ email, envio: button?.value || 'manual' } });
  if (error) {
    let message;
    try { message = (await error.context.json()).message; } catch {}
    throw Error(message || 'Falha ao enviar o convite. Verifique o serviço de e-mail.');
  }
  if (data.link) {
    currentInvite = data.link;
    const body = 'Olá! Você foi convidado(a) para o Louvor Connect ADVE. Abra seu link individual, preencha o cadastro e crie sua senha.\n\n' + currentInvite;
    byId('compose').href = 'mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent('Convite individual • Louvor Connect ADVE') + '&body=' + encodeURIComponent(body);
    byId('delivery').hidden = false;
  }
  form.reset(); return data.message;
});
let chatRequest = 0;
let chatVersion;
let oldestMessage;
function appendChatMessage(item, card) {
  card.append(node('h3', item.autor + ' · ' + new Date(item.criado_em).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})),
    node('p', item.mensagem));
}
byId('olderChat').onclick = async () => {
  const button = byId('olderChat');
  const culto = byId('chatScale').value;
  const version = chatVersion;
  button.disabled = true;
  try {
    const { data, error } = await api.rpc('ler_chat_do_culto', { culto, antes_de: oldestMessage }).maybeSingle();
    if (version !== chatVersion || culto !== byId('chatScale').value) return;
    if (error) throw error;
    const rows = data?.mensagens || [];
    const fragment = document.createDocumentFragment();
    for (const item of rows) {
      const card = node('article');
      appendChatMessage(item, card);
      fragment.append(card);
    }
    byId('chatMessages').prepend(fragment);
    oldestMessage = rows[0]?.id;
    button.hidden = rows.length < 100;
  } catch {
    notify('Não foi possível carregar as mensagens anteriores.');
  } finally {
    button.disabled = false;
  }
};
async function refreshChat() {
  const request = ++chatRequest;
  const culto = byId('chatScale').value;
  const form = byId('chatForm');
  const state = byId('chatState');
  const older = byId('olderChat');
  if (!culto) {
    form.hidden = older.hidden = true;
    chatVersion = null;
    state.textContent = 'Nenhuma escala disponível.';
    byId('chatMessages').replaceChildren();
    return;
  }
  if (chatVersion?.[0] !== culto) {
    form.hidden = older.hidden = true;
    form.reset();
    byId('chatMessages').replaceChildren();
    state.textContent = 'Carregando chat…';
  }
  try {
    const { data, error } = await api.rpc('ler_chat_do_culto', { culto }).maybeSingle();
    if (request !== chatRequest) return;
    if (error) throw error;
    form.hidden = !data?.aberto;
    state.textContent = data?.aberto ? 'Chat aberto' :
      leader ? 'Chat fechado. Histórico disponível para a liderança.' : 'O chat abre no dia do culto e fecha no horário de término.';
    const rows = data?.mensagens || [];
    const version = [culto, ...rows.map(item => item.id)].join(',');
    if (chatVersion?.[1] !== version) {
      cards('chatMessages', rows, data?.aberto || leader ? 'Nenhuma mensagem.' : '', appendChatMessage);
      oldestMessage = rows[0]?.id;
      older.hidden = !leader || rows.length < 100;
      chatVersion = [culto, version];
    }
  } catch {
    if (request !== chatRequest) return;
    form.hidden = older.hidden = true;
    byId('chatMessages').replaceChildren();
    chatVersion = null;
    state.textContent = 'Chat indisponível. Tente novamente em instantes.';
  }
}
byId('chatScale').onchange = () => void refreshChat();
submit('chatForm', async (form, values) => {
  const culto = byId('chatScale').value;
  const mensagem = values.get('mensagem').trim();
  if (!mensagem) throw Error('Digite uma mensagem.');
  const { error } = await api.from('chat_do_culto').insert({ escala_id: culto, mensagem });
  await refreshChat();
  if (error) throw Error('Não foi possível enviar. Confira se o chat ainda está aberto.');
  form.reset();
  return 'Mensagem enviada.';
});
async function start() {
  if (!api) throw Error('Conexão indisponível. Recarregue a página.');
  api.auth.onAuthStateChange((event,session) => {
    if (event === 'SIGNED_OUT' || (user && session?.user && session.user.id !== user.id)) location.replace('./login.html');
  });
  const auth = await api.auth.getUser();
  if (!auth.data.user) { location.replace('./login.html'); return; }
  user = auth.data.user;
  const role = await api.from('lideres').select('usuario_id').eq('usuario_id',user.id).maybeSingle();
  if (role.error) throw Error('Falha ao verificar a função da conta.');
  leader = Boolean(role.data);
  byId('accountRole').textContent = user.email + ' · ' + (leader ? 'Líder' : 'Integrante');
  byId('accountRole').hidden = false;
  byId('scaleHint').hidden = leader;
  document.querySelectorAll('.leader').forEach(el => { el.hidden = !leader; });
  document.querySelectorAll('[data-tab]').forEach(el => { el.onclick = () => tab(el.dataset.tab); });
  const own = await load();
  tab(!leader && !own?.data_nascimento ? 'profile' : 'scales');
  byId('app').hidden = false;
  notify('');
  void loadNotices();
  window.setInterval(() => { if (!document.hidden) void loadNotices(); }, 60000);
  window.setInterval(() => { if (!document.hidden && selectedTab === 'chat') void refreshChat(); }, 8000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      void loadNotices();
      if (selectedTab === 'chat') void refreshChat();
    }
  });
}
start().catch(e => notify(e.message));
