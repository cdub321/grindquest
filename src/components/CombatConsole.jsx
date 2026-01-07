import { useEffect, useRef, useState } from 'react';
import Icon, { GEM_CONFIG } from './Icon';

export default function CombatConsole({
  current_mob,
  mob_hp,
  mob_effects = [],
  toggle_auto_attack,
  is_auto_attack,
  ability_slots = [],
  spell_slots = [],
  known_abilities = [],
  known_spells = [],
  level = 1,
  character_name = '',
  hp,
  max_hp,
  mana,
  max_mana,
  endurance,
  max_endurance,
  player_class,
  resource_type = 'melee',
  // Interaction handled elsewhere; combat-only UI
  on_assign_ability = () => {},
  on_assign_spell = () => {},
  on_clear_ability = () => {},
  on_clear_spell = () => {},
  on_use_skill,
  cooldowns = {},
  now = Date.now(),
  combat_log = [],
  in_combat = false,
  casting_state = null,
  effects = [],
  is_sitting = false,
  is_stunned = null, // Function to check if player is stunned
  is_attack_on_cooldown = null // Function to check if attack is on cooldown
}) {
  const log_ref = useRef(null);
  const [show_config, set_show_config] = useState(false);
  const [portrait_failed, set_portrait_failed] = useState(false);
  const FLEE_COOLDOWN_MS = 60000;

  useEffect(() => {
    if (log_ref.current) {
      log_ref.current.scrollTop = log_ref.current.scrollHeight;
    }
  }, [combat_log]);

  useEffect(() => {
    set_portrait_failed(false);
  }, [current_mob?.id, current_mob?.name]);

  const get_effect_icon = (skill) => {
    if (!skill) return null;
    return skill.spellIconIndex ?? skill.iconIndex ?? skill.icon_index ?? skill.spellicon ?? skill.icon ?? null;
  };

  const get_gem_icon = (skill) => {
    if (!skill) return null;
    return skill.gemIconIndex ?? skill.gemicon ?? skill.icon_index ?? get_effect_icon(skill);
  };

  const get_segment_size = (max_value) => {
    if (!max_value || max_value <= 0) return 0;
    if (max_value <= 100) return 10;
    if (max_value <= 250) return 25;
    if (max_value <= 500) return 50;
    if (max_value <= 2000) return 100;
    if (max_value <= 5000) return 200;
    if (max_value <= 10000) return 500;
    return 1000;
  };

  const render_segment_overlay = (max_value, options = {}) => {
    const size = get_segment_size(max_value);
    if (!size || size >= max_value) return null;
    const segment_pct = (size / max_value) * 100;
    const line_width = options.lineWidth ?? 2;
    const color = options.color ?? 'rgba(0,0,0,0.85)';
    const opacity = options.opacity ?? 0.8;
    const segments = Math.floor(max_value / size);

    const lines = [];
    for (let i = 1; i <= segments; i++) {
      const pct = Math.min(100, segment_pct * i);
      if (pct >= 100) continue; // Skip drawing on the far right edge
      lines.push(
        <div
          key={`seg-${i}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `calc(${pct}% - ${line_width / 2}px)`,
            width: line_width,
            background: color
          }}
        />
      );
    }

    return (
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          mixBlendMode: options.mixBlendMode || 'normal',
          opacity,
          zIndex: 2
        }}
      >
        {lines}
      </div>
    );
  };

  const handle_ability_change = (slot_idx, val) => {
    if (!val) {
      on_clear_ability(slot_idx);
      return;
    }
    on_assign_ability(slot_idx, val);
  };

  const handle_spell_change = (slot_idx, val) => {
    if (!val) {
      on_clear_spell(slot_idx);
      return;
    }
    on_assign_spell(slot_idx, val);
  };

  const render_config_row = (slot_idx, skill, options, onChange, onClear, is_spell = false) => {
    const skill_id = skill?.spell_id || skill?.id;
    const until = skill ? (cooldowns[skill_id] || 0) : 0;
    const remaining = until > now ? Math.ceil((until - now) / 1000) : 0;
    const is_ready = remaining === 0;
    const effect_icon = get_effect_icon(skill);
    return (
      <div
        key={`slot-${is_spell ? 'spell' : 'ability'}-${slot_idx}`}
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
          <div style={{ fontSize: '11px', color: '#d6c18a' }}>{is_spell ? 'Spell' : 'Skill'} {slot_idx}</div>
          <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {skill && typeof effect_icon === 'number' ? (
            <Icon index={effect_icon} size={24} cols={6} sheet="/stone-ui/spellicons/spells1.png" />
          ) : null}
          </div>
        <select
          value={skill?.id || ''}
          onChange={(e) => onChange(slot_idx, e.target.value)}
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
          {skill ? (is_ready ? 'Ready' : `${remaining}s`) : ''}
        </div>
        <button
          className="btn warn"
          onClick={() => onClear(slot_idx)}
          disabled={!skill}
          style={{ padding: '3px 6px', fontSize: '11px' }}
        >
          Clear
        </button>
      </div>
    );
  };

  const ability_options = [
    { id: 'mechanic-auto-attack', name: 'Auto Attack' },
    ...(known_abilities || []).map((a) => ({ id: a.id, name: a.name }))
  ];
  const spell_options = [
    { id: 'mechanic-auto-cast', name: 'Auto Cast' },
    ...(known_spells || []).map((s) => ({ id: s.id, name: s.name }))
  ];

  const total_spell_slots = [...spell_slots];
  while (total_spell_slots.length < 6) total_spell_slots.push(null);
  const total_ability_slots = [...ability_slots];
  while (total_ability_slots.length < 6) total_ability_slots.push(null);
  const display_player_name = (character_name || '').trim() || 'Unnamed';

  const primary_spell_slots = total_spell_slots.slice(0, 6);
  const all_ability_slots = total_ability_slots.slice(0, 6);

  const get_con_info = () => {
    if (!current_mob) return null;
    const mob_level = Number(current_mob.level);
    if (!Number.isFinite(mob_level)) {
      throw new Error('Mob level missing or invalid');
    }
    const diff = mob_level - level;
    if (diff >= 8) return { label: 'Maroon', color: '#4a041b' };
    if (diff >= 4) return { label: 'Red', color: '#b91c1c' };
    if (diff >= 1) return { label: 'Yellow', color: '#f59e0b' };
    if (diff === 0) return { label: 'White', color: '#e5e7eb' };
    if (diff >= -3) return { label: 'Blue', color: '#3b82f6' };
    if (diff >= -5) return { label: 'L. Blue', color: '#60a5fa' };
    if (diff >= -8) return { label: 'Green', color: '#10b981' };
    return { label: 'Gray', color: '#9ca3af' };
  };
  const con = get_con_info();
  const get_mob_portrait = (mob) => {
    if (!mob) return null;
    const race = mob.race_id ?? mob.raceId ?? 1;
    const gender = mob.gender ?? 0;
    const texture = mob.texture_id ?? mob.textureId ?? 1;
    return `/stone-ui/raceimages/${race}_${gender}_${texture}_0.jpg`;
  };

  const mob_portrait_src = current_mob ? get_mob_portrait(current_mob) : null;
  const fallback_portrait = '/stone-ui/raceimages/0_0_1_0.jpg';

  const render_use_button = (skill, on_use, on_clear, is_spell = false) => {
    const skill_id = skill?.spell_id || skill?.id;
    const until = skill ? (cooldowns[skill_id] || 0) : 0;
    const remaining_ms = until > now ? until - now : 0;
    const remaining = remaining_ms > 0 ? Math.ceil(remaining_ms / 1000) : 0;
    const is_ready = remaining === 0;
    const is_casting = casting_state?.skillId === skill?.id;
    const cast_progress = (() => {
      if (!is_casting || !casting_state?.durationMs) return 0;
      const pct = 1 - Math.max(0, (casting_state.endsAt - now) / casting_state.durationMs);
      return Math.max(0, Math.min(1, pct));
    })();
    
    // Calculate progress for animated border (only for spells)
    const border_progress = (() => {
      if (!is_spell || !skill) return 0;
      if (is_casting) return cast_progress;
      if (remaining_ms > 0) {
        const cooldown_duration = skill?.recast_time || remaining_ms;
        return Math.max(0, Math.min(1, 1 - (remaining_ms / cooldown_duration)));
      }
      return 0;
    })();
    const border_color = is_spell && skill 
      ? (is_casting ? 'rgba(120, 200, 255, 0.9)' : 'rgba(200, 150, 100, 0.7)')
      : 'rgba(200, 150, 100, 0.7)';
    const shadow_color = is_spell && skill
      ? (is_casting ? 'rgba(120, 200, 255, 0.5)' : 'rgba(200, 150, 100, 0.3)')
      : 'rgba(200, 150, 100, 0.3)';
    const radius = is_spell ? (GEM_CONFIG.defaultWidth + 8) / 2 - 2 : 0;
    const circumference = is_spell ? 2 * Math.PI * radius : 0;
    const is_flee = skill?.id === 'builtin-flee';
    const is_attack = skill?.id === 'builtin-attack';
    const is_disabled_by_auto_attack = is_attack && is_auto_attack;
    const player_is_stunned = is_stunned && is_stunned('player');
    const attack_on_cooldown = is_attack && is_attack_on_cooldown && is_attack_on_cooldown();
    const flee_cooldown_pct = is_flee && remaining_ms > 0 ? Math.max(0, Math.min(1, (FLEE_COOLDOWN_MS - remaining_ms) / FLEE_COOLDOWN_MS)) : 0;
    const mana_cost = skill?.mana || 0;
    const end_cost = skill?.endurance || 0;
    const cast_ms = skill?.cast_time || 0;
    const cast_label = cast_ms ? `${(cast_ms / 1000).toFixed(1)}s cast` : 'Instant';
    const effect_type = skill?.effect_type || skill?.effectType || skill?.effect?.type;
    const dmg_label = (() => {
      if (!effect_type) return '';
      if (effect_type === 'damage' || effect_type === 'nuke') return `Damage: ${skill?.base_hp ?? 0}`;
      if (effect_type === 'dot') return `DoT: ${skill?.tick_hp ?? skill?.base_hp ?? 0} x${skill?.duration_seconds || 0}`;
      if (effect_type === 'heal') return `Heal: ${skill?.base_hp ?? 0}`;
      if (effect_type === 'hot') return `HoT: ${skill?.tick_hp ?? skill?.base_hp ?? 0} x${skill?.duration_seconds || 0}`;
      if (effect_type === 'manadrain') return `Drain Mana: ${skill?.base_mana ?? 0}`;
      if (effect_type === 'enddrain') return `Drain End: ${skill?.base_endurance ?? 0}`;
      if (effect_type === 'manarestore') return `Restore Mana: ${skill?.base_mana ?? 0}`;
      if (effect_type === 'endrestore') return `Restore End: ${skill?.base_endurance ?? 0}`;
      if (effect_type === 'buff') return 'Buff';
      if (effect_type === 'debuff') return 'Debuff';
      return '';
    })();
    const tooltip_parts = [
      skill?.name,
      mana_cost ? `Mana: ${mana_cost}` : null,
      end_cost ? `End: ${end_cost}` : null,
      cast_label,
      dmg_label
    ].filter(Boolean);
    const title = tooltip_parts.join(' | ');
    const is_auto_toggle = !is_spell && skill?.id === 'builtin-auto' && is_auto_attack;
    const bg_image = is_spell
      ? "/stone-ui/ui/spellempty.png"
      : (is_auto_toggle || attack_on_cooldown || (is_flee && !is_ready))
        ? "/stone-ui/ui/hotkeydown.png"
        : (skill ? "/stone-ui/ui/hotkeyup.png" : "/stone-ui/ui/hotkeyslot.png");
    const slot_class = is_spell ? 'spell-slot' : 'hotkey-slot';
    const is_core_action = ['builtin-attack', 'builtin-flee', 'builtin-ranged', 'builtin-sit', 'builtin-meditate'].includes(skill?.id);
    const class_names = [slot_class, skill ? 'has-skill' : 'hotkey-empty', is_core_action ? 'hotkey-slot--core' : '']
      .filter(Boolean)
      .join(' ');
    const display_name = skill?.id === 'builtin-sit'
      ? (is_sitting ? 'Stand' : 'Sit')
      : skill?.name;

    const slot_height = is_spell ? 48 : (is_core_action ? 24 : 48);
    const slot_padding = is_core_action ? 2 : 4;
    const effect_icon = get_effect_icon(skill);
    const gem_icon = get_gem_icon(skill);

    return (
      <button
        className={class_names}
        style={{
          height: slot_height,
          width: 48,
          backgroundImage: `url('${bg_image}')`,
          backgroundSize: is_core_action ? '100% 100%' : 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          position: 'relative',
          padding: slot_padding,
          filter: player_is_stunned ? 'grayscale(1) brightness(0.5)' : (is_casting ? 'grayscale(0.7) brightness(0.85)' : (is_flee && !is_ready ? 'grayscale(0.9) brightness(0.7)' : (is_disabled_by_auto_attack ? 'grayscale(0.8) brightness(0.6)' : undefined))),
          boxShadow: is_casting
            ? '0 0 10px rgba(255,255,255,0.35) inset, 0 0 6px rgba(120,200,255,0.4)'
            : (is_flee && !is_ready ? '0 0 6px rgba(200,120,60,0.4) inset' : undefined),
          transition: 'filter 120ms linear, box-shadow 120ms linear'
        }}
        onClick={() => skill && is_ready && !is_casting && !is_disabled_by_auto_attack && !player_is_stunned && !attack_on_cooldown && on_use(skill)}
        onDoubleClick={() => skill && on_clear()}
        disabled={!skill || !is_ready || is_casting || is_disabled_by_auto_attack || player_is_stunned || attack_on_cooldown}
        title={player_is_stunned ? 'You are stunned!' : (is_disabled_by_auto_attack ? 'Auto-attack is active' : (attack_on_cooldown ? 'Attack on cooldown' : (skill ? title : 'Empty')))}
      >
        {!is_spell && skill && typeof effect_icon === 'number' ? (
          <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
            <Icon index={effect_icon} size={30} cols={6} sheet="/stone-ui/spellicons/spells1.png" />
          </div>
        ) : null}
        {is_spell && skill && typeof gem_icon === 'number' ? (
          <div
            className="gem-icon-wrap"
            style={{
              position: 'absolute',
              top: 4,
              left: '15%',
              pointerEvents: 'none',
              overflow: 'hidden',
              width: GEM_CONFIG.defaultWidth,
              height: GEM_CONFIG.defaultHeight
            }}
          >
            <Icon
              index={gem_icon}
              isGem={true}
            />
          </div>
        ) : null}
        {!is_spell && skill && (
          <div className="hotkey-slot__label">{is_casting ? 'Casting...' : display_name}</div>
        )}
        {skill && !is_ready && <div className="hotkey-slot__cd">{remaining}s</div>}
        {is_flee && !is_ready && (
          <div
            style={{
              position: 'absolute',
              left: 4,
              right: 4,
              top: 4,
              height: 5,
              borderRadius: 3,
              background: 'rgba(0,0,0,0.4)',
              overflow: 'hidden',
              boxShadow: '0 0 4px rgba(200,120,60,0.5)'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${flee_cooldown_pct * 100}%`,
                background: 'linear-gradient(90deg, rgba(255,200,120,0.4), rgba(255,200,120,0.85))',
                transition: 'width 100ms linear'
              }}
            />
          </div>
        )}
        {skill && is_casting && (
          <div
            style={{
              position: 'absolute',
              inset: 2,
              background: 'linear-gradient(135deg, rgba(0,20,40,0.45), rgba(0,0,0,0.5))',
              borderRadius: 6,
              pointerEvents: 'none'
            }}
          />
        )}
        {skill && is_casting && (
          <div
            style={{
              position: 'absolute',
              left: 4,
              right: 4,
              bottom: 4,
              height: 6,
              borderRadius: 4,
              background: 'rgba(255,255,255,0.12)',
              overflow: 'hidden',
              boxShadow: '0 0 6px rgba(120,200,255,0.45)'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${cast_progress * 100}%`,
                background: 'linear-gradient(90deg, rgba(120,200,255,0.3), rgba(120,200,255,0.85))',
                transition: 'width 80ms linear'
              }}
            />
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="console">
      <div className="console-top">
        <div className="console-mob">
          {current_mob ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div
                style={{
                  border: con ? `2px solid ${con.color}` : '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  padding: '6px',
                  display: 'grid',
                  gap: '6px',
                  boxShadow: con ? `0 0 8px ${con.color}` : 'none',
                  animation: in_combat && con ? 'con-blink 1s ease-in-out infinite' : 'none',
                  '--con-color': con?.color || 'rgba(255,255,255,0.6)'
                }}
              >
                <div
                  style={{
                    background: 'rgba(0,0,0,0.45)',
                    borderRadius: '6px',
                    height: 140,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#c2b59b',
                    fontSize: 12,
                    textAlign: 'center',
                    padding: '6px',
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                >
                  {mob_portrait_src && !portrait_failed ? (
                    <img
                      src={mob_portrait_src}
                      alt={current_mob.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '4px', transform: 'scale(0.85)' }}
                      onError={(e) => {
                        if (portrait_failed) return;
                        set_portrait_failed(true);
                        e.target.src = fallback_portrait;
                      }}
                    />
                ) : (
                  <div style={{ opacity: 0.8 }}>
                    Mob art unavailable
                    {mob_portrait_src ? ` (${mob_portrait_src.split('/').pop()})` : ''}
                  </div>
                )}
                  {mob_effects.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 6,
                        right: 6,
                        bottom: 6,
                        display: 'flex',
                        gap: '4px',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        background: 'rgba(0,0,0,0.35)',
                        padding: '4px 6px',
                        borderRadius: 4,
                        backdropFilter: 'blur(2px)'
                      }}
                    >
                      {mob_effects.map((fx) => {
                        const expires_at_ms = fx.expires_at_ms || (fx.expiresAt ? new Date(fx.expiresAt).getTime() : null);
                        const timeLeft = expires_at_ms ? Math.max(0, Math.ceil((expires_at_ms - Date.now()) / 1000)) : 0;
                        return (
                          <div
                            key={fx.id || fx.name}
                            style={{ position: 'relative', width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title={fx.name || ''}
                          >
                            <Icon
                              index={fx.iconIndex || fx.icon || 0}
                              size={20}
                              cols={6}
                              rows={6}
                              sheet="/stone-ui/spellicons/spells1.png"
                            />
                            {timeLeft > 0 && (
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: -4,
                                  right: -4,
                                  background: '#000',
                                  color: '#f5e9d7',
                                  fontSize: 8,
                                  padding: '0 2px',
                                  borderRadius: 3,
                                  lineHeight: 1.1
                                }}
                              >
                                {timeLeft}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="console-bar">
                  <div className="console-bar__label">
                    <span>
                      {in_combat && <span style={{ marginRight: 6 }}>⚔️</span>}
                      {current_mob.name}
                      {current_mob.isNamed && <span className="mob-tag" style={{ marginLeft: 6 }}>NAMED</span>}
                    </span>
                    <span>{mob_hp} / {current_mob.hp}</span>
                  </div>
                  <div className="console-bar__track">
                    <div
                      className="console-bar__fill"
                      style={{ width: `${Math.max(0, Math.min(100, (mob_hp / current_mob.hp) * 100))}%` }}
                    />
                    {render_segment_overlay(current_mob.hp, { color: 'rgba(0,0,0,0.9)', opacity: 0.85, lineWidth: 2 })}
                  </div>
                </div>

                {current_mob && (current_mob.mana || current_mob.endurance) ? (() => {
                  const has_mana = current_mob.mana && current_mob.mana > 0;
                  const max_val = has_mana ? current_mob.mana : current_mob.endurance || 0;
                  const label = has_mana ? 'Mana' : 'Endurance';
                  const current_val = max_val; // placeholder until mob resource spend is implemented
                  const pct = max_val > 0 ? Math.max(0, Math.min(100, (current_val / max_val) * 100)) : 0;
                  const bar_color = has_mana ? '#3b82f6' : '#ffb637ff';
                  return (
                    <div className="console-bar">
                      <div className="console-bar__track">
                        <div
                          className="console-bar__fill"
                          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${bar_color}, ${bar_color})` }}
                        />
                        {render_segment_overlay(max_val, { color: 'rgba(0,0,0,0.9)', opacity: 0.85, lineWidth: 2 })}
                      </div>
                    </div>
                  );
                })() : null}

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
                    <span>{display_player_name}</span>
                    <span>{hp} / {max_hp}</span>
                  </div>
                  <div className="console-bar__track">
                    <div
                      className="console-bar__fill"
                      style={{ width: `${Math.max(0, Math.min(100, (hp / max_hp) * 100))}%` }}
                    />
                    {render_segment_overlay(max_hp, { color: 'rgba(0,0,0,0.9)', opacity: 0.85, lineWidth: 2 })}
                  </div>
                </div>
                {resource_type === 'melee' ? (
                  <div className="console-bar">
                    <div className="console-bar__label">
                      <span></span>
                      <span>{endurance} / {max_endurance}</span>
                    </div>
                    <div className="console-bar__track">
                      <div
                        className="console-bar__fill"
                        style={{
                          width: `${Math.max(0, Math.min(100, (endurance / max_endurance) * 100))}%`,
                          background: 'linear-gradient(90deg, #ffb637ff, #f59e0b)'
                        }}
                      />
                      {render_segment_overlay(max_endurance, {
                        color: 'rgba(0,0,0,0.9)',
                        opacity: 0.85,
                        lineWidth: 2
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="console-bar">
                    <div className="console-bar__label">
                      <span></span>
                      <span>{mana} / {max_mana}</span>
                    </div>
                    <div className="console-bar__track">
                      <div
                        className="console-bar__fill"
                        style={{
                          width: `${Math.max(0, Math.min(100, (mana / max_mana) * 100))}%`,
                          background: 'linear-gradient(90deg, #3b82f6, #3b82f6)'
                        }}
                      />
                      {render_segment_overlay(max_mana, {
                        color: 'rgba(0,0,0,0.9)',
                        opacity: 0.85,
                        lineWidth: 2
                      })}
                    </div>
                  </div>
                )}
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
                gridTemplateColumns: '46px',
                gap: '1px',
                justifyContent: 'center'
              }}>
                {primary_spell_slots.map((skill, idx) => (
                  <div key={`spell-${idx}`} style={{ width: 46 }}>
                    {render_use_button(skill, on_use_skill, () => on_clear_spell(idx + 1), true)}
                  </div>
                ))}
              </div>
            </div>

            {/* Middle column: hotkeys + active effects */}
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                <div style={{ width: 48 }}>{render_use_button({ id: 'builtin-attack', name: 'Attack' }, on_use_skill, () => {}, false)}</div>
                <div style={{ width: 48 }}>{render_use_button({ id: 'builtin-flee', name: 'Flee' }, on_use_skill, () => {}, false)}</div>
                <div style={{ width: 48 }}>{render_use_button({ id: 'builtin-ranged', name: 'Ranged' }, on_use_skill, () => {}, false)}</div>
                <div style={{ width: 48 }}>{render_use_button({ id: 'builtin-sit', name: 'Sit/Stand' }, on_use_skill, () => {}, false)}</div>
                <div style={{ width: 48 }}>{render_use_button({ id: 'builtin-meditate', name: 'Meditate' }, () => { 
                  if (!in_combat) {
                    on_use_skill({ id: 'builtin-meditate', name: 'Meditate' }); 
                    set_show_config(true);
                  } else {
                    on_use_skill({ id: 'builtin-meditate', name: 'Meditate' });
                  }
                }, () => {}, false)}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#d6c18a', textAlign: 'center' }}>Effects</div>
              <div className="stone-effects" style={{ padding: '6px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, minHeight: 60 }}>
                <div className="stone-effects__icons" style={{ display: 'grid', gap: '6px', gridTemplateColumns: 'repeat(auto-fill, minmax(28px, 1fr))' }}>
                  {effects.map((fx) => {
                    const expires_at_ms = fx.expires_at_ms || (fx.expiresAt ? new Date(fx.expiresAt).getTime() : null);
                    const timeLeft = expires_at_ms ? Math.max(0, Math.ceil((expires_at_ms - Date.now()) / 1000)) : 0;
                    return (
                      <div
                        key={fx.id || fx.name}
                        style={{ position: 'relative', width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0 }}
                        title={fx.name || ''}
                      >
                        <Icon
                          index={fx.iconIndex || fx.icon || 0}
                          size={22}
                          cols={6}
                          rows={6}
                          sheet="/stone-ui/spellicons/spells1.png"
                        />
                        {timeLeft > 0 && (
                          <span
                            className="stone-effect__timer"
                            style={{
                              position: 'absolute',
                              bottom: -4,
                              right: -4,
                              background: '#000',
                              color: '#f5e9d7',
                              fontSize: 9,
                              padding: '0 3px',
                              borderRadius: 3,
                              lineHeight: 1.2
                            }}
                          >
                            {timeLeft}
                          </span>
                        )}
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
                gridTemplateColumns: '46px',
                gap: '1px',
                justifyContent: 'center'
              }}>
                {all_ability_slots.map((skill, idx) => {
                  const slot_index = idx + 1;
                  return (
                    <div key={`ability-${idx}`} style={{ width: 46 }}>
                    {render_use_button(skill, on_use_skill, () => on_clear_ability(slot_index))}
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
        <div className="console-log__window" ref={log_ref}>
          {combat_log.map((log) => (
            <div
              key={log.id}
              className={`log-line log-${log.type || 'normal'}`}
            >
              {log.message}
            </div>
          ))}
        </div>
      </div>

      {show_config && (
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
          onClick={() => set_show_config(false)}
        >
          <div
            className="console"
            style={{ maxWidth: 720, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                {total_spell_slots.map((skill, idx) =>
                  render_config_row(idx + 1, skill, spell_options, handle_spell_change, on_clear_spell, true)
                )}
              </div>
              <div>
                {total_ability_slots.map((skill, idx) =>
                  render_config_row(idx + 1, skill, ability_options, handle_ability_change, on_clear_ability, false)
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px', marginBottom: '4px' }}>
              <button className="btn warn" onClick={() => set_show_config(false)} style={{ padding: '4px 12px', fontSize: '11px' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
