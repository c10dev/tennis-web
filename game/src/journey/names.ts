// Made-up players for the text career, written in Hangul by where they come from (ADR-032: fictional players).
// Given names are common ones; family names are mixed from parts so no pairing names a real player on purpose.
import type { Rng } from '@tennis/engine';
import { pick } from '../rng.ts';
import type { Nation } from './types.ts';

export const NATIONS: Record<Nation, { name: string; weight: number }> = {
  KOR: { name: '대한민국', weight: 3 }, JPN: { name: '일본', weight: 4 }, CHN: { name: '중국', weight: 3 },
  USA: { name: '미국', weight: 10 }, GBR: { name: '영국', weight: 5 }, AUS: { name: '호주', weight: 6 },
  ESP: { name: '스페인', weight: 9 }, ARG: { name: '아르헨티나', weight: 6 }, ITA: { name: '이탈리아', weight: 8 },
  FRA: { name: '프랑스', weight: 9 }, GER: { name: '독일', weight: 7 }, SUI: { name: '스위스', weight: 3 },
  SRB: { name: '세르비아', weight: 4 }, CZE: { name: '체코', weight: 5 },
};

type Style = 'kor' | 'jpn' | 'chn' | 'anglo' | 'latin' | 'french' | 'german' | 'slavic';
const STYLE: Record<Nation, Style> = {
  KOR: 'kor', JPN: 'jpn', CHN: 'chn', USA: 'anglo', GBR: 'anglo', AUS: 'anglo', ESP: 'latin', ARG: 'latin', ITA: 'latin',
  FRA: 'french', GER: 'german', SUI: 'german', SRB: 'slavic', CZE: 'slavic',
};

const PARTS: Record<Style, { first: readonly string[]; last: readonly string[]; lastEnd?: readonly string[]; eastern?: 'joined' | 'spaced' }> = {
  kor: { first: ['민준', '서준', '도윤', '예준', '시우', '하준', '지호', '주원', '건우', '우진', '현우', '선우', '연우', '유준', '정우', '승현', '지훈', '태윤'], last: ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '송', '류'], eastern: 'joined' },
  jpn: { first: ['하루토', '소타', '유토', '렌', '다이키', '료타', '가이토', '하야토', '쇼', '겐타', '유마', '쓰바사'], last: ['다카', '야마', '모리', '나카', '이시', '마쓰', '후지', '오카', '하야'], lastEnd: ['다', '모토', '카와', '노', '시마', '무라', '사키'], eastern: 'spaced' },
  chn: { first: ['하오', '위천', '쯔하오', '린', '쥔제', '톈', '보원', '이판', '레이', '즈위안'], last: ['왕', '리', '장', '류', '천', '양', '자오', '우', '저우', '쉬'], eastern: 'joined' },
  anglo: { first: ['잭', '라이언', '이선', '노아', '리엄', '에이든', '케일럽', '타일러', '해리', '올리버', '조시', '네이선', '루크', '샘'], last: ['브랜', '하트', '웰', '스톤', '페어', '블랙', '그린', '모건', '애시', '헤이'], lastEnd: ['포드', '웰', '턴', '리', '우드', '스', '먼', '필드'] },
  latin: { first: ['알레한드로', '마테오', '파블로', '디에고', '하비에르', '루카', '마르코', '로렌초', '니콜라스', '토마스', '안드레아', '페데리코'], last: ['가르', '로드', '페르', '마르', '산', '베르', '코스', '로', '카스'], lastEnd: ['시아', '리게스', '난데스', '티네스', '티', '나르디', '텔로', '시', '타'] },
  french: { first: ['위고', '루이', '가엘', '아르튀르', '테오', '마티스', '바스티앙', '쥘', '에밀', '라파엘'], last: ['뒤', '르', '보', '드', '라', '모', '샤'], lastEnd: ['몽', '루아', '셰', '랑', '부아', '로', '퐁'] },
  german: { first: ['요나스', '루카스', '레온', '펠릭스', '니클라스', '얀', '도미닉', '파울', '막스', '팀'], last: ['슈', '바', '호', '크', '베', '리'], lastEnd: ['미트', '흐너', '프만', '라우스', '버', '히터', '르츠'] },
  slavic: { first: ['스테판', '루카', '마르코', '야쿠프', '토마시', '이리', '니콜라', '두샨', '필립', '밀로시'], last: ['노', '페', '크', '코', '스', '야', '드'], lastEnd: ['바크', '트로비치', '르지치', '발', '타네크', '노비치', '보르'] },
};

/** A nation drawn by how many players it sends to the tour. */
export function drawNation(rng: Rng): Nation {
  const entries = Object.entries(NATIONS) as [Nation, { weight: number }][];
  let r = rng.next() * entries.reduce((a, [, n]) => a + n.weight, 0);
  for (const [code, n] of entries) if ((r -= n.weight) < 0) return code;
  return entries.at(-1)![0];
}

/** A name for a player from `nation` that is not in `taken` (which it extends). */
export function nameFor(rng: Rng, nation: Nation, taken: Set<string>): string {
  const parts = PARTS[STYLE[nation]];
  for (let i = 0; ; i++) {
    const last = pick(rng, parts.last) + (parts.lastEnd ? pick(rng, parts.lastEnd) : '');
    const first = pick(rng, parts.first);
    const name = parts.eastern === 'joined' ? `${last}${first}` : parts.eastern === 'spaced' ? `${last} ${first}` : `${first} ${last}`;
    const unique = i < 50 ? name : `${name} ${i}`;
    if (!taken.has(unique)) {
      taken.add(unique);
      return unique;
    }
  }
}
