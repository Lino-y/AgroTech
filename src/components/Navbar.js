export function renderNavbar(cartCount = 0) {
  return `
    <nav style="background: #1F3D2B; padding: 8px 20px; color: white; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; min-height: 64px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <img src="assets/logo.svg" alt="AgroTech" style="width: 38px; height: auto; cursor: pointer; flex-shrink: 0;" onclick="navigateTo('catalog')" />
      </div>
      <div onclick="navigateTo('cart')" style="position: relative; cursor: pointer;">
        <span style="font-size: 22px;">🛒</span>
        ${cartCount > 0 ? `<span style="position: absolute; top: -6px; right: -8px; background: #D9A441; color: #241F16; font-weight: bold; font-size: 10px; border-radius: 50%; padding: 2px 6px;">${cartCount}</span>` : ''}
      </div>
    </nav>
  `;
}