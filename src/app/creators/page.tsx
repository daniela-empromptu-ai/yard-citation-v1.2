'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { PlatformBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { showToast } from '@/components/ui/Toaster'
import { formatNumber } from '@/lib/utils'
import { Search, Plus, ChevronLeft, ChevronRight, X, Pencil, Trash2, RefreshCw } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Creator {
  id: string
  name: string
  platform: string
  handle: string | null
  url: string | null
  subscriber_count: number | null
  content_language: string | null
  relationship_status: string | null
  too_expensive: boolean
  brand_owned: boolean
  excluded: boolean
  exclusion_reason: string | null
  notes: string | null
  email: string | null
  contact_method: string | null
  discovered_via: string | null
  category_names: string
  created_at: string
  updated_at: string
}

interface Category {
  id: string
  name: string
  parent_id: string | null
}

const PLATFORMS = ['youtube', 'medium', 'devto', 'linkedin', 'github', 'newsletter', 'podcast', 'blog', 'other']
const RELATIONSHIP_STATUSES = ['none', 'cold', 'warm', 'hot']

function RelationshipBadge({ status }: { status: string | null }) {
  const s = status || 'none'
  const colors: Record<string, string> = {
    none: 'bg-slate-100 text-slate-500',
    cold: 'bg-blue-100 text-blue-700',
    warm: 'bg-amber-100 text-amber-700',
    hot: 'bg-red-100 text-red-700',
  }
  return <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${colors[s] || colors.none}`}>{s}</span>
}

export default function CreatorsPage() {
  const [creators, setCreators] = useState<Creator[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)

  // Filters
  const [search, setSearch] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  // Modals
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editCreator, setEditCreator] = useState<Creator | null>(null)
  const [catManageOpen, setCatManageOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [saving, setSaving] = useState(false)

  // Add form
  const [form, setForm] = useState({ name: '', platform: 'youtube', handle: '', url: '', notes: '', email: '', category_ids: [] as string[] })

  const fetchCreators = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search) params.set('q', search)
      if (filterPlatform) params.set('platform', filterPlatform)
      if (filterCategory) params.set('category', filterCategory)
      const res = await fetch(`/api/creators?${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setCreators(json.data || [])
      setTotal(json.total || 0)
      setPages(json.pages || 1)
    } catch (e) {
      showToast('error', (e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [page, search, filterPlatform, filterCategory])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories')
      const json = await res.json()
      if (Array.isArray(json)) setCategories(json)
    } catch {}
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories])
  useEffect(() => { fetchCreators() }, [fetchCreators])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [search, filterPlatform, filterCategory])

  async function handleAdd() {
    if (!form.name.trim() || !form.platform) return
    setSaving(true)
    try {
      const res = await fetch('/api/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      showToast('success', `Added ${form.name}`)
      setAddOpen(false)
      setForm({ name: '', platform: 'youtube', handle: '', url: '', notes: '', email: '', category_ids: [] })
      fetchCreators()
    } catch (e) {
      showToast('error', (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleInlineUpdate(id: string, field: string, value: unknown) {
    try {
      const res = await fetch(`/api/creators/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setCreators(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
    } catch (e) {
      showToast('error', (e as Error).message)
    }
  }

  async function handleEditSave() {
    if (!editCreator) return
    setSaving(true)
    try {
      const res = await fetch(`/api/creators/${editCreator.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editCreator),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      showToast('success', 'Creator updated')
      setEditOpen(false)
      fetchCreators()
    } catch (e) {
      showToast('error', (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/creators/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      showToast('success', `Deleted ${name}`)
      fetchCreators()
    } catch (e) {
      showToast('error', (e as Error).message)
    }
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      showToast('success', `Added category "${newCatName.trim()}"`)
      setNewCatName('')
      fetchCategories()
    } catch (e) {
      showToast('error', (e as Error).message)
    }
  }

  async function handleDeleteCategory(id: string, name: string) {
    if (!confirm(`Delete category "${name}"?`)) return
    try {
      const res = await fetch('/api/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      fetchCategories()
    } catch (e) {
      showToast('error', (e as Error).message)
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Creator Database"
        subtitle={`${total} creators`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setCatManageOpen(true)} className="btn-secondary text-xs">
              Categories
            </button>
            <button onClick={() => setAddOpen(true)} className="btn-primary text-sm flex items-center gap-1">
              <Plus size={14} /> Add Creator
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or handle..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 w-full text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="input text-sm">
          <option value="">All Platforms</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="input text-sm">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-400">
            <RefreshCw size={14} className="animate-spin" /> Loading...
          </div>
        ) : creators.length === 0 ? (
          <EmptyState
            icon="\ud83d\udc64"
            title="No creators found"
            description="Add creators manually or through campaign discovery."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-dense">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Platform</th>
                  <th>Handle</th>
                  <th>Categories</th>
                  <th>Subscribers</th>
                  <th>Relationship</th>
                  <th>Flags</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {creators.map(c => (
                  <tr key={c.id} className={c.excluded ? 'opacity-50' : ''}>
                    <td>
                      <Link href={`/creators/${c.id}`} className="font-medium text-slate-900 hover:text-blue-600">
                        {c.name}
                      </Link>
                      {c.email && <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{c.email}</div>}
                    </td>
                    <td><PlatformBadge platform={c.platform} /></td>
                    <td className="text-xs text-slate-600 max-w-[140px] truncate">
                      {c.handle ? (
                        <a
                          href={c.url || (c.platform === 'youtube' ? `https://www.youtube.com/@${c.handle}` : c.platform === 'medium' ? `https://medium.com/@${c.handle}` : c.platform === 'devto' ? `https://dev.to/${c.handle}` : '#')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {c.platform === 'youtube' || c.platform === 'medium' ? `@${c.handle.replace(/^@/, '')}` : c.handle}
                        </a>
                      ) : '\u2014'}
                    </td>
                    <td className="text-[10px] text-slate-500 max-w-[150px] truncate">{c.category_names || '\u2014'}</td>
                    <td className="text-xs text-slate-600">{formatNumber(c.subscriber_count)}</td>
                    <td>
                      <select
                        value={c.relationship_status || 'none'}
                        onChange={e => handleInlineUpdate(c.id, 'relationship_status', e.target.value)}
                        className="text-[10px] border border-slate-200 rounded px-1 py-0.5 bg-white"
                      >
                        {RELATIONSHIP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-0.5">
                        {c.too_expensive && <span className="text-[10px] px-1.5 py-0 rounded bg-amber-100 text-amber-700">$$$</span>}
                        {c.brand_owned && <span className="text-[10px] px-1.5 py-0 rounded bg-purple-100 text-purple-700">brand</span>}
                        {c.excluded && <span className="text-[10px] px-1.5 py-0 rounded bg-red-100 text-red-700">excluded</span>}
                      </div>
                    </td>
                    <td className="text-[10px] text-slate-400 max-w-[120px] truncate">{c.notes || ''}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditCreator({ ...c }); setEditOpen(true) }}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>Page {page} of {pages} ({total} total)</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary text-xs p-1 disabled:opacity-30">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} className="btn-secondary text-xs p-1 disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Add Creator Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Creator" size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Channel or brand name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Platform *</label>
              <select className="input w-full" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Handle</label>
              <input className="input w-full" value={form.handle} onChange={e => setForm(f => ({ ...f, handle: e.target.value }))} placeholder="@username" />
            </div>
          </div>
          <div>
            <label className="label">URL</label>
            <input className="input w-full" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input w-full" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@example.com" />
          </div>
          <div>
            <label className="label">Categories</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {categories.map(cat => (
                <label key={cat.id} className={`text-xs px-2 py-1 rounded-full border cursor-pointer transition-colors ${
                  form.category_ids.includes(cat.id) ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={form.category_ids.includes(cat.id)}
                    onChange={e => {
                      setForm(f => ({
                        ...f,
                        category_ids: e.target.checked
                          ? [...f.category_ids, cat.id]
                          : f.category_ids.filter(id => id !== cat.id)
                      }))
                    }}
                  />
                  {cat.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input w-full" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAddOpen(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleAdd} disabled={saving || !form.name.trim()} className="btn-primary text-sm disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Creator'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Creator Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Creator" size="md">
        {editCreator && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Name</label>
                <input className="input w-full" value={editCreator.name} onChange={e => setEditCreator(c => c ? { ...c, name: e.target.value } : c)} />
              </div>
              <div>
                <label className="label">Platform</label>
                <select className="input w-full" value={editCreator.platform} onChange={e => setEditCreator(c => c ? { ...c, platform: e.target.value } : c)}>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Handle</label>
                <input className="input w-full" value={editCreator.handle || ''} onChange={e => setEditCreator(c => c ? { ...c, handle: e.target.value || null } : c)} />
              </div>
              <div>
                <label className="label">URL</label>
                <input className="input w-full" value={editCreator.url || ''} onChange={e => setEditCreator(c => c ? { ...c, url: e.target.value || null } : c)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Email</label>
                <input className="input w-full" value={editCreator.email || ''} onChange={e => setEditCreator(c => c ? { ...c, email: e.target.value || null } : c)} />
              </div>
              <div>
                <label className="label">Relationship</label>
                <select className="input w-full" value={editCreator.relationship_status || 'none'} onChange={e => setEditCreator(c => c ? { ...c, relationship_status: e.target.value } : c)}>
                  {RELATIONSHIP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editCreator.too_expensive} onChange={e => setEditCreator(c => c ? { ...c, too_expensive: e.target.checked } : c)} />
                Too Expensive
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editCreator.brand_owned} onChange={e => setEditCreator(c => c ? { ...c, brand_owned: e.target.checked } : c)} />
                Brand Owned
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editCreator.excluded} onChange={e => setEditCreator(c => c ? { ...c, excluded: e.target.checked } : c)} />
                Excluded
              </label>
            </div>
            {editCreator.excluded && (
              <div>
                <label className="label">Exclusion Reason</label>
                <input className="input w-full" value={editCreator.exclusion_reason || ''} onChange={e => setEditCreator(c => c ? { ...c, exclusion_reason: e.target.value || null } : c)} />
              </div>
            )}
            <div>
              <label className="label">Notes</label>
              <textarea className="input w-full" rows={3} value={editCreator.notes || ''} onChange={e => setEditCreator(c => c ? { ...c, notes: e.target.value || null } : c)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditOpen(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleEditSave} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Categories Management Modal */}
      <Modal open={catManageOpen} onClose={() => setCatManageOpen(false)} title="Manage Categories" size="sm">
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="New category name"
              onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
            />
            <button onClick={handleAddCategory} disabled={!newCatName.trim()} className="btn-primary text-sm disabled:opacity-50">Add</button>
          </div>
          <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
            {categories.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">No categories yet</div>}
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700">{cat.name}</span>
                <button onClick={() => handleDeleteCategory(cat.id, cat.name)} className="text-slate-400 hover:text-red-500 p-1">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}
