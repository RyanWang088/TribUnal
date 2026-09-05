import { useCase } from '../context/CaseContext.jsx'

export default function SuperBadge() {
  const { isSuper } = useCase()
  return isSuper ? <span className="super-badge">SUPER</span> : null
}
