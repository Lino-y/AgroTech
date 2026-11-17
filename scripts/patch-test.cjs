/* eslint-disable no-undef */
// tests/orders.test.js cria produto sem imageUrl — o servidor no working tree exige foto.
// Ajusta os corpos de POST /api/products para incluir imagem http(s).
const fs = require('fs');
let t = fs.readFileSync('tests/orders.test.js', 'utf8');
const before = t;
t = t.replace(
  /\{ name: 'Milho', price: 150, category: 'Grãos', description: 'lote' \}/g,
  "{ name: 'Milho', price: 150, category: 'Grãos', description: 'lote', imageUrl: 'https://exemplo.com/milho.png' }"
);
fs.writeFileSync('tests/orders.test.js', t);
console.log(before === t ? 'nada mudou' : 'patch ok');
