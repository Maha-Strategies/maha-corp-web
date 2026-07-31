export interface AuditLedgerEntry {
  id: string;
  tenantId: string;
  jobId: string;
  engine: 'tensor-opt' | 'geometric-ai' | 'qec-compiler' | 'landscape-opt';
  timestamp: number; // UTC Epoch ms
  creditDelta: number;
  entryType: 'DEBIT' | 'CREDIT';
  hmacSignature: string;
  inputHash: string;
  outputHash: string;
  status: 'COMPLETED' | 'FAILED' | 'REVERTED';
}

export interface ExportFilterOptions {
  tenantId: string;
  startDate?: number;
  endDate?: number;
  engine?: string;
  format: 'csv' | 'pdf';
}

export interface AuditExportPayload {
  generatedAt: string;
  tenantId: string;
  entries: AuditLedgerEntry[];
  summary: {
    totalJobs: number;
    totalCreditsConsumed: number;
    verificationHash: string; // Aggregate SHA-256 hash of the audit sequence
  };
}