# Spec: notifications — V1

Convenções comuns: ver `capability-map.md`. Depende de: scheduling, repertoire.

## Objective
Garantir que ninguém perca nada: o push é o canal principal, a central de notificações é o histórico e o feed `.ics` é a segunda camada.

## Arquitetura
1. **Gatilhos de evento** (escalado, troca, repertório publicado, cancelamento): inserem em `notificacoes` na mesma transação.
2. **Lembretes agendados**: `pg_cron` roda a cada poucos minutos, avalia as políticas e materializa lembretes devidos em `notificacoes`. Chave única (destinatário, evento, tipo de lembrete) garante idempotência.
3. **Dispatcher**: `pg_cron` + `pg_net` chama uma Edge Function que envia os pendentes por Web Push (VAPID), registra o resultado e remove assinaturas com resposta 404/410.
4. **Central**: toda notificação aparece na caixa de entrada do usuário (lida/não lida), com ou sem push entregue.

## Políticas
- Definidas **por tipo de evento** (culto fixo x extra), com prazos configuráveis pelos líderes.
- Lembretes de integrante (propostas): ao ser escalado; D-3 sem ação; véspera com repertório; 2 h antes com horário de chegada; extras recebem um lembrete a mais.
- Lembretes de líder: evento incompleto, repertório devido N dias antes, vaga sem pessoa, troca sem aceite, voluntário novo.
- **Preferências do usuário**: silenciar por categoria; frequência dentro dos limites das políticas.

## iOS e Android
- iOS: push só funciona com o app na Tela de Início (16.4+); a permissão só pode ser pedida após um toque e, se negada, não volta a ser pedida. O onboarding explica o valor antes de pedir.
- Detectar dispositivo e estado (instalado, permissão, assinatura válida) e mostrar o próximo passo.
- Quem não tem push ativo continua vendo tudo na central e no feed `.ics`.

## Dados
`politicas_notificacao`, `preferencias_notificacao`, `notificacoes`, `push_assinaturas`.

## Success Criteria
- Push entregue em até 2 min; lembretes em até 5 min do horário previsto.
- Rodar o job de lembretes duas vezes não duplica notificações (teste).
- Assinatura inválida é removida na primeira falha 404/410.
- Teste manual em iPhone (Tela de Início) e Android (Chrome).

## Out of Scope (Deferred)
- WhatsApp, SMS e e-mail como canal de aviso: custo e complexidade.
- Agrupamento inteligente (digest): só se houver fadiga de notificação.

## Open Questions
- Biblioteca de Web Push no Deno (`@negrel/webpush` ou `@pushforge/builder`): decidir em um spike.
- Políticas padrão por tipo de evento e frequência máxima diária por usuário.
