import { useTranslation } from 'react-i18next'

// Category filter chips. `categories` is the list of category keys present in
// the data (plus an implicit "all"). Selecting one calls onChange(key).
export default function CategoryFilter({ categories, value, onChange }) {
  const { t } = useTranslation()
  const options = ['all', ...categories]

  return (
    <div className="filter-bar" role="group" aria-label="Category filter">
      {options.map((key) => (
        <button
          key={key}
          type="button"
          className={`chip${value === key ? ' active' : ''}`}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {t(`categories.${key}`)}
        </button>
      ))}
    </div>
  )
}
