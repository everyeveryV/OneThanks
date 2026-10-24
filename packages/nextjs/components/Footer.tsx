import Link from "next/link";

export const Footer = () => (
  <footer className="site-footer">
    <span>让开源背后的人，听见一句谢谢。</span>
    <div>
      <span>测试网演示 · GitHub 身份由后端核验</span>
      <Link href="/debug">开发者入口</Link>
    </div>
  </footer>
);
