import { Link, useParams } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { t } from "@/lib/translations";
import { API_REFERENCE_GROUPS, flattenEntries, findGroup } from "@/lib/apiReferenceGroups";
import { API_AUTH_GUIDE } from "@/lib/apiAuthGuide";
import { Badge } from "@/components/ui/badge";

function MethodBadge({ method }) {
  const colors = {
    GET: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    POST: "bg-green-500/10 text-green-600 border-green-500/30",
    PUT: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    PATCH: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    DELETE: "bg-red-500/10 text-red-600 border-red-500/30",
  };
  return (
    <Badge variant="outline" className={`font-mono ${colors[method] || ""}`}>
      {method}
    </Badge>
  );
}

function GuideSection({ lang }) {
  const g = API_AUTH_GUIDE[lang];
  return (
    <div className="space-y-8" data-testid="apiref-guide">
      <section>
        <h2 className="text-lg font-semibold mb-2">{g.baseUrlHeading}</h2>
        <p className="text-sm text-muted-foreground">{g.baseUrlBody}</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-2">{g.authHeading}</h2>
        <p className="text-sm text-muted-foreground mb-3">{g.authBody}</p>
        <pre className="p-4 rounded-lg overflow-x-auto text-sm bg-[#0A0B0F] text-[#C4D4F8]">
          <code>{g.curlExample}</code>
        </pre>
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-2">{g.errorsHeading}</h2>
        <p className="text-sm text-muted-foreground mb-3">{g.errorsBody}</p>
        <pre className="p-4 rounded-lg overflow-x-auto text-sm bg-[#0A0B0F] text-[#C4D4F8] mb-4">
          <code>{g.errorExample}</code>
        </pre>
        <div className="rounded-lg border border-border overflow-hidden">
          {g.errorTable.map((row) => (
            <div key={row.status} className="flex gap-4 px-4 py-2.5 border-b border-border last:border-0 text-sm">
              <span className="font-mono shrink-0 w-48">{row.status}</span>
              <span className="text-muted-foreground">{row.cause}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function GroupCard({ group, lang }) {
  const entryCount = flattenEntries(group.entries).length;
  const title = lang === "tr" ? group.title_tr : group.title_en;
  return (
    <Link
      to={`/api-referansi/${group.slug}`}
      className="p-6 rounded-xl border border-border bg-card hover:border-primary/40 transition-all flex flex-col"
      data-testid={`apiref-group-${group.slug}`}
    >
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {!group.guide && (
        <p className="text-sm text-muted-foreground mb-3">
          {entryCount} {t("apiRef.endpointCount", lang)}
        </p>
      )}
      <span className="mt-auto text-sm text-primary flex items-center gap-1">
        {t("apiRef.tryIt", lang)} <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </Link>
  );
}

function EndpointRow({ groupSlug, entry, lang, depth = 0 }) {
  const title = lang === "tr" ? entry.title_tr : entry.title_en;
  if (entry.children) {
    return (
      <div>
        <div className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground" style={{ paddingLeft: `${1 + depth}rem` }}>
          {title}
        </div>
        {entry.children.map((child) => (
          <EndpointRow key={child.opSlug} groupSlug={groupSlug} entry={{ ...child, opSlug: `${entry.opSlug}/${child.opSlug}` }} lang={lang} depth={depth + 1} />
        ))}
      </div>
    );
  }
  return (
    <Link
      to={`/api-referansi/${groupSlug}/${entry.opSlug}`}
      className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-secondary/40 transition-colors text-sm"
      style={{ paddingLeft: `${1 + depth}rem` }}
      data-testid={`apiref-endpoint-${groupSlug}-${entry.opSlug}`}
    >
      <MethodBadge method={entry.method} />
      <span className="font-mono text-xs text-muted-foreground">{entry.path}</span>
      <span className="ml-auto flex items-center gap-1">
        {title} <ChevronRight className="w-3.5 h-3.5 opacity-50" />
      </span>
    </Link>
  );
}

export default function ApiReferenceIndexPage() {
  const { groupSlug } = useParams();
  const { lang } = useLanguage();

  if (!groupSlug) {
    return (
      <div data-testid="apiref-index">
        <h1 className="text-2xl font-semibold mb-1">{t("apiRef.heading", lang)}</h1>
        <p className="text-sm text-muted-foreground mb-8">{t("apiRef.subtitle", lang)}</p>
        <div className="grid md:grid-cols-2 gap-4">
          {API_REFERENCE_GROUPS.map((group) => (
            <GroupCard key={group.slug} group={group} lang={lang} />
          ))}
        </div>
      </div>
    );
  }

  const group = findGroup(groupSlug);
  if (!group) {
    return <div className="py-16 text-muted-foreground">Bulunamadı.</div>;
  }

  const title = lang === "tr" ? group.title_tr : group.title_en;

  return (
    <div data-testid={`apiref-group-page-${group.slug}`}>
      <h1 className="text-2xl font-semibold mb-6">{title}</h1>
      {group.guide ? (
        <GuideSection lang={lang} />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          {group.entries.map((entry) => (
            <EndpointRow key={entry.opSlug} groupSlug={group.slug} entry={entry} lang={lang} />
          ))}
        </div>
      )}
    </div>
  );
}
