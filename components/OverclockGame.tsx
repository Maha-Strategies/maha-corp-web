'use client'

import { useMemo, useState } from 'react'
import { trackConversion } from '@/components/ConversionTracker'

type GovernorId = 'compound' | 'overvolt' | 'alarm'
type Phase = 'title' | 'game' | 'result'

type RoundResult = {
  banked?: number
  cascaded: boolean
}

const ROUNDS = 5
const STARTING_OUTPUT = 100

const governors: Record<GovernorId, { name: string; description: string }> = {
  compound: {
    name: 'Compound Interest',
    description: 'Each bank raises base output by 5% for the rest of the run. Small wins snowball.',
  },
  overvolt: {
    name: 'Overvolt',
    description: 'Payout increments rise by 50%. Cascade risk rises by 25%. The pure greed lever.',
  },
  alarm: {
    name: 'Loud Alarm',
    description: 'Verification is free and unlimited. Ignore the oracle anyway and its trust falls twice as fast.',
  },
}

function multiplier(governor: GovernorId, pushes: number) {
  const initialIncrement = governor === 'overvolt' ? 0.3 : 0.2
  const incrementalGain = governor === 'overvolt' ? 0.15 : 0.1
  let value = 1

  for (let index = 1; index <= pushes; index += 1) {
    value += initialIncrement + incrementalGain * (index - 1)
  }

  return value
}

function payout(governor: GovernorId, baseOutput: number, pushes: number) {
  return Math.round(baseOutput * multiplier(governor, pushes))
}

function cascadeRisk(governor: GovernorId, pushes: number) {
  const coefficient = governor === 'overvolt' ? 0.018 * 1.25 : 0.018
  return Math.min(0.95, coefficient * Math.pow(pushes, 1.6))
}

function reportedRisk(governor: GovernorId, pushes: number, fidelity: number) {
  const actual = cascadeRisk(governor, pushes)
  if (fidelity >= 60) return Math.max(0.05, Math.round(actual * 20) * 5 / 100)

  const degradation = 0.25 + 0.75 * (fidelity / 60)
  return Math.max(0.05, Math.round(actual * degradation * 20) * 5 / 100)
}

function formatRisk(risk: number) {
  return `${Math.round(risk * 100)}%`
}

function performanceBand(score: number) {
  if (score >= 1100) return 'Great'
  if (score >= 900) return 'Good'
  if (score >= 750) return 'Par'
  return 'Below par'
}

export default function OverclockGame() {
  const [phase, setPhase] = useState<Phase>('title')
  const [governor, setGovernor] = useState<GovernorId | null>(null)
  const [baseOutput, setBaseOutput] = useState(STARTING_OUTPUT)
  const [fidelity, setFidelity] = useState(80)
  const [round, setRound] = useState(1)
  const [pushes, setPushes] = useState(0)
  const [score, setScore] = useState(0)
  const [results, setResults] = useState<RoundResult[]>([])
  const [verifyCharges, setVerifyCharges] = useState(1)
  const [trueReadingUsed, setTrueReadingUsed] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [readout, setReadout] = useState('Bank now, or push.')
  const [verification, setVerification] = useState<string | null>(null)

  const game = useMemo(() => {
    if (!governor) return null

    const currentPayout = payout(governor, baseOutput, pushes)
    const nextPayout = payout(governor, baseOutput, pushes + 1)
    const nextReportedRisk = reportedRisk(governor, pushes + 1, fidelity)
    const expectedValue = (1 - nextReportedRisk) * nextPayout - currentPayout
    const advice = expectedValue > 0 ? 'PUSH' : 'BANK'

    return { currentPayout, nextPayout, nextReportedRisk, advice }
  }, [baseOutput, fidelity, governor, pushes])

  function adjustFidelity(change: number) {
    setFidelity((current) => Math.max(0, Math.min(100, current + change)))
  }

  function startRun(nextGovernor: GovernorId) {
    setGovernor(nextGovernor)
    setBaseOutput(STARTING_OUTPUT)
    setFidelity(80)
    setRound(1)
    setPushes(0)
    setScore(0)
    setResults([])
    setVerifyCharges(nextGovernor === 'alarm' ? Number.POSITIVE_INFINITY : 1)
    setTrueReadingUsed(false)
    setIsResolving(false)
    setReadout('Bank now, or push.')
    setVerification(null)
    setPhase('game')
    trackConversion(`overclock_governor_${nextGovernor}`)
  }

  function completeRound(result: RoundResult, nextScore: number) {
    setResults((current) => [...current, result])
    setScore(nextScore)

    if (round === ROUNDS) {
      setPhase('result')
      setIsResolving(false)
      trackConversion('overclock_run_complete')
      return
    }

    setRound((current) => current + 1)
    setPushes(0)
    setVerifyCharges(governor === 'alarm' ? Number.POSITIVE_INFINITY : 1)
    setIsResolving(false)
    setVerification(null)
  }

  function verify() {
    if (!game || !governor || isResolving || verifyCharges < 1) return

    const actual = cascadeRisk(governor, pushes + 1)
    const reported = game.nextReportedRisk
    const gap = actual - reported

    if (verifyCharges !== Number.POSITIVE_INFINITY) {
      setVerifyCharges((current) => current - 1)
    }

    adjustFidelity(6)
    setVerification(`Verification: oracle ${formatRisk(reported)} · actual ${formatRisk(actual)}${gap >= 0.1 ? ' — material gap detected.' : ''}`)
    trackConversion('overclock_verify')
    if (gap >= 0.1) trackConversion('overclock_oracle_gap_seen')
  }

  function useTrueReading() {
    if (!governor || fidelity < 90 || trueReadingUsed) return

    const next = cascadeRisk(governor, pushes + 1)
    const afterNext = cascadeRisk(governor, pushes + 2)
    setTrueReadingUsed(true)
    setVerification(`True reading: next push ${formatRisk(next)} · push after that ${formatRisk(afterNext)}`)
    trackConversion('overclock_true_reading')
  }

  function push() {
    if (!game || !governor || isResolving) return

    const nextPushes = pushes + 1
    const actualRisk = cascadeRisk(governor, nextPushes)
    const reportedAtPush = game.nextReportedRisk
    const ignoredBankAdvice = game.advice === 'BANK'
    const cascades = Math.random() < actualRisk

    setIsResolving(true)
    setReadout('The reactor is resolving…')

    window.setTimeout(() => {
      if (cascades) {
        if (ignoredBankAdvice) adjustFidelity(governor === 'alarm' ? -4 : -2)
        setReadout('Cascade. The current pot is lost.')
        setVerification(actualRisk - reportedAtPush >= 0.1 ? 'The oracle understated the risk on that push.' : null)
        completeRound({ cascaded: true }, score)
        trackConversion('overclock_cascade')
        return
      }

      if (ignoredBankAdvice) adjustFidelity(governor === 'alarm' ? -20 : -10)
      setPushes(nextPushes)
      setReadout(`Held. Multiplier now ×${multiplier(governor, nextPushes).toFixed(2)}.`)
      setVerification(null)
      setIsResolving(false)
    }, 420)
  }

  function bank() {
    if (!game || !governor || isResolving) return

    const banked = game.currentPayout
    const nextScore = score + banked
    if (game.advice === 'BANK') adjustFidelity(4)
    if (governor === 'compound') setBaseOutput((current) => Math.round(current * 1.05))
    setReadout(`Banked +${banked}.`)
    completeRound({ banked, cascaded: false }, nextScore)
  }

  function returnToTitle() {
    setPhase('title')
    setGovernor(null)
    setIsResolving(false)
    trackConversion('overclock_replay')
  }

  if (phase === 'title') {
    return (
      <section aria-labelledby="overclock-game-title" className="border border-zinc-800 bg-[#10141a] p-6 sm:p-9">
        <div className="max-w-xl mx-auto text-center">
          <p className="font-mono text-xs text-orange-300 tracking-widest uppercase mb-5">[ Reactor // prototype ]</p>
          <h2 id="overclock-game-title" className="font-mono text-2xl sm:text-3xl font-bold tracking-[0.22em] text-zinc-100 mb-6">OVER<span className="text-orange-300">CLOCK</span></h2>
          <p className="text-zinc-300 leading-relaxed mb-4">
            The reactor pays for greed. Push and the payout rises while cascade risk climbs. Bank and you keep the pot—while giving up the bigger number that may have been one push away.
          </p>
          <p className="text-sm text-zinc-400 leading-relaxed mb-8">
            Five rounds. The oracle states the risk before each push, but its accuracy changes with the way you use it.
          </p>
          <p className="font-mono text-xs text-zinc-400 tracking-widest uppercase mb-4">Choose a governor</p>
          <div className="grid gap-3 text-left">
            {(Object.keys(governors) as GovernorId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => startRun(id)}
                className="border border-zinc-700 bg-zinc-900/70 p-5 text-left hover:border-orange-300 transition-colors"
              >
                <span className="block font-mono text-sm text-orange-300 tracking-widest uppercase mb-2">{governors[id].name}</span>
                <span className="block text-sm text-zinc-300 leading-relaxed">{governors[id].description}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (phase === 'result') {
    return (
      <section aria-live="polite" className="border border-zinc-800 bg-[#10141a] p-8 sm:p-12 text-center">
        <p className="font-mono text-xs text-zinc-400 tracking-widest uppercase mb-5">[ Run complete ]</p>
        <p className="font-mono text-6xl sm:text-7xl font-bold text-zinc-100 tabular-nums">{score}</p>
        <p className="mt-4 text-zinc-300">{performanceBand(score)} · par 750 / good 900 / great 1100</p>
        <p className="mt-3 text-sm text-zinc-400">Governor: {governor ? governors[governor].name : '—'}</p>
        <button
          type="button"
          onClick={returnToTitle}
          className="mt-9 border border-orange-300 bg-orange-950/30 px-7 py-4 font-mono text-xs font-bold text-orange-200 tracking-widest uppercase hover:bg-orange-900/50 transition-colors"
        >
          Run it again
        </button>
      </section>
    )
  }

  if (!game || !governor) return null

  const visibleRisk = pushes === 0 ? 0 : cascadeRisk(governor, pushes)
  const potColor = visibleRisk > 0.28 ? '#ff4e2a' : visibleRisk > 0.12 ? '#f0a030' : '#e8e4d8'
  const canUseTrueReading = fidelity >= 90 && !trueReadingUsed
  const verifyLabel = governor === 'alarm' ? 'Verify (free)' : `Verify (${verifyCharges}/round)`

  return (
    <section aria-label="Overclock game" className="border border-zinc-800 bg-[#10141a] p-5 sm:p-8">
      <div className="grid grid-cols-5 gap-2 mb-6" aria-label={`Round ${round} of ${ROUNDS}`}>
        {Array.from({ length: ROUNDS }, (_, index) => {
          const result = results[index]
          const isCurrent = index + 1 === round
          const value = result?.cascaded ? '× 0' : result?.banked ? `+${result.banked}` : '·'
          return (
            <div key={index} className={`min-h-14 border p-2 text-center ${isCurrent ? 'border-orange-300 bg-orange-950/20' : 'border-zinc-800 bg-zinc-900/60'}`}>
              <p className="font-mono text-xs text-zinc-500">R{index + 1}</p>
              <p className={`mt-1 font-mono text-sm font-bold ${result?.cascaded ? 'text-red-400' : result?.banked ? 'text-emerald-300' : 'text-zinc-300'}`}>{value}</p>
            </div>
          )
        })}
      </div>

      <div className="border-l-2 border-indigo-300 bg-zinc-900/70 p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs text-indigo-200 tracking-widest uppercase">Oracle</p>
          <p className={`border px-2 py-1 font-mono text-xs tracking-widest uppercase ${game.advice === 'PUSH' ? 'border-orange-300 text-orange-200' : 'border-emerald-400 text-emerald-300'}`}>
            {game.advice === 'PUSH' ? 'Push is +EV' : 'Bank now'}
          </p>
        </div>
        <p className="mt-3 text-sm text-zinc-200">Cascade risk on next push: <span className="font-mono font-bold">{formatRisk(game.nextReportedRisk)}</span></p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={verify} disabled={isResolving || verifyCharges < 1} className="border border-zinc-600 px-3 py-2 font-mono text-xs text-zinc-200 hover:border-indigo-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 transition-colors">
            {verifyLabel}
          </button>
          {canUseTrueReading && (
            <button type="button" onClick={useTrueReading} className="border border-indigo-400 px-3 py-2 font-mono text-xs text-indigo-200 hover:text-white transition-colors">
              True reading (once/run)
            </button>
          )}
          <span className="self-center font-mono text-xs text-zinc-500">Fidelity {fidelity}%</span>
        </div>
        {verification && <p className="mt-4 text-sm text-zinc-300" role="status">{verification}</p>}
      </div>

      <div className="text-center py-5">
        <p className={`font-mono text-6xl sm:text-7xl font-bold tabular-nums ${visibleRisk > 0.06 ? 'animate-pulse' : ''}`} style={{ color: potColor }}>{game.currentPayout}</p>
        <p className="mt-3 font-mono text-xs text-zinc-400">Round {round}/{ROUNDS} · push {pushes} · ×{multiplier(governor, pushes).toFixed(2)} · next payout {game.nextPayout}</p>
        <p className="mt-5 min-h-6 text-sm text-zinc-300" role="status">{readout}</p>
      </div>

      <div className="grid grid-cols-[3fr_2fr] gap-3 mt-3">
        <button type="button" onClick={push} disabled={isResolving} className="border border-orange-300 bg-orange-950/30 py-5 font-mono text-base font-bold text-orange-200 tracking-[0.2em] hover:bg-orange-900/50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors">
          Push
        </button>
        <button type="button" onClick={bank} disabled={isResolving} className="border border-emerald-700 bg-emerald-950/30 py-5 font-mono text-sm font-bold text-emerald-300 tracking-widest uppercase hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-40 transition-colors">
          Bank {game.currentPayout}
        </button>
      </div>
      <p className="mt-4 text-center font-mono text-xs text-zinc-500">Governor: {governors[governor].name}</p>
    </section>
  )
}
