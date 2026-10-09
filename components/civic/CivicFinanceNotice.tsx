import { CIVIC_FINANCE_POLICY } from '@/lib/civic/finance-policy'
import styles from './CivicDashboard.module.css'

export default function CivicFinanceNotice() {
  return <aside className={styles.financeNotice} aria-labelledby="civic-finance-notice-title" data-finance-mode={CIVIC_FINANCE_POLICY.mode}>
    <h2 id="civic-finance-notice-title">Campaign fundraising is unavailable</h2>
    <p>This research interface does not accept political contributions, sign wallet transactions, or execute campaign payments. Ledger receipts document declarations; they are not campaign finance filings or donor-eligibility checks.</p>
  </aside>
}
