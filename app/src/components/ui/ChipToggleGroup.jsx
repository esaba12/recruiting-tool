// Generic multi-select chip toggle — extracted from ContactDetailModal's affinity chips
// so the same pattern (affinity tags, life-domain tags, etc.) isn't copy-pasted per field.
export default function ChipToggleGroup({ options, value = [], onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(tag => (
        <button key={tag} type="button" onClick={() => onToggle(tag)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${value.includes(tag)
            ? 'bg-accent-600 text-white border-accent-600'
            : 'bg-white text-ink-500 border-ink-200 hover:border-accent-300'}`}>
          {tag}
        </button>
      ))}
    </div>
  )
}
