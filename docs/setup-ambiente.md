# Configuração do ambiente

Passo a passo para preparar o Supabase, o arquivo `.env` e a pré-visualização do app antes de qualquer push.

> Este arquivo é público (vai para o GitHub). Não escreva aqui valores reais, e-mails, senhas ou chaves.

## Checklist

Numeração da seção 3:

- [ ] 3.1 Criar o projeto no Supabase
- [ ] 3.2 Copiar a URL do projeto e a chave publicável (botão **Connect**)
- [ ] 3.3 Copiar o Reference ID
- [ ] 3.4 Ajustar a autenticação (cadastro fechado e URLs)
- [ ] 3.5 Configurar o SMTP (Resend, com o domínio)
- [ ] 3.6 Criar a conta de líder
- [ ] 3.7 Logar nas CLIs
- [ ] 3.8 Cloudflare Pages e domínio do app
- [ ] 3.9 Criar o `.env`
- [ ] 3.10 Conferir o `.env`

## 1. Como visualizar o app antes de fazer push

O push para o GitHub não é necessário para ver o app. Há três níveis:

| Nível | Comando | Para quê | Limites |
|---|---|---|---|
| **Local** | `npm run dev` (`http://localhost:5173`) | Desenvolvimento diário, recarga instantânea, DevTools com emulação de celular | `localhost` conta como contexto seguro, então login, service worker e push funcionam no Chrome do próprio computador |
| **Build local** | `npm run build && npm run preview` | Testar o PWA de verdade (service worker de produção, instalação) | Só no computador |
| **Aparelho real com HTTPS** | `npm run deploy:dev` (Cloudflare Pages) | Testar instalação e push no iPhone e no Android | Precisa de internet; não envolve o GitHub |

**Por que HTTPS importa.** Service worker, instalação e push exigem *contexto seguro*. No computador, `localhost` basta. No celular, `localhost` aponta para o próprio celular, e acessar `http://192.168.x.x:5173` pela Wi-Fi vale só para conferir layout (não é contexto seguro). No iPhone, o push só funciona com o app instalado pela Tela de Início a partir de um endereço `https://` real. Por isso há dois endereços HTTPS estáveis na Cloudflare Pages: o de pré-visualização (`https://dev.<projeto>.pages.dev`, para experimentos) e o de produção/piloto (`https://adve.<dominio>`, ver 3.8). Ambos são sites estáticos gratuitos, publicados por linha de comando, sem depender do repositório do GitHub.

Alternativa rápida sem conta: `npx cloudflared tunnel --url http://localhost:5173` gera uma URL HTTPS temporária que muda a cada execução. Serve para ver rapidamente no celular, mas a instalação do PWA e a assinatura de push se perdem quando a URL muda. Para testar push use os endereços estáveis.

## 2. Ambientes: o que roda onde

| Ambiente | Front | Backend | Quando |
|---|---|---|---|
| **Desenvolvimento** | `localhost:5173` | Projeto Supabase na nuvem | Até o lançamento: ainda não há dados reais, errar custa pouco |
| **Pré-visualização** | `dev.<projeto>.pages.dev` | Projeto Supabase na nuvem | Testes de instalação e push em aparelho real |
| **Piloto e produção** | `adve.<dominio>` (Cloudflare Pages) | Projeto Supabase na nuvem | Quando o piloto começar |
| **Staging** (opcional, só depois de haver dados reais) | `dev.<projeto>.pages.dev` | Supabase self-hosted na VPS ou segundo projeto | Para testar migrations sem tocar nos dados reais |

**Front-end na Cloudflare Pages, não na VPS.** São arquivos estáticos: a Pages entrega por CDN, com HTTPS e domínio automáticos (o DNS já está na Cloudflare), rollback de versão e nenhuma manutenção. Hospedar na VPS não traz ganho e deixa o app no ar dependendo de um servidor seu.

**Backend na nuvem do Supabase por enquanto.** O projeto já existe, Auth, Edge Functions e `pg_cron` funcionam sem operação e o app não tem dados reais. Auto-hospedar o Supabase na VPS exige 4 GB de RAM no mínimo (8 GB recomendado), segundo guias de terceiros, além de backups por sua conta e atualizações manuais da stack, com suporte só da comunidade. É uma opção válida mais tarde (por exemplo, se a igreja preferir não pagar o plano gerenciado), porque as migrations em `supabase/migrations` valem para os dois.

**Supabase local (Docker).** Não há Docker no Windows nem no WSL deste computador, então `supabase start` não roda aqui hoje. Não é necessário agora. Se quiser, instale o Docker Desktop (gratuito para uso pessoal) para rodar `supabase test db` (testes pgTAP) sem tocar no banco real. Sem Docker, os testes pgTAP rodam no projeto de desenvolvimento, dentro de transações com `rollback`.

**O que a VPS faz bem já:** backup noturno do banco (`pg_dump` guardado fora do Supabase, já que o plano Free não oferece backup para download) e um ping periódico de saúde. A VPS costuma ter só IPv4, então o backup usa o **Session pooler** (ver 3.11).

## 3. Passo a passo para configurar

Faça nesta ordem. Nada disso envolve colar segredos no chat.

### 3.1 Criar o projeto no Supabase

1. Acesse **https://supabase.com/dashboard** e entre (GitHub ou e-mail). Se for a primeira vez, o Supabase pede para criar uma organização: nome livre, **Type** `Personal`, **Plan** `Free`.
2. Clique em **New project** e preencha:
   - **Project name:** `louvor-connect` (ou outro nome de sua escolha).
   - **Database Password:** use uma senha **só com letras e números** (símbolos como `@`, `/`, `#` e `:` quebram strings de conexão). Se usar o botão *Generate a password* e vier com símbolo, gere de novo ou edite. **Guarde a senha agora** em um gerenciador de senhas: o Supabase não a mostra depois (só dá para redefinir).
   - **Region:** `South America (São Paulo)`.
   - **Pricing Plan:** `Free`.
3. Clique em **Create new project** e espere uns 2 minutos, até o projeto sair de *Setting up*.

> O plano Free pausa o projeto depois de 7 dias sem atividade. Se um dia o painel mostrar *Paused*, clique em **Restore**. Lembretes agendados (`pg_cron`) não rodam enquanto o projeto estiver pausado.

A senha do banco **não é** uma chave de API. Ela só é usada pela CLI para aplicar migrations (`SUPABASE_DB_PASSWORD`). Se perder: **Project Settings > Database > Reset database password**.

### 3.2 Copiar a URL do projeto e a chave publicável

Os dois valores ficam no botão **Connect**, não em *Project Settings*.

1. Com o projeto aberto, clique em **Connect** (barra superior da tela do projeto).
2. Na aba **App Frameworks**, escolha **React** com **Vite**. O trecho de exemplo mostra as duas linhas do `.env`:
   - **Project URL**, no formato `https://<reference-id>.supabase.co` (sem barra no final) → vai para `VITE_SUPABASE_URL`.
   - **Publishable key**, que começa com `sb_publishable_` → vai para `VITE_SUPABASE_PUBLISHABLE_KEY`.

A chave publicável pode ir para o navegador: toda consulta feita com ela passa pelo RLS (*Row Level Security*), o filtro por linha que o Postgres aplica antes de devolver qualquer dado. Ela também aparece em **Project Settings > API Keys**, aba **Publishable and secret API keys**, caso precise ler de novo.

Não copie nem use a chave `secret` (`sb_secret_...`, equivalente à antiga `service_role`). Ela ignora o RLS do projeto inteiro e não é necessária no computador. Se você vir `anon` e `service_role` em tutoriais antigos, são os nomes antigos desse par de chaves.

### 3.3 Copiar o Reference ID

1. Vá em **Project Settings** (ícone de engrenagem na barra lateral) > **General**.
2. Copie o **Reference ID**: uma sequência de 20 letras minúsculas. → vai para `SUPABASE_PROJECT_REF`.

Para conferir, ele é o mesmo trecho que aparece no começo da Project URL (`https://<reference-id>.supabase.co`) e no endereço do painel (`supabase.com/dashboard/project/<reference-id>`).

### 3.4 Autenticação: cadastro fechado e URLs

Só você consegue fazer (envolve credenciais e preferências da conta). Tudo em **Authentication** na barra lateral.

1. **Sign In / Providers**:
   - Em **User Signups**, desligue **Allow new users to sign up**. O cadastro passa a existir só por convite (o convite gerado pela Edge Function e o **Add user** do painel continuam funcionando).
   - Em **Auth Providers**, mantenha **Email** ligado.
2. **URL Configuration**:
   - **Site URL:** `https://adve.<dominio>` (o endereço de produção do passo 3.8). Enquanto ele não existir, `http://localhost:5173`.
   - **Redirect URLs** > **Add URL**, uma de cada vez:
     - `http://localhost:5173/**`
     - `https://adve.<dominio>/**`
     - `https://dev.<projeto>.pages.dev/**` (use o nome real do projeto Cloudflare do passo 3.8; pode adicionar depois do primeiro deploy)
   - Clique em **Save changes**.

### 3.5 SMTP: e-mail de convite e recuperação de senha

O e-mail embutido do Supabase só entrega para membros da equipe do projeto e tem limite muito baixo. Para convidar músicos de fora, configure um SMTP próprio. Como o domínio está na Cloudflare, use o **Resend**: remetente com o seu domínio (melhor entrega que um Gmail) e plano gratuito de 3.000 e-mails por mês e 100 por dia, de sobra para convites e recuperações (as notificações do dia a dia vão por push, não por e-mail). Confira os limites atuais na página de preços do Resend.

1. **Conta.** Crie uma conta gratuita em **https://resend.com**.
2. **Domínio de envio.** Em **Domains > Add Domain**, use `adve.<dominio>` (um subdomínio, para não misturar com o e-mail do domínio principal) e a região **South America (São Paulo)**. O Resend mostra registros DNS (MX, SPF e DKIM). Adicione-os na zona do domínio, em **Cloudflare > DNS > Records**, com o proxy **desligado** (nuvem cinza, *DNS only*). Se aparecer o botão de configuração automática com a Cloudflare, pode usá-lo. Aguarde o status **Verified**.
3. **Chave de API.** Em **API Keys > Create API Key**, permissão **Sending access**, restrita a esse domínio. Copie a chave (`re_...`): ela só aparece uma vez.
4. **Supabase:** em **Authentication > Emails > SMTP Settings**, ligue **Enable custom SMTP** e preencha:

   | Campo | Valor |
   |---|---|
   | Sender email | `no-reply@adve.<dominio>` |
   | Sender name | nome que aparece no e-mail (ex.: `Louvor Connect`) |
   | Host | `smtp.resend.com` |
   | Port number | `465` |
   | Username | `resend` |
   | Password | a chave de API do passo 3 |

   Clique em **Save changes**.
5. **Teste.** Em **Authentication > Users**, convide (**Add user > Send invitation**) um endereço **de fora da equipe do projeto**. Se o e-mail chegar (confira o spam), está certo.

A chave de API fica **só no painel do Supabase**: não vai no `.env`, no repositório nem no chat.

### 3.6 Criar a sua conta de líder

1. Em **Authentication > Users**, clique em **Add user > Create new user**.
2. Preencha e-mail e senha, e marque **Auto Confirm User**.
3. Clique em **Create user**.

Depois de rodar as migrations, a conta é promovida a líder por SQL (ver 3.11).

### 3.7 Login nas CLIs

As credenciais ficam no seu computador, não em arquivo do projeto. No terminal do Claude Code, o prefixo `!` roda o comando localmente:

```
! npx supabase login
! npx wrangler login
```

Cada um abre o navegador para você autorizar. Confira se funcionou:

```
! npx supabase projects list
! npx wrangler whoami
```

O primeiro deve listar o projeto criado; o segundo, a sua conta Cloudflare (que precisa existir, ver 3.8). Depois disso consigo rodar `supabase link`, `db push` e `functions deploy`, e o deploy na Cloudflare, usando essas sessões. Isso dá à minha sessão acesso à sua conta nesses serviços; para encerrar, rode `npx supabase logout` e `npx wrangler logout`.

### 3.8 Cloudflare Pages e o domínio do app

Pré-requisito: o domínio já usa a Cloudflare como DNS (zona ativa na sua conta).

1. Faça o `wrangler login` (3.7).
2. Eu crio o projeto de Pages e publico a primeira versão (`wrangler pages project create <projeto> --production-branch main`, depois `wrangler pages deploy`). A pré-visualização fica em `https://dev.<projeto>.pages.dev`.
3. **Domínio.** No painel: **Workers & Pages** > o projeto > **Custom domains** > **Set up a custom domain** > `adve.<dominio>`. Como o DNS está na Cloudflare, o registro é criado sozinho e o certificado HTTPS sai em poucos minutos.
4. Confira que `https://adve.<dominio>` abre e adicione os dois endereços nas **Redirect URLs** do Supabase (3.4).

Quando a igreja assumir um domínio próprio, basta adicionar o novo em **Custom domains**, trocar a **Site URL** e as **Redirect URLs** no Supabase e o remetente do Resend.

### 3.9 Criar o `.env`

Na raiz do repositório, copie o modelo:

```bash
cp .env.example .env          # Git Bash
Copy-Item .env.example .env   # PowerShell
```

Abra o `.env` e preencha **só** estes quatro campos, sem aspas e sem espaços em volta do `=`:

```
VITE_SUPABASE_URL=https://<reference-id>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_PROJECT_REF=<reference-id>
SUPABASE_DB_PASSWORD=<senha do banco do passo 3.1>
```

| Variável | Onde achar |
|---|---|
| `VITE_SUPABASE_URL` | **Connect** > App Frameworks (3.2) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Connect** > App Frameworks (3.2) |
| `SUPABASE_PROJECT_REF` | **Project Settings > General** > Reference ID (3.3) |
| `SUPABASE_DB_PASSWORD` | A senha do banco, guardada no passo 3.1 |

Deixe em branco `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`: as chaves VAPID são geradas na configuração do push, e o `VAPID_SUBJECT` receberá o e-mail de contato (`mailto:...`) que você escolher.

**Erros comuns de formato:**

- `VITE_SUPABASE_URL` é `https://<reference-id>.supabase.co`. O host `db.<reference-id>.supabase.co` é o do Postgres direto e não responde à API.
- `SUPABASE_DB_PASSWORD` é só a senha, não uma connection string (`postgresql://...`) e não uma chave `sb_...`.
- `SUPABASE_PROJECT_REF` é só o código, sem `https://` e sem `.supabase.co`.

### 3.10 Conferir o `.env` sem imprimir os valores

Confirme que o arquivo está ignorado pelo git (deve imprimir `.env`):

```bash
git check-ignore .env
```

Depois teste se a URL e a chave publicável estão certas. O comando abaixo não imprime nenhum valor e deve responder `200`:

```bash
set -a; . ./.env; set +a
curl -s -o /dev/null -w 'Auth: %{http_code}\n' "$VITE_SUPABASE_URL/auth/v1/settings" -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY"
```

| Resultado | O que é |
|---|---|
| `200` | URL e chave publicável corretas |
| `401` | chave publicável errada, truncada ou de outro projeto |
| `000` | sem rede, ou `VITE_SUPABASE_URL` com host errado |

Para confirmar que o cadastro público está desligado (deve imprimir `"disable_signup":true`):

```bash
curl -s "$VITE_SUPABASE_URL/auth/v1/settings" -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" | grep -o '"disable_signup":[a-z]*'
```

Quando o `.env` estiver pronto, avise (não cole o conteúdo).

### 3.11 O que faço depois

`supabase link`, aplicar migrations, gerar as chaves VAPID e gravar `VAPID_PRIVATE_KEY` como secret do Supabase, publicar as Edge Functions, promover a sua conta a líder e rodar o app.

Se o `db push` falhar com `network unreachable` ou `no route to host`, a conexão direta do Supabase (que responde só por IPv6) não está acessível da sua rede. A saída é usar o **Session pooler** (IPv4): em **Connect > Connection String**, escolha **Session pooler** e copie a string. Nesse caso uso `db push --db-url` com ela, sem gravá-la em arquivo do projeto.

## 4. Segurança

- `.env` está no `.gitignore`. Confira com `git check-ignore .env` (deve imprimir `.env`).
- Chave publicável e chave VAPID pública são públicas por desenho. Segredos reais: senha do banco, chave VAPID privada e chave de API do Resend (a senha do SMTP).
- A chave `service_role`/`secret` não é necessária localmente: as Edge Functions a recebem do próprio Supabase.
- Se qualquer segredo (senha do banco, chave secret, chave de API do Resend) aparecer em chat, log, print ou commit, trate como vazado e gere de novo: senha do banco em **Project Settings > Database > Reset database password**; chave do Resend em **API Keys** (apague e crie outra) e atualize no SMTP do Supabase.
