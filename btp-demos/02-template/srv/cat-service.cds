@odata service CatalogService {
  entity Books {
    key ID : Integer;
    title  : String;
    author : String;
  }
  function currentUser() returns { id: String; canQuery: Boolean; canEdit: Boolean; };
}

annotate CatalogService.Books with @restrict: [
  { grant: 'READ', to: 'BooksViewer' },
  { grant: [ 'READ', 'WRITE' ], to: 'BooksEditor' }
];