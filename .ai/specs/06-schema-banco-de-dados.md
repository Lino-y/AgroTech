#### `AgroTech/spec/06-schema-banco-de-dados.md`
```markdown
# 06 - Schema do Banco de Dados (PostgreSQL)

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