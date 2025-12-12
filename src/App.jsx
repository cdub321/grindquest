import { useState, useEffect, useRef } from 'react';
import classesData from './data/classes.json';
import zonesData from './data/zones.json';
import CharacterPanel from './components/CharacterPanel';
import InventoryPanel from './components/InventoryPanel';
import ZonePanel from './components/ZonePanel';
import CombatPanel from './components/CombatPanel';
import CombatLog from './components/CombatLog';
import InstructionsPanel from './components/InstructionsPanel';
import StatsPanel from './components/StatsPanel';
import FutureFeaturesPanel from './components/FutureFeaturesPanel';

export default function GrindQuest() {
  const [playerClass] = useState(classesData.warrior);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [hp, setHp] = useState(playerClass.baseHp);
  const [maxHp] = useState(playerClass.baseHp);
  const [mana, setMana] = useState(playerClass.baseMana);
  const [maxMana] = useState(playerClass.baseMana);
  const [copper, setCopper] = useState(0);
  const [silver, setSilver] = useState(0);
  const [gold, setGold] = useState(0);
  const [platinum, setPlatinum] = useState(0);

  const [currentZone] = useState(zonesData.crushbone);
  const [currentMob, setCurrentMob] = useState(null);
  const [mobHp, setMobHp] = useState(0);
  const [isAutoAttack, setIsAutoAttack] = useState(false);
  const [combatLog, setCombatLog] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [inCombat, setInCombat] = useState(false);
  const [isMeditating, setIsMeditating] = useState(false);

  const autoAttackInterval = useRef(null);
  const regenInterval = useRef(null);
  const combatTimeout = useRef(null);

  const xpNeeded = level * 100;

  const addLog = (message, type = 'normal') => {
    setCombatLog(prev => [...prev.slice(-5), { message, type, id: Date.now() }]);
  };

  const spawnMob = () => {
    const mob = currentZone.mobs[Math.floor(Math.random() * currentZone.mobs.length)];
    setCurrentMob(mob);
    setMobHp(mob.hp);
    addLog(`${mob.name} spawns!`, 'spawn');
  };

  const attackMob = () => {
    if (!currentMob || mobHp <= 0) return;

    setInCombat(true);
    setIsMeditating(false);

    if (combatTimeout.current) clearTimeout(combatTimeout.current);
    combatTimeout.current = setTimeout(() => setInCombat(false), 6000);

    const damage = Math.floor(playerClass.baseDamage * (1 + level * 0.1) + Math.random() * 5);
    const newHp = Math.max(0, mobHp - damage);
    setMobHp(newHp);
    addLog(`You hit ${currentMob.name} for ${damage} damage!`, 'damage');

    if (newHp === 0) {
      addLog(`${currentMob.name} has been slain!`, 'kill');
      const xpGain = currentMob.xp;
      const newXp = xp + xpGain;
      setXp(newXp);
      addLog(`You gain ${xpGain} experience!`, 'xp');

      if (newXp >= xpNeeded) {
        setLevel(level + 1);
        setXp(newXp - xpNeeded);
        addLog(`You have gained a level! You are now level ${level + 1}!`, 'levelup');
      }

      if (Math.random() < 0.3) {
        const lootItem = currentMob.loot[Math.floor(Math.random() * currentMob.loot.length)];
        setInventory(prev => [...prev, lootItem]);
        addLog(`You receive: ${lootItem}`, 'loot');

        if (lootItem.includes("Pieces")) {
          if (lootItem.includes("Platinum")) {
            setPlatinum(prev => prev + Math.floor(Math.random() * 5) + 1);
          } else if (lootItem.includes("Gold")) {
            setGold(prev => prev + Math.floor(Math.random() * 10) + 1);
          } else if (lootItem.includes("Silver")) {
            setSilver(prev => prev + Math.floor(Math.random() * 20) + 1);
          } else if (lootItem.includes("Copper")) {
            setCopper(prev => prev + Math.floor(Math.random() * 50) + 1);
          }
        }
      }

      setTimeout(() => spawnMob(), 1000);
      setInCombat(false);
    } else {
      setTimeout(() => {
        if (newHp > 0) {
          const mobDamage = currentMob.damage;
          setHp(prev => Math.max(0, prev - mobDamage));
          addLog(`${currentMob.name} hits YOU for ${mobDamage} damage!`, 'mobattack');
        }
      }, 500);
    }
  };

  const toggleAutoAttack = () => {
    setIsAutoAttack(!isAutoAttack);
    addLog(isAutoAttack ? 'Auto-attack disabled' : 'Auto-attack enabled', 'system');
  };

  const fleeCombat = () => {
    if (!currentMob) return;
    addLog(`You flee from ${currentMob.name}!`, 'flee');
    setInCombat(false);
    setIsMeditating(false);
    if (autoAttackInterval.current) {
      clearInterval(autoAttackInterval.current);
      setIsAutoAttack(false);
    }
    spawnMob();
  };

  const toggleMeditate = () => {
    if (!playerClass.isCaster) return;
    if (inCombat) {
      addLog('You cannot meditate while in combat!', 'error');
      return;
    }
    setIsMeditating(!isMeditating);
    addLog(isMeditating ? 'You stop meditating.' : 'You sit down to meditate.', 'system');
  };

  useEffect(() => {
    if (isAutoAttack && currentMob && mobHp > 0) {
      autoAttackInterval.current = setInterval(() => {
        attackMob();
      }, playerClass.attackSpeed);
    } else {
      if (autoAttackInterval.current) {
        clearInterval(autoAttackInterval.current);
      }
    }

    return () => {
      if (autoAttackInterval.current) {
        clearInterval(autoAttackInterval.current);
      }
    };
  }, [isAutoAttack, currentMob, mobHp]);

  useEffect(() => {
    spawnMob();
  }, []);

  useEffect(() => {
    regenInterval.current = setInterval(() => {
      setHp(prev => {
        const hpRegenRate = inCombat ? 1 : 3;
        return Math.min(maxHp, prev + hpRegenRate);
      });

      if (playerClass.isCaster) {
        setMana(prev => {
          const manaRegenRate = isMeditating ? 15 : inCombat ? 1 : 5;
          return Math.min(maxMana, prev + manaRegenRate);
        });
      }
    }, 2000);

    return () => {
      if (regenInterval.current) {
        clearInterval(regenInterval.current);
      }
    };
  }, [inCombat, isMeditating, maxHp, maxMana, playerClass.isCaster]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-blue-400 mb-2">GrindQuest</h1>
          <p className="text-gray-400">An EverQuest Idle Adventure</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <CharacterPanel
              playerClass={playerClass}
              level={level}
              hp={hp}
              maxHp={maxHp}
              mana={mana}
              maxMana={maxMana}
              xp={xp}
              xpNeeded={xpNeeded}
              inCombat={inCombat}
              isMeditating={isMeditating}
              currency={{ copper, silver, gold, platinum }}
            />
            <InventoryPanel inventory={inventory} />
          </div>

          <div className="space-y-6">
            <ZonePanel currentZone={currentZone} />
            <CombatPanel
              currentMob={currentMob}
              mobHp={mobHp}
              attackMob={attackMob}
              toggleAutoAttack={toggleAutoAttack}
              isAutoAttack={isAutoAttack}
              fleeCombat={fleeCombat}
              toggleMeditate={toggleMeditate}
              playerClass={playerClass}
              inCombat={inCombat}
              isMeditating={isMeditating}
            />
            <CombatLog combatLog={combatLog} />
          </div>

          <div className="space-y-6">
            <InstructionsPanel isCaster={playerClass.isCaster} />
            <StatsPanel
              playerClass={playerClass}
              level={level}
              inCombat={inCombat}
              isMeditating={isMeditating}
              inventoryLength={inventory.length}
            />
            <FutureFeaturesPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
