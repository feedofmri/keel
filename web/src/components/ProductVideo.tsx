import { useState } from "react";
import { asset } from "../lib/env";

// The product overview video, hosted on YouTube. The player loads only when the visitor presses play
// (no YouTube requests or cookies before then), using the privacy-enhanced youtube-nocookie.com domain.
export const VIDEO_ID = "1RSKHhfeah4";
export const VIDEO_URL = `https://youtu.be/${VIDEO_ID}`;

export function ProductVideo() {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="video-frame">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title="Keel product overview" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin" />
      ) : (
        <button className="video-poster" onClick={() => setPlaying(true)} aria-label="Play the Keel product overview video">
          <img src={asset("media/keel-overview-poster.jpg")} alt="" />
          <span className="play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>Play video</span>
        </button>
      )}
    </div>
  );
}
