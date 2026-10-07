# 05 - Especificação da API (OpenAPI 3.0)

Contrato da API implementada em `server.js`, conferido com os testes de
integração em `tests/api.test.js`. Endpoint novo ou alterado atualiza este
arquivo no mesmo PR (`docs/agents/architecture.md`).

Regras que valem para todas as rotas:

- Erro sempre como `{ "message": string }` com o status HTTP correspondente.
- Autenticação por `Authorization: Bearer <JWT>` (validade de 7 dias, payload
  `{ sub, email, role }`). Token ausente ou inválido: 401. Perfil sem
  permissão: 403.
- Texto enviado pelo usuário (nome, empresa, campos do produto) é gravado com
  HTML escapado (`<` vira `&lt;` etc.), porque o front monta as telas com
  `innerHTML`.

```yaml
openapi: 3.0.0
info:
  title: AgroTech API
  version: 1.1.0
components:
  securitySchemes:
    bearer: { type: http, scheme: bearer, bearerFormat: JWT }
  schemas:
    Error:
      type: object
      properties: { message: { type: string } }
    User:
      type: object
      properties:
        id: { type: string }
        name: { type: string }
        propertyOrCompany: { type: string }
        email: { type: string }
        role: { type: string, enum: [PRODUTOR, VENDEDOR, ADMIN] }
    Session:
      type: object
      properties:
        user: { $ref: '#/components/schemas/User' }
        token: { type: string }
    Product:
      type: object
      properties:
        id: { type: string }
        name: { type: string }
        price: { type: number, exclusiveMinimum: 0 }
        category: { type: string }
        unit: { type: string }
        location: { type: string }
        stock: { type: number, minimum: 0 }
        shippingType: { type: string }
        certification: { type: string }
        image: { type: string, nullable: true, description: 'link http(s) ou data URL de imagem' }
        imageEmoji: { type: string }
        imageBg: { type: string }
        rating: { type: number }
        reviewsCount: { type: number }
        description: { type: string }
        ownerEmail: { type: string }
        sellerName: { type: string }
        comments:
          type: array
          items: { type: object, properties: { author: { type: string }, text: { type: string }, rating: { type: number } } }
    Order:
      type: object
      properties:
        id: { type: string, example: AGT-12345 }
        ownerEmail: { type: string }
        date: { type: string }
        status: { type: string }
        statusStep: { type: integer, minimum: 1, maximum: 4 }
        trackingCode: { type: string }
        carrier: { type: string }
        estimatedDelivery: { type: string }
        total: { type: number, description: 'calculado no servidor (calculateCartSummary, src/services/commerce.js)' }
        items:
          type: array
          items:
            allOf:
              - $ref: '#/components/schemas/Product'
              - { type: object, properties: { quantity: { type: integer, minimum: 1 } } }
        timeline:
          type: array
          items: { type: object, properties: { title: { type: string }, time: { type: string }, completed: { type: boolean } } }
paths:
  /api/health:
    get:
      summary: Verifica se a API está no ar
      responses:
        '200': { description: 'ok', content: { application/json: { schema: { type: object, properties: { ok: { type: boolean }, timestamp: { type: string } } } } } }
  /api/auth/register:
    post:
      summary: Cria uma conta e já devolve a sessão
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, email, password]
              properties:
                name: { type: string }
                email: { type: string }
                password: { type: string }
                propertyOrCompany: { type: string }
                role: { type: string, enum: [PRODUTOR, VENDEDOR], default: PRODUTOR, description: 'ADMIN não é aceito' }
      responses:
        '201': { description: 'conta criada', content: { application/json: { schema: { $ref: '#/components/schemas/Session' } } } }
        '400': { description: 'campo obrigatório ausente ou perfil inválido', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
        '409': { description: 'e-mail já cadastrado', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
  /api/auth/login:
    post:
      summary: Abre a sessão
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, required: [email, password], properties: { email: { type: string }, password: { type: string } } }
      responses:
        '200': { description: 'sessão aberta', content: { application/json: { schema: { $ref: '#/components/schemas/Session' } } } }
        '400': { description: 'e-mail ou senha ausentes' }
        '401': { description: 'e-mail ou senha incorretos' }
  /api/auth/me:
    get:
      summary: Usuário da sessão atual
      security: [{ bearer: [] }]
      responses:
        '200': { description: 'usuário', content: { application/json: { schema: { type: object, properties: { user: { $ref: '#/components/schemas/User' } } } } } }
        '401': { description: 'sem token ou token inválido' }
  /api/products:
    get:
      summary: Lista o catálogo (público)
      responses:
        '200': { description: 'produtos', content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Product' } } } } }
    post:
      summary: Publica um anúncio
      security: [{ bearer: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, price, category, description]
              properties:
                name: { type: string }
                price: { type: number, exclusiveMinimum: 0 }
                category: { type: string }
                description: { type: string }
                imageUrl: { type: string, description: 'http(s) ou data:image/(png|jpeg|gif|webp);base64' }
                unit: { type: string, default: unidade }
                location: { type: string, default: 'Região Agrícola - BR' }
                stock: { type: number, minimum: 0, default: 100 }
                shippingType: { type: string, default: 'CIF - Entrega na Fazenda' }
                certification: { type: string, default: 'Emite Nota Fiscal e Certificado MAPA' }
      responses:
        '201': { description: 'anúncio criado', content: { application/json: { schema: { $ref: '#/components/schemas/Product' } } } }
        '400': { description: 'dados incompletos, preço/estoque inválidos ou imagem inválida' }
        '401': { description: 'sem token ou token inválido' }
  /api/products/{id}:
    delete:
      summary: Remove um anúncio (dono do anúncio ou ADMIN)
      security: [{ bearer: [] }]
      parameters: [{ name: id, in: path, required: true, schema: { type: string } }]
      responses:
        '204': { description: 'removido' }
        '401': { description: 'sem token ou token inválido' }
        '403': { description: 'não é o dono nem ADMIN' }
        '404': { description: 'produto não encontrado' }
  /api/orders:
    get:
      summary: Pedidos do usuário da sessão (ADMIN vê todos)
      security: [{ bearer: [] }]
      responses:
        '200': { description: 'pedidos', content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Order' } } } } }
        '401': { description: 'sem token ou token inválido' }
    post:
      summary: Fecha um pedido; preço e total vêm do catálogo, nunca do cliente
      security: [{ bearer: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [items]
              properties:
                items:
                  type: array
                  minItems: 1
                  items: { type: object, required: [id, quantity], properties: { id: { type: string }, quantity: { type: integer, minimum: 1 } } }
                coupon: { type: string, enum: [AGRO10, FRETEGRATIS, NOVOCLIENTE, COLHEITA20] }
      responses:
        '201': { description: 'pedido criado', content: { application/json: { schema: { $ref: '#/components/schemas/Order' } } } }
        '400': { description: 'lista vazia, produto fora do catálogo ou quantidade inválida' }
        '401': { description: 'sem token ou token inválido' }
  /api/admin/summary:
    get:
      summary: Totais da plataforma
      security: [{ bearer: [] }]
      responses:
        '200': { description: 'totais', content: { application/json: { schema: { type: object, properties: { totalUsers: { type: integer }, totalProducts: { type: integer }, totalOrders: { type: integer }, revenue: { type: number } } } } } }
        '401': { description: 'sem token ou token inválido' }
        '403': { description: 'não é ADMIN' }
  /api/admin/users:
    get:
      summary: Lista os usuários (sem senha)
      security: [{ bearer: [] }]
      responses:
        '200': { description: 'usuários', content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/User' } } } } }
        '401': { description: 'sem token ou token inválido' }
        '403': { description: 'não é ADMIN' }
```
