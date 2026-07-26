import { competitionStatusLabel,type CompetitionStatus } from '../../config/competition'

export function CompetitionStatusBadge({status}:{status:CompetitionStatus}){return <span className={`competition-status ${status}`}><i/>{competitionStatusLabel[status]}</span>}
