export type YelpBusiness = {
  id: string;
  name: string;
  image_url?: string;
  url?: string;
  rating?: number;
  price?: string;
  categories?: { alias: string; title: string }[];
  location?: {
    address1?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
    display_address?: string[];
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  hours?: {
    open?: { start: string; end: string; day: number }[];
    is_open_now?: boolean;
  }[];
};

type YelpSearchResponse = {
  businesses: YelpBusiness[];
  total: number;
};

function getYelpApiKey(): string {
  const key = process.env.YELP_API_KEY?.trim();
  if (!key) {
    throw new Error("YELP_API_KEY is not set");
  }
  return key;
}

export async function searchYelpBusinesses(params: {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  term?: string;
  categories?: string;
  limit?: number;
  offset?: number;
}): Promise<YelpBusiness[]> {
  const url = new URL("https://api.yelp.com/v3/businesses/search");
  url.searchParams.set("latitude", String(params.latitude));
  url.searchParams.set("longitude", String(params.longitude));
  url.searchParams.set(
    "radius",
    String(Math.min(params.radiusMeters ?? 1500, 40000)),
  );
  url.searchParams.set("limit", String(Math.min(params.limit ?? 20, 50)));
  if (params.offset) url.searchParams.set("offset", String(params.offset));
  if (params.term) url.searchParams.set("term", params.term);
  url.searchParams.set(
    "categories",
    params.categories ?? "restaurants,food,cafes,gourmet",
  );

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getYelpApiKey()}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Yelp search failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as YelpSearchResponse;
  return data.businesses ?? [];
}

export function formatYelpAddress(business: YelpBusiness): string | null {
  if (business.location?.display_address?.length) {
    return business.location.display_address.join(", ");
  }
  const parts = [
    business.location?.address1,
    business.location?.city,
    business.location?.state,
    business.location?.zip_code,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export function formatYelpCategory(business: YelpBusiness): string {
  return (
    business.categories?.map((c) => c.title).filter(Boolean).join(", ") ||
    "restaurant"
  );
}
