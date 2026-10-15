const cds = require("@sap/cds");

function keep(row, where) {
  if (!where) return true;
  let ok = true;
  for (const part of where) {
    if (part === "and" || part === "or") continue;
    if (part && part.func === "contains") {
      const field = part.args[0].ref.at(-1);
      const val = String(part.args[1].val ?? "").toLowerCase();
      ok = ok && String(row[field] ?? "").toLowerCase().includes(val);
    } else if (Array.isArray(part) && (part[1] === "=" || part[1] === "eq")) {
      const field = part[0].ref.at(-1);
      ok = ok && String(row[field] ?? "") === String(part[2].val ?? "");
    }
  }
  return ok;
}

async function readMaterialsFromS4(req) {
  const s4 = await cds.connect.to("API_PRODUCT");
  const products = await s4.run(SELECT.from("A_Product").limit(100));
  const texts = await s4.run(SELECT.from("A_ProductDescription").limit(300));
  const textByProduct = new Map();
  for (const text of texts || []) {
    const current = textByProduct.get(text.Product);
    const lang = text.Language;
    if (!current || lang === "ZH" || (lang === "EN" && current.lang !== "ZH")) {
      textByProduct.set(text.Product, { lang, value: text.ProductDescription });
    }
  }
  const rows = (products || []).map((product) => ({
    MATNR: product.Product,
    MAKTX: textByProduct.get(product.Product)?.value || "",
    MTART: product.ProductType,
    MATKL: product.ProductGroup,
    MEINS: product.BaseUnit,
    MBRSH: product.IndustrySector,
  }));
  return rows.filter((row) => keep(row, req.query?.SELECT?.where));
}

module.exports = cds.service.impl(function () {
  this.on("currentUser", (req) => {
    if (!req.user || req.user.id === "anonymous") {
      return req.reject(401, "请先登录");
    }
    const canEdit = req.user.is("BooksEditor");
    return {
      id: req.user.id,
      canQuery: req.user.is("BooksViewer") || canEdit,
      canEdit
    };
  });

  this.on("destinationInfo", () => {
    const cfg = cds.env.requires.S4H || cds.env.requires.API_PRODUCT || {};
    return {
      name: "S4H",
      destination: cfg.credentials && cfg.credentials.destination,
      kind: cfg.kind,
    };
  });

  this.on("READ", "Materials", async (req) => {
    try {
      return await readMaterialsFromS4(req);
    } catch (error) {
      if (process.env.VCAP_SERVICES) throw error;
      console.warn("S/4 未连通，物料页仍用本地样例：" + error.message);
      const db = await cds.connect.to("db");
      return db.run(req.query);
    }
  });
});

cds.on("served", async () => {
    const db = await cds.connect.to("db");
    try {
        const count = await db.run("SELECT COUNT(*) AS n FROM CatalogService_Books");
        const n = Array.isArray(count) ? count[0]?.n : count?.n;
        if (!n) {
            await db.run(`
      INSERT INTO CatalogService_Books (ID, title, author) VALUES
        (1, 'Wuthering Heights', 'Emily Bronte'),
        (2, 'Jane Eyre', 'Charlotte Bronte'),
        (3, 'The Raven', 'Edgar Allen Poe'),
        (4, 'Eleonora', 'Edgar Allen Poe'),
        (5, 'Catweazle', 'Richard Carpenter')
    `);
        }
    } catch (error) {
        console.warn("Books 样例未写入：" + error.message);
    }

    try {
        const mCount = await db.run("SELECT COUNT(*) AS n FROM CatalogService_Materials");
        const mN = Array.isArray(mCount) ? mCount[0]?.n : mCount?.n;
        if (!mN) {
            await db.run(`
      INSERT INTO CatalogService_Materials (MATNR, MAKTX, MTART, MATKL, MEINS, MBRSH) VALUES
        ('10000001', '内六角螺栓', 'FERT', '01', 'PC', 'M'),
        ('10000002', '热轧钢板', 'ROH', '02', 'KG', 'M'),
        ('10000003', '传动轴', 'HALB', '01', 'PC', 'M'),
        ('10000004', '润滑油', 'ROH', '03', 'L', 'M'),
        ('20000001', '包装纸箱', 'VERP', '04', 'PC', 'M')
    `);
        }
    } catch (error) {
        console.warn("Materials 样例未写入：" + error.message);
    }
});