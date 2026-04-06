const STORAGE_KEY = "retailpos_user_profile_local";

export function defaultProfileForm() {
  return {
    name: "",
    email: "",
    phone: "",
    address_line: "",
    location: "",
    avatar_url: ""
  };
}

/** @param {Record<string, unknown>|null|undefined} user */
export function userToProfileForm(user) {
  if (!user || typeof user !== "object") {
    return defaultProfileForm();
  }
  let location = typeof user.location === "string" ? user.location : "";
  if (!location) {
    const parts = [user.city, user.state, user.country, user.postal_code].filter(
      (x) => typeof x === "string" && x.trim() !== ""
    );
    if (parts.length) {
      location = parts.map((x) => String(x).trim()).join(", ");
    }
  }
  return {
    name: typeof user.name === "string" ? user.name : "",
    email: typeof user.email === "string" ? user.email : "",
    phone: typeof user.phone === "string" ? user.phone : "",
    address_line: typeof user.address_line === "string" ? user.address_line : "",
    location,
    avatar_url: typeof user.avatar_url === "string" ? user.avatar_url : ""
  };
}

export function loadProfileSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultProfileForm();
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return defaultProfileForm();
    }
    const d = defaultProfileForm();
    let location = typeof parsed.location === "string" ? parsed.location : d.location;
    if (
      !location &&
      (parsed.city || parsed.state || parsed.country || parsed.postal_code)
    ) {
      location = [parsed.city, parsed.state, parsed.country, parsed.postal_code]
        .filter((x) => typeof x === "string" && x.trim() !== "")
        .join(", ");
    }
    return {
      name: typeof parsed.name === "string" ? parsed.name : d.name,
      email: typeof parsed.email === "string" ? parsed.email : d.email,
      phone: typeof parsed.phone === "string" ? parsed.phone : d.phone,
      address_line: typeof parsed.address_line === "string" ? parsed.address_line : d.address_line,
      location,
      avatar_url: typeof parsed.avatar_url === "string" ? parsed.avatar_url : d.avatar_url
    };
  } catch {
    return defaultProfileForm();
  }
}

export function saveProfileSettings(form) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  } catch {
    /* ignore quota / private mode */
  }
}
