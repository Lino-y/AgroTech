import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TabBar } from './components/TabBar.tsx';
import { addToCart, cartCount, serializeCart, type CartLine } from './lib/cart.ts';
import { afterAuth, back, INITIAL_NAV, open, openTab, pendingReason, requireLogin, type Nav } from './lib/navigation.ts';
import { AccountScreen } from './screens/AccountScreen.tsx';
import { AuthScreen } from './screens/AuthScreen.tsx';
import { CartScreen } from './screens/CartScreen.tsx';
import { CatalogScreen } from './screens/CatalogScreen.tsx';
import { FinanceScreen } from './screens/FinanceScreen.tsx';
import { OrdersScreen } from './screens/OrdersScreen.tsx';
import { ProductDetailScreen } from './screens/ProductDetailScreen.tsx';
import { SellScreen } from './screens/SellScreen.tsx';
import { onSessionExpired } from './services/api.ts';
import { logout, type User } from './services/auth.ts';
import { getSession, readCache, saveCache, setKeyValueStore, setSecureStore } from './services/storage.ts';
import { colors } from './theme.ts';

// Raiz do app: sessão, carrinho (guardado no aparelho, Fase 3) e navegação (abas + pilha). Como na web, o app abre no
// catálogo; comprar, anunciar, financeiro e pedidos pedem conta e voltam ao destino depois do login.
export default function App(): React.JSX.Element {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [nav, setNav] = useState<Nav>(INITIAL_NAV);
  const [cart, setCart] = useState<CartLine[]>([]);
  const loggedIn = user !== null;

  useEffect(() => {
    setSecureStore(SecureStore);
    setKeyValueStore(AsyncStorage);
    // O carrinho volta como foi deixado; o preço é revalidado no checkout (RN05).
    Promise.all([getSession(), readCache<CartLine[]>('cart', null)]).then(([session, savedCart]) => {
      setUser(session ? (session.user as unknown as User) : null);
      if (savedCart) setCart(savedCart.data);
      setReady(true);
    });
    // Sessão que caiu no servidor (token revogado, API reiniciada): volta a visitante, e as abas que
    // exigem conta pedem a entrada de novo.
    onSessionExpired(() => {
      setUser(null);
      setNav((current) =>
        current.tab === 'sell' || current.tab === 'finance' ? requireLogin(INITIAL_NAV, { tab: current.tab }) : current
      );
    });
    return () => onSessionExpired(null);
  }, []);

  // Guarda o carrinho a cada mudança (só produto e quantidade: nada de pagamento, RN06).
  useEffect(() => {
    if (ready) void saveCache('cart', serializeCart(cart), null);
  }, [cart, ready]);

  // Botão voltar do Android: desempilha a tela; no catálogo sem nada empilhado, deixa o app fechar.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const next = back(nav);
      if (!next) return false;
      setNav(next);
      return true;
    });
    return () => subscription.remove();
  }, [nav]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const goBack = () => setNav((current) => back(current) ?? INITIAL_NAV);
  const top = nav.stack[nav.stack.length - 1];

  async function signOut(): Promise<void> {
    await logout();
    setUser(null);
    setNav(INITIAL_NAV);
  }

  function renderScreen(): React.JSX.Element {
    if (top?.name === 'auth') {
      return (
        <AuthScreen
          key={`auth-${top.mode ?? 'login'}`}
          initialMode={top.mode}
          reason={pendingReason(top.pending)}
          onBack={goBack}
          onAuthenticated={(authenticated) => {
            setUser(authenticated);
            setNav((current) => afterAuth(current));
          }}
        />
      );
    }
    if (top?.name === 'product') {
      return (
        <ProductDetailScreen
          product={top.product}
          onBack={goBack}
          onAdd={(product, quantity) => setCart((lines) => addToCart(lines, product, quantity))}
          onGoToCart={() => setNav((current) => openTab(current, 'cart', loggedIn))}
        />
      );
    }
    if (top?.name === 'orders') {
      return <OrdersScreen onBack={goBack} onBrowse={() => setNav(INITIAL_NAV)} />;
    }

    const account = (
      <AccountScreen
        user={user}
        onLogin={() => setNav((current) => requireLogin(current, null))}
        onRegister={() => setNav((current) => requireLogin(current, null, 'register'))}
        onOrders={() => setNav((current) => open(current, { name: 'orders' }, loggedIn))}
        onLogout={signOut}
      />
    );

    switch (nav.tab) {
      case 'cart':
        return (
          <CartScreen
            lines={cart}
            loggedIn={loggedIn}
            onChange={setCart}
            onNeedLogin={() => setNav((current) => requireLogin(current, { tab: 'cart' }))}
            onOrdered={() => {
              setCart([]);
              setNav(open({ tab: 'account', stack: [] }, { name: 'orders' }, true));
            }}
            onBrowse={() => setNav(INITIAL_NAV)}
          />
        );
      case 'sell':
        return user ? <SellScreen email={user.email} /> : account;
      case 'finance':
        return user ? <FinanceScreen /> : account;
      case 'account':
        return account;
      default:
        return (
          <CatalogScreen
            userName={user?.name ?? null}
            onOpenProduct={(product) => setNav((current) => open(current, { name: 'product', product }, loggedIn))}
          />
        );
    }
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: colors.background }}>{renderScreen()}</View>
      {top?.name === 'auth' ? null : (
        <TabBar
          active={nav.tab}
          cartCount={cartCount(cart)}
          onSelect={(tab) => setNav((current) => openTab(current, tab, loggedIn))}
        />
      )}
    </SafeAreaProvider>
  );
}
