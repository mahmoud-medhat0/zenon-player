import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const languages = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'ar', label: 'عربي', name: 'العربية' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];

  const changeLanguage = (language: string) => {
    if (language !== currentLang) {
      i18n.changeLanguage(language);
    }
  };

  return (
    <div className="language-switcher" role="group" aria-label="Language">
      <span className="language-switcher-icon" aria-hidden="true">
        <Globe size={15} />
      </span>
      {languages.map((language) => (
        <button
          key={language.code}
          type="button"
          className={`language-switcher-option ${currentLang === language.code ? 'active' : ''}`}
          onClick={() => changeLanguage(language.code)}
          aria-pressed={currentLang === language.code}
          title={language.name}
          lang={language.code}
        >
          {language.label}
        </button>
      ))}
    </div>
  );
}
