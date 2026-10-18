// The team talks (ADR-033): after a swing each staff member says what they saw, in their own lane: the coach about
// the game, the physio about the body, the agent about entries and money. With nobody hired the player keeps a diary.
// Korean only (TD-080).
import { pick, stream } from '../rng.ts';
import { withJosa } from '../text/ko.ts';
import { JTIERS } from './calendar.ts';
import { GROUPS, type Group } from './ratings.ts';
import type { Team } from './staff.ts';
import type { SwingReport } from './types.ts';

export interface StaffLine {
  who: 'coach' | 'physio' | 'agent' | 'self';
  name: string;
  text: string;
}

export const GROUP_KO: Record<Group, string> = { serve: '서브', forehand: '포핸드', backhand: '백핸드', return: '리턴', physical: '체력', mental: '멘탈' };

const pct = (v: number) => Math.round(v * 100);

export function staffLines(r: SwingReport, team: Team, seed: number): StaffLine[] {
  const rng = stream(seed, 'staff-voice', r.year, r.swing);
  const gained = GROUPS.map((g) => ({ g, d: r.groupsAfter[g] - r.groupsBefore[g] })).sort((a, b) => b.d - a.d);
  const weakest = [...GROUPS].sort((a, b) => r.groupsAfter[a] - r.groupsAfter[b])[0]!;
  const top = gained[0]!;
  const lines: StaffLine[] = [];
  const say = (who: StaffLine['who'], name: string, options: string[]) => lines.push({ who, name, text: pick(rng, options) });

  const game = top.d > 0
    ? [`${withJosa(GROUP_KO[top.g], '이', '가')} 제일 많이 올라왔어. 다음엔 ${GROUP_KO[weakest]} 쪽을 보자.`, `${GROUP_KO[top.g]} 연습이 경기에서 나오기 시작했어. ${GROUP_KO[weakest]}만 따라오면 돼.`]
    : [`이번 구간엔 눈에 띄게 는 데가 없어. 훈련 주를 더 비워 두자.`, `경기만 하고 연습할 시간이 없었어. ${GROUP_KO[weakest]}부터 다시 잡자.`];
  if (team.coach) say('coach', team.coach.name, game);

  const tired = r.fatigue >= 0.35;
  const body = r.injured
    ? [`부상이에요. ${r.injured}구간은 쉬어야 해요. 무리하면 더 길어져요.`, `몸이 버티지 못했어요. 복귀까지 ${r.injured}구간 보세요.`]
    : tired
      ? [`피로도 ${pct(r.fatigue)}%로 넘어갑니다. 다음 구간 초반은 비워 두세요.`, `연달아 뛴 게 쌓였어요. 이동 거리를 줄이면 회복이 빨라요.`]
      : [`몸 상태 좋아요. 피로도 ${pct(r.fatigue)}%.`, `이 정도 일정이면 몸은 충분히 버팁니다.`];
  if (team.physio) say('physio', team.physio.name, body);

  const missed = r.skipped.length;
  const money = r.sponsor > 0
    ? [`스폰서에서 ${r.sponsor.toLocaleString('en-US')}달러 들어왔어요.`, `후원사 반응 좋아요. 이번 구간 ${r.sponsor.toLocaleString('en-US')}달러.`]
    : [`아직 스폰서가 붙기엔 이름이 덜 알려졌어요. 큰 대회에서 한 번만 터지면 돼요.`];
  const entries = missed ? [`${missed}개 대회는 본선에 못 들었어요. 랭킹을 올리거나 예선을 노려야 해요.`] : [];
  if (team.agent) say('agent', team.agent.name, [...(entries.length ? entries : money)]);

  if (!lines.length) {
    const big = r.events.filter((e) => JTIERS[e.tier].points.at(-1)! >= 1000).length;
    say('self', '나', r.injured ? ['다쳤다. 혼자 재활 일정을 짜는 게 제일 힘들다.']
      : big ? ['큰 무대는 공기부터 다르다. 코치가 있었으면 뭐라고 했을까.']
        : [`${withJosa(GROUP_KO[weakest], '이', '가')} 약점이라는 건 나도 안다. 같이 봐 줄 사람이 필요하다.`, '혼자 짐 싸고, 혼자 연습 상대 구하고. 팀이 있으면 좋겠다.']);
  }
  return lines;
}
