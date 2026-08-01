'use client'

import { useState } from 'react'
import { MahaClient, type AuditExportOptions } from '@/lib/sdk/index'

type ExportFormat = 'csv' | 'pdf'

function startOfDay(value: string): number | undefined {
  if (!value) return undefined
  const timestamp = new Date(`${value}T00:00:00`).getTime()
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function endOfDay(value: string): number | undefined {
  if (!value) return undefined
  const timestamp = new Date(`${value}T23:59:59.999`).getTime()
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function download(data: string | Blob | ArrayBuffer, filename: string, format: ExportFormat) {
  const blob = data instanceof Blob
    ? data
    : new Blob([data], { type: format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function AuditExportPanel({ apiKey }: { apiKey: string }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function exportAudit(format: ExportFormat) {
    const startTime = startOfDay(startDate)
    const endTime = endOfDay(endDate)
    if (startDate && startTime === undefined || endDate && endTime === undefined) {
      setError('Choose valid start and end dates.')
      return
    }
    if (startTime !== undefined && endTime !== undefined && startTime > endTime) {
      setError('The start date must be on or before the end date.')
      return
    }

    setExporting(format)
    setError(null)
    setNotice(null)
    try {
      const client = new MahaClient({ apiKey, baseUrl: window.location.origin })
      const options: AuditExportOptions = { format, ...(startTime !== undefined ? { startTime } : {}), ...(endTime !== undefined ? { endTime } : {}) }
      const result = await client.audit.export(options)
      download(result.data, result.filename, format)
      setNotice(`${format.toUpperCase()} audit export downloaded.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The audit export could not be generated.')
    } finally {
      setExporting(null)
    }
  }

  const disabled = exporting !== null
  return <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="audit-export-heading">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="audit-export-heading" className="text-lg font-semibold">Audit exports</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">Download the provenance ledger associated with this API key. Exports are scoped to the connected key and are not retained in this dashboard.</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">CSV · PDF</span></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-gray-700">Start date<input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} disabled={disabled} className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" /></label><label className="text-sm font-medium text-gray-700">End date<input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} disabled={disabled} className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" /></label></div>
    <p className="mt-3 text-xs leading-5 text-gray-500">Leave dates blank to export the complete available audit trail. Dates are submitted as the browser’s local calendar day.</p>
    {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}
    <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => void exportAudit('csv')} disabled={disabled} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">{exporting === 'csv' ? 'Preparing CSV…' : 'Download CSV'}</button><button type="button" onClick={() => void exportAudit('pdf')} disabled={disabled} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">{exporting === 'pdf' ? 'Preparing PDF…' : 'Download signed PDF'}</button></div>
  </section>
}
