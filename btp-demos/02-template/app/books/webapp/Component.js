sap.ui.define([
  "sap/ui/core/UIComponent"
], function (UIComponent) {
  "use strict";

  return UIComponent.extend("books.Component", {
    metadata: {
      manifest: "json"
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);
      var sSaved = sessionStorage.getItem("demoUser");
      if (sSaved) {
        this.getModel().changeHttpHeaders({
          Authorization: "Basic " + btoa(sSaved)
        });
      }
    }
  });
});
