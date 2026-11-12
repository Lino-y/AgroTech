import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
// Só o peso usado (Bold): o índice do pacote levaria as 9 variações da família para o APK.
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import { TabBar } from './components/TabBar.tsx';
import { addToCart, cartCount, serializeCart, type CartLine } from './lib/cart.ts';
import { afterAuth, back, INITIAL_NAV, open, openTab, pendingReason, requireLogin, type Nav } from './lib/navigation.ts';
import { AccountScreen } from './screens/AccountScreen.tsx';
import { AdminUsersScreen } from './screens/AdminUsersScreen.tsx';
import { FavoritesScreen } from './screens/FavoritesScreen.tsx';
import { ServerScreen } from './screens/ServerScreen.tsx';
import { SupportScreen } from './screens/SupportScreen.tsx';
import { UpdateScreen } from './screens/UpdateScreen.tsx';
import { AuthScreen } from './screens/AuthScreen.tsx';
import { CartScreen } from './screens/CartScreen.tsx';
import { CatalogScreen } from './screens/CatalogScreen.tsx';
import { FinanceScreen } from './screens/FinanceScreen.tsx';
import { OrdersScreen } from './screens/OrdersScreen.tsx';
import { ProductDetailScreen } from './screens/ProductDetailScreen.tsx';
import { SellScreen } from './screens/SellScreen.tsx';
import { getApiBaseUrl, onAppOutdated, onSessionExpired, setApiBaseUrl } from './services/api.ts';
import { APP_VERSION } from './config.ts';
import { availableUpdate } from './lib/server.ts';
import { loadAppConfig, loadSavedServer, saveServer } from './services/server.ts';
import { loadFavorites, toggleFavorite } from './services/favorites.ts';
import { flushOutbox, readOutbox } from './services/outbox.ts';
import type { Product } from './services/products.ts';
import { logout, type User } from './services/auth.ts';
import { clearSession, getSession, readCache, removeCache, saveCache, setKeyValueStore, setSecureStore } from './services/storage.ts';
import { colors, isDark } from './theme.ts';

// Raiz do app: sessão, carrinho (guardado no aparelho, Fase 3) e navegação (abas + pilha). Como na web, o app abre no
// catálogo; comprar, anunciar, financeiro e pedidos pedem conta e voltam ao destino depois do login.
export default function App(): React.JSX.Element {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [nav, setNav] = useState<Nav>(INITIAL_NAV);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [favorites, setFavorites] = useState<Product[]>([]);
  // Versão mínima pedida pela API (426): o app inteiro dá lugar à tela de atualizar.
  const [outdated, setOutdated] = useState<string | null>(null);
  // Versão nova anunciada pela API (link completo para baixar) e o link do APK para a tela do 426.
  const [update, setUpdate] = useState<{ version: string; url: string } | null>(null);
  const [downloadLink, setDownloadLink] = useState<string | null>(null);
  // Muda quando o servidor muda: recria o catálogo e busca a configuração do servidor novo.
  const [serverKey, setServerKey] = useState(0);
  // Fonte dos títulos (a da web). Se não carregar, segue com a do sistema em vez de travar.
  const [fontsLoaded, fontError] = useFonts({ Outfit_700Bold });
  const loggedIn = user !== null;

  useEffect(() => {
    setSecureStore(SecureStore);
    setKeyValueStore(AsyncStorage);
    // O carrinho volta como foi deixado; o preço é revalidado no checkout (RN05).
    // O endereço salvo entra antes de qualquer tela pedir algo ao servidor.
    Promise.all([getSession(), readCache<CartLine[]>('cart', null), loadSavedServer()]).then(([session, savedCart, server]) => {
      setApiBaseUrl(server);
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
    onAppOutdated((minVersion) => setOutdated(minVersion));
    return () => {
      onSessionExpired(null);
      onAppOutdated(null);
    };
  }, []);

  // Versão nova para baixar: pergunta ao servidor ao abrir o app e quando o servidor muda.
  useEffect(() => {
    if (!ready) return;
    loadAppConfig()
      .then((config) => {
        setUpdate(availableUpdate(config, APP_VERSION, getApiBaseUrl()));
        setDownloadLink(config.downloadUrl ? `${getApiBaseUrl()}${config.downloadUrl}` : null);
      })
      .catch(() => {
        // Sem rede ou servidor antigo sem esses campos: sem aviso, o resto do app segue.
      });
  }, [ready, serverKey, outdated]);

  // Ao entrar (ou abrir já logado): favoritos da conta e envio da fila de anúncios guardados offline.
  useEffect(() => {
    if (!user) {
      setFavorites([]);
      return;
    }
    void loadFavorites(user.id).then(setFavorites);
    void flushOutbox(user.id);
  }, [user]);

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

  if (!ready || (!fontsLoaded && !fontError)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const goBack = () => setNav((current) => back(current) ?? INITIAL_NAV);
  const top = nav.stack[nav.stack.length - 1];

  async function finishSignOut(): Promise<void> {
    await logout();
    setUser(null);
    setNav(INITIAL_NAV);
  }

  // Troca de servidor: a sessão e o catálogo salvo são do servidor antigo e saem. Anúncio na fila
  // também era para o servidor antigo: avisa antes. O carrinho fica (revalidado no checkout).
  async function applyServer(url: string | null): Promise<void> {
    await saveServer(url);
    setApiBaseUrl(url);
    await clearSession();
    await removeCache('cache:catalog');
    setUser(null);
    setUpdate(null);
    setServerKey((key) => key + 1);
    setNav(INITIAL_NAV);
  }

  async function changeServer(url: string | null): Promise<void> {
    const waiting = user ? (await readOutbox(user.id)).filter((item) => item.status === 'pending').length : 0;
    if (waiting === 0) return applyServer(url);
    Alert.alert(
      'Anúncios aguardando internet',
      `${waiting} ${waiting === 1 ? 'anúncio guardado foi feito' : 'anúncios guardados foram feitos'} para o servidor atual e só sai quando você voltar a ele.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Trocar mesmo assim', onPress: () => void applyServer(url) }
      ]
    );
  }

  const openDownload = (url: string) => {
    void Linking.openURL(url);
  };

  // Anúncio guardado offline fica na fila da conta e sai quando ela entrar de novo: avisa antes de sair.
  async function signOut(): Promise<void> {
    const waiting = user ? (await readOutbox(user.id)).filter((item) => item.status === 'pending').length : 0;
    if (waiting === 0) return finishSignOut();
    Alert.alert(
      'Anúncios aguardando internet',
      `${waiting} ${waiting === 1 ? 'anúncio ainda não foi publicado' : 'anúncios ainda não foram publicados'}. Eles ficam guardados e saem quando você entrar de novo com internet.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair mesmo assim', onPress: () => void finishSignOut() }
      ]
    );
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
          loggedIn={loggedIn}
          isFavorite={favorites.some((item) => item.id === top.product.id)}
          onBack={goBack}
          onAdd={(product, quantity) => setCart((lines) => addToCart(lines, product, quantity))}
          onGoToCart={() => setNav((current) => openTab(current, 'cart', loggedIn))}
          onToggleFavorite={(product) => {
            if (user) void toggleFavorite(user.id, product).then(setFavorites);
          }}
          onNeedLogin={() => setNav((current) => requireLogin(current, null))}
        />
      );
    }
    if (top?.name === 'orders') {
      return <OrdersScreen onBack={goBack} onBrowse={() => setNav(INITIAL_NAV)} />;
    }
    if (top?.name === 'support') {
      return (
        <SupportScreen
          propertyOrCompany={user?.propertyOrCompany}
          onBack={goBack}
          onOpenOrders={() => setNav((current) => open(current, { name: 'orders' }, loggedIn))}
        />
      );
    }
    if (top?.name === 'favorites') {
      return (
        <FavoritesScreen
          favorites={favorites}
          onBack={goBack}
          onOpenProduct={(product) => setNav((current) => open(current, { name: 'product', product }, loggedIn))}
          onBrowse={() => setNav(INITIAL_NAV)}
        />
      );
    }
    if (top?.name === 'admin') {
      return <AdminUsersScreen onBack={goBack} />;
    }
    if (top?.name === 'server') {
      return <ServerScreen onBack={goBack} onSave={(url) => void changeServer(url)} />;
    }

    const account = (
      <AccountScreen
        user={user}
        onLogin={() => setNav((current) => requireLogin(current, null))}
        onRegister={() => setNav((current) => requireLogin(current, null, 'register'))}
        onOrders={() => setNav((current) => open(current, { name: 'orders' }, loggedIn))}
        onFavorites={() => setNav((current) => open(current, { name: 'favorites' }, loggedIn))}
        onSupport={() => setNav((current) => open(current, { name: 'support' }, loggedIn))}
        onAdmin={() => setNav((current) => open(current, { name: 'admin' }, loggedIn))}
        onServer={() => setNav((current) => open(current, { name: 'server' }, loggedIn))}
        serverUrl={getApiBaseUrl()}
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
        return user ? <SellScreen email={user.email} userId={user.id} /> : account;
      case 'finance':
        return user ? <FinanceScreen /> : account;
      case 'account':
        return account;
      default:
        return (
          <CatalogScreen
            key={serverKey}
            userName={user?.name ?? null}
            update={update}
            onDownloadUpdate={() => update && openDownload(update.url)}
            onDismissUpdate={() => setUpdate(null)}
            onConfigureServer={() => setNav((current) => open(current, { name: 'server' }, loggedIn))}
            onOpenProduct={(product) => setNav((current) => open(current, { name: 'product', product }, loggedIn))}
            onLive={() => {
              if (user) void flushOutbox(user.id);
            }}
          />
        );
    }
  }

  if (outdated !== null) {
    return (
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <UpdateScreen
          minVersion={outdated}
          onRetry={() => setOutdated(null)}
          onDownload={downloadLink ? () => openDownload(downloadLink) : undefined}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
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
