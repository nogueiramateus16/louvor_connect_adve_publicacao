# Spec: calendar-feed — V1

Convenções comuns: ver `capability-map.md`. Depende de: scheduling.

## Objective
Levar a escala para a agenda nativa do celular (Google Agenda, Apple Calendar), com alarmes do próprio sistema, sem OAuth.

## Requisitos
- **Feed ICS por usuário**: Edge Function pública, autenticada por token secreto na URL (`calendario_tokens`), entrega os eventos em que a pessoa está escalada. O usuário assina por `webcal://`.
- Token regenerável e revogável pelo próprio usuário; cada acesso atualiza `ultimo_acesso`.
- **Link "Adicionar ao Google Agenda"** por evento (instantâneo, uma vez).
- UIDs estáveis por evento, para que remarcações atualizem em vez de duplicar. Cancelamentos saem como `STATUS:CANCELLED`.
- O feed é segunda camada: o Google Agenda atualiza assinaturas com atraso de horas, então mudanças urgentes continuam via push.

## Dados
`calendario_tokens` (perfil_id, token_hash, criado_em, ultimo_acesso, revogado_em). Guardar apenas o hash do token.

## Success Criteria
- Assinar o feed no Google Agenda e no Apple Calendar mostra os eventos corretos com fuso `America/Sao_Paulo`.
- Token revogado retorna 404 imediatamente.
- Feed de um usuário nunca contém eventos de outro.

## Out of Scope (Deferred)
- Sincronização bidirecional com Google Agenda (OAuth): exige verificação do app.

## Open Questions
- Incluir no feed também eventos gerais em que a pessoa não está escalada (opção do usuário)?
