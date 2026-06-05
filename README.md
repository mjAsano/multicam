# Multicam NLE

Next.js 기반 멀티캠 NLE 편집 웹 서비스 프로토타입입니다. App Router 셸은 서버 컴포넌트로 유지하고, 무거운 편집 워크스페이스만 클라이언트에서 동적 로딩합니다.

## 기능

- 4개 기본 카메라 또는 폴더에서 생성한 멀티캠 소스 모니터
- 폴더 import 영상의 멀티캠 소스 동시 프리뷰
- 브라우저에서 로컬 영상/오디오 파일 import
- 폴더 선택으로 여러 영상을 한 번에 CAM 1, CAM 2... 앵글로 등록
- import한 미디어를 현재 플레이헤드 위치에 타임라인 삽입
- 숫자 키 1-9 또는 소스 클릭으로 실시간 프로그램 컷 생성
- 재생, 프레임 스텝, 타임라인 스크럽
- 블레이드 분할, 인/아웃 트림, 마커 추가
- 비디오/오디오 트랙, 컷 트랙, 오디오 웨이브폼 표시
- 인스펙터와 출력 큐 UI

## 성능 방향

- `next/dynamic`으로 편집 워크스페이스 코드 분할, 서버 렌더 가능한 클라이언트 경계 유지
- 타임라인 lane, 모니터 컴포넌트 `memo` 적용
- 재생 루프는 `requestAnimationFrame` 기반으로 처리
- 타임라인 계산은 `useMemo`로 그룹화
- CSS `contain: layout paint`로 큰 편집 영역의 레이아웃 영향 제한
- 실제 서비스화 시 원본 미디어 대신 proxy, waveform cache, frame thumbnail sprite를 별도 워커/스토리지에서 생성하는 구조 권장

## 디자인 시스템

- Someple Design System의 Pretendard, forced dark, sharp 0px radius, hairline border, violet accent 규칙 적용
- 필요한 정적 자산은 `public/someple` 아래에 복사됨

## 실행

```bash
npm install
npm run dev
```
