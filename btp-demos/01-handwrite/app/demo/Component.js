sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
  "use strict";

  function emptyUser() {
    return { id: "", canQuery: false, canEdit: false, tab: "query", loggedIn: false };
  }

  return UIComponent.extend("demo.Component", {
    metadata: { manifest: "json" },
    init: function () {
      UIComponent.prototype.init.apply(this, arguments);
      var saved = this._readSession();
      this.setModel(new JSONModel(saved || emptyUser()), "user");
      if (saved && saved.password) {
        this._setAuth(saved.id, saved.password);
        this.getRouter().initialize();
        return;
      }
      this._loadOfficialUser();
    },

    _loadOfficialUser: function () {
      var start = function () { this.getRouter().initialize(); }.bind(this);
      fetch("/odata/v4/catalog/currentUser()", { credentials: "same-origin" }).then(function (response) {
        if (!response.ok) {
          start();
          return null;
        }
        return response.json();
      }).then(function (body) {
        if (!body) return;
        var info = body.value && body.value.id ? body.value : body;
        if (!info.id || info.id === "anonymous") {
          start();
          return;
        }
        this.getModel("user").setData({
          id: info.id,
          canQuery: !!info.canQuery,
          canEdit: !!info.canEdit,
          tab: "query",
          loggedIn: true,
          official: true
        });
        start();
      }.bind(this)).catch(start);
    },

    _readSession: function () {
      try {
        var saved = JSON.parse(sessionStorage.getItem("demoUser") || "null");
        if (saved && saved.id && saved.loggedIn) {
          return saved;
        }
      } catch (ignore) { /* 会话坏了就当没登录 */ }
      return null;
    },

    _setAuth: function (id, password) {
      var model = this.getModel();
      if (model && model.changeHttpHeaders) {
        model.changeHttpHeaders({
          Authorization: "Basic " + btoa(id + ":" + (password || ""))
        });
      }
    },

    login: function (id, password) {
      return fetch("/odata/v4/catalog/currentUser()", {
        headers: { Authorization: "Basic " + btoa(id + ":" + (password || "")) }
      }).then(function (response) {
        if (!response.ok) {
          throw new Error(response.status === 401 ? "账号或密码不对" : "登录失败 " + response.status);
        }
        return response.json();
      }).then(function (body) {
        var info = body.value && body.value.id ? body.value : body;
        var data = {
          id: info.id,
          password: password,
          canQuery: !!info.canQuery,
          canEdit: !!info.canEdit,
          tab: "query",
          loggedIn: true
        };
        this._setAuth(data.id, password);
        this.getModel("user").setData(data);
        sessionStorage.setItem("demoUser", JSON.stringify(data));
        return data;
      }.bind(this));
    },

    logout: function () {
      var official = this.getModel("user").getProperty("/official");
      sessionStorage.removeItem("demoUser");
      window.location.assign(official ? "/logout" : "/");
    }
  });
});
