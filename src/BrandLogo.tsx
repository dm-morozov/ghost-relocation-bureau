import './brand.css';

/** The generated mark and wordmark remain independently reusable assets. */
export default function BrandLogo() {
  const base = `${import.meta.env.BASE_URL}brand/`;
  return (
    <>
      <img
        className="brand-symbol"
        src={`${base}mark-64.png`}
        srcSet={`${base}mark-64.png 1x, ${base}mark-192.png 3x`}
        alt=""
        width={52}
        height={52}
      />
      <span className="brand-wording">
        <img
          className="brand-wordmark"
          src={`${base}wordmark-320.webp`}
          srcSet={`${base}wordmark-320.webp 1x, ${base}wordmark-640.webp 2x`}
          alt="Тихий адрес"
          width={160}
          height={33}
        />
        <small>Бюро переселения привидений</small>
      </span>
    </>
  );
}
