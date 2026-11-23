# Spec: scheduling — V1

Convenções comuns: ver `capability-map.md`. Depende de: people, events.

## Objective
Montar a escala com o mínimo de atrito, respeitando a disponibilidade, e resolver ausências sem depender do líder.

## Regras de negócio
1. **Vagas por função**: cada evento tem vagas (função x quantidade). A escalação liga uma pessoa a uma vaga.
2. **Confirmado por padrão (opt-out)**: ao ser escalado, o integrante está confirmado até dizer "Não posso".
3. **Indisponibilidade bloqueia**: o banco rejeita escalar quem marcou indisponibilidade que cobre o evento. A interface do líder já mostra quem está livre por função.
4. **Visto**: `visto_em` registra, de forma passiva, quando o integrante abriu a escala. O líder vê quem ainda não viu.
5. **"Não posso" = pedido de troca**: abre uma troca, notifica integrantes da mesma função que estão livres; o primeiro a aceitar assume a vaga. Sem aceite até o prazo da política, escala para os líderes.
6. **Voluntariado**: o integrante se oferece para um evento em que não foi escalado; os líderes são notificados e decidem.
7. **Indisponibilidade por período**: o integrante marca datas ou intervalos com motivo opcional. Marcar indisponibilidade sobre um evento em que já está escalado aciona a regra 5.

## Dados
`escalacoes` (evento_id, funcao_id, perfil_id, status, visto_em), `indisponibilidades` (perfil_id, inicio, fim, motivo), `voluntariados`, `trocas` (escalacao_id, status, aceito_por, prazo).

## Success Criteria
- Teste pgTAP: inserir escalação sobre indisponibilidade falha.
- Aceite concorrente de uma troca por duas pessoas: exatamente uma vence.
- Líder identifica em uma tela as vagas em aberto e quem não viu a escala.

## Out of Scope (Deferred)
- Sugestão automática de escala por rodízio: avaliar depois de ter histórico.
- Aprovação do líder em cada troca: a troca é automática; o líder só é acionado se ninguém aceitar.

## Open Questions
- Prazo padrão para aceitar uma troca e antecedência mínima para pedir.
