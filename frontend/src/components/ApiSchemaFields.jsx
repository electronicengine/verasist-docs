import { useEffect, useId, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { fieldHint, fieldSchema } from "@/lib/apiFieldSchema";
import { buildExampleFromSchema } from "@/lib/apiReferenceSpec";

export function FieldLabel({ name, inputId, hint, required, lang }) {
  const [open, setOpen] = useState(false);
  return <div className="flex items-center gap-2 mb-1.5">
    <label htmlFor={inputId} className="text-sm font-medium break-all">{name}{required && <span className="text-destructive"> *</span>}</label>
    <TooltipProvider delayDuration={150}><Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild><button type="button" className="shrink-0 rounded-full border w-5 h-5 text-xs text-muted-foreground hover:text-primary focus:ring-2 focus:ring-primary"
        aria-label={`${name}: ${lang === "tr" ? "açıklama" : "help"}`} onClick={() => setOpen(true)}>?</button></TooltipTrigger>
      <TooltipContent side="bottom" align="start" collisionPadding={16} className="max-w-[min(320px,80vw)] leading-relaxed">{hint}</TooltipContent>
    </Tooltip></TooltipProvider>
  </div>;
}

function JsonField({ id, value, onChange, schema, required, lang }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2) ?? "");
  const ref = useRef(null);
  const serialized = JSON.stringify(value);
  useEffect(() => { setText(value === undefined ? "" : JSON.stringify(JSON.parse(serialized), null, 2)); ref.current?.setCustomValidity(""); }, [serialized]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Textarea ref={ref} id={id} aria-label={id} rows={5} className="font-mono text-xs" value={text} required={required}
    onChange={(event) => {
      setText(event.target.value);
      try {
        const next = JSON.parse(event.target.value);
        if (schema.type === "array" && !Array.isArray(next)) throw new Error();
        if (schema.type === "object" && (!next || Array.isArray(next) || typeof next !== "object")) throw new Error();
        event.target.setCustomValidity(""); onChange(next);
      } catch (_) { event.target.setCustomValidity(lang === "tr" ? "Alan türüne uygun geçerli JSON girin." : "Enter valid JSON matching this field’s type."); }
    }} />;
}

export function SchemaField({ spec, name, schema: raw, required = false, value, onChange, lang, depth = 0, description, optionalToggle = true }) {
  const id = useId();
  const schema = fieldSchema(spec, raw);
  const tr = lang === "tr";
  const enabled = required || !optionalToggle || value !== undefined;
  const variants = schema.discriminator?.mapping ? Object.entries(schema.discriminator.mapping) : [];
  const discriminator = schema.discriminator?.propertyName;
  const variant = variants.find(([key]) => key === value?.[discriminator]) || variants[0];
  const nested = schema.properties && !schema.anyOf && !schema.oneOf && depth < 5;
  const itemSchema = fieldSchema(spec, schema.items);
  const enumArray = schema.type === "array" && itemSchema.enum;
  const json = !nested && (schema.type === "array" || schema.type === "object" || schema.anyOf || schema.oneOf || !schema.type);
  const initial = () => schema.default ?? buildExampleFromSchema(spec, schema) ?? (nested ? {} : schema.type === "boolean" ? false : "");
  const setProperty = (key, next) => {
    const result = { ...(value || {}) };
    if (next === undefined) delete result[key]; else result[key] = next;
    onChange(result);
  };
  return <div className="min-w-0 space-y-1" data-field-name={name}>
    <FieldLabel name={name} inputId={id} required={required} lang={lang} hint={fieldHint(name, schema, required, lang, description)} />
    {!required && optionalToggle && <label className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
      <input type="checkbox" checked={enabled} onChange={(event) => onChange(event.target.checked ? initial() : undefined)} />
      {tr ? "İsteğe dahil et" : "Include in request"}
    </label>}
    {enabled && <>
      {schema.nullable && <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={value === null} onChange={(event) => onChange(event.target.checked ? null : initial())} />null
      </label>}
      {value !== null || !schema.nullable ? variants.length ? <div className="space-y-4 border-l-2 pl-4">
        <FieldLabel name={discriminator} inputId={`${id}-variant`} lang={lang} required hint={tr ? "Sağlayıcıyı seçin. Gerekli alanlar seçiminize göre değişir; seçim değiştiğinde önceki sağlayıcının değerleri temizlenir." : "Select a provider. Its required fields appear below; changing provider clears the previous provider’s values."} />
        <select id={`${id}-variant`} className="w-full h-10 border rounded-md bg-background px-3 text-sm" value={variant[0]}
          onChange={(event) => { const [, ref] = variants.find(([key]) => key === event.target.value); onChange({ ...buildExampleFromSchema(spec, { $ref: ref }), [discriminator]: event.target.value }); }}>
          {variants.map(([key]) => <option key={key} value={key}>{key}</option>)}
        </select>
        <ApiSchemaFields spec={spec} schema={{ $ref: variant[1] }} value={value} onChange={onChange} lang={lang} exclude={[discriminator]} />
      </div> : nested ? <fieldset id={id} className="border-l-2 pl-4 space-y-4" aria-label={name}>
        {Object.entries(schema.properties).map(([key, child]) => <SchemaField key={key} spec={spec} name={key} schema={child} required={schema.required?.includes(key)} value={value?.[key]} onChange={(next) => setProperty(key, next)} lang={lang} depth={depth + 1} />)}
      </fieldset> : enumArray ? <select id={id} multiple className="w-full min-h-24 border rounded-md bg-background px-3 py-2 text-sm" required={required} value={(value || []).map((item) => JSON.stringify(item))}
        onChange={(event) => onChange([...event.target.selectedOptions].map((option) => JSON.parse(option.value)))}>
        {itemSchema.enum.map((option) => <option key={JSON.stringify(option)} value={JSON.stringify(option)}>{String(option)}</option>)}
      </select> : json ? <JsonField id={id} value={value} onChange={onChange} schema={schema} required={required} lang={lang} />
      : schema.enum || schema.type === "boolean" ? <select id={id} className="w-full h-10 border rounded-md bg-background px-3 text-sm" required={required} value={value === undefined ? "" : JSON.stringify(value)} onChange={(event) => onChange(event.target.value === "" ? undefined : JSON.parse(event.target.value))}>
        <option value="">{tr ? "Seçin" : "Choose"}</option>
        {(schema.enum || [true, false]).map((option) => <option key={JSON.stringify(option)} value={JSON.stringify(option)}>{String(option)}</option>)}
      </select> : <Input id={id} value={value ?? ""} type={schema.type === "integer" || schema.type === "number" ? "number" : schema.writeOnly || schema.format === "password" ? "password" : schema.format === "date" ? "date" : schema.format === "email" ? "email" : schema.format === "uri" ? "url" : "text"}
        min={schema.minimum} max={schema.maximum} minLength={schema.minLength} maxLength={schema.maxLength} pattern={schema.pattern}
        step={schema.type === "integer" ? 1 : "any"} required={required}
        placeholder={schema.format || schema.type}
        onChange={(event) => onChange(event.target.type === "number" ? (event.target.value === "" ? undefined : Number(event.target.value)) : event.target.value)} /> : null}
    </>}
  </div>;
}

export default function ApiSchemaFields({ spec, schema, value, onChange, lang, exclude = [] }) {
  const resolved = fieldSchema(spec, schema);
  if (!resolved.properties) return <SchemaField spec={spec} schema={resolved} name={lang === "tr" ? "İstek gövdesi" : "Request body"} value={value} onChange={onChange} required lang={lang} />;
  return <div className="space-y-5">{Object.entries(resolved.properties).filter(([name]) => !exclude.includes(name)).map(([name, field]) => <SchemaField key={name} spec={spec} name={name} schema={field} required={resolved.required?.includes(name)} value={value?.[name]} lang={lang}
    onChange={(next) => { const result = { ...(value || {}) }; if (next === undefined) delete result[name]; else result[name] = next; onChange(result); }} />)}</div>;
}
