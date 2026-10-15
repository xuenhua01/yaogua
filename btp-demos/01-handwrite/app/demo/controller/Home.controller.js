sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageBox"
], function (Controller, MessageBox) {
  "use strict";
  return Controller.extend("demo.controller.Home", {
    onLogin: function () {
      var id = (this.byId("userId").getValue() || "").trim();
      var password = this.byId("password").getValue() || "";
      if (!id || !password) {
        MessageBox.error("请填写账号和密码");
        return;
      }
      this.getOwnerComponent().login(id, password).catch(function (error) {
        MessageBox.error(error.message || "登录失败");
      });
    },

    onLogout: function () {
      this.getOwnerComponent().logout();
    },

    onTilePress: function (event) {
      var route = event.getSource().data("route");
      var tab = event.getSource().data("tab");
      if (tab) {
        this.getOwnerComponent().getModel("user").setProperty("/tab", tab);
      }
      if (route.charAt(0) === "/") {
        window.location.assign(route);
        return;
      }
      this.getOwnerComponent().getRouter().navTo(route);
    }
  });
});
