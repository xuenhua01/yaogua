sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast) {
  "use strict";
  return Controller.extend("demo.controller.Template", {
    onInit: function () {
      this.getView().setModel(new JSONModel({ ID: "", title: "", author: "" }), "form");
      this.getOwnerComponent().getRouter().getRoute("template").attachPatternMatched(this._prepare, this);
    },

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("home");
    },

    _prepare: function () {
      var user = this.getOwnerComponent().getModel("user");
      var canEdit = user.getProperty("/canEdit");
      var tab = user.getProperty("/tab") === "insert" && canEdit ? "insert" : "query";
      this.byId("insertTab").setVisible(!!canEdit);
      this.byId("functionTabs").setSelectedKey(tab);
      this._fillNextId();
    },

    onTableUpdate: function (event) {
      var total = event.getParameter("total");
      this.byId("count").setText(total === undefined ? "加载中…" : "共 " + total + " 本");
    },

    onQuery: function () {
      var keyword = (this.byId("q").getValue() || "").trim();
      var binding = this.byId("reportTable").getBinding("items");
      if (!keyword) {
        binding.filter([]);
        return;
      }
      binding.filter(new Filter({
        filters: [
          new Filter("title", FilterOperator.Contains, keyword),
          new Filter("author", FilterOperator.Contains, keyword)
        ],
        and: false
      }));
    },

    _fillNextId: function () {
      if (!this._idBinding) {
        this._idBinding = this.getView().getModel().bindList("/Books");
      }
      this._idBinding.requestContexts(0, 1000).then(function (contexts) {
        var max = 0;
        contexts.forEach(function (context) {
          var id = Number(context.getProperty("ID")) || 0;
          if (id > max) {
            max = id;
          }
        });
        var form = this.getView().getModel("form");
        if (!form.getProperty("/ID")) {
          form.setProperty("/ID", max + 1);
        }
      }.bind(this));
    },

    onInsert: function () {
      var form = this.getView().getModel("form");
      var id = Number(form.getProperty("/ID"));
      var title = (form.getProperty("/title") || "").trim();
      var author = (form.getProperty("/author") || "").trim();
      if (!id) {
        MessageBox.error("请填写 ID");
        return;
      }
      if (!title) {
        MessageBox.error("请填写书名");
        return;
      }
      var binding = this.byId("reportTable").getBinding("items");
      binding.filter([]);
      var created = binding.create({
        ID: id,
        title: title,
        author: author
      });
      created.created().then(function () {
        MessageToast.show("已插入");
        form.setProperty("/title", "");
        form.setProperty("/author", "");
        form.setProperty("/ID", id + 1);
        this.byId("q").setValue("");
        this.byId("reportTable").getBinding("items").filter([]);
        this.byId("functionTabs").setSelectedKey("query");
      }.bind(this), function (error) {
        MessageBox.error("插入失败: " + (error.message || error));
      });
    }
  });
});
