# Spec: app-shell — V1

Convenções comuns: ver `capability-map.md`. Depende de: identity.

## Objective
Entregar a experiência instalável, rápida e simples de usar no celular. Adoção dos membros é o critério essencial do projeto.

## Requisitos
- **PWA**: manifesto, ícones, `display: standalone`, service worker (`injectManifest`) com cache do shell e tratamento de `push` e `notificationclick`; atualização do app sem prender o usuário em versão antiga.
- **Onboarding de instalação**: detectar iOS/Android/desktop e estado (instalado ou não). No iOS, guiar Compartilhar > Adicionar à Tela de Início e reabrir pelo ícone; no Android, usar o prompt de instalação. Depois, pedir permissão de notificação com explicação prévia.
- **Navegação mobile-first**: barra inferior com até 5 destinos (Agenda, Repertório, Notificações, Eu; Gestão para líderes). Deep links para evento, troca e notificação.
- **Home = Agenda** no estilo Schedule: lista cronológica agrupada por dia, com os meus eventos em destaque e alternância para ver todos. Card do evento reúne horário de chegada, função, equipe, repertório com tom, links e observações.
- **Design**: apenas tema escuro (preto puro, grafite, verde petróleo discreto). Tokens em CSS custom properties. Alvos de toque ≥ 44 px, foco visível, contraste ≥ 4,5:1, respeita `prefers-reduced-motion`. Definição visual detalhada em fase própria de design.
- Funciona offline para leitura da última agenda carregada.

## Success Criteria
- Lighthouse PWA instalável; app abre em modo standalone no iOS e no Android.
- Tarefas principais (ver minha próxima escala, marcar indisponibilidade, aceitar troca) em até 3 toques a partir da Home.
- Onboarding concluído sem ajuda por um membro de teste em cada plataforma.

## Out of Scope (Deferred)
- Tema claro.
- Publicação nas lojas de aplicativos.

## Open Questions
- Estilo visual final (referências: Google Agenda Schedule e ChurchTools), a definir na fase de design.
- Nenhuma pendência de hospedagem: ver `docs/setup-ambiente.md` (desenvolvimento local, pré-visualização HTTPS e testes em aparelho real).
