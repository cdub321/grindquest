import EqIcon from './EqIcon';

const BAR_W = 66;
const BAR_H = 20;
const BAR_SCALE_X = 2.9;
const BAR_SCALE_Y = 1.4;
const BAR_LINE_SCALE_Y = BAR_SCALE_Y; // keep line same height as bar
const BAR_LINE_OFFSET_Y = 0;
const BAR_LINE_OFFSET_X = -20; // nudge left for xp line start
const SHEET = '/stone-ui/ui/classicwind1.png';

// Rough cut positions from the sheet; we can dial these once visible.
const BAR_SPRITES = {
  hpBase: { x: 9, y: 199 },
  hp: { x: 9, y: 234 },
  manaBase: { x: 9, y: 199 },
  mana: { x: 76, y: 199 },
  enduranceBase: { x: 9, y: 199 },
  endurance: { x: 76, y: 234 },
  xpBase: { x: 9, y: 199 },
  xp: { x: 76, y: 222 },
  xpLine: { x: 9, y: 220 } // blue segment overlay
};

function StoneBar({ type = 'hp', value = 0, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const baseKey = `${type}Base`;
  const base = BAR_SPRITES[baseKey] || BAR_SPRITES.hpBase;
  const fill = BAR_SPRITES[type] || BAR_SPRITES.hp;
  const line = BAR_SPRITES[`${type}Line`] || BAR_SPRITES.xpLine;
  const cropY = 0.25; // cut top/bottom to trim chrome
  const nudgeY = -4; // pixel nudge upward
  const cropHeight = BAR_H * (1 - cropY * 2);

  if (type === 'xp') {
    const bubbles = 5;
    const total = Math.min(1, pct);
    const bubbleProgress = total * bubbles;
    const filledBubbles = Math.floor(bubbleProgress);
    const remainder = bubbleProgress - filledBubbles;
    const baseWidth = (filledBubbles / bubbles) * BAR_W;
    const orangeWidth = baseWidth + (remainder / bubbles) * BAR_W;
    const blueWidth = remainder * BAR_W;

    return (
      <div
        className="stone-bar-sprite"
        style={{
          width: `${BAR_W * BAR_SCALE_X}px`,
          height: `${cropHeight * BAR_SCALE_Y}px`,
          overflow: 'hidden'
        }}
      >
        <div
          className="stone-bar-sprite__layer"
          style={{
            width: `${BAR_W}px`,
            height: `${BAR_H}px`,
            transform: `translateY(${nudgeY - BAR_H * cropY}px) scale(${BAR_SCALE_X}, ${BAR_SCALE_Y})`,
            backgroundImage: `url(${SHEET})`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: `${-base.x}px ${-base.y}px`
          }}
        />
        <div
          className="stone-bar-sprite__layer"
          style={{
            width: `${orangeWidth}px`,
            height: `${BAR_H}px`,
            transform: `translateY(${nudgeY - BAR_H * cropY}px) scale(${BAR_SCALE_X}, ${BAR_SCALE_Y})`,
            backgroundImage: `url(${SHEET})`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: `${-fill.x}px ${-fill.y}px`
          }}
        />
        <div
          className="stone-bar-sprite__layer"
          style={{
            width: `${blueWidth}px`,
            height: `${BAR_H}px`,
            // Start the blue line at the beginning of the bar every time (no bubble offset).
            transform: `translate(${BAR_LINE_OFFSET_X}px, ${nudgeY - BAR_H * cropY + BAR_LINE_OFFSET_Y}px) scale(${BAR_SCALE_X}, ${BAR_LINE_SCALE_Y})`,
            backgroundImage: `url(${SHEET})`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: `${-line.x}px ${-line.y}px`
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="stone-bar-sprite"
      style={{
        width: `${BAR_W * BAR_SCALE_X}px`,
        height: `${cropHeight * BAR_SCALE_Y}px`,
        overflow: 'hidden'
      }}
    >
      <div
        className="stone-bar-sprite__layer"
        style={{
          width: `${BAR_W}px`,
          height: `${BAR_H}px`,
          transform: `translateY(${nudgeY - BAR_H * cropY}px) scale(${BAR_SCALE_X}, ${BAR_SCALE_Y})`,
          backgroundImage: `url(${SHEET})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `${-base.x}px ${-base.y}px`
        }}
      />
      <div
        className="stone-bar-sprite__layer"
        style={{
          width: `${BAR_W * pct}px`,
          height: `${BAR_H}px`,
          transform: `translateY(${nudgeY - BAR_H * cropY}px) scale(${BAR_SCALE_X}, ${BAR_SCALE_Y})`,
          backgroundImage: `url(${SHEET})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `${-fill.x}px ${-fill.y}px`
        }}
      />
    </div>
  );
}

export default function CharacterPanel({
  playerClass,
  level,
  characterName,
  hp,
  maxHp,
  mana,
  maxMana,
  endurance,
  maxEndurance,
  xp,
  xpNeeded,
  inCombat,
  isMeditating,
  hpRegenRate = 0,
  manaRegenRate = 0,
  enduranceRegenRate = 0,
  fleeExhausted = false,
  damageRange = { min: 0, max: 0 },
  gearBonuses = {},
  inventoryLength = 0,
  attackDelay = 0,
  derivedStats = {},
  inventoryPreview = [],
  onInspectItem = () => {},
  raceName = '',
  deityName = '',
  currency,
  effects = []
}) {
  const bonuses = gearBonuses || {};
  const stats = derivedStats || {};

  const buildItemTooltip = (item) => {
    if (!item) return '';
    const lines = [];
    if (item.name) lines.push(item.name);
    if (item.slot) lines.push(`Slot: ${item.slot}`);
    if (item.quantity > 1) lines.push(`Qty: ${item.quantity}`);
    if (item.bonuses) {
      const bonusParts = Object.entries(item.bonuses)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k.toUpperCase()}: ${v}`);
      if (bonusParts.length) lines.push(bonusParts.join('  '));
    }
    return lines.join('\n');
  };

  const renderAttrRow = (label, value) => (
    <div className="stone-attr__row">
      <span className="stone-attr__label">{label}</span>
      <span className="stone-attr__value">{value}</span>
    </div>
  );

  const combinedStatsLines = [
    { text: `Damage: ${damageRange?.min ?? 0}-${damageRange?.max ?? 0}${bonuses.damage ? ` (+${bonuses.damage} gear)` : ''}` },
    { text: `Delay: ${attackDelay}ms${bonuses.haste ? ` (haste ${bonuses.haste}%)` : ''}` },
    { text: `STR ${bonuses.str || 0} || STA ${bonuses.sta || 0}` },
    { text: `AGI ${bonuses.agi || 0} || DEX ${bonuses.dex || 0}` },
    { text: `INT ${bonuses.int || 0} || WIS ${bonuses.wis || 0}` },
    { text: `CHA ${bonuses.cha || 0} || AC ${bonuses.ac || 0}` },
    { text: `MR ${bonuses.mr || 0} ||  FR ${bonuses.fr || 0}`, className: 'stone-attr__value--resists' },
    { text: `CR ${bonuses.cr || 0} || PR ${bonuses.pr || 0}` },
    { text: `DR ${bonuses.dr || 0} || Tot ${bonuses.totalResist || 0}`, className: 'stone-attr__value--resistsbot' },
    { text: `Spell Dmg +${stats.spellDmgMod || 0}%` },
    { text: `Heal Mod +${stats.healMod || 0}%` }
  ];

  const slotLabels = [
    'Head',
    'Face',
    'Ear 1',
    'Ear 2',
    'Neck',
    'Shoul.',
    'Arms',
    'Wr1st',
    'Wrist',
    'Hands',
    'Chest',
    'Back',
    'Waist',
    'Legs',
    'Feet',
    'F1nger',
    'Finger',
    'Pri',
    'Sec',
    'Range',
    'Ammo',
    'Charm',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8'
  ];

  return (
    <div className="stone-card">
      <div className="stone-card__body stone-card__body--compact">
        <div className="stone-stats-wrapper">
          <div className="stone-stats-header stone-attr__row stone-attr__row--stacked">
            <div className="stone-card__name">{characterName}</div>
            <div className="stone-card__meta">{raceName} | {playerClass.name}</div>
            <div className="stone-card__meta">Lvl {level}{deityName ? ` | ${deityName}` : ''}</div>
          </div>

          <div className="stone-attr">
            <div className="stone-attr__row stone-attr__row--stacked">
              <div className="stone-attr__stack">
                {combinedStatsLines.map((line, i) => (
                  <span
                    key={i}
                    className={`stone-attr__value stone-attr__value--line ${line.className || ''}`}
                  >
                    {line.text}
                  </span>
                ))}
              </div>
            </div>
            {renderAttrRow('Items Found', inventoryLength)}
          </div>

          <div className="stone-stats">
            <div className="stone-block">
              <div
                className="stone-row stone-row--tight"
                style={{ justifyContent: 'space-between', textAlign: 'left' }}
              >
                <span className="stone-label hp" style={{ color: '#b22222', fontSize: '16px' }}>HP {inCombat && '⚔️'}</span>
                  <span className="stone-value" style={{ color: '#b22222', position: 'relative', top: '-3px', fontSize: '16px' }}>
                    {hp} / {maxHp}
                    <span className={`stone-regen${fleeExhausted ? ' stone-regen--debuff' : ''}`}>+{hpRegenRate}</span>
                  </span>
                </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-12px' }}>
                <StoneBar type="hp" value={hp} max={maxHp} />
              </div>
            </div>

            {playerClass.isCaster && (
              <div className="stone-block">
                <div
                  className="stone-row stone-row--tight"
                  style={{ justifyContent: 'space-between', textAlign: 'left', gap: '6px' }}
                >
                  <span className="stone-label mana" style={{ color: '#2b6cb0', fontSize: '16px' }}>Mana {isMeditating && '🪑'}</span>
                  <span className="stone-value" style={{ color: '#2b6cb0', position: 'relative', top: '-3px', fontSize: '16px' }}>
                    {mana} / {maxMana}
                    <span className={`stone-regen${fleeExhausted ? ' stone-regen--debuff' : ''}`}>+{manaRegenRate}</span>
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-12px' }}>
                  <StoneBar type="mana" value={mana} max={maxMana} />
                </div>
              </div>
            )}
            {!playerClass.isCaster && (
              <div className="stone-block">
                <div
                  className="stone-row stone-row--tight"
                  style={{ justifyContent: 'space-between', textAlign: 'left', gap: '6px' }}
                >
                  <span className="stone-label" style={{ color: '#f4f260ff', fontSize: '16px' }}>End.</span>
                  <span className="stone-value" style={{ color: '#f4f260ff', position: 'relative', top: '-3px', fontSize: '16px' }}>
                    {endurance} / {maxEndurance}
                    <span className={`stone-regen${fleeExhausted ? ' stone-regen--debuff' : ''}`}>+{enduranceRegenRate}</span>
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-12px' }}>
                  <StoneBar type="endurance" value={endurance} max={maxEndurance} />
                </div>
              </div>
            )}

              <div className="stone-block">
                <div
                  className="stone-row stone-row--tight"
                  style={{ justifyContent: 'space-between', textAlign: 'left', gap: '6px' }}
                >
                  <span className="stone-label xp" style={{ color: '#d4af37', fontSize: '16px' }}>XP</span>
                <span className="stone-value" style={{ color: '#d4af37', position: 'relative', top: '-3px', fontSize: '16px' }}>
                  {xp} / {xpNeeded}
                  <span className="stone-regen">+{(derivedStats.xpBonus || 0)}%</span>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-12px' }}>
                <StoneBar type="xp" value={xp} max={xpNeeded} />
              </div>
            </div>

          <div className="stone-inventory">
            <div className="stone-inventory__title">Carry Capacity: {stats.carryCap || 0}</div>
            <div className="stone-inventory-grid">
              {Array.from({ length: slotLabels.length }).map((_, idx) => {
                const item = inventoryPreview[idx];
                const label = slotLabels[idx] || `${idx + 1}`;
                return (
                  <div key={idx} className="stone-slot">
                    {item ? (
                      <div
                        className="stone-slot__item"
                        role="button"
                        tabIndex={0}
                        title={buildItemTooltip(item)}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onInspectItem(item);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            onInspectItem(item);
                          }
                        }}
                      >
                        <div className="stone-slot__icon-wrap">
                          {typeof item.iconIndex === 'number' ? (
                            <EqIcon index={item.iconIndex} size={32} cols={6} sheet="/stone-ui/itemicons/items1.png" />
                          ) : (
                            <div className="stone-slot__icon-fallback" />
                          )}
                          {item.quantity > 1 && (
                            <span className="stone-slot__qty">x{item.quantity}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="stone-slot__ghost">{label}</span>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
            <div className="stone-row stone-row--effects">
          <div className="stone-effects">
            <div className="stone-effects__icons">
              {effects.length === 0 && <span className="stone-effects__empty">No effects</span>}
              {effects.map((fx) => (
                <div key={fx.id || fx.name} className="stone-effect">
                  <EqIcon index={fx.iconIndex || fx.icon || 0} size={22} />
                  <span className="stone-effect__name">{fx.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="stone-money">
            <div className="stone-row">
              <span className="stone-label">Plat</span>
              <span className="stone-value plat">{currency.platinum}</span>
            </div>
            <div className="stone-row">
              <span className="stone-label gold">Gold</span>
              <span className="stone-value gold">{currency.gold}</span>
            </div>
            <div className="stone-row">
              <span className="stone-label silver">Silver</span>
              <span className="stone-value silver">{currency.silver}</span>
            </div>
            <div className="stone-row">
              <span className="stone-label copper">Copper</span>
              <span className="stone-value copper">{currency.copper}</span>
            </div>
          </div>
        </div>
          </div>
        </div>

        
      </div>
    </div>
  );
}
