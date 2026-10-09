import type { Metadata } from 'next'
import { MOBILE_PRIVACY_TITLE, MOBILE_PRIVACY_SECTIONS } from '@/lib/astrology-mobile-privacy'
export const metadata:Metadata={title:MOBILE_PRIVACY_TITLE,description:'Mobile privacy, optional AI data sharing, cloud vault and deletion information.'}
export default function MobilePrivacy(){return <main className="evidence-page"><article className="evidence-container evidence-container--narrow prose"><h1>{MOBILE_PRIVACY_TITLE}</h1>{MOBILE_PRIVACY_SECTIONS.map(section=><section key={section.title}><h2>{section.title}</h2><p>{section.text}</p></section>)}<p><a href="mailto:mayone@mahastrategies.com">Contact privacy support</a></p></article></main>}
