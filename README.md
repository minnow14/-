# TWO SCRIPTS, ONE CANVAS

用韓文字母，寫出漢字。 / 한글 자모로 한자를 쓰다.

한글 자모 24종으로 번체자 형태의 타이포그래피를 만들고 PNG로 저장·공유하는 정적 웹사이트입니다.

- **A 漢字填充 / 한자 채우기**: 번체자를 입력하면 그 글자 모양 안을 한글 단어와 자모로 채웁니다.
- **B 自由創作 / 자유 캔버스**: 자모를 하나씩 배치하고 늘리고 돌려서 글자를 조립합니다.

## 실행
빌드 과정이 없습니다. 이 폴더를 정적 서버로 열면 됩니다. ES 모듈을 쓰기 때문에 `file://`로는 열리지 않습니다.

```
python3 -m http.server 8000
# http://localhost:8000
```

## GitHub Pages 배포
1. 이 폴더 내용을 저장소 루트에 올립니다.
2. 저장소 **Settings → Pages**에서 Source를 `Deploy from a branch`, 브랜치 `main`, 폴더 `/ (root)`로 지정합니다.
3. 몇 분 뒤 `https://<계정>.github.io/<저장소>/`에서 열립니다.

`.nojekyll` 파일은 GitHub Pages가 Jekyll 처리를 하지 않도록 둔 것입니다.

## 구조
```
index.html          화면 4개 (홈, 모드 A, 모드 B, 저장·공유 시트)
css/style.css       흑백 UI, 모바일 우선 반응형
js/app.js           라우팅(#/, #/fill, #/free), 예시, 두 모드 연결
js/fill.js          모드 A 엔진: 한자 마스크 → 한글 배치
js/free.js          모드 B: Konva 편집기, 내보내기 렌더러
js/share.js         PNG 저장, Web Share, 링크 복사, PB03 워터마크
js/glyph.js         글리프 실제 잉크 영역 측정·그리기
js/jamo.js          자모 24종, 음절 분해
js/fonts.js         폰트 설정과 로딩
vendor/konva.min.js Konva 10.10.0 (MIT)
docs/               가이드라인, 화면 구성
```

## 라이선스 (서드파티)
| 항목 | 라이선스 |
|---|---|
| Noto Sans TC, Noto Serif TC, Noto Sans KR (Google Fonts) | SIL Open Font License 1.1 |
| Konva 10.10.0 | MIT |
