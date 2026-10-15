// S/4 物料接口。CatalogService.Materials 的读取会转到这里。
// Destination 名字是 S4H，路径在 package.json。
@cds.external
service API_PRODUCT {
  entity A_Product {
    key Product        : String(40); // MARA-MATNR
    ProductType        : String(4);  // MARA-MTART
    ProductGroup       : String(9);  // MARA-MATKL
    BaseUnit           : String(3);  // MARA-MEINS
    IndustrySector     : String(1);  // MARA-MBRSH
  }
  entity A_ProductDescription {
    key Product            : String(40);
    key Language           : String(2);
    ProductDescription     : String(40); // MAKT-MAKTX
  }
}
