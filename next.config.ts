import type { NextConfig } from "next";
import path from "path";

// process.cwd()를 사용해 런타임 실행 디렉토리 기준으로 고정
// __dirname은 빌드 컨텍스트에 따라 달라질 수 있음
const PROJECT_ROOT = path.resolve(process.cwd());

console.log("[next.config] PROJECT_ROOT:", PROJECT_ROOT);

const nextConfig: NextConfig = {
  turbopack: {
    root: PROJECT_ROOT,
    resolveAlias: {
      tailwindcss: path.resolve(PROJECT_ROOT, "node_modules/tailwindcss"),
    },
  },
};

export default nextConfig;
