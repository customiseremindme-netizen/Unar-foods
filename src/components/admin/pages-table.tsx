import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { KIND_LABELS, publicPathFor } from "@/lib/admin/content-paths";
import { Table, Td, Th } from "./ui";
import { Badge, EmptyState } from "@/components/ui/misc";

type Row = {
  group_id: string;
  kind: string;
  state: string;
  slug: string;
  title: string;
  requires_owner_review: boolean;
  updated_at: string;
  published_at: string | null;
  body_md: string;
  excerpt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
};

export type PageGroup = { groupId: string; draft: Row | null; published: Row | null };

const SAME_FIELDS = ["slug", "title", "body_md", "excerpt", "seo_title", "seo_description", "cover_image_url", "cover_image_alt", "requires_owner_review"] as const;

export function groupPages(rows: Row[]): PageGroup[] {
  const map = new Map<string, PageGroup>();
  for (const r of rows) {
    const g = map.get(r.group_id) ?? { groupId: r.group_id, draft: null, published: null };
    if (r.state === "draft") g.draft = r;
    else g.published = r;
    map.set(r.group_id, g);
  }
  return [...map.values()];
}

export function PagesTable({ groups, emptyText = "Nothing here yet." }: { groups: PageGroup[]; emptyText?: string }) {
  if (groups.length === 0) return <EmptyState title={emptyText} />;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Title</Th>
          <Th>Type</Th>
          <Th>Status</Th>
          <Th>Updated</Th>
          <Th>Web address</Th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => {
          const row = g.draft ?? g.published!;
          const changed = g.draft && g.published && SAME_FIELDS.some((f) => g.draft![f] !== g.published![f]);
          return (
            <tr key={g.groupId} className="hover:bg-cream/40">
              <Td>
                <Link href={`/admin/content/pages/${g.groupId}`} className="font-semibold text-forest hover:underline">
                  {row.title}
                </Link>
              </Td>
              <Td className="text-muted">{KIND_LABELS[row.kind]}</Td>
              <Td>
                <span className="flex flex-wrap gap-1">
                  {g.published ? <Badge tone="success">Live</Badge> : <Badge tone="neutral">Draft</Badge>}
                  {changed ? <Badge tone="banana">Unpublished changes</Badge> : null}
                  {row.requires_owner_review ? <Badge tone="danger">Owner review required</Badge> : null}
                </span>
              </Td>
              <Td className="text-muted">{formatDate(row.updated_at)}</Td>
              <Td className="font-mono text-[0.76rem] text-muted">{publicPathFor(row.kind, (g.published ?? row).slug)}</Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
