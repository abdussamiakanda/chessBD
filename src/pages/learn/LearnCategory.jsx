import { Link, useParams } from 'react-router-dom'
import { Container } from '../../components/ui/Container'
import { Card } from '../../components/ui/Card'
import { ArrowLeft, BookOpen, Puzzle, Layers, Crown, Target, Brain, Shield, AlertTriangle, Circle, Move, Zap, Crosshair, Flag, Network } from 'lucide-react'
import { useSEO } from '../../hooks/use-seo'
import { useLanguage } from '../../contexts/LanguageContext'
import { PawnIcon, RookIcon, KnightIcon, BishopIcon, QueenIcon, KingIcon } from '../../components/ui/ChessPieceIcons'
import './LearnCategory.css'

const categoryMap = {
  basics: { icon: BookOpen, key: 'basics' },
  tactics: { icon: Target, key: 'tactics' },
  openings: { icon: Layers, key: 'openings' },
  endgames: { icon: Crown, key: 'endgames' },
  strategy: { icon: Network, key: 'strategy' },
  analysis: { icon: Brain, key: 'analysis' },
}

export function LearnCategory({ category: categoryProp }) {
  const { category: categoryParam } = useParams()
  const category = categoryProp || categoryParam
  const { t } = useLanguage()
  
  const categoryInfo = category ? categoryMap[category] : null
  
  if (!categoryInfo || !category) {
    return (
      <Container>
        <div className="learn-category-page">
          <Card className="learn-category-not-found">
            <h1>{t('learn.categoryNotFound')}</h1>
            <Link to="/learn" className="learn-category-back-link">
              {t('learn.backToLearn')}
            </Link>
          </Card>
        </div>
      </Container>
    )
  }

  const Icon = categoryInfo.icon
  const categoryKey = categoryInfo.key
  
  useSEO({
    title: t(`learn.categories.${categoryKey}.title`),
    description: t(`learn.categories.${categoryKey}.description`),
    keywords: `chess learning, ${t(`learn.categories.${categoryKey}.title`)}, chess education, chess training`,
    url: category === 'analysis' ? `/analysis` : `/learn/${category}`,
  })

  return (
    <Container>
      <div className="learn-category-page">
        {/* Back Button */}
        <Link
          to="/learn"
          className="learn-category-back-button"
        >
          <ArrowLeft className="learn-category-back-icon" />
          <span>{t('learn.backToLearn')}</span>
        </Link>

        {/* Hero Section */}
        <section className="learn-category-hero">
          <div className="learn-category-hero-icon-wrapper">
            <Icon className="learn-category-hero-icon" />
          </div>
          <h1 className="learn-category-hero-title">
            {t(`learn.categories.${categoryKey}.title`)}
          </h1>
          <p className="learn-category-hero-description">
            {t(`learn.categories.${categoryKey}.description`)}
          </p>
        </section>

        {/* Content Section */}
        {categoryKey === 'basics' ? (
          <>
            {/* Board Setup */}
            <section className="learn-category-section">
              <Card className="learn-category-card">
                <div className="learn-category-card-content">
                  <div className="learn-category-section-header">
                    <div className="learn-category-section-icon-wrapper">
                      <Circle className="learn-category-section-icon" />
                    </div>
                    <div className="learn-category-section-text">
                      <p className="learn-category-section-label">{t('learn.categories.basics.boardSetup.subtitle')}</p>
                      <h2 className="learn-category-section-title">
                        {t('learn.categories.basics.boardSetup.title')}
                      </h2>
                    </div>
                  </div>
                  <p className="learn-category-section-description">
                    {t('learn.categories.basics.boardSetup.description')}
                  </p>
                </div>
              </Card>
            </section>

            {/* Chess Pieces */}
            <section className="learn-category-section">
              <div className="learn-category-section-intro">
                <p className="learn-category-section-label">{t('learn.categories.basics.pieces.subtitle')}</p>
                <h2 className="learn-category-section-title">
                  {t('learn.categories.basics.pieces.title')}
                </h2>
              </div>
              <div className="learn-category-grid learn-category-grid-2-3">
                {[
                  { key: 'pawn', Icon: PawnIcon },
                  { key: 'rook', Icon: RookIcon },
                  { key: 'knight', Icon: KnightIcon },
                  { key: 'bishop', Icon: BishopIcon },
                  { key: 'queen', Icon: QueenIcon },
                  { key: 'king', Icon: KingIcon },
                ].map((piece) => {
                  const PieceIcon = piece.Icon
                  return (
                    <Card key={piece.key} className="learn-category-item-card">
                      <div className="learn-category-item-card-content">
                        <div className="learn-category-item-header">
                          <div className="learn-category-item-icon-wrapper">
                            <PieceIcon className="learn-category-item-icon" />
                          </div>
                          <h3 className="learn-category-item-title">
                              {t(`learn.categories.basics.pieces.${piece.key}.title`)}
                          </h3>
                        </div>
                        <div className="learn-category-item-text">
                          <p className="learn-category-item-description">
                            {t(`learn.categories.basics.pieces.${piece.key}.description`)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>

            {/* Special Rules */}
            <section className="learn-category-section">
              <div className="learn-category-section-intro">
                <p className="learn-category-section-label">{t('learn.categories.basics.specialRules.subtitle')}</p>
                <h2 className="learn-category-section-title">
                  {t('learn.categories.basics.specialRules.title')}
                </h2>
              </div>
              <div className="learn-category-grid learn-category-grid-3">
                {[
                  { 
                    key: 'castling', 
                    icon: Shield, 
                    description: t('learn.categories.basics.specialRules.castling.description'),
                  },
                  { 
                    key: 'enPassant', 
                    icon: Move, 
                    description: t('learn.categories.basics.specialRules.enPassant.description'),
                  },
                  { 
                    key: 'promotion', 
                    icon: Crown, 
                    description: t('learn.categories.basics.specialRules.promotion.description'),
                  },
                ].map((rule) => {
                  const RuleIcon = rule.icon
                  return (
                    <Card key={rule.key} className="learn-category-item-card">
                      <div className="learn-category-item-card-content">
                        <div className="learn-category-item-center">
                          <div className="learn-category-item-icon-wrapper-large">
                            <RuleIcon className="learn-category-item-icon-large" />
                          </div>
                          <h3 className="learn-category-item-title-center">
                            {t(`learn.categories.basics.specialRules.${rule.key}.title`)}
                          </h3>
                          <p className="learn-category-item-description-center">
                            {rule.description}
                          </p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>

            {/* Check, Checkmate & Stalemate */}
            <section className="learn-category-section">
              <div className="learn-category-section-intro">
                <p className="learn-category-section-label">{t('learn.categories.basics.checkAndMate.subtitle')}</p>
                <h2 className="learn-category-section-title">
                  {t('learn.categories.basics.checkAndMate.title')}
                </h2>
              </div>
              <div className="learn-category-grid learn-category-grid-3">
                {[
                  { 
                    key: 'check', 
                    icon: AlertTriangle, 
                    description: t('learn.categories.basics.checkAndMate.check.description')
                  },
                  { 
                    key: 'checkmate', 
                    icon: Crown, 
                    description: t('learn.categories.basics.checkAndMate.checkmate.description')
                  },
                  { 
                    key: 'stalemate', 
                    icon: Circle, 
                    description: t('learn.categories.basics.checkAndMate.stalemate.description')
                  },
                ].map((term) => {
                  const TermIcon = term.icon
                  return (
                    <Card key={term.key} className="learn-category-item-card">
                      <div className="learn-category-item-card-content">
                        <div className="learn-category-item-center">
                          <div className="learn-category-item-icon-wrapper-large">
                            <TermIcon className="learn-category-item-icon-large" />
                          </div>
                          <h3 className="learn-category-item-title-center">
                            {t(`learn.categories.basics.checkAndMate.${term.key}.title`)}
                          </h3>
                          <p className="learn-category-item-description-center">
                            {term.description}
                          </p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>

            {/* Draw Conditions */}
            <section className="learn-category-section">
              <div className="learn-category-section-intro">
                <p className="learn-category-section-label">{t('learn.categories.basics.drawConditions.subtitle')}</p>
                <h2 className="learn-category-section-title">
                  {t('learn.categories.basics.drawConditions.title')}
                </h2>
              </div>
              <Card className="learn-category-card">
                <div className="learn-category-card-content">
                  <div className="learn-category-list">
                    <div className="learn-category-list-item">
                      <div className="learn-category-list-dot"></div>
                      <p>{t('learn.categories.basics.drawConditions.insufficientMaterial')}</p>
                    </div>
                    <div className="learn-category-list-item">
                      <div className="learn-category-list-dot"></div>
                      <p>{t('learn.categories.basics.drawConditions.threefoldRepetition')}</p>
                    </div>
                    <div className="learn-category-list-item">
                      <div className="learn-category-list-dot"></div>
                      <p>{t('learn.categories.basics.drawConditions.fiftyMoveRule')}</p>
                    </div>
                    <div className="learn-category-list-item">
                      <div className="learn-category-list-dot"></div>
                      <p>{t('learn.categories.basics.drawConditions.stalemate')}</p>
                    </div>
                    <div className="learn-category-list-item">
                      <div className="learn-category-list-dot"></div>
                      <p>{t('learn.categories.basics.drawConditions.agreement')}</p>
                    </div>
                  </div>
                </div>
              </Card>
            </section>

            {/* Basic Principles */}
            <section className="learn-category-section">
              <div className="learn-category-section-intro">
                <p className="learn-category-section-label">{t('learn.categories.basics.basicPrinciples.subtitle')}</p>
                <h2 className="learn-category-section-title">
                  {t('learn.categories.basics.basicPrinciples.title')}
                </h2>
              </div>
              <div className="learn-category-grid learn-category-grid-2-3">
                {[
                  { key: 'controlCenter', icon: Target },
                  { key: 'developPieces', icon: Move },
                  { key: 'castleEarly', icon: Shield },
                  { key: 'dontMoveQueenEarly', icon: Crown },
                  { key: 'dontMovePawns', icon: Circle },
                ].map((principle) => {
                  const PrincipleIcon = principle.icon
                  return (
                    <Card key={principle.key} className="learn-category-item-card">
                      <div className="learn-category-item-card-content">
                        <div className="learn-category-item-header">
                          <div className="learn-category-item-icon-wrapper">
                            <PrincipleIcon className="learn-category-item-icon" />
                          </div>
                          <h3 className="learn-category-item-title">
                            {t(`learn.categories.basics.basicPrinciples.${principle.key}.title`)}
                          </h3>
                        </div>
                        <div className="learn-category-item-text">
                          <p className="learn-category-item-description">
                            {t(`learn.categories.basics.basicPrinciples.${principle.key}.description`)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          </>
        ) : categoryKey === 'tactics' ? (
          <>
            {/* Common Tactical Patterns */}
            <section className="learn-category-section">
              <div className="learn-category-section-intro">
                <p className="learn-category-section-label">{t('learn.categories.tactics.commonTactics.subtitle')}</p>
                <h2 className="learn-category-section-title">
                  {t('learn.categories.tactics.commonTactics.title')}
                </h2>
                <p className="learn-category-section-description">
                  {t('learn.categories.tactics.commonTactics.description')}
                </p>
              </div>
              <div className="learn-category-grid learn-category-grid-2-3">
                {[
                  { key: 'fork', icon: Zap },
                  { key: 'pin', icon: Crosshair },
                  { key: 'skewer', icon: Move },
                  { key: 'discoveredAttack', icon: Puzzle },
                  { key: 'deflection', icon: Target },
                  { key: 'decoy', icon: Circle },
                ].map((tactic) => {
                  const TacticIcon = tactic.icon
                  return (
                    <Card key={tactic.key} className="learn-category-item-card">
                      <div className="learn-category-item-card-content">
                        <div className="learn-category-item-header">
                          <div className="learn-category-item-icon-wrapper">
                            <TacticIcon className="learn-category-item-icon" />
                          </div>
                          <h3 className="learn-category-item-title">
                            {t(`learn.categories.tactics.${tactic.key}.title`)}
                          </h3>
                        </div>
                        <div className="learn-category-item-text">
                          <p className="learn-category-item-description">
                            {t(`learn.categories.tactics.${tactic.key}.description`)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          </>
        ) : categoryKey === 'openings' ? (
          <>
            {/* Opening Principles */}
            <section className="learn-category-section">
              <div className="learn-category-section-intro">
                <p className="learn-category-section-label">{t('learn.categories.openings.openingPrinciples.subtitle')}</p>
                <h2 className="learn-category-section-title">
                  {t('learn.categories.openings.openingPrinciples.title')}
                </h2>
                <p className="learn-category-section-description">
                  {t('learn.categories.openings.openingPrinciples.description')}
                </p>
              </div>
              <div className="learn-category-grid learn-category-grid-3">
                {[
                  { key: 'controlCenter', icon: Target },
                  { key: 'developPieces', icon: Move },
                  { key: 'castleEarly', icon: Shield },
                ].map((principle) => {
                  const PrincipleIcon = principle.icon
                  return (
                    <Card key={principle.key} className="learn-category-item-card">
                      <div className="learn-category-item-card-content">
                        <div className="learn-category-item-header">
                          <div className="learn-category-item-icon-wrapper">
                            <PrincipleIcon className="learn-category-item-icon" />
                          </div>
                          <h3 className="learn-category-item-title">
                            {t(`learn.categories.openings.${principle.key}.title`)}
                          </h3>
                        </div>
                        <div className="learn-category-item-text">
                          <p className="learn-category-item-description">
                            {t(`learn.categories.openings.${principle.key}.description`)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>

            {/* Popular Openings */}
            <section className="learn-category-section">
              <div className="learn-category-section-intro">
                <p className="learn-category-section-label">{t('learn.categories.openings.popularOpenings.subtitle')}</p>
                <h2 className="learn-category-section-title">
                  {t('learn.categories.openings.popularOpenings.title')}
                </h2>
                <p className="learn-category-section-description">
                  {t('learn.categories.openings.popularOpenings.description')}
                </p>
              </div>
              <div className="learn-category-grid learn-category-grid-3">
                {[
                  { key: 'italianGame', icon: BookOpen },
                  { key: 'sicilianDefense', icon: Layers },
                  { key: 'queensGambit', icon: Crown },
                ].map((opening) => {
                  const OpeningIcon = opening.icon
                  return (
                    <Card key={opening.key} className="learn-category-item-card">
                      <div className="learn-category-item-card-content">
                        <div className="learn-category-item-center">
                          <div className="learn-category-item-icon-wrapper-large">
                            <OpeningIcon className="learn-category-item-icon-large" />
                          </div>
                          <h3 className="learn-category-item-title-center">
                            {t(`learn.categories.openings.${opening.key}.title`)}
                          </h3>
                          <p className="learn-category-item-description-center">
                            {t(`learn.categories.openings.${opening.key}.description`)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          </>
        ) : categoryKey === 'endgames' ? (
          <>
            {/* Basic Endgames */}
            <section className="learn-category-section">
              <div className="learn-category-section-intro">
                <p className="learn-category-section-label">{t('learn.categories.endgames.basicEndgames.subtitle')}</p>
                <h2 className="learn-category-section-title">
                  {t('learn.categories.endgames.basicEndgames.title')}
                </h2>
                <p className="learn-category-section-description">
                  {t('learn.categories.endgames.basicEndgames.description')}
                </p>
              </div>
              <div className="learn-category-grid learn-category-grid-3">
                {[
                  { key: 'kingAndPawn', icon: PawnIcon },
                  { key: 'rookEndgames', icon: RookIcon },
                  { key: 'queenEndgames', icon: QueenIcon },
                ].map((endgame) => {
                  const EndgameIcon = endgame.icon
                  return (
                    <Card key={endgame.key} className="learn-category-item-card">
                      <div className="learn-category-item-card-content">
                        <div className="learn-category-item-center">
                          <div className="learn-category-item-icon-wrapper-large">
                            <EndgameIcon className="learn-category-item-icon-large" />
                          </div>
                          <h3 className="learn-category-item-title-center">
                            {t(`learn.categories.endgames.${endgame.key}.title`)}
                          </h3>
                          <p className="learn-category-item-description-center">
                            {t(`learn.categories.endgames.${endgame.key}.description`)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>

            {/* Checkmating Patterns */}
            <section className="learn-category-section">
              <div className="learn-category-section-intro">
                <p className="learn-category-section-label">{t('learn.categories.endgames.checkmatingPatterns.subtitle')}</p>
                <h2 className="learn-category-section-title">
                  {t('learn.categories.endgames.checkmatingPatterns.title')}
                </h2>
                <p className="learn-category-section-description">
                  {t('learn.categories.endgames.checkmatingPatterns.description')}
                </p>
              </div>
              <div className="learn-category-grid learn-category-grid-2">
                {[
                  { key: 'backRankMate', icon: AlertTriangle },
                  { key: 'smotheredMate', icon: KnightIcon },
                ].map((pattern) => {
                  const PatternIcon = pattern.icon
                  return (
                    <Card key={pattern.key} className="learn-category-item-card">
                      <div className="learn-category-item-card-content">
                        <div className="learn-category-item-center">
                          <div className="learn-category-item-icon-wrapper-large">
                            {pattern.icon === KnightIcon ? (
                              <KnightIcon className="learn-category-item-icon-large" />
                            ) : (
                              <PatternIcon className="learn-category-item-icon-large" />
                            )}
                          </div>
                          <h3 className="learn-category-item-title-center">
                            {t(`learn.categories.endgames.${pattern.key}.title`)}
                          </h3>
                          <p className="learn-category-item-description-center">
                            {t(`learn.categories.endgames.${pattern.key}.description`)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          </>
        ) : categoryKey === 'strategy' ? (
          <>
            {/* Positional Concepts */}
            <section className="learn-category-section">
              <div className="learn-category-section-intro">
                <p className="learn-category-section-label">{t('learn.categories.strategy.positionalConcepts.subtitle')}</p>
                <h2 className="learn-category-section-title">
                  {t('learn.categories.strategy.positionalConcepts.title')}
                </h2>
                <p className="learn-category-section-description">
                  {t('learn.categories.strategy.positionalConcepts.description')}
                </p>
              </div>
              <div className="learn-category-grid learn-category-grid-2-3">
                {[
                  { key: 'pawnStructure', icon: Layers },
                  { key: 'weakSquares', icon: Target },
                  { key: 'pieceActivity', icon: Move },
                  { key: 'spaceAdvantage', icon: Circle },
                  { key: 'pawnMajority', icon: PawnIcon },
                ].map((concept) => {
                  const ConceptIcon = concept.icon
                  return (
                    <Card key={concept.key} className="learn-category-item-card">
                      <div className="learn-category-item-card-content">
                        <div className="learn-category-item-header">
                          <div className="learn-category-item-icon-wrapper">
                            {concept.icon === PawnIcon ? (
                              <PawnIcon className="learn-category-item-icon" />
                            ) : (
                              <ConceptIcon className="learn-category-item-icon" />
                            )}
                          </div>
                          <h3 className="learn-category-item-title">
                            {t(`learn.categories.strategy.${concept.key}.title`)}
                          </h3>
                        </div>
                        <div className="learn-category-item-text">
                          <p className="learn-category-item-description">
                            {t(`learn.categories.strategy.${concept.key}.description`)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          </>
        ) : (
          <section className="learn-category-section">
            <Card className="learn-category-coming-soon">
              <div className="learn-category-coming-soon-content">
                <div className="learn-category-coming-soon-icon-wrapper">
                  <Icon className="learn-category-coming-soon-icon" />
                </div>
                <div>
                  <p className="learn-category-coming-soon-label">{t('learn.comingSoonSubtitle')}</p>
                  <h2 className="learn-category-coming-soon-title">
                    {t('learn.comingSoon')}
                  </h2>
                </div>
                <p className="learn-category-coming-soon-text">
                  {t('learn.stayTuned')}
                </p>
              </div>
            </Card>
          </section>
        )}
      </div>
    </Container>
  )
}
