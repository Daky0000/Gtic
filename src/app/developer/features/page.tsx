import { requirePortal } from "@/lib/rbac";
import {
  getHiddenFeatureKeys,
  navFlagKey,
  portalFlagKey,
  HIDEABLE_NAV,
  HIDEABLE_PORTALS,
} from "@/lib/feature-flags";
import { toggleFeature } from "@/lib/actions/features";
import { Flash } from "@/components/flash";
import { PageHeader, Card, CardLabel, StatusChip } from "@/components/ui";

export const metadata = { title: "Feature Visibility" };

export default async function FeatureVisibilityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requirePortal("developer");
  const { error, saved } = await searchParams;
  const hidden = await getHiddenFeatureKeys();

  return (
    <div className="scr">
      <PageHeader
        title={<>Feature <em className="text-forest">visibility.</em></>}
        lead="Hide whole portals or individual menu items from the people who use them. Hiding a portal blocks entry outright for everyone but the developer account; hiding a menu item only removes its sidebar link — the page itself stays reachable by direct URL."
      />
      <Flash error={error} success={saved ? "Saved." : undefined} />

      <Card className="mt-6">
        <CardLabel>Portals</CardLabel>
        <div>
          {HIDEABLE_PORTALS.map(({ portal, label }, i) => {
            const key = portalFlagKey(portal);
            return (
              <ToggleRow
                key={key}
                label={label}
                sub={`/${portal}`}
                flagKey={key}
                hidden={hidden.has(key)}
                first={i === 0}
              />
            );
          })}
        </div>
      </Card>

      {HIDEABLE_NAV.map((group) => (
        <Card key={group.portal} className="mt-6">
          <CardLabel>{group.portalLabel} — menu items</CardLabel>
          <div>
            {group.items.map((item, i) => {
              const key = navFlagKey(item.href);
              return (
                <ToggleRow
                  key={key}
                  label={item.label}
                  sub={item.href}
                  flagKey={key}
                  hidden={hidden.has(key)}
                  first={i === 0}
                />
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ToggleRow({
  label,
  sub,
  flagKey,
  hidden,
  first,
}: {
  label: string;
  sub: string;
  flagKey: string;
  hidden: boolean;
  first: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-line-soft py-3 ${first ? "" : "border-t"}`}
    >
      <div className="min-w-0">
        <div className="text-sm text-ink">{label}</div>
        <div className="font-mono text-[11px] text-faint">{sub}</div>
      </div>
      <div className="flex items-center gap-3">
        <StatusChip tone={hidden ? "amber" : "green"}>{hidden ? "hidden" : "visible"}</StatusChip>
        <form action={toggleFeature}>
          <input type="hidden" name="key" value={flagKey} />
          <input type="hidden" name="hidden" value={hidden ? "0" : "1"} />
          <button
            type="submit"
            className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-forest hover:text-forest"
          >
            {hidden ? "Show" : "Hide"}
          </button>
        </form>
      </div>
    </div>
  );
}
