import * as d3 from 'd3';
import type { SpotifyTrack } from './types';



function parseNumber(v: unknown): number {

    if (v === null || v === undefined) return NaN;

    const s = String(v).trim();

    if (s === '') return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  
}

function parseBoolean(v: unknown): boolean {
    const s = String(v ?? '').trim().toLowerCase();

    if (s === 'true' || s === 't' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === 'f' || s === '0' || s === 'no') return false;
    return false;
}

function parseYear(v: unknown): number | undefined {
    const s = String(v ?? '').trim();
    if (s.length < 4) return undefined;
    const y = Number(s.slice(0, 4));


    if (!Number.isFinite(y)) return undefined;
    if (y <= 0) return undefined;
    return y;
}

export async function loadSpotifyTracks(csvUrls: string[]): Promise<SpotifyTrack[]> {

    const parts = await Promise.all(
        csvUrls.map((csvUrl) =>
            d3.csv(csvUrl, (d) => ({
                track_id: (d.track_id ?? '').toString(),
                track_name: (d.track_name ?? '').toString(),
                artist_name: (d.artist_name ?? '').toString(),
                track_popularity: parseNumber(d.track_popularity),
                artist_popularity: parseNumber(d.artist_popularity),
                artist_followers: parseNumber(d.artist_followers),
                explicit: parseBoolean(d.explicit),
                release_year: parseYear(d.album_release_date),
            })),
        ),
    );

    const combined = parts.flat();
    
    return combined
        .filter((d) => d.track_id !== '')
        .filter(
            (d) =>
                Number.isFinite(d.track_popularity) &&
                Number.isFinite(d.artist_popularity) &&
                Number.isFinite(d.artist_followers),
        )
        .filter((d) => d.track_popularity >= 0 && d.track_popularity <= 100)
        .filter((d) => d.artist_popularity >= 0 && d.artist_popularity <= 100)
        .filter((d) => d.artist_followers >= 0);
}
