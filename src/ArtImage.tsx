import type { ComponentProps } from 'react';

type ArtImageProps = Omit<ComponentProps<'img'>, 'src' | 'srcSet'> & {
  src: string;
  alt: string;
};

/** Responsive derivatives keep the original transparent PNG as a browser fallback. */
export default function ArtImage({ src, alt, sizes, width, ...props }: ArtImageProps) {
  const match = /^(.*\/images\/)([^/]+)\.png$/.exec(src);
  if (!match) return <img src={src} alt={alt} width={width} sizes={sizes} {...props} />;

  const numericWidth = Number(width);
  const responsiveSizes =
    sizes ?? (Number.isFinite(numericWidth) && numericWidth > 0 ? `${numericWidth}px` : '100vw');
  return (
    <picture style={{ display: 'contents' }}>
      <source
        type="image/webp"
        srcSet={[96, 192, 480, 960]
          .map((size) => `${match[1]}optimized/${match[2]}-${size}.webp ${size}w`)
          .join(', ')}
        sizes={responsiveSizes}
      />
      <img src={src} alt={alt} width={width} sizes={responsiveSizes} {...props} />
    </picture>
  );
}
