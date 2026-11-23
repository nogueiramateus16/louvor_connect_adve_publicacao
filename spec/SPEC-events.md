# Spec: events — V1

Convenções comuns: ver `capability-map.md`. Depende de: identity.

## Objective
Cadastrar os eventos do ministério e mantê-los sempre à frente no calendário, sem trabalho manual para os cultos fixos.

## Requisitos
- **Tipos de evento**: culto fixo (quarta à noite, domingo de manhã, domingo à noite) e culto extra/ensaio/evento. O tipo define a política de notificação aplicada.
- **Modelos recorrentes**: dia da semana, horário e vagas padrão. Um job gera os eventos com N semanas de antecedência (idempotente).
- Evento pode ser criado **incompleto** (sem equipe nem repertório) e preenchido depois.
- Campos: título, tipo, início, término, horário de chegada, local, observações, evento geral da igreja (visível a todos, sem escala).
- Indicador de **completude** (equipe e repertório definidos) e prazo vindo da política do tipo.
- Cancelar ou remarcar notifica quem está escalado.

## Dados
`tipos_evento`, `modelos_recorrentes`, `eventos`.

## Success Criteria
- Os cultos fixos das próximas semanas existem sem intervenção.
- Rodar o gerador duas vezes não duplica eventos (teste).
- Líder vê quais eventos estão incompletos e há quantos dias.

## Out of Scope (Deferred)
- Eventos recorrentes com exceções complexas: tratar caso a caso editando o evento.

## Open Questions
- Horários exatos dos cultos fixos e horário padrão de chegada.
- Quantas semanas gerar à frente (proposta: 8).
