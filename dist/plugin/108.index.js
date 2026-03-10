export const id = 108;
export const ids = [108];
export const modules = {

/***/ 3108:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ getToJsonSchemaFn)
/* harmony export */ });
/* harmony import */ var _index_CLddUTqr_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2376);



const zodv4Error = new _index_CLddUTqr_js__WEBPACK_IMPORTED_MODULE_0__.M("zod v4");
async function getToJsonSchemaFn() {
  return async (schema, options) => {
    let handler;
    if ("_zod" in schema) {
      try {
        const mod = await __webpack_require__.e(/* import() */ 416).then(__webpack_require__.bind(__webpack_require__, 6416));
        handler = mod.toJSONSchema;
      } catch {
        throw zodv4Error;
      }
    } else {
      try {
        const mod = await __webpack_require__.e(/* import() */ 994).then(__webpack_require__.t.bind(__webpack_require__, 4994, 19));
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
