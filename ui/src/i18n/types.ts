// The UI's own words (ADR-022): labels and chrome around the game's text (the game's sentences are in
// `@tennis/game` text catalogs). The season mode and the dev replay page stay English (web build only).
export interface UiText {
  tagline: string;
  quickMatch: string;
  quickMatchRank(rank: number, matches: number): string;
  topOfLadder: string;
  toNext(points: number, rank: number): string;
  points(n: number): string;
  nextOpponent: string;
  opponentLine(rank: number, style: string, level: string, surface: string): string;
  scouting: string;
  play: string;
  fastMode: string;
  recent: string;
  recentRow(won: boolean, opponent: string, score: string, delta: number): string;
  startTitle: string;
  startRules: string;
  name: string;
  style: string;
  seed: string;
  startLadder: string;
  gamePlan: string;
  versus(opponent: string): string;
  planTag(label: string): string;
  pointFor(you: boolean): string;
  beats(card: string): string;
  strengthHint: string;
  verdict: { won: string; lost: string; even: string };
  youCard(card: string): string;
  vs: string;
  theirCards: string;
  tell: string;
  atScore(score: string): string;
  decisivePoint: string;
  lastPoint: string;
  against(opponent: string): string;
  pointsLabel: string;
  pointsDelta(signed: string): string;
  ranking: string;
  top: string;
  toPlace(rank: number): string;
  passed: string;
  training: string;
  nextGoal: string;
  playAgain: string;
  ladder: string;
  skipHint: string;
}
