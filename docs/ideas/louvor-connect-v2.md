# Louvor Connect v2

## Problem Statement
Como fazer cada integrante de banda, som e mídia saber, sem perguntar a ninguém, onde estar, quando, fazendo o quê e com qual repertório, e dar aos líderes visibilidade de quem pode servir, a custo zero e sem depender do WhatsApp?

## Recommended Direction
Um **PWA instalável** que é a fonte única de verdade de todos os eventos do ministério (cultos fixos, cultos extras, ensaios e eventos), com **notificações como canal principal**. O grupo de WhatsApp volta a ser só conversa entre os membros.

Três pilares, entregues juntos no lançamento:

1. **Agenda e escala.** Home no estilo "Schedule" do Google Agenda, mostrando os eventos do usuário, com opção de ver todos. O líder escala; o integrante está confirmado até dizer "Não posso" (lógica atual mantida). Quem marcou indisponibilidade não pode ser escalado. "Não posso" abre automaticamente um pedido de troca para quem tem a mesma função e está livre, tirando o líder do caminho crítico.
2. **Motor de notificações.** Push mais central de notificações com histórico. Políticas por tipo de evento (cultos fixos x extras) com prazos configuráveis, lembretes para integrantes e para líderes (por exemplo, repertório definido com N dias de antecedência). Feed `.ics` como segunda camada.
3. **Repertório com memória.** Cada música guarda quando foi tocada, em que evento, em que tom e quem ministrou. Ao montar o repertório de um evento, é possível pesquisar o que já tocamos.

Referências de produto: Google Agenda (visão Schedule) e ChurchTools (planejamento de cultos, ausências, banco de músicas).

## Key Assumptions to Validate
- [ ] Metade dos membros usa iPhone e vai instalar o PWA e ativar o push. Teste: piloto com 5 pessoas (pelo menos 2 iPhones) durante o desenvolvimento.
- [ ] "Confirmado até dizer o contrário" funciona sem confirmação explícita, usando o status passivo "visto" para dar visibilidade ao líder. Teste: observar o primeiro mês.
- [ ] Os líderes mantêm o repertório no app dentro do prazo. Teste: percentual de eventos com repertório definido antes do prazo da política.
- [ ] Os planos gratuitos bastam para ~30 usuários. Teste: monitorar uso do banco, das Edge Functions e do envio de e-mail.

## MVP Scope
Dentro (lançamento único):
- Login por e-mail e senha, cadastro somente por convite, papéis líder e integrante (auxiliar é apenas um título).
- Funções por frente (banda, som, mídia); um integrante pode ter várias.
- Eventos fixos recorrentes (gerados com antecedência) e extras; criação incompleta, preenchida depois.
- Escala por vaga/função, indisponibilidade com bloqueio no banco, status "visto", voluntariado e troca.
- Banco de músicas, repertório por evento, histórico de uso e busca; link de referência (YouTube/Spotify) com player embutido.
- Push, central de notificações, políticas por tipo de evento e preferências do usuário.
- Feed `.ics` por usuário e link "Adicionar ao Google Agenda".
- Onboarding guiado de instalação para iOS e Android.

Fora: ver "Not Doing".

## Not Doing (and Why)
- **Chat no app**: o WhatsApp mantém o papel social.
- **Sincronização bidirecional com Google Agenda (OAuth)**: o feed `.ics` e o link de adicionar cobrem a maior parte do valor, sem verificação do Google.
- **Cifras e letras via scraping**: não há API oficial, é frágil e envolve direitos autorais. Guardamos tom e link.
- **API de busca do YouTube/Spotify**: o link colado já resolve, sem chaves nem cotas.
- **WhatsApp API, SMS, apps nativos nas lojas**: custo e complexidade sem ganho proporcional agora.
- **Modo palco, chamada de presença, avisos de aniversário**: entram depois, sobre o motor de notificações.
- **Tema claro**: identidade escura apenas.

## Open Questions
1. Horário de chegada padrão (proposta: 60 min antes). Cultos fixos definidos: quarta 18:00, domingo 09:00 e 18:00.
2. Validar os padrões de notificação (spec de notifications) depois do piloto.
3. Abordagem de estilos (proposta: CSS Modules com tokens em CSS custom properties).
4. O que acontece com o protótipo atual e como será a virada de produção.

Resolvidas: ambiente de desenvolvimento e pré-visualização (ver `setup-ambiente.md`).
