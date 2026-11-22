'use strict';
const byId = id => document.getElementById(id);
const notify = message => { byId('status').textContent = message; };
const cfg = window.LOUVOR_SUPABASE;
const api = window.supabase?.createClient(cfg.url, cfg.publishableKey);
let user;
let leader = false;
let members = [], songs = [], scales = [];
const finalizacoes = new Map();
const controlesCulto = [];
let finalizacaoDisponivel = false;
const cultoIniciado = (scale, now = Date.now()) => Date.parse(scale.inicio) <= now;
const chatAberto = (scale, now = Date.now()) =>
  Boolean(!finalizacoes.has(scale.id) && scale.termino && cultoIniciado(scale, now) && now < Date.parse(scale.termino));
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
    const active = button.dataset.tab === id && (!button.classList.contains('leader') || leader);
    byId(button.dataset.tab).hidden = !active;
    button.setAttribute('aria-pressed', active);
  }
}
function renderOverview() {
  byId('overviewScales').textContent = scales.length;
  byId('overviewMembers').textContent = members.length;
  byId('overviewSongs').textContent = songs.length;

  const now = Date.now();
  const next = scales.find(scale => !finalizacoes.has(scale.id) && (
    !cultoIniciado(scale, now) || chatAberto(scale, now)
  ));
  const description = byId('overviewNext');
  const view = byId('overviewScale');
  description.textContent = next
    ? next.titulo + ' · ' + new Date(next.inicio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : 'Nenhum culto ou ensaio agendado.';
  view.hidden = !next;
  view.onclick = next ? () => {
    tab('scales');
    const heading = byId('scale-' + next.id).querySelector('h3');
    heading.tabIndex = -1;
    heading.focus();
  } : null;
}

function bindOverview() {
  document.querySelectorAll('[data-open]').forEach(button => {
    button.onclick = () => {
      tab(button.dataset.open);
      document.querySelector('[data-tab="' + button.dataset.open + '"]').focus();
    };
  });
  byId('overviewCreate').onclick = () => {
    tab('scales');
    const form = byId('scaleForm');
    form.reset();
    form.closest('details').open = true;
    form.elements.titulo.focus();
  };
  byId('overviewInvite').onclick = () => {
    tab('members');
    byId('inviteForm').elements.email.focus();
  };
  byId('overviewChat').onclick = () => {
    const chatTab = document.querySelector('[data-tab="chat"]');
    chatTab.click();
    chatTab.focus();
  };
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
function preencherSeletor(select, rows, placeholder, describe) {
  const selected = select.value;
  const first = node('option', placeholder);
  first.value = '';
  select.replaceChildren(first);
  for (const row of rows) {
    const option = node('option', describe(row));
    option.value = row.id;
    select.append(option);
  }
  if (rows.some(row => row.id === selected)) select.value = selected;
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
    const adicionar = byId('addMemberForm');
    preencherSeletor(adicionar.elements.integrante, members, 'Selecione um integrante', member => member.nome_completo);
    preencherSeletor(adicionar.elements.escala, scales, 'Selecione uma escala', scale =>
      scale.titulo + ' — ' + new Date(scale.inicio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }));
    adicionar.querySelector('button').disabled = !members.length || !scales.length;
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
  await atualizarFinalizacoes();
  controlesCulto.length = 0;
  cards('scaleList', scales, leader ? 'Nenhuma escala cadastrada.' : 'Você ainda não tem escalas.', (scale, card) => {
    card.id = 'scale-' + scale.id;
    const date = new Date(scale.inicio);
    const titles = scale.musicas.map(id => songs.find(s => s.id === id)?.titulo).filter(Boolean);
    const names = scale.integrantes.map(id => members.find(m => m.id === id)?.nome_completo).filter(Boolean);
    card.append(node('h3',scale.titulo),node('p',date.toLocaleString('pt-BR')),
      node('p',[leader ? names.join(', ') : '',titles.join(' • '),scale.notas].filter(Boolean).join('\n')));
    montarControlesCulto(scale, card);
    editButton(card, () => edit(byId('scaleForm'), { ...scale,
      inicio: localInputValue(scale.inicio), termino: localInputValue(scale.termino) }));
  });
  if (leader) renderOverview();
  refreshChatChoices();
  return own;
}
async function atualizarFinalizacoes() {
  if (!scales.length) return;
  const { data, error } = await api.from('cultos_finalizados').select('escala_id,finalizado_em')
    .in('escala_id', scales.map(scale => scale.id));
  if (error) return;
  finalizacaoDisponivel = true;
  for (const item of data) finalizacoes.set(item.escala_id, item.finalizado_em);
}

function montarControlesCulto(scale, card) {
  const openChat = node('button', 'Abrir chat do culto');
  openChat.onclick = () => {
    refreshChatChoices();
    tab('chat');
    byId('chatScale').value = scale.id;
    loadChat().catch(error => notify(error.message));
  };
  const estado = node('p');
  estado.setAttribute('role', 'status');
  card.append(estado, openChat);
  const chamada = node('details');
  const lista = node('div');
  chamada.append(node('summary', 'Chamada de presença'), lista);
  const finalizar = node('button', 'Finalizar culto');
  finalizar.type = 'button';
  if (leader) card.append(chamada, finalizar);
  let ocupada = false;

  const atualizar = () => {
    const encerrado = finalizacoes.has(scale.id);
    const iniciado = cultoIniciado(scale);
    openChat.hidden = !chatAcessivel(scale);
    openChat.textContent = encerrado ? 'Ver histórico do chat' : 'Abrir chat do culto';
    chamada.hidden = !finalizacaoDisponivel || !iniciado;
    finalizar.hidden = !finalizacaoDisponivel || !iniciado || encerrado;
    finalizar.disabled = ocupada;
    const texto = encerrado ? 'Culto finalizado.'
      : leader && iniciado && finalizacaoDisponivel
        ? (scale.termino && Date.now() >= Date.parse(scale.termino)
            ? 'Horário encerrado. Aguardando finalização do líder.'
            : 'Culto iniciado. Chamada de presença disponível.')
        : '';
    if (estado.textContent !== texto) estado.textContent = texto;
    estado.hidden = !texto;
    for (const seletor of lista.querySelectorAll('select')) seletor.disabled = encerrado || ocupada;
  };

  chamada.addEventListener('toggle', async () => {
    if (!chamada.open) return;
    lista.textContent = 'Carregando chamada…';
    try {
      const { data, error } = await api.from('chamada_culto').select('integrante_id,presente').eq('escala_id', scale.id);
      if (error) throw error;
      const registros = new Map(data.map(item => [item.integrante_id, item.presente]));
      lista.replaceChildren();
      if (!scale.integrantes.length) lista.textContent = 'Nenhum integrante escalado.';
      for (const id of new Set(scale.integrantes)) {
        const nome = members.find(member => member.id === id)?.nome_completo || 'Integrante';
        const label = node('label', nome);
        const seletor = node('select');
        for (const [value, text] of [['', 'Sem registro'], ['sim', 'Presente'], ['nao', 'Ausente']]) {
          const option = node('option', text);
          option.value = value;
          option.disabled = value === '';
          seletor.append(option);
        }
        seletor.value = registros.has(id) ? (registros.get(id) ? 'sim' : 'nao') : '';
        seletor.onchange = async () => {
          const compareceu = seletor.value === 'sim';
          ocupada = true;
          atualizar();
          try {
            const { error } = await api.rpc('registrar_chamada_culto', { escala: scale.id, integrante: id, compareceu });
            if (error) throw error;
            registros.set(id, compareceu);
            notify('Presença registrada.');
          } catch {
            seletor.value = registros.has(id) ? (registros.get(id) ? 'sim' : 'nao') : '';
            notify('Não foi possível registrar a presença. Verifique se a chamada ainda está aberta.');
          } finally {
            ocupada = false;
            atualizar();
          }
        };
        label.append(seletor);
        lista.append(label);
      }
      atualizar();
    } catch {
      lista.textContent = 'Não foi possível carregar a chamada. Feche e abra para tentar novamente.';
    }
  });

  finalizar.onclick = async () => {
    if (!window.confirm('Finalizar este culto? A chamada e o envio de mensagens serão encerrados.')) return;
    ocupada = true;
    atualizar();
    try {
      const { data, error } = await api.rpc('finalizar_culto', { escala: scale.id });
      if (error) throw error;
      finalizacoes.set(scale.id, data);
      refreshChatChoices();
      notify('Culto finalizado. O histórico permanece disponível para o líder.');
    } catch {
      notify('Não foi possível finalizar o culto. Tente novamente.');
    } finally {
      ocupada = false;
      atualizar();
    }
  };

  atualizar();
  controlesCulto.push(atualizar);
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
async function adicionarIntegrante(escala, integrante) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await api.from('escalas').select('integrantes').eq('id', escala).single();
    if (error) throw Error('Não foi possível consultar a escala.');
    const atuais = data.integrantes;
    if (atuais.includes(integrante)) return false;

    const updated = await api.from('escalas').update({ integrantes: [...atuais, integrante] })
      .eq('id', escala).eq('integrantes', '{' + atuais.join(',') + '}').select('id').maybeSingle();
    if (updated.error) throw Error('Não foi possível adicionar o integrante.');
    if (updated.data) return true;
  }
  throw Error('A escala foi alterada ao mesmo tempo por outra pessoa. Tente novamente.');
}

submit('addMemberForm', async (form, values) => {
  const integrante = values.get('integrante');
  const escala = values.get('escala');
  if (!leader || !members.some(member => member.id === integrante) || !scales.some(item => item.id === escala)) {
    throw Error('Selecione um integrante cadastrado e uma escala.');
  }
  if (!await adicionarIntegrante(escala, integrante)) return 'Este integrante já está na escala.';
  form.reset();
  try {
    await load();
  } catch {
    return 'Integrante adicionado. Atualize a página para conferir a escala.';
  }
  return 'Integrante adicionado à escala.';
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

function searchCatalog(term) {
  return new Promise((resolve, reject) => {
    const frame = node('iframe');
    frame.hidden = true;
    frame.title = 'Busca no catálogo da Apple';
    frame.setAttribute('sandbox', 'allow-scripts');
    const url = new URL('https://itunes.apple.com/search');
    url.search = new URLSearchParams({ term, country: 'BR', entity: 'song', limit: '12', callback: 'catalogResponse' });
    const finish = (callback, value) => {
      clearTimeout(timer);
      window.removeEventListener('message', receive);
      frame.remove();
      callback(value);
    };
    const receive = event => {
      if (event.source !== frame.contentWindow || event.data?.type !== 'song-catalog') return;
      if (Array.isArray(event.data.results)) finish(resolve, event.data.results);
      else finish(reject, Error('Catálogo indisponível'));
    };
    const timer = setTimeout(() => finish(reject, Error('Tempo de busca esgotado')), 12000);
    window.addEventListener('message', receive);
    frame.srcdoc = '<script>function catalogResponse(data){parent.postMessage({type:"song-catalog",results:data.results},"*")}</script>' +
      '<script src="' + url.href.replaceAll('&', '&amp;') + '"></script>';
    document.body.append(frame);
  });
}

function initSongCatalog() {
  const catalog = byId('songCatalog');
  const form = byId('catalogForm');
  const status = byId('catalogStatus');
  const results = byId('catalogResults');
  const searchButton = form.querySelector('button');
  const removePlayer = () => results.querySelector('iframe')?.remove();
  catalog.addEventListener('toggle', () => { if (!catalog.open) removePlayer(); });
  document.querySelectorAll('[data-tab]').forEach(button => {
    if (button.dataset.tab !== 'songs') button.addEventListener('click', removePlayer);
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const term = form.elements.query.value.trim();
    if (term.length < 2 || searchButton.disabled) return;
    searchButton.disabled = true;
    status.textContent = 'Buscando músicas…';
    results.replaceChildren();
    try {
      const tracks = (await searchCatalog(term)).filter(track =>
        typeof track?.trackName === 'string' && typeof track.artistName === 'string' &&
        Number.isSafeInteger(track.trackId) && Number.isSafeInteger(track.collectionId));
      status.textContent = tracks.length ? '' : 'Nenhuma música encontrada. Tente buscar pelo título e pelo artista.';
      for (const track of tracks) {
        const card = node('article');
        const actions = node('div');
        actions.className = 'actions';
        const play = node('button', '▶ Ouvir prévia');
        play.type = 'button';
        play.onclick = () => {
          removePlayer();
          const player = node('iframe');
          player.className = 'catalog-player';
          player.title = 'Prévia de ' + track.trackName;
          player.src = 'https://embed.music.apple.com/br/album/' + track.collectionId + '?i=' + track.trackId;
          player.allow = 'autoplay *; encrypted-media *';
          card.append(player);
        };
        actions.append(play);
        if (leader) {
          const use = node('button', 'Usar no cadastro');
          use.type = 'button';
          use.onclick = () => {
            const song = byId('songForm');
            song.elements.titulo.value = track.trackName.slice(0, 180);
            song.elements.artista.value = track.artistName;
            catalog.open = false;
            song.closest('details').open = true;
            song.elements.titulo.focus();
          };
          actions.append(use);
        }
        card.append(node('h3', track.trackName), node('p', track.artistName), actions);
        results.append(card);
      }
    } catch {
      status.textContent = 'Não foi possível buscar músicas agora. Tente novamente em instantes.';
    } finally {
      searchButton.disabled = false;
    }
  });
}

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
  if (leader) bindOverview();
  initSongCatalog();
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
  let consultandoCulto = false;
  setInterval(async () => {
    if (document.hidden || consultandoCulto) return;
    consultandoCulto = true;
    try {
      if (finalizacaoDisponivel) await atualizarFinalizacoes();
      for (const atualizar of controlesCulto) atualizar();
      if (leader && !byId('overview').hidden) renderOverview();
      refreshChat();
    } catch {
      refreshChat();
    } finally {
      consultandoCulto = false;
    }
  }, 5000);
  tab(leader ? 'overview' : own?.data_nascimento ? 'scales' : 'profile');
  byId('app').hidden = false;
  notify('');
}
start().catch(e => notify(e.message));
