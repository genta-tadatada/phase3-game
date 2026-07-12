import { useCareer } from '../../store/careerStore'
import { CareerTitle } from './CareerTitle'
import { WeeklyScreen } from './WeeklyScreen'
import { RosterScreen } from './RosterScreen'
import { CareerTactics } from './CareerTactics'
import { LineupEditor } from './LineupEditor'
import { PositionScreen } from './PositionScreen'
import { SummaryScreen } from './SummaryScreen'
import { ManageScreen } from './ManageScreen'
import { ScoutScreen } from './ScoutScreen'
import { CareerBracket, CareerMatch, CompResult } from './CareerComp'
import { RecordsScreen } from './RecordsScreen'
import { SquadAssignScreen } from './SquadAssignScreen'
import { SelectionScreen } from './SelectionScreen'
import { IntakeScreen } from './IntakeScreen'
import { CampScreen } from './CampScreen'
import { NewCaptainScreen } from './NewCaptainScreen'
import { GrowthResult } from './GrowthResult'

export function CareerApp() {
  const screen = useCareer((s) => s.screen)
  const growthResult = useCareer((s) => s.growthResult)
  const dismissGrowth = useCareer((s) => s.dismissGrowth)
  const body = (() => {
    switch (screen) {
      case 'title': return <CareerTitle />
      case 'weekly': return <WeeklyScreen />
      case 'roster': return <RosterScreen />
      case 'tactics': return <CareerTactics />
      case 'lineup': return <LineupEditor />
      case 'positions': return <PositionScreen />
      case 'scout': return <ScoutScreen />
      case 'manage': return <ManageScreen />
      case 'summary': return <SummaryScreen />
      case 'records': return <RecordsScreen />
      case 'squad': return <SquadAssignScreen />
      case 'selection': return <SelectionScreen />
      case 'intake': return <IntakeScreen />
      case 'camp': return <CampScreen />
      case 'new-captain': return <NewCaptainScreen />
      case 'comp-bracket': return <CareerBracket />
      case 'comp-match': return <CareerMatch />
      case 'comp-result': return <CompResult />
      default: return <CareerTitle />
    }
  })()
  // 成長結果モーダルは全画面でグローバル表示（週次練習＋公式戦の試合経験成長の両方）。
  return <>{body}{growthResult && <GrowthResult summary={growthResult} onClose={dismissGrowth} />}</>
}
