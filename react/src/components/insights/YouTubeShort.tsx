// Vyact — YouTube short player for Insight cards (v9.9.0).
// Click-to-play (no autoplay/inline iframe by default — keeps the reader light),
// plus an explicit "Open in YouTube" redirect so a user can like/comment/subscribe
// on the actual video.
import { useState } from 'react';
import { PlayCircle, ExternalLink } from 'lucide-react';
import { youtubeEmbedUrl, youtubeWatchUrl } from '../../lib/youtube';

export default function YouTubeShort({ videoUrl, title }: { videoUrl: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const embed = youtubeEmbedUrl(videoUrl);
  const watch = youtubeWatchUrl(videoUrl);
  if (!embed || !watch) return null;

  return (
    <div className="rounded-lg overflow-hidden border border-line bg-bg3">
      {playing ? (
        <div className="aspect-video w-full">
          <iframe
            src={`${embed}&autoplay=1`}
            title={`${title} — video`}
            className="w-full h-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <button
          onClick={() => setPlaying(true)}
          aria-label={`Play video: ${title}`}
          className="w-full aspect-video flex flex-col items-center justify-center gap-2 bg-ink/5 hover:bg-ink/10 transition-colors"
        >
          <PlayCircle size={44} className="text-coral" strokeWidth={1.4} />
          <span className="font-mono text-[0.62rem] tracking-wider uppercase text-ink-dim">Watch the short</span>
        </button>
      )}
      <a
        href={watch}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-1.5 py-2 text-[0.76rem] font-medium text-ink-mid hover:text-coral border-t border-line transition-colors"
      >
        <ExternalLink size={13} /> Open in YouTube
      </a>
    </div>
  );
}
