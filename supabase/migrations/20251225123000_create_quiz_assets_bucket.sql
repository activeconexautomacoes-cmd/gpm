-- Create the quiz-assets bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('quiz-assets', 'quiz-assets', true)
on conflict (id) do nothing;

-- Set up RLS policies for the bucket
create policy "Public Access to Quiz Assets"
  on storage.objects for select
  to public
  using ( bucket_id = 'quiz-assets' );

create policy "Authenticated Upload to Quiz Assets"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'quiz-assets' );

create policy "Authenticated Update to Quiz Assets"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'quiz-assets' );

create policy "Authenticated Delete to Quiz Assets"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'quiz-assets' );
