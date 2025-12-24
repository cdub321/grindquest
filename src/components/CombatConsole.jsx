import { useEffect, useRef, useState } from 'react';
import EqIcon from './EqIcon';

export default function CombatConsole({
  currentMob,
  mobHp,
  toggleAutoAttack,
  isAutoAttack,
  abilitySlots = [],
  spellSlots = [],
  knownAbilities = [],
  knownSpells = [],
  level = 1,
  characterName = '',
  hp,
  maxHp,
  mana,
  maxMana,
  endurance,
  maxEndurance,
  playerClass,
  onAssignAbility = () => {},
  onAssignSpell = () => {},
  onClearAbility = () => {},
  onClearSpell = () => {},
  onUseSkill,
  cooldowns = {},
  now = Date.now(),
  combatLog = [],
  inCombat = false,
  castingState = null,
  effects = [],
  isSitting = false
}) {
  const logRef = useRef(null);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [combatLog]);

  const handleAbilityChange = (slotIdx, val) => {
    if (!val) {
      onClearAbility(slotIdx);
      return;
    }
    onAssignAbility(slotIdx, val);
  };

  const handleSpellChange = (slotIdx, val) => {
    if (!val) {
      onClearSpell(slotIdx);
      return;
    }
    onAssignSpell(slotIdx, val);
  };

  const renderConfigRow = (slotIdx, skill, options, onChange, onClear, isSpell = false) => {
    const until = skill ? (cooldowns[skill.id] || 0) : 0;
    const remaining = until > now ? Math.ceil((until - now) / 1000) : 0;
    const isReady = remaining === 0;
    return (
      <div
        key={`slot-${isSpell ? 'spell' : 'ability'}-${slotIdx}`}
        style={{
          display: 'grid',
          gridTemplateColumns: '44px 28px 1fr auto auto',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 6px',
          marginBottom: '2px',
          background: 'rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '6px'
        }}
        >
          <div style={{ fontSize: '11px', color: '#d6c18a' }}>{isSpell ? 'Spell' : 'Skill'} {slotIdx}</div>
          <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {skill && typeof (skill.iconIndex ?? skill.icon) === 'number' ? (
            <EqIcon index={skill.iconIndex ?? skill.icon} size={24} cols={6} sheet="/stone-ui/spellicons/spells1.png" />
          ) : null}
          </div>
        <select
          value={skill?.id || ''}
          onChange={(e) => onChange(slotIdx, e.target.value)}
          style={{
            width: '100%',
            background: '#1f1b18',
            color: '#f5e9d7',
            border: '1px solid #5b4937',
            padding: '2px 4px',
            fontSize: '12px'
          }}
        >
          <option value="">Empty</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
        <div style={{ fontSize: '11px', color: '#c2b59b', textAlign: 'center' }}>
          {skill ? (isReady ? 'Ready' : `${remaining}s`) : ''}
        </div>
        <button
          className="btn warn"
          onClick={() => onClear(slotIdx)}
          disabled={!skill}
          style={{ padding: '3px 6px', fontSize: '11px' }}
        >
          Clear
        </button>
      </div>
    );
  };

  const abilityOptions = (knownAbilities || []).map((a) => ({ id: a.id, name: a.name }));
  const spellOptions = (knownSpells || []).map((s) => ({ id: s.id, name: s.name }));

  const totalSpellSlots = [...spellSlots];
  while (totalSpellSlots.length < 6) totalSpellSlots.push(null);
  const totalAbilitySlots = [...abilitySlots];
  while (totalAbilitySlots.length < 6) totalAbilitySlots.push(null);
  const displayPlayerName = (characterName || '').trim() || 'Unnamed';

  const primarySpellSlots = totalSpellSlots.slice(0, 6);
  const allAbilitySlots = totalAbilitySlots.slice(0, 6);

  const getConInfo = () => {
    if (!currentMob) return null;
    const mobLevel = Number(currentMob.level);
    if (!Number.isFinite(mobLevel)) {
      throw new Error('Mob level missing or invalid');
    }
    const diff = mobLevel - level;
    if (diff >= 8) return { label: 'Maroon', color: '#4a041b' };
    if (diff >= 4) return { label: 'Red', color: '#b91c1c' };
    if (diff >= 1) return { label: 'Yellow', color: '#f59e0b' };
    if (diff === 0) return { label: 'White', color: '#e5e7eb' };
    if (diff >= -3) return { label: 'Blue', color: '#3b82f6' };
    if (diff >= -5) return { label: 'L. Blue', color: '#60a5fa' };
    if (diff >= -8) return { label: 'Green', color: '#10b981' };
    return { label: 'Gray', color: '#9ca3af' };
  };
  const con = getConInfo();

  const renderUseButton = (skill, onUse, onClear, isSpell = false) => {
    const until = skill ? (cooldowns[skill.id] || 0) : 0;
    const remaining = until > now ? Math.ceil((until - now) / 1000) : 0;
    const isReady = remaining === 0;
    const isCasting = castingState?.skillId === skill?.id;
    const manaCost = skill?.resource_cost?.mana || 0;
    const endCost = skill?.resource_cost?.endurance || skill?.resource_cost?.stamina || 0;
    const castMs = skill?.cast_time || 0;
    const castLabel = castMs ? `${(castMs / 1000).toFixed(1)}s cast` : 'Instant';
    const effect = skill?.effect || {};
    const dmgLabel = (() => {
      if (!effect) return '';
      if (effect.type === 'damage') return `Damage: ${effect.base || 0}`;
      if (effect.type === 'dot') return `DoT: ${effect.tick || effect.base || 0} x${effect.duration || 0}`;
      if (effect.type === 'heal') return `Heal: ${effect.base || 0}`;
      if (effect.type === 'hot') return `HoT: ${effect.tick || effect.base || 0} x${effect.duration || 0}`;
      if (effect.type === 'buff') return 'Buff';
      if (effect.type === 'debuff') return 'Debuff';
      return '';
    })();
    const tooltipParts = [
      skill?.name,
      manaCost ? `Mana: ${manaCost}` : null,
      endCost ? `End: ${endCost}` : null,
      castLabel,
      dmgLabel
    ].filter(Boolean);
    const title = tooltipParts.join(' | ');
    const isAutoToggle = !isSpell && skill?.id === 'builtin-auto' && isAutoAttack;
    const bgImage = isSpell
      ? "/stone-ui/ui/spellempty.png"
      : isAutoToggle
        ? "/stone-ui/ui/hotkeydown.png"
        : (skill ? "/stone-ui/ui/hotkeyup.png" : "/stone-ui/ui/hotkeyslot.png");
    const slotClass = isSpell ? 'spell-slot' : 'hotkey-slot';
    const classNames = [slotClass, skill ? 'has-skill' : 'hotkey-empty'].join(' ');
    const displayName = skill?.id === 'builtin-sit'
      ? (isSitting ? 'Stand' : 'Sit')
      : skill?.name;

    return (
      <button
        className={classNames}
        style={{
          height: 48,
          width: 48,
          backgroundImage: `url('${bgImage}')`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          position: 'relative',
          padding: 4
        }}
        onClick={() => skill && isReady && !isCasting && onUse(skill)}
        onDoubleClick={() => skill && onClear()}
        disabled={!skill || !isReady || isCasting}
        title={skill ? title : 'Empty'}
      >
        {!isSpell && skill && typeof (skill.iconIndex ?? skill.icon) === 'number' ? (
          <div style={{ position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
            <EqIcon index={skill.iconIndex ?? skill.icon} size={20} cols={6} sheet="/stone-ui/spellicons/spells1.png" />
          </div>
        ) : null}
        {isSpell && skill && typeof (skill.iconIndex ?? skill.icon) === 'number' ? (
          <EqIcon index={skill.iconIndex ?? skill.icon} size={32} cols={8} sheet="/stone-ui/spellicons/gemicons1.png" />
        ) : null}
        {!isSpell && skill && (
          <div className="hotkey-slot__label">{isCasting ? 'Casting...' : displayName}</div>
        )}
        {skill && !isReady && <div className="hotkey-slot__cd">{remaining}s</div>}
      </button>
    );
  };

  return (
    <div className="console">
      <div className="console-top">
        <div className="console-mob">
          {currentMob ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div
                style={{
                  background: 'rgba(0,0,0,0.45)',
                  borderRadius: '6px',
                  height: 140,
                  border: '1px dashed rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#c2b59b',
                  fontSize: 12,
                  textAlign: 'center',
                  padding: '6px'
                }}
              >
                Mob art placeholder
              </div>

              <div
                style={{
                  border: con ? `2px solid ${con.color}` : '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  padding: '4px',
                  display: 'grid',
                  gap: '1px'
                }}
              >
                <div className="console-bar">
                  <div className="console-bar__label">
                    <span>
                      {inCombat && <span style={{ marginRight: 6 }}>⚔️</span>}
                      {currentMob.name}
                      {currentMob.isNamed && <span className="mob-tag" style={{ marginLeft: 6 }}>NAMED</span>}
                    </span>
                    <span>{mobHp} / {currentMob.hp}</span>
                  </div>
                  <div className="console-bar__track">
                    <div
                      className="console-bar__fill"
                      style={{ width: `${Math.max(0, Math.min(100, (mobHp / currentMob.hp) * 100))}%` }}
                    />
                  </div>
                </div>

                {currentMob && (currentMob.mana || currentMob.endurance) ? (() => {
                  const hasMana = currentMob.mana && currentMob.mana > 0;
                  const maxVal = hasMana ? currentMob.mana : currentMob.endurance || 0;
                  const label = hasMana ? 'Mana' : 'Endurance';
                  const currentVal = maxVal; // placeholder until mob resource spend is implemented
                  const pct = maxVal > 0 ? Math.max(0, Math.min(100, (currentVal / maxVal) * 100)) : 0;
                  const barColor = hasMana ? '#3b82f6' : '#ffb637ff';
                  return (
                    <div className="console-bar">
                      <div className="console-bar__track">
                        <div
                          className="console-bar__fill"
                          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${barColor}, ${barColor})` }}
                        />
                      </div>
                    </div>
                  );
                })() : null}

                <div style={{ display: 'flex', gap: '48px', alignItems: 'center', justifyContent: 'center', flexWrap: 'nowrap', fontSize: 10 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 8, color: '#c2b59b' }}>DMG</div>
                    <div style={{ fontWeight: 700, fontSize: 10 }}>{currentMob.damage} {currentMob.delay ? `(Delay ${currentMob.delay})` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 8, color: '#c2b59b' }}>DMG Type</div>
                    <div style={{ fontWeight: 700, fontSize: 10 }}>{currentMob.damage_type || 'Physical'}</div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  padding: '4px',
                  display: 'grid',
                }}
              >
                <div className="console-bar">
                  <div className="console-bar__label">
                    <span>{displayPlayerName}</span>
                    <span>{hp} / {maxHp}</span>
                  </div>
                  <div className="console-bar__track">
                    <div
                      className="console-bar__fill"
                      style={{ width: `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%` }}
                    />
                  </div>
                </div>
                <div className="console-bar">
                  <div className="console-bar__label">
                    <span></span>
                    <span>{playerClass.isCaster ? `${mana} / ${maxMana}` : `${endurance} / ${maxEndurance}`}</span>
                  </div>
                  <div className="console-bar__track">
                    <div
                      className="console-bar__fill"
                      style={{
                        width: `${Math.max(0, Math.min(100, (playerClass.isCaster ? (mana / maxMana) : (endurance / maxEndurance)) * 100))}%`,
                        background: playerClass.isCaster ? 'linear-gradient(90deg, #3b82f6, #3b82f6)' : 'linear-gradient(90deg, #ffb637ff, #f59e0b)'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="console-empty">No target</div>
          )}
        </div>

        <div className="console-skills">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '18px',
              alignItems: 'start'
            }}
          >
            {/* Left column: primary spells (6) */}
            <div style={{ minWidth: 0 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 46px))',
                gap: '1px',
                justifyContent: 'start'
              }}>
                {primarySpellSlots.map((skill, idx) => (
                  <div key={`spell-${idx}`} style={{ width: 46 }}>
                    {renderUseButton(skill, onUseSkill, () => onClearSpell(idx + 1), true)}
                  </div>
                ))}
              </div>
            </div>

            {/* Middle column: hotkeys + active effects */}
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                <div style={{ width: 48 }}>{renderUseButton({ id: 'builtin-attack', name: 'Attack' }, onUseSkill, () => {}, false)}</div>
                <div style={{ width: 48 }}>{renderUseButton({ id: 'builtin-ranged', name: 'Ranged' }, onUseSkill, () => {}, false)}</div>
                <div style={{ width: 48 }}>{renderUseButton({ id: 'builtin-sit', name: 'Sit/Stand' }, onUseSkill, () => {}, false)}</div>
                <div style={{ width: 48 }}>{renderUseButton({ id: 'builtin-meditate', name: 'Meditate' }, () => { onUseSkill({ id: 'builtin-meditate', name: 'Meditate' }); setShowConfig(true); }, () => {}, false)}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#d6c18a', textAlign: 'center' }}>Effects</div>
              <div className="stone-effects" style={{ padding: '6px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, minHeight: 60 }}>
                <div className="stone-effects__icons" style={{ display: 'grid', gap: '6px' }}>
                  {effects.map((fx) => {
                    const timeLeft = fx.expiresAt ? Math.max(0, Math.ceil((fx.expiresAt - Date.now()) / 1000)) : 0;
                    return (
                      <div key={fx.id || fx.name} className="stone-effect" style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', alignItems: 'center', gap: '6px' }} title={`${fx.name}${timeLeft > 0 ? `\n${timeLeft}s remaining` : ''}`}>
                        <EqIcon
                          index={fx.iconIndex || fx.icon || 0}
                          size={22}
                          cols={6}
                          rows={6}
                          sheet="/stone-ui/spellicons/spells1.png"
                        />
                        <span className="stone-effect__name" style={{ color: '#f5e9d7', fontSize: 12 }}>{fx.name}</span>
                        {timeLeft > 0 && <span className="stone-effect__timer" style={{ color: '#9ca3af', fontSize: 11 }}>{timeLeft}s</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right column: abilities (6) */}
            <div style={{ minWidth: 0 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 46px))',
                gap: '1px',
                justifyContent: 'start'
              }}>
                {allAbilitySlots.map((skill, idx) => {
                  const slotIndex = idx + 1;
                  return (
                    <div key={`ability-${idx}`} style={{ width: 46 }}>
                    {renderUseButton(skill, onUseSkill, () => onClearAbility(slotIndex))}
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="console-log">
        <div className="console-title">Combat Log</div>
        <div className="console-log__window" ref={logRef}>
          {combatLog.map((log) => (
            <div
              key={log.id}
              className={`log-line log-${log.type || 'normal'}`}
            >
              {log.message}
            </div>
          ))}
        </div>
      </div>

      {showConfig && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50
          }}
          onClick={() => setShowConfig(false)}
        >
          <div
            className="console"
            style={{ maxWidth: 720, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                {totalSpellSlots.map((skill, idx) =>
                  renderConfigRow(idx + 1, skill, spellOptions, handleSpellChange, onClearSpell, true)
                )}
              </div>
              <div>
                {totalAbilitySlots.map((skill, idx) =>
                  renderConfigRow(idx + 1, skill, abilityOptions, handleAbilityChange, onClearAbility, false)
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px', marginBottom: '4px' }}>
              <button className="btn warn" onClick={() => setShowConfig(false)} style={{ padding: '4px 12px', fontSize: '11px' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
