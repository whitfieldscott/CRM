import { THEME_STORAGE_KEY } from "@/lib/theme";

/** Runs before paint to avoid theme flash. Default: dark. */
export function ThemeScript() {
  const script = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t==='light'){document.documentElement.classList.remove('dark');}else{document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
