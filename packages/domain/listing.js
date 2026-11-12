// Rascunho de anúncio a partir do texto livre do vendedor (a "IA" do anúncio). Funciona localmente,
// sem chave de API: reconhece palavras-chave do agro e estima nome, preço, unidade, categoria,
// estoque, local, documentação e descrição. Web e app usam a mesma regra (ADR-0002).
// Movido de src/modules/catalog.js sem mudar a lógica.

const AI_KEYWORDS = [
  { match: ['milho', 'soja', 'semente', 'trigo', 'arroz', 'feijão', 'grão', 'café', 'algodão', 'sorgo'], category: 'Grãos', unit: 'kg', price: 320, desc: 'Lote de sementes/grãos com certificação de origem. Ideal para plantio na safra atual, com laudo de germinação e embalagem original.' },
  { match: ['npk', 'adubo', 'fertilizante', 'ureia', 'calcário', 'nitrogênio', 'fósforo', 'potássio'], category: 'Fertilizantes', unit: 'kg', price: 185, desc: 'Fertilizante granulado de alta solubilidade, formulação balanceada para formação radicular vigorosa. Entrega imediata em carretas fechadas.' },
  { match: ['racao', 'ração', 'nutrição', 'confinamento', 'bovino', 'suíno', 'aves', 'sal mineral'], category: 'Rações', unit: 'kg', price: 92, desc: 'Alimento concentrado balanceado para engorda intensiva, com excelente conversão alimentar e minerais quelatados.' },
  { match: ['trator', 'colheitadeira', 'máquina', 'pulverizador', 'implemento', 'arado', 'grade', 'plantadeira', 'carreta'], category: 'Máquinas', unit: 'unidade', price: 750, desc: 'Equipamento revisado com manutenção em dia, pronto para uso no preparo de solo e operações de campo. Operador disponível.' },
  { match: ['herbicida', 'agrotóxico', 'defensivo', 'inseticida', 'fungicida', 'glyphosate', 'glifosato'], category: 'Outros', unit: 'unidade', price: 45, desc: 'Produto registrado no MAPA, com bula e receita agronômica. Embalagem lacrada, lote recente.' }
];

// Nomes comerciais para o título do anúncio (o maior match ganha)
// Nomes comerciais para o título do anúncio (o maior match ganha)
const PRODUCT_NAMES = [
  { match: 'milho', name: 'Milho Híbrido' },
  { match: 'soja', name: 'Semente de Soja' },
  { match: 'trigo', name: 'Trigo' },
  { match: 'arroz', name: 'Arroz' },
  { match: 'feijão', name: 'Feijão' },
  { match: 'café', name: 'Café' },
  { match: 'algodão', name: 'Algodão' },
  { match: 'sorgo', name: 'Sorgo' },
  { match: 'npk', name: 'Adubo NPK' },
  { match: 'ureia', name: 'Ureia' },
  { match: 'calcário', name: 'Calcário' },
  { match: 'racao', name: 'Ração' },
  { match: 'ração', name: 'Ração' },
  { match: 'sal mineral', name: 'Sal Mineral' },
  { match: 'trator', name: 'Trator' },
  { match: 'colheitadeira', name: 'Colheitadeira' },
  { match: 'pulverizador', name: 'Pulverizador' },
  { match: 'plantadeira', name: 'Plantadeira' },
  { match: 'carreta', name: 'Carreta' },
  { match: 'herbicida', name: 'Herbicida' },
  { match: 'glifosato', name: 'Glifosato' },
  { match: 'glyphosate', name: 'Glifosato' },
  { match: 'inseticida', name: 'Inseticida' },
  { match: 'fungicida', name: 'Fungicida' }
];

// Unidades que podem ser citadas como "o kg", "a tonelada"...
const UNIT_ALIASES = [
  { match: /\b(kg|quilo|quilos)\b/, unit: 'kg' },
  { match: /\b(toneladas?|ton)\b/, unit: 'tonelada' },
  { match: /\b(unidades?|cabe[cç]as?)\b/, unit: 'unidade' }
];

// --- FUNÇÃO PARA GERAR DETALHES TÉCNICOS POR CATEGORIA ---
function getTechnicalDetails(category, prompt) {
  const details = {
    'Grãos': [
      '**QUALIDADE GARANTIDA PARA ALTA PRODUTIVIDADE**',
      '• Sementes certificadas MAPA — pureza varietal ≥ 98%, germinação ≥ 90% (laudo anexo)',
      '• Tratamento industrial premium: fungicida sistêmico + inseticida + polímero colorido (rastreabilidade visual)',
      '• Umidade controlada 12-14% — prontas para plantio imediato, sem necessidade de secagem',
      '• Vigor testado: tetrazólio e envelhecimento acelerado — emergência rápida e uniforme no campo',
      '• Isentas de sementes de plantas daninhas quarentenárias (ex: amaranto, caruru, trapoeraba)',
      '• Embalagem rastreável: sacos 60kg ráfia laminada ou Big Bag 1.000kg com QR Code do lote',
      '• Validade do tratamento: 120 dias — proteção na fase crítica de estabelecimento da lavoura',
      '• Recomendação técnica: profundidade 3-5cm, velocidade 5-7 km/h, adubação de base conforme análise de solo',
      '• Janela de plantio otimizada para sua região — consulte nosso calendário safra 2026/27',
      '**DIFERENCIAL**: Lote com rastreabilidade total do campo à saca — transparência que valoriza sua colheita'
    ],
    'Fertilizantes': [
      '**NUTRIÇÃO INTELIGENTE PARA SOLO PRODUTIVO**',
      '• Formulação NPK personalizada: balanceada conforme sua análise de solo (envie seu laudo para ajuste fino)',
      '• Granulometria premium 2-4mm (SGN 200-300) — distribuição uniforme, sem segregação na lançadeira',
      '• Alta solubilidade (>95%) — nutrientes disponíveis na solução do solo desde o 1º dia',
      '• Tecnologia de revestimento: menor perdas por volatilização (N) e fixação (P) — maior eficiência',
      '• Enriquecido com micronutrientes quelatados (Zn, B, Cu, Mn, Mo) — previne deficiências ocultas',
      '• Baixo teor de cloretos e biureto — seguro para culturas sensíveis (soja, feijão, citros)',
      '• Embalagem tecnológica: sacos 50kg barreira UV + Big Bag 1.000kg com liner interno — integridade total',
      '• Livre de contaminantes: metais pesados (Cd, Pb, As, Hg) muito abaixo dos limites MAPA/ANVISA',
      '• Rastreabilidade: QR Code no saco com certificado de análise, data de fabricação e lote',
      '**DIFERENCIAL**: Programa de devolução de embalagens vazias (logística reversa) — sustentabilidade que conta pontos no CAR'
    ],
    'Rações': [
      '**NUTRIÇÃO DE PRECISÃO PARA MÁXIMA CONVERSÃO ALIMENTAR**',
      '• Fórmula exclusiva desenvolvida por zootecnista — energia, proteína, fibra e minerais na medida exata',
      '• Matérias-primas nobres: milho flocado, farelo de soja 48% toasted, núcleo mineral/vitamínico premium',
      '• Proteína bruta ajustada: 16-22% (bovinos corte), 18-20% (leite), 20-24% (suínos/aves) — sem desperdício',
      '• FDN otimizado (35-45%) — ruminação saudável, pH ruminal estável, zero acidose/subaguda',
      '• Aditivos de performance: ionóforo (monensina/lasalocida) + levedura viva + enzimas fibrolíticas',
      '• Peletização 4-6mm (durabilidade > 95%) — menos farelo no cocho, melhor aproveitamento',
      '• Controle rigoroso de micotoxinas: aflatoxina < 20 ppb, fumonisina < 5 ppm, zearalenona < 500 ppb',
      '• Embalagem inviolável: sacos 30-40kg tripla camada ou Big Bag com atmosfera modificada',
      '• Validade real: 180 dias (farelo) a 12 meses (peletizada) — frescor garantido na entrega',
      '**DIFERENCIAL**: Acompanhamento nutricional gratuito — ajustamos a fórmula conforme fase do rebanho e resultados de pesagem'
    ],
    'Máquinas': [
      '**POTÊNCIA E CONFIABILIDADE PARA SUA OPERAÇÃO**',
      '• Revisão completa 210 pontos: motor, transmissão, hidráulica, direção, freios, cabina, elétrica, pneus/esteiras',
      '• Horímetro certificado: leitura real, sem adulteração — histórico de manutenção documentado',
      '• Troca de todos os fluidos e filtros (óleo motor, hidráulico, transmissão, ar, combustível, ar condicionado)',
      '• Implementos homologados: plantadeira (linha/taxa variável), pulverizador (barras 24-36m), carreta (3 eixos)',
      '• Tecnologia embarcada: piloto automático RTK, telemetria, monitor de plantio/pulverização (opcional)',
      '• Documentação em dia: NF aquisição, manual operador, CAT, ART de inspeção, seguro RCTR-C',
      '• Operador certificado NR-11/12 incluso na diária — você foca na gestão, nós operamos com segurança',
      '• Disponibilidade 98%: frota reserva estratégica — sua operação não para por quebra',
      '• Logística própria: transporte em prancha baixa, escolta se necessário, entrega na porteira da fazenda',
      '**DIFERENCIAL**: Contrato flexível — diária, hectare ou safra completa. Cláusula de performance: se não render, não paga'
    ],
    'Outros': [
      '**PROTEÇÃO DA LAVOURA COM TECNOLOGIA E RESPONSABILIDADE**',
      '• Produto registrado MAPA/ANVISA/IBAMA — número de registro no rótulo, consulta pública no Agrofit',
      '• Ingrediente ativo de última geração: concentração garantida, pureza técnica > 97%',
      '• Formulação avançada: CE (emulsionável), SC (suspensão), WG (grânulos dispersíveis), OD (dispersão óleo-água)',
      '• Perfil toxicológico favorável: Classe III/IV (pouco tóxico) — EPI padrão, carência curta, menor risco ao aplicador',
      '• Classe ambiental: baixo risco à fauna aquática e abelhas (quando aplicado corretamente — siga a bula!)',
      '• Embalagens certificadas: tríplice lavagem + inutilização + destinação final rastreável (inpEV)',
      '• Lote com rastreabilidade 4.0: QR Code com FISPQ, bula, certificado de análise, receita agronômica digital',
      '• Validade 24-36 meses — estoque fresco, rotação FIFO garantida no nosso CD',
      '• Receita agronômica digital assinada por Eng. Agrônomo (CREA ativo) — emissão em 24h via app',
      '**DIFERENCIAL**: Programa Manejo Integrado — recomendamos rotação de MoA, refugio, monitoramento de pragas. Resultado: menor custo/ha, maior sustentabilidade'
    ]
  };

  const categoryDetails = details[category];
  if (!categoryDetails) return null;

  // Extrai informações específicas do prompt para personalizar
  const customLines = [];

  // Extrai variedade/cultivar se mencionada
  const varietyMatch = prompt.match(/(cultivar|variedade|híbrido|híbrida)\s+([a-zá-ú0-9\s-]+)/i);
  if (varietyMatch && category === 'Grãos') {
    customLines.unshift(`• Cultivar/Variedade: ${varietyMatch[2].trim().toUpperCase()}`);
  }

  // Extrai formulação NPK se mencionada
  const npkMatch = prompt.match(/(\d{1,2}[-\s]?\d{1,2}[-\s]?\d{1,2})/);
  if (npkMatch && category === 'Fertilizantes') {
    customLines.unshift(`• Formulação NPK: ${npkMatch[1].replace(/\s/g, '-')}`);
  }

  // Extrai ingrediente ativo se mencionado
  const activeMatch = prompt.match(/(glifosato|2,4-d|dicamba|atrazina|clomazone|sulfentrazone|imazetapir|tebuconazol|azoxistrobina|picoxistrobina|cipermetrina|lambda-cialotrina|bifentrina)/i);
  if (activeMatch && category === 'Outros') {
    customLines.unshift(`• Ingrediente ativo principal: ${activeMatch[1].toUpperCase()}`);
  }

  // Extrai marca/modelo para máquinas
  const modelMatch = prompt.match(/(john deere|massey|new holland|case|valtra|agrale|stara|jacto|kuhn|baldan|marchesan)\s+([a-z0-9\s-]+)/i);
  if (modelMatch && category === 'Máquinas') {
    customLines.unshift(`• Marca/Modelo: ${modelMatch[1].toUpperCase()} ${modelMatch[2].trim().toUpperCase()}`);
  }

  const allLines = [...customLines, ...categoryDetails];
  return allLines.join('\n');
}

// Extrai palavras-chave de qualidade/valor do prompt (até 3) para a descrição criativa
function extractQualityPhrase(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  const qualityKeywords = [];
  if (/selecionad[ao]|escolhid[ao]|premium|especial|gourmet|artesanal/.test(lowerPrompt)) qualityKeywords.push('selecionados com rigor');
  if (/m[ãa]o|manual|artesanal/.test(lowerPrompt)) qualityKeywords.push('colhidos/processados à mão');
  if (/melhor|excelente|ótimo|superior|primeira|top/.test(lowerPrompt)) qualityKeywords.push('qualidade superior');
  if (/preço|barato|acessível|justo|competitiv[ao]|promoção|oferta/.test(lowerPrompt)) qualityKeywords.push('preço imbatível');
  if (/fresco|recente|nova safra|safra atual/.test(lowerPrompt)) qualityKeywords.push('safra fresca');
  if (/orgânico|agroecológico|natural|sem agrotóxico/.test(lowerPrompt)) qualityKeywords.push('produção natural');
  if (/tradicional|herança|família|avô|pai|geração/.test(lowerPrompt)) qualityKeywords.push('tradição familiar');
  if (/sustentável|regenerativo|carbono|preservação/.test(lowerPrompt)) qualityKeywords.push('agricultura regenerativa');

  return qualityKeywords.length
    ? qualityKeywords.slice(0, 3).join(', ')
    : 'qualidade comprovada';
}

// --- FUNÇÃO PARA GERAR DESCRIÇÃO CRIATIVA DE MARKETING ---
function generateCreativeDescription(name, category, prompt, price, unit, stock, location) {
  const city = location ? location.split(' - ')[0] : 'nossa fazenda';
  const qualityPhrase = extractQualityPhrase(prompt);

  // Templates criativos por categoria
  const templates = {
    'Grãos': [
      `${name}: grãos ${qualityPhrase}, direto da ${city} para seu plantio.`,
      `Sementes de ${name.toLowerCase()} — ${qualityPhrase}, germinação vigorosa, lavoura uniforme.`,
      `Lote especial de ${name.toLowerCase()}: ${qualityPhrase}, pureza varietal garantida, pronto para render.`
    ],
    'Fertilizantes': [
      `${name}: fertilizante ${qualityPhrase}, nutrição precisa para sua lavoura render mais.`,
      `Adubo ${name.toLowerCase()} — ${qualityPhrase}, solubilidade total, raiz forte desde o início.`,
      `${name}: a escolha certa para quem busca ${qualityPhrase} e custo-benefício real no hectare.`
    ],
    'Rações': [
      `${name}: ração ${qualityPhrase}, formulada para conversão alimentar máxima e lucro no bolso.`,
      `Nutrição animal com ${name.toLowerCase()} — ${qualityPhrase}, animais saudáveis, produção recorde.`,
      `Ração premium ${name}: ${qualityPhrase}, palatabilidade irresistível, ganho de peso consistente.`
    ],
    'Máquinas': [
      `${name}: máquina ${qualityPhrase}, revisada e pronta para trabalhar na sua fazenda.`,
      `Equipamento ${name.toLowerCase()} — ${qualityPhrase}, operador incluso, produtividade garantida.`,
      `Locação de ${name}: ${qualityPhrase}, tecnologia de ponta, custo por hectare imbatível.`
    ],
    'Outros': [
      `${name}: insumo ${qualityPhrase}, eficácia comprovada no controle, segurança na aplicação.`,
      `${name.toLowerCase()} — ${qualityPhrase}, tecnologia de ponta, resultado visível na lavoura.`,
      `Defensivo ${name}: ${qualityPhrase}, manejo inteligente, proteção que rende mais.`
    ]
  };

  const categoryTemplates = templates[category] || templates['Outros'];
  const baseDesc = categoryTemplates[Math.floor(Math.random() * categoryTemplates.length)];

  // Adiciona detalhes contextuais se disponíveis
  const details = [];
  if (price && unit) details.push(`R$ ${price.toFixed(2)}/${unit}`);
  if (stock) details.push(`${stock} ${unit || 'unidades'} disponíveis`);
  if (location) details.push(`Origem: ${city}`);

  const detailStr = details.length ? ` | ${details.join(' • ')}` : '';

  return `${baseDesc}${detailStr}\n\nEntre em contato para fechar negócio direto com o produtor!`;
}

// Categoria pelas palavras-chave (com pontuação: mais matches = mais confiável).
function detectCategory(prompt) {
  const scored = AI_KEYWORDS
    .map(k => ({ ...k, score: k.match.filter(word => prompt.includes(word)).length }))
    .filter(k => k.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0] || null;
}

// Preço: aceita "R$ 250,50", "250 reais", "por 250", "a 250", "vender por 250".
function extractPrice(prompt) {
  const priceMatch = prompt.match(/r\$\s*(\d{1,6}(?:[.,]\d{1,2})?)|(\d{1,6}(?:[.,]\d{1,2})?)\s*reais|por\s+r?\$?\s*(\d{1,6}(?:[.,]\d{1,2})?)/);
  if (!priceMatch) return null;
  const raw = (priceMatch[1] || priceMatch[2] || priceMatch[3] || '').replace(',', '.');
  const price = parseFloat(raw);
  return !price || price <= 0 || price > 1000000 ? null : price;
}

const toInteger = (text) => parseInt(text.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'), 10) || null;

function quotedUnitOf(word) {
  if (/^ton/.test(word)) return 'tonelada';
  if (/^cabe/.test(word) || /^unid/.test(word)) return 'unidade';
  if (/^(kg|quilo)/.test(word)) return 'kg';
  return null;
}

// Quantidade: "40 toneladas" OU "467 de estoque", "467 kg disponíveis".
function extractStock(prompt) {
  const stockMatch = prompt.match(/(\d[\d.,]*)\s*(unidades?|toneladas?|tons?|cabe[cç]as?|kg|quilos?)/);
  if (stockMatch) return { stock: toInteger(stockMatch[1]), quotedUnit: quotedUnitOf(stockMatch[2]) };
  const stockDeMatch = prompt.match(/(\d[\d.,]*)\s*(?:de\s*)?(?:estoque|dispon(?:i|í)ve(?:l|is)|em\s*estoque)/);
  return { stock: stockDeMatch ? toInteger(stockDeMatch[1]) : null, quotedUnit: null };
}

// Unidade: prioriza a citada junto da quantidade; senão "o kg"; senão deduz do texto; senão usa a da
// categoria detectada.
function detectUnit(prompt, quotedUnit, found) {
  const alias = UNIT_ALIASES.find(a => a.match.test(prompt));
  return quotedUnit
    || (alias ? alias.unit : null)
    || (/(granel)/.test(prompt) ? 'tonelada' : null)
    || (found ? found.unit : null);
}

const BRAZILIAN_UFS = /^(ac|al|ap|am|ba|ce|df|es|go|ma|mt|ms|mg|pa|pb|pr|pe|pi|rj|rn|rs|ro|rr|sc|sp|se|to)$/;

// Localização: "Cidade - UF" (hífen) OU "em Cidade" / "em <palavra>" no final do texto
// (ex: "... arcórz mg", "... disponível na fazenda em Arcos MG").
// Fallback "em Cidade" só aceita palavras com 4+ letras para não capturar ruído.
function extractLocation(prompt) {
  const locMatch =
    prompt.match(/\b([a-zá-ú]{3,20}(?:\s[a-zá-ú]{3,20})?)\s*[-–]\s*([a-z]{2})\b/) ||
    prompt.match(/(?:em|região de)\s+([a-zá-ú]{3,20}(?:\s[a-zá-ú]{3,20})?)\s*[-–,]\s*([a-z]{2})\b/) ||
    prompt.match(/\b([a-zá-ú]{4,20})\s+([a-z]{2})\b(?=\s*[,.;]|$)/) ||
    prompt.match(/(?:em|de)\s+([a-zá-ú]{4,20})\s+([a-z]{2})\s*(?:[,.;]|$)/);
  if (!locMatch) return null;
  const city = locMatch[1].trim();
  const uf = locMatch[2].toLowerCase();
  const words = city.split(/\s+/);
  const valid = BRAZILIAN_UFS.test(uf) && !/\d/.test(city) && words.every(w => w.length >= 3) && !/^(mapa|laudo|nfe|nf|estoque|reais)$/.test(city.split(/\s+/).pop());
  return valid ? `${city.replace(/\b\w/g, c => c.toUpperCase())} - ${uf.toUpperCase()}` : null;
}

// Certificação / documentação citada no texto.
function extractCert(prompt) {
  const certParts = [];
  if (/mapa/.test(prompt)) certParts.push('Registro MAPA');
  if (/nf-e|nota fiscal eletrônica|nfe|nota fiscal/.test(prompt)) certParts.push('Emite NF-e');
  if (/laudo/.test(prompt)) certParts.push('Laudo de análise');
  if (/orgânic|organico/.test(prompt)) certParts.push('Certificação orgânica');
  if (/certificad/.test(prompt)) certParts.push('Certificado de origem');
  return certParts.length ? certParts.join(' • ') : null;
}

// Título com o nome comercial do produto detectado + possíveis qualificadores seguintes
// (marca/modelo/tipo). Ex: "café pilão" -> "Café Pilão"; "trator 4x4" -> "Trator 4x4".
function nameFromProducts(prompt, matchedProducts) {
  const firstWord = matchedProducts[0].match;
  const idx = prompt.indexOf(firstWord);
  const after = prompt.slice(idx + firstWord.length).trim();
  const nextTokens = after.split(/\s+/).slice(0, 2).map(t => t.replace(/[^a-zá-ú\dx]+$/i, '')).filter(t =>
    t.length >= 2 && /^[a-zá-ú][a-zá-ú\dx]*$/i.test(t) &&
    !/^(r\$|\d|reais|por|a|o|em|com|de|estoque|kg|toneladas?|unidades?)$/.test(t)
  );
  let name = [firstWord, ...nextTokens].join(' ').replace(/(^|\s)(\S)/g, (m, p1, p2) => p1 + p2.toUpperCase());
  if (matchedProducts.length > 1 && matchedProducts[1].name !== matchedProducts[0].name) {
    name += ` + ${matchedProducts[1].name}`;
  }
  return name;
}

// Título: sem produto conhecido, usa o texto do produtor limpo (sem preços/quantidades), máx. 6 palavras.
function extractName(prompt) {
  const matchedProducts = PRODUCT_NAMES
    .filter(p => prompt.includes(p.match))
    .sort((a, b) => b.match.length - a.match.length);
  if (matchedProducts.length) return nameFromProducts(prompt, matchedProducts);
  const cleaned = prompt
    .replace(/(?:r\$\s*)?\d[\d.,]*/g, ' ') // remove preços e quantidades
    .replace(/\b(reais|por|a|em|com|unidades?|toneladas?)\b/g, (m) => /\b(a|em|com|por)\b/.test(m) ? m : ' ')
    .split(/\s+/).filter(Boolean).slice(0, 6).join(' ');
  if (cleaned.length >= 3) return cleaned.replace(/(^|\s)([a-zá-ú])/g, (m, p1, p2) => p1 + p2.toUpperCase());
  return 'Anúncio AgroTech';
}

// Ficha técnica montada com os dados extraídos (quando o produtor pede "crie/gere descrição").
function technicalSheet(prompt, d) {
  const lines = [];
  if (d.name) lines.push(`Produto: ${d.name}`);
  if (d.category) lines.push(`Categoria: ${d.category}`);
  if (d.price) lines.push(`Preço de referência: R$ ${d.price.toFixed(2)}${d.unit ? ` por ${d.unit}` : ''}`);
  if (d.stock) lines.push(`Estoque disponível: ${d.stock}${d.unit ? ` ${d.unit}` : ''}`);
  if (d.location) lines.push(`Origem: ${d.location}`);
  if (d.cert) lines.push(`Documentação: ${d.cert}`);

  // Descrição técnica detalhada por categoria
  const techDetails = getTechnicalDetails(d.category, prompt);
  if (techDetails) lines.push(`\n--- FICHA TÉCNICA ---\n${techDetails}`);

  const rawWanted = prompt.replace(/,?\s*crie?\s*(?:uma\s*)?descri[cç][ãa]o(?:\s*por\s*favor)?\s*$/i, '').trim();
  if (rawWanted && rawWanted.length > 5) lines.push(`\nObservações do produtor: ${rawWanted}`);
  lines.push('\nEntre em contato para negociar condições, frete e pagamento.');
  return lines.join('\n');
}

/**
 * @param {string} text descrição livre (qualquer caixa)
 * @returns {{ name: string, price: number | null, unit: string | null, category: string | null,
 *   stock: number | null, location: string | null, cert: string | null, description: string }}
 */
export function draftFromPrompt(text) {
  const prompt = String(text || '').trim().toLowerCase();
  const found = detectCategory(prompt);
  const { stock, quotedUnit } = extractStock(prompt);
  const draft = {
    name: extractName(prompt),
    price: extractPrice(prompt),
    unit: detectUnit(prompt, quotedUnit, found),
    category: found ? found.category : null,
    stock,
    location: extractLocation(prompt),
    cert: extractCert(prompt)
  };
  // Descrição: se o produtor pediu para "criar/gerar descrição", ficha técnica com os dados extraídos;
  // senão, descrição criativa de marketing.
  const wantsGenerated = /crie|criar|gere|gerar|fa[zç]a?|monte|montar|escreva|escrever/.test(prompt) && /descri/.test(prompt);
  const description = wantsGenerated
    ? technicalSheet(prompt, draft)
    : generateCreativeDescription(draft.name, draft.category, prompt, draft.price, draft.unit, draft.stock, draft.location);
  return { ...draft, description };
}
