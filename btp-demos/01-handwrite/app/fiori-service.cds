using CatalogService from '../srv/cat-service';

annotate CatalogService.Books with @(
  UI: {
    HeaderInfo: {
      TypeName: 'Book',
      TypeNamePlural: 'Books',
      Title: { Value: title }
    },
    SelectionFields: [ ID, title, author ],
    LineItem: [
      { Value: ID },
      { Value: title },
      { Value: author }
    ]
  }
);

annotate CatalogService.Materials with @(
  UI: {
    HeaderInfo: {
      TypeName: '物料',
      TypeNamePlural: '物料主数据',
      Title: { Value: MATNR },
      Description: { Value: MAKTX }
    },
    SelectionFields: [ MATNR, MAKTX, MTART, MATKL ],
    LineItem: [
      { Value: MATNR },
      { Value: MAKTX },
      { Value: MTART },
      { Value: MATKL },
      { Value: MEINS },
      { Value: MBRSH }
    ],
    Facets: [
      { $Type: 'UI.ReferenceFacet', Label: '基本信息', Target: '@UI.FieldGroup#Main' }
    ],
    FieldGroup#Main: {
      Data: [
        { Value: MATNR },
        { Value: MAKTX },
        { Value: MTART },
        { Value: MATKL },
        { Value: MEINS },
        { Value: MBRSH }
      ]
    }
  }
);

annotate CatalogService.Materials with {
  MATNR @title: '物料编码';
  MAKTX @title: '物料描述';
  MTART @title: '物料类型';
  MATKL @title: '物料组';
  MEINS @title: '基本单位';
  MBRSH @title: '行业';
};
