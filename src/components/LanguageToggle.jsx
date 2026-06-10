import { useLang } from '../context/LanguageContext';

export default function LanguageToggle() {
  const { lang, setLang } = useLang();

  return (
    <div className="lang-toggle">
      <button
        className={lang === 'pt' ? 'active' : ''}
        onClick={() => setLang('pt')}
      >
        Português
      </button>
      <button
        className={lang === 'en' ? 'active' : ''}
        onClick={() => setLang('en')}
      >
        English
      </button>
    </div>
  );
}
