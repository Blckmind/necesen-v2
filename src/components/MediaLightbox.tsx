import React from 'react';
import { X, Download } from 'lucide-react';

interface MediaLightboxProps {
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | null;
  onClose: () => void;
}

export const MediaLightbox: React.FC<MediaLightboxProps> = ({
  mediaUrl,
  mediaType,
  onClose
}) => {
  if (!mediaUrl || !mediaType) return null;

  return (
    <div 
      id="media-lightbox-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-none"
      onClick={onClose}
    >
      {/* Action buttons */}
      <div 
        className="absolute top-4 right-4 flex items-center gap-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={mediaUrl}
          download={`khami_studio_media_${Date.now()}`}
          className="p-2.5 rounded-full bg-zinc-900/80 border border-zinc-700 text-white hover:bg-zinc-800 transition-colors"
          title="Yüklə"
        >
          <Download className="w-5 h-5" />
        </a>
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-zinc-900/80 border border-zinc-700 text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Bağla"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div 
        className="max-w-4xl max-h-[85vh] flex items-center justify-center overflow-hidden rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {mediaType === 'image' ? (
          <img
            src={mediaUrl}
            alt="Böyük şəkil"
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
          />
        ) : (
          <video
            src={mediaUrl}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded-xl shadow-2xl"
          />
        )}
      </div>
    </div>
  );
};
