-- =============================================================================
-- UNAR — file storage for product photos, banners and content images.
-- Files are publicly readable (they appear on the website). Only staff can
-- upload/replace/delete, and uploads are additionally validated and
-- re-encoded by the server before they are stored.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "media: public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'media');

create policy "media: staff upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media' and (public.has_permission('media.write') or public.has_permission('products.write')));

create policy "media: staff update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'media' and (public.has_permission('media.write') or public.has_permission('products.write')));

create policy "media: staff delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media' and (public.has_permission('media.write') or public.has_permission('products.write')));
