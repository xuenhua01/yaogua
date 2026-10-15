@odata service CatalogService {
  entity Books { 
    key ID:Integer; title:String; author:String;
  }
  // 报表字段：MATNR/MTART/MATKL/MEINS/MBRSH 按 MARA，MAKTX 按 MAKT
  entity Materials {
    key MATNR : String(40);
    MAKTX : String(40);
    MTART : String(4);
    MATKL : String(9);
    MEINS : String(3);
    MBRSH : String(1);
  }
  function destinationInfo() returns {
    name: String;
    destination: String;
    kind: String;
  };
  function currentUser() returns { id: String; canQuery: Boolean; canEdit: Boolean; };
}

// 角色在代码里声明。账号不写在这里，本地用假用户代替，云上再分配给真人。
annotate CatalogService.Books with @restrict: [
  { grant: 'READ', to: 'BooksViewer' },
  { grant: [ 'READ', 'WRITE' ], to: 'BooksEditor' }
];
annotate CatalogService.Materials with @restrict: [
  { grant: 'READ', to: [ 'BooksViewer', 'BooksEditor' ] }
]; 
