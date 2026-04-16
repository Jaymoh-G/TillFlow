import { DEFAULT_BRAND_LOGO_URL } from "../../constants/defaultBrandLogo";

/** BreezeTech Systems wordmark — asset in `public/branding/`. */
export const BREEZETECH_LOGO_SRC = DEFAULT_BRAND_LOGO_URL;

export default function BreezeTechLogo({ className, alt = "BreezeTech Systems", ...rest }) {
  return <img src={BREEZETECH_LOGO_SRC} alt={alt} className={className} decoding="async" {...rest} />;
}
