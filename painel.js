'use strict';
const byId = id => document.getElementById(id);
const notify = message => { byId('status').textContent = message; };
const cfg = window.LOUVOR_SUPABASE;
const api = window.supabase?.createClient(cfg.url, cfg.publishableKey);
let user;
let leader = false;
let members = [], songs = [], scales = [];
const chatAberto = (scale, now = Date.now()) =>
  Boolean(scale.termino && Date.parse(scale.inicio) <= now && now < Date.parse(scale.termino));
const localInputValue = value => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const chatAcessivel = scale => leader || (scale.integrantes.includes(user.id) && chatAberto(scale));
function node(tag, value) {
  const el = document.createElement(tag);
  if (value != null) el.textContent = value;
  return el;
}
function tab(id) {
  for (const button of document.querySelectorAll('[data-tab]')) {
    const active = button.dataset.tab === id;
    byId(button.dataset.tab).hidden = !active;
    button.setAttribute('aria-pressed', active);
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
    if (/^https?:\/\//i.test(song.cifra)) {
      const link = node('a','Abrir cifra'); link.href = song.cifra;
      link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(link, node('br'));
    }
    if (/^https?:\/\//i.test(song.audio || '')) {
      const audio = node('a','Ouvir música'); audio.href = song.audio;
      audio.target = '_blank'; audio.rel = 'noopener noreferrer'; card.append(audio, node('br'));
    }
    if (song.trecho) {
      const trecho = node('details');
      trecho.append(node('summary', 'Trecho da música'), node('p', song.trecho));
      card.append(trecho);
    }
    editButton(card, () => edit(byId('songForm'), song));
  });
  cards('scaleList', scales, leader ? 'Nenhuma escala cadastrada.' : 'Você ainda não tem escalas.', (scale, card) => {
    const date = new Date(scale.inicio);
    const titles = scale.musicas.map(id => songs.find(s => s.id === id)?.titulo).filter(Boolean);
    const names = scale.integrantes.map(id => members.find(m => m.id === id)?.nome_completo).filter(Boolean);
    card.append(node('h3',scale.titulo),node('p',date.toLocaleString('pt-BR')),
      node('p',[leader ? names.join(', ') : '',titles.join(' • '),scale.notas].filter(Boolean).join('\n')));
    if (chatAcessivel(scale)) {
      const openChat = node('button', 'Abrir chat do culto');
      openChat.onclick = () => { tab('chat'); byId('chatScale').value = scale.id; loadChat().catch(e => notify(e.message)); };
      card.append(openChat);
    }
    editButton(card, () => edit(byId('scaleForm'), { ...scale,
      inicio: localInputValue(scale.inicio), termino: localInputValue(scale.termino) }));
  });
  refreshChatChoices();
  return own;
}
function refreshChatChoices() {
  const chatSelect = byId('chatScale');
  const selected = chatSelect.value;
  chatSelect.replaceChildren();
  for (const scale of scales.filter(chatAcessivel)) {
    const option = node('option',scale.titulo + ' — ' + new Date(scale.inicio).toLocaleDateString('pt-BR'));
    option.value = scale.id; chatSelect.append(option);
  }
  if ([...chatSelect.options].some(option => option.value === selected)) chatSelect.value = selected;
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
let chatRequest = 0;
async function loadChat() {
  const request = ++chatRequest;
  const id = byId('chatScale').value;
  const list = byId('chatList'), form = byId('chatForm');
  const scale = scales.find(s => s.id === id);
  if (!scale || !chatAcessivel(scale)) {
    list.textContent = 'Nenhum culto com chat disponível.';
    form.hidden = true;
    return;
  }
  form.hidden = !chatAberto(scale);
  if (list.dataset.scale !== id) list.replaceChildren();
  list.dataset.scale = id;
  const {data,error} = await api.from('mensagens_culto').select('id,autor_id,mensagem,criado_em').eq('escala_id',id).order('criado_em',{ascending:false}).order('id',{ascending:false}).limit(300);
  if (request !== chatRequest) return;
  if (!chatAcessivel(scale)) {
    list.textContent = 'O chat deste culto foi encerrado.';
    form.hidden = true;
    return;
  }
  if (error) { list.textContent = 'Não foi possível consultar o chat.'; return; }
  list.replaceChildren();
  if (!data.length) list.textContent = 'Nenhuma mensagem neste culto.';
  data.reverse();
  for (const item of data) {
    const author = members.find(m => m.id === item.autor_id)?.nome_completo || 'Integrante';
    const card = node('article');
    card.append(node('strong',author), node('p',item.mensagem),node('small',new Date(item.criado_em).toLocaleString('pt-BR')));
    list.append(card);
  }
}
byId('chatScale').onchange = () => loadChat().catch(e=>notify(e.message));
submit('chatForm',async(form,values) => {
  const escala_id = byId('chatScale').value;
  const mensagem = String(values.get('mensagem') || '').trim();
  if (!mensagem || mensagem.length > 1000) throw Error('Escreva uma mensagem de até 1000 caracteres.');
  const scale = scales.find(s=>s.id === escala_id);
  if (!scale || !chatAberto(scale) || !chatAcessivel(scale)) throw Error('O chat está fechado para esta escala.');
  const {error} = await api.from('mensagens_culto').insert({escala_id,mensagem});
  if (error) throw Error('Não foi possível enviar a mensagem. Confira sua escala e tente novamente.');
  form.reset(); await loadChat(); return 'Mensagem enviada.';
});
submit('scaleForm', (form, values) => {
  const inicio = new Date(values.get('inicio'));
  const termino = values.get('termino') ? new Date(values.get('termino')) : null;
  if (termino && termino <= inicio) throw Error('O término precisa ser depois do início do culto.');
  return save('escalas', form, {
    ...Object.fromEntries(values), inicio: inicio.toISOString(),
    termino: termino?.toISOString() ?? null,
    integrantes: values.getAll('integrantes'), musicas: values.getAll('musicas')
  });
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
  document.querySelectorAll('.leader').forEach(el => { el.hidden = !leader; });
  document.querySelectorAll('[data-tab]').forEach(el => { el.onclick = () => tab(el.dataset.tab); });
  const own = await load();
  const refreshChat = () => {
    if (!document.hidden && !byId('chat').hidden) {
      refreshChatChoices();
      loadChat().catch(error => notify(error.message));
    }
  };
  byId('chat').querySelector('form').hidden = true;
  document.querySelector('[data-tab="chat"]').addEventListener('click', refreshChat);
  document.addEventListener('visibilitychange', refreshChat);
  setInterval(refreshChat, 5000);
  tab(!leader && !own?.data_nascimento ? 'profile' : 'scales');
  byId('app').hidden = false;
  notify('');
}
start().catch(e => notify(e.message));
