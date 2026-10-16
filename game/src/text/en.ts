// English (ADR-022): the words the quick match was written in.
import type { PlayStyle } from '@tennis/engine';
import type { Habit } from '../quick/types.ts';
import { surname, type Messages } from './types.ts';

const HABIT: Record<Habit, string> = {
  big_point_attack: 'goes for broke on match points',
  counter_after_loss: 'counters after losing a point',
  repeat_card: 'sticks with their card from the last big point',
  defend_unless_behind: 'plays safe unless behind',
  copy_user: 'copies your card from the last big point',
  beat_user_last: 'plays what beats your last big-point card',
};

const WHY: Partial<Record<PlayStyle, string>> = {
  big_server: 'big servers lose their rhythm in long rallies',
  baseliner: 'take time away from a baseliner',
  counter_puncher: 'give a counter-puncher no pace, but don\'t sit back',
};

const habit = (name: string, h: Habit) => `${surname(name)} ${HABIT[h]}`;
const who = (user: boolean) => (user ? 'Your' : 'Their');

export const en: Messages = {
  lang: 'en',
  card: { attack: 'Attack', defend: 'Defend', counter: 'Counter' },
  flavour: {
    serve: { attack: 'Big serve', defend: 'Safe serve', counter: 'Bait the return' },
    return: { attack: 'Step in', defend: 'Block it deep', counter: 'Read the serve' },
  },
  situation: (role, score) => `${role === 'serve' ? 'Your serve' : 'Their serve'} · ${score}`,
  moment: { matchPoint: 'MATCH POINT', matchPointDown: 'MATCH POINT DOWN', all: (n) => `${n}-ALL`, big: 'BIG POINT' },
  how: { ace: 'Ace', double_fault: 'Double fault', winner: 'Winner', unforced_error: 'Unforced error', forced_error: 'Forced error', other: 'Error' },
  plan: {
    aggressive: { label: 'Aggressive', line: 'Go for your shots: more winners, more errors' },
    balanced: { label: 'Balanced', line: 'Play the percentages' },
    defensive: { label: 'Defensive', line: 'Make them play one more ball' },
  },
  style: { big_server: 'Big server', baseliner: 'Baseliner', counter_puncher: 'Counter-puncher', serve_and_volley: 'Serve & volley', all_court: 'All-court' },
  surface: { hard: 'Hard', clay: 'Clay', grass: 'Grass' },
  rating: {
    servePower: 'Serve power', serveAccuracy: 'Serve accuracy', secondServe: 'Second serve', forehand: 'Forehand', backhand: 'Backhand',
    consistency: 'Consistency', return: 'Return', movement: 'Movement', agility: 'Agility', stamina: 'Stamina', composure: 'Composure',
    concentration: 'Concentration', decision: 'Decision', aggression: 'Aggression',
  },
  habit,
  scouting: (name, style, h) => `${name} · ${style} — ${habit(name, h)}`,
  rival({ wins, losses }, stance, last) {
    const h2h = `Head to head ${wins}-${losses}${wins === losses ? '' : wins > losses ? ' to you' : ' to them'}`;
    const how = !stance ? '' : stance.kind === 'wary' ? `; wary of your read: may switch to ${stance.card ? en.card[stance.card] : 'what beats your answer'} when the habit is due` : '; confident: sticks to the habit';
    return `${h2h}${how}${last ? `; last big point: ${en.card[last]}` : ''}`;
  },
  planTip: (plan, style) => `Plan tip: ${en.plan[plan].label}${WHY[style] ? ` — ${WHY[style]}` : ''}`,
  tells: {
    attack: ['bounces on the toes, looking to step in', 'creeps up inside the baseline', 'grips the racket hard, eyes on the lines', 'bounces the ball fast, impatient'],
    defend: ['drifts back behind the baseline', 'settles deep, knees bent', 'takes a long breath and slows down', 'towels off, in no hurry'],
    counter: ['stays light, shuffling side to side', 'watches your feet closely', 'holds the racket out in front, compact', 'half-steps in, then back again'],
  },
  decisive({ score, user, ai, matchup, won }) {
    const read = matchup > 0 ? `your ${user} beat their ${ai}` : matchup < 0 ? `their ${ai} beat your ${user}` : `both went ${user}`;
    const twist = matchup === 0 ? `, and ${won ? 'you' : 'they'} won the point` : (matchup > 0) !== won ? `, but ${won ? 'you' : 'they'} won the point` : '';
    return `${score}: ${read}${twist}`;
  },
  noCards: (won) => (won ? 'Your plan carried it' : 'They closed it out'),
  headline: (won, score) => `${won ? 'You won' : 'You lost'} ${score}`,
  concededHeadline: (score) => `You conceded ${score}`,
  goal: { stay: 'Stay #1', first: '#1', top: (n) => `Top ${n}`, line: (wins, label) => `${wins} ${wins === 1 ? 'win' : 'wins'} to ${label}` },
  pbp: {
    opening: (score, userServes) => `${score} · ${userServes ? 'You serve' : 'They serve'}`,
    cards: (user, ai) => `You ${user}, they ${ai}`,
    noCards: 'No cards: your game plan',
    serve: (first, kmh) => `${first ? 'First' : 'Second'} serve, ${kmh} km/h`,
    rally: (shots) => `${shots}-shot rally`,
    stroke: (shot, wing) => (shot === 'drive' || shot === 'return' || shot === 'approach' ? wing : shot === 'slice' ? `${wing} slice` : shot),
    ending(kind, user, stroke) {
      if (kind === 'ace') return `${who(user)} ace`;
      if (kind === 'double_fault') return `${who(user)} double fault`;
      if (kind === 'winner') return `${who(user)} ${stroke} winner`;
      return `${who(user)} ${stroke} ${kind === 'forced_error' ? 'forced into an error' : 'error'}`;
    },
    close: (userWon, over, score) => `${userWon ? 'Your point' : 'Their point'}${over ? ' · game, set and match' : ` · ${score}`}`,
  },
};
