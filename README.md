# Financeiro

Controle pessoal de receitas, contas do mês e parcelamentos. Outubro de 2026 é o primeiro mês de uso. Os meses anteriores ficam como histórico. O saldo de um mês não passa para o seguinte.

## O que tem

- **Mês:** receita, o que falta pagar, o que já foi pago, gastos que já saem na fatura do cartão e lançamentos fora da soma.
- **Compromissos:** cada conta existe uma vez. O mês seguinte nasce daqui. Valor fixo entra nos meses que ainda estão vazios. Parcelamento some depois da última parcela.
- **Ano:** os doze meses, a partir dos lançamentos.
- **Categorias:** dá para criar uma categoria principal ou uma subcategoria.

A receita tem base e extra. Se a base mudar, os meses seguintes que ainda estavam com o valor anterior acompanham. O extra fica só naquele mês. Empréstimo e capital de giro não entram na receita.

## Requisitos

Node.js 22 ou mais novo. O banco usa o SQLite que vem com o Node.

## Neste computador

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

O usuário e a senha ficam em `.env.local`, fora do git:

```
AUTH_USER=
AUTH_PASSWORD=
AUTH_SECRET=
```

`AUTH_SECRET` é uma chave longa, usada só para assinar a sessão. Copie o modelo de `.env.example`. Sem essas três variáveis, a tela de entrada pede a configuração. Depois de criar ou mudar o arquivo, reinicie o `npm run dev`.

Os dados ficam em `data/financeiro.db`. Esse arquivo fica fora do git. A planilha de origem também: ela só seria lida numa base vazia, na primeira abertura.

## Publicar em financeiro.ericabdias.com.br

O endereço é um subdomínio, então `BASE_PATH` fica vazio. O Docker sobe o processo e a rede `proxy` entrega o HTTPS até o container.

Na VPS, a pasta do projeto tem um `.env` que não entra no git:

```
AUTH_USER=
AUTH_PASSWORD=
AUTH_SECRET=
BASE_PATH=
```

O banco fica em `data/financeiro.db`, montado no container. A partir da publicação, essa cópia da VPS é a que vale.

```bash
docker compose up -d --build
```

O backup do banco, com o SQLite aberto, é o `backup-db.sh`. Ele grava em `/srv/backups/financeiro` e confere a integridade antes de aceitar o arquivo.
