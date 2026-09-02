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
export function resolveSchema(spec, schemaOrRef) {
  if (!schemaOrRef) return null;
  if (schemaOrRef.$ref) {
    const parts = schemaOrRef.$ref.replace(/^#\//, "").split("/");
    let node = spec;
    for (const part of parts) node = node?.[part];
    return node || null;
  }
  return schemaOrRef;
}

/** Look up the operation object for a given method+path in the spec. */
export function getOperation(spec, method, path) {
  const pathItem = spec?.paths?.[path];
  if (!pathItem) return null;
  return pathItem[method.toLowerCase()] || null;
}

/** Build a best-effort example payload from a (possibly $ref'd) JSON schema. */
export function buildExampleFromSchema(spec, schemaOrRef, depth = 0) {
  const schema = resolveSchema(spec, schemaOrRef);
  if (!schema || depth > 6) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;

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
        obj[key] = buildExampleFromSchema(spec, props[key], depth + 1);
      }
      return obj;
    }
    case "array":
      return schema.items ? [buildExampleFromSchema(spec, schema.items, depth + 1)] : [];
    case "string":
      return schema.enum?.[0] ?? "";
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    default:
      return null;
  }
}
