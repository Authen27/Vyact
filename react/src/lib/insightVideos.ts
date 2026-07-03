// Vyact — evergreen card video links (v9.9.0).
// The 116 evergreen cards render from bundled JSON (lib/evergreen.ts), but a
// per-card video_url is admin-authored in content_items (same table the DB
// seed for these cards lives in, keyed by the same slug === card.id). This
// does one small read to build a slug → video_url map so EvergreenLearn can
// merge it onto the bundled cards without touching the JSON asset.
import { sb } from './supabase';

export async function fetchEvergreenVideoLinks(): Promise<Map<string, string>> {
  const { data, error } = await sb()
    .from('content_items')
    .select('slug,video_url')
    .eq('format', 'card')
    .not('video_url', 'is', null);
  if (error) throw error;
  return new Map((data as { slug: string; video_url: string }[]).map(r => [r.slug, r.video_url]));
}
