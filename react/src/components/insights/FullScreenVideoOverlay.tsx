// Vyact — full-screen YouTube short overlay (v9.9.1).
// Opened from the infographic detail viewer's "Watch video" action. Fills the
// viewport (portrait on mobile, matching the short's own aspect) and
// autoplays; closing returns to the infographic underneath.
import { X, ExternalLink } from 'lucide-react';
import { youtubeEmbedUrl, youtubeWatchUrl } from '../../lib/youtube';

export default function FullScreenVideoOverlay({ videoUrl, title, onClose }: {
  videoUrl: string; title: string; onClose: () => void;
}) {
  const embed = youtubeEmbedUrl(videoUrl);
  const watch = youtubeWatchUrl(videoUrl);
  if (!embed) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col" role="dialog" aria-label={`${title} — video`} aria-modal="true">
      <div className="flex-1 relative">
        <iframe
          src={`${embed}&autoplay=1&playsinline=1`}
          title={`${title} — video`}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="flex items-center justify-between px-4 py-3 bg-black">
        {watch && (
          <a href={watch} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[0.8rem] font-medium text-white/80 hover:text-white">
            <ExternalLink size={14} /> Open in YouTube
          </a>
        )}
        <button onClick={onClose} aria-label="Close video"
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center ml-auto">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
