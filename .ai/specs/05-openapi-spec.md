# 05 - Especificação da API (OpenAPI 3.0)

Contrato da API implementada em `apps/api/server.js`, conferido com os testes de
integração em `tests/api.test.js`. Endpoint novo ou alterado atualiza este
arquivo no mesmo PR (`docs/agents/architecture.md`).

Regras que valem para todas as rotas:

- Erro sempre como `{ "message": string }` com o status HTTP correspondente.
- Falha de leitura ou gravação do `db.json` (ex.: arquivo corrompido) responde `500` com `{ "message": string }` em qualquer rota. O servidor não cai; o arquivo não é regravado (issue #39).
- Entrada que o cliente errou volta com o status dele: JSON malformado é `400` e corpo maior que 2 MB é `413`, ambos com `{ "message": string }`. Rota `/api/*` que não existe responde `404`.
- CORS segue a variável `CORS_ORIGINS` (origens exatas separadas por vírgula, sem barra final). Sem ela nenhuma origem cruzada é liberada; a SPA é da mesma origem e o app nativo não usa CORS.
- Banco ilegível em rota autenticada é `500`, nunca `401` (o `401` é só do token).
- Limites de entrada: preço do produto até R$ 10.000.000, estoque até 1.000.000 e quantidade por item do pedido de 1 a 10.000.
- Autenticação por `Authorization: Bearer <JWT>` (validade de 7 dias, payload
  `{ sub, email, role }`). Token ausente ou inválido: 401. Perfil sem
  permissão: 403.
- Texto enviado pelo usuário (nome, empresa, campos do produto e da loja, texto da
  avaliação, descrição do lançamento financeiro) é gravado com HTML escapado (`<` vira `&lt;` etc.),
  porque o front monta as telas com `innerHTML`.

```yaml
openapi: 3.0.0
info:
  title: AgroTech API
  version: 1.5.0
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
        storeProfileImage: { type: string, nullable: true, description: link http(s) ou foto enviada }
        storeCoverImage: { type: string, nullable: true, description: link http(s) ou foto enviada }
        storeBio: { type: string, description: até 500 caracteres }
        storePhone: { type: string }
        storeLocation: { type: string }
        storeHours: { type: string }
    Session:
      type: object
      properties:
        user: { $ref: '#/components/schemas/User' }
        token: { type: string }
    Product:
      type: object
      properties:
        id: { type: string, description: 'UUID; anúncio gravado antes da issue #27 mantém o id que tinha (ex.: "1")' }
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
          description: 'Na lista pública (GET /api/products) cada comentário traz só id, autor, texto e nota; o e-mail de quem avaliou (authorEmail, guardado no banco) nunca sai nessa resposta.'
          items: { type: object, properties: { id: { type: string }, author: { type: string }, text: { type: string }, rating: { type: number } } }
    Order:
      type: object
      properties:
        id: { type: string, example: AGT-9F3A2C1B7D4E, description: 'AGT- e 12 hexadecimais aleatórios (48 bits); pedido gravado antes da issue #27 mantém o formato AGT-12345' }
        ownerEmail: { type: string }
        date: { type: string, description: 'só em pedido gravado antes da issue #25: data legível do seed ("15/Set/2026") ou "Hoje", que não é data real; pedido novo não tem' }
        createdAt: { type: string, format: date-time, description: 'quando o pedido foi criado; a tela de pedidos mostra em dd/mm/aaaa. Pedido gravado antes da issue #6 não tem' }
        status: { type: string }
        statusStep: { type: integer, minimum: 1, maximum: 4 }
        trackingCode: { type: string, example: BR-AGRO-9F3A2C1B7D4E-X, description: '12 hexadecimais aleatórios (48 bits); pedido antigo mantém o formato BR-AGRO-123456-X' }
        carrier: { type: string }
        estimatedDelivery: { type: string }
        total: { type: number, description: 'calculado no servidor (calculateCartSummary, packages/domain/commerce.js)' }
        items:
          type: array
          items:
            allOf:
              - $ref: '#/components/schemas/Product'
              - { type: object, properties: { quantity: { type: integer, minimum: 1 } } }
        timeline:
          type: array
          items: { type: object, properties: { title: { type: string }, time: { type: string }, completed: { type: boolean } } }
    FinanceEntry:
      type: object
      description: >-
        Lançamento do extrato financeiro da conta. COMPRA = pedido da conta (saída, pelo total do
        pedido); VENDA = itens dos produtos da conta num pedido de outra conta (entrada, preço x
        quantidade, sem cupom nem frete); MANUAL = lançamento digitado pela conta.
      properties:
        id: { type: string, example: compra-AGT-12345 }
        type: { type: string, enum: [INCOME, EXPENSE] }
        source: { type: string, enum: [COMPRA, VENDA, MANUAL] }
        title: { type: string }
        amount: { type: number, exclusiveMinimum: 0 }
        date: { type: string, format: date-time, nullable: true, description: 'null em pedido antigo sem data real (gravado só com "Hoje")' }
paths:
  /api/health:
    get:
      summary: Verifica se a API está no ar
      responses:
        '200': { description: 'ok', content: { application/json: { schema: { type: object, properties: { ok: { type: boolean }, timestamp: { type: string } } } } } }
  /api/app-config:
    get:
      summary: Versão mínima do app aceita pela API (pública, sem token)
      description: 'Vem da variável de ambiente APP_MIN_VERSION (MAJOR.MINOR.PATCH); padrão 0.0.0. Valor inválido derruba o servidor na subida. A API não bloqueia versões antigas; só informa.'
      responses:
        '200': { description: 'ok', content: { application/json: { schema: { type: object, properties: { minVersion: { type: string, example: '1.2.0' } } } } } }
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
        '429':
          description: 'mais de 10 senhas erradas para o mesmo e-mail (trim + minúsculas) em 15 minutos; enquanto durar o bloqueio, até a senha certa recebe 429. Login certo zera a contagem. Contador em memória, por processo.'
          headers: { Retry-After: { description: 'segundos até o e-mail destrancar', schema: { type: integer } } }
          content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
  /api/auth/me:
    get:
      summary: Usuário da sessão atual
      security: [{ bearer: [] }]
      responses:
        '200': { description: 'usuário', content: { application/json: { schema: { type: object, properties: { user: { $ref: '#/components/schemas/User' } } } } } }
        '401': { description: 'sem token ou token inválido, ou sessão encerrada por logout (mensagem "Sessão encerrada. Entre de novo.")' }
  /api/auth/logout:
    post:
      summary: Encerra todas as sessões da conta (todo token emitido antes deixa de valer, em todos os aparelhos)
      security: [{ bearer: [] }]
      responses:
        '204': { description: 'sessões encerradas; sem corpo' }
        '401': { description: 'sem token ou token inválido' }
    delete:
      summary: Exclui a conta da sessão (exige a senha)
      description: >
        Remove o usuário, os anúncios e os lançamentos financeiros dele. Os pedidos são mantidos
        e anonimizados: o ownerEmail do pedido e o dos itens vira conta-excluida-{idDoPedido}@removido.invalid,
        e o sellerName dos itens vira "Vendedor removido". As avaliações feitas pela conta (vínculo:
        authorEmail gravado na avaliação) saem dos produtos, e a nota e o total de cada produto afetado
        são recalculados. Avaliações sem authorEmail (do seed ou anteriores ao vínculo) não são alteradas,
        porque não há como ligá-las à conta; o nome é o único dado delas. O token da conta excluída passa
        a receber 401. Conta ADMIN não pode ser excluída por esta rota.
      security: [{ bearer: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [password]
              properties:
                password: { type: string }
      responses:
        '204': { description: 'conta excluída, sem corpo' }
        '400': { description: 'senha ausente no corpo' }
        '401': { description: 'sem token ou token inválido' }
        '403': { description: 'senha incorreta (não é 401: o app encerra a sessão em todo 401) ou conta administradora' }
  /api/products:
    get:
      summary: Lista o catálogo (público); sem limit devolve a lista inteira, com limit devolve a página
      parameters:
        - { name: limit, in: query, required: false, schema: { type: integer, minimum: 1, maximum: 100 }, description: 'tamanho da página; sem ele a lista vem inteira' }
        - { name: page, in: query, required: false, schema: { type: integer, minimum: 1, default: 1 }, description: 'número da página; exige limit' }
      responses:
        '200':
          description: 'produtos (página além do fim devolve [])'
          headers:
            X-Total-Count: { description: 'total de produtos do catálogo, antes de paginar', schema: { type: integer } }
          content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Product' } } } }
        '400': { description: 'limit ou page inválido (não inteiro, page < 1, limit fora de 1 a 100) ou page sem limit; corpo { message } diz qual parâmetro' }
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
  /api/auth/store:
    put:
      summary: Edita o perfil da loja do usuário da sessão
      security: [{ bearer: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                name: { type: string }
                propertyOrCompany: { type: string }
                storeProfileImage: { type: string, description: link http(s) ou foto enviada (data URL de imagem) }
                storeCoverImage: { type: string, description: link http(s) ou foto enviada (data URL de imagem) }
                storeBio: { type: string, maxLength: 500 }
                storePhone: { type: string }
                storeLocation: { type: string }
                storeHours: { type: string }
      responses:
        '200': { description: 'perfil atualizado', content: { application/json: { schema: { type: object, properties: { user: { $ref: '#/components/schemas/User' } } } } } }
        '400': { description: 'nome vazio ou imagem inválida' }
        '401': { description: 'sem token ou token inválido' }
        '404': { description: 'usuário não encontrado' }
  /api/products/{id}/reviews:
    post:
      summary: Avalia um anúncio (texto até 600 caracteres, nota de 0 a 5; sem nota vale 5)
      security: [{ bearer: [] }]
      parameters: [{ name: id, in: path, required: true, schema: { type: string } }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [text]
              properties: { text: { type: string, maxLength: 600 }, rating: { type: number, minimum: 0, maximum: 5 } }
      responses:
        '201': { description: 'avaliação criada', content: { application/json: { schema: { type: object, properties: { review: { type: object }, rating: { type: number }, reviewsCount: { type: integer } } } } } }
        '400': { description: 'texto vazio' }
        '401': { description: 'sem token ou token inválido' }
        '404': { description: 'produto não encontrado' }
  /api/products/{id}/reviews/{reviewId}:
    delete:
      summary: Remove uma avaliação (o autor dela ou ADMIN)
      security: [{ bearer: [] }]
      parameters: [{ name: id, in: path, required: true, schema: { type: string } }, { name: reviewId, in: path, required: true, schema: { type: string } }]
      responses:
        '204': { description: 'removida' }
        '401': { description: 'sem token ou token inválido' }
        '403': { description: 'não é o autor nem ADMIN' }
        '404': { description: 'produto ou avaliação não encontrados' }
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
      parameters:
        - name: Idempotency-Key
          in: header
          required: false
          description: 'Chave do cliente (8 a 64 letras, números, _ ou -) para reenvio seguro. Mesma chave e mesmos itens devolvem o pedido já criado (200), sem criar outro; mesma chave com outros itens dá 409. A chave vale por usuário. Sem o cabeçalho, cada POST cria um pedido.'
          schema: { type: string, minLength: 8, maxLength: 64, pattern: '^[A-Za-z0-9_-]+$' }
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
                  items: { type: object, required: [id, quantity], properties: { id: { type: string }, quantity: { type: integer, minimum: 1, maximum: 10000 } } }
                coupon: { type: string, enum: [AGRO10, FRETEGRATIS, NOVOCLIENTE, COLHEITA20], description: 'sem diferenciar maiúsculas; cupom que não existe ou abaixo do valor mínimo é ignorado, sem erro, e o pedido sai sem desconto' }
      responses:
        '200': { description: 'reenvio com a mesma Idempotency-Key e os mesmos itens: devolve o pedido já criado', content: { application/json: { schema: { $ref: '#/components/schemas/Order' } } } }
        '201': { description: 'pedido criado', content: { application/json: { schema: { $ref: '#/components/schemas/Order' } } } }
        '400': { description: 'lista vazia, produto fora do catálogo, quantidade que não é inteira de 1 a 10.000 ou Idempotency-Key malformada' }
        '401': { description: 'sem token ou token inválido' }
        '409': { description: 'Idempotency-Key já usada com outros itens ou cupom' }
  /api/finance/entries:
    get:
      summary: Extrato financeiro da conta da sessão, do mais recente ao mais antigo (ADMIN também vê só o dele)
      security: [{ bearer: [] }]
      responses:
        '200': { description: 'lançamentos', content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/FinanceEntry' } } } } }
        '401': { description: 'sem token ou token inválido' }
    post:
      summary: Registra um lançamento manual na conta da sessão
      security: [{ bearer: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [title, amount, type]
              properties:
                title: { type: string, maxLength: 120, description: 'cortado em 120 caracteres' }
                amount: { type: number, exclusiveMinimum: 0 }
                type: { type: string, enum: [INCOME, EXPENSE] }
      responses:
        '201': { description: 'lançamento criado (source MANUAL)', content: { application/json: { schema: { $ref: '#/components/schemas/FinanceEntry' } } } }
        '400': { description: 'descrição vazia, valor que não é maior que zero ou tipo fora da lista' }
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
