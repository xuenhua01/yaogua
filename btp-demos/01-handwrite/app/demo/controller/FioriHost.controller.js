sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/Component",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox"
], function (Controller, Component, JSONModel, MessageBox) {
  "use strict";
  return Controller.extend("demo.controller.FioriHost", {
    onInit: function () {
      this.getView().setModel(new JSONModel({ title: "" }), "view");
      var id = this.getView().getId();
      var spec = id.indexOf("materialsFiori") >= 0
        ? ["materials", "/materials/webapp", "物料 Fiori", "materialsFiori"]
        : ["books", "/books/webapp", "书籍 Fiori", "booksFiori"];
      this._spec = spec;
      this.getOwnerComponent().getRouter().getRoute(spec[3]).attachPatternMatched(this._open, this);
      this._open();
    },

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("home");
    },

    _open: function () {
      var name = this._spec[0];
      var path = this._spec[1];
      var title = this._spec[2];
      this.getView().getModel("view").setProperty("/title", title);
      var paths = {};
      paths[name] = path;
      sap.ui.loader.config({ paths: paths });
      var container = this.byId("fioriHost");
      var current = container.getComponent();
      if (current) {
        container.setComponent(null);
        current.destroy();
      }
      Component.create({ name: name }).then(function (component) {
        container.setComponent(component);
      }).catch(function (error) {
        MessageBox.error("打开失败: " + (error.message || error));
      });
    }
  });
});
