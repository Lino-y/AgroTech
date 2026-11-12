import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Tap } from '../components/Tap.tsx';
import { Icon } from '../components/Icon.tsx';
import { Button } from '../components/Button.tsx';
import { Field } from '../components/Field.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { Stepper } from '../components/Stepper.tsx';
import { ui } from '../components/ui.ts';
import { validateCouponCode } from '../domain.ts';
import { cartSummary, setQuantity, removeFromCart, toOrderItems, type CartLine } from '../lib/cart.ts';
import { formatPrice } from '../lib/catalog.ts';
import { ApiError } from '../services/api.ts';
import { newIdempotencyKey, placeOrder, type Order } from '../services/orders.ts';
import { colors, iconSize, MIN_TOUCH, radius } from '../theme.ts';

// Formas da web (renderPaymentScreen). Pagamento simulado: nada daqui vai para o servidor e o app
// nunca pede dado de cartão (ADR-0001: nunca guardar nem enviar cartão).
const PAYMENTS = [
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'credit', label: 'Cartão de crédito (até 6x sem juros)' }
] as const;

type Props = {
  lines: CartLine[];
  loggedIn: boolean;
  onChange: (lines: CartLine[]) => void;
  onNeedLogin: () => void;
  onOrdered: (order: Order) => void;
  onBrowse: () => void;
};

export function CartScreen({ lines, loggedIn, onChange, onNeedLogin, onOrdered, onBrowse }: Props): React.JSX.Element {
  const [couponText, setCouponText] = useState('');
  const [coupon, setCoupon] = useState<string | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [payment, setPayment] = useState<(typeof PAYMENTS)[number]['value']>('pix');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mesma chave nas tentativas do mesmo carrinho (toque duplo, rede caiu); nova se o carrinho mudar.
  const keyRef = useRef(newIdempotencyKey());

  useEffect(() => {
    keyRef.current = newIdempotencyKey();
  }, [lines, coupon]);

  const summary = cartSummary(lines, coupon);

  function applyCoupon(): void {
    const result = validateCouponCode(couponText, summary.subtotal);
    if (result.valid) {
      setCoupon(result.coupon ?? null);
      setCouponMessage(`Cupom ${result.coupon} aplicado: ${result.rule?.description ?? ''}`);
    } else {
      setCoupon(null);
      setCouponMessage(result.message ?? 'Cupom inválido.');
    }
  }

  async function checkout(): Promise<void> {
    if (sending) return;
    if (!loggedIn) {
      onNeedLogin();
      return;
    }
    setSending(true);
    setError(null);
    try {
      const order = await placeOrder(toOrderItems(lines), coupon, keyRef.current);
      setCoupon(null);
      setCouponText('');
      setCouponMessage(null);
      // O total que vale é o do servidor (preço do catálogo dele), não o calculado na tela.
      Alert.alert('Pedido confirmado', `Pedido ${order.id}\nTotal: ${formatPrice(order.total)}`);
      onOrdered(order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível finalizar a compra. Tente de novo.');
    } finally {
      setSending(false);
    }
  }

  if (lines.length === 0) {
    return (
      <View style={ui.screen}>
        <ScreenHeader title="Carrinho" />
        <View style={ui.center}>
          <Icon name="cart-outline" size={iconSize.xl} color={colors.secondaryForeground} />
          <Text style={ui.sectionTitle}>Seu carrinho está vazio</Text>
          <Text style={ui.muted}>Escolha insumos no catálogo e adicione aqui.</Text>
          <Button title="Ver catálogo" variant="outline" onPress={onBrowse} />
        </View>
      </View>
    );
  }

  return (
    <View style={ui.screen}>
      <ScreenHeader title="Carrinho" subtitle={`${lines.length} ${lines.length === 1 ? 'produto' : 'produtos'}`} />
      <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
        {lines.map((line) => (
          <View key={line.product.id} style={ui.card}>
            <View style={ui.row}>
              <View style={[styles.thumb, { backgroundColor: line.product.imageBg ?? colors.primarySoft }]}>
                <Text style={styles.thumbEmoji}>{line.product.imageEmoji ?? '📦'}</Text>
              </View>
              <View style={styles.lineInfo}>
                <Text style={ui.text} numberOfLines={2}>
                  {line.product.name}
                </Text>
                <Text style={styles.linePrice}>{formatPrice(line.product.price * line.quantity)}</Text>
              </View>
            </View>
            <View style={ui.between}>
              <Stepper
                label={`quantidade de ${line.product.name}`}
                value={line.quantity}
                onChange={(value) => onChange(setQuantity(lines, line.product.id, value))}
              />
              <Tap
                accessibilityRole="button"
                accessibilityLabel={`Remover ${line.product.name}`}
                onPress={() => onChange(removeFromCart(lines, line.product.id))}
                style={styles.remove}
              >
                <Icon name="trash-outline" size={iconSize.sm} color={colors.destructive} />
                <Text style={styles.removeText}>Remover</Text>
              </Tap>
            </View>
          </View>
        ))}

        <View style={ui.card}>
          <Field
            label="CUPOM"
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Ex: AGRO10"
            returnKeyType="done"
            onSubmitEditing={applyCoupon}
            value={couponText}
            onChangeText={setCouponText}
          />
          <Button title="Aplicar cupom" variant="outline" onPress={applyCoupon} />
          {couponMessage ? <Text style={coupon ? ui.success : ui.error}>{couponMessage}</Text> : null}
        </View>

        <View style={ui.card}>
          <Text style={ui.label}>FORMA DE PAGAMENTO</Text>
          {PAYMENTS.map((item) => {
            const selected = payment === item.value;
            return (
              <Tap
                key={item.value}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
                onPress={() => setPayment(item.value)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <View style={[styles.radio, selected && styles.radioSelected]} />
                <Text style={ui.text}>{item.label}</Text>
              </Tap>
            );
          })}
          <Text style={ui.muted}>Pagamento simulado nesta versão: nenhum dado de pagamento é pedido nem enviado.</Text>
        </View>

        <View style={ui.card}>
          <Row label="Subtotal" value={formatPrice(summary.subtotal)} />
          {summary.discount > 0 ? <Row label="Desconto" value={`− ${formatPrice(summary.discount)}`} /> : null}
          <Row label="Frete" value={summary.shipping === 0 ? 'Grátis' : formatPrice(summary.shipping)} />
          <View style={styles.divider} />
          <Row label="Total" value={formatPrice(summary.total)} strong />
          {!summary.freeShipping ? <Text style={ui.muted}>Frete grátis em compras acima de R$ 800,00.</Text> : null}
        </View>

        {error ? (
          <Text accessibilityLiveRegion="polite" style={ui.error}>
            {error}
          </Text>
        ) : null}
        <Button title={loggedIn ? 'Finalizar compra' : 'Entrar para finalizar'} onPress={checkout} loading={sending} />
      </ScrollView>
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }): React.JSX.Element {
  return (
    <View style={ui.between}>
      <Text style={strong ? styles.totalLabel : ui.text}>{label}</Text>
      <Text style={strong ? styles.totalValue : ui.text}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 56, height: 56, borderRadius: radius.field, alignItems: 'center', justifyContent: 'center' },
  thumbEmoji: { fontSize: 28 },
  lineInfo: { flex: 1, gap: 2 },
  linePrice: { fontSize: 15, fontWeight: '800', color: colors.primary },
  remove: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  removeText: { fontSize: 14, fontWeight: '700', color: colors.destructive },
  option: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.borderStrong
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  radioSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  totalValue: { fontSize: 18, fontWeight: '800', color: colors.primary }
});
