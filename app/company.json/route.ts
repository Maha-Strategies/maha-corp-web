import { buildCompanyProfile, COMPANY_PORTFOLIO_PATH, COMPANY_PROFILE_SCHEMA_PATH } from '../../lib/company-profile.ts'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(buildCompanyProfile(), {
    headers: {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      Link: `<${COMPANY_PROFILE_SCHEMA_PATH}>; rel="describedby", <${COMPANY_PORTFOLIO_PATH}>; rel="alternate"; type="text/html"`,
    },
  })
}
