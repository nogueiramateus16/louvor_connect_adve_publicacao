# Configuração do ambiente

Passo a passo para preparar o Supabase, o arquivo `.env` e a pré-visualização do app antes de qualquer push.

> Este arquivo é público (vai para o GitHub). Não escreva aqui valores reais, e-mails, senhas ou chaves.

## 1. Como visualizar o app antes de fazer push

O push para o GitHub não é necessário para ver o app. Há três níveis:

| Nível | Comando | Para quê | Limites |
|---|---|---|---|
| **Local** | `npm run dev` (`http://localhost:5173`) | Desenvolvimento diário, recarga instantânea, DevTools com emulação de celular | `localhost` conta como contexto seguro, então login, service worker e push funcionam no Chrome do próprio computador |
| **Build local** | `npm run build && npm run preview` | Testar o PWA de verdade (service worker de produção, instalação) | Só no computador |
| **Aparelho real com HTTPS** | `npm run deploy:dev` (Cloudflare Pages) | Testar instalação e push no iPhone e no Android | Precisa de internet; não envolve o GitHub |

**Por que HTTPS importa.** Service worker, instalação e push exigem *contexto seguro*. No computador, `localhost` basta. No celular, `localhost` aponta para o próprio celular, e acessar `http://192.168.x.x:5173` pela Wi-Fi vale só para conferir layout (não é contexto seguro). No iPhone, o push só funciona com o app instalado pela Tela de Início a partir de um endereço `https://` real. Por isso existe uma URL de pré-visualização estável em `https://dev.<projeto>.pages.dev`: é um site estático gratuito da Cloudflare, publicado por linha de comando, sem domínio próprio e sem depender do repositório do GitHub.

Alternativa rápida sem conta: `npx cloudflared tunnel --url http://localhost:5173` gera uma URL HTTPS temporária que muda a cada execução. Serve para ver rapidamente no celular, mas a instalação do PWA e a assinatura de push se perdem quando a URL muda. Para testar push use o deploy estável.

## 2. Supabase: remoto ou local?

O desenvolvimento usa o **projeto Supabase remoto** (o seu), sem precisar do Docker. O Supabase local (`supabase start`, que usa Docker) é opcional e serve para:

- rodar `supabase test db` (testes pgTAP) sem tocar no banco real;
- testar migrations destrutivas e `db reset` com segurança depois que houver usuários reais.

Enquanto o projeto não tem dados de verdade, errar no remoto custa pouco. Depois do lançamento, use um segundo projeto de desenvolvimento ou o Supabase local.

## 3. Passo a passo para configurar

Faça nesta ordem. Nada disso envolve colar segredos no chat.

### 3.1 Criar o projeto no Supabase
1. Em supabase.com, crie um projeto novo. Região sugerida: **South America (São Paulo)**.
2. Defina a senha do banco usando só letras e números (símbolos quebram strings de conexão). Guarde para o `.env`.
3. Em **Project Settings > General**, copie o **Reference ID**.
4. Em **Project Settings > API Keys**, copie a **Project URL** e a **Publishable key** (`sb_publishable_...`). Não use a secret/service role.

### 3.2 Ajustes no painel do Supabase
Só você consegue fazer (envolvem credenciais ou preferências da conta):

1. **Authentication > Sign In / Providers**: manter **Email** ligado e **desligar "Allow new users to sign up"** (cadastro só por convite).
2. **Authentication > URL Configuration**: colocar em *Site URL* o endereço de produção quando existir; em *Redirect URLs*, adicionar `http://localhost:5173/**` e `https://dev.<projeto>.pages.dev/**`.
3. **Authentication > Emails > SMTP Settings** (e-mail de convite e recuperação):
   - Crie um Gmail dedicado ao ministério, ative a verificação em duas etapas e gere uma **senha de app**.
   - Host `smtp.gmail.com`, porta `465`, usuário e remetente = o Gmail, senha = a senha de app.
   - Essa senha fica **só no painel do Supabase**, não no `.env` e não comigo.
   - Teste enviando um convite para um endereço de fora da equipe do projeto.
4. **Authentication > Users > Add user**: crie a sua conta (com *Auto Confirm*). Eu a promovo a líder por SQL depois.

### 3.3 Login nas CLIs (credenciais ficam no seu computador, não em arquivo do projeto)
No terminal do Claude Code, use o prefixo `!` para rodar localmente:

```
! npx supabase login
! npx wrangler login
```
Cada um abre o navegador para você autorizar. Depois disso consigo rodar `supabase link`, `db push` e `functions deploy`, e o deploy na Cloudflare, usando essas sessões. Isso dá à minha sessão acesso à sua conta nesses serviços; para encerrar, rode `npx supabase logout` e `npx wrangler logout`.

### 3.4 Criar o `.env`
Copie `.env.example` para `.env` na raiz e preencha **só** estes campos:

| Variável | Onde achar |
|---|---|
| `VITE_SUPABASE_URL` | Project URL (3.1) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (3.1) |
| `SUPABASE_PROJECT_REF` | Reference ID (3.1) |
| `SUPABASE_DB_PASSWORD` | Senha do banco (3.1) |

Deixe em branco `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`: as chaves VAPID são geradas na configuração do push, e o `VAPID_SUBJECT` receberá o e-mail de contato (`mailto:...`) que você escolher. Avise quando o arquivo estiver pronto (não cole o conteúdo).

### 3.5 Cloudflare Pages (pré-visualização em aparelho real)
1. Crie uma conta gratuita na Cloudflare (não precisa de domínio nem de cartão).
2. Depois do `wrangler login`, a primeira publicação cria o projeto de Pages automaticamente.

### 3.6 O que faço depois
`supabase link`, aplicar migrations, gerar as chaves VAPID e gravar `VAPID_PRIVATE_KEY` como secret do Supabase, publicar as Edge Functions, promover a sua conta a líder e rodar o app.

## 4. Segurança
- `.env` está no `.gitignore`. Confira com `git check-ignore .env` (deve imprimir `.env`).
- Chave publicável e chave VAPID pública são públicas por desenho. Segredos reais: senha do banco, chave VAPID privada e senha de app do Gmail.
- A chave `service_role` não é necessária localmente: as Edge Functions a recebem do próprio Supabase.
