import { useTheme } from '../theme/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  return (
    <button
      type="button"
      className={`tf-theme-toggle tf-btn tf-btn--ghost tf-btn--sm${className ? ` ${className}` : ''}`}
      onClick={toggleTheme}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-pressed={isLight}
      title={isLight ? 'Use dark theme' : 'Use light theme'}
    >
      <span className="tf-theme-toggle__icon" aria-hidden>
        {isLight ? <i className="feather icon-moon" /> : <i className="feather icon-sun" />}
      </span>
      <span className="tf-theme-toggle__text">{isLight ? 'Dark' : 'Light'}</span>
    </button>
  );
}
