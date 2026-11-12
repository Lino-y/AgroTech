// Caracterização da "IA" do anúncio (packages/domain/listing.js), gravada antes de dividir a função:
// os campos e a ficha técnica têm que sair iguais. A descrição criativa sorteia um modelo, então só
// se confere que existe e cita o produto.
import test from "node:test";
import assert from "node:assert/strict";
import { draftFromPrompt } from "../packages/domain/listing.js";

const CASES = [
  {
    "prompt": "Tenho 5000 kg de milho híbrido cultivar BRS 1010, R$ 120 o kg, colhido out/2025, germinação 95%, silo seco, retirada imediata na fazenda Rio Verde-GO. Crie descrição técnica completa.",
    "fields": {
      "name": "Milho Híbrido Cultivar",
      "price": 120,
      "unit": "kg",
      "category": "Grãos",
      "stock": 5000,
      "location": "Rio Verde - GO",
      "cert": null
    },
    "description": "Produto: Milho Híbrido Cultivar\nCategoria: Grãos\nPreço de referência: R$ 120.00 por kg\nEstoque disponível: 5000 kg\nOrigem: Rio Verde - GO\n\n--- FICHA TÉCNICA ---\n• Cultivar/Variedade: CULTIVAR BRS 1010\n**QUALIDADE GARANTIDA PARA ALTA PRODUTIVIDADE**\n• Sementes certificadas MAPA — pureza varietal ≥ 98%, germinação ≥ 90% (laudo anexo)\n• Tratamento industrial premium: fungicida sistêmico + inseticida + polímero colorido (rastreabilidade visual)\n• Umidade controlada 12-14% — prontas para plantio imediato, sem necessidade de secagem\n• Vigor testado: tetrazólio e envelhecimento acelerado — emergência rápida e uniforme no campo\n• Isentas de sementes de plantas daninhas quarentenárias (ex: amaranto, caruru, trapoeraba)\n• Embalagem rastreável: sacos 60kg ráfia laminada ou Big Bag 1.000kg com QR Code do lote\n• Validade do tratamento: 120 dias — proteção na fase crítica de estabelecimento da lavoura\n• Recomendação técnica: profundidade 3-5cm, velocidade 5-7 km/h, adubação de base conforme análise de solo\n• Janela de plantio otimizada para sua região — consulte nosso calendário safra 2026/27\n**DIFERENCIAL**: Lote com rastreabilidade total do campo à saca — transparência que valoriza sua colheita\n\nObservações do produtor: tenho 5000 kg de milho híbrido cultivar brs 1010, r$ 120 o kg, colhido out/2025, germinação 95%, silo seco, retirada imediata na fazenda rio verde-go. crie descrição técnica completa.\n\nEntre em contato para negociar condições, frete e pagamento."
  },
  {
    "prompt": "trator 4x4 seminovo R$ 85000, crie uma descrição",
    "fields": {
      "name": "Trator Seminovo",
      "price": 85000,
      "unit": "unidade",
      "category": "Máquinas",
      "stock": null,
      "location": null,
      "cert": null
    },
    "description": "Produto: Trator Seminovo\nCategoria: Máquinas\nPreço de referência: R$ 85000.00 por unidade\n\n--- FICHA TÉCNICA ---\n**POTÊNCIA E CONFIABILIDADE PARA SUA OPERAÇÃO**\n• Revisão completa 210 pontos: motor, transmissão, hidráulica, direção, freios, cabina, elétrica, pneus/esteiras\n• Horímetro certificado: leitura real, sem adulteração — histórico de manutenção documentado\n• Troca de todos os fluidos e filtros (óleo motor, hidráulico, transmissão, ar, combustível, ar condicionado)\n• Implementos homologados: plantadeira (linha/taxa variável), pulverizador (barras 24-36m), carreta (3 eixos)\n• Tecnologia embarcada: piloto automático RTK, telemetria, monitor de plantio/pulverização (opcional)\n• Documentação em dia: NF aquisição, manual operador, CAT, ART de inspeção, seguro RCTR-C\n• Operador certificado NR-11/12 incluso na diária — você foca na gestão, nós operamos com segurança\n• Disponibilidade 98%: frota reserva estratégica — sua operação não para por quebra\n• Logística própria: transporte em prancha baixa, escolta se necessário, entrega na porteira da fazenda\n**DIFERENCIAL**: Contrato flexível — diária, hectare ou safra completa. Cláusula de performance: se não render, não paga\n\nObservações do produtor: trator 4x4 seminovo r$ 85000\n\nEntre em contato para negociar condições, frete e pagamento."
  },
  {
    "prompt": "Vendo 40 toneladas de soja a granel por 150 reais, nota fiscal e laudo, em Rio Verde - GO",
    "fields": {
      "name": "Soja Granel",
      "price": 150,
      "unit": "tonelada",
      "category": "Grãos",
      "stock": 40,
      "location": "Rio Verde - GO",
      "cert": "Emite NF-e • Laudo de análise"
    },
    "mentions": "Soja"
  },
  {
    "prompt": "ração para gado premium 30 kg 89,90 reais 467 de estoque",
    "fields": {
      "name": "Ração Para Gado",
      "price": 89.9,
      "unit": "kg",
      "category": "Rações",
      "stock": 30,
      "location": null,
      "cert": null
    },
    "mentions": "Ração"
  },
  {
    "prompt": "café orgânico selecionado tradição de família em Arcos MG",
    "fields": {
      "name": "Café Orgânico Selecionado",
      "price": null,
      "unit": "kg",
      "category": "Grãos",
      "stock": null,
      "location": "Arcos - MG",
      "cert": "Certificação orgânica"
    },
    "mentions": "Café"
  }
];

for (const item of CASES) {
  test(`rascunho: ${item.prompt.slice(0, 48)}...`, () => {
    const { description, ...fields } = draftFromPrompt(item.prompt);
    assert.deepEqual(fields, item.fields);
    if (item.description !== undefined) assert.equal(description, item.description);
    else {
      assert.ok(description.length > 40);
      if (item.mentions) assert.ok(description.toLowerCase().includes(item.mentions.toLowerCase()));
    }
  });
}

test("texto vazio vira rascunho genérico, sem quebrar", () => {
  const draft = draftFromPrompt("");
  assert.equal(draft.name, "Anúncio AgroTech");
  assert.equal(draft.price, null);
});
