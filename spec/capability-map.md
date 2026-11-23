# Capability Map: Louvor Connect v2

| Module id | Responsibility | Depends on |
|---|---|---|
| identity | Autenticação, convites, perfis, papéis (líder/integrante), título "auxiliar" | n/a |
| people | Funções por frente (banda/som/mídia), vínculo pessoa x função | identity |
| events | Tipos de evento, modelos recorrentes e gerador, eventos, completude | identity |
| scheduling | Vagas por função, escalações, indisponibilidade (bloqueio), visto, voluntariado, trocas | people, events |
| repertoire | Músicas, links/embeds, repertório por evento, histórico de uso, busca | events |
| notifications | Políticas, preferências, caixa de entrada, assinaturas push, dispatcher, lembretes | scheduling, repertoire |
| calendar-feed | Feed ICS por usuário, link "Adicionar ao Google Agenda" | scheduling |
| app-shell | PWA, service worker, onboarding de instalação, navegação, tokens de design | identity |

Build order: identity → people, events, app-shell → scheduling → repertoire → notifications → calendar-feed

Specs por módulo: `SPEC-<module-id>.md` neste diretório.

## Convenções comuns (valem para todos os módulos)

### Tech Stack
React + Vite + TypeScript, `vite-plugin-pwa` (estratégia `injectManifest`), `@supabase/supabase-js` v2 com tipos gerados do schema, Supabase (Postgres, Auth, Edge Functions em Deno, `pg_cron`, `pg_net`). Estilos: CSS Modules com tokens em CSS custom properties (a confirmar). Tema escuro apenas: preto puro, grafite e verde petróleo discreto.

### Commands
```
Dev:       npm run dev
Build:     npm run build
Preview:   npm run preview
Lint:      npm run lint
Tipos:     npm run typecheck
Testes:    npm test
Tipos DB:  npx supabase gen types typescript --linked > src/lib/database.types.ts
Migrations: npx supabase db push
Functions: npx supabase functions deploy <nome>
```

### Project Structure
```
src/app/            → rotas, layout, providers
src/features/<id>/  → um diretório por módulo (components, hooks, api)
src/lib/            → cliente Supabase, tipos gerados, utilidades de data (America/Sao_Paulo)
src/sw.ts           → service worker (push, notificationclick, cache)
supabase/migrations → SQL versionado, uma migration por mudança
supabase/functions  → Edge Functions (convites, dispatcher, feed ICS)
supabase/tests      → testes pgTAP (RLS e regras)
docs/  spec/        → documentação pública do produto
```

### Code Style
Português (pt-BR) para texto de interface e nomes de tabelas/colunas; inglês para código genérico de infraestrutura. Datas sempre `timestamptz` no banco, exibidas em `America/Sao_Paulo`. Sem `innerHTML` com dado de usuário.

```ts
// Exemplo: leitura tipada com RLS fazendo o controle de acesso
const { data, error } = await supabase
  .from('escalacoes')
  .select('id, status, eventos(titulo, inicio)')
  .eq('perfil_id', userId)
  .order('eventos(inicio)')
if (error) throw new Error('Não foi possível carregar a agenda.')
```

### Testing Strategy
- **Banco (pgTAP):** RLS de toda tabela, bloqueio de escala sobre indisponibilidade, idempotência de lembretes.
- **Unidade (Vitest):** regras puras (geração de recorrência, janelas de política, transposição de datas).
- **Componentes (Testing Library):** agenda, formulário de indisponibilidade, central de notificações.
- **Dispositivo real:** instalação e push em iOS 16.4+ (Tela de Início) e Android (Chrome). Obrigatório antes do lançamento.

### Boundaries
- **Always:** RLS habilitada em toda tabela; escritas privilegiadas por RPC `security definer` com `search_path = ''`; migrations em `begin; ... commit;`; validar entrada no banco e na Edge Function.
- **Ask first:** novas dependências, mudança de schema já aplicado, mudança de política de notificação padrão, qualquer coisa que gere custo.
- **Never:** commitar segredos (chave privada VAPID, service role, senha de app); expor dados pessoais de membros em `docs/` e `spec/`; abrir cadastro público.

## Esboço do modelo de dados
`perfis`, `funcoes`, `perfil_funcoes`, `tipos_evento`, `modelos_recorrentes`, `eventos`, `escalacoes` (vaga + pessoa + status + `visto_em`), `indisponibilidades`, `voluntariados`, `trocas`, `musicas`, `setlist_itens`, `politicas_notificacao`, `preferencias_notificacao`, `notificacoes`, `push_assinaturas`, `calendario_tokens`.

## Critérios de sucesso do produto
- ≥ 90% dos membros ativos com assinatura push válida 4 semanas após o lançamento.
- Push entregue em até 2 min do gatilho; lembretes disparados em até 5 min do horário previsto.
- Escalar alguém sobre uma indisponibilidade é rejeitado pelo banco (teste pgTAP).
- App instalável com push funcionando no iOS 16.4+ (Tela de Início) e no Android (Chrome).
- ≥ 90% dos eventos com repertório definido dentro do prazo da política.
