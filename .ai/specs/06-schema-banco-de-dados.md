# 06 - Schema do Banco de Dados (PostgreSQL)

> **Status: alvo, não implementado.** Hoje os dados vivem no arquivo
> `src/data/db.json`, criado pelo `server.js` a partir do `defaultDb` no
> primeiro uso, com quatro listas: `users`, `products`, `orders` e
> `financeEntries` (lançamentos manuais do financeiro:
> `{ id, ownerEmail, type, title, amount, createdAt }`). O formato atual de cada
> objeto está no contrato da API (`.ai/specs/05-openapi-spec.md`). Ids novos
> (issue #27): anúncio e lançamento em UUID, pedido em `AGT-` com 12
> hexadecimais aleatórios; registro antigo mantém o id que tinha, sem migração.
> Pedido novo não grava mais `date` (issue #25): a data real é o `createdAt`.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('PRODUTOR', 'VENDEDOR'))
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(150) NOT NULL,
    price DECIMAL(10, 2) NOT NULL
);
```
