// 실제 브라우저(Chromium) 테스트 설정. 데스크톱과 폰 두 가지 화면에서 같은 시나리오를 돌린다.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,   // 3D를 소프트웨어로 그리는 환경(클라우드 등)에서는 느리다
  retries: 1,       // 3D를 처음 띄울 때 가끔 느려서 한 번 더 시도한다
  workers: 2,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node tests/serve.js', url: 'http://localhost:4173/index.html', reuseExistingServer: true, timeout: 20000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },   // 폭 393px → 모바일 방 구도(7×6.5칸)
  ],
});
