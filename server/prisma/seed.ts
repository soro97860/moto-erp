import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 初始化資料庫...');

  // ── 管理員帳號 ────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: await bcrypt.hash('admin1234', 12),
      name: '系統管理員',
      role: Role.ADMIN,
    },
  });
  console.log(`✓ 管理員帳號: ${admin.username} / admin1234  ← 首次登入請立即修改密碼`);

  // ── 廠牌 ──────────────────────────────────────────────────────
  const brandNames = [
    'YAMAHA', 'HONDA', 'SYM', 'KYMCO', 'SUZUKI',
    'KAWASAKI', 'PGO', 'AEON', 'VESPA', 'TRIUMPH',
  ];
  const brands: Record<string, string> = {};
  for (const name of brandNames) {
    const b = await prisma.brand.upsert({ where: { name }, update: {}, create: { name } });
    brands[name] = b.id;
  }
  console.log(`✓ 廠牌 ${brandNames.length} 筆`);

  // ── 零件分類 ──────────────────────────────────────────────────
  const categoryNames = [
    '傳動皮帶', '機油', '煞車皮', '火星塞',
    '空氣濾清器', '機油濾心', '前輪胎', '後輪胎',
    '大燈燈泡', '電池', '離合器', '汽缸',
    '引擎零件', '電系零件', '車身外觀',
  ];
  const cats: Record<string, string> = {};
  for (const name of categoryNames) {
    const exists = await prisma.category.findFirst({ where: { name, parentId: null } });
    const cat = exists ?? (await prisma.category.create({ data: { name } }));
    cats[name] = cat.id;
  }
  console.log(`✓ 零件分類 ${categoryNames.length} 筆`);

  // ── 儲位 ──────────────────────────────────────────────────────
  const floors = ['1F', '2F'];
  const cabinets = ['A', 'B', 'C'];
  const shelves = ['第1層', '第2層', '第3層'];
  let locCreated = 0;

  const locs: Record<string, string> = {};
  for (const floor of floors) {
    for (const cab of cabinets) {
      const cabinet = `${cab}櫃`;
      for (const shelf of shelves) {
        const existing = await prisma.storageLocation.findFirst({ where: { floor, cabinet, shelf } });
        const loc = existing ?? (await prisma.storageLocation.create({ data: { floor, cabinet, shelf } }));
        locs[`${floor}-${cabinet}-${shelf}`] = loc.id;
        if (!existing) locCreated++;
      }
    }
  }
  console.log(`✓ 儲位 ${locCreated} 筆新增 (${floors.join('/')} × ${cabinets.map(c => c + '櫃').join('/')} × ${shelves.length}層)`);

  // ── 範例商品 ──────────────────────────────────────────────────
  const sampleProducts = [
    {
      sku: 'ENG-OIL-10W40',
      barcode: '4712345678901',
      name: '機油 10W-40 (1L)',
      brandId: brands['YAMAHA'],
      categoryId: cats['機油'],
      storageLocationId: locs['1F-A櫃-第1層'],
      sellPrice: 180,
      costPrice: 100,
      stockQty: 50,
      minStockQty: 10,
      unit: '瓶',
    },
    {
      sku: 'SPARK-NGK-CR6',
      name: '火星塞 NGK CR6HSA',
      categoryId: cats['火星塞'],
      storageLocationId: locs['1F-A櫃-第2層'],
      sellPrice: 120,
      costPrice: 60,
      stockQty: 30,
      minStockQty: 5,
      unit: '顆',
    },
    {
      sku: 'BELT-YAMAHA-BWS',
      name: '傳動皮帶 BWS 125',
      brandId: brands['YAMAHA'],
      categoryId: cats['傳動皮帶'],
      storageLocationId: locs['1F-B櫃-第1層'],
      sellPrice: 650,
      costPrice: 380,
      stockQty: 10,
      minStockQty: 3,
      unit: '條',
    },
  ];

  for (const p of sampleProducts) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p as Parameters<typeof prisma.product.create>[0]['data'],
    });
  }
  console.log(`✓ 範例商品 ${sampleProducts.length} 筆`);

  // ── 系統設定預設值 ────────────────────────────────────────────
  const defaults: Array<{ key: string; value: string }> = [
    { key: 'shopName',          value: '機車行' },
    { key: 'shopAddress',       value: '' },
    { key: 'shopPhone',         value: '' },
    { key: 'shopTaxId',         value: '' },
    { key: 'shopWarranty',      value: '維修項目自完工日起保固 30 天，零件耗材不在保固範圍內。' },
    { key: 'shopThankYou',      value: '感謝您的光臨，歡迎再次惠顧！' },
    { key: 'lowStockThreshold', value: '5' },
  ];
  for (const { key, value } of defaults) {
    await prisma.settings.upsert({
      where: { key },
      update: {},       // do NOT overwrite existing config on re-seed
      create: { key, value },
    });
  }
  console.log(`✓ 系統設定 ${defaults.length} 筆`);

  console.log('\n🎉 初始化完成！');
}

main()
  .catch((e) => {
    console.error('❌ Seed 失敗:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
