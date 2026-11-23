# Spec: events — V1

Convenções comuns: ver `capability-map.md`. Depende de: identity.

## Objective
Cadastrar os eventos do ministério e mantê-los sempre à frente no calendário, sem trabalho manual para os cultos fixos.

## Requisitos
- **Tipos de evento**: culto fixo (quarta à noite, domingo de manhã, domingo à noite) e culto extra/ensaio/evento. O tipo define a política de notificação aplicada.
- **Modelos recorrentes**: dia da semana, horário e vagas padrão. Um job gera os eventos com N semanas de antecedência (idempotente).
- **Cultos fixos (padrão inicial, editável):** quarta 18:00, domingo 09:00 e domingo 18:00. Horário de chegada padrão: 60 min antes do início (a confirmar).
- **Alterar, cancelar e excluir** (somente líderes): qualquer evento pode ter horário, local e vagas alterados. *Cancelar* mantém o evento visível como cancelado e notifica os escalados. *Excluir* é exclusão lógica (arquivado): some das listas, notifica os escalados se for futuro e nunca apaga o histórico de repertório de eventos já realizados.
- **Editar recorrência:** "só este evento" ou "este e os próximos" (altera o modelo). Ocorrências editadas manualmente (`modificado_manualmente`) não são sobrescritas quando o modelo muda.
- Evento pode ser criado **incompleto** (sem equipe nem repertório) e preenchido depois.
- Campos: título, tipo, início, término, horário de chegada, local, observações, evento geral da igreja (visível a todos, sem escala).
- Indicador de **completude** (equipe e repertório definidos) e prazo vindo da política do tipo.
- Cancelar ou remarcar notifica quem está escalado.

## Dados
`tipos_evento`, `modelos_recorrentes`, `eventos` (inclui `status`: ativo/cancelado, `arquivado_em`, `modificado_manualmente`).

## Success Criteria
- Os cultos fixos das próximas semanas existem sem intervenção.
- Rodar o gerador duas vezes não duplica eventos (teste).
- Líder vê quais eventos estão incompletos e há quantos dias.

## Out of Scope (Deferred)
- Eventos recorrentes com exceções complexas: tratar caso a caso editando o evento.

## Open Questions
- Confirmar a interpretação dos horários fixos (quarta 18:00, domingo 09:00 e 18:00) e o horário de chegada padrão de 60 min.
- Quantas semanas gerar à frente (proposta: 8).
