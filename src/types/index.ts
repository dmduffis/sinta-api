import type { RouteType } from "@prisma/client";

export interface GeoJsonPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface CommunitySummary {
  id: string;
  name: string;
  neighborhood: string;
  city: string;
  description: string;
  heroEmoji: string | null;
  imageUrl: string | null;
  distanceMeters?: number;
}

export interface PoiSummary {
  id: string;
  communityId: string;
  name: string;
  category: string;
  address: string | null;
  hours: string | null;
  location?: GeoJsonPoint | null;
}

export interface DishDto {
  id: string;
  poiId: string;
  name: string;
  description: string | null;
  priceRange: string | null;
  poiName?: string;
}

export interface CommunityDetail extends CommunitySummary {
  boundary?: GeoJsonPolygon | null;
  pois: PoiSummary[];
}

export interface StampDto {
  id: string;
  userId: string;
  communityId: string;
  earnedAt: string;
  community?: CommunitySummary;
}

export interface JournalEntryDto {
  id: string;
  userId: string;
  communityId: string | null;
  poiId: string | null;
  note: string;
  photoUrl: string | null;
  createdAt: string;
}

export interface RouteStopDto {
  id: string;
  routeId: string;
  poiId: string;
  order: number;
  poi?: PoiSummary;
}

export interface RouteSummary {
  id: string;
  title: string;
  description: string | null;
  type: RouteType;
  createdAt: string;
  stopCount?: number;
}

export interface RouteDetail extends RouteSummary {
  stops: RouteStopDto[];
}

export interface SearchResults {
  query: string;
  communities: CommunitySummary[];
  pois: PoiSummary[];
  dishes: DishDto[];
}

export interface CreateStampBody {
  communityId: string;
  /** Optional; defaults to authenticated stub user (x-user-id). */
  userId?: string;
}

export interface CreateJournalBody {
  note: string;
  communityId?: string | null;
  poiId?: string | null;
  photoUrl?: string | null;
  /** Optional; defaults to authenticated stub user (x-user-id). */
  userId?: string;
}

export interface ApiError {
  error: string;
}
