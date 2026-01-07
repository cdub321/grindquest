import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { get_zone_background_candidates } from '../utils/zoneUtils';
import { pick_random_biome_audio } from '../utils/audioUtils';

/**
 * Hook to manage zone-related utilities (chat, background, and music)
 *
 * @param {Object} params
 * @param {string} params.zone_id - Current zone ID
 * @param {string} params.biome - Current zone biome (for music selection)
 * @param {string} params.character_name - Character name for presence tracking
 * @param {string} params.user_id - User ID for presence key (optional)
 * @returns {Object} Zone utilities state and functions
 */
export function use_zone_utils({
  zone_id,
  biome = null,
  character_name = 'Player',
  user_id = null
}) {
  // ===== Zone Chat State =====
  const [chat_input, set_chat_input] = useState('');
  const [messages, set_messages] = useState([]);
  const [zone_users, set_zone_users] = useState([]);
  const channel_ref = useRef(null);
  const chat_ref = useRef(null);

  // ===== Zone Background State =====
  const [bg_url, set_bg_url] = useState('/stone-ui/zonepanelbacks/stock.png');
  const [is_loading_bg, set_is_loading_bg] = useState(true);
  const bg_token_ref = useRef(0);

  // ===== Zone Music State =====
  const audio_ref = useRef(null);
  const current_biome_ref = useRef(biome);

  // ===== Zone Chat Setup =====
  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chat_ref.current) {
      chat_ref.current.scrollTop = chat_ref.current.scrollHeight;
    }
  }, [messages]);
  
  // Setup Supabase real-time channel for zone chat
  useEffect(() => {
    if (!zone_id || !supabase) return;
    
    const channel_name = `zone_chat:${zone_id}`;
    const channel = supabase.channel(channel_name, {
      config: {
        presence: { key: user_id || character_name || 'anon' }
      }
    });
    
    // Listen for presence updates (zone user list)
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).map((entries) => entries[0]?.user || 'Unknown');
        set_zone_users(users);
      })
      // Listen for broadcast messages
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        if (!payload) return;
        set_messages((prev) => [...prev.slice(-99), payload]);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user: character_name || 'Player' });
          // Set channel ref only after subscription is confirmed
          channel_ref.current = channel;
        }
      });
    
    return () => {
      channel.unsubscribe();
      channel_ref.current = null;
    };
  }, [zone_id, character_name, user_id]);
  
  // ===== Zone Background Setup =====
  useEffect(() => {
    const token = Date.now() + Math.random();
    bg_token_ref.current = token;
    set_is_loading_bg(true);

    const zone_id_str = zone_id || 'stock';

    // Get candidates from utility function
    const candidates = get_zone_background_candidates(zone_id_str);

    /**
     * Try loading images in sequence until one succeeds
     */
    const try_load_image = (candidate_list, index = 0) => {
      if (index >= candidate_list.length) {
        // All candidates failed, use default stock
        if (bg_token_ref.current === token) {
          set_bg_url('/stone-ui/zonepanelbacks/stock.png');
          set_is_loading_bg(false);
        }
        return;
      }

      const candidate_url = candidate_list[index];
      const img = new Image();

      img.onload = () => {
        // Only update if this is still the current zone
        if (bg_token_ref.current === token) {
          set_bg_url(candidate_url);
          set_is_loading_bg(false);
        }
      };

      img.onerror = () => {
        // Try next candidate
        try_load_image(candidate_list, index + 1);
      };

      img.src = candidate_url;
    };

    try_load_image(candidates);
  }, [zone_id]);

  // ===== Zone Music Setup =====
  useEffect(() => {
    current_biome_ref.current = biome;

    const start_next_track = () => {
      // Stop and clean up previous audio
      if (audio_ref.current) {
        audio_ref.current.pause();
        audio_ref.current.src = '';
        audio_ref.current = null;
      }

      const audio_path = pick_random_biome_audio(current_biome_ref.current);
      const audio = new Audio(audio_path);
      audio.loop = false;
      audio.volume = 0.1;

      audio.onended = () => {
        // When track ends, pick another random track for the current biome
        start_next_track();
      };

      audio.play().catch((err) => {
        console.log('Audio autoplay blocked (user interaction required):', err);
      });

      audio_ref.current = audio;
    };

    start_next_track();

    // Cleanup on unmount or biome change
    return () => {
      if (audio_ref.current) {
        audio_ref.current.pause();
        audio_ref.current.src = '';
        audio_ref.current = null;
      }
    };
  }, [biome]);
  
  // ===== Zone Chat Functions =====
  /**
   * Send a chat message to the zone
   */
  const send_chat = useCallback(async () => {
    const text = chat_input.trim();
    if (!text || !zone_id) return;
    
    const channel = channel_ref.current;
    if (!channel) {
      console.warn('Zone chat channel not ready yet');
      return;
    }
    
    set_chat_input('');
    
    const payload = {
      user: character_name || 'Player',
      text,
      ts: Date.now()
    };
    
    // Broadcast to the current zone channel (Supabase real-time, no table needed)
    await channel.send({
      type: 'broadcast',
      event: 'message',
      payload
    });
  }, [chat_input, zone_id, character_name]);
  
  /**
   * Handle Enter key press in chat input
   */
  const handle_chat_submit = useCallback((e) => {
    if (e) e.preventDefault();
    send_chat();
  }, [send_chat]);
  
  return {
    // Zone Chat
    chat_input,
    messages,
    zone_users,
    chat_ref,
    set_chat_input,
    send_chat,
    handle_chat_submit,
    
    // Zone Background
    bg_url,
    is_loading_bg
  };
}

