import type { Track } from "src/app";

export class TrackManager {
  private tracks: Track[] = []
  public addTrack(track: Track) {
    this.tracks.push(track)
  }
  public getTrack(name: string) {
    return this.tracks.find(track => track.name === name);
  }
  public getTrackBySubscribeId(id: number) {
    return this.tracks.find(track => track.subscribeIds.includes(id));
  }
  public getAllTracks() {
    return this.tracks
  }
  public addSubscribeId(name: string, id: number) {
    this.tracks.map(track => {
      if (track.name === name) {
        track.subscribeIds.push(id)
      }
    });
  }
}
