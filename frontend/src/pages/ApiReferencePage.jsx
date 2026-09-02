import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { Copy, Check, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { t } from "@/lib/translations";
import { findGroup, findEntry } from "@/lib/apiReferenceGroups";
import {
  fetchOpenApiSpec,
  getOperation,
  resolveSchema,
  buildExampleFromSchema,
  DEFAULT_API_BASE_URL,
} from "@/lib/apiReferenceSpec";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const API_KEY_STORAGE = "verasist_api_key";
const BASE_URL_STORAGE = "verasist_api_base_url";

const METHOD_COLORS = {
  GET: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  POST: "bg-green-500/10 text-green-600 border-green-500/30",
  PUT: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  PATCH: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  DELETE: "bg-red-500/10 text-red-600 border-red-500/30",
};

function buildCurl({ method, url, headers, body }) {
  const parts = [`curl -X ${method} "${url}"`];
  for (const [key, value] of Object.entries(headers)) {
    if (!value) continue;
    parts.push(`  -H "${key}: ${value}"`);
  }
  if (body) parts.push(`  -d '${body}'`);
  return parts.join(" \\\n");
}

export default function ApiReferencePage() {
  const { groupSlug, "*": splat } = useParams();
  const { lang } = useLanguage();

  const group = findGroup(groupSlug);
  const entry = findEntry(groupSlug, splat);

  const [spec, setSpec] = useState(null);
  const [specError, setSpecError] = useState(null);
  const [baseUrl, setBaseUrl] = useState(
    () => localStorage.getItem(BASE_URL_STORAGE) || DEFAULT_API_BASE_URL,
  );
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) || "");
  const [pathValues, setPathValues] = useState({});
  const [queryValues, setQueryValues] = useState({});
  const [bodyText, setBodyText] = useState("");
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    localStorage.setItem(BASE_URL_STORAGE, baseUrl);
  }, [baseUrl]);
  useEffect(() => {
    localStorage.setItem(API_KEY_STORAGE, apiKey);
  }, [apiKey]);

  useEffect(() => {
    setSpec(null);
    setSpecError(null);
    fetchOpenApiSpec(baseUrl)
      .then(setSpec)
      .catch((err) => setSpecError(err.message || String(err)));
  }, [baseUrl]);

  const operation = useMemo(() => {
    if (!spec || !entry) return null;
    // OpenAPI paths are recorded with the /api/v1 prefix; our config stores the bare path.
    return getOperation(spec, entry.method, `/api/v1${entry.path}`);
  }, [spec, entry]);

  const parameters = operation?.parameters || [];
  // Derive path params directly from the path template (not just from the spec):
  // this guarantees an input renders for every {placeholder}, even if the live
  // spec lookup fails or omits parameter metadata for some reason.
  const pathParamNames = useMemo(() => {
    const names = [];
    const re = /\{(\w+)\}/g;
    let m;
    while ((m = re.exec(entry?.path || ""))) names.push(m[1]);
    return names;
  }, [entry]);
  const pathParams = pathParamNames.map(
    (name) => parameters.find((p) => p.in === "path" && p.name === name) || { name, required: true, in: "path" },
  );
  const queryParams = parameters.filter((p) => p.in === "query");

  const requestBodySchema = operation?.requestBody?.content?.["application/json"]?.schema;

  const exampleBody = useMemo(() => {
    if (!spec || !requestBodySchema) return null;
    return buildExampleFromSchema(spec, requestBodySchema);
  }, [spec, requestBodySchema]);

  // Reset form state whenever the resolved operation changes.
  useEffect(() => {
    setPathValues({});
    setQueryValues({});
    setResponse(null);
    setBodyText(exampleBody !== null ? JSON.stringify(exampleBody, null, 2) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.opSlug, exampleBody]);

  if (!group || !entry) {
    return (
      <div className="py-16 text-muted-foreground" data-testid="apiref-not-found">
        Uç nokta bulunamadı.
      </div>
    );
  }

  const groupTitle = lang === "tr" ? group.title_tr : group.title_en;
  const entryTitle = lang === "tr" ? entry.title_tr : entry.title_en;
  const entryDescription = lang === "tr" ? entry.description_tr : entry.description_en;

  const resolvedPath = entry.path.replace(/\{(\w+)\}/g, (_, name) =>
    pathValues[name] ? encodeURIComponent(pathValues[name]) : `{${name}}`,
  );
  const queryString = Object.entries(queryValues)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const fullUrl = `${baseUrl.replace(/\/+$/, "")}/api/v1${resolvedPath}${queryString ? `?${queryString}` : ""}`;

  const headers = {
    "Content-Type": "application/json",
    "X-API-Key": apiKey || undefined,
  };

  const hasBody = !!requestBodySchema;

  const curlSnippet = buildCurl({
    method: entry.method,
    url: fullUrl,
    headers,
    body: hasBody && bodyText ? bodyText : null,
  });

  const handleCopyCurl = () => {
    navigator.clipboard?.writeText(curlSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSend = async () => {
    setSending(true);
    setResponse(null);
    let parsedBody;
    if (hasBody && bodyText.trim()) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch {
        setResponse({ error: t("apiRef.invalidJson", lang) });
        setSending(false);
        return;
      }
    }
    const startedAt = performance.now();
    try {
      const res = await axios.request({
        method: entry.method,
        url: fullUrl,
        headers: { "Content-Type": "application/json", ...(apiKey ? { "X-API-Key": apiKey } : {}) },
        data: parsedBody,
        validateStatus: () => true,
      });
      setResponse({
        status: res.status,
        timeMs: Math.round(performance.now() - startedAt),
        data: res.data,
      });
    } catch (err) {
      setResponse({
        error: err.message || String(err),
        timeMs: Math.round(performance.now() - startedAt),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div data-testid={`apiref-page-${group.slug}-${entry.opSlug}`}>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
        <Link to="/api-referansi" className="hover:text-foreground">
          {t("apiRef.heading", lang)}
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link to={`/api-referansi/${group.slug}`} className="hover:text-foreground">
          {groupTitle}
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-1">
        <Badge variant="outline" className={`font-mono ${METHOD_COLORS[entry.method] || ""}`}>
          {entry.method}
        </Badge>
        <span className="font-mono text-sm text-muted-foreground">{entry.path}</span>
      </div>
      <h1 className="text-2xl font-semibold mb-1">{entryTitle}</h1>
      {(entryDescription || operation?.description) && (
        <p className="text-sm text-muted-foreground mb-6">
          {entryDescription || operation.description}
        </p>
      )}

      {specError && (
        <div className="p-3 mb-6 rounded-md border border-destructive/30 bg-destructive/10 text-sm text-destructive">
          {t("apiRef.specLoadError", lang)}: {specError}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: request builder */}
        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium block mb-1">{t("apiRef.baseUrl", lang)}</label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} data-testid="apiref-base-url" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">{t("apiRef.apiKeyLabel", lang)}</label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t("apiRef.apiKeyPlaceholder", lang)}
              data-testid="apiref-api-key"
            />
          </div>

          {(pathParams.length > 0 || queryParams.length > 0) && (
            <div>
              <h3 className="text-sm font-medium mb-2">{t("apiRef.parameters", lang)}</h3>
              <div className="space-y-2">
                {pathParams.map((p) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <label className="text-xs font-mono w-40 shrink-0 truncate" title={p.name}>
                      {p.name}
                      {p.required && <span className="text-destructive"> *</span>}
                    </label>
                    <Input
                      value={pathValues[p.name] || ""}
                      onChange={(e) => setPathValues((v) => ({ ...v, [p.name]: e.target.value }))}
                      placeholder={`path · ${resolveSchema(spec, p.schema)?.type || "string"}`}
                      data-testid={`apiref-param-${p.name}`}
                    />
                  </div>
                ))}
                {queryParams.map((p) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <label className="text-xs font-mono w-40 shrink-0 truncate" title={p.name}>
                      {p.name}
                      {p.required && <span className="text-destructive"> *</span>}
                    </label>
                    <Input
                      value={queryValues[p.name] || ""}
                      onChange={(e) => setQueryValues((v) => ({ ...v, [p.name]: e.target.value }))}
                      placeholder={`query · ${resolveSchema(spec, p.schema)?.type || "string"}`}
                      data-testid={`apiref-param-${p.name}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasBody && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-medium">{t("apiRef.requestBody", lang)}</h3>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setBodyText(exampleBody !== null ? JSON.stringify(exampleBody, null, 2) : "")}
                >
                  {t("apiRef.resetExample", lang)}
                </button>
              </div>
              <Textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={10}
                className="font-mono text-xs"
                data-testid="apiref-request-body"
              />
            </div>
          )}

          <Button onClick={handleSend} disabled={sending || !spec} data-testid="apiref-send-btn">
            {sending ? t("apiRef.sending", lang) : t("apiRef.tryIt", lang)}
          </Button>
        </div>

        {/* Right: curl preview + response */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-medium">cURL</h3>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={handleCopyCurl}
                data-testid="apiref-copy-curl"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? t("apiRef.copied", lang) : t("apiRef.copyAsCurl", lang)}
              </button>
            </div>
            <pre className="p-4 rounded-lg overflow-x-auto text-xs bg-[#0A0B0F] text-[#C4D4F8]">
              <code>{curlSnippet}</code>
            </pre>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-1">{t("apiRef.response", lang)}</h3>
            {!response ? (
              <p className="text-sm text-muted-foreground">{t("apiRef.noResponseYet", lang)}</p>
            ) : response.error ? (
              <div className="p-3 rounded-md border border-destructive/30 bg-destructive/10 text-sm text-destructive">
                {response.error}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-4 mb-2 text-sm">
                  <span>
                    {t("apiRef.status", lang)}:{" "}
                    <span
                      className={
                        response.status < 300
                          ? "text-green-600 font-semibold"
                          : response.status < 500
                            ? "text-amber-600 font-semibold"
                            : "text-red-600 font-semibold"
                      }
                    >
                      {response.status}
                    </span>
                  </span>
                  <span>
                    {t("apiRef.latency", lang)}: {response.timeMs}ms
                  </span>
                </div>
                <pre className="p-4 rounded-lg overflow-x-auto text-xs bg-[#0A0B0F] text-[#C4D4F8] max-h-[420px]" data-testid="apiref-response-body">
                  <code>{JSON.stringify(response.data, null, 2)}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
