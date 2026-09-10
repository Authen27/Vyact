import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { upsertContent, listAllContent, deleteContent, uploadInfographic } from '../contentApi';

const api = vi.hoisted(() => ({ from: vi.fn(), storage: { from: vi.fn() } }));
vi.mock('../supabase', () => ({ sb: () => api }));

function response(data: unknown) {
  const query = { insert: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn(), order: vi.fn(), delete: vi.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve) };
  for (const method of [query.insert, query.update, query.eq, query.select, query.single, query.order, query.delete]) method.mockReturnValue(query);
  api.from.mockReturnValueOnce(query);
  return query;
}

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-09T12:00:00Z')); });
afterEach(() => vi.useRealTimers());

describe('content publication service', () => {
  it.each(['article', 'card', 'external'] as const)('creates a %s draft, publishes and reloads its authoritative row', async format => {
    const input = { slug: 'saving', title: 'Saving', topic: 'budgeting' as const, status: 'draft' as const,
      author_name: 'Editor', format, body_md: 'Source text', reading_seconds: 120 };
    const row = { ...input, id: 'content', body: 'Source text', created_at: '2026-09-09T12:00:00Z',
      updated_at: '2026-09-09T12:00:00Z', published_at: null };
    const insert = response(row);
    const draft = await upsertContent(input);
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ body: 'Source text', status: 'draft', published_at: null, read_minutes: 2 }));
    expect(draft).toMatchObject({ id: 'content', status: 'draft', publishedAt: undefined, format });
    const publishedRow = { ...row, status: 'published', published_at: '2026-09-09T12:00:00.000Z' };
    const update = response(publishedRow);
    const published = await upsertContent({ ...input, id: draft.id, status: 'published' });
    expect(update.eq).toHaveBeenCalledWith('id', 'content');
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'published', published_at: '2026-09-09T12:00:00.000Z' }));
    response([publishedRow]);
    expect(await listAllContent()).toEqual([published]);
  });

  it('preserves media timestamps on an unchanged URL and deletes the requested content row', async () => {
    const query = response({ id: 'content' });
    await upsertContent({ id: 'content', slug: 'saving', title: 'Saving', topic: 'budgeting', status: 'published',
      author_name: 'Editor', video_url: 'https://example.com/video', prev_video_url: 'https://example.com/video',
      published_at: '2026-08-01T12:00:00Z' });
    expect(query.update.mock.calls[0][0]).not.toHaveProperty('video_updated_at');
    expect(query.update.mock.calls[0][0].published_at).toBe('2026-08-01T12:00:00Z');
    const removal = response(null);
    await deleteContent('content');
    expect(removal.delete).toHaveBeenCalledOnce();
    expect(removal.eq).toHaveBeenCalledWith('id', 'content');
  });

  it('uploads an infographic and returns the storage public URL', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/image.png' } });
    api.storage.from.mockReturnValue({ upload, getPublicUrl });
    const file = new File(['image'], 'chart.png', { type: 'image/png' });
    expect(await uploadInfographic(file)).toBe('https://example.com/image.png');
    expect(api.storage.from).toHaveBeenCalledWith('insight-infographics');
    const storagePath = upload.mock.calls[0][0];
    expect(storagePath).toMatch(/^[0-9a-f-]+\.png$/);
    expect(upload).toHaveBeenCalledWith(storagePath, file, { contentType: 'image/png', upsert: false });
    expect(getPublicUrl).toHaveBeenCalledWith(storagePath);
  });
});