/* eslint-disable @next/next/no-img-element -- This build is static React, not Next image optimization. */
import type { ImageProps } from "next/image";
export default function BrowserImage({ src, fill, unoptimized: _unoptimized, priority, quality: _quality, placeholder: _placeholder, blurDataURL: _blur, loader: _loader, onLoadingComplete: _loaded, ...props }: ImageProps) {
  void _unoptimized; void _quality; void _placeholder; void _blur; void _loader; void _loaded;
  const path = typeof src === "string" ? src : "default" in src ? src.default.src : src.src;
  const url = path.startsWith("/") ? `https://cdn.jsdelivr.net/gh/estona815/tuberbot-market@${process.env.REVIEW_SOURCE_REVISION}/public${path}` : path;
  return <img {...props} src={url} alt={props.alt} loading={priority ? "eager" : props.loading ?? "lazy"} style={{ ...props.style, ...(fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : {}) }} />;
}
