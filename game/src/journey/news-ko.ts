// Headlines and community comments (ADR-032, kickru's tone): press lines in 다/했다 style, comments short and memey.
// Korean only (TD-080). {placeholders} come from facts.ts.
import type { Facts } from './facts.ts';

export type Tone = 'big' | 'good' | 'bad' | 'plain';

export interface Template {
  id: string;
  tone: Tone;
  when: (f: Facts) => boolean;
  news: readonly string[];
  comments: readonly string[];
}

const titleOf = (f: Facts, tier: string) => f.titles.some((e) => e.tier === tier);

/** Most notable first: the first match is the lead headline. */
export const TEMPLATES: readonly Template[] = [
  {
    id: 'major-title', tone: 'big', when: (f) => f.majorTitle,
    news: ['{nameTopic} {title} 정상에 섰다. 커리어 메이저 {majors}번째 우승', '{name}, {title} 우승… 결승에서 {titleOppObj} 꺾었다 ({titleScore})', '역사가 쓰였다. {name}, {title} 챔피언'],
    comments: ['울었다 진짜로', '{short} 메이저 우승 기념으로 오늘 치킨 쏜다', '결승 풀경기 다시 보러 간다', '이걸 살아서 보네', '{short} 처음 봤을 때부터 알아봤다 ㄹㅇ', '국뽕 차오른다…', '이제 GOAT 논쟁 들어가냐?'],
  },
  {
    id: 'major-final', tone: 'good', when: (f) => f.majorFinal,
    news: ['{name}, {major} 준우승… 결승에서 {majorOppWith} 접전 끝에 무릎', '{nameTopic} {major} 우승컵을 아쉽게 놓쳤지만 세계를 놀라게 했다'],
    comments: ['준우승도 대단한 거임', '결승 3세트부터 체력이 아쉬웠다', '다음엔 무조건 우승한다', '{majorOpp} 너무 잘하더라… 인정', '준우승 상금 얼마냐 ㄷㄷ'],
  },
  {
    id: 'major-semi', tone: 'good', when: (f) => f.majorSemi,
    news: ['{name}, {major} 4강 진출… 세계 무대에서 존재감', '{nameTopic} {major}에서 4강까지 올랐다'],
    comments: ['메이저 4강이면 말 다 했지', '4강 상대 너무 셌다', '{short} 이제 진짜 세계적인 선수다', '다음 메이저 기대됨'],
  },
  {
    id: 'finals-title', tone: 'big', when: (f) => titleOf(f, 'finals'),
    news: ['{name}, 투어 파이널스 우승… 시즌 최강자 증명'],
    comments: ['시즌 마무리 완벽', '파이널스 우승이면 사실상 올해의 선수', '왕의 귀환'],
  },
  {
    id: 'masters-title', tone: 'big', when: (f) => titleOf(f, 'masters'),
    news: ['{name}, {title} 제패… 마스터스 트로피를 품었다', '{nameTopic} {title} 우승으로 정상급 선수임을 증명했다'],
    comments: ['마스터스 우승 실화냐', '다음은 메이저다', '{short} 경기 볼 맛 난다', '이 폼 유지하면 톱10 간다'],
  },
  {
    id: 'junior-major', tone: 'big', when: (f) => f.juniorMajorTitle,
    news: ['{age}세 {name}, {title} 우승… 주니어 무대 평정', '될성부른 떡잎. {nameTopic} {title} 챔피언에 올랐다'],
    comments: ['주니어 메이저 우승이면 대성할 각', '스카우트들 줄 섰다더라', '{short} 이름 기억해 둬라', '이제 프로 무대에서 보자'],
  },
  {
    id: 'title', tone: 'good', when: (f) => f.titles.length > 0,
    news: ['{name}, {title} 우승… 통산 {titles}번째 타이틀', '{nameTopic} {title} 결승에서 {titleOppObj} 꺾고 정상에 올랐다 ({titleScore})', '{name}, {title} 트로피 들어 올렸다'],
    comments: ['우승 축하해!!', '결승 {titleScore} 경기력 미쳤다', '{short} 요즘 폼 장난 아님', '트로피 하나 더 추가요', '{tier} 우승이 쉬운 게 아니다'],
  },
  {
    id: 'climb', tone: 'good', when: (f) => (f.climb ?? 0) >= 20 && f.rank !== null,
    news: ['{name}, 세계 랭킹 {climb}계단 뛰어올라 {rank}위', '{nameTopic} 이번 구간 상승세로 {rank}위까지 올랐다'],
    comments: ['랭킹 그래프 우상향 중', '{rank}위 실화?', '이 속도면 내년엔 톱50', '꾸준함이 무기다'],
  },
  {
    id: 'deep-run', tone: 'good', when: (f) => !!f.best && f.best.roundsWon >= f.best.rounds - 2 && !f.best.champion,
    news: ['{name}, {event} {eventReached}… 좋은 흐름 이어갔다', '{nameTopic} {event}에서 {eventReached}까지 올랐다'],
    comments: ['{eventReached}이면 잘했지', '조금만 더 하면 우승이다', '{eventOpp} 상대로 잘 싸웠다', '경기력 올라오는 게 보인다'],
  },
  {
    id: 'injured', tone: 'bad', when: (f) => f.injured,
    news: ['{name}, 부상으로 당분간 코트를 떠난다', '악재. {nameTopic} 재활에 들어갔다'],
    comments: ['부상 조심 좀 하지…', '빨리 회복해라 기다린다', '일정이 너무 빡빡했다', '쉬고 돌아오면 더 잘할 거임'],
  },
  {
    id: 'away', tone: 'plain', when: (f) => f.away,
    news: ['{nameTopic} 이번 구간 코트에 서지 않았다', '{name}, 조용한 구간을 보냈다'],
    comments: ['언제 돌아오냐', '복귀전 날짜 나왔냐?', '기다리는 중…'],
  },
  {
    id: 'slump', tone: 'bad', when: (f) => f.lost >= 3 && f.won <= 1,
    news: ['{name}, {won}승 {lost}패… 깊어지는 부진', '{name}, 이번 구간 승리를 거의 챙기지 못했다'],
    comments: ['요즘 왜 이러냐', '멘탈 코치 붙여라', '1회전 탈락 모음집 만들 기세', '바닥 찍었으면 이제 올라갈 일만 남았다'],
  },
  {
    id: 'junior', tone: 'plain', when: (f) => f.junior,
    news: ['{age}세 {name}, 주니어 무대에서 {won}승 {lost}패', '주니어 {nameTopic} 경험을 쌓고 있다'],
    comments: ['아직 어리다 천천히 가자', '주니어 때 성적은 참고만', '{short} 포핸드 폼 좋더라', '프로 가면 달라질 듯'],
  },
  {
    id: 'plain', tone: 'plain', when: () => true,
    news: ['{name}, {event} {eventReachedBy} 구간 마무리', '{name}, 이번 구간 {won}승 {lost}패'],
    comments: ['무난했다', '다음 구간이 중요하다', '{short} 화이팅', '랭킹 {rank}위면 나쁘지 않지', '경기 보러 간 사람?'],
  },
];

/** Toasts for milestones (settle.ts ids). */
export const MILESTONES: Record<string, string> = {
  'first-win': '첫 승리!',
  'first-junior-title': '첫 주니어 타이틀!',
  'junior-major': '주니어 메이저 우승!',
  'junior-no1': '주니어 세계 1위!',
  'first-pro-points': '첫 프로 랭킹 포인트',
  'first-title': '첫 프로 타이틀!',
  'major-main-draw': '첫 메이저 본선',
  'masters-title': '마스터스 우승!',
  'major-final': '첫 메이저 결승',
  'major-title': '메이저 챔피언!',
  finals: '투어 파이널스 진출',
  top100: '세계 100위 진입',
  top50: '세계 50위 진입',
  top10: '톱10 진입!',
  top1: '세계 랭킹 1위!',
};

export const NICKS: readonly string[] = [
  '테린이', '서브앤발리', '백핸드장인', '직관러', '라켓수집가', '새벽중계러', '클레이킹', '잔디요정', '스핀중독', '랠리러버',
  '네트앞', '포핸드원툴', '테니스엘보', '볼보이출신', '체어엄파이어', '로브장인', '드롭샷', '타이브레이커', '에이스헌터', '베이스라이너',
];
