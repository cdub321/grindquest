import Icon from './Icon';
import { build_item_tooltip } from '../utils/itemUtils';
import { get_slot_labels } from '../utils/slotUtils';

const BAR_W = 66;
const BAR_H = 20;
const BAR_SCALE_X = 2.9;
const BAR_SCALE_Y = 1.4;
const BAR_LINE_SCALE_Y = BAR_SCALE_Y; // keep line same height as bar
const BAR_LINE_OFFSET_Y = -3;
const BAR_LINE_OFFSET_X = -5; // nudge left for xp line start
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
  player_class,
  level,
  character_name,
  hp,
  max_hp,
  mana,
  max_mana,
  endurance,
  max_endurance,
  xp,
  xp_needed,
  in_combat,
  is_meditating,
  hp_regen_rate = 0,
  mana_regen_rate = 0,
  endurance_regen_rate = 0,
  flee_exhausted = false,
  damage_range = { min: 0, max: 0 },
  gear_bonuses = {},
  inventory_length = 0,
  attack_delay = 0,
  derived_stats = {},
  stat_totals = {},
  inventory_preview = [],
  on_inspect_item = () => {},
  on_slot_click = () => {},
  on_slot_right_click = () => {},
  on_inventory_open = () => {},
  selected_slot = null,
  race_name = '',
  deity_name = '',
  currency,
  effects = [],
  resource_type = 'melee'
}) {
  const bonuses = gear_bonuses || {};
  const stats = stat_totals || {};
  const derived = derived_stats || {};


  const renderAttrRow = (label, value) => (
    <div className="stone-attr__row">
      <span className="stone-attr__label">{label}</span>
      <span className="stone-attr__value">{value}</span>
    </div>
  );

  const combinedStatsLines = [
    { text: `Damage: ${damage_range?.min || 0}-${damage_range?.max || 0}${bonuses.damage ? ` (+${bonuses.damage} gear)` : ''}` },
    { text: `Delay: ${attack_delay}ms${bonuses.haste ? ` (haste ${bonuses.haste}%)` : ''}` },
    { text: `STR ${stats.str || 0} || STA ${stats.sta || 0}` },
    { text: `AGI ${stats.agi || 0} || DEX ${stats.dex || 0}` },
    { text: `INT ${stats.int || 0} || WIS ${stats.wis || 0}` },
    { text: `CHA ${stats.cha || 0} || AC ${stats.ac || 0}` },
    { text: `MR ${stats.mr || 0} ||  FR ${stats.fr || 0}`, className: 'stone-attr__value--resists' },
    { text: `CR ${stats.cr || 0} || PR ${stats.pr || 0}` },
    { text: `DR ${stats.dr || 0} || Tot ${(stats.mr || 0) + (stats.fr || 0) + (stats.cr || 0) + (stats.pr || 0) + (stats.dr || 0)}`, className: 'stone-attr__value--resistsbot' },
    { text: `Spell Dmg +${derived.spell_dmg_mod || 0}%` },
    { text: `Heal Mod +${derived.heal_mod || 0}%` }
  ];


  const handleInventoryClick = () => {
    if (on_inventory_open) {
      on_inventory_open();
    }
  };

  // Get slot labels from utility (derived from slotOrder)
  const slotLabels = get_slot_labels();

  return (
    <div className="stone-card">
      <div className="stone-card__body stone-card__body--compact">
        <div className="stone-stats-wrapper">
          <div className="stone-stats-header stone-attr__row stone-attr__row--stacked">
            <div className="stone-card__name">{character_name}</div>
            <div className="stone-card__meta">{race_name} | {player_class.name}</div>
            <div className="stone-card__meta">Lvl {level}{deity_name ? ` | ${deity_name}` : ''}</div>
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
            <div className="stone-button-row">
            <button className="stone-button" onClick={handleInventoryClick}>
              Bags
            </button>
          </div>
          </div>

          

          <div className="stone-stats">
            <div className="stone-block">
              <div
                className="stone-row stone-row--tight"
                style={{ justifyContent: 'space-between', textAlign: 'left' }}
              >
                <span className="stone-label hp" style={{ color: '#b22222', fontSize: '16px' }}>HP {in_combat && '⚔️'}</span>
                  <span className="stone-value" style={{ color: '#b22222', position: 'relative', top: '-3px', fontSize: '16px' }}>
                    {hp} / {max_hp}
                    <span className={`stone-regen${flee_exhausted ? ' stone-regen--debuff' : ''}`}>+{hp_regen_rate}</span>
                  </span>
                </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-12px' }}>
                <StoneBar type="hp" value={hp} max={max_hp} />
              </div>
            </div>

            {(resource_type === 'caster' || resource_type === 'hybrid') && (
              <div className="stone-block">
                <div
                  className="stone-row stone-row--tight"
                  style={{ justifyContent: 'space-between', textAlign: 'left', gap: '6px' }}
                >
                  <span className="stone-label mana" style={{ color: '#2b6cb0', fontSize: '16px' }}>Mana {is_meditating && '🪑'}</span>
                  <span className="stone-value" style={{ color: '#2b6cb0', position: 'relative', top: '-3px', fontSize: '16px' }}>
                    {mana} / {max_mana}
                    <span className={`stone-regen${flee_exhausted ? ' stone-regen--debuff' : ''}`}>+{mana_regen_rate}</span>
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-12px' }}>
                  <StoneBar type="mana" value={mana} max={max_mana} />
                </div>
              </div>
            )}
            {(resource_type === 'melee' || resource_type === 'hybrid') && (
              <div className="stone-block">
                <div
                  className="stone-row stone-row--tight"
                  style={{ justifyContent: 'space-between', textAlign: 'left', gap: '6px' }}
                >
                  <span className="stone-label" style={{ color: '#f4f260ff', fontSize: '16px' }}>End.</span>
                  <span className="stone-value" style={{ color: '#f4f260ff', position: 'relative', top: '-3px', fontSize: '16px' }}>
                    {endurance} / {max_endurance}
                    <span className={`stone-regen${flee_exhausted ? ' stone-regen--debuff' : ''}`}>+{endurance_regen_rate}</span>
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-12px' }}>
                  <StoneBar type="endurance" value={endurance} max={max_endurance} />
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
                  {xp} / {xp_needed}
                  <span className="stone-regen">+{(derived_stats.xpBonus || 0)}%</span>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-12px' }}>
                <StoneBar type="xp" value={xp} max={xp_needed} />
              </div>
            </div>

          <div className="stone-inventory">
            <div className="stone-inventory__title">Carry Capacity: {derived.carry_cap || 0}</div>
            <div className="stone-inventory-grid">
              {Array.from({ length: slotLabels.length }).map((_, idx) => {
                const item = inventory_preview[idx];
                const label = slotLabels[idx] || `${idx + 1}`;
                const isSelected = selected_slot === idx;
                return (
                  <div
                    key={idx}
                    className={`stone-slot ${isSelected ? 'stone-slot--selected' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.shiftKey && item) {
                        on_inspect_item(item);
                      } else {
                        on_slot_click(idx);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (item && item.stackable && item.quantity > 1) {
                        on_slot_right_click(idx);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {item ? (
                      <div
                        className="stone-slot__item"
                        role="button"
                        tabIndex={0}
                        title={build_item_tooltip(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            on_slot_click(idx);
                          }
                        }}
                      >
                        <div className="stone-slot__icon-wrap">
                          {typeof item.icon_index === 'number' ? (
                            <Icon index={item.icon_index} size={32} cols={6} sheet="/stone-ui/itemicons/items1.png" />
                          ) : (
                            <div className="stone-slot__icon-fallback" />
                          )}
                          {item.bag_slots && item.contents ? (
                            <span className="stone-slot__qty">
                              x{item.contents.filter(c => c).length}/{item.bag_slots}
                            </span>
                          ) : item.quantity > 1 ? (
                            <span className="stone-slot__qty">x{item.quantity}</span>
                          ) : null}
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
          <div className="stone-money">
            <div className="stone-row">
              <span className="stone-label">Plat</span>
              <span className="stone-value plat">{currency.platinum}</span>

              <span className="stone-label gold">Gold</span>
              <span className="stone-value gold">{currency.gold}</span>

              <span className="stone-label silver">Silver</span>
              <span className="stone-value silver">{currency.silver}</span>
            </div>

            </div>
          </div>
          </div>
        </div>

        
      </div>
    </div>
  );
}
