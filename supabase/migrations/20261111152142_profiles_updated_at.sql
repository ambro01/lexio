-- Follow-up to 20261111144401_profiles (impl-review F4): keep profiles.updated_at in the database, the
-- same way as flashcards (public.set_updated_at, 20261110210825_flashcard_data_contract.sql), instead of
-- trusting a timestamp sent by the client. Inserts use the column default now(); updates get the trigger.
-- Additive: a new trigger, nothing existing changes.

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
