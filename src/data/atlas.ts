// The Atlas (stage 4, ADR 0059, ADR 0060): a person's places and the regions of them they've been to, and the countries
// of the stories in their collection. Server only. Runs as the viewer: RLS shows someone else's places and regions
// only when their profile is public and their Atlas shown.
import { isPlaceStatus, isVisited, titleCountries, type Place, type PlaceWrite, type StoryTitle } from "@/core/atlas";
import { isRegionId, type RegionWrite } from "@/core/atlas-regions";
import { posterUrl } from "@/core/catalog/images";
import { isCountryCode, type CountryCode } from "@/core/countries";
import { uuidv7 } from "@/core/ids";
import type { UserClient } from "./supabase-server";

/** A person's live places (RLS decides whether the viewer may see them). */
export async function userPlaces(db: UserClient, userId: string): Promise<Place[]> {
  const { data, error } = await db
    .from("places")
    .select("country, status, first_year")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at")
    .limit(300);
  if (error) throw new Error(`places read failed: ${error.message}`);
  return data.flatMap((r) =>
    isCountryCode(r.country) && isPlaceStatus(r.status) ? [{ country: r.country, status: r.status, firstYear: r.first_year }] : [],
  );
}

/**
 * Puts a country on the viewer's map with a status (changing the live row, or adding one), or takes it off (a soft
 * delete). Its regions go when it's taken off or becomes Want to go: they were where you'd been. Adding races another
 * tab's add only on the unique index: then the other row is updated instead.
 */
export async function setPlace(db: UserClient, viewerId: string, { country, status, firstYear }: PlaceWrite): Promise<void> {
  if (!status || status === "want") {
    const { error } = await db
      .from("place_regions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("user_id", viewerId)
      .eq("country", country)
      .is("deleted_at", null);
    if (error) throw new Error(`place_regions update failed: ${error.message}`);
  }
  const live = () => db.from("places").update(status ? { status, first_year: firstYear } : { deleted_at: new Date().toISOString() });
  const update = async () => {
    const { data, error } = await live().eq("user_id", viewerId).eq("country", country).is("deleted_at", null).select("id");
    if (error) throw new Error(`places update failed: ${error.message}`);
    return data.length > 0;
  };
  if ((await update()) || !status) return;
  const { error } = await db.from("places").insert({ id: uuidv7(), country, status, first_year: firstYear });
  if (!error) return;
  if (error.code !== "23505" || !(await update())) throw new Error(`places insert failed: ${error.message}`);
}

/** A person's marked regions (RLS decides whether the viewer may see them), only ids still on the map. */
export async function userRegions(db: UserClient, userId: string, country?: CountryCode): Promise<string[]> {
  let query = db.from("place_regions").select("region").eq("user_id", userId).is("deleted_at", null);
  if (country) query = query.eq("country", country);
  const { data, error } = await query.order("created_at").limit(5000);
  if (error) throw new Error(`place_regions read failed: ${error.message}`);
  return data.flatMap((r) => (isRegionId(r.region) ? [r.region] : []));
}

/**
 * Marks a region (been there) or unmarks it. Marking one puts its country on the Atlas as visited first: added as
 * "Been there", or moved there from "Want to go"; a visit or a home stays as it is. Marking twice, or a race with
 * another tab, leaves one live row.
 */
export async function setRegion(db: UserClient, viewerId: string, { region, country, visited }: RegionWrite): Promise<void> {
  if (!visited) {
    const { error } = await db
      .from("place_regions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("user_id", viewerId)
      .eq("region", region)
      .is("deleted_at", null);
    if (error) throw new Error(`place_regions update failed: ${error.message}`);
    return;
  }
  const place = (await userPlaces(db, viewerId)).find((p) => p.country === country);
  if (!place || !isVisited(place)) await setPlace(db, viewerId, { country, status: "been", firstYear: null });
  const { error } = await db.from("place_regions").insert({ id: uuidv7(), region });
  if (error && error.code !== "23505") throw new Error(`place_regions insert failed: ${error.message}`);
}

/**
 * The stories in a collection with the countries they come from: titles being watched, read or played, or finished
 * (not Want to watch), newest first. Countries are read from the cached catalog body (`titles.raw`).
 */
export async function storyTitles(db: UserClient, userId: string): Promise<StoryTitle[]> {
  const { data, error } = await db
    .from("entries")
    .select(
      "updated_at, title:titles!inner(id, source, kind, external_id, name, poster_path, origin:raw->origin_country, production:raw->production_countries, anilist:raw->countryOfOrigin)",
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("status", ["watching", "finished"])
    .order("updated_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(`entries read failed: ${error.message}`);
  const seen = new Set<string>();
  return data.flatMap(({ title: t }) => {
    if (seen.has(t.id)) return [];
    seen.add(t.id);
    const countries = titleCountries(t.source, { origin_country: t.origin, production_countries: t.production, countryOfOrigin: t.anilist });
    if (countries.length === 0) return [];
    return [
      { id: t.id, kind: t.kind, name: t.name, posterUrl: posterUrl(t.source, t.poster_path), href: `/title/${t.kind}/${t.external_id}`, countries },
    ];
  });
}
