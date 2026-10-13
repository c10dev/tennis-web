# Tennis Sim — Game Design Document (GDD)

> 버전 0.1 · 작성일 2026-10-13 · 상태: Draft

## 1. 비전 (Vision)
"Football Manager의 깊이 + TV 중계의 몰입감"을 가진 테니스 매니지먼트 시뮬레이션.
플레이어는 코치/매니저로서 선수를 육성하고 투어 일정을 짜며, 경기는 실제 TV 중계처럼 3D로 관전한다.
- 핵심 가치: **신뢰할 수 있는 시뮬레이션**(현실적인 통계), **중계 같은 관전 경험**, **의미 있는 매니지먼트 결정**.
- 플랫폼: Web (데스크톱 브라우저 우선).

## 2. 핵심 루프 (Core Loop)
1. 준비: 훈련 계획, 대회 선택, 컨디션 관리
2. 경기: 3D 중계 관전 (배속/하이라이트/결과만 보기), 세트 사이 전술 지시
3. 결과: 통계 리포트, 랭킹 포인트, 상금, 선수 성장/피로
4. 반복: 시즌 캘린더 진행 → 랭킹 상승 → 더 큰 대회

## 3. 아키텍처 개요
```
engine/   (headless TS, 결정적, seeded RNG) → MatchEvent[] 생성
renderer/ (Three.js) → 이벤트를 3D로 재생 (엔진 import 금지 방향: engine은 renderer를 모른다)
ui/       (메뉴, 매니지먼트 화면, 오버레이 DOM)
docs/     (GDD, decisions, tech-debt)
```
- 엔진은 순수 함수 지향: `simulateMatch(config, seed) → MatchResult { events, stats }`.
- 같은 seed + 같은 입력 = 항상 같은 결과 (리플레이, 테스트, 버그 재현에 필수).
- 렌더러는 이벤트 스트림만 소비. 엔진 없이 저장된 JSON으로도 재생 가능해야 함.
- Stack: Vite + TypeScript(strict) + Three.js, Vitest.

## 4. 선수 능력치 (Player Attributes)
모든 능력치는 1–20 스케일 (FM 스타일). 내부에서는 0–1로 정규화.

| 분류 | 능력치 | 설명 |
|---|---|---|
| Technical | serve_power, serve_accuracy, second_serve | 서브 속도/정확도/2nd 서브 안정성 |
| | forehand, backhand | 그라운드스트로크 품질 (파워·스핀·정확도 합산) |
| | return | 리턴 품질 |
| | volley, overhead | 네트 플레이 |
| | slice, drop_shot | 변칙 샷 |
| Physical | movement (speed), agility, stamina, strength | 커버 범위, 방향 전환, 피로 누적 속도 |
| Mental | composure (pressure), concentration, aggression, consistency, decision | 브레이크 포인트 등 압박 상황 성능, 샷 선택 |
| Hidden | injury_proneness, surface_affinity{hard,clay,grass} | 숨김 값 |

- 동적 상태: `fatigue (0–1)`, `confidence (-1~+1)`, `momentum`.
- 플레이 스타일 태그: Big Server, Baseliner, Counter-puncher, Serve&Volley, All-court.

## 5. 포인트 시뮬레이션 모델
### 5.1 구조
포인트 = 샷의 연속. 각 샷마다:
1. **상황 평가**: 공의 질(incoming quality: 속도, 스핀, 깊이, 각도), 선수 위치, 피로, 압박도
2. **샷 선택 (Shot Selection)**: 유형(drive/slice/lob/drop/volley/approach), 방향(cross/line/middle), 리스크 레벨. aggression·decision·전술 지시에 따라 가중치 샘플링
3. **결과 판정**: `winner | forced_error | unforced_error | in_play(next quality)`
4. **다음 상태 갱신**: 위치, 피로 증가, 다음 샷 incoming quality

### 5.2 확률 모델 (초안)
```
attack = f(attribute, shotRisk, positionQuality)
defense = g(opponent.movement, agility, anticipation)
p_error = base_err(risk) * (1 - skill) * fatigueMul * pressureMul * incomingDifficulty
p_winner = sigmoid(k * (attack - defense) + risk_bonus)
```
- 서브: 1st serve in%, ace 확률, 2nd serve 더블폴트 확률을 serve 능력치 + 리터너 return으로 산출.
- **피로**: 샷/랠리 길이에 비례해 증가, stamina가 감소율 결정. 세트 사이 일부 회복.
- **압박(Pressure)**: 브레이크 포인트, 세트 포인트, 타이브레이크, 5세트 등에서 pressureIndex ↑ → composure가 낮으면 에러율 ↑.
- **표면 효과 (Surface)**:

| Surface | 공 속도 | 바운스 | 영향 |
|---|---|---|---|
| Grass | 빠름 | 낮음 | 서브/ace ↑, 랠리 ↓ |
| Hard | 중간 | 중간 | 기준값 |
| Clay | 느림 | 높음 | 랠리 ↑, 스핀/체력 중요, 브레이크 ↑ |

- 모든 계수는 `engine/tuning.ts` 한 곳에 모아 튜닝.

### 5.3 RNG
- `mulberry32` 등 seeded PRNG. `Math.random()` 사용 금지. RNG는 인자로 주입.

## 6. 스코어링 규칙
- 포인트: 0/15/30/40/Game, Deuce/Advantage (옵션: No-Ad).
- 게임: 6게임 선취 + 2게임 차, 6-6에서 **타이브레이크** (7포인트 선취 + 2점 차).
- 타이브레이크 서브 순서: 첫 1포인트 후 2포인트씩 교대, 6포인트마다 코트 체인지.
- 최종 세트 옵션: 일반 TB(7점) / 10점 Match TB / Advantage set (설정값).
- 매치: Best of 3 / Best of 5.
- 체인지오버: 홀수 게임 후, 세트 종료 시.
- 스코어링은 순수 상태 머신(`engine/scoring/`)으로 구현하고 엣지케이스 테스트 필수.

## 7. 이벤트 데이터 스키마 (TypeScript)
```ts
export type PlayerId = 'A' | 'B';
export type Surface = 'hard' | 'clay' | 'grass';
export type ShotType = 'serve' | 'return' | 'drive' | 'slice' | 'lob' | 'drop' | 'volley' | 'overhead' | 'approach';
export type Wing = 'forehand' | 'backhand';
export type Outcome = 'in' | 'winner' | 'ace' | 'fault' | 'double_fault' | 'unforced_error' | 'forced_error' | 'net';

export interface Vec2 { x: number; y: number }   // 코트 좌표 (m), 원점=네트 중앙
export interface Vec3 { x: number; y: number; z: number }

export interface ShotEvent {
  type: 'shot';
  t: number;               // 포인트 시작 기준 초
  hitter: PlayerId;
  shot: ShotType;
  wing?: Wing;
  from: Vec3;              // 타점
  bounce?: Vec2;           // 바운스 위치 (아웃이면 코트 밖)
  speedKmh: number;
  spinRpm: number;
  netClearance: number;
  outcome: Outcome;
  hitterPos: Vec2; receiverPos: Vec2;
}

export interface ScoreState {
  sets: [number, number][]; games: [number, number];
  points: [number, number]; tiebreak: boolean; server: PlayerId;
}

export interface PointEvent {
  type: 'point';
  index: number; server: PlayerId; winner: PlayerId;
  serveNumber: 1 | 2; rallyLength: number;
  endedBy: Outcome; shots: ShotEvent[];
  scoreBefore: ScoreState; scoreAfter: ScoreState;
  tags: ('break_point' | 'set_point' | 'match_point' | 'tiebreak')[];
  durationSec: number;
}

export type MatchEvent =
  | { type: 'match_start'; seed: number; surface: Surface; players: [string, string]; bestOf: 3 | 5 }
  | PointEvent
  | { type: 'game_end'; winner: PlayerId; score: ScoreState; isBreak: boolean }
  | { type: 'set_end'; winner: PlayerId; score: ScoreState }
  | { type: 'changeover'; score: ScoreState }
  | { type: 'tactic_change'; player: PlayerId; tactic: Tactic }
  | { type: 'match_end'; winner: PlayerId; score: ScoreState; stats: MatchStats };

export interface Tactic { aggression: number; netApproach: number; targetBackhand: boolean; serveTarget: 'wide' | 'body' | 't' | 'mix' }
export interface MatchStats { aces: [number, number]; doubleFaults: [number, number]; firstServePct: [number, number]; winners: [number, number]; unforcedErrors: [number, number]; breakPoints: [string, string]; avgRally: number }
```
- 스키마 버전 필드(`schemaVersion`)를 매치 JSON 최상위에 둔다.

## 8. 중계 연출 스펙 (Broadcast Presentation)
### 8.1 카메라
- **Main Cam**: 베이스라인 뒤 높은 위치 (TV 기본 앵글), 약간의 팬/추적.
- **Serve Cam**: 서버 뒤 낮은 앵글 (서브 직전 클로즈업).
- **Reaction Cam**: 포인트 후 선수 클로즈업 (세레머니/좌절).
- **Side/Umpire Cam**: 체인지오버, 리플레이 용.
- **Hawk-Eye Cam**: 접전 라인 콜 시 공 자국 클로즈업.
- 카메라 디렉터: 이벤트 태그 기반 규칙 엔진 (예: 브레이크 포인트 → 서브 전 클로즈업).

### 8.2 오버레이 (DOM/HTML 레이어)
- Score Bug (좌상단): 이름, 국기, 세트/게임/포인트, 서버 표시.
- 서브 속도 표시 (km/h), 랠리 카운터.
- 게임/세트 종료 시 Stats 패널 (1st serve %, aces, winners/UE, BP 전환).
- 하단 lower-third: "BREAK POINT", "SET POINT", 선수 소개.

### 8.3 리플레이
- 중요 포인트 (winner, 긴 랠리, BP) 후 자동 슬로모 리플레이 (다른 앵글).
- 이벤트 데이터 재생이므로 임의 시점 seek, 0.25x–4x 배속.
- Hawk-Eye 챌린지 연출.

### 8.4 오디오
- 타구음 (샷 유형/속도별), 바운스, 관중 앰비언트, 박수/환호 (포인트 중요도 비례), 체어 엄파이어 콜 ("Fault", "Out", 스코어 콜).
- Web Audio API, 볼륨 믹서. (코멘터리는 후순위)

### 8.5 관전 모드
- Full / Key points only / Highlights / Result only.

## 9. 매니지먼트 로드맵
1. 선수 생성 & 능력치 화면
2. 인매치 전술 (aggression, net approach, serve target), 세트 사이 지시
3. 훈련 (주간 계획 → 능력치 성장, 피로/부상 리스크)
4. 투어 캘린더 (대회 등급, 표면, 랭킹 포인트, 이동 피로)
5. 랭킹 시스템, 상금/재정, 스태프 (코치/피지오)
6. 다수 AI 선수 월드 시뮬레이션, 세이브/로드
7. (후순위) 스폰서, 미디어, 복식

## 10. 마일스톤
### M1 — 엔진 + 테스트 (렌더링 없음)
- 스코어링 상태 머신, 포인트/샷 시뮬레이션, 이벤트 출력, CLI로 N경기 배치 시뮬레이션 & 통계 리포트.
- **튜닝 목표 (인용된 사실이 아닌 설계 목표치; 추후 실데이터로 검증)**:

| 지표 (평균적인 투어급 선수 대결) | 목표 범위 |
|---|---|
| Service hold % (Hard) | 75–85% |
| Service hold % (Clay / Grass) | 70–80% / 80–90% |
| Aces / 서비스 게임 | 0.3–0.8 (빅서버 1.0+) |
| Double faults / 서비스 게임 | 0.15–0.35 |
| 1st serve in % | 58–68% |
| 1st serve points won % | 68–78% |
| 2nd serve points won % | 48–56% |
| 평균 랠리 길이 (샷) | 3.5–5.5 (Clay 쪽이 길게) |
| 랠리 ≤4샷 포인트 비율 | 60–75% |
| 타이브레이크 발생 세트 비율 | 10–25% |
| 능력치 우위 선수 승률 | 단조 증가 (실력 차 클수록 ↑) |

- 완료 조건: 10,000경기 배치 테스트에서 목표 범위 충족, 결정성 테스트 통과, 스코어링 엣지케이스 100% 커버.

### M2 — 기본 3D 리플레이
- Three.js 코트 (표면별 머티리얼), 캡슐 선수, 공 궤적 (포물선 + 바운스), Main Cam, 기본 Score Bug, 재생/일시정지/배속.

### M3 — 중계 폴리시
- 멀티 카메라 디렉터, 리플레이 시스템, Stats 오버레이, 관중/타구 오디오, 선수 애니메이션 개선, 하이라이트 모드.

### M4 — 매니지먼트
- 9장 로드맵 1–4 항목, 시즌 1개 플레이 가능한 vertical slice, 세이브/로드 (IndexedDB).

### M5 — 캐주얼 퀵매치 MVP (2026-10-13 추가, §13 참고)
- Fast4 1세트 퀵매치(1–2분), 매 포인트 직전 심리전 카드(공격·수비·카운터), 읽히되 예측되지 않는 상대 AI.
- 64명 퀵매치 래더, 경기 직후 보상(랭킹 포인트, 다음 랭킹까지 진행, 사용한 카드에 따른 능력치 진행).
- 완료 조건: 배치 시뮬레이션으로 길이(포인트 수, 중계 시간), 무적수 없음, 읽으면 이김, AI 다양성, 실력 반영, 래더 상승 속도가 목표 범위(ADR-016) 안.

### M6 — 플레이테스트 반영 (2026-10-13 추가, §14 참고)
- 7점 타이브레이크 한 판, 승부처에서만 카드 선택(나머지는 경기 전 작전으로 자동), 상대별 습관·텔·스카우팅·재대결 기록, 결정적 포인트를 다시 보여주는 보상 화면.
- 완료 조건: 길이, 선택 횟수, 읽으면 이김, 무적수 없음, 보상 가시성이 ADR-017 목표 범위 안.

## 11. 열린 질문 (Open Questions)
- 시뮬레이션 단위: 샷 단위 물리 근사 vs 확률 테이블? (현재: 확률 + 경량 기하)
- 선수 데이터: 가상 선수만? 라이선스 이슈 회피 필요.
- 아트 방향: 로우폴리 스타일라이즈드 vs 리얼리스틱?
- 엔진을 Web Worker에서 돌릴지 (대량 시뮬레이션 시).
- 수익 모델 / 플랫폼 확장 (Steam via Electron/Tauri?).
- 복식 지원 시점.
- 실제 투어 통계로 캘리브레이션할 데이터 소스와 라이선스.

## 12. Opus에게 줄 첫 프롬프트
```
너는 이 프로젝트의 리드 엔지니어다. 먼저 CLAUDE.md, GDD.md, docs/decisions.md, docs/tech-debt.md를 모두 읽어라.
1) 코드를 작성하기 전에, 모호하거나 결정이 필요한 부분에 대해 최대 10개의 명확화 질문을 해라.
2) 내 답변 후 Plan Mode로 M1(엔진 + 테스트) 구현 계획을 세워라: 폴더/파일 구조, 핵심 타입, 모듈 순서, 테스트 전략, 튜닝 방법.
3) 각 단계마다 "완료 기준(Done criteria)"을 측정 가능하게 정의해라 (예: 테스트 통과, 10,000경기 통계가 GDD 목표 범위 내, 결정성 테스트).
4) 계획을 내가 승인하기 전까지 구현하지 마라. 승인 후에는 테스트를 먼저 쓰고(TDD), 주요 결정은 docs/decisions.md에 기록해라.
```

## 13. 캐주얼 방향 (2026-10-13)
`docs/casual-design.md`(테니스 매니저 웹게임 기획서)가 이 문서보다 새로운 방향이며, 충돌하면 기획서를 따른다 (ADR-014).
- **우선순위:** 짧은 루프(한 판 1–2분, 내 선택이 승패를 가름, 즉각적 보상)가 시즌·재정 같은 긴 루프보다 먼저다. §8의 풀 중계는 퀵매치에서 포인트 단위의 짧은 클립으로 쓰이고, 세트 단위 관전은 시즌 모드에 남는다.
- **기획서 열린 질문에 대한 M5 결정:**
  - 스코어링: Fast4 1세트 (4게임 선승, 노애드, 3-3 타이브레이크 5점 선취·4-4 서든데스).
  - 유저 개입: 매 포인트 시작 전 1회 선택 (내 서브 게임은 서브 카드, 리턴 게임은 리턴 카드).
  - 상성: 공통 카드 3장, 공격 > 수비 > 카운터 > 공격. 상성은 결과를 확정하지 않고 확률을 움직이며, 능력치·성향·체력이 효과를 키우거나 줄인다.
  - 긴 루프 축: 랭킹 래더 중심, 육성은 경기 보상으로 따라온다.
- **보류:** 여러 시즌·재정·스태프, 멀티유저 리그, 기존 서버 프로젝트 연동은 M6 이후.

## 14. 플레이테스트 반영 (M6, 2026-10-13)
M5 퀵매치를 직접 해 본 피드백과 그에 따른 결정 (ADR-017). §13의 M5 결정 중 아래와 충돌하는 것은 이것으로 대체한다.
- **피드백:** 매 포인트 카드 선택은 재미없다. Fast4 한 세트는 풀매치처럼 길게 느껴진다. AI는 읽히지 않고 가위바위보처럼 느껴진다. 보상 화면이 와닿지 않는다.
- **형식:** 7점 타이브레이크 한 판(2점 차). 약 12포인트.
- **유저 개입:** 경기 전에 작전(공격적·균형·수비적)을 하나 고르고, 경기는 그 작전으로 자동 진행된다. 승부처(어느 쪽이든 5점에 도달한 뒤의 모든 포인트, 세트·매치포인트)에서만 멈춰서 카드를 고른다. 한 판에 보통 2–5번(중앙값 3).
- **읽히는 상대:** 상대마다 고유한 습관이 있고, 경기 전 스카우팅 한 줄로 알려준다. 선택 화면에는 상대가 이번 경기에 낸 카드와 선택 직전의 텔(약 70% 정확)이 보인다. 같은 상대와 다시 만나면 지난 기록이 이어진다. 한 상대의 습관을 공략하는 건 의도된 플레이이고, 무적수 금지는 상대 전체에 걸쳐 지킨다.
- **선택의 무게:** 선택 횟수가 줄어든 만큼 상성 우위가 포인트 승률을 약 +25%p 움직인다.
- **보상:** 경기를 가른 결정적 포인트를 다시 보여주며 내 선택을 이름으로 말해 준다("6-6: 당신의 카운터가 상대의 공격을 꺾었다"). 이어서 추월한 선수, 정수로 오르는 능력치, 다음 목표까지 남은 승수.
