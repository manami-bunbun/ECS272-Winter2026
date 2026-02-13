// Global types and interfaces are stored here.
export interface Margin {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
}

export interface ComponentSize {
    width: number;
    height: number;
}

export interface Point {
    readonly posX: number;
    readonly posY: number;
}

export interface Bar{
    readonly value: number;
}

export interface SpotifyTrack {
    track_id: string;
    track_name: string;
    artist_name: string;
    track_popularity: number; // 0..100
    artist_popularity: number; // 0..100
    artist_followers: number;
    explicit: boolean;
    release_year?: number;
}
