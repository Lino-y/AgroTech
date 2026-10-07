# Rule 10 — Issue em execução fica sinalizada como em andamento

## Objetivo

Evitar que duas pessoas, ou dois agentes, trabalhem na mesma issue, e deixar claro quais estão livres para quem vai pegar a próxima.

## Descrição

Quem começa a trabalhar numa issue sinaliza isso no GitHub antes de codar: assume a issue como responsável, aplica a label `em-andamento` e comenta qual é a branch. Quem procura trabalho só pega issue aberta sem responsável e sem essa label.

Agentes (Claude, Codex) seguem a mesma regra. Como eles costumam usar a conta de quem os roda, o comentário com a branch é o que diferencia uma sessão da outra.

## Quando aplicar

- Ao começar uma issue: logo depois de criar a branch, antes do primeiro commit.
- Ao criar com `/to-spec` uma issue que você mesmo vai implementar.
- Ao pausar ou desistir: libere a issue (tire a label e o responsável) e comente o motivo e o que já ficou feito.
- Issue `em-andamento` parada há mais de 3 dias úteis, sem commit nem PR: pergunte ao responsável na própria issue antes de assumi-la.

## Como fazer

```bash
# Antes de pegar: só as livres
gh issue list --search "is:open no:assignee -label:em-andamento"

# Ao começar
gh issue edit <n> --add-assignee @me --add-label em-andamento
gh issue comment <n> --body "Em andamento na branch fix/<n>-<slug>."

# Ao pausar ou desistir
gh issue edit <n> --remove-assignee @me --remove-label em-andamento
gh issue comment <n> --body "Liberada: <motivo e o que ficou feito>."
```

O PR com `Closes #<n>` fecha a issue no merge, então não é preciso tirar a label no fim.

## Como validar

- Toda issue com branch ou PR aberto tem responsável e a label `em-andamento`.
- Nenhuma issue `em-andamento` fica sem branch, sem PR e sem comentário recente.

## Consequência de não seguir

- Trabalho duplicado e conflitos de merge na mesma área.
- Issues paradas que ninguém pega, porque parecem ocupadas.
