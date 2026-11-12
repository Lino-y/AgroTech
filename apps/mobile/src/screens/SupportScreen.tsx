import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { Tap } from '../components/Tap.tsx';
import { ui } from '../components/ui.ts';
import { buildSupportReply } from '../domain.ts';
import { colors, MIN_TOUCH, radius } from '../theme.ts';

type Message = { from: 'user' | 'bot'; text: string };
type Props = { propertyOrCompany?: string; onBack: () => void; onOpenOrders: () => void };

const QUICK = ['Rastrear meu pedido', 'Formas de pagamento', 'Frete grátis', 'Falar com atendente'];

// Suporte: o mesmo robô de respostas da web (buildSupportReply, packages/domain/support.js). Funciona
// sem internet, porque as respostas ficam no app. "Rastrear" leva aos pedidos, como na web.
export function SupportScreen({ propertyOrCompany, onBack, onOpenOrders }: Props): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([
    { from: 'bot', text: 'Olá! Sou o assistente do AgroTech. Como posso ajudar?' }
  ]);
  const [text, setText] = useState('');
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  function send(raw: string): void {
    const message = raw.trim();
    if (!message) return;
    const reply = buildSupportReply(message, { propertyOrCompany });
    setMessages((current) => [...current, { from: 'user', text: message }, { from: 'bot', text: reply.text }]);
    setText('');
    if (reply.nextScreen === 'orders') setTimeout(onOpenOrders, 1200);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Suporte" subtitle="Respostas na hora, mesmo sem internet" onBack={onBack} />
      <ScrollView ref={scrollRef} contentContainerStyle={ui.scroll}>
        {messages.map((message, index) => (
          <View key={index} style={[styles.bubble, message.from === 'user' ? styles.user : styles.bot]}>
            <Text style={message.from === 'user' ? styles.userText : ui.text}>{message.text}</Text>
          </View>
        ))}
        <View style={styles.quick}>
          {QUICK.map((item) => (
            <Tap key={item} accessibilityRole="button" onPress={() => send(item)} style={ui.chip}>
              <Text style={ui.chipText}>{item}</Text>
            </Tap>
          ))}
        </View>
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          accessibilityLabel="Mensagem para o suporte"
          placeholder="Escreva sua dúvida"
          placeholderTextColor={colors.mutedForeground}
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => send(text)}
          returnKeyType="send"
          style={styles.input}
        />
        <View style={styles.sendButton}>
          <Button title="Enviar" onPress={() => send(text)} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', borderRadius: radius.card, padding: 12 },
  bot: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  user: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  userText: { fontSize: 14, color: colors.onPrimary },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface
  },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.field,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.foreground
  },
  sendButton: { minWidth: 96 }
});
