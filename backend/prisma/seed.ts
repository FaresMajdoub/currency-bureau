import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar',            flagEmoji: '🇺🇸' },
  { code: 'EUR', name: 'Euro',                  flagEmoji: '🇪🇺' },
  { code: 'GBP', name: 'British Pound',         flagEmoji: '🇬🇧' },
  { code: 'CHF', name: 'Swiss Franc',           flagEmoji: '🇨🇭' },
  { code: 'JPY', name: 'Japanese Yen',          flagEmoji: '🇯🇵' },
  { code: 'CNY', name: 'Chinese Yuan',          flagEmoji: '🇨🇳' },
  { code: 'MAD', name: 'Moroccan Dirham',       flagEmoji: '🇲🇦' },
  { code: 'SAR', name: 'Saudi Riyal',           flagEmoji: '🇸🇦' },
  { code: 'AED', name: 'UAE Dirham',            flagEmoji: '🇦🇪' },
  { code: 'QAR', name: 'Qatari Riyal',          flagEmoji: '🇶🇦' },
  { code: 'KWD', name: 'Kuwaiti Dinar',         flagEmoji: '🇰🇼' },
  { code: 'TRY', name: 'Turkish Lira',          flagEmoji: '🇹🇷' },
  { code: 'MXN', name: 'Mexican Peso',          flagEmoji: '🇲🇽' },
  { code: 'INR', name: 'Indian Rupee',          flagEmoji: '🇮🇳' },
  { code: 'BRL', name: 'Brazilian Real',        flagEmoji: '🇧🇷' },
  { code: 'AUD', name: 'Australian Dollar',     flagEmoji: '🇦🇺' },
  { code: 'HKD', name: 'Hong Kong Dollar',      flagEmoji: '🇭🇰' },
  { code: 'SGD', name: 'Singapore Dollar',      flagEmoji: '🇸🇬' },
  { code: 'NZD', name: 'New Zealand Dollar',    flagEmoji: '🇳🇿' },
  { code: 'DOP', name: 'Dominican Peso',        flagEmoji: '🇩🇴' },
  { code: 'XCD', name: 'Eastern Caribbean Dollar', flagEmoji: '🏝️' },
  { code: 'CUP', name: 'Cuban Peso',            flagEmoji: '🇨🇺' },
];

// Denominations (bills) per currency — realistic for an exchange bureau
const DENOMINATIONS: Record<string, number[]> = {
  USD: [1, 2, 5, 10, 20, 50, 100],
  EUR: [5, 10, 20, 50, 100, 200, 500],
  GBP: [5, 10, 20, 50],
  CHF: [10, 20, 50, 100, 200, 1000],
  JPY: [1000, 2000, 5000, 10000],
  CNY: [1, 5, 10, 20, 50, 100],
  MAD: [20, 50, 100, 200],
  SAR: [1, 5, 10, 50, 100, 500],
  AED: [5, 10, 20, 50, 100, 200, 500, 1000],
  QAR: [1, 5, 10, 50, 100, 500],
  KWD: [0.25, 0.5, 1, 5, 10, 20],
  TRY: [5, 10, 20, 50, 100, 200],
  MXN: [20, 50, 100, 200, 500, 1000],
  INR: [10, 20, 50, 100, 200, 500, 2000],
  BRL: [2, 5, 10, 20, 50, 100, 200],
  AUD: [5, 10, 20, 50, 100],
  HKD: [10, 20, 50, 100, 500, 1000],
  SGD: [2, 5, 10, 50, 100, 1000],
  NZD: [5, 10, 20, 50, 100],
  DOP: [50, 100, 200, 500, 1000, 2000],
  XCD: [5, 10, 20, 50, 100],
  CUP: [1, 3, 5, 10, 20, 50, 100],
};

// Approximate market rates vs CAD (units of foreign per 1 CAD) — used for seeding only
const SEED_RATES_VS_CAD: Record<string, number> = {
  USD: 0.72, EUR: 0.66, GBP: 0.57, CHF: 0.64, JPY: 107.5, CNY: 5.22,
  MAD: 10.20, SAR: 2.81, AED: 2.74, QAR: 2.73, KWD: 0.228,
  TRY: 24.5, MXN: 13.8, INR: 60.2, BRL: 3.98, AUD: 1.12,
  HKD: 5.65, SGD: 0.97, NZD: 1.21, DOP: 59.0, XCD: 2.02, CUP: 33.0,
};

const BUY_MARGIN  = 0.985;
const SELL_MARGIN = 1.015;

// Seed quantities — realistic starting stock for a bureau
function seedQty(denom: number): number {
  if (denom >= 500)  return Math.floor(Math.random() * 20) + 10;
  if (denom >= 100)  return Math.floor(Math.random() * 50) + 30;
  if (denom >= 50)   return Math.floor(Math.random() * 80) + 40;
  if (denom >= 10)   return Math.floor(Math.random() * 100) + 50;
  return Math.floor(Math.random() * 150) + 80;
}

async function main() {
  console.log('🧹 Removing deprecated currencies (TND, DZD)...');
  await prisma.tillInventory.deleteMany({ where: { currencyCode: { in: ['TND', 'DZD'] } } });
  await prisma.currency.deleteMany({ where: { code: { in: ['TND', 'DZD'] } } });

  console.log('🌱 Seeding currencies...');
  for (const c of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: c,
      create: c,
    });
  }

  console.log('🌱 Seeding till inventory...');
  for (const [code, denoms] of Object.entries(DENOMINATIONS)) {
    for (const denom of denoms) {
      await prisma.tillInventory.upsert({
        where: { currencyCode_denomination: { currencyCode: code, denomination: denom } },
        update: { quantity: seedQty(denom) },
        create: { currencyCode: code, denomination: denom, quantity: seedQty(denom) },
      });
    }
  }

  console.log('🌱 Seeding exchange rates...');
  const now = new Date();
  await prisma.exchangeRate.createMany({
    data: Object.entries(SEED_RATES_VS_CAD).map(([code, market]) => ({
      currencyCode: code,
      marketRate:   market,
      buyRate:      market * BUY_MARGIN,
      sellRate:     market * SELL_MARGIN,
      fetchedAt:    now,
    })),
    skipDuplicates: true,
  });

  console.log('✅ Seed complete');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
