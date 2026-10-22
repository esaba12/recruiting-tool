import { useState } from 'react'
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, GripVertical, Plus, X } from 'lucide-react'
import {
  TODAY_CARDS, KIND_LABEL, SIZES, SIZE_LABEL, CAPS, cardDef, cardAvailable, settingValue,
  moveCard, moveBy, addCard, removeCard, setSize, setCap, toggleGroup, setSetting,
} from '../../lib/todayCards.js'
import { cn } from '../../lib/cn.js'
import Button from '../ui/Button.jsx'
import Mono from '../ui/Mono.jsx'
import SidePanel from '../ui/SidePanel.jsx'
import { Label } from './DashCard.jsx'

// Today's edit mode (v1.4 spec 08). Lazy: @dnd-kit is fetched only when Customize opens.
// Cards show as compact tiles at their chosen width, so empty ones can be arranged too. Drag
// by the grip (long-press on a phone, Space + arrows on a keyboard), or use ↑/↓. Every change
// saves as it's made; Done just leaves edit mode.

// Mirrors TodayTab's bands: thirds 3-up, halves 2-up, full alone (one column on phones).
const SPAN = { third: 'lg:col-span-2', half: 'lg:col-span-3', full: 'md:col-span-2 lg:col-span-6' }

function Segmented({ label, options, value, onChange, format = String }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-ink-400">{label}</span>
      <div role="group" aria-label={label} className="inline-flex rounded-sm border border-ink-200 overflow-hidden">
        {options.map(o => (
          <button key={o} type="button" aria-pressed={o === value} onClick={() => onChange(o)}
            className={cn('px-2 py-0.5 font-mono text-[11px] transition-colors border-l border-ink-200 first:border-l-0',
              o === value ? 'bg-ink-900 text-surface' : 'text-ink-500 hover:bg-ink-50')}>
            {format(o)}
          </button>
        ))}
      </div>
    </div>
  )
}

function Tile({ card, index, total, count, ctx, update }) {
  const def = cardDef(card.id)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const iconBtn = 'p-1 rounded-sm text-ink-400 hover:text-ink-800 hover:bg-ink-50 disabled:opacity-30 disabled:hover:bg-transparent'
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('min-w-0 bg-surface border border-dashed border-ink-300 rounded-md px-3 pt-2 pb-3', SPAN[card.size],
        isDragging && 'relative z-10 border-solid border-ink-700 shadow-lg')}>
      <header className="flex items-center gap-2 min-h-7">
        <button ref={setActivatorNodeRef} {...attributes} {...listeners} type="button"
          aria-label={`Drag ${def.title}`} className="-ml-1 p-1 rounded-sm text-ink-400 hover:text-ink-800 hover:bg-ink-50 cursor-grab active:cursor-grabbing touch-none">
          <GripVertical size={14} />
        </button>
        <Mono className="text-ink-300 text-[10px]">{String(index + 1).padStart(2, '0')}</Mono>
        <Label tone={def.kind === 'act' ? 'warning' : 'accent'} className="min-w-0 truncate">{def.title}</Label>
        <span className="ml-auto flex items-center">
          <button type="button" className={iconBtn} disabled={index === 0} aria-label={`Move ${def.title} up`}
            onClick={() => update(l => moveBy(l, card.id, -1))}><ArrowUp size={14} /></button>
          <button type="button" className={iconBtn} disabled={index === total - 1} aria-label={`Move ${def.title} down`}
            onClick={() => update(l => moveBy(l, card.id, 1))}><ArrowDown size={14} /></button>
          <button type="button" className={iconBtn} aria-label={`Remove ${def.title}`}
            onClick={() => update(l => removeCard(l, card.id))}><X size={14} /></button>
        </span>
      </header>
      <p className="text-xs text-ink-500 mt-0.5">{def.description}</p>
      {def.kind === 'act' && (
        <p className="mt-1 text-[11px] text-ink-400">
          {count ? <><Mono className="text-ink-800 font-semibold">{count}</Mono> to look at now</> : 'Nothing here right now'}
        </p>
      )}

      {def.groups && (
        <div className="mt-2 flex flex-wrap gap-1">
          {def.groups.map(g => {
            const avail = g.available ? g.available(ctx) : true
            const on = avail === true && !card.off.includes(g.id)
            return (
              <button key={g.id} type="button" aria-pressed={on} disabled={avail !== true}
                title={avail === true ? (on ? 'Shown. Click to hide this list.' : 'Hidden. Click to show this list.') : avail}
                onClick={() => update(l => toggleGroup(l, card.id, g.id))}
                className={cn('px-2 py-0.5 rounded-sm border font-mono text-[10px] uppercase tracking-[0.08em] transition-colors',
                  on ? 'border-ink-700 text-ink-800' : 'border-ink-200 text-ink-400 line-through hover:text-ink-600',
                  'disabled:no-underline disabled:opacity-50 disabled:hover:text-ink-400')}>
                {g.label}
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-2.5 pt-2 border-t border-ink-100 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented label="Width" options={SIZES} value={card.size} format={s => SIZE_LABEL[s]}
          onChange={s => update(l => setSize(l, card.id, s))} />
        {def.rows && (
          <Segmented label="Rows" options={CAPS} value={card.cap} onChange={n => update(l => setCap(l, card.id, n))} />
        )}
        {(def.settings || []).map(s => (
          <Segmented key={s.key} label={s.label} options={s.options} value={settingValue(card, s.key)} format={v => `${v}${s.unit}`}
            onChange={v => update(l => setSetting(l, card.id, s.key, v))} />
        ))}
      </div>
    </li>
  )
}

function AddDrawer({ open, onClose, layout, ctx, update }) {
  const placed = new Set(layout.cards.map(c => c.id))
  const kinds = ['act', 'glance']
  return (
    <SidePanel open={open} onClose={onClose}>
      <div className="p-5">
        <div className="flex items-center gap-3">
          <Label tone="accent">Add cards</Label>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto p-1 rounded-sm text-ink-400 hover:text-ink-800 hover:bg-ink-50"><X size={16} /></button>
        </div>
        {kinds.map(kind => {
          const defs = TODAY_CARDS.filter(d => d.kind === kind && !placed.has(d.id))
          if (!defs.length) return null
          return (
            <section key={kind} className="mt-5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-400 border-b border-ink-100 pb-1">{KIND_LABEL[kind]}</h3>
              <ul className="divide-y divide-ink-100">
                {defs.map(d => {
                  const avail = cardAvailable(d.id, ctx)
                  return (
                    <li key={d.id} className={cn('py-3 flex items-start gap-3', avail !== true && 'opacity-50')}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-900">{d.title}</p>
                        <p className="text-xs text-ink-500">{avail === true ? d.description : `Unavailable: ${avail}`}</p>
                      </div>
                      <Button size="sm" variant="secondary" disabled={avail !== true} onClick={() => update(l => addCard(l, d.id))}
                        className="shrink-0 inline-flex items-center gap-1"><Plus size={12} /> Add</Button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
        {TODAY_CARDS.every(d => placed.has(d.id)) && <p className="mt-5 text-sm text-ink-400">Every card is already on Today.</p>}
      </div>
    </SidePanel>
  )
}

export default function TodayEditor({ layout, update, reset, ctx, counts, onDone }) {
  const [adding, setAdding] = useState(false)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const ids = layout.cards.map(c => c.id)
  const missing = TODAY_CARDS.filter(d => !ids.includes(d.id)).length

  function onDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    update(l => moveCard(l, l.cards.findIndex(c => c.id === active.id), l.cards.findIndex(c => c.id === over.id)))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 border border-ink-300 rounded-md bg-surface px-3 py-2">
        <Label tone="accent">Customizing Today</Label>
        <span className="text-xs text-ink-400 hidden sm:inline">Drag by the grip, or use the arrows. Changes save as you go.</span>
        <span className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)} className="inline-flex items-center gap-1">
            <Plus size={12} /> Add cards{missing ? <Mono className="text-ink-400">{missing}</Mono> : null}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { if (window.confirm('Put Today back to the default layout?')) reset() }}>Reset to default</Button>
          <Button size="sm" onClick={onDone}>Done</Button>
        </span>
      </div>

      {layout.cards.length === 0
        ? <p className="border border-dashed border-ink-300 rounded-md px-4 py-8 text-center text-sm text-ink-400">Today is empty. Add cards to put something here.</p>
        : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-start">
                {layout.cards.map((card, i) => (
                  <Tile key={card.id} card={card} index={i} total={layout.cards.length} count={counts[card.id] || 0} ctx={ctx} update={update} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

      <AddDrawer open={adding} onClose={() => setAdding(false)} layout={layout} ctx={ctx} update={update} />
    </div>
  )
}
