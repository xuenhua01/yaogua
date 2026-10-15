const cds = require("@sap/cds");

module.exports = cds.service.impl(function () {
  this.on("currentUser", (req) => {
    if (!req.user || req.user.id === "anonymous") {
      return req.reject(401, "请先登录");
    }
    const canEdit = req.user.is("BooksEditor");
    return {
      id: req.user.id,
      canQuery: req.user.is("BooksViewer") || canEdit,
      canEdit
    };
  });

  this.before(["CREATE", "UPDATE"], "Books", (req) => {
    if ("title" in req.data && !req.data.title) {
      req.reject(400, "书名不能为空");
    }
  });
});
