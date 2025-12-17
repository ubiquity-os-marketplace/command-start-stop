export const id = 399;
export const ids = [399];
export const modules = {

/***/ 7399:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ getToJsonSchemaFn)
/* harmony export */ });
/* harmony import */ var _index_CLddUTqr_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6313);



const zodv4Error = new _index_CLddUTqr_js__WEBPACK_IMPORTED_MODULE_0__.M("zod v4");
async function getToJsonSchemaFn() {
  return async (schema, options) => {
    let handler;
    if ("_zod" in schema) {
      try {
        const mod = await __webpack_require__.e(/* import() */ 859).then(__webpack_require__.bind(__webpack_require__, 3859));
        handler = mod.toJSONSchema;
      } catch {
        throw zodv4Error;
      }
    } else {
      try {
        const mod = await __webpack_require__.e(/* import() */ 207).then(__webpack_require__.t.bind(__webpack_require__, 9207, 19));
        handler = mod.zodToJsonSchema;
      } catch {
        throw new _index_CLddUTqr_js__WEBPACK_IMPORTED_MODULE_0__.M("zod-to-json-schema");
      }
    }
    return handler(schema, options);
  };
}




/***/ })

};
