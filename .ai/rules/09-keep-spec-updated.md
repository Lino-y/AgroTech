# Rule 09 — Qualquer mudança em fluxo, regra ou arquitetura deve atualizar a spec correspondente

## Objetivo

Manter specs como fonte de verdade sincronizada com implementação.

## Descrição

Se durante implementação for descoberta uma mudança necessária em fluxo, regra de negócio ou decisão arquitetural, a spec deve ser atualizada imediatamente. Specs são o contrato entre negócio, produto e tech. Dessincronia causa futuros problemas.

## Quando aplicar

- Ao descobrir que requisito não é viável
- Ao otimizar fluxo durante implementação
- Ao mudar decisão técnica
- Ao adicionar validação ou regra não prevista

## Como validar

- Spec foi atualizada no commit ou PR
- Mudança foi justificada e documentada
- Impacto em outros módulos foi avaliado
- PO ou product foi notificado
- Rastreabilidade entre spec e código está clara

## Consequência de não seguir

- Specs desatualizadas e imprecisas
- Confusão entre o que foi planejado e o que foi feito
- Risco em próximas mudanças
- Difícil onboarding de novos desenvolvedores
- Perda de rastreabilidade
