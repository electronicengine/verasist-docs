/**
 * Loads and reads the live Verasist product API's OpenAPI schema at runtime
 * (FastAPI auto-serves it, unauthenticated, at /api/v1/openapi.json) so the
 * "Try it" pages always reflect the real deployed API — no static spec copy
 * to keep in sync.
 */

// Falls back to the hosted app if no build-time override is set; users can
// still point Try-It at a self-hosted instance via the base URL field in the UI.
export const DEFAULT_API_BASE_URL = process.env.REACT_APP_VERASIST_API_URL || "https://app.verasist.ai";

const cache = new Map(); // baseUrl -> Promise<spec>

export function fetchOpenApiSpec(baseUrl) {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (!cache.has(normalized)) {
    cache.set(
      normalized,
      fetch(`${normalized}/api/v1/openapi.json`).then((res) => {
        if (!res.ok) {
          cache.delete(normalized);
          throw new Error(`OpenAPI şeması alınamadı (${res.status})`);
        }
        return res.json();
      }).catch((err) => {
        cache.delete(normalized);
        throw err;
      }),
    );
  }
  return cache.get(normalized);
}

/** Resolve a `{"$ref": "#/components/..."}` pointer against the full spec. */
export function resolveSchema(spec, schemaOrRef, seen = new Set()) {
  if (!schemaOrRef) return null;
  if (schemaOrRef.$ref) {
    if (seen.has(schemaOrRef.$ref)) return null;
    seen.add(schemaOrRef.$ref);
    const parts = schemaOrRef.$ref.replace(/^#\//, "").split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
    let node = spec;
    for (const part of parts) node = node?.[part];
    return node ? { ...resolveSchema(spec, node, seen), ...Object.fromEntries(Object.entries(schemaOrRef).filter(([key]) => key !== "$ref")) } : null;
  }
  return schemaOrRef;
}

/** Look up the operation object for a given method+path in the spec. */
export function getOperation(spec, method, path) {
  const pathItem = spec?.paths?.[path];
  if (!pathItem) return null;
  const operation = pathItem[method.toLowerCase()];
  if (!operation) return null;
  const parameters = new Map();
  for (const raw of [...(pathItem.parameters || []), ...(operation.parameters || [])]) {
    const parameter = resolveSchema(spec, raw);
    if (parameter) parameters.set(`${parameter.in}:${parameter.name}`, parameter);
  }
  return { ...operation, parameters: [...parameters.values()], requestBody: resolveSchema(spec, operation.requestBody) };
}

/** Build a best-effort example payload from a (possibly $ref'd) JSON schema. */
export function buildExampleFromSchema(spec, schemaOrRef, depth = 0) {
  const schema = resolveSchema(spec, schemaOrRef);
  if (!schema || depth > 6) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.const !== undefined) return schema.const;
  if (schema.enum?.length) return schema.enum[0];
  if (schema.anyOf || schema.oneOf) {
    const option = (schema.anyOf || schema.oneOf).find((item) => resolveSchema(spec, item)?.type !== "null");
    return option ? buildExampleFromSchema(spec, option, depth + 1) : null;
  }

  if (schema.allOf) {
    return schema.allOf.reduce(
      (acc, sub) => ({ ...acc, ...(buildExampleFromSchema(spec, sub, depth + 1) || {}) }),
      {},
    );
  }

  switch (schema.type) {
    case "object": {
      const props = schema.properties || {};
      const obj = {};
      for (const key of Object.keys(props)) {
        const property = resolveSchema(spec, props[key]);
        if (schema.required?.includes(key) || (property?.default !== undefined && property.default !== null)) {
          obj[key] = buildExampleFromSchema(spec, props[key], depth + 1);
        }
      }
      return obj;
    }
    case "array":
      return schema.items ? [buildExampleFromSchema(spec, schema.items, depth + 1)] : [];
    case "string":
      return schema.enum?.[0] ?? "";
    case "integer":
    case "number":
      return schema.minimum ?? (typeof schema.exclusiveMinimum === "number" ? schema.exclusiveMinimum + 1 : 0);
    case "boolean":
      return false;
    default:
      return null;
  }
}
