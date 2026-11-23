# Spec: people — V1

Convenções comuns: ver `capability-map.md`. Depende de: identity.

## Objective
Representar as funções do ministério e quem exerce cada uma. Um integrante pode ter várias funções (por exemplo, voz, violão e mídia).

## Requisitos
- Funções agrupadas por **frente**: banda (vocal, teclado, violão, guitarra, baixo, bateria, etc.), som e mídia.
- Líderes criam e editam funções; o catálogo inicial é semeado por migration.
- Vínculo pessoa x função com nível opcional (principal ou reserva), usado para sugerir substitutos.
- Lista de integrantes filtrável por função e frente.

## Dados
`funcoes` (id, nome, frente), `perfil_funcoes` (perfil_id, funcao_id, nivel).

## Success Criteria
- Dado um evento e uma função, o app lista os integrantes habilitados naquela função.
- A mesma pessoa pode ocupar funções diferentes em eventos diferentes.

## Out of Scope (Deferred)
- Avaliação de habilidade e certificações: sem necessidade operacional.

## Open Questions
- Catálogo final de funções de som e mídia.
