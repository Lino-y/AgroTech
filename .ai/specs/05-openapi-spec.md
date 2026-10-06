# 05 - Especificação da API (OpenAPI 3.0)

```yaml
openapi: 3.0.0
info:
  title: AgroTech API
  version: 1.0.0
paths:
  /api/products:
    get:
      summary: Lista catálogo de produtos
  /api/orders:
    post:
      summary: Criação de pedido