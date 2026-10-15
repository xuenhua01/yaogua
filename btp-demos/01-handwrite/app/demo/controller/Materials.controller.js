sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageBox"
], function (Controller, Filter, FilterOperator, MessageBox) {
  "use strict";
  return Controller.extend("demo.controller.Materials", {
    onInit: function () {
      this.getOwnerComponent().getRouter().getRoute("materials").attachPatternMatched(this.onSearch, this);
    },

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("home");
    },

    onSearch: function () {
      var filters = [];
      var matnr = this.byId("matnr").getValue().trim();
      var maktx = this.byId("maktx").getValue().trim();
      var mtart = this.byId("mtart").getValue().trim();
      var matkl = this.byId("matkl").getValue().trim();
      if (matnr) filters.push(new Filter("MATNR", FilterOperator.Contains, matnr));
      if (maktx) filters.push(new Filter("MAKTX", FilterOperator.Contains, maktx));
      if (mtart) filters.push(new Filter("MTART", FilterOperator.EQ, mtart));
      if (matkl) filters.push(new Filter("MATKL", FilterOperator.Contains, matkl));
      var binding = this.byId("materialsTable").getBinding("items");
      if (binding) {
        binding.filter(filters);
      }
    },

    onClear: function () {
      ["matnr", "maktx", "mtart", "matkl"].forEach(function (id) {
        this.byId(id).setValue("");
      }, this);
      this.onSearch();
    },

    onUpdateFinished: function (event) {
      var reason = event.getParameter("reason");
      if (reason === "Binding") {
        var error = this.byId("materialsTable").getBinding("items").getContexts(0, 1);
        if (!error) return;
      }
      this.byId("matTitle").setText("物料主数据 (" + event.getParameter("total") + ")");
    }
  });
});
