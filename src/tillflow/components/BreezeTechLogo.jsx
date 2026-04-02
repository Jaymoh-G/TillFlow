/** BreezeTech Systems wordmark — asset in `public/branding/`. */
export const BREEZETECH_LOGO_SRC = '/branding/breezetech-logo.png';

export default function BreezeTechLogo({ className, alt = 'BreezeTech Systems', ...rest }) {
  return <img src={BREEZETECH_LOGO_SRC} alt={alt} className={className} decoding="async" {...rest} />;
}
