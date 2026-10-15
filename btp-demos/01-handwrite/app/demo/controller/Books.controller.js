sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/Fragment",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, Fragment, JSONModel, MessageBox, MessageToast) {
  "use strict";
  return Controller.extend("demo.controller.Books", {
    onInit: function () {
      this._dialogModel = new JSONModel({ heading: "", ID: "", title: "", author: "" });
      this.getOwnerComponent().getRouter().getRoute("books").attachPatternMatched(this.onRefresh, this);
    },

    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("home");
    },

    onRefresh: function () {
      var binding = this.byId("booksTable").getBinding("items");
      if (binding) binding.refresh();
    },

    _nextId: function () {
      var max = 0;
      this.byId("booksTable").getItems().forEach(function (item) {
        var id = Number(item.getBindingContext().getProperty("ID")) || 0;
        if (id > max) max = id;
      });
      return max + 1;
    },

    _openDialog: function () {
      var open = function () {
        this.byId("bookDialog").setModel(this._dialogModel, "dialog");
        this.byId("bookDialog").open();
      }.bind(this);
      if (this.byId("bookDialog")) {
        open();
        return;
      }
      Fragment.load({
        id: this.getView().getId(),
        name: "demo.view.BookDialog",
        controller: this
      }).then(function (dialog) {
        this.getView().addDependent(dialog);
        open();
      }.bind(this));
    },

    onCreate: function () {
      this._isNew = true;
      this._editContext = null;
      this._dialogModel.setData({
        heading: "新建一本书",
        ID: this._nextId(),
        title: "",
        author: ""
      });
      this._openDialog();
    },

    onEdit: function (event) {
      var context = event.getSource().getBindingContext();
      this._isNew = false;
      this._editContext = context;
      context.requestObject().then(function (book) {
        this._dialogModel.setData({
          heading: "编辑 ID " + book.ID,
          ID: book.ID,
          title: book.title || "",
          author: book.author || ""
        });
        this._openDialog();
      }.bind(this));
    },

    onCancel: function () {
      this.byId("bookDialog").close();
    },

    onSave: function () {
      var book = {
        ID: this._dialogModel.getProperty("/ID"),
        title: this.byId("bookTitle").getValue(),
        author: this.byId("bookAuthor").getValue()
      };
      var model = this.getView().getModel();
      var done = function () {
        MessageToast.show("已保存到 HANA");
        this.byId("bookDialog").close();
      }.bind(this);
      var failed = function (error) {
        MessageBox.error("保存失败: " + (error.message || error));
      };
      if (this._isNew) {
        var created = this.byId("booksTable").getBinding("items").create({
          ID: Number(book.ID),
          title: book.title,
          author: book.author
        });
        created.created().then(done, failed);
        return;
      }
      this._editContext.setProperty("title", book.title);
      this._editContext.setProperty("author", book.author);
      model.submitBatch(model.getUpdateGroupId()).then(done, failed);
    }
  });
});
