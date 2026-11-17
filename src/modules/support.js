import { buildSupportReply } from '../services/support.js';

// Wrapper de compatibilidade: a única fonte de verdade das respostas é
// buildSupportReply (src/services/support.js). Sem tabela duplicada aqui.
export class SupportBot {
  reply(message) {
    const reply = buildSupportReply(message);
    return { text: reply.text, isHuman: reply.isHuman };
  }
}
