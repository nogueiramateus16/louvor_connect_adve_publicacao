# Spec: repertoire — V1

Convenções comuns: ver `capability-map.md`. Depende de: events.

## Objective
Dar previsibilidade e memória ao repertório: o que foi tocado, quando, em que tom e por quem, acessível por evento e no geral.

## Requisitos
- **Banco de músicas**: título, artista, tom padrão, link da cifra, link de referência (YouTube ou Spotify), observações.
- **Player de referência**: link colado e embutido via embed/oEmbed, sem chave de API. Só aceita hosts conhecidos; demais viram link externo.
- **Repertório por evento**: lista ordenada, com tom e observação específicos do evento e quem ministra a música.
- **Histórico de uso**: cada música mostra quando foi tocada, em qual evento, em que tom e quem ministrou; destaque para "última vez há N semanas".
- **Busca ao montar o repertório**: pesquisar músicas já tocadas (por título, artista, tom, período e frequência).
- Músicas em aprendizado podem ser marcadas como tal.
- Publicar o repertório dispara notificação aos escalados.

## Dados
`musicas`, `setlist_itens` (evento_id, musica_id, ordem, tom, ministro_id, notas). O histórico é derivado de `setlist_itens` de eventos **realizados** (início no passado e status diferente de cancelado), sem tabela própria. Evento cancelado ou arquivado não conta como "tocado".

## Success Criteria
- Em um evento, achar e adicionar uma música já tocada em até 3 toques.
- Histórico de uma música carrega em menos de 1 s com 2 anos de dados.
- Links fora da lista de hosts permitidos nunca viram iframe.

## Out of Scope (Deferred)
- Cifras e letras embutidas, transposição: avaliar ChordPro colado depois.
- Busca no catálogo do YouTube/Spotify: exige chaves e cotas.

## Open Questions
- Quem pode editar o banco de músicas (todos os líderes; integrantes só sugerem?).
