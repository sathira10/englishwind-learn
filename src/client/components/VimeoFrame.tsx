import { useState, type ReactNode } from "react";
import { vimeoPlayerUrl } from "../../domain/vimeo";

type VimeoFrameProps = {
  /** The numeric Vimeo ID. Only ever rendered after the server has checked the student's grant. */
  videoId: string;
  /** Required: names the frame for screen readers, for example the lesson title. */
  title: string;
  /** Shown in place of the player when Vimeo refuses. The caller decides the wording and any
   *  next step, such as a WhatsApp link. */
  fallback: ReactNode;
  /** The caller knows Vimeo refused (a domain-lock error from the API, say). */
  unavailable?: boolean;
};

/** A 16:9 frame on `surface-dark-alt` holding the Vimeo player, or the fallback message. */
export function VimeoFrame({ videoId, ...rest }: VimeoFrameProps) {
  // Keyed by ID so an error on one video never hides the next.
  return <Frame key={videoId} videoId={videoId} {...rest} />;
}

function Frame({ videoId, title, fallback, unavailable = false }: VimeoFrameProps) {
  const [failed, setFailed] = useState(false);
  const src = vimeoPlayerUrl(videoId);
  const showFallback = unavailable || failed || src === null;

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-surface-dark-alt">
      {showFallback ? (
        <div
          className="absolute inset-0 flex items-center justify-center overflow-y-auto p-4 text-center text-base text-fg-on-dark"
          data-surface="navy"
          role="status"
        >
          <div className="max-w-measure">{fallback}</div>
        </div>
      ) : (
        <iframe
          src={src}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
