sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/Fragment",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, Fragment, JSONModel, MessageBox, MessageToast) {
  "use strict";

  return Controller.extend("books.controller.Books", {
    onInit: function () {
      this._dialogModel = new JSONModel({ heading: "", ID: "", title: "", author: "" });
      this.getView().getModel("view").setData({
        who: "尚未选择账号",
        canEdit: false,
        canQuery: false,
        official: false
      });
      this.byId("booksTable").getBinding("items").attachCreateCompleted(this._onCreateCompleted, this);
      this._refresh();
    },

    onLogout: function () {
      window.location.assign("/logout");
    },

    onViewer: function () {
      this._login("viewer");
    },

    onEditor: function () {
      this._login("editor");
    },

    onRefresh: function () {
      var oBinding = this.byId("booksTable").getBinding("items");
      if (oBinding && !oBinding.isSuspended()) {
        oBinding.refresh();
      }
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

    onEdit: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext();
      this._isNew = false;
      this._editContext = oContext;
      oContext.requestObject().then(function (oBook) {
        this._dialogModel.setData({
          heading: "编辑 ID " + oBook.ID,
          ID: oBook.ID,
          title: oBook.title || "",
          author: oBook.author || ""
        });
        this._openDialog();
      }.bind(this));
    },

    onCancel: function () {
      this.byId("bookDialog").close();
    },

    onSave: function () {
      var sTitle = this.byId("bookTitle").getValue();
      var sAuthor = this.byId("bookAuthor").getValue();
      if (!sTitle) {
        MessageBox.error("书名不能为空");
        return;
      }
      if (this._isNew) {
        this.byId("booksTable").getBinding("items").create({
          ID: Number(this._dialogModel.getProperty("/ID")),
          title: sTitle,
          author: sAuthor
        });
        return;
      }
      this._editContext.setProperty("title", sTitle);
      this._editContext.setProperty("author", sAuthor);
      var oModel = this.getView().getModel();
      oModel.submitBatch(oModel.getUpdateGroupId()).then(function () {
        MessageToast.show("已保存");
        this.byId("bookDialog").close();
      }.bind(this)).catch(function (oError) {
        MessageBox.error(this._errorText(oError));
      }.bind(this));
    },

    _login: function (sUser) {
      sessionStorage.setItem("demoUser", sUser + ":" + sUser);
      this.getView().getModel().changeHttpHeaders({
        Authorization: "Basic " + btoa(sUser + ":" + sUser)
      });
      this._refresh();
    },

    _refresh: function () {
      var oModel = this.getView().getModel();
      var oViewModel = this.getView().getModel("view");
      var oOperation = oModel.bindContext("/currentUser(...)");
      var that = this;

      oOperation.execute().then(function () {
        var oUser = oOperation.getBoundContext().getObject();
        var bOfficial = !sessionStorage.getItem("demoUser");
        var sWho = oUser.id + " 没有可用功能";
        oViewModel.setProperty("/official", bOfficial);
        oViewModel.setProperty("/canQuery", !!oUser.canQuery);
        oViewModel.setProperty("/canEdit", !!oUser.canEdit);
        if (oUser.canEdit) {
          sWho = bOfficial ? oUser.id + " 可以新建和编辑" : "维护账号，可以新建和编辑";
        } else if (oUser.canQuery) {
          sWho = bOfficial ? oUser.id + " 只能看列表" : "查询账号，只能看列表";
        }
        oViewModel.setProperty("/who", sWho);
        if (!oUser.canQuery) {
          return;
        }
        var oBinding = that.byId("booksTable").getBinding("items");
        if (oBinding.isSuspended()) {
          oBinding.resume();
        } else {
          oBinding.refresh();
        }
      }).catch(function () {
        oViewModel.setProperty("/official", false);
        oViewModel.setProperty("/canQuery", false);
        oViewModel.setProperty("/canEdit", false);
        oViewModel.setProperty("/who", "尚未选择账号");
      });
    },

    _openDialog: function () {
      var fnOpen = function () {
        this.byId("bookDialog").setModel(this._dialogModel, "dialog");
        this.byId("bookDialog").open();
      }.bind(this);
      if (this.byId("bookDialog")) {
        fnOpen();
        return;
      }
      Fragment.load({
        id: this.getView().getId(),
        name: "books.view.BookDialog",
        controller: this
      }).then(function (oDialog) {
        this.getView().addDependent(oDialog);
        fnOpen();
      }.bind(this));
    },

    _nextId: function () {
      var iMax = 0;
      this.byId("booksTable").getItems().forEach(function (oItem) {
        var iId = Number(oItem.getBindingContext().getProperty("ID")) || 0;
        if (iId > iMax) {
          iMax = iId;
        }
      });
      return iMax + 1;
    },

    _onCreateCompleted: function (oEvent) {
      if (!oEvent.getParameter("success")) {
        var aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getData();
        var oMessage = aMessages.filter(function (oItem) {
          return oItem.type === "Error";
        }).pop();
        MessageBox.error(oMessage ? oMessage.message : "保存失败");
        this.getView().getModel().resetChanges();
        return;
      }
      MessageToast.show("已保存");
      if (this.byId("bookDialog")) {
        this.byId("bookDialog").close();
      }
    },

    _errorText: function (oError) {
      if (oError && oError.error && oError.error.message) {
        return oError.error.message;
      }
      if (oError && oError.message) {
        return oError.message;
      }
      return "保存失败";
    }
  });
});
