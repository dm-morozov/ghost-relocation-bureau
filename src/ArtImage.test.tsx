// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ArtImage from './ArtImage';

afterEach(cleanup);

it('keeps the PNG fallback and exposes all responsive WebP variants under the deployment base', () => {
  const { container } = render(
    <ArtImage
      src="/ghost-relocation-bureau/images/castle.png"
      alt="Замок"
      width={480}
      height={480}
      loading="lazy"
      className="place-photo"
      sizes="(max-width: 700px) 90vw, 480px"
    />,
  );
  const img = screen.getByRole('img', { name: 'Замок' });
  expect(img.getAttribute('src')).toBe('/ghost-relocation-bureau/images/castle.png');
  expect(img.getAttribute('loading')).toBe('lazy');
  expect(img.getAttribute('class')).toBe('place-photo');
  expect(img.getAttribute('width')).toBe('480');
  const source = container.querySelector('source');
  expect(source?.getAttribute('type')).toBe('image/webp');
  expect(source?.getAttribute('sizes')).toBe('(max-width: 700px) 90vw, 480px');
  expect(source?.getAttribute('srcset')).toBe(
    [96, 192, 480, 960]
      .map((size) => `/ghost-relocation-bureau/images/optimized/castle-${size}.webp ${size}w`)
      .join(', '),
  );
});

it('uses a numeric string width as the rendered image size', () => {
  const { container } = render(<ArtImage src="/images/ghost-01.png" alt="Призрак" width="160" />);
  expect(container.querySelector('source')?.getAttribute('sizes')).toBe('160px');
});

it('does not invent derivatives for other image sources', () => {
  const { container } = render(<ArtImage src="/custom-avatar.svg" alt="Новый портрет" />);
  expect(container.querySelector('source')).toBeNull();
  expect(screen.getByRole('img').getAttribute('src')).toBe('/custom-avatar.svg');
});
