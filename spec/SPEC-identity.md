# Spec: identity — V1

Convenções comuns: ver `capability-map.md`.

## Objective
Controlar quem entra no app e o que cada pessoa pode fazer. Cadastro somente por convite de um líder.

## Requisitos
- Login por e-mail e senha. Cadastro público desativado.
- Convite: Edge Function gera link individual (`generateLink`, tipo `invite`); o líder compartilha por WhatsApp ou e-mail. O convidado preenche o cadastro e cria a senha.
- Recuperação de senha por e-mail (SMTP próprio, ver Open Questions).
- Papéis: **líder** e **integrante**. "Auxiliar" é apenas um título exibido, sem permissão extra.
- Perfil: nome, telefone, data de nascimento, foto opcional, título opcional.
- Senha mínima de 12 caracteres.
- Todo líder gerencia tudo (eventos, escalas, repertório, convites).

## Dados
`perfis` (id = auth uid, nome, telefone, nascimento, titulo, papel, ativo). Papel de líder nunca é editável pelo próprio usuário; mudança de papel por RPC restrita a líderes.

## Success Criteria
- Um e-mail não convidado não consegue criar conta.
- Integrante não consegue se promover a líder (teste pgTAP).
- Convite concluído em até 3 telas no celular.

## Out of Scope (Deferred)
- Login social: não necessário com SMTP próprio.
- Link mágico: depende 100% do e-mail e abre no navegador errado no iPhone.

## Open Questions
- Remetente do e-mail enquanto não houver domínio (Gmail dedicado com senha de app, a validar).
