export const id = 200;
export const ids = [200];
export const modules = {

/***/ 2200:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ getToOpenAPISchemaFn)
/* harmony export */ });
/* harmony import */ var _standard_community_standard_json__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(8258);
/* harmony import */ var _vendors_convert_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3917);



function getToOpenAPISchemaFn() {
  return async (schema, context) => (0,_vendors_convert_js__WEBPACK_IMPORTED_MODULE_1__/* .convertToOpenAPISchema */ .k)(
    await (0,_standard_community_standard_json__WEBPACK_IMPORTED_MODULE_0__/* .toJsonSchema */ .P)(schema, context.options),
    context
  );
}




/***/ }),

/***/ 3917:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   k: () => (/* binding */ convertToOpenAPISchema)
/* harmony export */ });
function convertToOpenAPISchema(jsonSchema, context) {
  const _jsonSchema = JSON.parse(JSON.stringify(jsonSchema));
  if ("nullable" in _jsonSchema && _jsonSchema.nullable === true) {
    if (_jsonSchema.type) {
      if (Array.isArray(_jsonSchema.type)) {
        if (!_jsonSchema.type.includes("null")) {
          _jsonSchema.type.push("null");
        }
      } else {
        _jsonSchema.type = [_jsonSchema.type, "null"];
      }
    } else {
      _jsonSchema.type = ["null"];
    }
    delete _jsonSchema.nullable;
  }
  if (_jsonSchema.$schema) {
    delete _jsonSchema.$schema;
  }
  const nestedSchemaKeys = [
    "properties",
    "additionalProperties",
    "items",
    "additionalItems",
    "allOf",
    "anyOf",
    "oneOf",
    "not",
    "if",
    "then",
    "else",
    "definitions",
    "$defs",
    "patternProperties",
    "propertyNames",
    "contains"
    // "unevaluatedProperties",
    // "unevaluatedItems",
  ];
  nestedSchemaKeys.forEach((key) => {
    if (_jsonSchema[key] && (typeof _jsonSchema[key] === "object" || Array.isArray(_jsonSchema[key]))) {
      if (key === "properties" || key === "definitions" || key === "$defs" || key === "patternProperties") {
        for (const subKey in _jsonSchema[key]) {
          _jsonSchema[key][subKey] = convertToOpenAPISchema(
            _jsonSchema[key][subKey],
            context
          );
        }
      } else if (key === "allOf" || key === "anyOf" || key === "oneOf") {
        _jsonSchema[key] = _jsonSchema[key].map(
          (item) => convertToOpenAPISchema(item, context)
        );
      } else if (key === "items") {
        if (Array.isArray(_jsonSchema[key])) {
          _jsonSchema[key] = _jsonSchema[key].map(
            (item) => convertToOpenAPISchema(item, context)
          );
        } else {
          _jsonSchema[key] = convertToOpenAPISchema(_jsonSchema[key], context);
        }
      } else {
        _jsonSchema[key] = convertToOpenAPISchema(_jsonSchema[key], context);
      }
    }
  });
  if (_jsonSchema.ref || _jsonSchema.$id) {
    const { ref, $id, ...component } = _jsonSchema;
    const id = ref || $id;
    context.components.schemas = {
      ...context.components.schemas,
      [id]: component
    };
    return {
      $ref: `#/components/schemas/${id}`
    };
  } else if (_jsonSchema.$ref) {
    const { $ref, $defs } = _jsonSchema;
    const ref = $ref.split("/").pop();
    context.components.schemas = {
      ...context.components.schemas,
      ...$defs
    };
    return {
      $ref: `#/components/schemas/${ref}`
    };
  }
  return _jsonSchema;
}




/***/ })

};
