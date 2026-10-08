import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/ui";
import { MediaLibrary } from "@/components/admin/content-managers";
import { BUNDLED_MEDIA } from "@/lib/admin/bundled-media";

export const metadata = { title: "Media library" };

export default async function MediaPage() {
  await requireStaffPage("media.write");
  const supabase = (await createSupabaseServerClient())!;
  const { data } = await supabase.from("media_assets").select("id, url, alt, width, height, size_bytes, mime_type, created_at").order("created_at", { ascending: false }).limit(300);
  return (
    <div>
      <PageHeader
        title="Media library"
        description="Images you have uploaded. Uploads are checked, cleaned of hidden data (like GPS location) and converted to fast WebP automatically. Built-in brand and product images are listed at the bottom."
      />
      <MediaLibrary items={data ?? []} bundled={BUNDLED_MEDIA} />
    </div>
  );
}
